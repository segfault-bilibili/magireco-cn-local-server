"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localServer = exports.constants = void 0;
const net = require("net");
const http = require("http");
const http2 = require("http2");
const tls = require("tls");
const zlib = require("zlib");
const parameters = require("./parameters");
const certGenerator = require("./cert_generator");
const url_1 = require("url");
const parse_charset_1 = require("./parse_charset");
const save_access_key_hook_1 = require("./hooks/save_access_key_hook");
const save_open_id_ticket_hook_1 = require("./hooks/save_open_id_ticket_hook");
var constants;
(function (constants) {
    constants["DOWNGRADE_TO_HTTP1"] = "DOWNGRADE_TO_HTTP1";
    constants["IS_SELF_IP"] = "IS_SELF_IP";
})(constants = exports.constants || (exports.constants = {}));
class localServer {
    constructor(params) {
        const certGen = new certGenerator.certGen(params.CACertAndKey);
        const SNICallback = (servername, cb) => {
            let certAndKey = this.certGen.getCertAndKey(servername);
            let ctx = tls.createSecureContext(certAndKey);
            cb(null, ctx);
        };
        const http2ServerOptions = certGen.getCertAndKey(params.listenList.localServer.host);
        http2ServerOptions.SNICallback = SNICallback;
        http2ServerOptions.allowHTTP1 = true;
        const http2SecureServer = http2.createSecureServer(http2ServerOptions, async (cliReq, cliRes) => {
            if (cliReq.httpVersionMajor !== 1)
                return; //handled in stream event
            const reqHeaders = cliReq.headers;
            const host = reqHeaders.host;
            const alpn = cliReq.socket.alpnProtocol;
            const sni = cliReq.socket.servername;
            cliReq.on('error', (err) => {
                console.error(`request error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
            });
            if (host == null) {
                try {
                    cliRes.writeHead(403, { ["Content-Type"]: "text/plain" });
                    cliRes.end("403 Forbidden");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
                return;
            }
            if (parameters.params.VERBOSE)
                console.log(`request accepted, host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
            try {
                // hook
                const method = cliReq.method;
                const url = new url_1.URL(cliReq.url, `https://${host}/`);
                const reqHttpVer = cliReq.httpVersion;
                let reqBodyBuf = Buffer.from(new ArrayBuffer(0)), reqBodyStr;
                const matchedHooks = this.hooks.filter((item) => item.matchRequest(method, url, reqHttpVer, reqHeaders));
                let statusCode;
                let statusMessage;
                let respHttpVer;
                let respHeaders;
                let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr;
                let socket;
                if (host.match(/^(|www\.)magireco\.local(|:\d{1,5})$/)) {
                    let controlInterfaceHost = this.params.listenList.controlInterface.host;
                    let controlInterfacePort = this.params.listenList.controlInterface.port;
                    socket = await localServer.directConnectAsync(controlInterfaceHost, controlInterfacePort);
                }
                else {
                    socket = await localServer.getTlsSocketAsync(this.params, true, new url_1.URL(`https://${host}/`), alpn, sni);
                }
                let svrReq = http.request({
                    method: cliReq.method,
                    path: cliReq.url,
                    createConnection: (options, onCreate) => {
                        return socket;
                    },
                    headers: reqHeaders,
                });
                svrReq.on('continue', () => {
                    try {
                        cliRes.writeHead(100);
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                    }
                });
                svrReq.on('response', (svrRes) => {
                    // hook
                    statusCode = svrRes.statusCode;
                    statusMessage = svrRes.statusMessage;
                    respHttpVer = svrRes.httpVersion;
                    respHeaders = svrRes.headers;
                    try {
                        if (statusCode == null) {
                            cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                            cliRes.end("502 Bad Gateway");
                        }
                        else {
                            if (statusMessage == null)
                                cliRes.writeHead(statusCode, respHeaders);
                            else
                                cliRes.writeHead(statusCode, statusMessage, respHeaders);
                            svrRes.on('data', (chunk) => {
                                // hook
                                if (matchedHooks.length > 0)
                                    respBodyBuf = Buffer.concat([respBodyBuf, chunk]);
                                try {
                                    cliRes.write(chunk);
                                }
                                catch (e) {
                                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                    console.error(`http1 host=[${host}] cliRes.write() error`, e);
                                }
                            });
                            svrRes.on('end', () => {
                                // hook
                                if (matchedHooks.length > 0) {
                                    try {
                                        const encoding = respHeaders["content-encoding"];
                                        respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                                        const charset = parse_charset_1.parseCharset.get(respHeaders);
                                        respBodyStr = respBodyBuf.toString(charset);
                                    }
                                    catch (e) {
                                        console.error(`http1 hook host=[${host}] decompressing or decoding respBodyBuf to string error`, e);
                                    }
                                    const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                                    matchedHooks.forEach((item) => item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                                }
                                if (parameters.params.VERBOSE)
                                    console.log(`ending cliRes downlink: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                                try {
                                    cliRes.end();
                                }
                                catch (e) {
                                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                    console.error(`http1 host=[${host}] cliRes.end() error`, e);
                                }
                            });
                        }
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrRes.writeHead() error`, e);
                    }
                });
                svrReq.on('end', () => {
                    if (parameters.params.VERBOSE)
                        console.log(`ending cliRes downlink: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                    try {
                        cliRes.end();
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] cliRes.end() error`, e);
                    }
                });
                svrReq.on('error', (err) => {
                    console.error(`svrReq error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                    try {
                        cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                        cliRes.end("502 Bad Gateway");
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                    }
                });
                cliReq.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0)
                        reqBodyBuf = Buffer.concat([reqBodyBuf, chunk]);
                    try {
                        svrReq.write(chunk);
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrReq.write() error`, e);
                    }
                });
                cliReq.on('end', () => {
                    if (parameters.params.VERBOSE)
                        console.log(`cliReq uplink ended: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parse_charset_1.parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        }
                        catch (e) {
                            console.error(`http1 hook host=[${host}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedRequest(method, url, reqHttpVer, reqHeaders, body));
                    }
                    try {
                        svrReq.end();
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrReq.end() error`, e);
                    }
                });
            }
            catch (e) {
                try {
                    if (e instanceof Error)
                        switch (e.message) {
                            case constants.IS_SELF_IP:
                                cliRes.writeHead(200, { ["Content-Type"]: 'text/plain' });
                                cliRes.end('Magireco Local Server');
                                return;
                        }
                    console.error("cannot create http1 tlsSocket", e);
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
                return;
            }
            ;
        });
        http2SecureServer.on('stream', async (cliReqStream, reqHeaders, flags) => {
            const authority = reqHeaders[":authority"];
            const authorityURL = new url_1.URL(`https://${authority}/`);
            const alpn = cliReqStream.session.alpnProtocol;
            const sni = cliReqStream.session.socket.servername;
            cliReqStream.on('error', (err) => {
                if (parameters.params.VERBOSE)
                    console.log(`cliReqStream error: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    cliReqStream.end("502 Bad Gateway");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                }
            });
            if (authority == null) {
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: 403,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                    });
                    cliReqStream.end("403 Forbidden");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                }
                return;
            }
            if (parameters.params.VERBOSE)
                console.log(`http2 cliReqStream accepted, authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
            try {
                // hook
                const method = reqHeaders[":method"];
                const url = reqHeaders[":path"] == null ? undefined : new url_1.URL(reqHeaders[":path"], `https://${authority}/`);
                const reqHttpVer = "2.0"; //FIXME
                let reqBodyBuf = Buffer.from(new ArrayBuffer(0)), reqBodyStr;
                const matchedHooks = this.hooks.filter((item) => item.matchRequest(method, url, reqHttpVer, reqHeaders));
                let statusCode;
                let statusMessage;
                const respHttpVer = "2.0";
                let respHeaders;
                let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr;
                let sess = await this.getH2SessionAsync(authorityURL, alpn, sni);
                let svrReq = sess.request(reqHeaders);
                svrReq.on('continue', () => {
                    try {
                        cliReqStream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_CONTINUE,
                        });
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                    }
                });
                svrReq.on('response', (headers, flags) => {
                    // hook
                    respHeaders = headers;
                    statusCode = respHeaders[":status"];
                    statusMessage = undefined; // Status message is not supported by HTTP/2 (RFC 7540 8.1.2.4)
                    //respHttpVer = undefined;
                    try {
                        cliReqStream.respond(respHeaders);
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                    }
                });
                svrReq.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0)
                        respBodyBuf = Buffer.concat([respBodyBuf, chunk]);
                    try {
                        cliReqStream.write(chunk);
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.write() error`, e);
                    }
                });
                svrReq.on('end', () => {
                    if (parameters.params.VERBOSE)
                        console.log(`ending cliReqStream downlink: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = respHeaders["content-encoding"];
                            respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                            const charset = parse_charset_1.parseCharset.get(respHeaders);
                            respBodyStr = respBodyBuf.toString(charset);
                        }
                        catch (e) {
                            console.error(`http2 hook authority=[${authority}] decompressing or decoding respBodyBuf to string error`, e);
                        }
                        const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                    }
                    try {
                        cliReqStream.end();
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.end() error`, e);
                    }
                });
                svrReq.on('error', (err) => {
                    console.error(`svrReq error: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`, err);
                    try {
                        cliReqStream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                        });
                        cliReqStream.end("502 Bad Gateway");
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                    }
                });
                cliReqStream.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0)
                        reqBodyBuf = Buffer.concat([reqBodyBuf, chunk]);
                    try {
                        svrReq.write(chunk);
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] svrReq.write() error`, e);
                    }
                });
                cliReqStream.on('end', () => {
                    if (parameters.params.VERBOSE)
                        console.log(`cliReqStream uplink ended: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parse_charset_1.parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        }
                        catch (e) {
                            console.error(`http2 hook authority=[${authority}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedRequest(method, url, reqHttpVer, reqHeaders, body));
                    }
                    try {
                        svrReq.end();
                    }
                    catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] svrReq.end() error`, e);
                    }
                });
            }
            catch (e) {
                if (e instanceof Error)
                    switch (e.message) {
                        case constants.IS_SELF_IP:
                            try {
                                cliReqStream.respond({
                                    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_OK,
                                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                                });
                                cliReqStream.end('Magireco Local Server');
                            }
                            catch (e) {
                                //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                            }
                            return;
                        case constants.DOWNGRADE_TO_HTTP1:
                            //FIXME
                            this.params.setSupportH2(authorityURL, false); //FIXME not working when IP addr used in HTTP CONNECT
                            if (parameters.params.VERBOSE)
                                console.log(`marked [${authorityURL}] supportHTTP2=false`);
                            if (parameters.params.VERBOSE)
                                console.log("sending status code 505 and goaway");
                            try {
                                cliReqStream.respond({
                                    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
                                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                                });
                                cliReqStream.end("505 HTTP Version Not Supported");
                                cliReqStream.session.goaway(http2.constants.NGHTTP2_HTTP_1_1_REQUIRED);
                            }
                            catch (e) {
                                //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                            }
                            return;
                    }
                console.error("cannot create http2 session", e);
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    cliReqStream.end("502 Bad Gateway");
                }
                catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                }
            }
            ;
        });
        const http2ListenAddr = params.listenList.localServer;
        http2SecureServer.listen(http2ListenAddr.port, http2ListenAddr.host);
        console.log(`localServer listening on [${http2ListenAddr.host}:${http2ListenAddr.port}]`);
        if (params.upstreamProxyEnabled) {
            let proxy = params.upstreamProxy;
            console.log(`localServer upstream proxy enabled [${proxy.host}:${proxy.port}]`
                + ` cacert [${params.upstreamProxyCACert != null}]`);
        }
        else {
            console.log(`localServer upstream proxy disabled`);
        }
        const http1TlsServerOptions = certGen.getCertAndKey(params.listenList.localHttp1Server.host);
        http1TlsServerOptions.SNICallback = SNICallback;
        http1TlsServerOptions.ALPNProtocols = ["http/1.1"];
        const http1TlsServer = tls.createServer(http1TlsServerOptions);
        http1TlsServer.on('secureConnection', (tlsSocket) => {
            let servername = tlsSocket.servername;
            let alpn = tlsSocket.alpnProtocol;
            tlsSocket.on('error', (err) => {
                console.error(`http1TlsServer tlsSocket error sni=[${servername}] alpn=[${alpn}]`, err);
            });
            let options = {
                ca: this.params.CACerts,
                host: http2ListenAddr.host,
                port: http2ListenAddr.port,
                ALPNProtocols: [],
            };
            if (typeof servername === 'string')
                options.servername = servername;
            if (typeof alpn === 'string')
                options.ALPNProtocols.push(alpn);
            let h1CompatH2TlsSocket = tls.connect(options, () => {
                if (parameters.params.VERBOSE)
                    console.log(`sni=[${servername}] alpn=[${alpn}] piped to h1-compatible h2 local server`);
                tlsSocket.pipe(h1CompatH2TlsSocket);
                h1CompatH2TlsSocket.pipe(tlsSocket);
            }).on('error', (err) => {
                console.error(`http1TlsServer h1CompatH2TlsSocket error sni=[${servername}] alpn=[${alpn}]`, err);
            });
        });
        const http1ListenAddr = params.listenList.localHttp1Server;
        http1TlsServer.listen(http1ListenAddr.port, http1ListenAddr.host);
        console.log(`localHttp1Server listening on [${http1ListenAddr.host}:${http1ListenAddr.port}]`);
        const hooks = [
            new save_access_key_hook_1.saveAccessKeyHook(params),
            new save_open_id_ticket_hook_1.saveOpenIdTicketHook(params),
        ];
        this.params = params;
        this.certGen = certGen;
        this.http2SecureServer = http2SecureServer;
        this.http1TlsServer = http1TlsServer;
        this.openSess = new Map();
        this.pendingSess = new Map();
        this.hooks = hooks;
    }
    async close() {
        this.openSess.forEach((val, key) => val.destroyed || val.destroy());
        this.openSess.clear();
        await Promise.allSettled([this.http2SecureServer, this.http1TlsServer].map((server) => {
            return new Promise((resolve) => {
                server.on('close', () => resolve());
                server.close();
            });
        }));
    }
    static async isHostSelfAsync(host, listenList) {
        if (typeof host !== 'string')
            host = await this.socketRemoteIPAsync(host);
        if (!net.isIPv6(host))
            host = host.replace(/:\d+$/, ""); //strip port number
        if (!net.isIP(host))
            host = await parameters.resolveToIP(host);
        if (["127.0.0.1", "::1",].find((ip) => ip === host))
            return true;
        for (let key in listenList) {
            let listenAddr = listenList[key];
            if (listenAddr.host === host)
                return true;
        }
        return false;
    }
    static socketRemoteIPAsync(socket) {
        return new Promise((resolve, reject) => {
            let lookupListener = (err, address, family, host) => {
                socket.off('lookup', lookupListener);
                if (err != null)
                    reject(err);
                else
                    resolve(address);
            };
            if (socket.remoteAddress != null)
                resolve(socket.remoteAddress);
            else
                socket.on('lookup', lookupListener);
        });
    }
    getH2SessionAsync(authorityURL, alpn, sni) {
        let promise = this.pendingSess.get(authorityURL.href);
        if (promise == null) {
            promise = new Promise((resolve, reject) => {
                this.getH2SessionAsyncPromise(authorityURL, alpn, sni).then((sess) => {
                    this.openSess.set(authorityURL.href, sess);
                    this.pendingSess.delete(authorityURL.href);
                    resolve(sess);
                }).catch((e) => {
                    this.pendingSess.delete(authorityURL.href);
                    reject(e);
                });
            });
            this.pendingSess.set(authorityURL.href, promise);
        }
        return promise;
    }
    async getH2SessionAsyncPromise(authorityURL, alpn, sni) {
        let sess = this.openSess.get(authorityURL.href);
        if (sess != null) {
            if (!sess.closed && !sess.destroyed) {
                return sess;
            }
            else
                this.openSess.delete(authorityURL.href);
        }
        const host = authorityURL.hostname;
        const port = isNaN(parseInt(authorityURL.port)) ? 443 : parseInt(authorityURL.port);
        let socket;
        if (this.params.upstreamProxyEnabled) {
            if (await localServer.isHostSelfAsync(host, this.params.listenList))
                throw new Error(constants.IS_SELF_IP);
            socket = await localServer.httpTunnelAsync(host, port, this.params.upstreamProxy);
        }
        else {
            socket = await localServer.directConnectAsync(host, port);
            if (await localServer.isHostSelfAsync(socket, this.params.listenList))
                throw new Error(constants.IS_SELF_IP);
        }
        sess = await this.createClientH2SessionAsync(socket, authorityURL, alpn, sni);
        sess.on('close', () => {
            this.openSess.delete(authorityURL.href);
        });
        let errorListener = ((sess) => {
            let func = (err) => {
                console.error(`error in http2 session authority=[${authorityURL}]`, err);
                this.openSess.delete(authorityURL.href);
                sess.close();
            };
            return func;
        })(sess);
        sess.on('error', errorListener);
        let timeoutListener = ((sess) => {
            let func = () => {
                this.openSess.delete(authorityURL.href);
                sess.close();
            };
            return func;
        })(sess);
        sess.on('timeout', timeoutListener);
        let goawayListener = ((sess) => {
            let func = (errorCode, lastStreamID, opaqueData) => {
                this.openSess.delete(authorityURL.href);
                sess.close();
            };
            return func;
        })(sess);
        sess.on('goaway', goawayListener);
        this.openSess.set(authorityURL.href, sess);
        return sess;
    }
    static async getTlsSocketAsync(params, rejectUnauthorized, authorityURL, alpn, sni) {
        let tlsSocket;
        const host = authorityURL.hostname;
        const port = isNaN(parseInt(authorityURL.port)) ? 443 : parseInt(authorityURL.port);
        let socket;
        if (params.upstreamProxyEnabled) {
            if (await this.isHostSelfAsync(host, params.listenList))
                throw new Error(constants.IS_SELF_IP);
            socket = await this.httpTunnelAsync(host, port, params.upstreamProxy);
        }
        else {
            socket = await this.directConnectAsync(host, port);
            if (await this.isHostSelfAsync(socket, params.listenList))
                throw new Error(constants.IS_SELF_IP);
        }
        let CACerts = rejectUnauthorized ? params.CACerts : null;
        tlsSocket = await this.createTlsSocketAsync(socket, CACerts, authorityURL, alpn, sni);
        return tlsSocket;
    }
    static httpTunnelAsync(host, port, upstreamProxy) {
        return new Promise((resolve, reject) => {
            const proxyHost = upstreamProxy.host;
            const proxyPort = upstreamProxy.port;
            let errorListener = (err) => reject(err);
            let req = http
                .request({
                host: proxyHost,
                port: proxyPort,
                method: "CONNECT",
                path: `${host}:${port}`,
                headers: {
                    ["Host"]: `${host}:${port}`,
                }
            })
                .on('connect', (response, socket, head) => {
                req.off('error', errorListener);
                resolve(socket);
            })
                .on('error', errorListener)
                .end();
        });
    }
    static directConnectAsync(host, port) {
        return new Promise((resolve, reject) => {
            let errorListener = (err) => reject(err);
            let socket = net.createConnection(port, host)
                .on('error', errorListener)
                .on('connect', () => {
                socket.off('error', errorListener);
                resolve(socket);
            });
        });
    }
    static createTlsSocketAsync(socket, CACerts, authorityURL, alpn, sni) {
        return new Promise((resolve, reject) => {
            let errorListener = (err) => {
                reject(err);
            };
            let host = authorityURL.hostname;
            let port = parseInt(authorityURL.port);
            if (isNaN(port))
                port = 443;
            let options = {
                socket: socket,
                host: host,
                port: port,
                ALPNProtocols: ["http/1.1"],
            };
            if (CACerts == null)
                options.rejectUnauthorized = false;
            else
                options.ca = CACerts;
            if (typeof alpn === 'string') {
                let array = options.ALPNProtocols;
                if (!array.find((existing) => existing === alpn))
                    array.push(alpn);
            }
            if (typeof sni === 'string' && !net.isIP(sni))
                options.servername = sni; //mute warning about RFC6066 disallowing IP SNI
            if (parameters.params.VERBOSE)
                console.log(`creating tlsSocket [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
            let tlsSocket = tls.connect(options, () => {
                let actualAlpn = tlsSocket.alpnProtocol;
                if (parameters.params.VERBOSE)
                    console.log(`tlsSocket [${host}:${port}]`
                        + ` alpn=[${actualAlpn}]${alpn === actualAlpn ? "" : "(requested=[" + alpn + "])"}`
                        + ` sni=[${sni}] created`);
                tlsSocket.off('error', errorListener);
                resolve(tlsSocket);
            });
            tlsSocket.on('error', errorListener);
            return tlsSocket;
        });
    }
    createClientH2SessionAsync(socket, authorityURL, alpn, sni) {
        return new Promise((resolve, reject) => {
            let errorListener = (err) => {
                reject(err);
            };
            let session = http2.connect(authorityURL, {
                createConnection: (authorityURL, option) => {
                    let host = authorityURL.hostname;
                    let port = parseInt(authorityURL.port);
                    if (isNaN(port))
                        port = 443;
                    let options = {
                        ca: this.params.CACerts,
                        socket: socket,
                        host: host,
                        port: port,
                        ALPNProtocols: [],
                    };
                    if (typeof alpn === 'string') {
                        let array = options.ALPNProtocols;
                        if (!array.find((existing) => existing === alpn))
                            array.push(alpn);
                    }
                    if (typeof sni === 'string' && !net.isIP(sni))
                        options.servername = sni; //mute warning about RFC6066 disallowing IP SNI
                    if (parameters.params.VERBOSE)
                        console.log(`creating http2 session [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
                    let tlsSocket = tls.connect(options, () => {
                        let actualAlpn = tlsSocket.alpnProtocol;
                        if (parameters.params.VERBOSE)
                            console.log(`http2 session [${host}:${port}]`
                                + ` alpn=[${actualAlpn}]${alpn === actualAlpn ? "" : "(requested=[" + alpn + "])"}`
                                + ` sni=[${sni}] created`);
                        session.off('error', errorListener);
                        tlsSocket.off('error', errorListener);
                        if (actualAlpn === alpn) {
                            resolve(session);
                        }
                        else {
                            session.destroy();
                            reject(new Error(constants.DOWNGRADE_TO_HTTP1));
                        }
                    });
                    tlsSocket.on('error', errorListener); //reject() does not catch exception as expected
                    return tlsSocket;
                },
            }).on('error', errorListener); //must do reject() here to avoid uncaught exception crash
        });
    }
    http2RequestAsync(url, reqHeaders, reqBody) {
        return new Promise((resolve, reject) => {
            let tlsSocket = tls.connect({
                ca: this.params.CACerts,
                host: this.params.listenList.localServer.host,
                port: this.params.listenList.localServer.port,
                servername: url.hostname,
                ALPNProtocols: ["h2"],
            });
            tlsSocket.on('error', (err) => reject(err));
            tlsSocket.on('secureConnect', () => {
                const authority = `https://${url.hostname}/`;
                let session = http2.connect(authority, { createConnection: () => tlsSocket });
                session.on('error', (err) => reject(err));
                session.on('connect', (session) => {
                    let request = session.request(reqHeaders);
                    request.on('error', (err) => reject(err));
                    request.on('response', (headers, flags) => {
                        let respHeaders = headers;
                        let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr;
                        request.on('data', (chunk) => { respBodyBuf = Buffer.concat([respBodyBuf, chunk]); });
                        request.on('end', () => {
                            try {
                                const encoding = respHeaders["content-encoding"];
                                respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                                const charset = parse_charset_1.parseCharset.get(respHeaders);
                                respBodyStr = respBodyBuf.toString(charset);
                            }
                            catch (e) { // not rejecting
                                console.error(`http2RequestAsync authority=[${authority}] decompressing or decoding respBodyBuf to string error`, e);
                            }
                            let respBody = respBodyStr != null ? respBodyStr : respBodyBuf;
                            resolve({ headers: respHeaders, respBody: respBody });
                        });
                    });
                    if (typeof reqBody === 'string')
                        request.end(Buffer.from(reqBody, 'utf-8'));
                    else if (reqBody instanceof Buffer)
                        request.end(reqBody);
                    else
                        request.end();
                });
            });
        });
    }
    static compress(data, encoding) {
        if (encoding == null)
            return data = Buffer.concat([data]);
        let compressed;
        switch (encoding) {
            case 'gzip':
                compressed = zlib.gzipSync(data);
                break;
            case 'deflate':
                compressed = zlib.deflateSync(data);
                break;
            case 'br':
                compressed = zlib.brotliCompressSync(data, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
                        [zlib.constants.BROTLI_PARAM_QUALITY]: 8,
                        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.byteLength,
                    },
                });
                break;
            default:
                throw new Error(`unknown compress encoding=${encoding}`);
        }
        return compressed;
    }
    static decompress(data, encoding) {
        if (encoding == null)
            return data = Buffer.concat([data]);
        let decompressed;
        switch (encoding) {
            case 'gzip':
                decompressed = zlib.gunzipSync(data);
                break;
            case 'deflate':
                decompressed = zlib.inflateSync(data);
                break;
            case 'br':
                decompressed = zlib.brotliDecompressSync(data);
                break;
            default:
                throw new Error(`unknown compress encoding=${encoding}`);
        }
        return decompressed;
    }
}
exports.localServer = localServer;
