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
class controlInterface {
    constructor(params, serverList) {
        this.closing = false;
        this.isTogglingLoopbackListen = false;
        const httpPxy = serverList.find((s) => s instanceof http_proxy_1.httpProxy);
        const localsvr = serverList.find((s) => s instanceof local_server_1.localServer);
        const bsgamesdkPwdAuth = new bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth(params, localsvr);
        const userdataDmp = new userdataDump.userdataDmp(params, localsvr);
        const crawler = new staticResCrawler.crawler(params, localsvr);
        const hooks = [
            new save_access_key_hook_1.saveAccessKeyHook(params),
            new save_open_id_ticket_hook_1.saveOpenIdTicketHook(params),
            new fake_magireco_prod_resp_hook_1.fakeMagirecoProdRespHook(params, crawler, userdataDmp),
        ];
        hooks.forEach((hook) => localsvr.addHook(hook));
        const httpServerSelf = http.createServer(async (req, res) => {
            var _a, _b, _c, _d;
            if (req.url == null) {
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
                return;
            }
            const isHomepage = req.url === "/" && req.headers.referer == null;
            const isCACert = req.url === "/ca.crt" || req.url === "/ca_subject_hash_old.txt";
            const selfHost = this.params.listenList.controlInterface.host;
            const selfPort = this.params.listenList.controlInterface.port;
            const refererRegEx = new RegExp(`^(http|https)://(magireco\\.local|${selfHost.replace(/\./g, "\\.")})(|:${selfPort})($|/.*)`);
            const isReferrerAllowed = ((_a = req.headers.referer) === null || _a === void 0 ? void 0 : _a.match(refererRegEx)) != null;
            if (!isHomepage && !isCACert && !isReferrerAllowed) {
                console.error(`rejected disallowed referer`);
                res.writeHead(403, { ["Content-Type"]: "text/plain" });
                res.end("403 Forbidden");
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
                    case "upload_upstream_proxy_cacert":
                        try {
                            let postData = await this.getPostData(req);
                            if (typeof postData === 'string')
                                throw new Error("postData is string");
                            let upstream_proxy_cacert = postData.find((item) => item.name === "upstream_proxy_cacert");
                            if (upstream_proxy_cacert != null
                                && upstream_proxy_cacert.filename != null
                                && upstream_proxy_cacert.filename !== ""
                                && !upstream_proxy_cacert.filename.match(/\.(pem|crt)$/i))
                                throw new Error("filename not ended with .pem or .crt");
                            let newCACert = upstream_proxy_cacert === null || upstream_proxy_cacert === void 0 ? void 0 : upstream_proxy_cacert.data.toString();
                            if (newCACert === "")
                                newCACert = undefined;
                            await this.params.save({ key: "upstreamProxyCACert", val: newCACert });
                            let msg = newCACert != null ? "saved upstreamProxyCACert" : "cleared upstreamProxyCACert";
                            console.log(msg);
                            this.sendResultAsync(res, 200, msg);
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
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
                                this.sendResultAsync(res, 503, "???????????????????????????????????????????????????????????????????????????");
                            }
                            else {
                                if (typeof postData === 'string')
                                    throw new Error("postData is string");
                                let uploaded_dump = postData.find((item) => item.name === "uploaded_dump");
                                if (!((_d = uploaded_dump === null || uploaded_dump === void 0 ? void 0 : uploaded_dump.filename) === null || _d === void 0 ? void 0 : _d.match(/\.json$/i)))
                                    throw new Error("filename not ended with .json");
                                this.sendResultAsync(res, 200, "processing new dump"); // send request before importing
                                this.userdataDmp.importDumpAsync(uploaded_dump.data)
                                    .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                            }
                        }
                        catch (e) {
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
                    case "pwdlogin":
                        try {
                            let pwdLoginParams = await this.getParsedPostData(req);
                            let username = pwdLoginParams.get("username");
                            let password = pwdLoginParams.get("password");
                            if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                                this.sendResultAsync(res, 403, "cannot do bilibili login in local offline mode");
                            }
                            else if (username == null || password == null || username === "" || password === "") {
                                let result = "username or password is empty";
                                console.error(result);
                                this.sendResultAsync(res, 400, result);
                            }
                            else {
                                let result = await this.bsgamesdkPwdAuth.login(username, password);
                                let resultText = JSON.stringify(result);
                                this.sendResultAsync(res, 200, resultText);
                            }
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "dump_userdata":
                        try {
                            const dumpDataParams = await this.getParsedPostData(req); // finish receiving first
                            const requestingNewDownload = dumpDataParams.get("new") != null;
                            const fetchCharaEnhancementTree = dumpDataParams.get("fetch_chara_enhance_tree") != null;
                            const arenaSimulate = dumpDataParams.get("arena_simulate") != null;
                            const concurrentFetch = dumpDataParams.get("concurrent_fetch") != null;
                            await this.params.save([
                                { key: "fetchCharaEnhancementTree", val: fetchCharaEnhancementTree },
                                { key: "arenaSimulate", val: arenaSimulate },
                                { key: "concurrentFetch", val: concurrentFetch }
                            ]);
                            const lastDump = this.userdataDmp.lastDump;
                            const alreadyDownloaded = lastDump != null;
                            const lastError = this.userdataDmp.lastError;
                            const hasDownloadResultOrError = alreadyDownloaded || lastError != null;
                            const isDownloading = this.userdataDmp.isDownloading;
                            const isImporting = this.userdataDmp.isImporting;
                            if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                                this.sendResultAsync(res, 403, "cannot dump userdata in local offline mode");
                            }
                            else if (!isDownloading && !isImporting && (requestingNewDownload || !hasDownloadResultOrError)) {
                                this.userdataDmp.getDumpAsync()
                                    .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                this.sendResultAsync(res, 200, "downloading");
                            }
                            else {
                                if (alreadyDownloaded) {
                                    this.sendResultAsync(res, 200, "download is already completed");
                                }
                                else if (isDownloading) {
                                    this.sendResultAsync(res, 429, `download not yet finished\n${this.userdataDmp.fetchStatus}`);
                                }
                                else if (isImporting) {
                                    this.sendResultAsync(res, 429, `import not yet finished\n${this.userdataDmp.fetchStatus}`);
                                }
                                else {
                                    this.sendResultAsync(res, 500, `error ${lastError instanceof Error ? lastError.message : ""}`);
                                }
                            }
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
                        return;
                    case "clear_bilibili_login":
                        try {
                            await this.getParsedPostData(req);
                            await this.params.save({ key: "bsgamesdkResponse", val: undefined });
                            this.sendResultAsync(res, 200, "cleared bilibili login status");
                        }
                        catch (e) {
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
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
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
                        if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
                            this.sendResultAsync(res, 403, "cannot crawl in local offline mode");
                        }
                        else if (this.crawler.isCrawling) {
                            this.sendResultAsync(res, 429, "crawling not yet finished");
                        }
                        else if (this.crawler.isFscking) {
                            this.sendResultAsync(res, 429, "is still fscking");
                        }
                        else {
                            try {
                                let crawlingParams = await this.getParsedPostData(req);
                                let crawlWebRes = crawlingParams.get("crawl_web_res") != null;
                                let crawlAssets = crawlingParams.get("crawl_assets") != null;
                                let concurrentCrawl = crawlingParams.get("concurrent_crawl") != null;
                                if (!crawlWebRes && !crawlAssets) {
                                    this.sendResultAsync(res, 400, "must crawl at least one part");
                                }
                                else {
                                    await this.params.save([
                                        { key: "crawlWebRes", val: crawlWebRes },
                                        { key: "crawlAssets", val: crawlAssets },
                                        { key: "concurrentCrawl", val: concurrentCrawl },
                                    ]);
                                    this.crawler.fetchAllAsync()
                                        .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                    this.sendResultAsync(res, 200, "crawling started");
                                }
                            }
                            catch (e) {
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
                        }
                        catch (e) {
                            console.error(`${apiName} error`, e);
                            this.sendResultAsync(res, 500, e instanceof Error ? e.message : `${apiName} error`);
                        }
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
                            else {
                                this.crawler.fsck()
                                    .catch((e) => console.error(`${apiName} error`, e)); // prevent crash
                                this.sendResultAsync(res, 200, "started fsck");
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
                    res.end(JSON.stringify(this.params.overridesDB, parameters.replacer));
                    return;
            }
            const yamlRegEx = /^\/magirecolocal_(\d{1,3}\.){3}\d{1,3}_\d{1,5}\.yaml$/;
            const parsedHost = req.url.match(/(\d{1,3}\.){3}\d{1,3}/);
            if (req.url.match(yamlRegEx) && parsedHost != null && net.isIPv4(parsedHost[0])) {
                console.log(`servering ${req.url}`);
                const clashYaml = Buffer.from(this.params.getClashYaml(parsedHost[0]));
                res.writeHead(200, {
                    ["Content-Type"]: "application/x-yaml",
                    ["Content-Length"]: clashYaml.byteLength,
                    ["Content-Disposition"]: `attachment; filename=\"${req.url.replace(/^\//, "")}\"`,
                });
                res.end(clashYaml);
                return;
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
                    let stringified = JSON.stringify(dump, parameters.replacer);
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
        let localserver = new local_server_1.localServer(params);
        let httpproxy = new http_proxy_1.httpProxy(params);
        let control_interface = new controlInterface(params, [localserver, httpproxy]);
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
                console.log(`??????????????????????????????Web????????????\n  ${webUrl}`);
                return;
            }
            ChildProcess.exec(shellCmd, (error, stdout, stderr) => {
                try {
                    if (error == null) {
                        console.log(`    ????????????????????????Web????????????...\n  ${webUrl}`);
                        console.log(`  ???????????????????????????????????????????????????????????????????????????????????????????????????`);
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
        console.log("??????CTRL+C???????????????????????????");
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
        const aHref = (text, url, newTab = true, id) => `<a target=\"${newTab ? "_blank" : "_self"}\" href=${url}${id != null ? ` id=\"${id}\"` : ""}>${text}</a>`;
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
        const httpProxyUsername = this.params.httpProxyUsername, httpProxyPassword = this.params.httpProxyPassword;
        const upstreamProxy = this.params.upstreamProxy;
        const upstreamProxyHost = upstreamProxy.host;
        const upstreamProxyPort = upstreamProxy.port;
        const upstreamProxyEnabled = this.params.upstreamProxyEnabled;
        let loginStatus = `B??????????????????`, loginStatusStyle = "color: red", loginBtnText = "??????";
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            let since = bsgamesdkResponse.timestamp;
            if (since != null) {
                since = Number(since);
                since = `${new Date(since).toLocaleDateString()} ${new Date(since).toLocaleTimeString()}`;
            }
            let expires = bsgamesdkResponse.expires;
            if (expires != null)
                expires = `${new Date(expires).toLocaleDateString()} ${new Date(expires).toLocaleTimeString()}`;
            loginStatus = (0, get_str_rep_1.getStrRep)(`B?????????????????? ??????=[${bsgamesdkResponse.uname}] uid=[${bsgamesdkResponse.uid}]`
                + ` ??????????????????=[${bsgamesdkResponse.realname_verified}]`
                + ` ????????????=[${since}] ??????????????????=[${expires}]`);
            loginStatusStyle = "color: green";
            loginBtnText = "????????????";
        }
        let openIdTicketStatus, openIdTicketStatusStyle = "color: red";
        if (bsgamesdkResponse != null && bsgamesdkResponse.access_key != null) {
            openIdTicketStatus = "?????????????????????????????????B??????????????????";
        }
        else {
            openIdTicketStatus = "??????????????????????????????B????????????";
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
            openIdTicketStatus = `${inconsistent ? "???????????????B????????????" : "???????????????"}`;
            if (uname == null)
                openIdTicketStatus += " ????????????";
            else
                openIdTicketStatus += ` ??????=[${uname}]`;
            openIdTicketStatus += ` uid=[${uid}]`;
            openIdTicketStatus += ` ????????????=[${since}]`;
            openIdTicketStatusStyle = `color: ${inconsistent ? "red" : "green"}`;
        }
        openIdTicketStatus = (0, get_str_rep_1.getStrRep)(openIdTicketStatus);
        let upstreamProxyCACertStatus = "?????????", upstreamProxyCACertStyle = "color: red";
        if (this.params.upstreamProxyCACert != null) {
            upstreamProxyCACertStatus = "?????????";
            upstreamProxyCACertStyle = "color: green";
        }
        const status = this.getStatus(gameUid);
        const isDownloading = status.isDownloading;
        const userdataDumpStatus = status.userdataDumpStatus;
        const userdataDumpStatusStyle = status.userdataDumpStatusStyle;
        const isCrawling = status.isCrawling;
        const crawlingStatus = status.crawlingStatus;
        const crawlingStatusStyle = status.crawlingStatusStyle;
        const fsckResult = status.fsckResult;
        const fsckResultStyle = status.fsckResultStyle;
        const isFscking = status.isFscking;
        const isImporting = status.isImporting;
        const importStatus = status.importStatus;
        const crawlWebRes = this.params.crawlWebRes;
        const crawlAssets = this.params.crawlAssets;
        const isWebResCompleted = this.crawler.isWebResCompleted;
        const isAssetsCompleted = this.crawler.isAssetsCompleted;
        const bsgamesdkIDs = this.params.bsgamesdkIDs;
        const bd_id = bsgamesdkIDs.bd_id, buvid = bsgamesdkIDs.buvid, udid = bsgamesdkIDs.udid;
        const magirecoIDs = this.params.magirecoIDs;
        const device_id = magirecoIDs.device_id;
        const pkgVersionStr = process.env.npm_package_version == null ? `` : ` v${process.env.npm_package_version}`;
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
            + `\n      if (isDownloading || isImporting) {`
            + `\n        window.location.reload(true);`
            + `\n      }`
            + `\n    }`
            + `\n    var verboseDescHtml = \"${aHref("???????????????????????????????????????????????????????????????????????????????????????????????????", "javascript:swapVerboseDesc();", false).replace(/"/g, "\\\"")}\";`
            + `\n    function swapVerboseDesc() {`
            + `\n      let el = document.getElementById(\"verbosedesc\"); let innerHTML = el.innerHTML;`
            + `\n      el.innerHTML = verboseDescHtml; verboseDescHtml = innerHTML;`
            + `\n    }`
            + `\n    window.addEventListener('load', (ev) => {`
            + `\n      swapVerboseDesc();`
            + `\n      document.getElementById(\"loginstatus\").textContent = \"${loginStatus}\";`
            + `\n      document.getElementById(\"openidticketstatus\").textContent = \"${openIdTicketStatus}\";`
            + `\n      let initialCountdown = ${isDownloading || isImporting || isCrawling || isFscking ? "20" : "0"};`
            + `\n      async function autoRefresh(countdown) {`
            + `\n          let status = {isDownloading: true, isImporting: false, isCrawling: true, isFscking: true};`
            + `\n          try {`
            + `\n              status = await (await fetch(new URL(\"/api/get_status\", document.baseURI))).json();`
            + `\n              countdown = initialCountdown;`
            + `\n          } catch (e) {`
            + `\n              console.error(e);`
            + `\n          }`
            + `\n          let isOfflineMode = status.mode == ${parameters.mode.LOCAL_OFFLINE};`
            + `\n          isOffline(isOfflineMode);`
            + `\n          let el = document.getElementById(\"userdatadumpstatus\");`
            + `\n          el.textContent = status.userdataDumpStatus; el.style = status.userdataDumpStatusStyle;`
            + `\n          document.getElementById(\"prepare_download_btn\").disabled = isOfflineMode || status.isDownloading || status.isImporting;`
            + `\n          el = document.getElementById(\"crawlingstatus\");`
            + `\n          el.textContent = status.crawlingStatus; el.style = status.crawlingStatusStyle;`
            + `\n          document.getElementById(\"crawl_static_data_btn\").disabled = isOfflineMode || status.isCrawling;`
            + `\n          document.getElementById(\"stop_crawling_btn\").disabled = isOfflineMode || !status.isCrawling;`
            + `\n          el = document.getElementById(\"crawl_web_res_lbl\")`
            + `\n          el.textContent = status.isWebResCompleted ? \"???????????????\" : \"???????????????\"; el.style = status.isWebResCompleted ? \"color: green\" : \"\";`
            + `\n          el = document.getElementById(\"crawl_assets_lbl\");`
            + `\n          el.textContent = status.isAssetsCompleted ? \"???????????????\" : \"???????????????\";el.style = status.isAssetsCompleted ? \"color: green\": \"\"`
            + `\n          el = document.getElementById(\"importstatus\");`
            + `\n          el.textContent = status.importStatus; el.style = status.importStatusStyle;`
            + `\n          document.getElementById(\"import_btn\").disabled = status.isDownloading || status.isImporting;`
            + `\n          el = document.getElementById(\"fsckresult\");`
            + `\n          el.textContent = status.fsckResult; el.style = status.fsckResultStyle;`
            + `\n          document.getElementById(\"fsck_btn\").disabled = status.isFscking;`
            + `\n          if (countdown > 0 && (status.isDownloading || status.isImporting || status.isCrawling || status.isFscking)) setTimeout(() => autoRefresh(--countdown), 500);`
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
            + `\n            el.value = el.value.replace(/^((?!???????????????????????????)|???????????????????????????)/, isOfflineMode ? \"???????????????????????????\" : \"\");`
            + `\n            el.disabled = isOfflineMode;`
            + `\n          });`
            + `\n        }`
            + `\n      }`
            + `\n      return isOfflineMode;`
            + `\n    }`
            + `\n    function unlock_prepare_download_btn() {`
            + `\n      if (!isOffline()) document.getElementById(\"prepare_download_btn\").removeAttribute(\"disabled\");`
            + `\n    }`
            + `\n    function localIPv4Select(selected) {`
            + `\n      let host = selected.id.replace(/^local_ipv4_addr_/, \"\").replace(/_/g, \".\");`
            + `\n      let el = document.getElementById(\"clash_yaml_link\");`
            + `\n      el.textContent = \`magirecolocal_\${host}_${httpProxyPort}.yaml\`;`
            + `\n      el.setAttribute(\"href\", \"/\" + el.textContent); el.setAttribute("target", "_blank");`
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
            + `\n  <h1>?????????????????????????????????${pkgVersionStr}</h1>`
            + `\n  <fieldset>`
            + `\n  <legend>HTTP??????</legend>`
            + `\n  <fieldset><legend>HTTP????????????</legend>`
            + `\n    <div>`
            + `\n      <label for=\"httpproxyaddr\">HTTP??????????????????</label>`
            + `\n      <input readonly id=\"httpproxyaddr\" value=\"${httpProxyAddr}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"httpproxyport\">HTTP??????????????????</label>`
            + `\n      <input readonly id=\"httpproxyport\" value=\"${httpProxyPort}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"httpproxyusername\">HTTP???????????????</label>`
            + `\n      <input readonly id=\"httpproxyusername\" value=\"${httpProxyUsername}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"httpproxypassword\">HTTP????????????</label>`
            + `\n      <input readonly id=\"httpproxypassword\" value=\"${httpProxyPassword}\">`
            + `\n    </div>`
            + `\n  </fieldset>`
            + `\n  <div>`
            + `\n  <fieldset><legend>??????HTTP??????????????????</legend>`
            + `\n    <form action=\"/api/toggle_loopback_listen\" method=\"post\">`
            + `\n      <div>`
            + `\n        <input type=\"submit\" value="${this.isTogglingLoopbackListen ? "??????" : ""}??????HTTP??????????????????" id="toggle_loopback_listen_btn" ${this.isTogglingLoopbackListen ? "disabled" : ""}>`
            + `\n      </div>`
            + `\n    </form>`
            + `\n  </fieldset>`
            + `\n  <ul>`
            + `\n  <li>`
            + `\n    ?????????<code>127.0.0.1</code>???<b>??????</b>???????????????HTTP????????????<b>?????????????????????????????????</b>???`
            + `\n  </li>`
            + `\n  <li>`
            + `\n    ??????${aHref("?????????????????????????????????", "#dumpuserdata", false)}????????????????????????${aHref("Bilibili??????", "#bilibilipwdauth", false)}????????????????????????Clash??????????????????????????????HTTP???????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n    ????????????${aHref("????????????", "#setmode", false)}????????????Clash??????????????????????????????HTTP???????????????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  </ul>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????CA??????</legend>`
            + `\n  <div>`
            + `\n    ${aHref("ca.crt", "/ca.crt")}`
            + `\n    <br><i>????????????????????????????????????????????????????????????????????????CA?????????</i>`
            + `\n    <br><i>???${aHref("???????????????", "#verbosedesc", false)}?????????????????????????????????CA?????????</i>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset id="clash_config_download">`
            + `\n  <legend>??????Clash????????????</legend>`
            + `\n  <div>`
            + `\n  ${httpProxyAddr === "127.0.0.1" ? "" : `${this.addrSelectHtml}`}`
            + `\n    ${httpProxyAddr === "127.0.0.1"
                ? aHref(`magirecolocal_${httpProxyAddr}_${httpProxyPort}.yaml`, `/magirecolocal_${httpProxyAddr}_${httpProxyPort}.yaml`)
                : aHref("???????????????????????????IP?????????", "#local_ipv4_addr_list", false, "clash_yaml_link")}`
            + `\n    <br><i>??????????????????HTTP???????????????????????????????????????????????????????????????????????????</i>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????????????????</legend>`
            + `\n    <fieldset><legend>???????????????</legend>`
            + `\n      <label for=\"paramsjson\"><b style=\"color: red\">??????????????????????????????????????????????????????</b></label>`
            + `\n      ${aHref("params.json", "/params.json")}`
            + `\n    </fieldset>`
            + `\n    <fieldset><legend>????????????????????????????????????</legend>`
            + `\n      <label for=\"overridesjson\"></label>`
            + `\n      ${aHref("overrides.json", "/overrides.json")}`
            + `\n    </fieldset>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????????????????</legend>`
            + `\n    <fieldset><legend>???????????????</legend>`
            + `\n      <form enctype=\"multipart/form-data\" action=\"/api/upload_params\" method=\"post\">`
            + `\n        <div>`
            + `\n          <input type=\"file\" name=\"uploaded_params\" id=\"params_file\">`
            + `\n        </div>`
            + `\n        <div>`
            + `\n          <input type=\"submit\" value=\"??????????????????\" id=\"upload_params_btn\">`
            + `\n        </div>`
            + `\n      </form>`
            + `\n    </fieldset>`
            + `\n    <fieldset><legend>????????????????????????????????????</legend>`
            + `\n      <form enctype=\"multipart/form-data\" action=\"/api/upload_overrides\" method=\"post\">`
            + `\n        <div>`
            + `\n          <input type=\"file\" name=\"uploaded_overrides\" id=\"overrides_file\">`
            + `\n        </div>`
            + `\n        <div>`
            + `\n          <input type=\"submit\" value=\"??????????????????\" id=\"upload_overrides_btn\">`
            + `\n        </div>`
            + `\n      </form>`
            + `\n    </fieldset>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2>??????</h2>`
            + `\n  <ol>`
            + `\n  <li>`
            + `\n  ???????????????????????????????????????????????????${aHref("Bilibili??????", "#bilibilipwdauth", false)}?????????????????????????????????????????????????????????????????????`
            + `\n  <br>??????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ???????????????${aHref("????????????????????????????????????", "#dumpuserdata", false)}??????????????????????????????????????????????????????????????????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ????????????${aHref("???????????????", officialURL.href)}????????????HTTP?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????`
            + `\n  <br>???????????????????????????????????????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  <li id=\"verbosedesc\">`
            + `\n  ${aHref("?????????????????????????????????????????????????????????????????????????????????????????????????????????", "javascript:swapVerboseDesc();", false)}`
            + `\n    <ul>`
            + `\n      <li>`
            + `\n        ${aHref("???????????????", patchedApkURL.href)}????????????????????????CA?????????`
            + `\n        <br>?????????????????????????????????${aHref("Android12???MuMuX?????????", mumuXURL.href)}???????????????`
            + `\n        <br>????????????????????????Android9????????????????????????????????????Android12???????????????`
            + `\n        <br>??????????????????????????????CA??????????????????????????????????????????Clash???`
            + `\n      </li><li>`
            + `\n        ??????????????????${aHref("?????????NodeJS", nodeJsUrl.href)}?????????${aHref("?????????????????????", npmRepoUrl.href)}<b>?????????????????????????????????Termux????????????????????????</b>??????Android????????????${aHref("???????????????", officialURL.href)}???${aHref("Clash for Android", clashURL.href)}???`
            + `\n        <br>?????????<code>adb -e reverse tcp:${httpProxyPort} tcp:${httpProxyPort}</code>?????????????????????????????????????????????Clash??????????????????`
            + `\n        <br>CA?????????????????????????????????????????????Clash??????Android????????????????????????????????????CA?????????${aHref("???????????????", patchedApkURL.href)}??????????????????`
            + `\n        <br>???<code>adb</code>???<code>-e</code>????????????????????????????????????????????????<code>-d</code>??????????????????????????????/??????????????????<code>-t</code>??????<code>adb devices -l</code>?????????transport_id???????????????<code>-t 2</code>???`
            + `\n      </li><li>`
            + `\n        ?????????Android????????????${aHref("Termux", termuxURL.href)}???????????????????????????`
            + `\n        <br>???????????????${aHref("??????", gsxnjURL.href)}?????????????????????${aHref("???????????????", officialURL.href)}???`
            + `\n        <br>????????????????????????CA???????????????${aHref("???????????????", patchedApkURL.href)}???????????????????????????CA????????????`
            + `\n        <br>Clash?????????????????????????????????????????????Clash?????????<b>???????????????????????????????????????App?????????????????????????????????????????????Termux????????????</b>???`
            + `\n        <br>????????????Clash???[??????]=>[??????????????????]?????????<b>[???????????????????????????]</b>????????????[???????????????????????????]???<b>??????????????????App</b>?????????????????????????????????????????????????????????autoBattle????????????`
            + `\n        <br><i>??????????????????????????????????????????????????????????????????Clash????????????????????????????????????????????????????????????????????????</i>`
            + `\n      </li><li>`
            + `\n        <b>??????Clash????????????????????????????????????????????????</b>??????????????????DIRECT?????????`
            + `\n      </li><li>`
            + `\n        ?????????Clash???????????????<b>[DNS??????]</b>???`
            + `\n      </li><li>`
            + `\n        <b>????????????${aHref("???????????????", patchedApkURL.href)}?????????????????????????????????CA???????????????????????????Android???????????????</b>`
            + `\n        <br><i>?????????<b>Root??????</b>?????????????????????Root?????????????????????????????????????????????????????????????????????????????????????????????????????????Clash??????Clash??????????????????????????????</i>`
            + `\n        <br>??????CA????????????????????????${aHref("autoBattle??????", autoBattleURL.href)}???????????????????????????????????????????????????????????????[??????CA??????]???????????????????????????`
            + `\n      </li><li>`
            + `\n        ?????????????????????Android 6???MuMu????????????????????????Clash for Android???????????????????????????????????????????????????MuMu?????????????????????Termux????????????Termux??????????????????????????????????????????????????????????????????????????????<b>??????MuMu????????????????????????????????????????????????????????????????????????????????????????????????</b>`
            + `\n      </li><li>`
            + `\n        Android 9??????????????????MuMu???????????????????????????????????????Clash????????????????????????????????????Clash??????????????????[??????????????????]???[DNS??????]???`
            + `\n      </li><li>`
            + `\n        ???????????????9???????????????????????????????????????????????????CA??????????????????????????????????????????????????????[????????????]=>[????????????]??????[????????????]??????<b>[System.vmdk?????????]</b>???`
            + `\n      </li>`
            + `\n    </ul>`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ??????????????????<b>??????</b>???${aHref("???????????????????????????", "#crawlstaticdata", false)}???????????????????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ?????????????????????????????????<b>?????????????????????</b>??????????????????????????????????????????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  ????????????<b>???????????????????????????????????????????????????????????????????????????????????????</b>???`
            + `\n  </li>`
            + `\n  <li>`
            + `\n  <b>???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????</b>`
            + `\n  </li>`
            + `\n  </ol>`
            + `\n  <hr>`
            + `\n  <h2>??????</h2>`
            + `\n  <fieldset id=\"setmode\">`
            + `\n  <legend>????????????</legend>`
            + `\n    <div>`
            + `\n      <input checked disabled type=\"radio\" id=\"mode_radio2\" name=\"mode\" value=\"local_offline\">`
            + `\n      <label for=\"mode_radio2\">??????????????????</label>`
            + `\n    </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <form action=\"/api/set_upstream_proxy\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"upstream_proxy_host\">??????????????????</label>`
            + `\n      <input id=\"upstream_proxy_host\" name=\"upstream_proxy_host\" value=\"${upstreamProxyHost}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"upstream_proxy_port\">??????????????????</label>`
            + `\n      <input id=\"upstream_proxy_port\" name=\"upstream_proxy_port\" value=\"${upstreamProxyPort}\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"upstream_proxy_enabled\" name=\"upstream_proxy_enabled\" value=\"true\" type=\"checkbox\" ${upstreamProxyEnabled ? "checked" : ""}>`
            + `\n      <label for=\"upstream_proxy_enabled\">??????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"????????????????????????\" id=\"set_upstream_proxy_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????CA??????</legend>`
            + `\n  <form enctype=\"multipart/form-data\" action=\"/api/upload_upstream_proxy_cacert\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"file\" name=\"upstream_proxy_cacert\" id=\"upstream_proxy_cacert\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" value=\"??????/??????????????????CA??????(PEM??????)\" id=\"upload_upstream_proxy_cacert_btn\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn1\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label style=\"${upstreamProxyCACertStyle}\" id=\"upstream_proxy_ca_status\" for=\"refreshbtn1\">${upstreamProxyCACertStatus}</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????????????????????????????</legend>`
            + `\n  <form action=\"/api/set_auto_open_web\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"auto_open_web\" name=\"auto_open_web\" value=\"true\" type=\"checkbox\" ${autoOpenWeb ? "checked" : ""}>`
            + `\n      <label for=\"auto_open_web\">??????????????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"set_auto_open_web_btn\" value=\"??????\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"bilibilipwdauth\">Bilibili??????</h2>`
            + `\n  <i>????????????????????????????????????????????????????????????????????????</i><br>`
            + `\n  <b>????????????????????????????????????????????????????????????????????????????????????????????????????????????</b>????????????<b>????????????</b>???????????????????????????????????????????????????????????????<br>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn2\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label style=\"${loginStatusStyle}\" id=\"loginstatus\" for=\"refreshbtn2\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>?????????????????????</legend>`
            + `\n  <form action=\"/api/pwdlogin\" method=\"post\">`
            + `\n    <div>`
            + `\n      <label for=\"username\">??????</label>`
            + `\n      <input name=\"username\" id=\"username\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <label for=\"password\">??????</label>`
            + `\n      <input name=\"password\" id=\"password\" type=\"password\" value=\"\">`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"loginbtn\" value=\"${loginBtnText}\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????????????????</legend>`
            + `\n  <form action=\"/api/clear_bilibili_login\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_bilibili_login_btn\" value=\"??????B???????????????\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/clear_bsgamesdk_ids\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_bsgamesdk_ids_btn\" value=\"??????B??????????????????????????????ID\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"dumpuserdata\">????????????????????????</h2>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn3\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label style=\"${openIdTicketStatusStyle}\" id=\"openidticketstatus\" for=\"refreshbtn3\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <form action=\"/api/dump_userdata\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"fetch_chara_enhance_tree_checkbox\" name=\"fetch_chara_enhance_tree\" value=\"true\" type=\"checkbox\" ${this.params.fetchCharaEnhancementTree ? "checked" : ""}>`
            + `\n      <label for=\"fetch_chara_enhance_tree_checkbox\">????????????????????????????????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"arena_simulate_checkbox\" name=\"arena_simulate\" value=\"true\" type=\"checkbox\" ${this.params.arenaSimulate ? "checked" : ""}>`
            + `\n      <label for=\"arena_simulate_checkbox\"><b>?????????????????????????????????????????????1BP???</b>??????????????????????????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"concurrent_fetch_checkbox\" name=\"concurrent_fetch\" value=\"true\" type=\"checkbox\" ${this.params.concurrentFetch ? "checked" : ""}>`
            + `\n      <label for=\"concurrent_fetch_checkbox\">??????????????????</label>`
            + `\n    </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n    <div>`
            + `\n      <input id=\"new_download_checkbox\" name=\"new\" value=\"true\" type=\"checkbox\" ${this.userdataDmp.lastError != null ? "checked" : ""}>`
            + `\n      <label for=\"new_download_checkbox\" onclick=\"unlock_prepare_download_btn();\">?????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" ${isDownloading || isImporting ? "disabled" : ""} value=\"???????????????\" id=\"prepare_download_btn\">`
            + `\n      <br><i>?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????</i>`
            + `\n      <br><i>???????????????????????????????????????????????????????????????</i>`
            + `\n      <br><b style=\"color: red\">??????????????????????????????????????????????????????????????????????????????</b>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn4\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label id=\"userdatadumpstatus\" style=\"${userdataDumpStatusStyle}\" for=\"refreshbtn4\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????????????????</legend>`
            + `\n  <form action=\"/api/clear_game_login\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_game_login_btn\" value=\"????????????????????????\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/clear_magireco_ids\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"clear_magireco_ids_btn\" value=\"???????????????????????????????????????ID\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>${this.userdataDmp.lastDump == null ? "?????????????????????????????????" : "??????????????????????????????????????????"}</legend>`
            + `\n    ${this.userdataDmp.lastDump == null ? "" : "<b>?????????????????????????????????????????????</b>"}`
            + `\n    ${this.userdataDmp.lastDump == null ? "" : "<br>" + aHref(this.userdataDmp.userdataDumpFileName, `/${this.userdataDmp.userdataDumpFileName}`)}`
            + `\n    ${this.userdataDmp.lastDump == null ? "" : "<br><i>??????????????????????????????????????????????????????????????????????????????0?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????</i>"}`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>???????????????????????????????????????</legend>`
            + `\n    <form enctype=\"multipart/form-data\" action=\"/api/upload_dump\" method=\"post\">`
            + `\n      <div>`
            + `\n        <input type=\"file\" name=\"uploaded_dump\" id=\"dump_file\">`
            + `\n      </div>`
            + `\n      <div>`
            + `\n        <input type=\"submit\" value=\"???????????????\" id=\"import_btn\" ${isDownloading || isImporting ? "disabled" : ""}>`
            + `\n        <label for=\"import_btn\"><b>???????????????????????????????????????????????????</b></label>`
            + `\n      </div>`
            + `\n    </form>`
            + `\n    <fieldset>`
            + `\n    <legend>????????????</legend>`
            + `\n    <div>`
            + `\n      <button id=\"refreshbtn7\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n      <label id=\"importstatus\" style=\"${userdataDumpStatusStyle}\" for=\"refreshbtn7\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n    </div>`
            + `\n    </fieldset>`
            + `\n  </fieldset>`
            + `\n  <hr>`
            + `\n  <h2 id=\"crawlstaticdata\">??????????????????????????????</h2>`
            + `\n  <fieldset>`
            + `\n  <legend>????????????</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn5\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label id=\"crawlingstatus\" style=\"${crawlingStatusStyle}\" for=\"refreshbtn5\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>??????</legend>`
            + `\n  <form action=\"/api/crawl_static_data\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input id=\"crawl_web_res\" name=\"crawl_web_res\" value=\"true\" type=\"checkbox\" ${crawlWebRes ? "checked" : ""}>`
            + `\n      <label for=\"crawl_web_res\">??????Web?????????<b id=\"crawl_web_res_lbl\">TO_BE_FILLED_BY_JAVASCRIPT</b>???????????????????????????????????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"crawl_assets\" name=\"crawl_assets\" value=\"true\" type=\"checkbox\" ${crawlAssets ? "checked" : ""}>`
            + `\n      <label for=\"crawl_assets\">?????????????????????<b id=\"crawl_assets_lbl\">TO_BE_FILLED_BY_JAVASCRIPT</b>??????????????????????????????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input id=\"concurrent_crawl_checkbox\" name=\"concurrent_crawl\" value=\"true\" type=\"checkbox\" ${this.params.concurrentCrawl ? "checked" : ""}>`
            + `\n      <label for=\"concurrent_crawl_checkbox\">??????????????????</label>`
            + `\n    </div>`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"crawl_static_data_btn\" ${isCrawling ? "disabled" : ""} value=\"????????????\">`
            + `\n      <br><i>???????????????????????????????????????????????????????????????</i>`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  <form action=\"/api/stop_crawling\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"stop_crawling_btn\" ${isCrawling ? "" : "disabled"} value=\"????????????\">`
            + `\n    </div>`
            + `\n  </form>`
            + `\n  </fieldset>`
            + `\n  <fieldset>`
            + `\n  <legend>?????????????????????</legend>`
            + `\n  <div>`
            + `\n    <button id=\"refreshbtn6\" onclick=\"window.location.reload(true);\">??????</button>`
            + `\n    <label id=\"fsckresult\" style=\"${fsckResultStyle}\" for=\"refreshbtn6\">TO_BE_FILLED_BY_JAVASCRIPT</label>`
            + `\n  </div>`
            + `\n  <form action=\"/api/fsck\" method=\"post\">`
            + `\n    <div>`
            + `\n      <input type=\"submit\" id=\"fsck_btn\" ${isFscking ? "" : "disabled"} value=\"????????????\">`
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
            + `\n</html>`;
        return html;
    }
    getGameUid(openIdTicket) {
        const open_id = openIdTicket === null || openIdTicket === void 0 ? void 0 : openIdTicket.open_id;
        const uidMatched = open_id === null || open_id === void 0 ? void 0 : open_id.match(/\d+$/);
        return uidMatched != null && !isNaN(Number(uidMatched[0])) ? (Number(uidMatched[0])) : undefined;
    }
    getStatus(gameUid) {
        var _a;
        let userdataDumpStatus = "???????????????????????????", userdataDumpStatusStyle = "color: red";
        ;
        const isDownloading = this.userdataDmp.isDownloading;
        const lastDump = this.userdataDmp.lastDump;
        if (isDownloading)
            userdataDumpStatus = `?????????????????? ${this.userdataDmp.fetchStatus}`, userdataDumpStatusStyle = "color: blue";
        else if (lastDump != null) {
            const lastUid = lastDump.uid;
            const topPageUrl = `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
                + `user`
                + `%2CgameUser`
                + `%2CitemList`
                + `%2CgiftList`
                + `%2CpieceList`
                + `%2CuserQuestAdventureList`
                + `&timeStamp=`;
            const topPage = userdataDump.getUnBrBody(lastDump.httpResp.get, topPageUrl);
            const loginName = (_a = topPage === null || topPage === void 0 ? void 0 : topPage.user) === null || _a === void 0 ? void 0 : _a.loginName;
            const downloadDate = new Date(lastDump.timestamp);
            const downloadDateStr = `${downloadDate.toLocaleDateString()} ${downloadDate.toLocaleTimeString()}`;
            userdataDumpStatus = `??????????????????????????? uid=[${lastUid}] ?????????(???B????????????)=[${loginName}] ????????????(???????????????????????????)=[${downloadDateStr}]`;
            if (this.userdataDmp.lastError != null) {
                userdataDumpStatus = `???????????????????????? status=[${this.userdataDmp.fetchStatus}] lastError=[${this.userdataDmp.lastError}] ?????????${userdataDumpStatus}???`;
                userdataDumpStatusStyle = "color: orange";
            }
            else {
                userdataDumpStatusStyle = "color: green";
            }
        }
        else if (this.userdataDmp.lastError != null)
            userdataDumpStatus = `????????????????????????????????????  ${this.userdataDmp.fetchStatus}`, userdataDumpStatusStyle = "color: red";
        let crawlingStatus = this.crawler.crawlingStatus, crawlingStatusStyle = "color: grey";
        const isCrawling = this.crawler.isCrawling;
        if (this.crawler.isCrawlingFullyCompleted) {
            crawlingStatus = "?????????????????????";
            crawlingStatusStyle = "color: green";
        }
        else if (this.crawler.isCrawling) {
            crawlingStatusStyle = "color: blue";
        }
        else {
            if (crawlingStatus == null || crawlingStatus === "") {
                crawlingStatus = "????????????????????????????????????";
            }
            if (this.crawler.lastError != null)
                crawlingStatusStyle = "color: red";
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
        const isImporting = this.userdataDmp.isImporting;
        let importStatus = "", importStatusStyle = "color: red";
        if (isImporting) {
            importStatus = "????????????...";
            importStatusStyle = "color: blue";
        }
        else {
            const lastImportError = this.userdataDmp.lastImportError;
            if (lastImportError == null) {
                importStatus = "?????????";
                importStatusStyle = "color: green";
            }
            else {
                importStatus = "??????????????????";
                importStatusStyle = "color: red";
                if (lastImportError instanceof Error)
                    importStatus += ` [${lastImportError.message}]`;
            }
        }
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
            isImporting: isImporting,
            importStatus: importStatus,
            importStatusStyle: importStatusStyle,
        };
    }
    get addrSelectHtml() {
        let addrList = [];
        try {
            const interfaces = os.networkInterfaces();
            Object.values(interfaces).forEach((array) => array === null || array === void 0 ? void 0 : array.filter((info) => info.family === "IPv4").forEach((addr) => addrList.push(addr.address)));
        }
        catch (e) {
            console.error(e);
        }
        const max = 10;
        if (addrList.length > max) {
            console.error(`addrList.length=[${addrList.length}] > ${max}`);
            let list = addrList;
            addrList = [];
            for (let i = 0; i < max; i++)
                addrList.push(list[i]);
        }
        return `<fieldset id=\"local_ipv4_addr_list\"><legend>??????IP????????????</legend>\n`
            + `${addrList.map((addr) => `<div><input type=\"radio\" name=\"local_ipv4_addr\" id=\"local_ipv4_addr_${addr.replace(/\./g, "_")}\"`
                + ` onclick=\"localIPv4Select(this);\">`
                + `<label for=\"local_ipv4_addr_${addr.replace(/\./g, "_")}\">${addr}</label>`
                + `</div>`).join("\n")}\n`
            + `</fieldset>`;
    }
    async sendResultAsync(res, statusCode, result, isJson = false) {
        return new Promise((resolve, reject) => {
            if (!isJson) {
                let strRep = (0, get_str_rep_1.getStrRep)(result);
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
                    + `\n  <label for=\"backbtn\">${statusCode == 200 ? "????????????????????????" : "??????"}</label>`
                    + `\n  <br><b>????????????????????????????????????????????????????????????</b>`
                    + `\n  <button id=\"backbtn\" onclick=\"window.history.back();\">?????? Back</button>`
                    + `\n  <hr>`
                    + `\n  <label for=\"httpstatus\">HTTP Status Code</label>`
                    + `\n  <textarea id=\"httpstatus\" readonly rows=\"1\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                    + `\n  <br>`
                    + `\n  <label for=\"result\">${statusCode == 200 ? "?????? Result" : "???????????? Error Message"}</label>`
                    + `\n  <textarea id=\"result\" readonly rows=\"20\" cols=\"64\">TO_BE_FILLED_BY_JAVASCRIPT</textarea>`
                    + `\n</body>`
                    + `\n</html>`;
                result = html;
            }
            res.on('error', (err) => { console.error(err); resolve(); }); // prevent crash
            res.writeHead(statusCode, { 'Content-Type': isJson ? 'application/json' : 'text/html' });
            res.end(result, () => resolve());
        });
    }
}
exports.controlInterface = controlInterface;
