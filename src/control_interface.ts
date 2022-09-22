import * as net from "net";
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
    private readonly httpServer: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;

    constructor(params: parameters.params, serverList: Array<httpProxy | localServer>) {
        const httpServer = http.createServer((req, res) => {
            if (req.url === "/ca.crt") {
                console.log("serving ca.crt");
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/x-x509-ca-cert");
                res.end(this.params.CACertPEM);
            } else if (req.url === "/api/close") {
                res.statusCode = 200;
                res.setHeader("Content-Type", "text/plain");
                res.end("closing");
                this.close();
            } else {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end("403 Forbidden");
            }
        });

        let port = params.listenList.controlInterface.port;
        let host = params.listenList.controlInterface.host;
        httpServer.listen(port, host);

        this.params = params;
        this.httpServer = httpServer;
        this.serverList = serverList;
    }
    close(): void {
        this.serverList.forEach((server) => server.close());
        this.httpServer.close();
        this._closed = true;
    }
}