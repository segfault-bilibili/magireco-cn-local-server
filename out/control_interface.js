"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlInterface = void 0;
const stream = require("stream");
const fs = require("fs");
const net = require("net");
const http = require("http");
const process = require("process");
const ChildProcess = require("child_process");
const os = require("os");
const util_1 = require("./util");
const parameters = require("./parameters");
const http_proxy_1 = require("./http_proxy");
const local_server_1 = require("./local_server");
const bsgamesdkPwdAuthenticate = require("./bsgamesdk-pwd-authenticate");
const parse_charset_1 = require("./parse_charset");
const get_str_rep_1 = require("./get_str_rep");
const userdataDump = require("./userdata_dump");
const multipart = require("parse-multipart-data");
const staticResCrawler = require("./static_res_crawler");
const fake_magireco_prod_resp_hook_1 = require("./hooks/fake_magireco_prod_resp_hook");
const save_access_key_hook_1 = require("./hooks/save_access_key_hook");
const save_open_id_ticket_hook_1 = require("./hooks/save_open_id_ticket_hook");
const favicon = require("./favicon");
const zipped_assets_1 = require("./zipped_assets");
class controlInterface {
    constructor(params, serverList, crawler) {
        this.closing = false;
        this.isTogglingLoopbackListen = false;
        const httpPxy = serverList.find((s) => s instanceof http_proxy_1.httpProxy);
        const localsvr = serverList.find((s) => s instanceof local_server_1.localServer);
        const bsgamesdkPwdAuth = new bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth(params, localsvr);
        const userdataDmp = new userdataDump.userdataDmp(params, localsvr);
        const hooks = [
            new save_access_key_hook_1.saveAccessKeyHook(params),
            new save_open_id_ticket_hook_1.saveOpenIdTicketHook(params),
            new fake_magireco_prod_resp_hook_1.fakeMagirecoProdRespHook(params, crawler, userdataDmp),
        ];
        hooks.forEach((hook) => localsvr.addHook(hook));
        const httpServerSelf = http.createServer(async (req, res) => {
            var _a, _b, _c, _d;
            // ---------- 添加 HTTP Basic 认证 ----------
            const auth = req.headers['authorization'];
            const validUser = this.params.httpProxyUsername || 'magireco';
            const validPass = this.params.httpProxyPassword || 'magireco';
            if (!auth) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Magireco Local Server"');
                res.writeHead(401);
                res.end('Authentication required');
                return;
            }
            const base64 = auth.split(' ')[1];
            let user, pass;
            try {
                const decoded = Buffer.from(base64, 'base64').toString();
                [user, pass] = decoded.split(':');
            } catch (e) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Magireco Local Server"');
                res.writeHead(401);
                res.end('Authentication failed');
                return;
            }
            if (user !== validUser || pass !== validPass) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Magireco Local Server"');
                res.writeHead(401);
                res.end('Authentication failed');
                return;
            }
            // -----------------------------------------

            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }
            if (req.url === "/favicon.ico") {
                res.writeHead(200, { ["Content-Type"]: favicon.mimeType });
                res.end(favicon.ico);
                return;
            }
            if (req.url.startsWith("/api/")) {
                const apiName = req.url.replace(/(^\/api\/)|(\?.*$)/g, "");
                if (apiName !== "get_status")
                    console.log(`controlInterface received api request [${apiName}]`);
                switch (apiName) {
                    case `is_alive_${parameters.params.isAliveReqMarker}`:
                        res.writeHead(200, "OK", { ["Content-Type"]: "text/plain" });
                        res.end(`${parameters.params.isAliveRespMarker}`);
                        break;
                    case "get_status":
                        try {
                            let gameUid = this.getGameUid(this.params.openIdTicket);
                            this.sendResultAsync(res, 200, JSON.stringify(this.getStatus(gameUid)), true);
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "toggle_loopback_listen":
                        try {
                            await this.getParsedPostData(req);
                            let listenList = JSON.parse(JSON.stringify(this.params.listenList));
                            let port = listenList.httpProxy.port;
                            let curr = {
                                port: port,
                                host: listenList.httpProxy.host,
                            };
                            let last = {
                                port: port,
                                host: this.params.lastHttpProxy.host,
                            };
                            listenList.httpProxy = last;
                            if (listenList.httpProxy.host === curr.host) {
                                const LOCALHOST = "127.0.0.1", ALL_INTERFACE = "0.0.0.0";
                                switch (listenList.httpProxy.host) {
                                    case LOCALHOST:
                                        listenList.httpProxy.host = ALL_INTERFACE;
                                        break;
                                    case ALL_INTERFACE:
                                        listenList.httpProxy.host = LOCALHOST;
                                        break;
                                }
                            }
                            if (this.isTogglingLoopbackListen) {
                                this.sendResultAsync(res, 429, "last http proxy listen address toggling is still not finished");
                            }
                            else {
                                this.isTogglingLoopbackListen = true;
                                this.sendResultAsync(res, 200, "toggling http proxy listen address");
                                this.params.save([
                                    { key: "lastHttpProxy", val: curr },
                                    { key: "listenList", val: listenList },
                                ]).then(() => httpPxy.restart().then(() => this.isTogglingLoopbackListen = false));
                            }
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "upload_params":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string')
                                throw new Error("postData is string");
                            let uploaded_params = postData.find((item) => item.name === "uploaded_params");
                            if (!((_b = uploaded_params === null || uploaded_params === void 0 ? void 0 : uploaded_params.filename) === null || _b === void 0 ? void 0 : _b.match(/\.json$/i)))
                                throw new Error("filename not ended with .json");
                            let newParamStr = uploaded_params.data.toString();
                            if (newParamStr === "")
                                newParamStr = undefined;
                            if (newParamStr == null)
                                throw new Error("nothing uploaded");
                            await this.params.save(newParamStr);
                            this.sendResultAsync(res, 200, "saved new params");
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "upload_overrides":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string')
                                throw new Error("postData is string");
                            let uploaded_overrides = postData.find((item) => item.name === "uploaded_overrides");
                            if (!((_c = uploaded_overrides === null || uploaded_overrides === void 0 ? void 0 : uploaded_overrides.filename) === null || _c === void 0 ? void 0 : _c.match(/\.json$/i)))
                                throw new Error("filename not ended with .json");
                            let newOverridesStr = uploaded_overrides.data.toString();
                            if (newOverridesStr === "")
                                newOverridesStr = undefined;
                            if (newOverridesStr == null)
                                throw new Error("nothing uploaded");
                            await this.params.saveOverrideDB(newOverridesStr);
                            this.sendResultAsync(res, 200, "saved new overrides");
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    // 上游代理相关API保留（但前端已移除按钮）
                    case "upload_upstream_proxy_cacert":
                    case "set_upstream_proxy":
                        this.sendResultAsync(res, 404, "Upstream proxy feature removed from UI");
                        return;
                    case "upload_dump":
                        try {
                            let postData = await this.getPostData(req);
                            const isDownloading = this.userdataDmp.isDownloading;
                            const isImporting = this.userdataDmp.isImporting;
                            const lastDownloadedFileName = this.params.lastDownloadedFileName;
                            if (isDownloading) {
                                this.sendResultAsync(res, 429, "download not yet finished");
                            }
                            else if (isImporting) {
                                this.sendResultAsync(res, 429, "import not yet finished");
                            }
                            else if (this.userdataDmp.lastDump != null && lastDownloadedFileName !== this.userdataDmp.userdataDumpFileName) {
                                this.sendResultAsync(res, 503, "为防止数据被覆盖丢失，请先另存当前的个人账号数据！");
                            }
                            else {
                                if (typeof postData === 'string')
                                    throw new Error("postData is string");
                                let uploaded_dump = postData.find((item) => item.name === "uploaded_dump");
                                if (!((_d = uploaded_dump === null || uploaded_dump === void 0 ? void 0 : uploaded_dump.filename) === null || _d === void 0 ? void 0 : _d.match(/\.json$/i)))
                                    throw new Error("filename not ended with .json");
                                this.sendResultAsync(res, 200, "processing new dump");
                                this.userdataDmp.importDumpAsync(uploaded_dump.data)
                                    .catch((e) => console.error(`${apiName} error`, e));
                            }
                        }
                        catch (e) {
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
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "set_inject_madokami_se":
                        try {
                            let injectMadokamiSEParams = await this.getParsedPostData(req);
                            let newInjectMadokamiSE = injectMadokamiSEParams.get("inject_madokami_se") != null;
                            await this.params.save({ key: "injectMadokamiSE", val: newInjectMadokamiSE });
                            let resultText = "sucessfully updated inject madokami se settings";
                            console.log(resultText);
                            this.sendResultAsync(res, 200, resultText);
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    // B站登录相关API保留（前端已移除按钮）
                    case "pwdlogin":
                    case "clear_bilibili_login":
                    case "clear_bsgamesdk_ids":
                        this.sendResultAsync(res, 404, "Bilibili login feature removed from UI");
                        return;
                    case "dump_userdata":
                        // 虽然前端已移除下载按钮，但API仍可被调用，返回友好提示
                        this.sendResultAsync(res, 404, "Userdata download feature removed from UI, please use import instead.");
                        return;
                    case "clear_game_login":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "openIdTicket", val: undefined });
                            this.sendResultAsync(res, 200, "cleared game login status");
                        }
                        catch (e) {
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
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "crawl_static_data":
                    case "stop_crawling":
                        this.sendResultAsync(res, 404, "Crawling feature removed from UI");
                        return;
                    case "fsck":
                        try {
                            await this.getParsedPostData(req);
                            if (this.crawler.isCrawling) {
                                this.sendResultAsync(res, 429, "is still crawling");
                            }
                            else if (this.crawler.isFscking) {
                                this.sendResultAsync(res, 429, "is already fscking");
                            }
                            else if (this.crawler.zippedAssets.integrityCheckStatus.isRunning) {
                                this.sendResultAsync(res, 429, "is checking integrity");
                            }
                            else {
                                this.crawler.fsck()
                                    .catch((e) => console.error(`${apiName} error`, e));
                                this.sendResultAsync(res, 200, "started fsck");
                            }
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "check_integrity":
                        try {
                            await this.getParsedPostData(req);
                            if (this.crawler.zippedAssets.integrityCheckStatus.isRunning) {
                                this.sendResultAsync(res, 429, "is already checking integrity");
                            }
                            else if (this.crawler.isFscking) {
                                this.sendResultAsync(res, 429, "is fscking");
                            }
                            else {
                                this.crawler.zippedAssets.checkIntegrity()
                                    .catch((e) => console.error(`${apiName} error`, e));
                                this.sendResultAsync(res, 200, "started checking integrity");
                            }
                        }
                        catch (e) {
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
                case "/params.json":
                    console.log(`servering params.json`);
                    res.writeHead(200, {
                        ["Content-Type"]: "application/json; charset=utf-8",
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
                    res.end(this.params.stringify());
                    return;
                case "/overrides.json":
                    console.log(`serving overrides.json`);
                    res.writeHead(200, {
                        ["Content-Type"]: "application/json; charset=utf-8",
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
                    res.end(JSON.stringify(this.params.overridesDB, util_1.replacer));
                    return;
            }
            // 修改后的 yaml 正则，支持域名
            const yamlRegEx = /^\/magirecolocal_([a-zA-Z0-9.-]+)_(\d{1,5})\.yaml$/;
            const yamlMatch = req.url.match(yamlRegEx);
            if (yamlMatch) {
                const host = yamlMatch[1];
                const port = yamlMatch[2];
                // 确保端口与当前代理端口一致（可选，但保留原逻辑）
                if (port === String(this.params.listenList.httpProxy.port)) {
                    console.log(`serving ${req.url}`);
                    const clashYaml = Buffer.from(this.params.getClashYaml(host));
                    res.writeHead(200, {
                        ["Content-Type"]: "application/x-yaml",
                        ["Content-Length"]: clashYaml.byteLength,
                        ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                    });
                    res.end(clashYaml);
                    return;
                }
            }
            if (req.url.match(this.userdataDmp.userdataDumpFileNameRegEx)) {
                console.log(`serving ${req.url}`);
                let dump = this.userdataDmp.lastDump;
                if (dump != null) {
                    let algo;
                    let acceptEncodings = req.headers["accept-encoding"];
                    if (acceptEncodings != null && acceptEncodings.length > 0) {
                        acceptEncodings = typeof acceptEncodings === 'string' ? acceptEncodings.split(",") : acceptEncodings;
                        let algos = acceptEncodings.map((item) => item.match(/(?<=^\s*)(br|gzip|deflate)(?=(\s|;|$))/))
                            .map((item) => item && item[0]).filter((item) => item != null).sort();
                        algo = algos.find((item) => item != null);
                    }
                    const userdataDumpFileName = this.userdataDmp.userdataDumpFileName;
                    let headers = {
                        ["Content-Type"]: "application/json; charset=utf-8",
                        ["Content-Disposition"]: `attachment; filename=\"${userdataDumpFileName}\"`,
                    };
                    let pipelineList;
                    console.log(`stringifying object to [${userdataDumpFileName}] ...`);
                    let stringified = JSON.stringify(dump, util_1.replacer);
                    console.log(`stringified object to [${userdataDumpFileName}]. creating buffer...`);
                    let stringifiedBuf = Buffer.from(stringified, 'utf-8');
                    console.log(`created buffer for [${userdataDumpFileName}], sending it`);
                    let fromStringified = stream.Readable.from(stringifiedBuf);
                    pipelineList = [fromStringified];
                    pipelineList.push(res);
                    res.writeHead(200, headers);
                    let doneCallback = (err) => {
                        if (err != null) {
                            console.error(`error sending ${userdataDumpFileName}`, err);
                        }
                        else {
                            console.log(`finished sending ${userdataDumpFileName}`);
                            this.params.lastDownloadedFileName = userdataDumpFileName;
                        }
                    };
                    stream.pipeline(pipelineList, doneCallback);
                    return;
                }
                else {
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
    static async launch() {
        const params = await parameters.params.load();
        if (params.checkModified())
            await params.save();
        let zippedassets = await zipped_assets_1.zippedAssets.init();
        let localserver = new local_server_1.localServer(params);
        let httpproxy = new http_proxy_1.httpProxy(params);
        let crawler = await staticResCrawler.crawler.init(params, localserver, zippedassets);
        let control_interface = new controlInterface(params, [localserver, httpproxy], crawler);
        control_interface.openWebOnAndroid();
    }
    openWebOnAndroid() {
        var _a;
        try {
            const addr = this.params.listenList.controlInterface;
            const webUrl = `http://${addr.host}:${addr.port}/`;
            let shellCmd;
            const androidSpecificFileList = [
                "/system/build.prop",
                "/sdcard",
                "/storage/emulated",
            ];
            let found = androidSpecificFileList.filter((path) => fs.existsSync(path));
            if (found.length > 0) {
                shellCmd = `am start -a \"android.intent.action.VIEW\" -d \"${webUrl}\"`;
            }
            else if ((_a = process.env["windir"]) === null || _a === void 0 ? void 0 : _a.match(/^[A-Z]\:\\WINDOWS/i)) {
                shellCmd = `start ${webUrl}`;
            }
            if (shellCmd == null || !this.params.autoOpenWeb) {
                console.log(`请手动在浏览器中打开Web控制界面\nOpen Web control interface in your browser manually\n  ${webUrl}`);
                return;
            }
            ChildProcess.exec(shellCmd, (error, stdout, stderr) => {
                try {
                    if (error == null) {
                        console.log(`    即将从浏览器打开Web控制界面...\n  ${webUrl}`);
                        console.log(`  如果没成功自动打开浏览器，请手动复制上述网址粘贴到浏览器地址栏`);
                        console.log(`  Please manually copy the URL above to the address bar of your browser, in case it did not pop up automatically`);
                    }
                    else {
                        console.error("error", error);
                        console.error("stdout", stdout);
                        console.error("stderr", stderr);
                    }
                }
                catch (e) {
                    console.error(e);
                }
            });
        }
        catch (e) {
            console.error(e);
        }
        console.log("（按CTRL+C即可中断程序运行）");
    }
    async closeAll() {
        let promises = this.serverList.map((server) => server.close());
        promises.push(new Promise((resolve) => {
            this.httpServerSelf.on('close', () => resolve());
            this.httpServerSelf.close();
            this.httpServerSelf.closeAllConnections();
        }));
        await Promise.allSettled(promises);
    }
    async shutdown() {
        if (this.closing)
            return;
        this.closing = true;
        this.params.save();
        await this.closeAll();
    }
    async restart() {
        //FIXME
        if (this.closing)
            return;
        this.closing = true;
        this.params.save();
        await this.closeAll();
        await controlInterface.launch();
    }
    async getParsedPostData(req) {
        let postData = await this.getPostData(req);
        if (typeof postData !== 'string')
            throw new Error("typeof postData !== 'string'");
        let bogusURL = new URL(`http://bogus/query?${postData}`);
        return bogusURL.searchParams;
    }
    getPostData(req) {
        return new Promise((resolve, reject) => {
            const method = req.method;
            if (!(method === null || method === void 0 ? void 0 : method.match(/^POST$/i)))
                reject(Error(`method=${method} is not POST`));
            else {
                req.on('error', (err) => reject(err));
                const postDataArray = [];
                req.on('data', (chunk) => postDataArray.push(chunk));
                req.on('end', () => {
                    const postData = Buffer.concat(postDataArray);
                    try {
                        const contentType = req.headers["content-type"];
                        if (contentType == null)
                            throw new Error();
                        let boundary = multipart.getBoundary(contentType);
                        if (typeof boundary !== 'string' || boundary === "")
                            throw new Error();
                        let parts;
                        if (postData.length >= 32 * 1024 * 1024) {
                            const result = controlInterface.stripFileData(postData, boundary);
                            parts = multipart.parse(result.stripped, boundary);
                            parts.forEach((item, index) => item.data = result.data[index]);
                        }
                        else {
                            parts = multipart.parse(postData, boundary);
                        }
                        resolve(parts);
                    }
                    catch (e) {
                        try {
                            let charset = parse_charset_1.parseCharset.get(req.headers);
                            let str = postData.toString(charset);
                            resolve(str);
                        }
                        catch (e) {
                            reject(e);
                        }
                    }
                });
            }
        });
    }
    static binarySearch(haystack, needle, startFrom) {
        if (needle.length == 0) {
            throw new Error(`binarySearch needle.length == 0`);
        }
        for (let start = startFrom, end = start + needle.length; end <= haystack.length; start++, end++) {
            let matched = true;
            for (let i = start; i < end; i++) {
                if (haystack[i] !== needle[i - start]) {
                    matched = false;
                    break;
                }
            }
            if (matched)
                return start;
        }
        return -1;
    }
    static stripFileData(postDataBuf, boundary) {
        const CRLFStr = "\r\n\r\n";
        const CRLF = new Uint8Array(Buffer.from(CRLFStr, "utf-8"));
        const doubleCRLFStr = "\r\n\r\n";
        const doubleCRLF = new Uint8Array(Buffer.from(doubleCRLFStr, "utf-8"));
        const postData = new Uint8Array(postDataBuf), bound = Buffer.from(`--${boundary}`, 'utf-8');
        const boundOffsets = [];
        for (let found = this.binarySearch(postData, bound, 0); found >= 0; found = this.binarySearch(postData, bound, found + bound.length)) {
            boundOffsets.push(found);
        }
        const strippedArray = [], dataArray = [];
        let start = 0;
        boundOffsets.forEach((offset) => {
            if (start > offset)
                throw new Error("start > offset");
            let data = postData.subarray(start, offset);
            let dataStart = this.binarySearch(data, doubleCRLF, 0);
            if (dataStart >= 0) {
                dataStart += doubleCRLF.length;
                strippedArray.push(Buffer.concat([data.subarray(0, dataStart), bound, CRLF]));
                dataArray.push(Buffer.from(data.subarray(dataStart, data.length)));
                start = offset = bound.length;
            }
        });
        return {
            stripped: Buffer.concat(strippedArray),
            data: dataArray,
        };
    }

    // ==================== 美化后的首页HTML ====================
    homepageHTML() {
        const officialURL = new URL("https://game.bilibili.com/magireco/");
        const gsxnjURL = new URL("https://www.gsxnj.cn/");
        const clashURL = new URL("https://github.com/Kr328/ClashForAndroid/releases/latest");
        const termuxURL = new URL("https://termux.dev/");
        const autoBattleURL = new URL("https://www.bilibili.com/video/BV1nf4y1y713");
        const nodeJsUrl = new URL("https://nodejs.org/zh-cn/download/current/");
        const npmRepoUrl = new URL("https://www.npmjs.com/package/magireco-cn-local-server");
        const mumuXURL = new URL("https://mumu.163.com/update/");
        const patchedApkURL = new URL("https://share.weiyun.com/HhJbXRP7");

        // 修复 aHref 函数：给 href 属性值加上双引号
        const aHref = (text, url, newTab = true, id) => `<a target=\"${newTab ? "_blank" : "_self"}\" href=\"${url}\"${id != null ? ` id=\"${id}\"` : ""}>${text}</a>`;

        const isOnlineMode = this.params.mode === parameters.mode.ONLINE;
        const isLocalOfflineMode = this.params.mode === parameters.mode.LOCAL_OFFLINE;
        const autoOpenWeb = this.params.autoOpenWeb;
        const injectMadokamiSE = this.params.injectMadokamiSE;

        let httpProxyAddr = "", httpProxyPort = "";
        const listenList = this.params.listenList;
        if (listenList != null) {
            const proxy = this.params.listenList.httpProxy;
            httpProxyAddr = proxy.host;
            httpProxyPort = String(proxy.port);
        }
        const httpProxyUsername = this.params.httpProxyUsername, httpProxyPassword = this.params.httpProxyPassword;

        // 游戏登录状态
        let openIdTicketStatus, openIdTicketStatusStyle = "color: red";
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            openIdTicketStatus = "游戏未登录（将自动使用B站账号登录）";
        } else {
            openIdTicketStatus = "游戏未登录（请先登录B站账号）";
        }
        const openIdTicket = this.params.openIdTicket;
        let gameUid;
        if (openIdTicket != null
            && openIdTicket.open_id != null && openIdTicket.open_id !== ""
            && openIdTicket.ticket != null && openIdTicket.ticket !== "") {
            let since = openIdTicket.timestamp;
            if (since != null) {
                since = Number(since);
                since = `${new Date(since).toLocaleDateString()} ${new Date(since).toLocaleTimeString()}`;
            }
            const uname = openIdTicket.uname;
            const open_id = openIdTicket.open_id;
            const uid = this.getGameUid(openIdTicket);
            gameUid = uid;
            let inconsistent = (bsgamesdkResponse === null || bsgamesdkResponse === void 0 ? void 0 : bsgamesdkResponse.uid) !== uid;
            openIdTicketStatus = `${inconsistent ? "游戏账户与B站不一致" : "游戏已登录"}`;
            if (uname == null)
                openIdTicketStatus += " 账户未知";
            else
                openIdTicketStatus += ` 账户=[${uname}]`;
            openIdTicketStatus += ` uid=[${uid}]`;
            openIdTicketStatus += ` 登录时间=[${since}]`;
            openIdTicketStatusStyle = `color: ${inconsistent ? "red" : "green"}`;
        }
        openIdTicketStatus = (0, get_str_rep_1.getStrRep)(openIdTicketStatus);

        const status = this.getStatus(gameUid);
        const isImporting = status.isImporting;
        const importStatus = status.importStatus;
        const integrityCheckResult = status.integrityCheckResult;
        const integrityCheckResultStyle = status.integrityCheckResultStyle;
        const isCheckingIntegrity = status.isCheckingIntegrity;
        const fsckResult = status.fsckResult;
        const fsckResultStyle = status.fsckResultStyle;
        const isFscking = status.isFscking;

        const pkgVersionStr = process.env.npm_package_version == null ? `` : ` v${process.env.npm_package_version}`;

        // 现代简洁的CSS样式（增强输入框和按钮）
        const style = `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: #f5f7fa;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                padding: 20px;
                color: #2c3e50;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            h1 {
                font-size: 2rem;
                margin-bottom: 1rem;
                color: #34495e;
                border-bottom: 3px solid #3498db;
                padding-bottom: 0.5rem;
            }
            h2 {
                font-size: 1.6rem;
                margin: 1.5rem 0 1rem;
                color: #2980b9;
                border-left: 5px solid #3498db;
                padding-left: 1rem;
            }
            fieldset {
                background: white;
                border: none;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                transition: all 0.2s;
            }
            fieldset:hover {
                box-shadow: 0 6px 16px rgba(0,0,0,0.1);
            }
            legend {
                font-weight: 600;
                background: #3498db;
                color: white;
                padding: 0.4rem 1rem;
                border-radius: 30px;
                font-size: 1rem;
                margin-bottom: 0.5rem;
                border: none;
            }
            label {
                font-weight: 500;
                display: inline-block;
                margin-bottom: 0.3rem;
                color: #2c3e50;
            }
            input[type="text"], input[type="password"], input[type="number"], input[readonly] {
                width: 100%;
                padding: 0.7rem 1rem;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 0.95rem;
                margin-bottom: 0.8rem;
                transition: border 0.2s, box-shadow 0.2s;
            }
            input[type="text"]:focus, input[type="password"]:focus, input[type="number"]:focus {
                border-color: #3498db;
                outline: none;
                box-shadow: 0 0 0 3px rgba(52,152,219,0.2);
            }
            input[type="checkbox"] {
                margin-right: 0.5rem;
                transform: scale(1.2);
                vertical-align: middle;
                accent-color: #3498db;
            }
            input[type="file"] {
                display: block;
                width: 100%;
                padding: 0.5rem;
                border: 1px dashed #3498db;
                border-radius: 8px;
                background: #f0f9ff;
                margin-bottom: 0.8rem;
                cursor: pointer;
            }
            input[type="file"]::file-selector-button {
                background: #3498db;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                margin-right: 1rem;
                cursor: pointer;
                transition: background 0.2s;
            }
            input[type="file"]::file-selector-button:hover {
                background: #2980b9;
            }
            button, input[type="submit"], input[type="button"] {
                background: #3498db;
                color: white;
                border: none;
                padding: 0.7rem 1.5rem;
                border-radius: 30px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s, transform 0.1s;
                margin-right: 0.5rem;
                margin-bottom: 0.5rem;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            button:hover, input[type="submit"]:hover {
                background: #2980b9;
            }
            button:active, input[type="submit"]:active {
                transform: scale(0.98);
            }
            button:disabled, input[type="submit"]:disabled {
                background: #bdc3c7;
                cursor: not-allowed;
                box-shadow: none;
            }
            .status-label {
                font-weight: 600;
                padding: 0.3rem 1rem;
                border-radius: 20px;
                display: inline-block;
                margin: 0.3rem 0;
                background: #f0f0f0;
            }
            a {
                color: #3498db;
                text-decoration: none;
                font-weight: 500;
            }
            a:hover {
                text-decoration: underline;
            }
            hr {
                border: none;
                border-top: 2px dashed #bdc3c7;
                margin: 2rem 0;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
            }
            .note {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 1rem;
                border-radius: 8px;
                margin: 1rem 0;
            }
        `;

        // 内联脚本（精简，只保留必要元素）
        const script = `
            window.addEventListener('pageshow', (ev) => {
                if (ev.persisted || (window.performance != null && window.performance.navigation.type === 2)) {
                    window.location.reload(true);
                }
            });
            function swapVerboseDesc() {
                let el = document.getElementById("verbosedesc");
                let innerHTML = el.innerHTML;
                let verboseDescHtml = "${aHref("（点击显示设置说明，即让游戏客户端连接到本地服务器而不是直连官服）", "javascript:swapVerboseDesc();", false).replace(/"/g, "\\\"")}";
                el.innerHTML = verboseDescHtml;
                verboseDescHtml = innerHTML;
            }
            window.addEventListener('load', (ev) => {
                swapVerboseDesc();
                document.getElementById("openidticketstatus").textContent = "${openIdTicketStatus}";
                document.getElementById("openidticketstatus").style = "${openIdTicketStatusStyle}";
                let initialCountdown = ${isImporting || isCheckingIntegrity || isFscking ? "20" : "0"};
                async function autoRefresh(countdown) {
                    let status = {isImporting: false, isCheckingIntegrity: true, isFscking: true};
                    try {
                        status = await (await fetch(new URL("/api/get_status", document.baseURI))).json();
                        countdown = initialCountdown;
                    } catch (e) {
                        console.error(e);
                    }
                    let el = document.getElementById("importstatus");
                    if (el) { el.textContent = status.importStatus; el.style = status.importStatusStyle; }
                    el = document.getElementById("fsckresult");
                    if (el) { el.textContent = status.fsckResult; el.style = status.fsckResultStyle; }
                    document.getElementById("fsck_btn").disabled = status.isFscking || status.isCheckingIntegrity;
                    el = document.getElementById("integritycheckresult");
                    if (el) { el.textContent = status.integrityCheckResult; el.style = status.integrityCheckResultStyle; }
                    document.getElementById("integrity_check_btn").disabled = status.isFscking || status.isCheckingIntegrity;
                    if (countdown > 0 && (status.isImporting || status.isCheckingIntegrity || status.isFscking))
                        setTimeout(() => autoRefresh(--countdown), 500);
                }
                autoRefresh(initialCountdown);
            });
            function localIPv4Select(selected) {
                let host = selected.id.replace(/^local_ipv4_addr_/, "").replace(/_/g, ".");
                let el = document.getElementById("clash_yaml_link");
                el.textContent = \`magirecolocal_\${host}_${httpProxyPort}.yaml\`;
                el.setAttribute("href", "/" + el.textContent); el.setAttribute("target", "_blank");
            }
        `;

        const html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
    <title>魔法纪录国服本地服务器${pkgVersionStr}</title>
    <style>${style}</style>
    <script>${script}</script>
</head>
<body>
    <div class="container">
        <h1>魔法纪录国服本地服务器${pkgVersionStr}</h1>

        <!-- HTTP代理信息 -->
        <fieldset>
            <legend>HTTP代理</legend>
            <fieldset><legend>代理信息</legend>
                <div><label>监听地址</label><input readonly value="${httpProxyAddr}"></div>
                <div><label>监听端口</label><input readonly value="${httpProxyPort}"></div>
                <div><label>用户名</label><input readonly value="${httpProxyUsername}"></div>
                <div><label>密码</label><input readonly value="${httpProxyPassword}"></div>
            </fieldset>
            <div>
                <form action="/api/toggle_loopback_listen" method="post">
                    <input type="submit" value="${this.isTogglingLoopbackListen ? "正在" : ""}切换HTTP代理监听地址" id="toggle_loopback_listen_btn" ${this.isTogglingLoopbackListen ? "disabled" : ""}>
                </form>
                <ul>
                    <li>本机（<code>127.0.0.1</code>）<b>之外</b>的地址连接HTTP代理时，<b>将会启用用户名密码验证</b>。</li>
                    <li>若要登录游戏，可以使用Clash让游戏客户端通过上述HTTP代理联网；</li>
                    <li>或者修改<a href="#setmode">工作模式</a>后，使用Clash让游戏客户端通过上述HTTP代理联网即可成为脱离官服的本地离线服务器。</li>
                </ul>
            </div>
        </fieldset>

        <!-- 下载CA证书 -->
        <fieldset><legend>下载CA证书</legend>
            <div>${aHref("ca.crt", "/ca.crt")}<br><i>注意，如果是模拟器，模拟器系统更新后需要重新安装CA证书。</i><br><i>（${aHref("离线补丁版", "#verbosedesc", false)}游戏客户端则不需要安装CA证书）</i></div>
        </fieldset>

        <!-- 下载Clash配置文件 -->
        <fieldset id="clash_config_download"><legend>下载Clash配置文件</legend>
            <div>${httpProxyAddr === "127.0.0.1" ? "" : `${this.addrSelectHtml}`}
            ${httpProxyAddr === "127.0.0.1"
                ? aHref(`magirecolocal_${httpProxyAddr}_${httpProxyPort}.yaml`, `/magirecolocal_${httpProxyAddr}_${httpProxyPort}.yaml`)
                : aHref("（请先选择一个本机IP地址）", "#local_ipv4_addr_list", false, "clash_yaml_link")}
            <br><i>文件名中含有HTTP代理端口号，请注意核对端口号是否与上面显示的一致。</i></div>
        </fieldset>

        <!-- 下载/上传配置数据 -->
        <div class="grid">
            <fieldset><legend>下载配置数据</legend>
                <fieldset><legend>服务器配置</legend><b style="color:red">（含有登录密钥等敏感数据，请勿分享）</b> ${aHref("params.json", "/params.json")}</fieldset>
                <fieldset><legend>玩家配置</legend>${aHref("overrides.json", "/overrides.json")}</fieldset>
            </fieldset>
            <fieldset><legend>上传配置数据</legend>
                <fieldset><legend>服务器配置</legend>
                    <form enctype="multipart/form-data" action="/api/upload_params" method="post">
                        <input type="file" name="uploaded_params" id="params_file">
                        <input type="submit" value="上传配置数据" id="upload_params_btn">
                    </form>
                </fieldset>
                <fieldset><legend>玩家配置</legend>
                    <form enctype="multipart/form-data" action="/api/upload_overrides" method="post">
                        <input type="file" name="uploaded_overrides" id="overrides_file">
                        <input type="submit" value="上传配置数据" id="upload_overrides_btn">
                    </form>
                </fieldset>
            </fieldset>
        </div>

        <hr>

        <!-- 详细说明（可折叠） -->
        <h2>说明</h2>
        <ol>
            <li>登录后即可通过导入功能恢复个人账号数据，包括你拥有的魔法少女列表、记忆结晶列表、好友列表、以及最近的获得履历等等。</li>
            <li id="verbosedesc">${aHref("（点击显示详细设置说明）", "javascript:swapVerboseDesc();", false)}
                <ul>
                    <li>${aHref("离线补丁版", patchedApkURL.href)}游戏客户端不需要CA证书；<br>但模拟器中，目前仅发现${aHref("Android12的MuMuX模拟器", mumuXURL.href)}可以运行；<br>真机理论上只支持Android9以上系统，实际上目前仅在Android12上测试过。<br>而且它目前只能免去对CA证书的需求，仍然需要继续设置Clash。</li>
                    <li>电脑上应该用${aHref("最新版NodeJS", nodeJsUrl.href)}直接跑${aHref("这个本地服务器", npmRepoUrl.href)}<b>（不推荐在模拟器里通过Termux运行本地服务器）</b>、用Android模拟器跑游戏客户端和${aHref("Clash for Android", clashURL.href)}，<br>然后用<code>adb -e reverse tcp:${httpProxyPort} tcp:${httpProxyPort}</code>命令设置端口映射来让模拟器里的Clash能连到外边；<br>CA证书也安装在（跑着游戏客户端和Clash的）Android模拟器里；或者改用不需要CA证书的${aHref("离线补丁版", patchedApkURL.href)}游戏客户端。</li>
                    <li>或是在Android真机上用${aHref("Termux", termuxURL.href)}跑这个本地服务器，<br>然后用类似${aHref("光速", gsxnjURL.href)}之类虚拟机来跑游戏客户端，<br>并在虚拟机内安装CA证书（若是离线补丁版则不需要）。Clash则直接跑在真机上，然后需要设置Clash分流来<b>只让跑着游戏客户端的虚拟机App走代理，不能让跑着本地服务器的Termux也走代理</b>。</li>
                    <li><b>注意Clash第一次启动后需要设置一下代理模式</b>，否则默认是DIRECT直连。</li>
                    <li>必须在Clash设置中启用<b>[DNS劫持]</b>。</li>
                    <li><b>如果不是离线补丁版游戏客户端，则必须安装CA证书，且必须安装为Android的系统证书</b>（需要Root权限）。</li>
                    <li>Android 9或以上的新版MuMu模拟器，建议如上述方式修改Clash设置，只让游戏客户端通过Clash联网，并启用[绕过私有网络]和[DNS劫持]。</li>
                    <li>雷电模拟器9的系统分区默认不可写，导致无法安装CA证书，需要在模拟器右上角三条横线菜单[软件设置]=>[性能设置]中将[磁盘共享]设为<b>[System.vmdk可写入]</b>。</li>
                </ul>
            </li>
            <li>本地离线模式<b>必须</b>先下载静态资源才能正常提供服务（静态资源已内置在安装包中，无需额外操作）。</li>
            <li>本地离线模式只支持通过<b>用户名密码登录</b>，目前只有首页背景、看板、档案、镜层演习等少数功能完成修复；</li>
            <li>本地离线模式下，在游戏客户端中输入任意非空用户名密码均可照常登录到离线服务器。</li>
            <li>目前暂时<b>只有之前导入过个人账号数据的情况下才能正常登录到离线服务器</b>。</li>
        </ol>

        <hr>

        <!-- 设置区域 -->
        <h2>设置</h2>
        <fieldset id="setmode"><legend>工作模式</legend>
            <div><input checked disabled type="radio" id="mode_radio2" name="mode" value="local_offline"><label for="mode_radio2">本地离线模式</label></div>
        </fieldset>

        <fieldset><legend>启动时自动打开浏览器</legend>
            <form action="/api/set_auto_open_web" method="post">
                <div><input id="auto_open_web" name="auto_open_web" value="true" type="checkbox" ${autoOpenWeb ? "checked" : ""}><label for="auto_open_web">启动时自动打开浏览器</label></div>
                <div><input type="submit" id="set_auto_open_web_btn" value="应用"></div>
            </form>
        </fieldset>

        <fieldset><legend>圆神附体</legend>
            <i>需要修改libmadomagi_native.so才能把精强主动技能按钮显示出来。</i><br><i>国服关服前并未提供圆神精强数据，数据实际上来自日服；技能名称翻译则参考了开启精强的其他角色。</i>
            <form action="/api/set_inject_madokami_se" method="post">
                <div><input id="inject_madokami_se" name="inject_madokami_se" value="true" type="checkbox" ${injectMadokamiSE ? "checked" : ""}><label for="inject_madokami_se">镜层演习我方全体角色获得圆神精强技能</label></div>
                <div><input type="submit" id="set_inject_madokami_se_btn" value="应用"></div>
            </form>
        </fieldset>

        <hr>

        <!-- 个人数据管理（仅保留登录状态、清除登录、导入） -->
        <h2>个人数据管理</h2>
        <fieldset><legend>游戏登录状态</legend>
            <div><button id="refreshbtn2" onclick="window.location.reload(true);">刷新</button><span style="${openIdTicketStatusStyle}" id="openidticketstatus">${openIdTicketStatus}</span></div>
        </fieldset>

        <fieldset><legend>清除游戏登录状态</legend>
            <form action="/api/clear_game_login" method="post"><input type="submit" id="clear_game_login_btn" value="清除游戏登录状态"></form>
            <form action="/api/clear_magireco_ids" method="post"><input type="submit" id="clear_magireco_ids_btn" value="清除游戏登录状态并重置设备ID"></form>
        </fieldset>

        <fieldset><legend>导入之前另存的个人账号数据</legend>
            <form enctype="multipart/form-data" action="/api/upload_dump" method="post">
                <div><input type="file" name="uploaded_dump" id="dump_file"></div>
                <div><input type="submit" value="上传并导入" id="import_btn" ${isImporting ? "disabled" : ""}><label for="import_btn"><b>上传并导入后，将会覆盖当前的数据！</b></label></div>
            </form>
            <fieldset><legend>导入进度</legend>
                <div><button id="refreshbtn4" onclick="window.location.reload(true);">刷新</button><span style="${status.importStatusStyle}" id="importstatus">${importStatus}</span></div>
            </fieldset>
        </fieldset>

        <hr>

        <!-- 资源维护 -->
        <h2>资源维护</h2>
        <div class="grid">
            <fieldset><legend>检查文件完整性</legend>
                <div><button id="refreshbtn5" onclick="window.location.reload(true);">刷新</button><span style="${integrityCheckResultStyle}" id="integritycheckresult">${integrityCheckResult}</span></div>
                <form action="/api/check_integrity" method="post">
                    <input type="submit" id="integrity_check_btn" ${isFscking || isCheckingIntegrity ? "" : "disabled"} value="检查文件完整性">
                    <br>检查资源包的内容是否有缺失或损坏。
                </form>
            </fieldset>

            <fieldset><legend>清理</legend>
                <div><button id="refreshbtn6" onclick="window.location.reload(true);">刷新</button><span style="${fsckResultStyle}" id="fsckresult">${fsckResult}</span></div>
                <form action="/api/fsck" method="post">
                    <input type="submit" id="fsck_btn" ${isFscking || isCheckingIntegrity ? "" : "disabled"} value="删除已被打包的文件">
                    <br>自1.6.9版开始，在升级后会自动将静态资源文件重新打包，以节约存储空间。已被打包的文件已不再需要，但不会在打包过程中自动删除，请手动点击上面的按钮扫描并删除。
                </form>
            </fieldset>
        </div>

        <hr>
        <!-- 原 shutdown/restart 按钮已注释，保留占位 -->
    </div>
</body>
</html>`;
        return html;
    }

    getGameUid(openIdTicket) {
        const open_id = openIdTicket === null || openIdTicket === void 0 ? void 0 : openIdTicket.open_id;
        const uidMatched = open_id === null || open_id === void 0 ? void 0 : open_id.match(/\d+$/);
        return uidMatched != null && !isNaN(Number(uidMatched[0])) ? (Number(uidMatched[0])) : undefined;
    }

    getStatus(gameUid) {
        var _a;
        // 下载相关状态不再用于前端显示，但保留以备内部使用
        const isDownloading = this.userdataDmp.isDownloading;
        const lastDump = this.userdataDmp.lastDump;

        const integrityCheckStatus = this.crawler.zippedAssets.integrityCheckStatus;
        const isCheckingIntegrity = integrityCheckStatus.isRunning;
        const integrityCheckResult = integrityCheckStatus.statusString;
        const integrityCheckResultStyle = isCheckingIntegrity
            ? "color: blue"
            : integrityCheckStatus.totalCount == 0
                ? "color: grey"
                : integrityCheckStatus.isAllPassed
                    ? "color: green"
                    : "color: red";

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

        const isImporting = this.userdataDmp.isImporting;
        let importStatus = "", importStatusStyle = "color: red";
        if (isImporting) {
            importStatus = "正在导入...";
            importStatusStyle = "color: blue";
        } else {
            const lastImportError = this.userdataDmp.lastImportError;
            if (lastImportError == null) {
                importStatus = "已导入";
                importStatusStyle = "color: green";
            } else {
                importStatus = "导入过程出错";
                importStatusStyle = "color: red";
                if (lastImportError instanceof Error)
                    importStatus += ` [${lastImportError.message}]`;
            }
        }

        return {
            mode: this.params.mode,
            isDownloading: isDownloading,
            userdataDumpStatus: lastDump ? "已下载（前端隐藏）" : "未下载", // 不再显示
            userdataDumpStatusStyle: "color: grey",
            isCheckingIntegrity: isCheckingIntegrity,
            integrityCheckResult: integrityCheckResult,
            integrityCheckResultStyle: integrityCheckResultStyle,
            isFscking: isFscking,
            fsckResult: fsckResult,
            fsckResultStyle: fsckResultStyle,
            isImporting: isImporting,
            importStatus: importStatus,
            importStatusStyle: importStatusStyle,
        };
    }

    // 修改后的 addrSelectHtml，添加固定IP和域名
    get addrSelectHtml() {
        let addrList = [];
        try {
            const interfaces = os.networkInterfaces();
            Object.values(interfaces).forEach((array) => array === null || array === void 0 ? void 0 : array.filter((info) => info.family === "IPv4").forEach((addr) => addrList.push(addr.address)));
        } catch (e) {
            console.error(e);
        }
        // 添加固定选项
        const fixedOptions = [
            { label: "110.42.45.179", id: "local_ipv4_addr_110_42_45_179" },
            { label: "game.magi.cbnv.top", id: "local_ipv4_addr_game_magi_cbnv_top" }
        ];
        const max = 10;
        if (addrList.length > max) {
            console.error(`addrList.length=[${addrList.length}] > ${max}`);
            let list = addrList;
            addrList = [];
            for (let i = 0; i < max; i++)
                addrList.push(list[i]);
        }
        // 生成本机地址单选按钮
        const localRadios = addrList.map((addr) => `<div><input type="radio" name="local_ipv4_addr" id="local_ipv4_addr_${addr.replace(/\./g, "_")}" onclick="localIPv4Select(this);"><label for="local_ipv4_addr_${addr.replace(/\./g, "_")}">${addr}</label></div>`).join("\n");
        // 生成固定选项单选按钮
        const fixedRadios = fixedOptions.map((opt) => `<div><input type="radio" name="local_ipv4_addr" id="${opt.id}" onclick="localIPv4Select(this);"><label for="${opt.id}">${opt.label}</label></div>`).join("\n");
        return `<fieldset id="local_ipv4_addr_list"><legend>选择代理服务器地址</legend>\n${localRadios}\n${fixedRadios}\n</fieldset>`;
    }

    async sendResultAsync(res, statusCode, result, isJson = false) {
        return new Promise((resolve, reject) => {
            if (!isJson) {
                let strRep = (0, get_str_rep_1.getStrRep)(result);
                let html = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
    <title>Magireco CN Local Server - API Result</title>
    <style>
        body { background: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 30px; cursor: pointer; }
        textarea { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px; font-family: monospace; }
    </style>
    <script>
        window.onload = () => {
            document.getElementById("httpstatus").textContent = "${statusCode}";
            document.getElementById("result").textContent = "${strRep}";
        };
    </script>
</head>
<body>
    <div class="container">
        <label>${statusCode == 200 ? "操作成功，请返回" : "错误"}</label>
        <br><b>以下内容可能含有敏感隐私信息，请勿分享。</b>
        <button id="backbtn" onclick="window.history.back();">返回 Back</button>
        <hr>
        <label>HTTP Status Code</label>
        <textarea id="httpstatus" readonly rows="1"></textarea>
        <br>
        <label>${statusCode == 200 ? "结果 Result" : "错误消息 Error Message"}</label>
        <textarea id="result" readonly rows="20"></textarea>
    </div>
</body>
</html>`;
                result = html;
            }
            res.on('error', (err) => { console.error(err); resolve(); });
            res.writeHead(statusCode, { 'Content-Type': isJson ? 'application/json' : 'text/html' });
            res.end(result, () => resolve());
        });
    }
}
exports.controlInterface = controlInterface;