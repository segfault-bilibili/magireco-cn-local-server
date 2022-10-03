import * as stream from "stream";
import * as zlib from "zlib";
import * as fs from "fs";
import * as net from "net";
import * as http from "http";
import * as process from "process";
import * as ChildProcess from "child_process";
import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import { parseCharset } from "./parse_charset";
import { getStrRep } from "./get_str_rep";
import * as userdataDump from "./userdata_dump";
import * as multipart from "parse-multipart-data";
import * as staticResCrawler from "./static_res_crawler";
import { fakeMagirecoProdRespHook } from "./hooks/fake_magireco_prod_resp_hook";
import { saveAccessKeyHook } from "./hooks/save_access_key_hook";
import { saveOpenIdTicketHook } from "./hooks/save_open_id_ticket_hook";

export class controlInterface {
    private closing = false;
    private readonly params: parameters.params;
    private readonly httpServerSelf: http.Server;
    private readonly serverList: Array<httpProxy | localServer>;
    private readonly bsgamesdkPwdAuth: bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth;
    private readonly userdataDmp: userdataDump.userdataDmp;
    readonly crawler: staticResCrawler.crawler;

    static async launch(): Promise<void> {
        const params = await parameters.params.load();
        if (params.checkModified()) await params.save();
        let localserver = new localServer(params);
        let httpproxy = new httpProxy(params);
        let control_interface = new controlInterface(params, [localserver, httpproxy]);
        control_interface.openWebOnAndroid();
    }
    openWebOnAndroid(): void {
        try {
            const addr = this.params.listenList.controlInterface;
            const webUrl = `http://${addr.host}:${addr.port}/`;

            let shellCmd: string | undefined;

            const androidSpecificFileList = [
                "/system/build.prop",
                "/sdcard",
                "/storage/emulated",
            ];
            let found = androidSpecificFileList.filter((path) => fs.existsSync(path));
            if (found.length > 0) {
                shellCmd = `am start -a \"android.intent.action.VIEW\" -d \"${webUrl}\"`;
            } else if (process.env["windir"]?.match(/^[A-Z]\:\\WINDOWS/i)) {
                shellCmd = `start ${webUrl}`;
            }

            if (shellCmd == null || !this.params.autoOpenWeb) {
                console.log(`请手动在浏览器中打开Web控制界面\n  ${webUrl}`);
                return;
            }

            ChildProcess.exec(shellCmd, (error, stdout, stderr) => {
                try {
                    if (error == null) {
                        console.log(`    即将从浏览器打开Web控制界面...\n  ${webUrl}`);
                        console.log(`  【如果没成功自动打开浏览器，请手动复制上述网址粘贴到浏览器地址栏】`);
                    } else {
                        console.error("error", error);
                        console.error("stdout", stdout);
                        console.error("stderr", stderr);
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    constructor(params: parameters.params, serverList: Array<localServer | httpProxy>) {
        const localsvr = serverList.find((s) => s instanceof localServer) as localServer;
        const bsgamesdkPwdAuth = new bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth(params, localsvr);
        const userdataDmp = new userdataDump.userdataDmp(params, localsvr);
        const crawler = new staticResCrawler.crawler(params, localsvr);

        const hooks = [
            new saveAccessKeyHook(params),
            new saveOpenIdTicketHook(params),
            new fakeMagirecoProdRespHook(params, crawler, userdataDmp),
        ];
        hooks.forEach((hook) => localsvr.addHook(hook));

        const httpServerSelf = http.createServer(async (req, res) => {
            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }

            if (req.url.startsWith("/api/")) {
                const apiName = req.url.replace(/(^\/api\/)|(\?.*$)/g, "");
                console.log(`controlInterface received api request [${apiName}]`);
                switch (apiName) {
                    case "get_status":
                        try {
                            let gameUid = this.getGameUid(this.params.openIdTicket);
                            this.sendResultAsync(res, 200, JSON.stringify(this.getStatus(gameUid)), true);
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "set_mode":
                        try {
                            let newModeParams = await this.getParsedPostData(req);
                            let newMode: parameters.mode | undefined;
                            switch (newModeParams.get("mode")) {
                                case "online":
                                    newMode = parameters.mode.ONLINE;
                                    break;
                                case "local_offline":
                                    newMode = parameters.mode.LOCAL_OFFLINE;
                                    break;
                            }
                            if (newMode == null) {
                                this.sendResultAsync(res, 400, "no mode selected");
                            } else {
                                await this.params.save({ key: "mode", val: newMode });
                                let resultText = `updated mode`;
                                console.log(resultText);
                                this.sendResultAsync(res, 200, resultText);
                            }
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
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
                    case "upload_params":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string') throw new Error("postData is string");
                            let uploaded_params = postData.find((item) => item.name === "uploaded_params");
                            if (!uploaded_params?.filename?.match(/\.json$/i)) throw new Error("filename not ended with .json");
                            let newParamStr: string | undefined = uploaded_params.data.toString();
                            if (newParamStr === "") newParamStr = undefined;
                            if (newParamStr == null) throw new Error("nothing uploaded");
                            await this.params.save(newParamStr);
                            this.sendResultAsync(res, 200, "saved new params");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "upload_upstream_proxy_cacert":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string') throw new Error("postData is string");
                            let upstream_proxy_cacert = postData.find((item) => item.name === "upstream_proxy_cacert");
                            if (
                                upstream_proxy_cacert != null
                                && upstream_proxy_cacert.filename != null
                                && upstream_proxy_cacert.filename !== ""
                                && !upstream_proxy_cacert.filename.match(/\.(pem|crt)$/i)
                            ) throw new Error("filename not ended with .pem or .crt");
                            let newCACert: string | undefined = upstream_proxy_cacert?.data.toString();
                            if (newCACert === "") newCACert = undefined;
                            await this.params.save({ key: "upstreamProxyCACert", val: newCACert });
                            let msg = newCACert != null ? "saved upstreamProxyCACert" : "cleared upstreamProxyCACert";
                            console.log(msg);
                            this.sendResultAsync(res, 200, msg);
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
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
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "set_auto_open_web":
                        try {
                            let autoOpenWebParams = await this.getParsedPostData(req);
                            let newAutoOpenWeb = autoOpenWebParams.get("auto_open_web") != null;
                            await this.params.save({ key: "autoOpenWeb", val: newAutoOpenWeb });
                            let resultText = "sucessfully updated auto open web settings";
                            console.log(resultText);
                            this.sendResultAsync(res, 200, resultText);
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "pwdlogin":
                        try {
                            let pwdLoginParams = await this.getParsedPostData(req);
                            let username = pwdLoginParams.get("username");
                            let password = pwdLoginParams.get("password");
                            if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                                this.sendResultAsync(res, 403, "cannot do bilibili login in local offline mode");
                            } else if (username == null || password == null || username === "" || password === "") {
                                let result = "username or password is empty";
                                console.error(result);
                                this.sendResultAsync(res, 400, result);
                            } else {
                                let result = await this.bsgamesdkPwdAuth.login(username, password);
                                let resultText = JSON.stringify(result);
                                this.sendResultAsync(res, 200, resultText);
                            }
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "dump_userdata":
                        try {
                            const dumpDataParams = await this.getParsedPostData(req); // finish receiving first
                            const requestingNewDownload = dumpDataParams.get("new") != null;
                            const fetchCharaEnhancementTree = dumpDataParams.get("fetch_chara_enhance_tree") != null;
                            const concurrent = dumpDataParams.get("concurrent") != null;
                            await this.params.save([
                                { key: "fetchCharaEnhancementTree", val: fetchCharaEnhancementTree },
                                { key: "concurrent", val: concurrent }
                            ]);

                            const lastSnapshot = this.userdataDmp.lastSnapshot;
                            const alreadyDownloaded = lastSnapshot != null;
                            const lastError = this.userdataDmp.lastError;
                            const hasDownloadResultOrError = alreadyDownloaded || lastError != null;
                            const isDownloading = this.userdataDmp.isDownloading;
                            if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                                this.sendResultAsync(res, 403, "cannot dump userdata in local offline mode");
                            } else if (!isDownloading && (requestingNewDownload || !hasDownloadResultOrError)) {
                                this.userdataDmp.getSnapshotAsync()
                                    .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                this.sendResultAsync(res, 200, "downloading");
                            } else {
                                if (alreadyDownloaded) {
                                    this.sendResultAsync(res, 200, "download is already completed");
                                } else if (isDownloading) {
                                    this.sendResultAsync(res, 429, `download not yet finished\n${this.userdataDmp.fetchStatus}`);
                                } else {
                                    this.sendResultAsync(res, 500, `error ${lastError instanceof Error ? lastError.message : ""}`);
                                }
                            }
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "clear_bilibili_login":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "bsgamesdkResponse", val: undefined });
                            this.sendResultAsync(res, 200, "cleared bilibili login status");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "clear_bsgamesdk_ids":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "bsgamesdkResponse", val: undefined });
                            this.sendResultAsync(res, 200, "cleared bilibili login status");
                            await this.params.save({ key: "bsgamesdkIDs", val: undefined });
                            this.sendResultAsync(res, 200, "cleared bilibili devices ids");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "clear_game_login":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "openIdTicket", val: undefined });
                            this.sendResultAsync(res, 200, "cleared game login status");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "clear_magireco_ids":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "openIdTicket", val: undefined });
                            this.sendResultAsync(res, 200, "cleared game login status");
                            await this.params.save({ key: "magirecoIDs", val: undefined });
                            this.sendResultAsync(res, 200, "cleared magireco devices ids");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "crawl_static_data":
                        if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                            this.sendResultAsync(res, 403, "cannot crawl in local offline mode");
                        } else if (this.crawler.isCrawling) {
                            this.sendResultAsync(res, 429, "crawling not yet finished");
                        } else if (this.crawler.isFscking) {
                            this.sendResultAsync(res, 429, "is still fscking");
                        } else {
                            try {
                                let crawlingParams = await this.getParsedPostData(req);
                                let crawlWebRes = crawlingParams.get("crawl_web_res") != null;
                                let crawlAssets = crawlingParams.get("crawl_assets") != null;
                                if (!crawlWebRes && !crawlAssets) {
                                    this.sendResultAsync(res, 400, "must crawl at least one part");
                                } else {
                                    await this.params.save([
                                        { key: "crawlWebRes", val: crawlWebRes },
                                        { key: "crawlAssets", val: crawlAssets },
                                    ]);
                                    this.crawler.fetchAllAsync()
                                        .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                    this.sendResultAsync(res, 200, "crawling started");
                                }
                            } catch (e) {
                                console.error(`${apiName} error`, e);
                                this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                            }
                        }
                        return;
                    case "stop_crawling":
                        try {
                            await this.getParsedPostData(req);
                            this.crawler.stopCrawling = true;
                            this.sendResultAsync(res, 200, "stop crawling");
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "fsck":
                        try {
                            await this.getParsedPostData(req);
                            if (this.crawler.isCrawling) {
                                this.sendResultAsync(res, 429, "is still crawling");
                            } else if (this.crawler.isFscking) {
                                this.sendResultAsync(res, 429, "is already fscking");
                            } else {
                                this.crawler.fsck()
                                    .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                this.sendResultAsync(res, 200, "started fsck");
                            }
                        } catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
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
                    res.writeHead(200, {
                        ["Content-Type"]: "application/x-x509-ca-cert",
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
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
                    res.writeHead(200, {
                        ["Content-Type"]: "application/x-yaml",
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
                    res.end(this.params.clashYaml);
                    return;
                case "/params.json":
                    console.log(`servering params.json`);
                    res.writeHead(200, {
                        ["Content-Type"]: "application/json; charset=utf-8",
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
                    res.end(this.params.stringify());
                    return;
            }

            if (req.url.match(this.userdataDmp.userdataDumpFileNameRegEx)) {
                console.log(`serving ${req.url}`);
                let snapshot = this.userdataDmp.lastSnapshot;
                if (snapshot != null) {
                    let algo: string | null | undefined;
                    let acceptEncodings = req.headers["accept-encoding"];
                    if (acceptEncodings != null && acceptEncodings.length > 0) {
                        acceptEncodings = typeof acceptEncodings === 'string' ? acceptEncodings.split(",") : acceptEncodings;
                        let algos = acceptEncodings.map((item) => item.match(/(?<=^\s*)(br|gzip|deflate)(?=(\s|;|$))/))
                            .map((item) => item && item[0]).filter((item) => item != null).sort();
                        algo = algos.find((item) => item != null);
                    }
                    const userdataDumpFileName = this.userdataDmp.userdataDumpFileName;
                    let headers: http.OutgoingHttpHeaders = {
                        ["Content-Type"]: "application/json; charset=utf-8",
                        ["Content-Disposition"]: `attachment; filename=\"${userdataDumpFileName}\"`,
                    }
                    let pipelineList: Array<stream.Readable | stream.Writable>;

                    let lastSnapshotBr = this.userdataDmp.lastSnapshotBr;
                    if (lastSnapshotBr != null) {
                        let fromCompressed = stream.Readable.from(lastSnapshotBr);
                        pipelineList = [fromCompressed];
                        let decompressor = zlib.createBrotliDecompress();
                        pipelineList.push(decompressor);
                    } else {
                        console.log(`(should never go here!) stringifying object to [${userdataDumpFileName}] ...`);
                        let stringified = JSON.stringify(snapshot, parameters.replacer);
                        console.log(`stringified object to [${userdataDumpFileName}]. creating buffer...`);
                        let stringifiedBuf = Buffer.from(stringified, 'utf-8');
                        console.log(`created buffer for [${userdataDumpFileName}], sending it`);
                        let fromStringified = stream.Readable.from(stringifiedBuf);
                        pipelineList = [fromStringified];
                    }

                    pipelineList.push(res);

                    res.writeHead(200, headers);
                    let doneCallback = (err: NodeJS.ErrnoException | null) => {
                        if (err != null) console.error(`error sending ${userdataDumpFileName}`, err);
                        else console.log(`finished sending ${userdataDumpFileName}`);
                    }
                    stream.pipeline(pipelineList, doneCallback);
                    return;
                } else {
                    this.sendResultAsync(res, 404, "has not yet downloaded");
                    return;
                }
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
        this.crawler = crawler;
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
    private getPostData(req: http.IncomingMessage): Promise<string | Array<{ filename?: string, name?: string, type?: string, data: Buffer }>> {
        return new Promise((resolve, reject) => {
            const method = req.method;
            if (!method?.match(/^POST$/i)) reject(Error(`method=${method} is not POST`));
            else {
                req.on('error', (err) => reject(err));
                const postDataArray: Array<Buffer> = [];
                req.on('data', (chunk) => postDataArray.push(chunk as Buffer));
                req.on('end', () => {
                    const postData = Buffer.concat(postDataArray);
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
        const termuxURL = new URL("https://termux.dev/")
        const autoBattleURL = new URL("https://www.bilibili.com/video/BV1nf4y1y713");
        const nodeJsUrl = new URL("https://nodejs.org/zh-cn/download/current/");
        const npmRepoUrl = new URL("https://www.npmjs.com/package/magireco-cn-local-server");

        const aHref = (text: string, url: string, newTab = true) => `<a target=\"${newTab ? "_blank" : "_self"}\" href=${url}>${text}</a>`

        const isOnlineMode = this.params.mode === parameters.mode.ONLINE;
        const isLocalOfflineMode = this.params.mode === parameters.mode.LOCAL_OFFLINE;

        const autoOpenWeb = this.params.autoOpenWeb;
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

        let loginStatus = `B站账户未登录`, loginStatusStyle = "color: red", loginBtnText = "登录";
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            let since: number | string | undefined = bsgamesdkResponse.timestamp;
            if (since != null) {
                since = Number(since);
                since = `${new Date(since).toLocaleDateString()} ${new Date(since).toLocaleTimeString()}`;
            }
            let expires: number | string | undefined = bsgamesdkResponse.expires;
            if (expires != null) expires = `${new Date(expires).toLocaleDateString()} ${new Date(expires).toLocaleTimeString()}`;
            loginStatus = getStrRep(`B站账户已登录 账户=[${bsgamesdkResponse.uname}] uid=[${bsgamesdkResponse.uid}]`
                + ` 实名=[${bsgamesdkResponse.auth_name}] 实名认证状态=[${bsgamesdkResponse.realname_verified}]`
                + ` 登录时间=[${since}] 登录过期时间=[${expires}]`);
            loginStatusStyle = "color: green";
            loginBtnText = "重新登录";
        }

        let openIdTicketStatus: string, openIdTicketStatusStyle = "color: red";
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            openIdTicketStatus = "游戏未登录（将自动使用B站账号登录）"
        } else {
            openIdTicketStatus = "游戏未登录（请先登录B站账号）";
        }
        const openIdTicket = this.params.openIdTicket;
        let gameUid: number | undefined;
        if (
            openIdTicket != null
            && openIdTicket.open_id != null && openIdTicket.open_id !== ""
            && openIdTicket.ticket != null && openIdTicket.ticket !== ""
        ) {
            let since: number | string | undefined = openIdTicket.timestamp;
            if (since != null) {
                since = Number(since);
                since = `${new Date(since).toLocaleDateString()} ${new Date(since).toLocaleTimeString()}`;
            }
            const uname = openIdTicket.uname;
            const open_id = openIdTicket.open_id;
            const uid = this.getGameUid(openIdTicket);
            gameUid = uid;
            let inconsistent = bsgamesdkResponse?.uid !== uid;
            openIdTicketStatus = `${inconsistent ? "游戏账户与B站不一致" : "游戏已登录"}`;
            if (uname == null) openIdTicketStatus += " 账户未知";
            else openIdTicketStatus += ` 账户=[${uname}]`;
            openIdTicketStatus += ` uid=[${uid}]`;
            openIdTicketStatus += ` 登录时间=[${since}]`;
            openIdTicketStatusStyle = `color: ${inconsistent ? "red" : "green"}`;
        }
        openIdTicketStatus = getStrRep(openIdTicketStatus);

        let upstreamProxyCACertStatus = "未上传", upstreamProxyCACertStyle = "color: red";
        if (this.params.upstreamProxyCACert != null) {
            upstreamProxyCACertStatus = "已上传";
            upstreamProxyCACertStyle = "color: green";
        }

        const status = this.getStatus(gameUid);
        const isDownloading = status.isDownloading;
        const userdataDumpStatus = status.userdataDumpStatus;
        const userdataDumpStatusStyle = status.userdataDumpStatusStyle
        const isCrawling = status.isCrawling;
        const crawlingStatus = status.crawlingStatus;
        const crawlingStatusStyle = status.crawlingStatusStyle;
        const fsckResult = status.fsckResult;
        const fsckResultStyle = status.fsckResultStyle;
        const isFscking = status.isFscking;

        const crawlWebRes = this.params.crawlWebRes;
        const crawlAssets = this.params.crawlAssets;
        const isWebResCompleted = this.crawler.isWebResCompleted;
        const isAssetsCompleted = this.crawler.isAssetsCompleted;

        const bsgamesdkIDs = this.params.bsgamesdkIDs;
        const bd_id = bsgamesdkIDs.bd_id, buvid = bsgamesdkIDs.buvid, udid = bsgamesdkIDs.udid;
        const magirecoIDs = this.params.magirecoIDs;
        const device_id = magirecoIDs.device_id;

        const html = "<!doctype html>"
            + `\n<html>`
            + `\n<head>`
            + `\n  <meta charset =\"utf-8\">`
            + `\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>`
            + `\n  <title>Magireco CN Local Server</title>`
            + `\n  <script>`
            + `\n    window.addEventListener('pageshow', (ev) => {`
            + `\n      if (ev.persisted||(window.performance!=null&&window.performance.navigation.type===2)) {`
            + `\n        window.location.reload(true);/*refresh on back or forward*/`
            + `\n      }`
            + `\n    });`
            + `\n    function autoRefresh() {`
            + `\n      if (isDownloading) {`
            + `\n        window.location.reload(true);`
            + `\n      }`
            + `\n    }`
            + `\n    var verboseDescHtml = \"${aHref("（点击显示设置说明，即让游戏客户端连接到本地服务器而不是直连官服）", "javascript:swapVerboseDesc();", false).replace(/"/g, "\\\"")}\";`
            + `\n    function swapVerboseDesc() {`
            + `\n      let el = document.getElementById(\"verbosedesc\"); let innerHTML = el.innerHTML;`
            + `\n      el.innerHTML = verboseDescHtml; verboseDescHtml = innerHTML;`
            + `\n    }`
            + `\n    window.addEventListener('load', (ev) => {`
            + `\n      swapVerboseDesc();`
            + `\n      document.getElementById(\"loginstatus\").textContent = \"${loginStatus}\";`
            + `\n      document.getElementById(\"openidticketstatus\").textContent = \"${openIdTicketStatus}\";`
            + `\n      let initialCountdown = ${isDownloading || isCrawling || isFscking ? "20" : "0"};`
            + `\n      async function autoRefresh(countdown) {`
            + `\n          let status = {isDownloading: true, isCrawling: true, isFscking: true};`
            + `\n          try {`
            + `\n              status = await (await fetch(new URL(\"/api/get_status\", document.baseURI))).json();`
            + `\n              countdown = initialCountdown;`
            + `\n          } catch (e) {`
            + `\n              console.error(e);`
            + `\n          }`
            + `\n          set_mode_btn.disabled = status.isDownloading || status.isCrawling;`
            + `\n          let isOfflineMode = status.mode == ${parameters.mode.LOCAL_OFFLINE};`
            + `\n          isOffline(isOfflineMode);`
            + `\n          let el = document.getElementById(\"userdatadumpstatus\");`
            + `\n          el.textContent = status.userdataDumpStatus; el.style = status.userdataDumpStatusStyle;`
            + `\n          document.getElementById(\"prepare_download_btn\").disabled = isOfflineMode || status.isDownloading;`
            + `\n          el = document.getElementById(\"crawlingstatus\");`
            + `\n          el.textContent = status.crawlingStatus; el.style = status.crawlingStatusStyle;`
            + `\n          document.getElementById(\"crawl_static_data_btn\").disabled = isOfflineMode || status.isCrawling;`
            + `\n          document.getElementById(\"stop_crawling_btn\").disabled = isOfflineMode || !status.isCrawling;`
            + `\n          el = document.getElementById(\"crawl_web_res_lbl\")`
            + `\n          el.textContent = status.isWebResCompleted ? \"已完成下载\" : \"未完成下载\"; el.style = status.isWebResCompleted ? \"color: green\" : \"\";`
            + `\n          el = document.getElementById(\"crawl_assets_lbl\");`
            + `\n          el.textContent = status.isAssetsCompleted ? \"已完成下载\" : \"未完成下载\";el.style = status.isAssetsCompleted ? \"color: green\": \"\"`
            + `\n          el = document.getElementById(\"fsckresult\");`
            + `\n          el.textContent = status.fsckResult; el.style = status.fsckResultStyle;`
            + `\n          document.getElementById(\"fsck_btn\").disabled = status.isFscking;`
            + `\n          if (countdown > 0 && (status.isDownloading || status.isCrawling || status.isFscking)) setTimeout(() => autoRefresh(--countdown), 500);`
            + `\n      }`
            + `\n      autoRefresh(initialCountdown);`
            + `\n    });`
            + `\n    function isOffline(isOfflineMode) {`
            + `\n      let modeElments = document.getElementsByName("mode");`
            + `\n      for (let i = 0; i < modeElments.length; i++) {`
            + `\n        let el = modeElments[i];`
            + `\n        if (isOfflineMode == null) {`
            + `\n          if (el.value === \"online\" && el.checked) isOfflineMode = false;`
            + `\n          if (el.value === \"local_offline\" && el.checked) isOfflineMode = true;`
            + `\n        } else {`
            + `\n          if (el.value === \"online\") el.checked = !isOfflineMode;`
            + `\n          if (el.value === \"local_offline\") el.checked = isOfflineMode;`
            + `\n          const btnids = [\"loginbtn\", \"prepare_download_btn\", \"crawl_static_data_btn\", \"stop_crawling_btn\"];`
            + `\n          btnids.forEach((id) => {`
            + `\n            let el = document.getElementById(id);`
            + `\n            el.value = el.value.replace(/^((?!本地离线模式下无法)|本地离线模式下无法)/, isOfflineMode ? \"本地离线模式下无法\" : \"\");`
            + `\n            el.disabled = isOfflineMode;`
            + `\n          });`
            + `\n        }`
            + `\n      }`
            + `\n      return isOfflineMode;`
            + `\n    }`
            + `\n    function unlock_prepare_download_btn() {`
            + `\n      if (!isOffline()) document.getElementById(\"prepare_download_btn\").removeAttribute(\"disabled\");`
            + `\n    }`
            + `\n  </script>`
            + `\n  <style>`
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
            + `\n  <fieldset>`
            + `\n  <legend>HTTP代理</legend>`
            + `\n  <div>`
            + `\n    <label for=\"httpproxyaddr\">HTTP代理监听地址</label>`
            + `\n    <input readonly id=\"httpproxyaddr\" value=\"${httpProxyAddr}\">`
            + `\n  </div>`
            + `\n  <div>`
            + `\n    <label for=\"httpproxyport\">HTTP代理监听端口</label>`
            + `\n    <input readonly id=\"httpproxyport\" value=\"${httpProxyPort}\">`
            + `\n  </div>`
            + `\n  <div>`
            + `\n  <ul>`
            + `\n  <li>`
            + `\n    若要${aHref("从官服下载个人账号数据", "#dumpuserdata", false)}，可以使用下面的${aHref("Bilibili登录", "#bilibilipwdauth", false)}界面，也可以使用Clash让游戏客户端通过上述HTTP代理联网；`
            + `\n  </li>`
            + `\n  <li>`
            + `\n    或者修改${aHref("工作模式", "#setmode", false)}后，使用Clash让游戏客户端通过上述HTTP代理联网即可成为脱离官服的本地离线服务器。`
            + `\n  </li>`
            + `\n  </ul>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>下载CA证书</legend>`
            + `\n  <div>`
            + `\n    ${aHref("ca.crt", "/ca.crt")}`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>下载Clash配置文件</legend>`
            + `\n  <div>`
            + `\n    ${aHref("magirecolocal.yaml", "/magirecolocal.yaml")}`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>下载配置数据</legend>`
            + `\n  <div>`
            + `\n    <label for=\"paramsjson\"><b style=\"color: red\">（含有登录密钥等敏感数据，请勿分享）</b></label>`
            + `\n    ${aHref("params.json", "/params.json")}`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>上传配置数据</legend>`
            + `\n  <form enctype=\"multipart/form-data\" action=\"/api/upload_params\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"file\" name=\"uploaded_params\" id=\"params_file\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"上传配置数据\" id=\"upload_params_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2>说明</h2>`
            + `\n  <ol>`
            + `\n  <li>`
            + `\n  在国服尚未关服的情况下，这里提供的${aHref("Bilibili登录", "#bilibilipwdauth", false)}界面可以在无需游戏客户端的情况下登录游戏账号。`
            + `\n  <br>但这只是快捷省事的途径，不一定可靠。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  登录后即可${aHref("下载保存个人游戏账号数据", "#dumpuserdata", false)}，包括你拥有的魔法少女列表、记忆结晶列表、好友列表、以及最近的获得履历等等。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  另外，让${aHref("游戏客户端", officialURL.href)}通过上述HTTP代理设置连接服务器时（也就是通过这个本地服务器进行中转），即会自动从游戏通信内容中抓取到登录信息，然后刷新这个页面即可看到登录状态变为绿色“已登录”。`
            + `\n  <br>接着就同样可以利用抓取到的登录信息来下载保存个人账号数据。`
            + `\n  </li>`
            + `\n  <li id=\"verbosedesc\">`
            + `\n  ${aHref("（点击隐藏详细设置说明，即让游戏客户端连接到本地服务器而不是直连官服）", "javascript:swapVerboseDesc();", false)}`
            + `\n    <ul>`
            + `\n      <li>`
            + `\n        比如电脑上用${aHref("最新版NodeJS", nodeJsUrl.href)}直接跑${aHref("这个本地服务器", npmRepoUrl.href)}、用Android模拟器跑${aHref("游戏客户端", officialURL.href)}和${aHref("Clash for Android", clashURL.href)}，`
            + `\n        <br>然后用<code>adb -e reverse tcp:${httpProxyPort} tcp:${httpProxyPort}</code>命令设置端口映射来让模拟器里的Clash能连到外边；`
            + `\n        <br>CA证书也安装在（跑着游戏客户端和Clash的）Android模拟器里；`
            + `\n        <br>（<code>adb</code>的<code>-e</code>参数指定连接至模拟器而不是真机；<code>-d</code>则反之。若有多个设备/模拟器则可用<code>-t</code>指定<code>adb devices -l</code>列出的transport_id编号，比如<code>-t 2</code>）`
            + `\n      </li><li>`
            + `\n        或是在Android真机上用${aHref("Termux", termuxURL.href)}跑这个本地服务器，`
            + `\n        <br>然后用类似${aHref("光速", gsxnjURL.href)}之类虚拟机来跑${aHref("游戏客户端", officialURL.href)}，`
            + `\n        <br>并在虚拟机内安装CA证书。`
            + `\n        <br>Clash则直接跑在真机上，然后需要设置Clash分流来<b>只让跑着游戏客户端的虚拟机App走代理，不能让跑着本地服务器的Termux也走代理</b>，`
            + `\n        <br>也就是在Clash的[网络]=>[访问控制模式]中选择<b>[仅允许已选择的应用]</b>，然后在[访问控制应用包列表]中<b>只勾选虚拟机App</b>（虚拟机里跑着游戏客户端以及下文提到的autoBattle脚本）。`
            + `\n        <br><i>（否则很显然，本地服务器转发到游戏官服时又被Clash拦截送回本地服务器，这样网络通信就“死循环”了）</i>`
            + `\n      </li><li>`
            + `\n        <b>注意Clash第一次启动后需要设置一下代理模式</b>，否则默认是DIRECT直连。`
            + `\n      </li><li>`
            + `\n        必须在Clash设置中启用<b>[DNS劫持]</b>。`
            + `\n      </li><li>`
            + `\n        <b>CA证书必须安装为Android的系统证书</b>`
            + `\n        <br><i>（必须<b>Root权限</b>，所以对于获取Root权限不便的真机，需要在虚拟机内安装游戏客户端；而虚拟机内可能不支持运行Clash，故Clash需要跑在虚拟机外）。</i>`
            + `\n        <br>安装CA证书这一步可以用${aHref("autoBattle脚本", autoBattleURL.href)}（安装后请先下拉在线更新到最新版）选择运行[安装CA证书]这个脚本自动完成。`
            + `\n      </li><li>`
            + `\n        另外提醒一下：Android 6的MuMu模拟器等环境下，Clash for Android似乎不能正常按应用分流，所以不能在MuMu模拟器里再安装Termux、然后用Termux跑本地服务器，否则会出现上述网络通信“死循环”问题。<b>使用MuMu模拟器时也应该按照上述方法，在模拟器外直接在电脑上跑本地服务器。</b>`
            + `\n      </li><li>`
            + `\n        Android 9或以上的新版MuMu模拟器，建议如上述方式修改Clash设置，只让游戏客户端通过Clash联网，并启用[绕过私有网络]和[DNS劫持]。`
            + `\n      </li>`
            + `\n    </ul>`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  本地离线模式<b>必须</b>先${aHref("从官服下载静态资源", "#crawlstaticdata", false)}才能正常提供服务。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  本地离线模式只支持通过<b>用户名密码登录</b>，功能目前暂时只有<b>首页</b>和<b>档案</b>两个；`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  本地离线模式下，在游戏客户端中输入任意非空用户名密码均可照常登录到离线服务器。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  目前暂时<b>只有之前下载过个人账号数据的情况下才能正常登录到离线服务器</b>。`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  <b>必须切换到在线模式才能下载个人账号数据，本地离线模式下无法从官服下载个人账号数据。</b>`
            + `\n  </li>`
            + `\n  </ol>`
            + `\n  <hr>`
            + `\n  <h2>设置</h2>`
            + `\n  <fieldset id=\"setmode\">`
            + `\n  <legend>工作模式</legend>`
            + `\n  <form action=\"/api/set_mode\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input ${isOnlineMode ? "checked" : ""} type=\"radio\" id=\"mode_radio1\" name=\"mode\" value=\"online\">`
            + `\n      <label for=\"mode_radio1\">在线模式</label>`
            + `\n      <input ${isLocalOfflineMode ? "checked" : ""} type=\"radio\" id=\"mode_radio2\" name=\"mode\" value=\"local_offline\">`
            + `\n      <label for=\"mode_radio2\">本地离线模式</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"应用\" id=\"set_mode_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>上游代理</legend>`
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
            + `\n      <input id=\"upstream_proxy_enabled\" name=\"upstream_proxy_enabled\" value=\"true\" type=\"checkbox\" ${upstreamProxyEnabled ? "checked" : ""}>`
            + `\n      <label for=\"upstream_proxy_enabled\">启用上游代理</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"修改上游代理设置\" id=\"set_upstream_proxy_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>上游代理CA证书</legend>`
            + `\n  <form enctype=\"multipart/form-data\" action=\"/api/upload_upstream_proxy_cacert\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"file\" name=\"upstream_proxy_cacert\" id=\"upstream_proxy_cacert\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"上传/清除上游代理CA证书(PEM格式)\" id=\"upload_upstream_proxy_cacert_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn1\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label style=\"${upstreamProxyCACertStyle}\" id=\"upstream_proxy_ca_status\" for=\"refreshbtn1\">${upstreamProxyCACertStatus}</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>启动时自动打开浏览器</legend>`
            + `\n  <form action=\"/api/set_auto_open_web\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"auto_open_web\" name=\"auto_open_web\" value=\"true\" type=\"checkbox\" ${autoOpenWeb ? "checked" : ""}>`
            + `\n      <label for=\"auto_open_web\">启动时自动打开浏览器</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"set_auto_open_web_btn\" value=\"应用\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"bilibilipwdauth\">Bilibili登录</h2>`
            + `\n  <i>下面这个登录界面只是快捷省事的途径，不一定可靠。</i><br>`
            + `\n  <b>如果你不记得密码，强烈建议不要反复试错，以免触发这里无法应对的二次验证。</b>可以直接<b>重置密码</b>，或者尝试上述让游戏走代理这个折腾的办法。<br>`
            + `\n  <fieldset>`
            + `\n  <legend>登录状态</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn2\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label style=\"${loginStatusStyle}\" id=\"loginstatus\" for=\"refreshbtn2\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>用户名密码登录</legend>`
            + `\n  <form action=\"/api/pwdlogin\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"username\">账户</label>`
            + `\n      <input name=\"username\" id=\"username\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"password\">密码</label>`
            + `\n      <input name=\"password\" id=\"password\" type=\"password\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"loginbtn\" value=\"${loginBtnText}\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>清除登录状态</legend>`
            + `\n  <form action=\"/api/clear_bilibili_login\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_bilibili_login_btn\" value=\"清除B站登录状态\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/clear_bsgamesdk_ids\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_bsgamesdk_ids_btn\" value=\"清除B站登录状态并重置设备ID\">`
            + `\n      <br><code>bd_id=[${bd_id}]</code>`
            + `\n      <br><code>buvid=[${buvid}]</code>`
            + `\n      <br><code>udid=[${udid}]</code>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"dumpuserdata\">下载个人账号数据</h2>`
            + `\n  <fieldset>`
            + `\n  <legend>登录状态</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn3\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label style=\"${openIdTicketStatusStyle}\" id=\"openidticketstatus\" for=\"refreshbtn3\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>下载选项</legend>`
            + `\n  <form action=\"/api/dump_userdata\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"fetch_chara_enhance_tree_checkbox\" name=\"fetch_chara_enhance_tree\" value=\"true\" type=\"checkbox\" ${this.params.fetchCharaEnhancementTree ? "checked" : ""}>`
            + `\n      <label for=\"fetch_chara_enhance_tree_checkbox\">下载（官方未开放的）精神强化数据</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"concurrent_checkbox\" name=\"concurrent\" value=\"true\" type=\"checkbox\" ${this.params.concurrentFetch ? "checked" : ""}>`
            + `\n      <label for=\"concurrent_checkbox\">开启并行下载</label>`
            + `\n    </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>开始下载</legend>`
            + `\n    <div>`
            + `\n      <input id=\"new_download_checkbox\" name=\"new\" value=\"true\" type=\"checkbox\" ${this.userdataDmp.lastError != null ? "checked" : ""}>`
            + `\n      <label for=\"new_download_checkbox\" onclick=\"unlock_prepare_download_btn();\">重新从官服下载</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" ${isDownloading ? "disabled" : ""} value=\"从官服下载\" id=\"prepare_download_btn\">`
            + `\n      <br><i>从官服下载个人账号数据数据到本地服务器需要大约几分钟时间。下载完成后，下面会给出文件保存链接。</i>`
            + `\n      <br><i>请不要反复从官服下载，避免给官服增加压力。</i>`
            + `\n      <br><b style=\"color: red\">因为可能含有隐私敏感数据，请勿分享下载到的个人数据。</b>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>下载进度</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn4\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label id=\"userdatadumpstatus\" style=\"${userdataDumpStatusStyle}\" for=\"refreshbtn4\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>清除登录状态</legend>`
            + `\n  <form action=\"/api/clear_game_login\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_game_login_btn\" value=\"清除游戏登录状态\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/clear_magireco_ids\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_magireco_ids_btn\" value=\"清除游戏登录状态并重置设备ID\">`
            + `\n      <br><code>device_id=[${device_id}]</code>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>${this.userdataDmp.lastSnapshot == null ? "尚未下载，无链接可显示" : "将下载到的数据另存为文件"}</legend>`
            + `\n    ${this.userdataDmp.lastSnapshot == null ? "" : "<b>↓点击下面的链接即可下载↓</b>"}`
            + `\n    ${this.userdataDmp.lastSnapshot == null ? "" : "<br>" + aHref(this.userdataDmp.userdataDumpFileName, `/${this.userdataDmp.userdataDumpFileName}`)}`
            + `\n    ${this.userdataDmp.lastSnapshot == null ? "" : "<br><i>在某品牌手机上，曾经观察到第一次下载回来是0字节空文件的问题，如果碰到这个问题可以再次点击或长按链接重试下载，或者换个浏览器试试。</i>"}`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"crawlstaticdata\">爬取游戏静态资源文件</h2>`
            + `\n  <fieldset>`
            + `\n  <legend>爬取进度</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn5\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label id=\"crawlingstatus\" style=\"${crawlingStatusStyle}\" for=\"refreshbtn5\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>控制</legend>`
            + `\n  <form action=\"/api/crawl_static_data\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"crawl_web_res\" name=\"crawl_web_res\" value=\"true\" type=\"checkbox\" ${crawlWebRes ? "checked" : ""}>`
            + `\n      <label for=\"crawl_web_res\">下载Web资源（<b id=\"crawl_web_res_lbl\">TO_BE_FILLED_BY_JAVASCRIPT</b>，此部分在停止后不能恢复上次进度）</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"crawl_assets\" name=\"crawl_assets\" value=\"true\" type=\"checkbox\" ${crawlAssets ? "checked" : ""}>`
            + `\n      <label for=\"crawl_assets\">下载本地资源（<b id=\"crawl_assets_lbl\">TO_BE_FILLED_BY_JAVASCRIPT</b>，此部分可自动恢复上次进度）</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"crawl_static_data_btn\" ${isCrawling ? "disabled" : ""} value=\"开始爬取\">`
            + `\n      <br><i>请不要反复从官服下载，避免给官服增加压力。</i>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/stop_crawling\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"stop_crawling_btn\" ${isCrawling ? "" : "disabled"} value=\"停止爬取\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>检查文件完整性</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn6\" onclick=\"window.location.reload(true);\">刷新</button>`
            + `\n    <label id=\"fsckresult\" style=\"${fsckResultStyle}\" for=\"refreshbtn6\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  <form action=\"/api/fsck\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"fsck_btn\" ${isFscking ? "" : "disabled"} value=\"开始检查\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
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

    private getGameUid(openIdTicket?: userdataDump.openIdTicket): number | undefined {
        const open_id = openIdTicket?.open_id;
        const uidMatched = open_id?.match(/\d+$/);
        return uidMatched != null && !isNaN(Number(uidMatched[0])) ? (Number(uidMatched[0])) : undefined;
    }

    private getStatus(gameUid: number | undefined): {
        mode: parameters.mode,
        isDownloading: boolean,
        userdataDumpStatus: string,
        userdataDumpStatusStyle: string,
        isCrawling: boolean,
        crawlingStatus: string,
        crawlingStatusStyle: string,
        isFscking: boolean,
        fsckResult: string,
        fsckResultStyle: string,
        isWebResCompleted: boolean,
        isAssetsCompleted: boolean,
    } {
        let userdataDumpStatus = "尚未开始从官服下载", userdataDumpStatusStyle = "color: red";;
        const isDownloading = this.userdataDmp.isDownloading;
        const lastSnapshot = this.userdataDmp.lastSnapshot;
        if (isDownloading) userdataDumpStatus = `从官服下载中 ${this.userdataDmp.fetchStatus}`, userdataDumpStatusStyle = "color: blue";
        else if (lastSnapshot != null) {
            const lastUid = lastSnapshot.uid;
            if (lastUid != null && lastUid === gameUid) {
                userdataDumpStatus = "从官服下载数据完毕", userdataDumpStatusStyle = "color: green";
            } else {
                userdataDumpStatus = `从官服下载数据完毕（uid=[${lastUid}]，不属于当前登录账号uid=[${gameUid}]）`, userdataDumpStatusStyle = "color: orange";
            }
        } else if (this.userdataDmp.lastError != null) userdataDumpStatus = `从官服下载数据过程中出错  ${this.userdataDmp.fetchStatus}`, userdataDumpStatusStyle = "color: red";

        let crawlingStatus = this.crawler.crawlingStatus, crawlingStatusStyle = "color: grey";
        const isCrawling = this.crawler.isCrawling;
        if (this.crawler.isCrawlingFullyCompleted) {
            crawlingStatus = "爬取已成功完成";
            crawlingStatusStyle = "color: green";
        } else if (this.crawler.isCrawling) {
            crawlingStatusStyle = "color: blue";
        } else {
            if (crawlingStatus == null || crawlingStatus === "") {
                crawlingStatus = "本次启动以来尚未开始爬取";
            }
            if (this.crawler.lastError != null) crawlingStatusStyle = "color: red";
        }

        const isFscking = this.crawler.isFscking;
        const fsckResult = this.crawler.lastFsckResult;
        const fsckStatus = this.crawler.fsckStatus;
        const fsckResultStyle = isFscking
            ? "color: blue"
            : fsckStatus == null
                ? "color: grey"
                : fsckStatus.notPassed > 0
                    ? "color: red"
                    : "color: green";

        const isWebResCompleted = this.crawler.isWebResCompleted;
        const isAssetsCompleted = this.crawler.isAssetsCompleted;

        return {
            mode: this.params.mode,
            isDownloading: isDownloading,
            userdataDumpStatus: userdataDumpStatus,
            userdataDumpStatusStyle: userdataDumpStatusStyle,
            isCrawling: isCrawling,
            crawlingStatus: crawlingStatus,
            crawlingStatusStyle: crawlingStatusStyle,
            isFscking: isFscking,
            fsckResult: fsckResult,
            fsckResultStyle: fsckResultStyle,
            isWebResCompleted: isWebResCompleted,
            isAssetsCompleted: isAssetsCompleted,
        }
    }

    private async sendResultAsync(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage },
        statusCode: number, result: string, isJson = false,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!isJson) {
                let strRep = getStrRep(result);
                let html = `<!doctype html>`
                    + `\n<html>`
                    + `\n<head>`
                    + `\n  <meta charset =\"utf-8\">`
                    + `\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>`
                    + `\n  <title>Magireco CN Local Server - API Result</title>`
                    + `\n  <script>`
                    + `\n    window.onload =() => {`
                    + `\n      document.getElementById(\"httpstatus\").textContent = \"${statusCode}\";`
                    + `\n      document.getElementById(\"result\").textContent = \"${strRep}\";`
                    + `\n    };`
                    + `\n  </script>`
                    + `\n  <style>`
                    + `\n    label,input {`
                    + `\n      display:flex;`
                    + `\n      flex-direction:column;`
                    + `\n    }`
                    + `\n  </style>`
                    + `\n</head>`
                    + `\n<body>`
                    + `\n  <label for=\"backbtn\">${statusCode == 200 ? "操作成功，请返回" : "错误"}</label>`
                    + `\n  <button id=\"backbtn\" onclick=\"window.history.back();\">返回 Back</button>`
                    + `\n  <hr>`
                    + `\n  <label for=\"httpstatus\">HTTP Status Code</label>`
                    + `\n  <textarea id=\"httpstatus\" readonly rows=\"1\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                    + `\n  <br>`
                    + `\n  <label for=\"result\">${statusCode == 200 ? "结果 Result" : "错误消息 Error Message"}</label>`
                    + `\n  <textarea id=\"result\" readonly rows=\"20\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                    + `\n</body>`
                    + `\n</html>`
                result = html;
            }
            res.on('error', (err) => { console.error(err); resolve(); }); // prevent crash
            res.writeHead(statusCode, { 'Content-Type': isJson ? 'application/json' : 'text/html' });
            res.end(result, () => resolve());
        });
    }
}