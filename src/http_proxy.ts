import * as net from "net";
import * as http from "http";
import * as parameters from "./parameters";

export class httpProxy {
    private readonly params: parameters.params;
    private httpServer: http.Server;
    private readonly socketSet: Set<net.Socket>;

    private readonly blockedList: Array<RegExp | string>;

    constructor(params: parameters.params) {
        this.httpServer = this.createHttpServer(params);
        this.params = params;
        this.socketSet = new Set<net.Socket>();
        this.blockedList = [
            /^line\d-log\.biligame\.net$/,
            /^p\.biligame\.com$/,
            /^api\.biligame\.net$/,
            /^line\d\-realtime-api\.biligame\.net$/,
            /^line\d-sdk-app-api\.biligame\.net$/,
            /^gameinfoc\.biligame\.net$/,
            /^line\d-sdkcenter-login\.bilibiligame\.net$/,/* not sdk-center */
        ];
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

            this.socketSet.add(socket);
            socket.on('close', () => this.socketSet.delete(socket));

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


            if (this.blockedList.find((pattern) => host.match(pattern))) {
                socket.destroy();
                return;
            }

            let isControlInterface = host.match(/^(|www\.)magireco\.local$/) ? true : false;
            if (port == 443 || isControlInterface) {
                //pass to local server, which will then pass to upstream HTTP CONNECT proxy if possible
                let key = isControlInterface ? "controlInterface" : "localServer";
                let localPort = this.params.listenList[key].port;
                let localHost = this.params.listenList[key].host;
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
            this.httpServer.closeAllConnections();
            this.socketSet.forEach((val) => { try { val.destroy(); } catch (e) { } });
            this.socketSet.clear();
            this.httpServer.close();
        });
    }
    async restart(): Promise<void> {
        await this.close();
        this.httpServer = this.createHttpServer(this.params);
    }
}