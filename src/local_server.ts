import * as net from "net";
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as parameters from "./parameters";
import * as certGenerator from "./cert_generator";

export enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
}

export class localServer {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly http2SecureServer: http2.Http2SecureServer;
    private readonly certGen: certGenerator.certGen;
    private readonly CACerts: Array<string>;
    private readonly openSess: Map<string, http2.ClientHttp2Session>;

    constructor(params: parameters.params) {
        const certGen = new certGenerator.certGen(params.CACertAndKey);

        const CACerts = tls.rootCertificates.slice();
        CACerts.push(params.CACertPEM);
        const upstreamProxyCACert = params.upstreamProxyCACert;
        if (upstreamProxyCACert != null) {
            CACerts.unshift(upstreamProxyCACert);
            console.log("added upstreamProxyCACert to CACerts");
        }

        const options: http2.SecureServerOptions = certGen.getCertAndKey(params.listenList.localServer.host);
        options.SNICallback = (servername, cb) => {
            let certAndKey = this.certGen.getCertAndKey(servername);
            let ctx = tls.createSecureContext(certAndKey);
            cb(null, ctx);
        }
        options.allowHTTP1 = true;
        const http2SecureServer = http2.createSecureServer(options);

        http2SecureServer.on('stream', (stream, headers, flags) => {
            const authority = headers[":authority"];
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

            if (
                authority === this.params.listenList.localServer.host
                || authority === `${this.params.listenList.localServer.host}:${this.params.listenList.localServer.port}`
            ) {
                stream.respond({
                    [http2.constants.HTTP2_HEADER_STATUS]: 200,
                    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
                });
                stream.end('Magireco Local Server');
                return;
            }

            console.log(`stream accepted, authority=[${authority}] alpn=[${alpn}] sni=[${sni}]`);
            this.getSessionAsync(`https://${authority}/`, alpn, sni).then((sess) => {
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
            }).catch((e) => {
                if (e instanceof Error && e.message === constants.DOWNGRADE_TO_HTTP1) {
                    //FIXME
                    console.log("sent status code 505 and goaway");
                    stream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    stream.end("505 HTTP Version Not Supported");
                    stream.session.goaway(http2.constants.NGHTTP2_HTTP_1_1_REQUIRED);
                } else {
                    console.error("cannot create http2 session", e);
                    stream.respond({
                        [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_BAD_GATEWAY,
                        [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/plain",
                    });
                    stream.end("502 Bad Gateway");
                }
            });
        });

        let listenAddr = params.listenList.localServer;
        http2SecureServer.listen(listenAddr.port, listenAddr.host);

        this.params = params;
        this.certGen = certGen;
        this.CACerts = CACerts;
        this.http2SecureServer = http2SecureServer;
        this.openSess = new Map<string, http2.ClientHttp2Session>();
    }
    close(): void {
        this.http2SecureServer.close();
        this._closed = true;
    }

    private async getSessionAsync(authority: string, alpn?: string, sni?: string): Promise<http2.ClientHttp2Session> {
        let sess = this.openSess.get(authority);
        if (sess != null) {
            if (!sess.closed && !sess.destroyed) {
                return sess;
            } else this.openSess.delete(authority);
        }

        const authorityURL = new URL(authority);
        const host = authorityURL.hostname;
        const port = isNaN(parseInt(authorityURL.port)) ? 443 : parseInt(authorityURL.port);
        let socket: net.Socket;
        if (this.params.upstreamProxyEnabled) {
            socket = await this.httpTunnelAsync(host, port);
        } else {
            socket = net.connect(port, host);
        }

        sess = await this.createClientHttp2SessionAsync(socket, authority, alpn, sni);

        sess.on('close', () => () => {
            this.openSess.delete(authority);
        });

        let errorListener = ((sess) => {
            let func = (err: any) => {
                console.error(`error in http2 session authority=[${authority}]`, err);
                this.openSess.delete(authority);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('error', errorListener);

        let timeoutListener = ((sess) => {
            let func = () => {
                this.openSess.delete(authority);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('timeout', timeoutListener);

        let goawayListener = ((sess) => {
            let func = (errorCode: any, lastStreamID: any, opaqueData: any) => {
                this.openSess.delete(authority);
                sess.close();
            }
            return func;
        })(sess);
        sess.on('goaway', goawayListener);

        this.openSess.set(authority, sess);

        return sess;
    }

    private httpTunnelAsync(host: string, port: number): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const proxyHost = this.params.upstreamProxy.host;
            const proxyPort = this.params.upstreamProxy.port;
            http
                .request({
                    host: proxyHost,
                    port: proxyPort,
                    method: "CONNECT",
                    path: `${host}:${port}`,
                    headers: {
                        ["Host"]: `${host}:${port}`,
                    }
                })
                .on('connect', (response, socket, head) => resolve(socket))
                .on('error', (err) => reject(err))
                .end();
        });
    }

    private createClientHttp2SessionAsync(socket: net.Socket,
        authority: string, alpn?: string, sni?: string
    ): Promise<http2.ClientHttp2Session> {
        return new Promise((resolve, reject) => {
            let errorListener = (err: Error) => {
                reject(err);
            }
            let session = http2.connect(authority, {
                createConnection: (authorityURL: URL, option: http2.SessionOptions) => {
                    let host = authorityURL.hostname;
                    let port = parseInt(authorityURL.port);
                    if (isNaN(port)) port = 443;
                    let options: tls.ConnectionOptions = {
                        ca: this.CACerts,
                        socket: socket,
                        host: host,
                        port: port,
                        ALPNProtocols: [],
                    }
                    if (alpn != null) (options.ALPNProtocols as Array<string>).push(alpn);
                    if (sni != null) options.servername = sni;
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