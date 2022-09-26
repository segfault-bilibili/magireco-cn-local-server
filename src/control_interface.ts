import * as http from "http";
import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import { parseCharset } from "./parse_charset";
import { getStrRep } from "./getStrRep";

export class controlInterface {
    private closing = false;
    private readonly params: parameters.params;
    private readonly httpServerSelf: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;
    private readonly bsgamesdkPwdAuth: bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth;

    static async launch(): Promise<void> {
        const params = await parameters.params.load();
        if (params.checkModified()) await params.save();
        let localserver = new localServer(params);
        let httpproxy = new httpProxy(params);
        new controlInterface(params, [localserver, httpproxy]);
    }

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

        let loginStatus = `未登录`, loginStatusStyle = "color: red";
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
        }

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
            + `\n  <h2>说明</h2>`
            /*
            //FIXME MuMu上Clash不能正常按应用分流，而访问官服时必须由Clash区分是游戏客户端还是本地服务器发出了请求，前者走代理回到本地服务器、后者不走代理直连
            + `\n  <ol>`
            + `\n  <li>`
            + `\n  在国服尚未关服的情况下，这里提供的${aHref("Bilibili登录", "#bilibilipwdauth", false)}界面可以在无需游戏客户端的情况下，登录并下载游戏账号内的个人数据，也就是你拥有的魔法少女、记忆结晶列表、以及最近的获得履历等等。`
            + `\n  <br>但这只是快捷省事的途径，不一定可靠。（虽然通过下述折腾途径登录游戏也同样麻烦且可能失败）`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  下载并安装${aHref("魔法纪录国服Android客户端", officialURL.href)}（不支持iOS，iOS用户请尝试这里提供的${aHref("Bilibili登录", "#bilibilipwdauth", false)}界面，或者考虑模拟器、云手机等替代方案）。`
            + `\n  <br>一般无root权限的Android真机，如果你正在真机上跑本地服务器（换言之，没条件在电脑上跑本地服务器），请务必把游戏客户端安装在<b>内部可以开启root的虚拟机</b>中，比如${aHref("光速虚拟机", gsxnjURL.href)}。`
            + `\n  <br>运行游戏客户端的模拟器/虚拟机/云手机请务必<b>开启root权限</b>。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  下载${aHref("Clash for Android", clashURL.href)}（不知道选哪个，就试试foss-universal版）并安装。`
            + `\n  <br>然后下载上面提供的Clash配置文件，并导入Clash中。`
            + `\n  <br>（比如，真机上跑虚拟机（虚拟机内跑游戏），本地服务器直接跑在真机上，于是Clash也直接跑在真机上（而且虚拟机可能也不支持在其内部跑Clash））`
            + `\n  <br>（又比如，电脑直接跑本地服务器，而游戏和Clash跑在电脑上的模拟器里，那么，因为本地服务器在模拟器外边、而Clash却在模拟器里面，所以就需要通过<code>adb reverse tcp:${httpProxyPort} tcp:${httpProxyPort}</code>命令来手工设置端口映射，才能让模拟器内的Clash通过端口映射连接到外边本地服务器的HTTP代理端口）`
            + `\n  <br>（跑本地服务器的电脑如果同时连接了多个设备（比如真机也像模拟器一样用来跑游戏客户端和Clash），可用<code>adb devices -l</code>命令列出transport_id，比如2，然后用类似<code>adb reverse -t 2 tcp:${httpProxyPort} tcp:${httpProxyPort}</code>这样来分别给每一个设备设置端口映射）`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  导入Clash配置后，在Clash的[设置]=>[网络]中依次开启[自动路由系统流量]（这个默认应该就是开启的）、[绕过私有网络]和[DNS劫持]。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  回到Clash主界面，点击[已停止 点此启动]按钮，然后点击新出现的按钮[代理 全局模式]，在里面选择[magirecolocal]，然后点击右下角的[闪电图标按钮]应用生效。`
            + `\n  <br>（另外，推荐把[访问控制模式]设为[仅允许已选择的应用]，然后在[访问控制应用包列表]中只勾选上浏览器、魔纪客户端和虚拟机。不过实测安卓6的MuMu模拟器等环境下该项设置似乎无效）`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  下载上面提供的CA证书，并利用root权限，将其安装为<b>系统CA证书</b>，然后<b>重启系统</b>。`
            + `\n  <br><b>注意：</b>你需要给<b>游戏所在的运行环境</b>安装CA证书、然后重启刚刚安装好CA证书的这个系统。比如，如果你是在电脑上跑模拟器（游戏客户端在模拟器里）、而且本地服务器直接跑在电脑上；或者是在真机上跑虚拟机（游戏客户端在虚拟机里）、本地服务器直接跑在真机上，那么你就需要在<b>模拟器或虚拟机内</b>安装CA证书，然后把<b>模拟器或虚拟机</b>给重启了（而不需要重启外边的真机或电脑）。又比如，如果游戏客户端、Clash、本地服务器这三者都跑在一台有root的真机上，那么就只能重启真机了。`
            + `\n  <br>这一步可以用${aHref("autoBattle脚本", autoBattleURL.href)}（安装后请先下拉在线更新到最新版）选择运行[安装CA证书]这个脚本即可自动完成；也可以参照网上的相关教程手动完成。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  既然刚刚重启系统了，那么跑在里面的Clash和本地服务器也会因为刚刚系统重启而停止运行（取决于你的具体环境），那么，现在就把停止运行的它们也重新启动。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  如果一切顺利，那么就可以按往常一样启动、登录游戏；然后刷新这个页面，应该就可以在下面看到绿色的“已登录”状态了。`
            + `\n  </li>`
            + `\n  </ol>`
            */
            + `\n  <hr>`
            + `\n  <h2 id=\"bilibilipwdauth\">Bilibili登录</h2>`
            + `\n  <i>下面这个登录界面只是快捷省事的途径，不一定可靠。如果你有条件折腾，还是推荐用上述方式照常登录游戏。</i><br>`
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
            + `\n      <label style=\"${loginStatusStyle}\" id=\"loginstatus\" for=\"loginbtn\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n      <button id=\"loginbtn\">登录</button>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <hr>`
            /* //FIXME
            + `\n  <h2>Control</h2>`
            + `\n  <form action=\"/api/shutdown\" method=\"get\">`
            + `\n    <button>Shutdown</button>`
            + `\n  </form>`
            + `\n  <form action=\"/api/restart\" method=\"get\">`
            + `\n    <button>Restart</button>`
            + `\n  </form>`
            */
            + `\n  <hr>`
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
            res.on('error', (err) => reject(err));
            res.writeHead(statusCode, { 'Content-Type': 'text/html' });
            res.end(html, () => resolve());
        });
    }
}