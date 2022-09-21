import * as net from "net";
import * as http2 from "http2";
import * as tls from "tls";
import * as parameters from "./parameters";
import * as certGenerator from "./cert_generator";

export class localServer {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly http2SecureServer: http2.Http2SecureServer;
    private readonly certGen: certGenerator.certGen;

    constructor(params: parameters.params) {
        const certGen = new certGenerator.certGen(params.CACertAndKey);
        const options: http2.SecureServerOptions = certGen.getCertAndKey(params.listenList.localServer.host);
        options.SNICallback = (servername, cb) => {
            let certAndKey = this.certGen.getCertAndKey(servername);
            let ctx = tls.createSecureContext(certAndKey);
            cb(null, ctx);
        }
        options.allowHTTP1 = true;
        const http2SecureServer = http2.createSecureServer(options);

        http2SecureServer.on('stream', (stream, headers, flags) => {
            const alpn = stream.session.alpnProtocol;
            const sni = (stream.session.socket as any).servername;
            console.log(`stream accepted, alpn=[${alpn}] sni=[${sni}]`);
            //TODO
            stream.respond({
                [http2.constants.HTTP2_HEADER_STATUS]: 200,
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/plain; charset=utf-8'
            });
            stream.end('Magireco Local Server');
        });
        let listenAddr = params.listenList.localServer;
        http2SecureServer.listen(listenAddr.port, listenAddr.host);

        this.params = params;
        this.certGen = certGen;
        this.http2SecureServer = http2SecureServer;
    }
    close(): void {
        this.http2SecureServer.close();
        this._closed = true;
    }
}