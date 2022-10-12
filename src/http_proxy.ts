import * as net from "net";
import * as http from "http";
import * as parameters from "./parameters";
import * as localServer from "./local_server";

export class httpProxy {
    private readonly params: parameters.params;
    private httpServer: http.Server;

    constructor(params: parameters.params) {
        this.httpServer = this.createHttpServer(params);
        this.params = params;
    }
    private createHttpServer(params: parameters.params): http.Server {
        const httpServer = http.createServer((req, res) => {
            req.destroy(); res.destroy();
        });

        httpServer.on('connect', async (req, socket: net.Socket, head) => {
            if (socket.localAddress !== "127.0.0.1") {
                const authorization = req.headers["proxy-authorization"]?.replace(/^Basic\s+/i, "");
                const realmStr = `${this.params.httpProxyUsername}:${this.params.httpProxyPassword}`;
                const correctAuthStr = `${Buffer.from(realmStr, 'utf-8').toString('base64')}`
                if (authorization !== correctAuthStr) {
                    console.error(`rejected invalid authorization from ${socket.remoteAddress}:${socket.remotePort}`);
                    req.destroy(); socket.destroy();
                    return;
                }
            }

            if (req.url == null) {
                console.error(`Empty URL in proxy request from ${socket.remoteAddress}:${socket.remotePort}`);
                req.destroy(); socket.destroy();
                return;
            }

            socket.on('error', (e) => {
                let logMsg = `${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
                console.error(`Error: ${logMsg}`, e);
                req.destroy(); socket.destroy();
            });

            let logMsg = `HTTP CONNECT ${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
            if (parameters.params.VERBOSE) console.log(logMsg);

            let matched = req.url.match(/:\d+$/);
            if (matched == null) {
                console.error(`Error: port not matched`);
                socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
                return;
            }
            let port = parseInt((matched[0].match(/\d+$/) as RegExpMatchArray)[0]);
            let host = req.url.substring(0, req.url.length - matched[0].length);

            const localH2Host = this.params.listenList.localServer.host;
            const localH2Port = this.params.listenList.localServer.port;
            const localH1Host = this.params.listenList.localHttp1Server.host;
            const localH1Port = this.params.listenList.localHttp1Server.port;
            let isLocalH2 = port == localH2Port && host == localH2Host;
            let isLocalH1 = port == localH1Port && host == localH1Host;
            let isControlInterface = host.match(/^(|www\.)magireco\.local$/) ? true : false;
            if (port == 443 || isLocalH2 || isLocalH1) {
                //probe supportH2 (if unprobed) first
                const authorityURL = new URL(`https://${host}:${port}`);
                let supportH2: boolean | undefined;
                if (isLocalH2) supportH2 = true;//skip probing because getTlsSocketAsync disallows conneting to local
                else if (isLocalH1) supportH2 = false;//same as above, skip probing
                else if (isControlInterface) supportH2 = false;
                else {
                    supportH2 = this.params.getSupportH2(authorityURL);
                    if (supportH2 == null) try {
                        if (parameters.params.VERBOSE) console.log(`probe supportH2: [${authorityURL}] ...`);
                        const alpn = "h2";
                        let probeTlsSocket = await localServer.localServer.getTlsSocketAsync(this.params, false,
                            authorityURL, alpn, host);
                        probeTlsSocket.on('error', (e) => {
                            console.error(`probeTlsSocket error ${logMsg}`, e);
                        });
                        supportH2 = probeTlsSocket.alpnProtocol === alpn;
                        if (parameters.params.VERBOSE) console.log(`probe result: [${authorityURL}] supportH2=${supportH2}`);
                        this.params.setSupportH2(authorityURL, supportH2);
                        probeTlsSocket.destroy();
                    } catch (e) {
                        console.error(e);
                        supportH2 = undefined;
                    }
                }
                //probe finished
                if (supportH2 == null) {
                    console.error(`cannot probe supportH2: [${authorityURL}]`);
                    supportH2 = true;
                }
                //pass to local server, which will then pass to upstream HTTP CONNECT proxy if possible
                let localPort = supportH2 ? localH2Port : localH1Port;
                let localHost = supportH2 ? localH2Host : localH1Host;
                let conn = net.connect(localPort, localHost, () => {
                    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n", () => {
                        conn.pipe(socket);
                        socket.pipe(conn);
                    });
                });
                conn.on('error', (e) => {
                    console.error(`Error: ${logMsg}`, e);
                    socket.end();
                });
                return;
            }

            //port number is not 443
            socket.destroy();
        });

        let listenAddr = params.listenList.httpProxy;
        httpServer.listen(listenAddr.port, listenAddr.host);
        console.log(`httpProxy listening on [${listenAddr.host}:${listenAddr.port}]`);
        if (params.upstreamProxyEnabled) {
            let proxy = params.upstreamProxy;
            console.log(`localServer upstream proxy enabled [${proxy.host}:${proxy.port}]`
                + ` cacert [${params.upstreamProxyCACert != null}]`);
        } else {
            console.log(`httpProxy upstream proxy disabled`);
        }
        return httpServer;
    }
    async close(): Promise<void> {
        await new Promise<void>((resolve) => {
            this.httpServer.on('close', () => resolve());
            this.httpServer.close();
            this.httpServer.closeAllConnections();
        });
    }
    async restart(): Promise<void> {
        await this.close();
        this.httpServer = this.createHttpServer(this.params);
    }
}