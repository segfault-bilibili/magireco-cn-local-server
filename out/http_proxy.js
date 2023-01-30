"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpProxy = void 0;
const net = require("net");
const http = require("http");
const parameters = require("./parameters");
class httpProxy {
    constructor(params) {
        this.httpServer = this.createHttpServer(params);
        this.params = params;
        this.socketSet = new Set();
        this.blockedList = [
            /^line\d-log\.biligame\.net$/,
            /^api\.biligame\.net$/,
            /^line\d\-realtime-api\.biligame\.net$/,
            /^gameinfoc\.biligame\.net$/,
            /^line\d-sdkcenter-login\.bilibiligame\.net$/, /* not sdk-center */
        ];
    }
    createHttpServer(params) {
        const httpServer = http.createServer((req, res) => {
            req.destroy();
            res.destroy();
        });
        httpServer.on('connect', async (req, socket, head) => {
            var _a;
            if (socket.localAddress !== "127.0.0.1") {
                const authorization = (_a = req.headers["proxy-authorization"]) === null || _a === void 0 ? void 0 : _a.replace(/^Basic\s+/i, "");
                const realmStr = `${this.params.httpProxyUsername}:${this.params.httpProxyPassword}`;
                const correctAuthStr = `${Buffer.from(realmStr, 'utf-8').toString('base64')}`;
                if (authorization !== correctAuthStr) {
                    console.error(`rejected invalid authorization from ${socket.remoteAddress}:${socket.remotePort}`);
                    req.destroy();
                    socket.destroy();
                    return;
                }
            }
            this.socketSet.add(socket);
            socket.on('close', () => this.socketSet.delete(socket));
            if (req.url == null) {
                console.error(`Empty URL in proxy request from ${socket.remoteAddress}:${socket.remotePort}`);
                req.destroy();
                socket.destroy();
                return;
            }
            socket.on('error', (e) => {
                let logMsg = `${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
                console.error(`Error: ${logMsg}`, e);
                req.destroy();
                socket.destroy();
            });
            let logMsg = `HTTP CONNECT ${socket.remoteAddress}:${socket.remotePort} => ${req.url}`;
            if (parameters.params.VERBOSE)
                console.log(logMsg);
            let matched = req.url.match(/:\d+$/);
            if (matched == null) {
                console.error(`Error: port not matched`);
                socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
                return;
            }
            let port = parseInt(matched[0].match(/\d+$/)[0]);
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
        }
        else {
            console.log(`httpProxy upstream proxy disabled`);
        }
        return httpServer;
    }
    async close() {
        await new Promise((resolve) => {
            this.httpServer.on('close', () => resolve());
            this.httpServer.closeAllConnections();
            this.socketSet.forEach((val) => { try {
                val.destroy();
            }
            catch (e) { } });
            this.socketSet.clear();
            this.httpServer.close();
        });
    }
    async restart() {
        await this.close();
        this.httpServer = this.createHttpServer(this.params);
    }
}
exports.httpProxy = httpProxy;
