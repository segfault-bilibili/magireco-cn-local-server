import * as net from "net";
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as parameters from "./parameters";
import * as certGenerator from "./cert_generator";
import * as httpProxy from "./http_proxy";

export enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
    IS_SELF_IP = "IS_SELF_IP",
}

export class localServer {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly http2SecureServer: http2.Http2SecureServer;
    private readonly http1TlsServer: tls.Server;
    private readonly certGen: certGenerator.certGen;
    private readonly openSess: Map<string, http2.ClientHttp2Session>;

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

            const headers = cliReq.headers;
            const host = headers.host;
            const alpn = (cliReq.socket as tls.TLSSocket).alpnProtocol;
            const sni = (cliReq.socket as any).servername;

            cliReq.on('error', (err) => {
                console.log(`request error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                cliRes.end("502 Bad Gateway");
            });

            if (host == null) {
                cliRes.writeHead(403, { ["Content-Type"]: "text/plain" });
                cliRes.end("403 Forbidden");
                return;
            }

            console.log(`request accepted, host=[${host}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                let tlsSocket = await localServer.getTlsSocketAsync(this.params, true, new URL(`https://${host}/`), alpn, sni);
                let svrReq = http.request({
                    method: cliReq.method,
                    path: cliReq.url,
                    createConnection: (options, onCreate) => {
                        return tlsSocket;
                    },
                    headers: headers,
                });
                svrReq.on('continue', () => {
                    cliRes.writeHead(100);
                });
                svrReq.on('response', (svrRes) => {
                    try {
                        if (svrRes.statusCode == null) {
                            cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                            cliRes.end("502 Bad Gateway");
                        } else {
                            if (svrRes.statusMessage == null) cliRes.writeHead(svrRes.statusCode, svrRes.headers);
                            else cliRes.writeHead(svrRes.statusCode, svrRes.statusMessage, svrRes.headers);
                            svrRes.pipe(cliRes);
                        }
                    } catch (e) {
                        //FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        console.error(`http1 host=[${host}] svrRes.pipe() error`, e);
                    }
                });
                svrReq.on('end', () => {
                    console.log(`ending cliRes downlink: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                    cliRes.end();
                });
                svrReq.on('error', (err) => {
                    console.error(`svrReq error: host=[${host}] alpn=[${alpn}] sni=[${sni}]`, err);
                    cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                    cliRes.end("502 Bad Gateway");
                });

                cliReq.on('data', (chunk) => {
                    svrReq.write(chunk);
                });
                cliReq.on('end', () => {
                    console.log(`cliReq uplink ended: host=[${host}] alpn=[${alpn}] sni=[${sni}]`);
                    svrReq.end();
                });
            } catch (e) {
                if (e instanceof Error) switch (e.message) {
                    case constants.IS_SELF_IP:
                        cliRes.writeHead(200, { ["Content-Type"]: 'text/plain' });
                        cliRes.end('Magireco Local Server');
                        return;
                }
                console.error("cannot create http1 tlsSocket", e);
                cliRes.writeHead(502, { ["Content-Type"]: "text/plain" });
                cliRes.end("502 Bad Gateway");
                return;
            };
        });

        http2SecureServer.on('stream', async (stream, headers, flags) => {
            const authority = headers[":authority"];
            const authorityURL = new URL(`https://${authority}/`);
            const alpn = stream.session.alpnProtocol;
            const sni = (stream.session.socket as any).servername;

            stream.on('error', (err) => {
                console.log(`stream error: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`, err);
                stream.respond({
                    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                });
                stream.end("502 Bad Gateway");
            });

            if (authority == null) {
                stream.respond({
                    [http2.constants.HTTP2_HEADER_STATUS]: 403,
                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                });
                stream.end("403 Forbidden");
                return;
            }

            console.log(`http2 stream accepted, authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);

            try {
                let sess = await this.getH2SessionAsync(authorityURL, alpn, sni);
                let svrReq = sess.request(headers);
                svrReq.on('continue', () => {
                    stream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_CONTINUE,
                    });
                });
                svrReq.on('response', (headers, flags) => {
                    try {//FIXME temporary workaround to avoid ERR_HTTP2_INVALID_STREAM crash
                        stream.respond(headers);
                    } catch (e) {
                        console.error(`http2 authority=[${authority}] stream.respond() error`, e);
                    }
                });
                svrReq.on('data', (chunk) => {
                    stream.write(chunk);
                });
                svrReq.on('end', () => {
                    console.log(`ending stream downlink: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
                    stream.end();
                });
                svrReq.on('error', (err) => {
                    console.error(`svrReq error: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`, err);
                    stream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    stream.end("502 Bad Gateway");
                });

                stream.on('data', (chunk) => {
                    svrReq.write(chunk);
                });
                stream.on('end', () => {
                    console.log(`stream uplink ended: authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
                    svrReq.end();
                });
            } catch (e) {
                if (e instanceof Error) switch (e.message) {
                    case constants.IS_SELF_IP:
                        stream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_OK,
                            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                        });
                        stream.end('Magireco Local Server');
                        return;
                    case constants.DOWNGRADE_TO_HTTP1:
                        //FIXME
                        this.params.setSupportH2(authorityURL, false);
                        console.log("sending status code 505 and goaway");
                        stream.respond({
                            [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
                            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                        });
                        stream.end("505 HTTP Version Not Supported");
                        stream.session.goaway(http2.constants.NGHTTP2_HTTP_1_1_REQUIRED);
                        return;
                }
                console.error("cannot create http2 session", e);
                stream.respond({
                    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                });
                stream.end("502 Bad Gateway");
            };
        });

        const http2ListenAddr = params.listenList.localServer;
        http2SecureServer.listen(http2ListenAddr.port, http2ListenAddr.host);

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
                console.log(`sni=[${servername}] alpn=[${alpn}] piped to h1-compatible h2 local server`);
                tlsSocket.pipe(h1CompatH2TlsSocket);
                h1CompatH2TlsSocket.pipe(tlsSocket);
            }).on('error', (err) => {
                console.error(`http1TlsServer h1CompatH2TlsSocket error sni=[${servername}] alpn=[${alpn}]`, err);
            })
        });

        const http1ListenAddr = params.listenList.localHttp1Server;
        http1TlsServer.listen(http1ListenAddr.port, http1ListenAddr.host);

        this.params = params;
        this.certGen = certGen;
        this.http2SecureServer = http2SecureServer;
        this.http1TlsServer = http1TlsServer;
        this.openSess = new Map<string, http2.ClientHttp2Session>();
    }
    close(): void {
        this.http2SecureServer.close();
        this._closed = true;
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

    private async getH2SessionAsync(authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean
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
            console.log(`creating tlsSocket [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
            let tlsSocket = tls.connect(options, () => {
                let actualAlpn = tlsSocket.alpnProtocol;
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
                    console.log(`creating http2 session [${host}:${port}] alpn=[${alpn}] sni=[${sni}]`);
                    let tlsSocket = tls.connect(options, () => {
                        let actualAlpn = tlsSocket.alpnProtocol;
                        console.log(`http2 session [${host}:${port}]`
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
}