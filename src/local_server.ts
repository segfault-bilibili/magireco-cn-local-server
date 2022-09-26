import * as net from "net";
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as zlib from "zlib";
import * as parameters from "./parameters";
import * as certGenerator from "./cert_generator";
import { URL } from "url";
import { parseCharset } from "./parse_charset";
import { saveAccessKeyHook } from "./hooks/save_access_key_hook";
import { saveOpenIdTicketHook } from "./hooks/save_open_id_ticket_hook";

export enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
    IS_SELF_IP = "IS_SELF_IP",
}

export interface hook {
    // if matched, keep a copy of request/response data in memory
    matchRequest: (
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ) => boolean;

    onMatchedRequest: (
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
        body?: string | Buffer
    ) => void;

    onMatchedResponse: (
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: string | Buffer
    ) => void;
}

export class localServer {
    private readonly params: parameters.params;
    private readonly http2SecureServer: http2.Http2SecureServer;
    private readonly http1TlsServer: tls.Server;
    private readonly certGen: certGenerator.certGen;
    private readonly openSess: Map<string, http2.ClientHttp2Session>;
    private readonly pendingSess: Map<string, Promise<http2.ClientHttp2Session>>;
    private readonly hooks: Array<hook>;

    constructor(params: parameters.params) {
        const certGen = new certGenerator.certGen(params.CACertAndKey);

        const SNICallback = (servername: string, cb: (err: Error | null, ctx?: tls.SecureContext | undefined) => void) => {
            let certAndKey = this.certGen.getCertAndKey(servername);
            let ctx = tls.createSecureContext(certAndKey);
            cb(null, ctx);
        }

        const http2ServerOptions: http2.SecureServerOptions = certGen.getCertAndKey(params.listenList.localServer.host);
        http2ServerOptions.SNICallback = SNICallback;
        http2ServerOptions.allowHTTP1 = true;
        const http2SecureServer = http2.createSecureServer(http2ServerOptions, async (cliReq, cliRes) => {
            if (cliReq.httpVersionMajor !== 1) return;//handled in stream event

            const reqHeaders = cliReq.headers;
            const host = reqHeaders.host;
            const alpn = (cliReq.socket as tls.TLSSocket).alpnProtocol;
            const sni = (cliReq.socket as any).servername;

            cliReq.on('error', (err) => {
                console.error(`request error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
            });

            if (host == null) {
                try {
                    cliRes.writeHead(403, { ["Content-Type"]: "text/plain" });
                    cliRes.end("403 Forbidden");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
                return;
            }

            if (parameters.params.DEBUG) console.log(`request accepted, host=[${host}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                // hook
                const method = cliReq.method;
                const url = new URL(cliReq.url, `https://${host}/`);
                const reqHttpVer = cliReq.httpVersion;
                let reqBodyBuf = Buffer.from(new ArrayBuffer(0)), reqBodyStr: string | undefined;

                const matchedHooks = this.hooks.filter((item) => item.matchRequest(method, url, reqHttpVer, reqHeaders));

                let statusCode: number | undefined;
                let statusMessage: string | undefined;
                let respHttpVer: string | undefined;
                let respHeaders: http2.IncomingHttpHeaders;
                let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr: string | undefined;

                let socket: net.Socket | tls.TLSSocket;
                if (host.match(/^(|www\.)magireco\.local(|:\d{1,5})$/)) {
                    let controlInterfaceHost = this.params.listenList.controlInterface.host;
                    let controlInterfacePort = this.params.listenList.controlInterface.port;
                    socket = await localServer.directConnectAsync(controlInterfaceHost, controlInterfacePort);
                } else {
                    socket = await localServer.getTlsSocketAsync(this.params, true, new URL(`https://${host}/`), alpn, sni);
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
                    } catch (e) {
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
                        } else {
                            if (statusMessage == null) cliRes.writeHead(statusCode, respHeaders);
                            else cliRes.writeHead(statusCode, statusMessage, respHeaders);
                            svrRes.on('data', (chunk) => {
                                // hook
                                if (matchedHooks.length > 0) respBodyBuf = Buffer.concat([respBodyBuf, chunk as Buffer]);

                                try {
                                    cliRes.write(chunk);
                                } catch (e) {
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
                                        const charset = parseCharset.get(respHeaders);
                                        respBodyStr = respBodyBuf.toString(charset);
                                    } catch (e) {
                                        console.error(`http1 hook host=[${host}] decompressing or decoding respBodyBuf to string error`, e);
                                    }
                                    const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                                    matchedHooks.forEach((item) =>
                                        item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                                }

                                if (parameters.params.DEBUG) console.log(`ending cliRes downlink: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                                try {
                                    cliRes.end();
                                } catch (e) {
                                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                    console.error(`http1 host=[${host}] cliRes.end() error`, e);
                                }
                            });
                        }
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrRes.writeHead() error`, e);
                    }
                });
                svrReq.on('end', () => {
                    if (parameters.params.DEBUG) console.log(`ending cliRes downlink: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                    try {
                        cliRes.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] cliRes.end() error`, e);
                    }
                });
                svrReq.on('error', (err) => {
                    console.error(`svrReq error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                    try {
                        cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                        cliRes.end("502 Bad Gateway");
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                    }
                });

                cliReq.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) reqBodyBuf = Buffer.concat([reqBodyBuf, chunk as Buffer]);

                    try {
                        svrReq.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrReq.write() error`, e);
                    }
                });
                cliReq.on('end', () => {
                    if (parameters.params.DEBUG) console.log(`cliReq uplink ended: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http1 hook host=[${host}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedRequest(method, url, reqHttpVer, reqHeaders, body));
                    }

                    try {
                        svrReq.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrReq.end() error`, e);
                    }
                });
            } catch (e) {
                try {
                    if (e instanceof Error) switch (e.message) {
                        case constants.IS_SELF_IP:
                            cliRes.writeHead(200, { ["Content-Type"]: 'text/plain' });
                            cliRes.end('Magireco Local Server');
                            return;
                    }
                    console.error("cannot create http1 tlsSocket", e);
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${host}] cliRes.writeHead() error`, e);
                }
                return;
            };
        });

        http2SecureServer.on('stream', async (cliReqStream, reqHeaders, flags) => {
            const authority = reqHeaders[":authority"];
            const authorityURL = new URL(`https://${authority}/`);
            const alpn = cliReqStream.session.alpnProtocol;
            const sni = (cliReqStream.session.socket as any).servername;

            cliReqStream.on('error', (err) => {
                if (parameters.params.DEBUG) console.log(`cliReqStream error: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    cliReqStream.end("502 Bad Gateway");
                } catch (e) {
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
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                }
                return;
            }

            if (parameters.params.DEBUG) console.log(`http2 cliReqStream accepted, authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                // hook
                const method = reqHeaders[":method"];
                const url = reqHeaders[":path"] == null ? undefined : new URL(reqHeaders[":path"], `https://${authority}/`);
                const reqHttpVer = "2.0"; //FIXME
                let reqBodyBuf = Buffer.from(new ArrayBuffer(0)), reqBodyStr: string | undefined;

                const matchedHooks = this.hooks.filter((item) => item.matchRequest(method, url, reqHttpVer, reqHeaders));

                let statusCode: number | undefined;
                let statusMessage: string | undefined;
                const respHttpVer = "2.0";
                let respHeaders: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
                let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr: string | undefined;

                let sess = await this.getH2SessionAsync(authorityURL, alpn, sni);
                let svrReq = sess.request(reqHeaders);
                svrReq.on('continue', () => {
                    try {
                        cliReqStream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_CONTINUE,
                        });
                    } catch (e) {
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
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                    }
                });
                svrReq.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) respBodyBuf = Buffer.concat([respBodyBuf, chunk as Buffer]);

                    try {
                        cliReqStream.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.write() error`, e);
                    }
                });
                svrReq.on('end', () => {
                    if (parameters.params.DEBUG) console.log(`ending cliReqStream downlink: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = respHeaders["content-encoding"];
                            respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                            const charset = parseCharset.get(respHeaders);
                            respBodyStr = respBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http2 hook authority=[${authority}] decompressing or decoding respBodyBuf to string error`, e);
                        }
                        const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                    }

                    try {
                        cliReqStream.end();
                    } catch (e) {
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
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                    }
                });

                cliReqStream.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) reqBodyBuf = Buffer.concat([reqBodyBuf, chunk as Buffer]);

                    try {
                        svrReq.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] svrReq.write() error`, e);
                    }
                });
                cliReqStream.on('end', () => {
                    if (parameters.params.DEBUG) console.log(`cliReqStream uplink ended: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http2 hook authority=[${authority}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedRequest(method, url, reqHttpVer, reqHeaders, body));
                    }

                    try {
                        svrReq.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${authority}] svrReq.end() error`, e);
                    }
                });
            } catch (e) {
                if (e instanceof Error) switch (e.message) {
                    case constants.IS_SELF_IP:
                        try {
                            cliReqStream.respond({
                                [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_OK,
                                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                            });
                            cliReqStream.end('Magireco Local Server');
                        } catch (e) {
                            //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                            console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                        }
                        return;
                    case constants.DOWNGRADE_TO_HTTP1:
                        //FIXME
                        this.params.setSupportH2(authorityURL, false);//FIXME not working when IP addr used in HTTP CONNECT
                        if (parameters.params.DEBUG) console.log(`marked [${authorityURL}] supportHTTP2=false`);
                        if (parameters.params.DEBUG) console.log("sending status code 505 and goaway");
                        try {
                            cliReqStream.respond({
                                [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
                                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                            });
                            cliReqStream.end("505 HTTP Version Not Supported");
                            cliReqStream.session.goaway(http2.constants.NGHTTP2_HTTP_1_1_REQUIRED);
                        } catch (e) {
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
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${authority}] cliReqStream.respond() error`, e);
                }
            };
        });

        const http2ListenAddr = params.listenList.localServer;
        http2SecureServer.listen(http2ListenAddr.port, http2ListenAddr.host);
        console.log(`localServer listening on [${http2ListenAddr.host}:${http2ListenAddr.port}]`);
        if (params.upstreamProxyEnabled) {
            let proxy = params.upstreamProxy;
            console.log(`localServer upstream proxy enabled [${proxy.host}:${proxy.port}]`
                + ` cacert [${params.upstreamProxyCACert != null}]`);
        } else {
            console.log(`localServer upstream proxy disabled`);
        }

        const http1TlsServerOptions: tls.TlsOptions = certGen.getCertAndKey(params.listenList.localHttp1Server.host);
        http1TlsServerOptions.SNICallback = SNICallback;
        http1TlsServerOptions.ALPNProtocols = ["http/1.1"];
        const http1TlsServer = tls.createServer(http1TlsServerOptions);

        http1TlsServer.on('secureConnection', (tlsSocket) => {
            let servername: string | undefined = (tlsSocket as any).servername;
            let alpn = tlsSocket.alpnProtocol;
            tlsSocket.on('error', (err) => {
                console.error(`http1TlsServer tlsSocket error sni=[${servername}] alpn=[${alpn}]`, err);
            });
            let options: tls.ConnectionOptions = {
                ca: this.params.CACerts,
                host: http2ListenAddr.host,
                port: http2ListenAddr.port,
                ALPNProtocols: [],
            }
            if (typeof servername === 'string') options.servername = servername;
            if (typeof alpn === 'string') (options.ALPNProtocols as Array<string>).push(alpn);
            let h1CompatH2TlsSocket = tls.connect(options, () => {
                if (parameters.params.DEBUG) console.log(`sni=[${servername}] alpn=[${alpn}] piped to h1-compatible h2 local server`);
                tlsSocket.pipe(h1CompatH2TlsSocket);
                h1CompatH2TlsSocket.pipe(tlsSocket);
            }).on('error', (err) => {
                console.error(`http1TlsServer h1CompatH2TlsSocket error sni=[${servername}] alpn=[${alpn}]`, err);
            })
        });

        const http1ListenAddr = params.listenList.localHttp1Server;
        http1TlsServer.listen(http1ListenAddr.port, http1ListenAddr.host);
        console.log(`localHttp1Server listening on [${http1ListenAddr.host}:${http1ListenAddr.port}]`);

        const hooks = [
            new saveAccessKeyHook(params),
            new saveOpenIdTicketHook(params),
        ]

        this.params = params;
        this.certGen = certGen;
        this.http2SecureServer = http2SecureServer;
        this.http1TlsServer = http1TlsServer;
        this.openSess = new Map<string, http2.ClientHttp2Session>();
        this.pendingSess = new Map<string, Promise<http2.ClientHttp2Session>>();
        this.hooks = hooks;
    }
    async close(): Promise<void> {
        this.openSess.forEach((val, key) => val.destroyed || val.destroy());
        this.openSess.clear();
        await Promise.allSettled([this.http2SecureServer, this.http1TlsServer].map((server) => {
            return new Promise<void>((resolve) => {
                server.on('close', () => resolve());
                server.close();
            })
        }));
    }

    private static async isHostSelfAsync(host: string | net.Socket, listenList: parameters.listenList): Promise<boolean> {
        if (typeof host !== 'string') host = await this.socketRemoteIPAsync(host);
        if (!net.isIPv6(host)) host = host.replace(/:\d+$/, "");//strip port number
        if (!net.isIP(host)) host = await parameters.resolveToIP(host);
        if (["127.0.0.1", "::1",].find((ip) => ip === host)) return true;
        for (let key in listenList) {
            let listenAddr = listenList[key];
            if (listenAddr.host === host) return true;
        }
        return false;
    }

    private static socketRemoteIPAsync(socket: net.Socket): Promise<string> {
        return new Promise((resolve, reject) => {
            let lookupListener: (err: Error, address: string, family: string | number, host: string) => void
                = (err, address, family, host) => {
                    socket.off('lookup', lookupListener);
                    if (err != null) reject(err);
                    else resolve(address);
                }
            if (socket.remoteAddress != null) resolve(socket.remoteAddress);
            else socket.on('lookup', lookupListener);
        });
    }

    getH2SessionAsync(authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean
    ): Promise<http2.ClientHttp2Session> {
        let promise = this.pendingSess.get(authorityURL.href);
        if (promise == null) {
            promise = new Promise<http2.ClientHttp2Session>((resolve, reject) => {
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
    private async getH2SessionAsyncPromise(authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean
    ): Promise<http2.ClientHttp2Session> {
        let sess = this.openSess.get(authorityURL.href);
        if (sess != null) {
            if (!sess.closed && !sess.destroyed) {
                return sess;
            } else this.openSess.delete(authorityURL.href);
        }

        const host = authorityURL.hostname;
        const port = isNaN(parseInt(authorityURL.port)) ? 443 : parseInt(authorityURL.port);
        let socket: net.Socket;
        if (this.params.upstreamProxyEnabled) {
            if (await localServer.isHostSelfAsync(host, this.params.listenList)) throw new Error(constants.IS_SELF_IP);
            socket = await localServer.httpTunnelAsync(host, port, this.params.upstreamProxy);
        } else {
            socket = await localServer.directConnectAsync(host, port);
            if (await localServer.isHostSelfAsync(socket, this.params.listenList)) throw new Error(constants.IS_SELF_IP);
        }

        sess = await this.createClientH2SessionAsync(socket, authorityURL, alpn, sni);

        sess.on('close', () => {
            this.openSess.delete(authorityURL.href);
        });

        let errorListener = ((sess) => {
            let func = (err: any) => {
                console.error(`error in http2 session authority=[${authorityURL}]`, err);
                this.openSess.delete(authorityURL.href);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('error', errorListener);

        let timeoutListener = ((sess) => {
            let func = () => {
                this.openSess.delete(authorityURL.href);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('timeout', timeoutListener);

        let goawayListener = ((sess) => {
            let func = (errorCode: any, lastStreamID: any, opaqueData: any) => {
                this.openSess.delete(authorityURL.href);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('goaway', goawayListener);

        this.openSess.set(authorityURL.href, sess);

        return sess;
    }

    static async getTlsSocketAsync(params: parameters.params, rejectUnauthorized: boolean,
        authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean
    ): Promise<tls.TLSSocket> {
        let tlsSocket: tls.TLSSocket;
        const host = authorityURL.hostname;
        const port = isNaN(parseInt(authorityURL.port)) ? 443 : parseInt(authorityURL.port);
        let socket: net.Socket;
        if (params.upstreamProxyEnabled) {
            if (await this.isHostSelfAsync(host, params.listenList)) throw new Error(constants.IS_SELF_IP);
            socket = await this.httpTunnelAsync(host, port, params.upstreamProxy);
        } else {
            socket = await this.directConnectAsync(host, port);
            if (await this.isHostSelfAsync(socket, params.listenList)) throw new Error(constants.IS_SELF_IP);
        }
        let CACerts = rejectUnauthorized ? params.CACerts : null;
        tlsSocket = await this.createTlsSocketAsync(socket, CACerts, authorityURL, alpn, sni);
        return tlsSocket;
    }

    private static httpTunnelAsync(host: string, port: number, upstreamProxy: parameters.listenAddr): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const proxyHost = upstreamProxy.host;
            const proxyPort = upstreamProxy.port;
            let errorListener: (err: Error) => void = (err) => reject(err);
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

    private static directConnectAsync(host: string, port: number): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            let errorListener: (err: Error) => void = (err) => reject(err);
            let socket = net.createConnection(port, host)
                .on('error', errorListener)
                .on('connect', () => {
                    socket.off('error', errorListener);
                    resolve(socket);
                });
        });
    }

    private static createTlsSocketAsync(socket: net.Socket, CACerts: Array<string> | null,
        authorityURL: URL, alpn?: string | boolean | null, sni?: string | boolean | null
    ): Promise<tls.TLSSocket> {
        return new Promise((resolve, reject) => {
            let errorListener = (err: Error) => {
                reject(err);
            }
            let host = authorityURL.hostname;
            let port = parseInt(authorityURL.port);
            if (isNaN(port)) port = 443;
            let options: tls.ConnectionOptions = {
                socket: socket,
                host: host,
                port: port,
                ALPNProtocols: ["http/1.1"],
            }
            if (CACerts == null) options.rejectUnauthorized = false;
            else options.ca = CACerts;
            if (typeof alpn === 'string') {
                let array = (options.ALPNProtocols as Array<string>);
                if (!array.find((existing) => existing === alpn)) array.push(alpn);
            }
            if (typeof sni === 'string' && !net.isIP(sni)) options.servername = sni;//mute warning about RFC6066 disallowing IP SNI
            if (parameters.params.DEBUG) console.log(`creating tlsSocket [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
            let tlsSocket = tls.connect(options, () => {
                let actualAlpn = tlsSocket.alpnProtocol;
                if (parameters.params.DEBUG) console.log(`tlsSocket [${host}:${port}]`
                    + ` alpn=[${actualAlpn}]${alpn === actualAlpn ? "" : "(requested=[" + alpn + "])"}`
                    + ` sni=[${sni}] created`);

                tlsSocket.off('error', errorListener);

                resolve(tlsSocket);
            });
            tlsSocket.on('error', errorListener);
            return tlsSocket;
        });
    }

    private createClientH2SessionAsync(socket: net.Socket,
        authorityURL: URL, alpn?: string | boolean | null, sni?: string | boolean | null
    ): Promise<http2.ClientHttp2Session> {
        return new Promise((resolve, reject) => {
            let errorListener: (err: Error) => void = (err) => {
                reject(err);
            }
            let session = http2.connect(authorityURL, {
                createConnection: (authorityURL: URL, option: http2.SessionOptions) => {
                    let host = authorityURL.hostname;
                    let port = parseInt(authorityURL.port);
                    if (isNaN(port)) port = 443;
                    let options: tls.ConnectionOptions = {
                        ca: this.params.CACerts,
                        socket: socket,
                        host: host,
                        port: port,
                        ALPNProtocols: [],
                    }
                    if (typeof alpn === 'string') {
                        let array = (options.ALPNProtocols as Array<string>);
                        if (!array.find((existing) => existing === alpn)) array.push(alpn);
                    }
                    if (typeof sni === 'string' && !net.isIP(sni)) options.servername = sni;//mute warning about RFC6066 disallowing IP SNI
                    if (parameters.params.DEBUG) console.log(`creating http2 session [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
                    let tlsSocket = tls.connect(options, () => {
                        let actualAlpn = tlsSocket.alpnProtocol;
                        if (parameters.params.DEBUG) console.log(`http2 session [${host}:${port}]`
                            + ` alpn=[${actualAlpn}]${alpn === actualAlpn ? "" : "(requested=[" + alpn + "])"}`
                            + ` sni=[${sni}] created`);

                        session.off('error', errorListener);
                        tlsSocket.off('error', errorListener);

                        if (actualAlpn === alpn) {
                            resolve(session);
                        } else {
                            session.destroy();
                            reject(new Error(constants.DOWNGRADE_TO_HTTP1));
                        }
                    });
                    tlsSocket.on('error', errorListener);//reject() does not catch exception as expected
                    return tlsSocket;
                },
            }).on('error', errorListener);//must do reject() here to avoid uncaught exception crash
        });
    }

    http2RequestAsync(url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody?: string | Buffer
    ): Promise<{ headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader, respBody: string | Buffer }> {
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
                        let respBodyBuf = Buffer.from(new ArrayBuffer(0)), respBodyStr: string | undefined;
                        request.on('data', (chunk) => { respBodyBuf = Buffer.concat([respBodyBuf, chunk as Buffer]); });
                        request.on('end', () => {
                            try {
                                const encoding = respHeaders["content-encoding"];
                                respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                                const charset = parseCharset.get(respHeaders);
                                respBodyStr = respBodyBuf.toString(charset);
                            } catch (e) { // not rejecting
                                console.error(`http2RequestAsync authority=[${authority}] decompressing or decoding respBodyBuf to string error`, e);
                            }
                            let respBody = respBodyStr != null ? respBodyStr : respBodyBuf;
                            resolve({ headers: respHeaders, respBody: respBody });
                        });
                    });
                    if (typeof reqBody === 'string') request.end(Buffer.from(reqBody, 'utf-8'));
                    else if (reqBody instanceof Buffer) request.end(reqBody);
                    else request.end();
                });
            });
        });
    }

    static decompress(data: Buffer, encoding?: string): Buffer {
        if (encoding == null) return data = Buffer.concat([data]);
        let decompressed: Buffer;
        switch (encoding) {
            case 'gzip':
                decompressed = zlib.gunzipSync(data);
                break;
            case 'deflate':
                decompressed = zlib.inflateSync(data);
                break;
            default:
                throw new Error(`unknown compress encoding=${encoding}`);
        }
        return decompressed;
    }
}