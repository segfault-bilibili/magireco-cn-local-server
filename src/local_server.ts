import * as net from "net";
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as zlib from "zlib";
import * as parameters from "./parameters";
import * as certGenerator from "./cert_generator";
import { URL } from "url";
import { parseCharset } from "./parse_charset";

export enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
    IS_SELF_IP = "IS_SELF_IP",
}

interface hookNextAction {
    nextAction: string,
    interceptResponse: boolean,
}
export interface fakeResponse extends hookNextAction {
    nextAction: "fakeResponse",
    fakeResponse: {
        statusCode: number,
        statusMessage: string,
        headers: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: string | Buffer
    },
}
export interface passOnRequest extends hookNextAction {
    nextAction: "passOnRequest",
    replaceRequest?: {
        host?: string;
        method?: string,
        path?: string,
    },
}
export interface passOnRequestBody extends hookNextAction {
    nextAction: "passOnRequestBody",
}

export interface hook {
    // if matched, keep a copy of request/response data in memory
    matchRequest: (
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ) => fakeResponse | passOnRequest;

    onMatchedRequest: (
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
        body?: string | Buffer
    ) => fakeResponse | passOnRequestBody;

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
            const alpn = (cliReq.socket as tls.TLSSocket).alpnProtocol;
            const sni = (cliReq.socket as any).servername;

            cliReq.on('error', (err) => {
                console.error(`request error: host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${reqHeaders.host}] cliRes.writeHead() error`, e);
                }
            });

            if (reqHeaders.host == null) {
                try {
                    cliRes.writeHead(403, { ["Content-Type"]: "text/plain" });
                    cliRes.end("403 Forbidden");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http1 host=[${reqHeaders.host}] cliRes.writeHead() error`, e);
                }
                return;
            }

            if (parameters.params.VERBOSE) console.log(`request accepted, host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                // hook
                let modifiedMethod = cliReq.method;
                const reqHttpVer = cliReq.httpVersion;
                let fakedResponse = false;
                const reqBodyBufArray: Array<Buffer> = [];

                let matchedHooks = this.hooks.filter((item): boolean => {
                    if (fakedResponse) return false;
                    let nextAction = item.matchRequest(modifiedMethod, new URL(cliReq.url, `https://${reqHeaders["host"]}`),
                        reqHttpVer, reqHeaders);
                    switch (nextAction.nextAction) {
                        case "fakeResponse":
                            fakedResponse = true;
                            const fakeResponse = nextAction.fakeResponse;
                            cliRes.writeHead(fakeResponse.statusCode, fakeResponse.statusMessage, reqHeaders);
                            if (fakeResponse.body != null) cliRes.end(fakeResponse.body);
                            else cliRes.end();
                            break;
                        case "passOnRequest":
                            const replaceRequest = nextAction.replaceRequest;
                            if (replaceRequest != null) {
                                if (replaceRequest.method != null) modifiedMethod = replaceRequest.method;
                                if (replaceRequest.host != null) {
                                    // replace host header since it's http1
                                    reqHeaders[":authority"] = reqHeaders["host"] = replaceRequest.host;
                                }
                                if (replaceRequest.path != null) cliReq.url = replaceRequest.path;
                            }
                            break;
                    }
                    return fakedResponse ? false : nextAction.interceptResponse;
                });
                if (this.checkOfflineMode(reqHeaders["host"])) {
                    if (matchedHooks.length == 0 && !fakedResponse) cliReq.destroy();
                }

                let statusCode: number | undefined;
                let statusMessage: string | undefined;
                let respHttpVer: string | undefined;
                let respHeaders: http2.IncomingHttpHeaders;
                const respBodyBufArray: Array<Buffer> = [];

                let svrReq: http.ClientRequest | undefined;
                if (!this.checkOfflineMode(reqHeaders["host"]) && !fakedResponse) {
                    let socket: net.Socket | tls.TLSSocket;
                    if (reqHeaders.host.match(/^(|www\.)magireco\.local(|:\d{1,5})$/)) {
                        let controlInterfaceHost = this.params.listenList.controlInterface.host;
                        let controlInterfacePort = this.params.listenList.controlInterface.port;
                        socket = await localServer.directConnectAsync(controlInterfaceHost, controlInterfacePort);
                    } else {
                        socket = await localServer.getTlsSocketAsync(this.params, true, new URL(`https://${reqHeaders.host}/`), alpn, sni);
                    }
                    svrReq = http.request({
                        method: modifiedMethod,
                        host: reqHeaders["host"],
                        path: cliReq.url,
                        createConnection: (options, onCreate) => {
                            return socket;
                        },
                        headers: reqHeaders,
                    });
                }
                svrReq?.on('continue', () => {
                    try {
                        cliRes.writeHead(100);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] cliRes.writeHead() error`, e);
                    }
                });
                svrReq?.on('response', (svrRes) => {
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
                                if (matchedHooks.length > 0) respBodyBufArray.push(chunk as Buffer);

                                try {
                                    cliRes.write(chunk);
                                } catch (e) {
                                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                    console.error(`http1 host=[${reqHeaders.host}] cliRes.write() error`, e);
                                }
                            });
                            svrRes.on('end', () => {
                                // hook
                                if (matchedHooks.length > 0) {
                                    let respBodyBuf = Buffer.concat(respBodyBufArray), respBodyStr: string | undefined;
                                    try {
                                        const encoding = respHeaders["content-encoding"];
                                        respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                                        const charset = parseCharset.get(respHeaders);
                                        respBodyStr = respBodyBuf.toString(charset);
                                    } catch (e) {
                                        console.error(`http1 hook host=[${reqHeaders.host}] decompressing or decoding respBodyBuf to string error`, e);
                                    }
                                    const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                                    matchedHooks.forEach((item) =>
                                        item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                                }

                                if (parameters.params.VERBOSE) console.log(`ending cliRes downlink: host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`);
                                try {
                                    cliRes.end();
                                } catch (e) {
                                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                                    console.error(`http1 host=[${reqHeaders.host}] cliRes.end() error`, e);
                                }
                            });
                        }
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] svrRes.writeHead() error`, e);
                    }
                });
                svrReq?.on('end', () => {
                    if (parameters.params.VERBOSE) console.log(`ending cliRes downlink: host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`);
                    try {
                        cliRes.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] cliRes.end() error`, e);
                    }
                });
                svrReq?.on('error', (err) => {
                    console.error(`svrReq error: host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`, err);
                    try {
                        cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                        cliRes.end("502 Bad Gateway");
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] cliRes.writeHead() error`, e);
                    }
                });

                cliReq.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) reqBodyBufArray.push(chunk as Buffer);

                    try {
                        svrReq?.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] svrReq.write() error`, e);
                    }
                });
                cliReq.on('end', () => {
                    if (parameters.params.VERBOSE) console.log(`cliReq uplink ended: host=[${reqHeaders.host}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        let reqBodyBuf = Buffer.concat(reqBodyBufArray), reqBodyStr: string | undefined;
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http1 hook host=[${reqHeaders.host}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks = matchedHooks.filter((item): boolean => {
                            if (fakedResponse) return false;
                            let nextAction = item.onMatchedRequest(modifiedMethod,
                                new URL(cliReq.url, `https://${reqHeaders["host"]}`),
                                reqHttpVer, reqHeaders, body);
                            switch (nextAction.nextAction) {
                                case "fakeResponse":
                                    fakedResponse = true;
                                    const fakeResponse = nextAction.fakeResponse;
                                    cliRes.writeHead(fakeResponse.statusCode, fakeResponse.statusMessage, fakeResponse.headers);
                                    if (fakeResponse.body != null) cliRes.end(fakeResponse.body);
                                    else cliRes.end();
                                    break;
                                case "passOnRequestBody":
                                    break;
                            }
                            return fakedResponse ? false : nextAction.interceptResponse;
                        });
                        if (this.checkOfflineMode(reqHeaders["host"])) {
                            if (matchedHooks.length == 0 && !fakedResponse) cliReq.destroy();
                        }
                    }

                    try {
                        svrReq?.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${reqHeaders.host}] svrReq.end() error`, e);
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
                    console.error(`http1 host=[${reqHeaders.host}] cliRes.writeHead() error`, e);
                }
                return;
            };
        });

        http2SecureServer.on('stream', async (cliReqStream, reqHeaders, flags) => {
            const alpn = cliReqStream.session.alpnProtocol;
            const sni = (cliReqStream.session.socket as any).servername;

            cliReqStream.on('error', (err) => {
                if (parameters.params.VERBOSE) console.log(`cliReqStream error: authority=[${reqHeaders[":authority"]}] alpn=[${alpn}] sni=[${sni}]`, err);
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    cliReqStream.end("502 Bad Gateway");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                }
            });

            if (reqHeaders[":authority"] == null) {
                try {
                    cliReqStream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: 403,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                    });
                    cliReqStream.end("403 Forbidden");
                } catch (e) {
                    //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                    console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                }
                return;
            }

            if (parameters.params.VERBOSE) console.log(`http2 cliReqStream accepted, authority=[${reqHeaders[":authority"]}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                // hook
                const reqHttpVer = "2.0"; //FIXME
                let fakedResponse = false;
                const reqBodyBufArray: Array<Buffer> = [];

                let matchedHooks = this.hooks.filter((item): boolean => {
                    if (fakedResponse) return false;
                    let nextAction = item.matchRequest(reqHeaders[":method"],
                        reqHeaders[":path"] == null ? undefined : new URL(reqHeaders[":path"], `https://${reqHeaders[":authority"]}/`),
                        reqHttpVer, reqHeaders);
                    switch (nextAction.nextAction) {
                        case "fakeResponse":
                            fakedResponse = true;
                            const fakeResponse = nextAction.fakeResponse;
                            fakeResponse.headers[":status"] = fakeResponse.statusCode;
                            // Status message is not supported by HTTP/2 (RFC 7540 8.1.2.4)
                            cliReqStream.respond(fakeResponse.headers);
                            if (fakeResponse.body != null) cliReqStream.end(fakeResponse.body);
                            else cliReqStream.end();
                            break;
                        case "passOnRequest":
                            const replaceRequest = nextAction.replaceRequest;
                            if (replaceRequest != null) {
                                if (replaceRequest.method != null) reqHeaders[":method"] = replaceRequest.method;
                                if (replaceRequest.host != null) {
                                    reqHeaders[":authority"] = replaceRequest.host;
                                    if (reqHeaders["host"] != null) {
                                        // in http2, if there's no host header, then there's no need to replace it
                                        reqHeaders["host"] = replaceRequest.host;
                                    }
                                }
                                if (replaceRequest.path != null) reqHeaders[":path"] = replaceRequest.path;
                            }
                            break;
                    }
                    return fakedResponse ? false : nextAction.interceptResponse;
                });
                if (this.checkOfflineMode(reqHeaders[":authority"])) {
                    if (matchedHooks.length == 0 && !fakedResponse) cliReqStream.destroy();
                }

                let statusCode: number | undefined;
                let statusMessage: string | undefined;
                const respHttpVer = "2.0";
                let respHeaders: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
                const respBodyBufArray: Array<Buffer> = [];

                const authorityURL = new URL(`https://${reqHeaders[":authority"]}`);
                let sess: http2.ClientHttp2Session | undefined, svrReq: http2.ClientHttp2Stream | undefined;
                if (!this.checkOfflineMode(reqHeaders[":authority"]) && !fakedResponse) {
                    sess = await this.getH2SessionAsync(authorityURL,
                        alpn, reqHeaders[":authority"] != null ? authorityURL.hostname : sni);
                    svrReq = sess.request(reqHeaders);
                }
                svrReq?.on('continue', () => {
                    try {
                        cliReqStream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_CONTINUE,
                        });
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                    }
                });
                svrReq?.on('response', (headers, flags) => {
                    // hook
                    respHeaders = headers;
                    statusCode = respHeaders[":status"];
                    statusMessage = undefined; // Status message is not supported by HTTP/2 (RFC 7540 8.1.2.4)
                    //respHttpVer = undefined;

                    try {
                        cliReqStream.respond(respHeaders);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                    }
                });
                svrReq?.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) respBodyBufArray.push(chunk as Buffer);

                    try {
                        cliReqStream.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.write() error`, e);
                    }
                });
                svrReq?.on('end', () => {
                    if (parameters.params.VERBOSE) console.log(`ending cliReqStream downlink: authority=[${reqHeaders[":authority"]}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        let respBodyBuf = Buffer.concat(respBodyBufArray), respBodyStr: string | undefined;
                        try {
                            const encoding = respHeaders["content-encoding"];
                            respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                            const charset = parseCharset.get(respHeaders);
                            respBodyStr = respBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http2 hook authority=[${reqHeaders[":authority"]}] decompressing or decoding respBodyBuf to string error`, e);
                        }
                        const body = respBodyStr != null ? respBodyStr : respBodyBuf;
                        matchedHooks.forEach((item) => item.onMatchedResponse(statusCode, statusMessage, respHttpVer, respHeaders, body));
                    }

                    try {
                        cliReqStream.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.end() error`, e);
                    }
                });
                svrReq?.on('error', (err) => {
                    console.error(`svrReq error: authority=[${reqHeaders[":authority"]}] alpn=[${alpn}] sni=[${sni}]`, err);
                    try {
                        cliReqStream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                        });
                        cliReqStream.end("502 Bad Gateway");
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                    }
                });

                cliReqStream.on('data', (chunk) => {
                    // hook
                    if (matchedHooks.length > 0) reqBodyBufArray.push(chunk as Buffer);

                    try {
                        svrReq?.write(chunk);
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] svrReq.write() error`, e);
                    }
                });
                cliReqStream.on('end', () => {
                    if (parameters.params.VERBOSE) console.log(`cliReqStream uplink ended: authority=[${reqHeaders[":authority"]}] alpn=[${alpn}] sni=[${sni}]`);

                    // hook
                    if (matchedHooks.length > 0) {
                        let reqBodyBuf = Buffer.concat(reqBodyBufArray), reqBodyStr: string | undefined;
                        try {
                            const encoding = reqHeaders["content-encoding"];
                            reqBodyBuf = localServer.decompress(reqBodyBuf, encoding);
                            const charset = parseCharset.get(reqHeaders);
                            reqBodyStr = reqBodyBuf.toString(charset);
                        } catch (e) {
                            console.error(`http2 hook authority=[${reqHeaders[":authority"]}] decompressing or decoding reqBodyBuf to string error`, e);
                        }
                        const body = reqBodyStr != null ? reqBodyStr : reqBodyBuf;
                        matchedHooks = matchedHooks.filter((item): boolean => {
                            if (fakedResponse) return false;
                            let nextAction = item.onMatchedRequest(reqHeaders[":method"],
                                reqHeaders[":path"] == null ? undefined
                                    : new URL(reqHeaders[":path"], `https://${reqHeaders[":authority"]}/`),
                                reqHttpVer, reqHeaders, body);
                            switch (nextAction.nextAction) {
                                case "fakeResponse":
                                    fakedResponse = true;
                                    const fakeResponse = nextAction.fakeResponse;
                                    cliReqStream.respond(fakeResponse.headers);
                                    if (fakeResponse.body != null) cliReqStream.end(fakeResponse.body);
                                    else cliReqStream.end();
                                    break;
                                case "passOnRequestBody":
                                    break;
                            }
                            return fakedResponse ? false : nextAction.interceptResponse;
                        });
                        if (this.checkOfflineMode(reqHeaders[":authority"])) {
                            if (matchedHooks.length == 0 && !fakedResponse) cliReqStream.destroy();
                        }
                    }

                    try {
                        svrReq?.end();
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http2 authority=[${reqHeaders[":authority"]}] svrReq.end() error`, e);
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
                            console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
                        }
                        return;
                    case constants.DOWNGRADE_TO_HTTP1:
                        //FIXME
                        const authorityURL = new URL(`https://${reqHeaders[":authority"]}`);
                        this.params.setSupportH2(authorityURL, false);//FIXME not working when IP addr used in HTTP CONNECT
                        if (parameters.params.VERBOSE) console.log(`marked [${authorityURL}] supportHTTP2=false`);
                        if (parameters.params.VERBOSE) console.log("sending status code 505 and goaway");
                        try {
                            cliReqStream.respond({
                                [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
                                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                            });
                            cliReqStream.end("505 HTTP Version Not Supported");
                            cliReqStream.session.goaway(http2.constants.NGHTTP2_HTTP_1_1_REQUIRED);
                        } catch (e) {
                            //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                            console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
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
                    console.error(`http2 authority=[${reqHeaders[":authority"]}] cliReqStream.respond() error`, e);
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

        this.params = params;
        this.certGen = certGen;
        this.http2SecureServer = http2SecureServer;
        this.openSess = new Map<string, http2.ClientHttp2Session>();
        this.pendingSess = new Map<string, Promise<http2.ClientHttp2Session>>();
        this.hooks = [];
    }
    async close(): Promise<void> {
        this.openSess.forEach((val, key) => val.destroyed || val.destroy());
        this.openSess.clear();
        await Promise.allSettled([this.http2SecureServer].map((server) => {
            return new Promise<void>((resolve) => {
                server.on('close', () => resolve());
                server.close();
            })
        }));
    }

    private checkOfflineMode(hostname: string | undefined): boolean {
        if (this.params.mode !== parameters.mode.LOCAL_OFFLINE) return false;
        if (hostname == null) return true;
        if (!net.isIPv6(hostname)) hostname = hostname.replace(/:\d+$/i, "");
        if (localServer.offlineModeHostnameWhiteList.find((regEx) => hostname?.match(regEx))) return false;
        else return true;
    }
    private static readonly offlineModeHostnameWhiteList: Array<RegExp> = [
        /(\.|^)github\.com$/,
        /(\.|^)githubusercontent\.com$/,
        /(\.|^)github\.io$/,
        /(\.|^)jsdelivr\.net$/,
        /(\.|^)pages\.dev$/,
    ];

    addHook(newHook: hook) {
        if (this.hooks.find((hook) => hook === newHook) == null) this.hooks.push(newHook);
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
                sess.destroy(); // force-close
            }
            return func;
        })(sess);
        sess.on('error', errorListener);

        let timeoutListener = ((sess) => {
            let func = () => {
                this.openSess.delete(authorityURL.href);
                sess.destroy(); // force-close
            }
            return func;
        })(sess);
        sess.on('timeout', timeoutListener);

        let goawayListener = ((sess) => {
            let func = (errorCode: any, lastStreamID: any, opaqueData: any) => {
                this.openSess.delete(authorityURL.href);
                sess.destroy(); // force-close
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
            if (parameters.params.VERBOSE) console.log(`creating tlsSocket [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
            let tlsSocket = tls.connect(options, () => {
                let actualAlpn = tlsSocket.alpnProtocol;
                if (parameters.params.VERBOSE) console.log(`tlsSocket [${host}:${port}]`
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
                    if (parameters.params.VERBOSE) console.log(`creating http2 session [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
                    let tlsSocket = tls.connect(options, () => {
                        let actualAlpn = tlsSocket.alpnProtocol;
                        if (parameters.params.VERBOSE) console.log(`http2 session [${host}:${port}]`
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

    //sendHttp2RequestAsync does not trigger hooks
    sendHttp2RequestAsync(
        url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody: string | Buffer | undefined,
        cvtBufToStr: boolean
    ): Promise<{ headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader, respBody: string | Buffer }> {
        return new Promise((resolve, reject) => {
            const authority = `https://${url.host}/`, alpn = "h2", sni = url.hostname;
            this.getH2SessionAsync(new URL(authority), alpn, sni).then((sess) => {
                let request = sess.request(reqHeaders);
                request.on('error', (err) => reject(err));
                request.on('response', (headers, flags) =>
                    this.handleHttp2Response(authority, request, headers, flags, resolve, reject, cvtBufToStr)
                );
                if (typeof reqBody === 'string') request.end(Buffer.from(reqBody, 'utf-8'));
                else if (reqBody instanceof Buffer) request.end(reqBody);
                else request.end();
            }).catch((err) => reject(err));
        });
    }
    //emitHttp2RequestAsync triggers hooks
    emitHttp2RequestAsync(
        url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody: string | Buffer | undefined,
        cvtBufToStr: boolean
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
                    request.on('response', (headers, flags) =>
                        this.handleHttp2Response(authority, request, headers, flags, resolve, reject, cvtBufToStr)
                    );
                    if (typeof reqBody === 'string') request.end(Buffer.from(reqBody, 'utf-8'));
                    else if (reqBody instanceof Buffer) request.end(reqBody);
                    else request.end();
                });
            });
        });
    }
    private handleHttp2Response(
        authority: string,
        request: http2.ClientHttp2Stream,
        headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
        flags: number,
        resolve: (value: {
            headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
            respBody: string | Buffer,
        }) => void,
        reject: (reason?: any) => void,
        cvtBufToStr: boolean
    ): void {
        let respHeaders = headers;
        const respBodyBufArray: Array<Buffer> = [];
        request.on('data', (chunk) => { respBodyBufArray.push(chunk as Buffer); });
        request.on('end', () => {
            let respBodyBuf = Buffer.concat(respBodyBufArray), respBodyStr: string | undefined;
            try {
                const encoding = respHeaders["content-encoding"];
                respBodyBuf = localServer.decompress(respBodyBuf, encoding);
                if (cvtBufToStr) {
                    const charset = parseCharset.get(respHeaders);
                    respBodyStr = respBodyBuf.toString(charset);
                }
            } catch (e) {
                console.error(`handleHttp2Response authority=[${authority}] decompressing or decoding respBodyBuf to string error`, e);
                reject(e);
            }
            const body = respBodyStr != null ? respBodyStr : respBodyBuf;
            resolve({ headers: respHeaders, respBody: body });
        });
    }

    static compress(data: Buffer, encoding?: string, quality = 8): Buffer {
        if (encoding == null) return data = Buffer.concat([data]);
        let compressed: Buffer;
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
                        [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
                        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.byteLength,
                    },
                });
                break;
            default:
                throw new Error(`unknown compress encoding=${encoding}`);
        }
        return compressed;
    }
    static decompress(data: Buffer, encoding?: string): Buffer {
        if (encoding == null) return data = Buffer.concat([data]);

        let decompressed = data;
        let encodingArray = encoding.replace(/\s/g, "").split(",").filter((enc) => enc !== "");
        try {
            encodingArray.forEach((enc) => {
                decompressed = this.decompressSingle(decompressed, enc);
            });
        } catch (e) {
            console.error(`decompress failed, try reverse...`, e);
            try {
                decompressed = data;
                encodingArray.reverse().forEach((enc) => {
                    decompressed = this.decompressSingle(decompressed, enc);
                });
            } catch (e2) {
                console.error(`decompressing in reversed order failed, try JSON.parse...`, e2);
                try {
                    JSON.parse(data.toString('utf-8'));
                    console.warn(`data is uncompressed json`);
                    return data = Buffer.concat([data]);
                } catch (e3) {
                    let msg = `JSON.parse after decompress decompressing in reversed order attempt failed`;
                    console.error(msg, e3);
                    throw new Error(msg);
                }
            }
        }
        return decompressed;
    }
    private static decompressSingle(data: Buffer, encoding?: string): Buffer {
        if (encoding == null) return data = Buffer.concat([data]);
        let decompressed: Buffer;
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