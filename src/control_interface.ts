import * as net from "net";
import * as http from "http";
import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import { parseCharset } from "./parse_charset";
import { getStrRep } from "./getStrRep";
import * as userdataDump from "./userdata_dump";
import * as multipart from "parse-multipart-data";

export class controlInterface {
    private closing = false;
    private readonly params: parameters.params;
    private readonly httpServerSelf: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;
    private readonly bsgamesdkPwdAuth: bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth;
    private readonly userdataDmp: userdataDump.userdataDmp;
    private readonly userdataDumpFileName = "userdataDump.json";

    static async launch(): Promise<void> {
        const params = await parameters.params.load();
        if (params.checkModified()) await params.save();
        let localserver = new localServer(params);
        let httpproxy = new httpProxy(params);
        new controlInterface(params, [localserver, httpproxy]);
    }

    constructor(params: parameters.params, serverList: Array<localServer | httpProxy>) {
        const localsvr = serverList.find((s) => s instanceof localServer) as localServer;
        const bsgamesdkPwdAuth = new bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth(params, localsvr);
        const userdataDmp = new userdataDump.userdataDmp(params, localsvr);

        const httpServerSelf = http.createServer(async (req, res) => {
            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }

            if (req.url.startsWith("/api/")) {
                let apiName = req.url.replace(/(^\/api\/)|(\?.*$)/g, "");
                console.log(`controlInterface received api request [${apiName}]`);
                switch (apiName) {
                    /*
                    case "shutdown":
                        this.sendResultAsync(res, 200, "shutting down");
                        this.shutdown();
                        return;
                    case "restart":
                        this.sendResultAsync(res, 200, "restarting");
                        this.restart();
                        return;
                    */
                    case "upload_upstream_proxy_cacert":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string') throw new Error("postData is string");
                            let cacert = postData.find((item) => item.filename?.match(/(pem|crt)$/i))?.data.toString();
                            await this.params.save({ key: "upstreamProxyCACert", val: cacert });
                            let msg = cacert != null ? "saved upstreamProxyCACert" : "cleared upstreamProxyCACert";
                            console.log(msg);
                            this.sendResultAsync(res, 200, msg);
                        } catch (e) {
                            console.error("upload_upstream_proxy_cacert error", e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `upload_upstream_proxy_cacert error`);
                        }
                        return;
                    case "set_upstream_proxy":
                        try {
                            let newUpstreamProxyParams = await this.getParsedPostData(req);
                            let host = newUpstreamProxyParams.get("upstream_proxy_host");
                            let port = Number(newUpstreamProxyParams.get("upstream_proxy_port"));
                            let enabled = newUpstreamProxyParams.get("upstream_proxy_enabled") != null;
                            if (host == null || !net.isIP(host))
                                throw new Error("upstream proxy host is not an IP address");
                            if (isNaN(port) || port < 1 || port > 65535)
                                throw new Error("upstream proxy port must be an integer between 1 and 65535");
                            await this.params.save({ key: "upstreamProxy", val: { host: host, port: port } });
                            await this.params.save({ key: "upstreamProxyEnabled", val: enabled });
                            let resultText = "sucessfully updated upstream proxy settings";
                            console.log(resultText);
                            this.sendResultAsync(res, 200, resultText);
                        } catch (e) {
                            console.error(`set_upstream_proxy error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `set_upstream_proxy error`);
                        }
                        return;
                    case "pwdlogin":
                        try {
                            let pwdLoginParams = await this.getParsedPostData(req);
                            let username = pwdLoginParams.get("username");
                            let password = pwdLoginParams.get("password");
                            if (username == null || password == null || username === "" || password === "") {
                                let result = "username or password is empty";
                                console.error(result);
                                this.sendResultAsync(res, 400, result);
                                return;
                            }
                            let result = await this.bsgamesdkPwdAuth.login(username, password);
                            let resultText = JSON.stringify(result);
                            this.sendResultAsync(res, 200, resultText);
                        } catch (e) {
                            console.error(`bsgamesdkPwdAuth error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `bsgamesdkPwdAuth error`);
                        }
                        return;
                    case "dump_userdata":
                        try {
                            const dumpDataParams = await this.getParsedPostData(req); // finish receiving first
                            const requestingNewDownload = dumpDataParams.get("new") != null;
                            const lastSnapshot = this.userdataDmp.lastSnapshot;
                            const alreadyDownloaded = lastSnapshot != null;
                            const lastError = this.userdataDmp.lastError;
                            const hasDownloadResultOrError = alreadyDownloaded || lastError != null;
                            const isDownloading = this.userdataDmp.isDownloading;
                            if (!isDownloading && (requestingNewDownload || !hasDownloadResultOrError)) {
                                this.userdataDmp.getSnapshotAsync()
                                    .catch((e) => console.error(`dump_userdata error`, e)); // prevent crash
                                this.sendResultAsync(res, 200, "downloading, pleses wait...");
                            } else {
                                if (alreadyDownloaded) {
                                    this.sendResultAsync(res, 200, "download is already completed");
                                } else if (isDownloading) {
                                    this.sendResultAsync(res, 429, "download is not yet finished, please be patient...");
                                } else {
                                    this.sendResultAsync(res, 500, `error ${lastError instanceof Error ? lastError.message : ""}`);
                                }
                            }
                        } catch (e) {
                            console.error(`dump_userdata error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `dump_userdata error`);
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
                case "/magirecolocal.yaml":
                    console.log(`servering magirecolocal.yaml`);
                    res.writeHead(200, { ["Content-Type"]: "application/x-yaml" });
                    res.end(this.params.clashYaml);
                    return;
                case "/params.json":
                    console.log(`servering params.json`);
                    res.writeHead(200, { ["Content-Type"]: "application/json; charset=utf-8" });
                    res.end(this.params.stringify());
                    return;
                case `/${this.userdataDumpFileName}`:
                    let snapshot = this.userdataDmp.lastSnapshot;
                    if (snapshot != null) {
                        let stringified = JSON.stringify(snapshot, parameters.replacer);
                        res.writeHead(200, {
                            ["Content-Type"]: "application/json; charset=utf-8",
                            ["Content-Disposition"]: `attachment; filename=\"${this.userdataDumpFileName}\"`,
                        });
                        res.end(stringified);
                        return;
                    } else {
                        this.sendResultAsync(res, 404, "has not yet downloaded");
                        return;
                    }
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
        this.userdataDmp = userdataDmp;
    }
    private async closeAll(): Promise<void> {
        let promises = this.serverList.map((server) => server.close());
        promises.push(new Promise((resolve) => {
            this.httpServerSelf.on('close', () => resolve());
            this.httpServerSelf.close();
            this.httpServerSelf.closeAllConnections();
        }));
        await Promise.allSettled(promises);
    }
    async shutdown(): Promise<void> {
        if (this.closing) return;
        this.closing = true;
        this.params.save();
        await this.closeAll();
    }
    async restart(): Promise<void> {
        //FIXME
        if (this.closing) return;
        this.closing = true;
        this.params.save();
        await this.closeAll();
        await controlInterface.launch();
    }

    private async getParsedPostData(req: http.IncomingMessage): Promise<URLSearchParams> {
        let postData = await this.getPostData(req);
        if (typeof postData !== 'string') throw new Error("typeof postData !== 'string'");
        let bogusURL = new URL(`http://bogus/query?${postData}`);
        return bogusURL.searchParams;
    }
    private getPostData(req: http.IncomingMessage): Promise<string | Array<{ filename?: string, type?: string, data: Buffer }>> {
        return new Promise((resolve, reject) => {
            const method = req.method;
            if (!method?.match(/^POST$/i)) reject(Error(`method=${method} is not POST`));
            else {
                req.on('error', (err) => reject(err));
                let postData = Buffer.from(new ArrayBuffer(0));
                req.on('data', (chunk) => postData = Buffer.concat([postData, chunk]));
                req.on('end', () => {
                    try {
                        const contentType = req.headers["content-type"];
                        if (contentType == null) throw new Error();
                        let boundary = multipart.getBoundary(contentType);
                        if (typeof boundary !== 'string' || boundary === "") throw new Error();
                        let parts = multipart.parse(postData, boundary);
                        resolve(parts);
                    } catch (e) {
                        try {
                            let charset = parseCharset.get(req.headers);
                            let str = postData.toString(charset);
                            resolve(str);
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            }
        });
    }

    private homepageHTML(): string {
        const officialURL = new URL("https://game.bilibili.com/magireco/");
        const gsxnjURL = new URL("https://www.gsxnj.cn/");
        const clashURL = new URL("https://github.com/Kr328/ClashForAndroid/releases/latest");
        const autoBattleURL = new URL("https://www.bilibili.com/video/BV1nf4y1y713");

        const aHref = (text: string, url: string, newTab = true) => `<a target=\"${newTab ? "_blank" : "_self"}\" href=${url}>${text}</a>`

        let httpProxyAddr = "", httpProxyPort = "";
        const listenList = this.params.listenList;
        if (listenList != null) {
            const proxy = this.params.listenList.httpProxy;
            httpProxyAddr = proxy.host;
            httpProxyPort = String(proxy.port);
        }
        const upstreamProxy = this.params.upstreamProxy;
        const upstreamProxyHost = upstreamProxy.host;
        const upstreamProxyPort = upstreamProxy.port;
        const upstreamProxyEnabled = this.params.upstreamProxyEnabled;

        let loginStatus = `未登录`, loginStatusStyle = "color: red", loginBtnText = "登录";
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            let since: number | string | undefined = bsgamesdkResponse.timestamp;
            if (since != null) {
                since = Number(since);
                since = `${new Date(since).toLocaleDateString()} ${new Date(since).toLocaleTimeString()}`;
            }
            let expires: number | string | undefined = bsgamesdkResponse.expires;
            if (expires != null) expires = `${new Date(expires).toLocaleDateString()} ${new Date(expires).toLocaleTimeString()}`;
            loginStatus = getStrRep(`已登录 用户名=[${bsgamesdkResponse.uname}] uid=[${bsgamesdkResponse.uid}]`
                + ` 实名=[${bsgamesdkResponse.auth_name}] 实名认证状态=[${bsgamesdkResponse.realname_verified}]`
                + ` 登录时间=[${since}] 登录过期时间=[${expires}]`);
            loginStatusStyle = "color: green";
            loginBtnText = "重新登录"
        }

        let upstreamProxyCACertStatus = "未上传", upstreamProxyCACertStyle = "color: red";
        if (this.params.upstreamProxyCACert != null) {
            upstreamProxyCACertStatus = "已上传";
            upstreamProxyCACertStyle = "color: green";
        }

        let userdataDumpStatus = "尚未开始从官服下载", userdataDumpStatusStyle = "color: red";;
        if (this.userdataDmp.isDownloading) userdataDumpStatus = "从官服下载中...", userdataDumpStatusStyle = "color: blue";
        else if (this.userdataDmp.lastSnapshot != null) userdataDumpStatus = "从官服下载数据完毕", userdataDumpStatusStyle = "color: green";
        else if (this.userdataDmp.lastError != null) userdataDumpStatus = "从官服下载数据过程中出错", userdataDumpStatusStyle = "color: red";

        const html = "<!doctype html>"
            + `\n<html>`
            + `\n<head>`
            + `\n  <meta charset =\"utf-8\">`
            + `\n  <title>Magireco CN Local Server</title>`
            + `\n  <script>`
            + `\n    window.addEventListener('pageshow', (ev) => {`
            + `\n      if (ev.persisted||(window.performance!=null&&window.performance.navigation.type===2)) {`
            + `\n        window.location.reload(true);/*refresh on back or forward*/`
            + `\n      }`
            + `\n    });`
            + `\n    setTimeout(() => {`
            + `\n      document.getElementById(\"loginstatus\").textContent = \"${loginStatus}\";`
            + `\n    });`
            + `\n  </script>`
            + `\n  <style>`
            + `\n    label,input,button {`
            + `\n      display:flex;`
            + `\n      flex-direction:column;`
            + `\n    }`
            + `\n    code {`
            + `\n      color:black;`
            + `\n      background-color:#e0e0e0;`
            + `\n    }`
            + `\n    li {`
            + `\n      margin-bottom: .5rem;`
            + `\n    }`
            + `\n  </style>`
            + `\n</head>`
            + `\n<body>`
            + `\n  <h1>魔法纪录国服本地服务器</h1>`
            + `\n  <label for=\"httpproxyaddr\">HTTP代理监听地址</label>`
            + `\n  <input readonly id=\"httpproxyaddr\" value=\"${httpProxyAddr}\">`
            + `\n  <label for=\"httpproxyport\">HTTP代理监听端口</label>`
            + `\n  <input readonly id=\"httpproxyport\" value=\"${httpProxyPort}\">`
            + `\n  <label for=\"cacrt\">下载CA证书：</label>`
            + `\n  ${aHref("ca.crt", "/ca.crt")}`
            + `\n  <label for=\"cacrt\">下载Clash配置文件：</label>`
            + `\n  ${aHref("magirecolocal.yaml", "/magirecolocal.yaml")}`
            + `\n  <label for=\"paramsjson\">下载备份所有配置数据：</label>`
            + `\n  ${aHref("params.json", "/params.json")}`
            + `\n  <hr>`
            + `\n  <form action=\"/api/set_upstream_proxy\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"upstream_proxy_host\">上游代理地址</label>`
            + `\n      <input id=\"upstream_proxy_host\" name=\"upstream_proxy_host\" value=\"${upstreamProxyHost}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"upstream_proxy_port\">上游代理端口</label>`
            + `\n      <input id=\"upstream_proxy_port\" name=\"upstream_proxy_port\" value=\"${upstreamProxyPort}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"upstream_proxy_enabled\">启用上游代理</label>`
            + `\n      <input id=\"upstream_proxy_enabled\" name=\"upstream_proxy_enabled\" value=\"true\" type=\"checkbox\" ${upstreamProxyEnabled ? "checked" : ""}>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"修改上游代理设置\" id=\"set_upstream_proxy_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <hr>`
            + `\n  <form enctype=\"multipart/form-data\" action=\"/api/upload_upstream_proxy_cacert\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"file\" name=\"upstream_proxy_cacert\" id=\"upstream_proxy_cacert\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label style=\"${upstreamProxyCACertStyle}\" id=\"upstream_proxy_ca_status\" for=\"refreshbtn1\">${upstreamProxyCACertStatus}</label>`
            + `\n      <button id=\"refreshbtn1\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n      <input type=\"submit\" value=\"上传/清除上游代理CA证书\" id=\"upload_upstream_proxy_cacert_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <hr>`
            + `\n  <h2>说明</h2>`
            + `\n  <ol>`
            + `\n  <li>`
            + `\n  目前暂时尚未实现本地离线服务器功能。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  在国服尚未关服的情况下，这里提供的${aHref("Bilibili登录", "#bilibilipwdauth", false)}界面可以在无需游戏客户端的情况下登录游戏账号。`
            + `\n  <br>但这只是快捷省事的途径，不一定可靠。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  登录后即可${aHref("下载保存个人游戏账号数据", "#dumpuserdata", false)}，包括你拥有的魔法少女列表、记忆结晶列表、好友列表、以及最近的获得履历等等。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  另外，让游戏客户端通过上述HTTP代理设置连接服务器时（也就是通过这个本地服务器进行中转），即会自动从游戏通信内容中抓取到登录信息，然后刷新这个页面即可看到登录状态变为绿色“已登录”。`
            + `\n  <br>接着就同样可以利用抓取到的登录信息来下载保存个人账号数据。`
            + `\n  <br>但这很显然要求你有一定的动手能力，比如使用<code>adb reverse tcp:${httpProxyPort} tcp:${httpProxyPort}</code>命令设置端口映射；`
            + `\n  <br>尤其是CA证书必须安装为Android的系统证书，这一步可以用${aHref("autoBattle脚本", autoBattleURL.href)}（安装后请先下拉在线更新到最新版）选择运行[安装CA证书]这个脚本自动完成。`
            + `\n  <br><b>警告：安卓6的MuMu模拟器等环境下，Clash for Android似乎不能正常分流，可能导致网络通信在本地“死循环”：由这个本地服务器发出、本该直连出去的请求，被Clash拦截后又送回给了这个本地服务器，即死循环。</b>`
            + `\n  </li>`
            + `\n  </ol>`
            + `\n  <hr>`
            + `\n  <h2 id=\"bilibilipwdauth\">Bilibili登录</h2>`
            + `\n  <i>下面这个登录界面只是快捷省事的途径，不一定可靠。</i><br>`
            + `\n  <form action=\"/api/pwdlogin\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"username\">用户名</label>`
            + `\n      <input name=\"username\" id=\"username\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"password\">密码</label>`
            + `\n      <input name=\"password\" id=\"password\" type=\"password\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label style=\"${loginStatusStyle}\" id=\"loginstatus\" for=\"refreshbtn2\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n      <button id=\"refreshbtn2\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n      <button id=\"loginbtn\">${loginBtnText}</button>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <hr>`
            + `\n  <h2 id=\"dumpuserdata\">下载个人账号数据</h2>`
            + `\n  <form action=\"/api/dump_userdata\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"new_download_checkbox\">重新从官服下载</label>`
            + `\n      <input id=\"new_download_checkbox\" name=\"new\" value=\"true\" type=\"checkbox\" ${this.userdataDmp.lastError != null ? "checked" : ""}>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label style=\"${userdataDumpStatusStyle}\" for=\"refreshbtn3\">${userdataDumpStatus}</label>`
            + `\n      <button id=\"refreshbtn3\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n      <input type=\"submit\" value=\"从官服下载\" id=\"prepare_download_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n    ${this.userdataDmp.lastSnapshot == null ? "" : aHref(this.userdataDumpFileName, `/${this.userdataDumpFileName}`)}`
            + `\n  <hr>`
            /* //FIXME
            + `\n  <h2>Control</h2>`
            + `\n  <form action=\"/api/shutdown\" method=\"get\">`
            + `\n    <button>Shutdown</button>`
            + `\n  </form>`
            + `\n  <form action=\"/api/restart\" method=\"get\">`
            + `\n    <button>Restart</button>`
            + `\n  </form>`
            + `\n  <hr>`
            */
            + `\n</body>`
            + `\n</html>`
        return html;
    }
    private async sendResultAsync(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage },
        statusCode: number, result: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let strRep = getStrRep(result);
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
                + `\n    label,input {`
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
            res.on('error', (err) => { console.error(err); resolve(); }); // prevent crash
            res.writeHead(statusCode, { 'Content-Type': 'text/html' });
            res.end(html, () => resolve());
        });
    }
}