import * as net from "net";
import * as http from "http";
import * as parameters from "./parameters";

export class httpProxy {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly httpServer: http.Server;

    constructor(params: parameters.params) {
        const httpServer = http.createServer((req, res) => {
            let matchedHostPort: RegExpMatchArray | null;
            if (
                req.method == null || req.url == null
                || (
                    (matchedHostPort = req.url.match(/^http:\/\/[^\/]+\//)) == null
                    && !req.url.startsWith("/")
                )
            ) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end("403 Forbidden");
                return;
            }

            let host: string, port: number, path: string;

            if (matchedHostPort == null) {
                //invisible mode
                let svrHost: string, svrPort: number;
                if (req.headers.host == null) {
                    console.error("cannot find hostname");
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end("403 Forbidden");
                    return;
                }
                let matchedPort = req.headers.host.match(/:\d{1,5}$/);
                if (matchedPort == null) {
                    svrHost = req.headers.host;
                    svrPort = 80;
                } else {
                    svrHost = req.headers.host.substring(0, req.headers.host.length - matchedPort[0].length);
                    svrPort = parseInt(matchedPort[0].replace(/:/g, ""));
                    if (isNaN(svrPort)) {
                        console.error("cannot parse port");
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end("403 Forbidden");
                    }
                }
                if (params.upstreamProxyEnabled) {
                    host = params.upstreamProxy.host;
                    port = params.upstreamProxy.port;
                    path = `http://${svrHost}:${svrPort}${req.url}`;//convert to proxy-style
                } else {
                    host = svrHost;
                    port = svrPort;
                    path = req.url;//not a proxy-style path because we are in invisible mode
                }
            } else {
                //ordinary HTTP proxy mode
                if (params.upstreamProxyEnabled) {
                    host = params.upstreamProxy.host;
                    port = params.upstreamProxy.port;
                    path = req.url;//url is already proxy-style
                } else {
                    let matchedPort = matchedHostPort[0].match(/(:\d{1,5}|)\/$/);
                    if (matchedPort == null) {
                        console.log("cannot match port");
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end("403 Forbidden");
                        return;
                    }
                    host = req.url.substring("http://".length, matchedHostPort[0].length - matchedPort[0].length);
                    port = parseInt(matchedPort[0].replace(/:|\//g, ""));
                    if (isNaN(port)) port = 80;
                    path = req.url.substring(matchedHostPort[0].length - 1, req.url.length);//extract path from proxy-style url
                }
            }

            for (let key in req.headers) {
                if (key.match(/^proxy/i)) delete req.headers[key];
            }

            let logMsg: string;
            if (params.upstreamProxyEnabled)
                logMsg = `proxified ${req.socket.remoteAddress}:${req.socket.remotePort} => ${host}:${port} => ${path}`;
            else
                logMsg = `direct ${req.socket.remoteAddress}:${req.socket.remotePort} => http://${host}:${port}${path}`;
            console.log(logMsg);

            let proxyReq = http.request({
                host: host,
                port: port,
                path: path,
                method: req.method,
                headers: req.headers,
            }, (svrRes) => {
                let statusCode = svrRes.statusCode == null ? 502 : svrRes.statusCode;
                let statusMessage = svrRes.statusCode == null ? "Bad Gateway" : svrRes.statusMessage;
                res.writeHead(statusCode, statusMessage, svrRes.headers);
                svrRes.pipe(res);
            }).on('end', () => {
                res.end();
            }).on('error', (error) => {
                console.error(error);
                res.writeHead(502, "Bad Gateway", { "Content-Type": "text/plain" });
                res.end("502 Bad Gateway");
            });

            req.on("data", (chunk) => {
                proxyReq.write(chunk);
            }).on("error", (error) => {
                console.error(error);
                res.writeHead(502, "Bad Gateway", { "Content-Type": "text/plain" });
                res.end("502 Bad Gateway");
                proxyReq.end();
            }).on("end", () => {
                proxyReq.end();
            });
        });

        httpServer.on('connect', (req, socket: net.Socket, head) => {
            if (req.url == null) {
                console.error(`Empty URL in proxy request from ${socket.remoteAddress}:${socket.remotePort}`);
                socket.end();
                return;
            }

            socket.on('error', (e) => {
                let logMsg = `${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
                console.error(`Error: ${logMsg}`, e);
                socket.end();
            });

            let logMsg = `HTTP CONNECT ${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
            console.log(logMsg);

            let matched = req.url.match(/:\d+$/);
            if (matched == null) {
                console.error(`Error: port not matched`);
                socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
                return;
            }
            let port = parseInt((matched[0].match(/\d+$/) as RegExpMatchArray)[0]);
            let host = req.url.substring(0, req.url.length - matched[0].length);

            if (port == 443) {
                //pass to local server, which will then pass to upstream HTTP CONNECT proxy if possible
                const localServerHost = this.params.listenList.localServer.host;
                const localServerPort = this.params.listenList.localServer.port;
                let conn = net.connect(localServerPort, localServerHost, () => {
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
            //pass to myself, in so-called "invisible proxy" mode
            //`host` and `port` parsed from CONNECT is ignored
            const selfPort = this.params.listenList.httpProxy.port;
            const selfHost = this.params.listenList.httpProxy.host;
            let conn = net.connect(selfPort, selfHost, () => {
                socket.write("HTTP/1.1 200 Connection Established\r\n\r\n", () => {
                    conn.pipe(socket);
                    socket.pipe(conn);
                });
            });
            conn.on('error', (e) => {
                console.error(`Error: ${logMsg}`, e);
                socket.end();
            });
        });

        let listenAddr = params.listenList.httpProxy;
        httpServer.listen(listenAddr.port, listenAddr.host);

        this.params = params;
        this.httpServer = httpServer;
    }
    close(): void {
        this.httpServer.close();
        this._closed = true;
    }
}