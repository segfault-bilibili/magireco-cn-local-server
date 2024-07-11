"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawler = void 0;
const util_1 = require("./util");
const parameters = require("./parameters");
const http2 = require("http2");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zipped_assets_1 = require("./zipped_assets");
class crawler {
    get timeStampSec() {
        let ts = new Date().getTime();
        let tsSec = Math.trunc(ts / 1000);
        return String(tsSec);
    }
    get httpsProdMagicaNoSlash() { return `https://${_a.prodHost}/magica`; }
    get httpsPatchMagicaNoSlash() { return `https://${_a.patchHost}/magica`; }
    get isCrawling() {
        return this._isCrawling;
    }
    get lastError() {
        return this._lastError;
    }
    get crawlingStatus() {
        return this._crawlingStatus;
    }
    get isCrawlingFullyCompleted() {
        return !this._isCrawling && this.isCrawlingCompleted && !this.stopCrawling;
    }
    get isFscking() {
        const fsckStatus = this._fsckStatus;
        if (fsckStatus == null)
            return false;
        return fsckStatus.remaining > 0;
    }
    get lastFsckResult() {
        const fsckStatus = this._fsckStatus;
        if (fsckStatus == null)
            return "";
        return `[${fsckStatus.passed}] passed, [${fsckStatus.deleted}] deleted, [${fsckStatus.remaining}] remaining`
            + `, [${fsckStatus.notPassed}] missing/mismatch/error`;
    }
    get fsckStatus() {
        return this._fsckStatus;
    }
    constructor(params, localsvr, zippedAssets) {
        this.isWebResCompleted = false;
        this.isAssetsCompleted = false;
        this.localRootDir = path.join(".", "static");
        this.localConflictDir = path.join(".", "conflict"); // actually never used
        this.localStagingCNDir = path.join(".", "static_staging_cn");
        this.stopCrawling = false;
        this._isCrawling = false;
        this._crawlingStatus = "";
        this.isCrawlingCompleted = false;
        this.params = params;
        this.localServer = localsvr;
        this.zippedAssets = zippedAssets;
        this.device_id = [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
            .toString('hex').substring(0, len)).join("-");
        if (!fs.existsSync(_a.staticFileMapPath) && !fs.existsSync(_a.staticFileMapPathUncomp)) {
            console.error(`creating new staticFileMap`);
            this.staticFileMap = new Map();
        }
        else
            try {
                let json;
                if (fs.existsSync(_a.staticFileMapPathUncomp) && fs.statSync(_a.staticFileMapPathUncomp).isFile()) {
                    let uncompressed = fs.readFileSync(_a.staticFileMapPathUncomp);
                    json = uncompressed.toString('utf-8');
                    let compressed = (0, util_1.compress)(uncompressed, 'br', _a.brotliQuality);
                    fs.writeFileSync(_a.staticFileMapPath, compressed);
                    fs.rmSync(_a.staticFileMapPathUncomp);
                }
                else {
                    let compressed = fs.readFileSync(_a.staticFileMapPath);
                    json = (0, util_1.decompress)(compressed, "br").toString("utf-8");
                }
                let map = JSON.parse(json, util_1.reviver);
                if (!(map instanceof Map))
                    throw new Error(`not instance of map`);
                this.staticFileMap = map;
            }
            catch (e) {
                console.error(`error loading staticFileMap, creating new one`, e);
                this.staticFileMap = new Map();
            }
        // remove "virtual" files if they still exist in the map
        this.staticFileMap.delete("/maintenance/magica/config");
        this.staticFileMap.delete("/favicon.ico");
        if (!fs.existsSync(_a.staticFile404SetPath) && !fs.existsSync(_a.staticFile404SetPathUncomp)) {
            console.error(`creating new staticFile404Set`);
            this.staticFile404Set = new Set();
        }
        else
            try {
                let json;
                if (fs.existsSync(_a.staticFile404SetPathUncomp) && fs.statSync(_a.staticFile404SetPathUncomp).isFile()) {
                    let uncompressed = fs.readFileSync(_a.staticFile404SetPathUncomp);
                    json = uncompressed.toString('utf-8');
                    let compressed = (0, util_1.compress)(uncompressed, 'br', _a.brotliQuality);
                    fs.writeFileSync(_a.staticFile404SetPath, compressed);
                    fs.rmSync(_a.staticFile404SetPathUncomp);
                }
                else {
                    let compressed = fs.readFileSync(_a.staticFile404SetPath);
                    json = (0, util_1.decompress)(compressed, "br").toString("utf-8");
                }
                let set = JSON.parse(json, util_1.reviver);
                if (!(set instanceof Set))
                    throw new Error(`not instance of set`);
                this.staticFile404Set = set;
            }
            catch (e) {
                console.error(`error loading staticFile404Set, creating new one`, e);
                this.staticFile404Set = new Set();
            }
        this.checkStaticCompleted().then((result) => {
            this.isWebResCompleted = result.isWebResCompleted;
            this.isAssetsCompleted = result.isAssetsCompleted;
        });
    }
    static async init(params, localsvr, zippedAssets) {
        return new _a(params, localsvr, zippedAssets);
    }
    fetchAllAsync() {
        return new Promise((resolve, reject) => this.getFetchAllPromise()
            .then((result) => resolve(result))
            .catch((err) => {
            this.params.save({ key: "openIdTicket", val: undefined })
                .finally(() => {
                this._isCrawling = false;
                reject(this._lastError = err);
            });
        }).finally(() => {
            // not changing this._crawlingStatus
            this.checkStaticCompleted().then((result) => {
                this.isWebResCompleted = result.isWebResCompleted;
                this.isAssetsCompleted = result.isAssetsCompleted;
            }).catch((e) => {
                console.error(e);
            }).finally(() => {
                this.saveFileMeta();
            });
        }));
    }
    async getFetchAllPromise() {
        if (this.params.mode === parameters.mode.LOCAL_OFFLINE)
            throw new Error("cannot crawl in local offline mode");
        if (this._isCrawling)
            throw new Error("previous crawling has not finished");
        if (this.isFscking)
            throw new Error("is still fsck'ing, cannot start crawling");
        this.stopCrawling = false;
        this._isCrawling = true;
        this.isCrawlingCompleted = false;
        this._lastError = undefined;
        this._crawlingStatus = "";
        const crawlWebRes = this.params.crawlWebRes, crawlAssets = this.params.crawlAssets;
        if (crawlWebRes) {
            console.log(this._crawlingStatus = `crawling index.html ...`);
            let indexHtml = await this.fetchSinglePage(_a.prodHost, "/magica/index.html", _a.htmlRegEx);
            let matched = indexHtml.match(/<head\s+time="(\d+)"/);
            if (matched == null)
                throw this._lastError = new Error(`cannot match time in index.html`);
            let headTime = parseInt(matched[1]);
            if (isNaN(headTime))
                throw this._lastError = new Error(`headTime is NaN`);
            console.log(this._crawlingStatus = `crawling baseConfig.js ...`);
            await this.fetchSinglePage(_a.prodHost, `/magica/js/_common/baseConfig.js?v=${headTime}`, _a.javaScriptRegEx);
            console.log(this._crawlingStatus = `crawling files in replacement.js ...`);
            await this.fetchFilesInReplacementJs(headTime);
        }
        if (crawlAssets) {
            console.log(this._crawlingStatus = `crawling assets ...`);
            let assetConfigObj = await this.fetchAssetConfig();
            await this.fetchAssets(assetConfigObj);
        }
        console.log(this._crawlingStatus = `${this.stopCrawling ? "stopped crawling" : "crawling completed"}`);
        this._isCrawling = false;
        this.isCrawlingCompleted = true;
    }
    getContentType(pathInUrl) {
        return zipped_assets_1.zippedAssets.getContentType(pathInUrl);
    }
    readFile(pathInUrl) {
        // legacy
        const readPath = path.join(this.localRootDir, pathInUrl);
        if (fs.existsSync(readPath) && fs.statSync(readPath).isFile()) {
            return fs.readFileSync(readPath);
        }
    }
    deleteFileIfMatch(pathInUrl, md5, deletedSet) {
        let filePath = path.join(this.localRootDir, pathInUrl);
        if (!fs.existsSync(filePath))
            return;
        if (!fs.statSync(filePath).isFile())
            return;
        let data = fs.readFileSync(filePath);
        if (data == null)
            return;
        let calc = crypto.createHash('md5').update(data).digest().toString('hex').toLowerCase();
        if (calc === md5) {
            fs.unlinkSync(filePath);
            deletedSet.add(pathInUrl);
            console.log(`deleted matched file ${filePath}`);
        }
        let dirname = path.dirname(filePath);
        while (dirname.startsWith(this.localRootDir)
            && fs.existsSync(dirname) && fs.statSync(dirname).isDirectory()
            && fs.readdirSync(dirname).length == 0) {
            fs.rmdirSync(dirname);
            console.log(`deleted empty dir [${dirname}]`);
            let parent = path.dirname(dirname);
            if (parent === dirname)
                break;
            else
                dirname = parent;
        }
    }
    async readFileAsync(pathInUrl) {
        // not checking md5 here
        // (1) check ./static_staging/ first
        let readPath = path.join(this.localStagingCNDir, pathInUrl);
        if (fs.existsSync(readPath) && fs.statSync(readPath).isFile()) {
            return fs.readFileSync(readPath);
        }
        // (2) then ./static/
        readPath = path.join(this.localRootDir, pathInUrl);
        if (fs.existsSync(readPath) && fs.statSync(readPath).isFile()) {
            return fs.readFileSync(readPath);
        }
        // (3) then ./static_zip/ if not found
        return await this.zippedAssets.readFileAsync(pathInUrl);
    }
    saveFile(pathInUrl, content, contentType, preCalcMd5) {
        let logPrefix = `saveFile`;
        const md5ToWrite = preCalcMd5 != null ? preCalcMd5 : crypto.createHash("md5").update(content).digest('hex');
        if (this.checkAlreadyExist(pathInUrl, md5ToWrite)) {
            console.log(`${logPrefix} already exist [${pathInUrl}]`);
        }
        else {
            // file does not exist or it's moved away just now
            const writePath = path.join(this.localRootDir, pathInUrl);
            fs.writeFileSync(writePath, content);
            console.log(`${logPrefix} written to [${pathInUrl}]`);
        }
        this.updateFileMeta(pathInUrl, md5ToWrite, contentType);
    }
    checkAlreadyExist(pathInUrl, givenMd5) {
        let logPrefix = `checkAlreadyExist`;
        const writePath = path.join(this.localRootDir, pathInUrl);
        // firstly mkdir -p
        const dirName = path.dirname(writePath);
        if (!fs.existsSync(dirName))
            fs.mkdirSync(dirName, { recursive: true });
        if (!fs.statSync(dirName).isDirectory())
            throw new Error(`dirName=[${dirName}] is not directory`);
        // if the file does not exist, then it's okay to write
        if (!fs.existsSync(writePath))
            return false; // file does not exist, just as expected
        // unfortunately, the file already exists, but it would still be okay if the md5 matches
        if (!fs.statSync(writePath).isFile())
            throw new Error(`writePath=[${writePath}] exists but it is not a file`);
        const calculatedMd5 = crypto.createHash("md5").update(fs.readFileSync(writePath)).digest('hex');
        if (calculatedMd5 === givenMd5)
            return true; // fortunately the md5 matches!
        // unfortunately the md5 doesn't match, move the mismatched file away
        const pathInConflictDir = path.join(this.localConflictDir, pathInUrl);
        const moveToDir = path.join(path.dirname(pathInConflictDir), calculatedMd5);
        fs.mkdirSync(moveToDir, { recursive: true });
        if (!fs.statSync(moveToDir).isDirectory())
            throw new Error(`moveToDir=[${moveToDir}] is not directory`);
        const moveToPath = path.join(moveToDir, path.basename(pathInUrl));
        fs.renameSync(writePath, moveToPath);
        console.log(`${logPrefix}: moved ${writePath} to ${moveToPath}`);
        return false; // don't know how to updateFileMeta without known contentType, let saveFile do this
    }
    updateFileMeta(pathInUrl, md5, contentType) {
        var _b;
        const meta = { md5: md5 };
        if (contentType != null)
            meta.contentType = contentType;
        const metaArray = ((_b = this.staticFileMap.get(pathInUrl)) === null || _b === void 0 ? void 0 : _b.filter((item) => item.md5 !== md5)) || [];
        metaArray.unshift(meta);
        this.staticFileMap.set(pathInUrl, metaArray);
    }
    saveFileMeta() {
        console.log(`saving stringifiedMap ...`);
        let stringifiedMap = JSON.stringify(this.staticFileMap, util_1.replacer);
        let compressedMap = (0, util_1.compress)(Buffer.from(stringifiedMap, 'utf-8'), 'br', _a.brotliQuality);
        fs.writeFileSync(_a.staticFileMapPath, compressedMap);
        console.log(`saved stringifiedMap`);
        console.log(`saving stringified404Set ...`);
        let stringified404Set = JSON.stringify(this.staticFile404Set, util_1.replacer);
        let compressed404Set = (0, util_1.compress)(Buffer.from(stringified404Set, 'utf-8'), 'br', _a.brotliQuality);
        fs.writeFileSync(_a.staticFile404SetPath, compressed404Set);
        console.log(`saved stringified404Set`);
    }
    fsck() {
        return new Promise((resolve, reject) => {
            if (this._isCrawling) {
                reject(new Error(`is still crawling, cannot perform fsck`));
                return;
            }
            if (this.isFscking) {
                reject(new Error(`is already performing fsck`));
                return;
            }
            const total = this.staticFileMap.size;
            this._fsckStatus = {
                passed: 0,
                deleted: 0,
                remaining: total,
                notPassed: 0,
            };
            const okaySet = new Set(), notOkaySet = new Set();
            const deletedSet = new Set();
            const checkNextFile = (it) => {
                const val = it.next();
                if (val.done) {
                    this._fsckStatus = {
                        passed: okaySet.size,
                        deleted: deletedSet.size,
                        remaining: total - okaySet.size - notOkaySet.size,
                        notPassed: notOkaySet.size,
                    };
                    console.log(this.lastFsckResult);
                    notOkaySet.forEach((pathInUrl) => this.staticFileMap.delete(pathInUrl));
                    resolve(notOkaySet.size == 0);
                    return;
                }
                const pathInUrl = val.value[0], fileMetaArray = val.value[1];
                new Promise(async (resolve) => {
                    let okay = false;
                    try {
                        let data = await this.zippedAssets.readFileAsync(pathInUrl);
                        if (data == null) {
                            okay = false;
                            console.log(`[${pathInUrl}] missing`);
                        }
                        else {
                            let md5 = crypto.createHash('md5').update(data).digest().toString('hex').toLowerCase();
                            okay = md5 === fileMetaArray[0].md5;
                            if (okay) {
                                // remove legacy asset file in ./static/ if it's available in zippedAssets
                                this.deleteFileIfMatch(pathInUrl, fileMetaArray[0].md5, deletedSet);
                            }
                            else {
                                console.log(`[${pathInUrl}] is modified, expected ${fileMetaArray[0].md5} actual ${md5}`);
                            }
                        }
                        // if (this.checkAlreadyExist(pathInUrl, fileMetaArray[0].md5)) okay = true;
                    }
                    catch (e) {
                        console.error(e);
                    }
                    if (okay) {
                        okaySet.add(pathInUrl);
                    }
                    else {
                        notOkaySet.add(pathInUrl);
                    }
                    this._fsckStatus = {
                        passed: okaySet.size,
                        deleted: deletedSet.size,
                        remaining: total - okaySet.size - notOkaySet.size,
                        notPassed: notOkaySet.size,
                    };
                    resolve();
                }).then(() => setTimeout(() => checkNextFile(it))); // setTimeout to prevent stall
            };
            checkNextFile(this.staticFileMap.entries());
        });
    }
    isKnown404(pathInUrl) {
        return this.staticFile404Set.has(pathInUrl);
    }
    async checkStaticCompleted() {
        var _b, _c;
        const unsortedFileExtSet = new Set();
        let isWebResCompleted;
        try {
            const replacementJs = (_b = (await this.zippedAssets.readFileAsync("/magica/js/system/replacement.js"))) === null || _b === void 0 ? void 0 : _b.toString('utf-8');
            if (replacementJs != null) {
                const fileTimeStampObj = JSON.parse(replacementJs.replace(/^\s*window\.fileTimeStamp\s*=\s*/, ""));
                for (let subPath in fileTimeStampObj) {
                    let matched = subPath.match(_a.fileExtRegEx);
                    if (matched)
                        unsortedFileExtSet.add(matched[0]);
                }
                let completed = true;
                for (let subPath in fileTimeStampObj) {
                    let key = `/magica/${subPath}`.split("/").map((s) => encodeURIComponent(s)).join("/");
                    if (!this.staticFileMap.has(key) && !this.staticFile404Set.has(key)) {
                        console.log(`[${key}] is still missing`);
                        completed = false;
                        break;
                    }
                }
                isWebResCompleted = completed;
            }
        }
        catch (e) {
            isWebResCompleted = false;
            console.error(e);
        }
        this.isWebResCompleted = isWebResCompleted != null ? isWebResCompleted : false;
        let isAssetsCompleted;
        try {
            let completed;
            const maintenanceConfigStr = _a.maintenanceConfigStr;
            if (maintenanceConfigStr != null) {
                const assetver = this.readAssetVer(maintenanceConfigStr);
                const mergedAssetList = [];
                let allAssetListExists = true;
                for (let fileName of _a.assetListFileNameList) {
                    const assetListStr = (_c = (await this.zippedAssets.readFileAsync(`/magica/resource/download/asset/master/resource/${assetver}/${fileName}`))) === null || _c === void 0 ? void 0 : _c.toString('utf-8');
                    if (assetListStr == null) {
                        allAssetListExists = false;
                        break;
                    }
                    const assetList = JSON.parse(assetListStr);
                    assetList.forEach((item) => mergedAssetList.push(item));
                }
                if (allAssetListExists) {
                    mergedAssetList.forEach((item) => {
                        let matched = item.file_list[0].url.match(_a.fileExtRegEx);
                        if (matched)
                            unsortedFileExtSet.add(matched[0]);
                    });
                    completed = true;
                    mergedAssetList.find((item) => {
                        const fileName = item.file_list[0].url;
                        const key = `/magica/resource/download/asset/master/resource/${fileName}`;
                        if (!this.staticFileMap.has(key) && !this.staticFile404Set.has(key)) {
                            console.log(`[${key}] is still missing`);
                            completed = false;
                            return true;
                        }
                    });
                }
                else {
                    completed = false;
                }
                isAssetsCompleted = completed;
            }
        }
        catch (e) {
            isAssetsCompleted = false;
            console.error(e);
        }
        try {
            const writePath = path.join(".", "fileExtSet.json");
            const fileExtArray = Array.from(unsortedFileExtSet.keys()).sort();
            const fileExtSet = new Set(fileExtArray);
            const stringified = JSON.stringify(fileExtSet, util_1.replacer, 4);
            let noChange = false;
            if (fs.existsSync(writePath) && fs.statSync(writePath).isFile()) {
                const content = fs.readFileSync(writePath, 'utf-8');
                if (content === stringified)
                    noChange = true;
            }
            if (!noChange)
                fs.writeFileSync(writePath, stringified);
        }
        catch (e) {
            console.error(e);
        }
        return {
            isWebResCompleted: isWebResCompleted == null ? false : isWebResCompleted,
            isAssetsCompleted: isAssetsCompleted == null ? false : isAssetsCompleted,
        };
    }
    async http2Request(url, overrideReqHeaders, cvtBufToStr = false, postData) {
        const method = postData == null ? http2.constants.HTTP2_METHOD_GET : http2.constants.HTTP2_METHOD_POST;
        const host = url.host, hostname = url.hostname;
        const authorityURL = new URL(`https://${host}/`);
        const path = `${url.pathname}${url.search}`;
        const reqHeaders = overrideReqHeaders || {
            [http2.constants.HTTP2_HEADER_METHOD]: method,
            [http2.constants.HTTP2_HEADER_PATH]: path,
            [http2.constants.HTTP2_HEADER_AUTHORITY]: hostname,
            [http2.constants.HTTP2_HEADER_HOST]: host,
            [http2.constants.HTTP2_HEADER_USER_AGENT]: `Mozilla/5.0 (Linux; Android 6.0.1; MuMu Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36`,
            [http2.constants.HTTP2_HEADER_ACCEPT]: "*/*",
            [http2.constants.HTTP2_HEADER_REFERER]: `https://${host}/magica/index.html`,
            [http2.constants.HTTP2_HEADER_ACCEPT_LANGUAGE]: `zh-CN,en-US;q=0.9`,
            ["X-Requested-With"]: `com.bilibili.madoka.bilibili`,
        };
        const fileExtMatched = url.pathname.match(_a.fileExtRegEx);
        if (fileExtMatched != null && _a.compressableFileExtSet.has(fileExtMatched[0])) {
            reqHeaders[http2.constants.HTTP2_HEADER_ACCEPT_ENCODING] = `gzip, deflate`;
        }
        const resp = await this.localServer.sendHttp2RequestAsync(authorityURL, reqHeaders, postData, cvtBufToStr);
        const respHeaders = resp.headers;
        const statusCode = respHeaders[":status"];
        if (statusCode != 200 && statusCode != 404)
            throw new Error(`statusCode=[${statusCode}]`);
        let contentType = respHeaders[http2.constants.HTTP2_HEADER_CONTENT_TYPE];
        if (contentType != null && Array.isArray(contentType))
            contentType = contentType.join(";");
        let result = {
            is404: statusCode == 404,
            body: resp.respBody,
        };
        if (contentType != null)
            result.contentType = contentType;
        return result;
    }
    async http2GetStr(url, overrideReqHeaders) {
        return await this.http2Request(url, overrideReqHeaders, true);
    }
    async http2GetBuf(url, overrideReqHeaders) {
        return await this.http2Request(url, overrideReqHeaders, false);
    }
    async http2PostRetStr(url, postData, overrideReqHeaders) {
        return await this.http2Request(url, overrideReqHeaders, true, postData);
    }
    async http2PostRetBuf(url, postData, overrideReqHeaders) {
        return await this.http2Request(url, overrideReqHeaders, false, postData);
    }
    async batchHttp2GetSave(stageStr, urlList) {
        let urlStrSet = new Set(), abandonedSet = new Set(), skippedSet = new Set();
        let currentStaticFile404Set = new Set();
        urlList.forEach((item) => {
            const url = item.url;
            const key = url.pathname;
            if (urlStrSet.has(key))
                throw new Error(`found duplicate url=${key} in urlList`);
            urlStrSet.add(key);
        });
        const total = urlList.length;
        const concurrent = this.params.concurrentCrawl ? 8 : 1;
        const retries = 5;
        let resultSet = new Set();
        let hasError = false, stoppedCrawling = false;
        const saveFileMetaInterval = 10000;
        let lastSavedFileMeta = 0;
        let crawl = async (queueNo) => {
            this._crawlingStatus = `[${stageStr}]`
                + ` fetched/total=[${resultSet.size}/${total}] remaining=[${urlStrSet.size - resultSet.size}]`
                + ` not_found=[${currentStaticFile404Set.size}] skipped=[${skippedSet.size}] abandoned=[${abandonedSet.size}]`;
            let item = urlList.shift();
            if (item == null)
                return false;
            const currentTime = new Date().getTime();
            if (currentTime - lastSavedFileMeta > saveFileMetaInterval) {
                this.saveFileMeta();
                lastSavedFileMeta = currentTime;
            }
            let url = item.url, md5 = item.md5;
            let key = url.pathname;
            if (hasError) {
                abandonedSet.add(key);
                urlStrSet.delete(key);
                return true;
            }
            if (this.stopCrawling) {
                stoppedCrawling = true;
                if (!stoppedCrawling)
                    console.log(`stop crawling (queue ${queueNo})`);
            }
            if (stoppedCrawling) {
                abandonedSet.add(key);
                urlStrSet.delete(key);
                return true;
            }
            if (md5 != null) {
                const fileMeta = this.staticFileMap.get(key);
                if (fileMeta != null && fileMeta[0].md5 === md5) {
                    skippedSet.add(key);
                    urlStrSet.delete(key);
                    return true; // skip downloaded asset
                }
            }
            for (let i = 0; i <= retries; i++) {
                try {
                    let resp = await this.http2GetBuf(url);
                    if (resp.is404) {
                        this.staticFile404Set.add(key);
                        currentStaticFile404Set.add(key);
                        urlStrSet.delete(key);
                        console.log(`HTTP 404 [${url.pathname}${url.search}]`);
                        break;
                    }
                    else {
                        let calculatedMd5 = crypto.createHash("md5").update(resp.body).digest("hex").toLowerCase();
                        if (md5 != null && calculatedMd5 !== md5)
                            throw new Error(`md5 mismatch on [${url.pathname}${url.search}]`);
                        if (resultSet.has(key))
                            throw new Error(`resultSet already has key=[${key}]`);
                        resultSet.add(key);
                        this.saveFile(key, resp.body, resp.contentType, calculatedMd5);
                        this.staticFile404Set.delete(key);
                        currentStaticFile404Set.delete(key);
                        break;
                    }
                }
                catch (e) {
                    console.error(`batchHttp2Get error on url=[${url.href}]`, e);
                    if (retries - i > 0 && !stoppedCrawling) {
                        const delay = 3000 + Math.trunc((i * 2 + Math.random()) * 1000);
                        console.warn(`retry in ${delay}ms...`);
                        await new Promise((resolve) => setTimeout(() => resolve(), delay));
                    }
                    else {
                        abandonedSet.add(key);
                        urlStrSet.delete(key);
                        hasError = true;
                        throw e;
                    }
                }
            }
            return true;
        };
        let startPromises = urlList.slice(0, Math.min(concurrent, urlList.length))
            .map(async (_url, index) => {
            const queueNo = index;
            while (await crawl(queueNo))
                ;
        });
        await Promise.allSettled(startPromises);
        await Promise.all(startPromises);
        urlStrSet.forEach((urlStr) => {
            if (!resultSet.has(urlStr) && !skippedSet.has(urlStr) && !abandonedSet.has(urlStr)
                && !currentStaticFile404Set.has(urlStr)) {
                // should never happen
                throw new Error(`key=[${urlStr}] is missing in both resultSet/skippedSet/abandonedSet/currentStaticFile404Set`);
            }
        });
    }
    async fetchSinglePage(host, pathpart, contentTypeRegEx) {
        const reqHeaders = {
            [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_GET,
            [http2.constants.HTTP2_HEADER_PATH]: pathpart,
            [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
            [http2.constants.HTTP2_HEADER_HOST]: host,
            [http2.constants.HTTP2_HEADER_ACCEPT_ENCODING]: `gzip, deflate`,
            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: `text/plain; charset=utf-8`,
            ["Deviceid"]: `${this.device_id}`,
            ["User-Id-Fba9x88mae"]: `magica_`,
            ["X-Platform-Host"]: `https://${host}`,
            ["Ticket"]: "",
            ["Ticket-Verify"]: `from_cocos`,
        };
        const pageUrl = new URL(`https://${host}${pathpart}`);
        const resp = await this.http2GetStr(pageUrl, reqHeaders);
        const contentType = resp.contentType;
        if (!(contentType === null || contentType === void 0 ? void 0 : contentType.match(contentTypeRegEx)))
            throw new Error(`[${pathpart}] contentType=[${contentType}] does not match [${contentTypeRegEx}]`);
        this.saveFile(pageUrl.pathname, Buffer.from(resp.body, 'utf-8'), contentType);
        return resp.body;
    }
    async fetchFilesInReplacementJs(headTime) {
        const replacementJsUrl = new URL(`${this.httpsProdMagicaNoSlash}/js/system/replacement.js?${headTime}`);
        const resp = await this.http2GetStr(replacementJsUrl);
        const contentType = resp.contentType;
        if (!(contentType === null || contentType === void 0 ? void 0 : contentType.match(_a.javaScriptRegEx)))
            throw new Error(`replacement.js contentType=[${contentType}] not application/javascript`);
        const replacementJs = resp.body;
        this.saveFile(replacementJsUrl.pathname, Buffer.from(replacementJs, 'utf-8'), contentType);
        const fileTimeStampObj = JSON.parse(replacementJs.replace(/^\s*window\.fileTimeStamp\s*=\s*/, ""));
        let urlList = [];
        for (let subPath in fileTimeStampObj) {
            let fileTimeStamp = fileTimeStampObj[subPath]; //it's actually unknown what this value is
            if (!(subPath === null || subPath === void 0 ? void 0 : subPath.match(/^([0-9a-z\-\._ \(\)]+\/)+[0-9a-z\-\._ \(\)]+\.[0-9a-z]+$/i)))
                throw new Error(`invalid subPath=[${subPath}] fileTimeStamp=[${fileTimeStamp}]`);
            if (!(fileTimeStamp === null || fileTimeStamp === void 0 ? void 0 : fileTimeStamp.match(/^[0-9a-f]{16}$/)))
                throw new Error(`subPath=[${subPath}] has invalid fileTimeStamp=[${fileTimeStamp}]`);
            urlList.push({
                url: new URL(`${this.httpsProdMagicaNoSlash}/${subPath}?${headTime}`),
            });
        }
        await this.batchHttp2GetSave(`webRes`, urlList);
    }
    readAssetVer(maintenanceConfigStr) {
        const maintenanceConfig = JSON.parse(maintenanceConfigStr);
        if (maintenanceConfig["status"] != 0)
            throw new Error("maintenanceConfig.status is not 0");
        const assetver = maintenanceConfig["assetver"]; // "2207081501"
        if (!(assetver === null || assetver === void 0 ? void 0 : assetver.match(/^\d+$/i)))
            throw new Error("cannot read assetver from maintenanceConfig");
        return assetver;
    }
    async fetchAssetConfig() {
        console.log(this._crawlingStatus = `crawling maintenance config ...`);
        /*
        const maintenanceConfigStr = await this.fetchSinglePage(
            crawler.prodHost,
            `/maintenance/magica/config?type=1&platform=2&version=30011&gameid=1&time=${this.timeStampSec}`,
            crawler.jsonRegEx
        );
        */
        const assetver = this.readAssetVer(_a.maintenanceConfigStr);
        console.log(this._crawlingStatus = `crawling asset_config.json ...`);
        const assetConfigStr = await this.fetchSinglePage(_a.patchHost, `/magica/resource/download/asset/master/resource/${assetver}/asset_config.json?${this.timeStampSec}`, _a.jsonRegEx);
        const assetConfig = JSON.parse(assetConfigStr);
        const assetConfigVersion = assetConfig["version"];
        if (typeof assetConfigVersion !== 'number')
            throw new Error("assetConfig.version is not number");
        let promises = _a.assetListFileNameList.map(async (fileName) => {
            console.log(this._crawlingStatus = `crawling ${fileName} ...`);
            const jsonStr = await this.fetchSinglePage(_a.patchHost, `/magica/resource/download/asset/master/resource/${assetver}/${fileName}?${this.timeStampSec}`, _a.jsonRegEx);
            const assetList = JSON.parse(jsonStr);
            if (!Array.isArray(assetList))
                throw new Error("assetList is not array");
            if (assetList.length == 0)
                throw new Error("assetList is empty");
            if (!Array.isArray(assetList[0].file_list)) {
                throw new Error("assetList[0].file_list is not array");
            }
            if (typeof assetList[0].md5 !== 'string' || !assetList[0].md5.match(_a.md5RegEx)) {
                throw new Error("assetList[0].md5 is not md5");
            }
            if (typeof assetList[0].path !== 'string') {
                throw new Error("assetList[0].path is not string");
            }
            return assetList;
        });
        let status = await Promise.allSettled(promises);
        let listOfAssetList = await Promise.all(status);
        let mergedAssetList = [];
        listOfAssetList.forEach((list) => {
            if (list.status === 'fulfilled') {
                list.value.forEach((item) => mergedAssetList.push(item));
            }
            else
                throw new Error("list.status is not fulfilled");
        });
        // guess asset_section_[event_]1068.json filenames
        let assetFullVoiceIndex = _a.assetListFileNameList.findIndex((name) => name === "asset_fullvoice.json");
        let sectionNameSet = new Set();
        listOfAssetList.forEach((list, index) => {
            if (list.status === 'fulfilled') {
                if (index == assetFullVoiceIndex) {
                    list.value.forEach((item) => {
                        let matched = item.file_list[0].url.match(/(?<=^\d+\/sound_native\/fullvoice\/)section_[^\/]+/);
                        if (matched != null)
                            sectionNameSet.add(matched[0]);
                    });
                }
            }
            else
                throw new Error("list.status is not fulfilled");
        });
        let guessedAssetSectionUrlList = [];
        sectionNameSet.forEach((sectionName) => guessedAssetSectionUrlList.push({
            url: new URL(`${this.httpsPatchMagicaNoSlash}/resource/download/asset/master/resource/${assetver}/asset_${sectionName}.json`)
        }));
        await this.batchHttp2GetSave(`guessedAssetSection`, guessedAssetSectionUrlList);
        return {
            assetver: assetver,
            assetConfigVersion: assetConfigVersion,
            assetList: mergedAssetList,
        };
    }
    async fetchAssets(assetConfig) {
        console.log(this._crawlingStatus = `crawling asset files ...`);
        //const assetver = assetConfig.assetver;
        const assetList = assetConfig.assetList;
        const urlMap = new Map();
        assetList.forEach((item) => {
            const partialUrl = item.file_list[0].url;
            const pathname = `/resource/download/asset/master/resource/${partialUrl}`;
            const md5 = item.md5;
            const url = new URL(`${this.httpsPatchMagicaNoSlash}${pathname}?${md5}`);
            if (urlMap.has(url.href)) {
                console.warn(`skipping duplicate url=[${url.href}]`);
            }
            else {
                urlMap.set(url.href, {
                    url: url,
                    md5: md5,
                });
            }
        });
        const urlList = Array.from(urlMap.values());
        await this.batchHttp2GetSave(`assets`, urlList);
    }
}
exports.crawler = crawler;
_a = crawler;
crawler.htmlRegEx = /^text\/html(?=(\s|;|$))/i;
crawler.javaScriptRegEx = /^application\/javascript(?=(\s|;|$))/i;
crawler.jsonRegEx = /^application\/json(?=(\s|;|$))/i;
crawler.md5RegEx = /^[0-9a-f]{32}$/i;
crawler.fileExtRegEx = /\.[^\.]+$/;
crawler.compressableFileExtSet = new Set([
    ".ExportJson",
    ".bytes",
    //".canx",
    ".css",
    ".db",
    //".hca",
    ".html",
    //".jpg",
    ".js",
    ".json",
    ".moc",
    //".mp4",
    ".mtn",
    ".plist",
    //".png",
    //".usm",
    ".vfx",
    ".vfxb",
    ".vfxj",
    //".zip",
]);
crawler.defMimeType = "application/octet-stream";
crawler.staticFileMapPath = path.join(".", "staticFileMap.json.br");
crawler.staticFileMapPathUncomp = _a.staticFileMapPath.replace(/\.br$/, "");
crawler.staticFile404SetPath = path.join(".", "staticFile404Set.json.br");
crawler.staticFile404SetPathUncomp = _a.staticFile404SetPath.replace(/\.br$/, "");
crawler.brotliQuality = 0;
crawler.prodHost = "l3-prod-all-gs-mfsn2.bilibiligame.net";
crawler.patchHost = "line3-prod-patch-mfsn2.bilibiligame.net";
crawler.maintenanceConfigStr = JSON.stringify({
    leastversion: "30011",
    assetver: "2207081501",
    forcelocation: "https://pkg.biligame.com/games/mfjlmfsnxywc_v2.2.1_b_20220819_105944_2e49d.apk",
    servicelocation: "https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/wh/index.html",
    status: 0,
    domain: [
        "https://l3-prod-all-gs-mfsn2.bilibiligame.net",
        "https://l2-prod-all-gs-mfsn2.bilibiligame.net",
        "https://l1-prod-all-gs-mfsn2.bilibiligame.net"
    ],
    resourceLocation: [
        "https://line3-prod-patch-mfsn2.bilibiligame.net",
        "https://line2-prod-patch-mfsn2.bilibiligame.net",
        "https://line1-prod-patch-mfsn2.bilibiligame.net"
    ],
    ipAddr: "180.97.245.90",
    resDir: null
});
crawler.maintenanceViewJsonStr = JSON.stringify({
    message: "<p>例行维护中：9月8日10:00～9<span>月8日</span>17:00<br/>奇迹与魔法都是需要维护的|•&#39;-&#39;•)&nbsp;◇</p>",
    url: ""
});
crawler.assetListFileNameList = [
    "asset_char_list.json",
    "asset_main.json",
    "asset_voice.json",
    "asset_movie_high.json",
    "asset_movie_low.json",
    "asset_fullvoice.json",
    "zip_asset_main.json",
    "zip_asset_voice.json",
    "zip_asset_movie_high.json",
    "zip_asset_movie_low.json",
    "zip_asset_fullvoice.json",
];
