import { localServer } from "./local_server";
import * as parameters from "./parameters";
import * as http2 from "http2";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

type http2StrResult = {
    is404: boolean,
    contentType?: string,
    body: string,
}
type http2BufResult = {
    is404: boolean,
    contentType?: string,
    body: Buffer,
}
type http2Result = {
    is404: boolean,
    contentType?: string,
    body: string | Buffer,
}

type http2BatchGetResultItem = {
    url: URL,
    resp: http2BufResult,
}

type fileMeta = { md5: string, contentType?: string };
type staticFileMap = Map<string, Array<fileMeta>>; //path => md5
type staticFile404Set = Set<string>; //path


type fileSizeUrl = Array<{
    size: number,
    url: string,
}>
type assetListEntry = {
    file_list: fileSizeUrl,
    md5: string,
    path: string,
}
type assetConfigObj = {
    assetver: string,
    assetConfigVersion: number,
    assetList: Array<assetListEntry>
}

type fsckStatus = {
    passed: number,
    remaining: number,
    notPassed: number,
}


export class crawler {
    private readonly params: parameters.params;
    private readonly localServer: localServer;

    isWebResCompleted: boolean;
    isAssetsCompleted: boolean;

    private static readonly htmlRegEx = /^text\/html(?=(\s|;|$))/i;
    private static readonly javaScriptRegEx = /^application\/javascript(?=(\s|;|$))/i;
    private static readonly jsonRegEx = /^application\/json(?=(\s|;|$))/i;

    private static readonly md5RegEx = /^[0-9a-f]{32}$/i;

    private static readonly fileExtRegEx = /\.[^\.]+$/;
    private static readonly compressableFileExtSet = new Set<string>([
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

    private readonly device_id: string;
    private get timeStampSec(): string {
        let ts = new Date().getTime();
        let tsSec = Math.trunc(ts / 1000);
        return String(tsSec);
    }

    static readonly defMimeType = "application/octet-stream";

    private readonly staticFileMap: staticFileMap;
    private readonly staticFile404Set: staticFile404Set;
    private readonly localRootDir: string;
    private readonly localConflictDir: string;
    private static readonly staticFileMapPath = path.join(".", "staticFileMap.json.br");
    private static readonly staticFileMapPathUncomp = this.staticFileMapPath.replace(/\.br$/, "");
    private static readonly staticFile404SetPath = path.join(".", "staticFile404Set.json.br");
    private static readonly staticFile404SetPathUncomp = this.staticFile404SetPath.replace(/\.br$/, "");

    private static readonly prodHost = "l3-prod-all-gs-mfsn2.bilibiligame.net";
    private get httpsProdMagicaNoSlash(): string { return `https://${crawler.prodHost}/magica`; }
    private static readonly patchHost = "line3-prod-patch-mfsn2.bilibiligame.net";
    private get httpsPatchMagicaNoSlash(): string { return `https://${crawler.patchHost}/magica`; }

    stopCrawling = false;
    get isCrawling(): boolean {
        return this._isCrawling;
    }
    private _isCrawling = false;
    get lastError(): any {
        return this._lastError;
    }
    private _lastError?: any;
    get crawlingStatus(): string {
        return this._crawlingStatus;
    }
    private _crawlingStatus = "";
    get isCrawlingFullyCompleted(): boolean {
        return !this._isCrawling && this.isCrawlingCompleted && !this.stopCrawling;
    }
    private isCrawlingCompleted = false;
    get isFscking(): boolean {
        const fsckStatus = this._fsckStatus;
        if (fsckStatus == null) return false;
        return fsckStatus.remaining > 0;
    }
    get lastFsckResult(): string {
        const fsckStatus = this._fsckStatus;
        if (fsckStatus == null) return "";
        return `[${fsckStatus.passed}] passed, [${fsckStatus.remaining}] remaining`
            + `, [${fsckStatus.notPassed}] missing/mismatch/error`;
    }
    get fsckStatus(): fsckStatus | undefined {
        return this._fsckStatus;
    }
    private _fsckStatus?: fsckStatus;

    constructor(params: parameters.params, localsvr: localServer) {
        this.params = params;
        this.localServer = localsvr;

        this.device_id = [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
            .toString('hex').substring(0, len)).join("-");

        if (!fs.existsSync(crawler.staticFileMapPath) && !fs.existsSync(crawler.staticFileMapPathUncomp)) {
            console.error(`creating new staticFileMap`);
            this.staticFileMap = new Map<string, Array<fileMeta>>();
        } else try {
            let json: string;
            if (fs.existsSync(crawler.staticFileMapPathUncomp) && fs.statSync(crawler.staticFileMapPathUncomp).isFile()) {
                let uncompressed = fs.readFileSync(crawler.staticFileMapPathUncomp);
                json = uncompressed.toString('utf-8');
                let compressed = localServer.compress(uncompressed, "br");
                fs.writeFileSync(crawler.staticFileMapPath, compressed);
                fs.rmSync(crawler.staticFileMapPathUncomp);
            } else {
                let compressed = fs.readFileSync(crawler.staticFileMapPath);
                json = localServer.decompress(compressed, "br").toString("utf-8");
            }
            let map = JSON.parse(json, parameters.reviver);
            if (!(map instanceof Map)) throw new Error(`not instance of map`);
            this.staticFileMap = map;
        } catch (e) {
            console.error(`error loading staticFileMap, creating new one`, e);
            this.staticFileMap = new Map<string, Array<fileMeta>>();
        }
        if (!fs.existsSync(crawler.staticFile404SetPath) && !fs.existsSync(crawler.staticFile404SetPathUncomp)) {
            console.error(`creating new staticFile404Set`);
            this.staticFile404Set = new Set<string>();
        } else try {
            let json: string;
            if (fs.existsSync(crawler.staticFile404SetPathUncomp) && fs.statSync(crawler.staticFile404SetPathUncomp).isFile()) {
                let uncompressed = fs.readFileSync(crawler.staticFile404SetPathUncomp);
                json = uncompressed.toString('utf-8');
                let compressed = localServer.compress(uncompressed, "br");
                fs.writeFileSync(crawler.staticFile404SetPath, compressed);
                fs.rmSync(crawler.staticFile404SetPathUncomp);
            } else {
                let compressed = fs.readFileSync(crawler.staticFile404SetPath);
                json = localServer.decompress(compressed, "br").toString("utf-8");
            }
            let set = JSON.parse(json, parameters.reviver);
            if (!(set instanceof Set)) throw new Error(`not instance of set`);
            this.staticFile404Set = set;
        } catch (e) {
            console.error(`error loading staticFile404Set, creating new one`, e);
            this.staticFile404Set = new Set<string>();
        }

        this.localRootDir = path.join(".", "static");
        this.localConflictDir = path.join(".", "conflict");

        const { isWebResCompleted, isAssetsCompleted } = this.checkStaticCompleted();
        this.isWebResCompleted = isWebResCompleted;
        this.isAssetsCompleted = isAssetsCompleted;
    }

    fetchAllAsync(): Promise<void> {
        return new Promise((resolve, reject) =>
            this.getFetchAllPromise()
                .then((result) => resolve(result))
                .catch((err) => {
                    this.params.save({ key: "openIdTicket", val: undefined })
                        .finally(() => {
                            this._isCrawling = false;
                            reject(this._lastError = err);
                        });
                }).finally(() => {
                    // not changing this._crawlingStatus
                    try {
                        const { isWebResCompleted, isAssetsCompleted } = this.checkStaticCompleted();
                        this.isWebResCompleted = isWebResCompleted;
                        this.isAssetsCompleted = isAssetsCompleted;
                    } catch (e) {
                        console.error(e);
                    }
                    this.saveFileMeta();
                })
        );
    }
    async getFetchAllPromise(): Promise<void> {
        if (this._isCrawling) throw new Error("previous crawling has not finished");
        if (this.isFscking) throw new Error("is still fsck'ing, cannot start crawling");
        this.stopCrawling = false;
        this._isCrawling = true;
        this.isCrawlingCompleted = false;
        this._lastError = undefined;
        this._crawlingStatus = "";

        const crawlWebRes = this.params.crawlWebRes, crawlAssets = this.params.crawlAssets;
        if (crawlWebRes) {
            console.log(this._crawlingStatus = `crawling index.html ...`);
            let indexHtml = await this.fetchSinglePage(crawler.prodHost, "/magica/index.html", crawler.htmlRegEx);
            let matched = indexHtml.match(/<head\s+time="(\d+)"/);
            if (matched == null) throw this._lastError = new Error(`cannot match time in index.html`);
            let headTime = parseInt(matched[1]);
            if (isNaN(headTime)) throw this._lastError = new Error(`headTime is NaN`);
            console.log(this._crawlingStatus = `crawling baseConfig.js ...`);
            await this.fetchSinglePage(crawler.prodHost, `/magica/js/_common/baseConfig.js?v=${headTime}`,
                crawler.javaScriptRegEx);
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

    getContentType(pathInUrl: string): string {
        const fileMetaArray = this.staticFileMap.get(pathInUrl);
        if (fileMetaArray == null || fileMetaArray.length == 0) return crawler.defMimeType;
        const contentType = fileMetaArray[0].contentType;
        if (contentType != null) return contentType;
        else return crawler.defMimeType;
    }
    readFile(pathInUrl: string, specifiedMd5?: string): Buffer | undefined {
        // not checking md5 here
        let logPrefix = `readFile`;
        const readPath = path.join(this.localRootDir, pathInUrl);
        if (specifiedMd5 == null) {
            if (fs.existsSync(readPath)) {
                if (fs.statSync(readPath).isFile()) {
                    const content = fs.readFileSync(readPath);
                    if (parameters.params.VERBOSE) console.log(`${logPrefix}: [${pathInUrl}]`);
                    return content;
                }
                else throw new Error(`readPath=[${readPath}] exists but it is not a file`);
            } else {
                if (parameters.params.VERBOSE) console.log(`${logPrefix} (not found) : [${pathInUrl}]`);
                return undefined;
            }
        } // else specifiedMd5 != null
        logPrefix += ` with specified md5`;
        const metaArray = this.staticFileMap.get(pathInUrl) || [];
        if (metaArray[0]?.md5 === specifiedMd5) {
            if (fs.existsSync(readPath)) {
                if (fs.statSync(readPath).isFile()) {
                    const content = fs.readFileSync(readPath);
                    if (parameters.params.VERBOSE) console.log(`${logPrefix}: [${pathInUrl}]`);
                    return content;
                }
                else throw new Error(`readPath=[${readPath}] exists but it is not a file`);
            } else throw new Error(`staticFileMap has the record of readPath=[${readPath}] but that file does not exist`);
        } else {
            if (metaArray.find((meta) => meta.md5 === specifiedMd5) != null) {
                const conflictDirNameWithoutMd5 = path.dirname(path.join(this.localConflictDir, pathInUrl));
                const conflictDirNameWithMd5 = path.join(conflictDirNameWithoutMd5, specifiedMd5);
                const conflictReadPath = path.join(conflictDirNameWithMd5, path.basename(pathInUrl));
                if (fs.existsSync(conflictReadPath)) {
                    if (fs.statSync(conflictReadPath).isFile()) {
                        const content = fs.readFileSync(readPath);
                        if (parameters.params.VERBOSE) console.log(`${logPrefix} (in conflict dir) : [${pathInUrl}]`);
                        return content;
                    }
                    else throw new Error(`conflictReadPath=[${conflictReadPath}] exists but it is not a file`);
                } else throw new Error(`staticFileMap has the record of conflictReadPath=[${conflictReadPath}] but that file does not exist`);
            } else {
                if (parameters.params.VERBOSE) console.log(`${logPrefix} (not found) : [${pathInUrl}]`);
                return undefined;
            }
        }
    }
    saveFile(pathInUrl: string, content: Buffer, contentType: string | undefined, preCalcMd5?: string): void {
        let logPrefix = `saveFile`;
        const md5ToWrite = preCalcMd5 != null ? preCalcMd5 : crypto.createHash("md5").update(content).digest('hex');
        if (this.checkAlreadyExist(pathInUrl, md5ToWrite)) {
            console.log(`${logPrefix} already exist [${pathInUrl}]`);
        } else {
            // file does not exist or it's moved away just now
            const writePath = path.join(this.localRootDir, pathInUrl);
            fs.writeFileSync(writePath, content);
            console.log(`${logPrefix} written to [${pathInUrl}]`);
        }
        this.updateFileMeta(pathInUrl, md5ToWrite, contentType);
    }
    private checkAlreadyExist(pathInUrl: string, givenMd5: string): boolean {
        let logPrefix = `checkAlreadyExist`;
        const writePath = path.join(this.localRootDir, pathInUrl);
        // firstly mkdir -p
        const dirName = path.dirname(writePath);
        if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
        if (!fs.statSync(dirName).isDirectory()) throw new Error(`dirName=[${dirName}] is not directory`);
        // if the file does not exist, then it's okay to write
        if (!fs.existsSync(writePath)) return false; // file does not exist, just as expected
        // unfortunately, the file already exists, but it would still be okay if the md5 matches
        if (!fs.statSync(writePath).isFile()) throw new Error(`writePath=[${writePath}] exists but it is not a file`);
        const calculatedMd5 = crypto.createHash("md5").update(fs.readFileSync(writePath)).digest('hex');
        if (calculatedMd5 === givenMd5) return true; // fortunately the md5 matches!
        // unfortunately the md5 doesn't match, move the mismatched file away
        const pathInConflictDir = path.join(this.localConflictDir, pathInUrl);
        const moveToDir = path.join(path.dirname(pathInConflictDir), calculatedMd5);
        fs.mkdirSync(moveToDir, { recursive: true });
        if (!fs.statSync(moveToDir).isDirectory()) throw new Error(`moveToDir=[${moveToDir}] is not directory`);
        const moveToPath = path.join(moveToDir, path.basename(pathInUrl));
        fs.renameSync(writePath, moveToPath);
        console.log(`${logPrefix}: moved ${writePath} to ${moveToPath}`);
        return false; // don't know how to updateFileMeta without known contentType, let saveFile do this
    }
    private updateFileMeta(pathInUrl: string, md5: string, contentType: string | undefined): void {
        const meta: fileMeta = { md5: md5 };
        if (contentType != null) meta.contentType = contentType;
        const metaArray: Array<fileMeta> = this.staticFileMap.get(pathInUrl)?.filter((item) => item.md5 !== md5) || [];
        metaArray.unshift(meta);
        this.staticFileMap.set(pathInUrl, metaArray);
    }
    private saveFileMeta(): void {
        console.log(`saving stringifiedMap ...`);
        let stringifiedMap = JSON.stringify(this.staticFileMap, parameters.replacer);
        let compressedMap = localServer.compress(Buffer.from(stringifiedMap, 'utf-8'), 'br');
        fs.writeFileSync(crawler.staticFileMapPath, compressedMap);
        console.log(`saved stringifiedMap`);
        console.log(`saving stringified404Set ...`);
        let stringified404Set = JSON.stringify(this.staticFile404Set, parameters.replacer);
        let compressed404Set = localServer.compress(Buffer.from(stringified404Set, 'utf-8'), 'br');
        fs.writeFileSync(crawler.staticFile404SetPath, compressed404Set);
        console.log(`saved stringified404Set`);
    }
    fsck(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
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
                remaining: total,
                notPassed: 0,
            }

            const okaySet = new Set<string>(), notOkaySet = new Set<string>();
            const checkNextFile = (it: IterableIterator<[string, Array<fileMeta>]>): void => {
                const val = it.next();
                if (val.done) {
                    this._fsckStatus = {
                        passed: okaySet.size,
                        remaining: total - okaySet.size - notOkaySet.size,
                        notPassed: notOkaySet.size,
                    }
                    console.log(this.lastFsckResult);
                    notOkaySet.forEach((pathInUrl) => this.staticFileMap.delete(pathInUrl));
                    try {
                        const { isWebResCompleted, isAssetsCompleted } = this.checkStaticCompleted();
                        this.isWebResCompleted = isWebResCompleted;
                        this.isAssetsCompleted = isAssetsCompleted;
                        this.saveFileMeta();
                    } catch (e) {
                        console.error(e);
                    }
                    resolve(notOkaySet.size == 0);
                    return;
                }
                const pathInUrl: string = val.value[0], fileMetaArray: Array<fileMeta> = val.value[1];
                new Promise<void>((resolve) => {
                    let okay = false;
                    try {
                        if (this.checkAlreadyExist(pathInUrl, fileMetaArray[0].md5)) okay = true;
                    } catch (e) {
                        console.error(e);
                    }
                    if (okay) {
                        okaySet.add(pathInUrl);
                    } else {
                        notOkaySet.add(pathInUrl);
                    }
                    this._fsckStatus = {
                        passed: okaySet.size,
                        remaining: total - okaySet.size - notOkaySet.size,
                        notPassed: notOkaySet.size,
                    }
                    resolve();
                }).then(() => setTimeout(() => checkNextFile(it))); // setTimeout to prevent stall
            }
            checkNextFile(this.staticFileMap.entries());
        });
    }

    isKnown404(pathInUrl: string): boolean {
        return this.staticFile404Set.has(pathInUrl);
    }

    private checkStaticCompleted(): { isWebResCompleted: boolean, isAssetsCompleted: boolean } {
        const unsortedFileExtSet = new Set<string>();
        let isWebResCompleted: boolean | undefined;
        try {
            const replacementJs = this.readFile("/magica/js/system/replacement.js")?.toString('utf-8');
            if (replacementJs != null) {
                const fileTimeStampObj: Record<string, string> = JSON.parse(
                    replacementJs.replace(/^\s*window\.fileTimeStamp\s*=\s*/, "")
                );
                for (let subPath in fileTimeStampObj) {
                    let matched = subPath.match(crawler.fileExtRegEx);
                    if (matched) unsortedFileExtSet.add(matched[0]);
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
        } catch (e) {
            isWebResCompleted = false;
            console.error(e);
        }
        this.isWebResCompleted = isWebResCompleted != null ? isWebResCompleted : false;

        let isAssetsCompleted: boolean | undefined;
        try {
            let completed: boolean;
            const maintenanceConfigStr = this.readFile(`/maintenance/magica/config`)?.toString('utf-8');
            if (maintenanceConfigStr != null) {
                const assetver = this.readAssetVer(maintenanceConfigStr);
                const mergedAssetList: Array<assetListEntry> = [];
                let allAssetListExists = true;
                crawler.assetListFileNameList.find((fileName) => {
                    const assetListStr = this.readFile(`/magica/resource/download/asset/master/resource/${assetver}/${fileName}`)
                        ?.toString('utf-8');
                    if (assetListStr == null) {
                        allAssetListExists = false;
                        return true;
                    }
                    const assetList: Array<assetListEntry> = JSON.parse(assetListStr);
                    assetList.forEach((item) => mergedAssetList.push(item));
                });
                if (allAssetListExists) {
                    mergedAssetList.forEach((item) => {
                        let matched = item.file_list[0].url.match(crawler.fileExtRegEx);
                        if (matched) unsortedFileExtSet.add(matched[0]);
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
                } else {
                    completed = false;
                }
                isAssetsCompleted = completed;
            }
        } catch (e) {
            isAssetsCompleted = false;
            console.error(e);
        }
        try {
            const writePath = path.join(".", "fileExtSet.json");
            const fileExtArray = Array.from(unsortedFileExtSet.keys()).sort();
            const fileExtSet = new Set<string>(fileExtArray);
            const stringified = JSON.stringify(fileExtSet, parameters.replacer, 4);
            let noChange = false;
            if (fs.existsSync(writePath) && fs.statSync(writePath).isFile()) {
                const content = fs.readFileSync(writePath, 'utf-8');
                if (content === stringified) noChange = true;
            }
            if (!noChange) fs.writeFileSync(writePath, stringified);
        } catch (e) {
            console.error(e);
        }

        return {
            isWebResCompleted: isWebResCompleted == null ? false : isWebResCompleted,
            isAssetsCompleted: isAssetsCompleted == null ? false : isAssetsCompleted,
        }
    }

    private async http2Request(
        url: URL, overrideReqHeaders?: http2.OutgoingHttpHeaders, cvtBufToStr = false, postData?: string | Buffer
    ): Promise<http2Result> {
        const method = postData == null ? http2.constants.HTTP2_METHOD_GET : http2.constants.HTTP2_METHOD_POST;
        const host = url.host, hostname = url.hostname;
        const authorityURL = new URL(`https://${host}/`);
        const path = `${url.pathname}${url.search}`;
        const reqHeaders: http2.OutgoingHttpHeaders = overrideReqHeaders || {
            [http2.constants.HTTP2_HEADER_METHOD]: method,
            [http2.constants.HTTP2_HEADER_PATH]: path,
            [http2.constants.HTTP2_HEADER_AUTHORITY]: hostname,
            [http2.constants.HTTP2_HEADER_HOST]: host,
            [http2.constants.HTTP2_HEADER_USER_AGENT]: `Mozilla/5.0 (Linux; Android 6.0.1; MuMu Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36`,
            [http2.constants.HTTP2_HEADER_ACCEPT]: "*/*",
            [http2.constants.HTTP2_HEADER_REFERER]: `https://${host}/magica/index.html`,
            [http2.constants.HTTP2_HEADER_ACCEPT_LANGUAGE]: `zh-CN,en-US;q=0.9`,
            ["X-Requested-With"]: `com.bilibili.madoka.bilibili`,
        }
        const fileExtMatched = url.pathname.match(crawler.fileExtRegEx);
        if (fileExtMatched != null && crawler.compressableFileExtSet.has(fileExtMatched[0])) {
            reqHeaders[http2.constants.HTTP2_HEADER_ACCEPT_ENCODING] = `gzip, deflate`;
        }
        const resp = await this.localServer.sendHttp2RequestAsync(authorityURL, reqHeaders, postData, cvtBufToStr);
        const respHeaders = resp.headers;
        const statusCode = respHeaders[":status"];
        if (statusCode != 200 && statusCode != 404) throw new Error(`statusCode=[${statusCode}]`);
        let contentType = respHeaders[http2.constants.HTTP2_HEADER_CONTENT_TYPE];
        if (contentType != null && Array.isArray(contentType)) contentType = contentType.join(";");
        let result: http2Result = {
            is404: statusCode == 404,
            body: resp.respBody,
        }
        if (contentType != null) result.contentType = contentType;
        return result;
    }
    private async http2GetStr(url: URL, overrideReqHeaders?: http2.OutgoingHttpHeaders): Promise<http2StrResult> {
        return await this.http2Request(url, overrideReqHeaders, true) as http2StrResult;
    }
    private async http2GetBuf(url: URL, overrideReqHeaders?: http2.OutgoingHttpHeaders): Promise<http2BufResult> {
        return await this.http2Request(url, overrideReqHeaders, false) as http2BufResult;
    }
    private async http2PostRetStr(
        url: URL, postData: string | Buffer, overrideReqHeaders?: http2.OutgoingHttpHeaders
    ): Promise<http2StrResult> {
        return await this.http2Request(url, overrideReqHeaders, true, postData) as http2StrResult;
    }
    private async http2PostRetBuf(
        url: URL, postData: string | Buffer, overrideReqHeaders?: http2.OutgoingHttpHeaders
    ): Promise<http2BufResult> {
        return await this.http2Request(url, overrideReqHeaders, false, postData) as http2BufResult;
    }

    private async batchHttp2GetSave(stageStr: string, urlList: Array<{ url: URL, md5?: string }>,
        concurrent = 8, retries = 5
    ): Promise<void> {
        let urlStrSet = new Set<string>(), abandonedSet = new Set<string>(), skippedSet = new Set<string>();
        let currentStaticFile404Set = new Set<string>();
        urlList.forEach((item) => {
            const url = item.url;
            const key = url.pathname;
            if (urlStrSet.has(key)) throw new Error(`found duplicate url=${key} in urlList`);
            urlStrSet.add(key);
        });
        const total = urlList.length;

        concurrent = Math.floor(concurrent);
        if (concurrent < 1 || concurrent > 8) throw new Error("concurrent < 1 || concurrent > 8");
        retries = Math.floor(retries);
        if (retries < 0 || retries > 8) throw new Error("retries < 0 || retries > 8");

        let resultSet = new Set<string>();

        let hasError = false, stoppedCrawling = false;
        const saveFileMetaInterval = 5000;
        let lastSavedFileMeta = 0;
        let crawl = async (queueNo: number): Promise<boolean> => {
            this._crawlingStatus = `[${stageStr}]`
                + ` fetched/total=[${resultSet.size}/${total}] remaining=[${urlStrSet.size - resultSet.size}]`
                + ` not_found=[${currentStaticFile404Set.size}] skipped=[${skippedSet.size}] abandoned=[${abandonedSet.size}]`;

            let item = urlList.shift();
            if (item == null) return false;

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
                if (!stoppedCrawling) console.log(`stop crawling (queue ${queueNo})`);
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
                    } else {
                        let calculatedMd5 = crypto.createHash("md5").update(resp.body).digest("hex").toLowerCase();
                        if (md5 != null && calculatedMd5 !== md5) throw new Error(`md5 mismatch on [${url.pathname}${url.search}]`);
                        if (resultSet.has(key)) throw new Error(`resultSet already has key=[${key}]`);
                        resultSet.add(key);
                        this.saveFile(key, resp.body, resp.contentType, calculatedMd5);
                        this.staticFile404Set.delete(key);
                        currentStaticFile404Set.delete(key);
                        break;
                    }
                } catch (e) {
                    console.error(`batchHttp2Get error on url=[${url.href}]`, e);
                    if (retries - i > 0 && !stoppedCrawling) {
                        const delay = 3000 + Math.trunc((i * 2 + Math.random()) * 1000);
                        console.warn(`retry in ${delay}ms...`);
                        await new Promise<void>((resolve) => setTimeout(() => resolve(), delay));
                    } else {
                        abandonedSet.add(key);
                        urlStrSet.delete(key);
                        hasError = true;
                        throw e;
                    }
                }
            }

            return true;
        }

        let startPromises = urlList.slice(0, Math.min(concurrent, urlList.length))
            .map(async (_url, index) => {
                const queueNo = index;
                while (await crawl(queueNo));
            });
        await Promise.allSettled(startPromises);
        await Promise.all(startPromises);

        urlStrSet.forEach((urlStr) => {
            if (
                !resultSet.has(urlStr) && !skippedSet.has(urlStr) && !abandonedSet.has(urlStr)
                && !currentStaticFile404Set.has(urlStr)
            ) {
                // should never happen
                throw new Error(`key=[${urlStr}] is missing in both resultSet/skippedSet/abandonedSet/currentStaticFile404Set`);
            }
        });
    }


    private async fetchSinglePage(host: string, pathpart: string, contentTypeRegEx: RegExp): Promise<string> {
        const reqHeaders: http2.OutgoingHttpHeaders = {
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
        }
        const pageUrl = new URL(`https://${host}${pathpart}`);
        const resp = await this.http2GetStr(pageUrl, reqHeaders);
        const contentType = resp.contentType;
        if (!contentType?.match(contentTypeRegEx)) throw new Error(`[${pathpart}] contentType=[${contentType}] does not match [${contentTypeRegEx}]`);
        this.saveFile(pageUrl.pathname, Buffer.from(resp.body, 'utf-8'), contentType);
        return resp.body;
    }
    private async fetchFilesInReplacementJs(headTime: number): Promise<void> {
        const replacementJsUrl = new URL(`${this.httpsProdMagicaNoSlash}/js/system/replacement.js?${headTime}`);
        const resp = await this.http2GetStr(replacementJsUrl);
        const contentType = resp.contentType;
        if (!contentType?.match(crawler.javaScriptRegEx)) throw new Error(`replacement.js contentType=[${contentType}] not application/javascript`);
        const replacementJs = resp.body;
        this.saveFile(replacementJsUrl.pathname, Buffer.from(replacementJs, 'utf-8'), contentType);
        const fileTimeStampObj: Record<string, string> = JSON.parse(
            replacementJs.replace(/^\s*window\.fileTimeStamp\s*=\s*/, "")
        );
        let urlList: Array<{ url: URL }> = [];
        for (let subPath in fileTimeStampObj) {
            let fileTimeStamp = fileTimeStampObj[subPath]; //it's actually unknown what this value is
            if (!subPath?.match(/^([0-9a-z\-\._ \(\)]+\/)+[0-9a-z\-\._ \(\)]+\.[0-9a-z]+$/i)) throw new Error(`invalid subPath=[${subPath}] fileTimeStamp=[${fileTimeStamp}]`);
            if (!fileTimeStamp?.match(/^[0-9a-f]{16}$/)) throw new Error(`subPath=[${subPath}] has invalid fileTimeStamp=[${fileTimeStamp}]`);
            urlList.push({
                url: new URL(`${this.httpsProdMagicaNoSlash}/${subPath}?${headTime}`),
            });
        }
        await this.batchHttp2GetSave(`webRes`, urlList);
    }

    private static readonly assetListFileNameList = [
        "asset_char_list.json",
        "asset_main.json",
        "asset_voice.json",
        "asset_movie_high.json",
        "asset_movie_low.json",
        "zip_asset_main.json",
        "zip_asset_voice.json",
        "zip_asset_movie_high.json",
        "zip_asset_movie_low.json",
    ];
    private readAssetVer(maintenanceConfigStr: string): string {
        const maintenanceConfig = JSON.parse(maintenanceConfigStr);
        if (maintenanceConfig["status"] != 0) throw new Error("maintenanceConfig.status is not 0");
        const assetver: string = maintenanceConfig["assetver"]; // "2207081501"
        if (!assetver?.match(/^\d+$/i)) throw new Error("cannot read assetver from maintenanceConfig");
        return assetver;
    }
    private async fetchAssetConfig(): Promise<assetConfigObj> {
        console.log(this._crawlingStatus = `crawling maintenance config ...`);
        const maintenanceConfigStr = await this.fetchSinglePage(
            crawler.prodHost,
            `/maintenance/magica/config?type=1&platform=2&version=30011&gameid=1&time=${this.timeStampSec}`,
            crawler.jsonRegEx
        );
        const assetver = this.readAssetVer(maintenanceConfigStr);

        console.log(this._crawlingStatus = `crawling asset_config.json ...`);
        const assetConfigStr = await this.fetchSinglePage(
            crawler.patchHost,
            `/magica/resource/download/asset/master/resource/${assetver}/asset_config.json?${this.timeStampSec}`,
            crawler.jsonRegEx);
        const assetConfig = JSON.parse(assetConfigStr);
        const assetConfigVersion: number = assetConfig["version"];
        if (typeof assetConfigVersion !== 'number') throw new Error("assetConfig.version is not number");

        let promises = crawler.assetListFileNameList.map(async (fileName: string): Promise<Array<assetListEntry>> => {
            console.log(this._crawlingStatus = `crawling ${fileName} ...`);
            const jsonStr = await this.fetchSinglePage(
                crawler.patchHost,
                `/magica/resource/download/asset/master/resource/${assetver}/${fileName}?${this.timeStampSec}`,
                crawler.jsonRegEx
            );
            const assetList: Array<assetListEntry> = JSON.parse(jsonStr);
            if (!Array.isArray(assetList)) throw new Error("assetList is not array");
            if (assetList.length == 0) throw new Error("assetList is empty");
            if (!Array.isArray(assetList[0].file_list)) {
                throw new Error("assetList[0].file_list is not array")
            }
            if (typeof assetList[0].md5 !== 'string' || !assetList[0].md5.match(crawler.md5RegEx)) {
                throw new Error("assetList[0].md5 is not md5");
            }
            if (typeof assetList[0].path !== 'string') {
                throw new Error("assetList[0].path is not string");
            }
            return assetList;
        });
        let status = await Promise.allSettled(promises);
        let listOfAssetList = await Promise.all(status);
        let mergedAssetList: Array<assetListEntry> = [];
        listOfAssetList.forEach((list) => {
            if (list.status === 'fulfilled') {
                list.value.forEach((item) => mergedAssetList.push(item));
            } else throw new Error("list.status is not fulfilled");
        });

        return {
            assetver: assetver,
            assetConfigVersion: assetConfigVersion,
            assetList: mergedAssetList,
        }
    }
    private async fetchAssets(assetConfig: assetConfigObj): Promise<void> {
        console.log(this._crawlingStatus = `crawling asset files ...`);
        //const assetver = assetConfig.assetver;
        const assetList = assetConfig.assetList;
        const urlMap = new Map<string, { url: URL, md5: string }>();
        assetList.forEach((item) => {
            const partialUrl = item.file_list[0].url;
            const pathname = `/resource/download/asset/master/resource/${partialUrl}`;
            const md5 = item.md5;
            const url = new URL(`${this.httpsPatchMagicaNoSlash}${pathname}?${md5}`);
            if (urlMap.has(url.href)) {
                console.warn(`skipping duplicate url=[${url.href}]`);
            } else {
                urlMap.set(url.href, {
                    url: url,
                    md5: md5,
                });
            }
        });
        const urlList: Array<{ url: URL, md5: string }> = Array.from(urlMap.values());
        await this.batchHttp2GetSave(`assets`, urlList);
    }

}