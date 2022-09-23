import * as http from "http";
import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";

export class controlInterface {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly httpServerSelf: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;

    constructor(params: parameters.params, serverList: Array<httpProxy | localServer>) {
        const httpServerSelf = http.createServer((req, res) => {
            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }

            let apiName: string;
            if (req.url.startsWith("/api/")) switch (apiName = req.url.replace(/(^\/api\/)|(\/$)/g, "")) {
                case "close":
                    res.writeHead(200, { ["Content-Type"]: "text/plain" });
                    res.end("closing");
                    this.close();
                    return;
            }

            switch (req.url) {
                case "/":
                    console.log("serving /");
                    res.writeHead(200, { ["Content-Type"]: "text/html" });
                    res.end("<!doctype html><html><title>Magireco Local Server</title><body><h1>Magireco Local Server</h1></body></html>");
                    return;
                case "/ca.crt":
                    console.log("serving ca.crt");
                    res.writeHead(200, { ["Content-Type"]: "application/x-x509-ca-cert" });
                    res.end(this.params.CACertPEM);
                    return;
                case "/ca_subject_hash_old.txt":
                    let ca_subject_hash_old = this.params.CACertSubjectHashOld;
                    console.log(`servering ca_subject_hash_old=[${ca_subject_hash_old}]`);
                    res.writeHead(200, { ["Content-Type"]: "text/plain" });
                    res.end(ca_subject_hash_old);
                    return;
            }

            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end("403 Forbidden");
        });

        let port = params.listenList.controlInterface.port;
        let host = params.listenList.controlInterface.host;
        httpServerSelf.listen(port, host);

        this.params = params;
        this.httpServerSelf = httpServerSelf;
        this.serverList = serverList;
    }
    close(): void {
        this.serverList.forEach((server) => server.close());
        this.httpServerSelf.close();
        this._closed = true;
    }
}