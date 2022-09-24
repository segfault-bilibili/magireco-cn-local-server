import * as http from "http";
import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import { parseCharset } from "./parse_charset";

export class controlInterface {
    private _closed = false;
    get closed() {
        return this._closed;
    }
    private readonly params: parameters.params;
    private readonly httpServerSelf: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;
    private readonly bsgamesdkPwdAuth: bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth;

    constructor(params: parameters.params, serverList: Array<localServer | httpProxy>) {
        const bsgamesdkPwdAuth = new bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth(params,
            serverList.find((s) => s instanceof localServer) as localServer);

        const httpServerSelf = http.createServer(async (req, res) => {
            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }

            if (req.url.startsWith("/api/")) {
                let apiName = req.url.replace(/(^\/api\/)|(\/$)/g, "");
                console.log(`controlInterface received api request [${apiName}]`);
                switch (apiName) {
                    case "close":
                        this.sendResultAsync(res, 200, "closing");
                        this.close();
                        return;
                    case "pwdlogin":
                        let charset = parseCharset.get(req.headers);
                        let postData = await new Promise((resolve, reject) => {
                            req.on('error', (err) => reject(err));
                            req.setEncoding(charset);
                            let postData = "";
                            req.on('data', (chunk) => postData += chunk);
                            req.on('end', () => resolve(postData));
                        });
                        let bogusURL = new URL(`http://bogus/query?${postData}`);
                        let username = bogusURL.searchParams.get("username");
                        let password = bogusURL.searchParams.get("password");
                        if (username == null || password == null || username === "" || password === "") {
                            let result = "username or password is empty";
                            console.error(result);
                            this.sendResultAsync(res, 400, result);
                            return;
                        }
                        try {
                            let result = await this.bsgamesdkPwdAuth.login(username, password);
                            this.params.bsgamesdkResponse = result;
                            this.params.save();
                            let resultText = JSON.stringify(result);
                            this.sendResultAsync(res, 200, resultText);
                        } catch (e) {
                            console.error(`bsgamesdkPwdAuth error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `bsgamesdkPwdAuth error`);
                        }
                        return;
                    default:
                        let result = `unknown api=${apiName}`;
                        console.error(result);
                        this.sendResultAsync(res, 400, result);
                        return;
                }
                return;
            }

            switch (req.url) {
                case "/":
                    console.log("serving /");
                    res.writeHead(200, { ["Content-Type"]: "text/html" });
                    res.end(this.homepageHTML());
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
        console.log(`controlInterface listening on [${host}:${port}]`);

        this.params = params;
        this.httpServerSelf = httpServerSelf;
        this.serverList = serverList;
        this.bsgamesdkPwdAuth = bsgamesdkPwdAuth;
    }
    close(): void {
        this.serverList.forEach((server) => server.close());
        this.httpServerSelf.close();
        this._closed = true;
    }

    private homepageHTML(): string {
        return "<!doctype html>"
            + `\n<html>`
            + `\n<head>`
            + `\n  <title>Magireco CN Local Server</title>`
            + `\n</head>`
            + `\n<body>`
            + `\n  <h1>Magireco CN Local Server</h1>`
            + `\n  <hr>`
            + `\n  <h2>Bilibili Login</h2>`
            + `\n  <form action=\"/api/pwdlogin\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"username\">Username</label>`
            + `\n      <input name=\"username\" id=\"username\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"password\">Password</label>`
            + `\n      <input name=\"password\" id=\"password\" type=\"password\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <button>Login</button>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <hr>`
            + `\n</body>`
            + `\n</html>`
    }
    private async sendResultAsync(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage },
        statusCode: number, result: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let strRep = Buffer.from(result, 'utf16le').swap16().toString('hex')
                .replace(/([\da-f]{4})/g, "\\u$1").replace(/\\u00/g, "\\x");
            let html = `<!doctype html>`
                + `\n<html>`
                + `\n<head>`
                + `\n  <meta charset =\"utf-8\">`
                + `\n  <title>Magireco CN Local Server - API Result</title>`
                + `\n  <script>`
                + `\n    setTimeout(() => {`
                + `\n      document.getElementById(\"httpstatus\").textContent = \"${statusCode}\";`
                + `\n      document.getElementById(\"result\").textContent = \"${strRep}\";`
                + `\n    });`
                + `\n  </script>`
                + `\n  <style>`
                + `\n    label,input{`
                + `\n      display:flex;`
                + `\n      flex-direction:column;`
                + `\n    }`
                + `\n  </style>`
                + `\n</head>`
                + `\n<body>`
                + `\n  <button onclick=\"window.history.back();\">Back</button>`
                + `\n  <hr>`
                + `\n  <label for=\"httpstatus\">HTTP Status Code</label>`
                + `\n  <textarea id=\"httpstatus\" readonly rows=\"1\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                + `\n  <br>`
                + `\n  <label for=\"result\">${statusCode == 200 ? "Result" : "Error Message"}</label>`
                + `\n  <textarea id=\"result\" readonly rows=\"20\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                + `\n</body>`
                + `\n</html>`
            res.on('error', (err) => reject(err));
            res.writeHead(statusCode, { 'Content-Type': 'text/html' });
            res.end(html, () => resolve());
        });
    }
}