"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpProxy = void 0;
const net = require("net");
const http = require("http");
const parameters = require("./parameters");
const localServer = require("./local_server");
class httpProxy {
    constructor(params) {
        const httpServer = http.createServer((req, res) => {
            let matchedHostPort;
            if (req.method == null || req.url == null
                || ((matchedHostPort = req.url.match(/^http:\/\/[^\/]+\//)) == null
                    && !req.url.startsWith("/"))) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end("403 Forbidden");
                return;
            }
            let host, port, path;
            let isControlInterface = false;
            if (matchedHostPort == null) {
                //invisible mode
                let svrHost, svrPort;
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
                }
                else {
                    svrHost = req.headers.host.substring(0, req.headers.host.length - matchedPort[0].length);
                    svrPort = parseInt(matchedPort[0].replace(/:/g, ""));
                    if (isNaN(svrPort)) {
                        console.error("cannot parse port");
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end("403 Forbidden");
                        return;
                    }
                }
                let selfHost = this.params.listenList.httpProxy.host;
                let selfPort = this.params.listenList.httpProxy.port;
                if ((svrHost === selfHost || svrHost === "localhost") && svrPort == selfPort) {
                    console.error("should not self-connect"); //FIXME
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end("403 Forbidden");
                    return;
                }
                if (svrHost.match(/^(|www\.)magireco\.local$/)) {
                    isControlInterface = true;
                    host = params.listenList.controlInterface.host;
                    req.headers.host = `${svrHost}:${svrPort}`;
                    port = params.listenList.controlInterface.port;
                    path = req.url; //not a proxy-style path because we are in invisible mode
                }
                else if (params.upstreamProxyEnabled) {
                    host = params.upstreamProxy.host;
                    port = params.upstreamProxy.port;
                    path = `http://${svrHost}:${svrPort}${req.url}`; //convert to proxy-style
                }
                else {
                    host = svrHost;
                    port = svrPort;
                    path = req.url; //not a proxy-style path because we are in invisible mode
                }
            }
            else {
                //ordinary HTTP proxy mode
                if (matchedHostPort[0].match(/^http:\/\/(|www\.)magireco\.local(|:\d{1,5})\/$/)) {
                    isControlInterface = true;
                    host = this.params.listenList.controlInterface.host;
                    req.headers.host = matchedHostPort[0].replace(/(^http:\/\/)|\/$/g, "");
                    port = this.params.listenList.controlInterface.port;
                    path = req.url.replace(matchedHostPort[0], "/");
                }
                else if (params.upstreamProxyEnabled) {
                    host = params.upstreamProxy.host;
                    port = params.upstreamProxy.port;
                    path = req.url; //url is already proxy-style
                }
                else {
                    let matchedPort = matchedHostPort[0].match(/(:\d{1,5}|)\/$/);
                    if (matchedPort == null) {
                        console.log("cannot match port");
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end("403 Forbidden");
                        return;
                    }
                    host = req.url.substring("http://".length, matchedHostPort[0].length - matchedPort[0].length);
                    port = parseInt(matchedPort[0].replace(/:|\//g, ""));
                    if (isNaN(port))
                        port = 80;
                    path = req.url.substring(matchedHostPort[0].length - 1, req.url.length); //extract path from proxy-style url
                }
            }
            for (let key in req.headers) {
                if (key.match(/^proxy/i))
                    delete req.headers[key];
            }
            let logMsg;
            if (params.upstreamProxyEnabled && !isControlInterface)
                logMsg = `proxified ${req.socket.remoteAddress}:${req.socket.remotePort} => ${host}:${port} => ${path}`;
            else
                logMsg = `direct ${req.socket.remoteAddress}:${req.socket.remotePort} => http://${host}:${port}${path}`;
            if (parameters.params.VERBOSE)
                console.log(logMsg);
            let proxyReq = http.request({
                host: host,
                port: port,
                path: path,
                method: req.method,
                headers: req.headers,
            }, (svrRes) => {
                if (svrRes.statusCode == null) {
                    res.writeHead(502, { "Content-Type": "text/plain" });
                    res.end("502 Bad Gateway");
                }
                else {
                    if (svrRes.statusMessage == null)
                        res.writeHead(svrRes.statusCode, svrRes.headers);
                    else
                        res.writeHead(svrRes.statusCode, svrRes.statusMessage, svrRes.headers);
                    svrRes.pipe(res);
                }
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
        httpServer.on('connect', async (req, socket, head) => {
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
                let supportH2;
                if (isLocalH2)
                    supportH2 = true; //skip probing because getTlsSocketAsync disallows conneting to local
                else if (isLocalH1)
                    supportH2 = false; //same as above, skip probing
                else if (isControlInterface)
                    supportH2 = false;
                else {
                    supportH2 = this.params.getSupportH2(authorityURL);
                    if (supportH2 == null)
                        try {
                            if (parameters.params.VERBOSE)
                                console.log(`probe supportH2: [${authorityURL}] ...`);
                            const alpn = "h2";
                            let probeTlsSocket = await localServer.localServer.getTlsSocketAsync(this.params, false, authorityURL, alpn, host);
                            probeTlsSocket.on('error', (e) => {
                                console.error(`probeTlsSocket error ${logMsg}`, e);
                            });
                            supportH2 = probeTlsSocket.alpnProtocol === alpn;
                            if (parameters.params.VERBOSE)
                                console.log(`probe result: [${authorityURL}] supportH2=${supportH2}`);
                            this.params.setSupportH2(authorityURL, supportH2);
                            probeTlsSocket.destroy();
                        }
                        catch (e) {
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
        console.log(`httpProxy listening on [${listenAddr.host}:${listenAddr.port}]`);
        if (params.upstreamProxyEnabled) {
            let proxy = params.upstreamProxy;
            console.log(`localServer upstream proxy enabled [${proxy.host}:${proxy.port}]`
                + ` cacert [${params.upstreamProxyCACert != null}]`);
        }
        else {
            console.log(`httpProxy upstream proxy disabled`);
        }
        this.params = params;
        this.httpServer = httpServer;
    }
    async close() {
        await new Promise((resolve) => {
            this.httpServer.on('close', () => resolve());
            this.httpServer.close();
            this.httpServer.closeAllConnections();
        });
    }
}
exports.httpProxy = httpProxy;
