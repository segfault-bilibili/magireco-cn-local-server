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

export class crawler {
    private readonly params: parameters.params;
    private readonly localServer: localServer;

    private readonly staticFileMap: staticFileMap;
    private readonly staticFile404Set: staticFile404Set;
    private readonly localRootDir: string;
    private readonly localConflictDir: string;
    private static readonly staticFileMapPath = path.join(".", "staticFileMap.json");
    private static readonly staticFile404SetPath = path.join(".", "staticFile404Set.json");

    private readonly prodHost = "l3-prod-all-gs-mfsn2.bilibiligame.net";
    private get httpsProdMagicaNoSlash(): string { return `https://${this.prodHost}/magica`; }

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

    constructor(params: parameters.params, localServer: localServer) {
        this.params = params;
        this.localServer = localServer;

        try {
            let json = fs.readFileSync(crawler.staticFileMapPath, 'utf-8');
            let map = JSON.parse(json, parameters.reviver);
            if (!(map instanceof Map)) throw new Error(`not instance of map`);
            this.staticFileMap = map;
        } catch (e) {
            console.error(`error loading staticFileMap, creating new one`, e);
            this.staticFileMap = new Map<string, Array<fileMeta>>();
        }
        try {
            let json = fs.readFileSync(crawler.staticFile404SetPath, 'utf-8');
            let set = JSON.parse(json, parameters.reviver);
            if (!(set instanceof Set)) throw new Error(`not instance of set`);
            this.staticFile404Set = set;
        } catch (e) {
            console.error(`error loading staticFile404Set, creating new one`, e);
            this.staticFile404Set = new Set<string>();
        }

        this.localRootDir = path.join(".", "static");
        this.localConflictDir = path.join(".", "conflict");
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
                    console.log(`saving stringifiedMap and stringified404Set ...`);
                    let stringifiedMap = JSON.stringify(this.staticFileMap, parameters.replacer);
                    fs.writeFileSync(crawler.staticFileMapPath, stringifiedMap, 'utf-8');
                    let stringified404Set = JSON.stringify(this.staticFile404Set, parameters.replacer);
                    fs.writeFileSync(crawler.staticFile404SetPath, stringified404Set, 'utf-8');
                    console.log(`saved stringifiedMap and stringified404Set`);
                })
        );
    }
    async getFetchAllPromise(): Promise<void> {
        if (this._isCrawling) throw new Error("previous crawling has not finished");
        this._isCrawling = true;
        this._lastError = undefined;
        this._crawlingStatus = "";

        console.log(this._crawlingStatus = `crawling index.html ...`);
        let indexHtml = await this.fetchIndexHtml();
        let matched = indexHtml.match(/<head\s+time="(\d+)"/);
        if (matched == null) throw this._lastError = new Error(`cannot match time in index.html`);
        let headTime = parseInt(matched[1]);
        if (isNaN(headTime)) throw this._lastError = new Error(`headTime is NaN`);
        console.log(this._crawlingStatus = `crawling files in replacement.js ...`);
        await this.fetchFilesInReplacementJs(headTime);

        console.log(this._crawlingStatus = `crawling completed`);
        this._isCrawling = false;
    }

    readFile(pathInUrl: string, specifiedMd5?: string): Buffer | undefined {
        let logPrefix = `readFile`;
        const readPath = path.join(this.localRootDir, pathInUrl);
        if (specifiedMd5 == null) {
            if (fs.existsSync(readPath)) {
                if (fs.statSync(readPath).isFile()) {
                    const content = fs.readFileSync(readPath);
                    console.log(`${logPrefix}: [${pathInUrl}]`);
                    return content;
                }
                else throw new Error(`readPath=[${readPath}] exists but it is not a file`);
            } else {
                console.log(`${logPrefix} (not found) : [${pathInUrl}]`);
                return undefined;
            }
        } // else specifiedMd5 != null
        logPrefix += ` with specified md5`;
        const metaArray = this.staticFileMap.get(pathInUrl) || [];
        if (metaArray[0]?.md5 === specifiedMd5) {
            if (fs.existsSync(readPath)) {
                if (fs.statSync(readPath).isFile()) {
                    const content = fs.readFileSync(readPath);
                    console.log(`${logPrefix}: [${pathInUrl}]`);
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
                        console.log(`${logPrefix} (in conflict dir) : [${pathInUrl}]`);
                        return content;
                    }
                    else throw new Error(`conflictReadPath=[${conflictReadPath}] exists but it is not a file`);
                } else throw new Error(`staticFileMap has the record of conflictReadPath=[${conflictReadPath}] but that file does not exist`);
            } else {
                console.log(`${logPrefix} (not found) : [${pathInUrl}]`);
                return undefined;
            }
        }
    }
    saveFile(pathInUrl: string, content: Buffer, contentType: string | undefined): void {
        const logPrefix = `saveFile`;
        const md5 = crypto.createHash("md5").update(content).digest().toString('hex');
        const writePath = path.join(this.localRootDir, pathInUrl);
        if (this.checkExistOrMkdir(writePath)) {
            const existingMd5 = crypto.createHash("md5")
                .update(fs.readFileSync(writePath))
                .digest().toString('hex');
            if (md5 === existingMd5) {
                this.updateFileMeta(pathInUrl, md5, contentType); // should not be necessary
                console.log(`${logPrefix} already saved: [${pathInUrl}]`);
                return; // existing file already has the content to write
            }
            const conflictDirNameWithoutMd5 = path.dirname(path.join(this.localConflictDir, pathInUrl));
            const conflictDirName = path.join(conflictDirNameWithoutMd5, md5);
            const conflictWritePath = path.join(conflictDirName, path.basename(pathInUrl));
            if (this.checkExistOrMkdir(conflictWritePath)) {
                const existingConflictMd5 = crypto.createHash("md5")
                    .update(fs.readFileSync(conflictWritePath))
                    .digest().toString('hex');
                if (md5 === existingConflictMd5) {
                    fs.renameSync(conflictWritePath, writePath);
                    fs.rmdirSync(conflictDirName);
                    this.updateFileMeta(pathInUrl, md5, contentType);
                    console.log(`${logPrefix} saved (to conflict dir): [${pathInUrl}]`);
                    return; // existing file on conflictWritePath already has the content to write, no need to continue to write
                } else throw new Error(`md5 mismatch on conflictWritePath=[${conflictWritePath}]`);
            } // else both writePath and conflictWritePath does not exist, continue to write to writePath
        } // else writePath does not exist, continue to write to writePath (same as above)
        if (fs.existsSync(writePath)) throw new Error(`writePath=[${writePath}] already exists`);
        fs.writeFileSync(writePath, content);
        this.updateFileMeta(pathInUrl, md5, contentType);
        console.log(`${logPrefix} saved: [${pathInUrl}]`);
    }
    private checkExistOrMkdir(writePath: string): boolean {
        const dirName = path.dirname(writePath);
        if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
        if (!fs.statSync(dirName).isDirectory()) throw new Error(`dirName=[${dirName}] is not directory`);
        if (!fs.existsSync(writePath)) return false; // wanted result
        if (!fs.statSync(writePath).isFile()) throw new Error(`writePath=[${writePath}] exists but it is not a file`);
        return true; // unwanted result
    }
    private updateFileMeta(pathInUrl: string, md5: string, contentType: string | undefined): void {
        const meta: fileMeta = { md5: md5 };
        if (contentType != null) meta.contentType = contentType;
        const metaArray: Array<fileMeta> = this.staticFileMap.get(pathInUrl)?.filter((item) => item.md5 !== md5) || [];
        metaArray.unshift(meta);
        this.staticFileMap.set(pathInUrl, metaArray);
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
            [http2.constants.HTTP2_HEADER_ACCEPT_ENCODING]: `gzip, deflate`,
            [http2.constants.HTTP2_HEADER_ACCEPT_LANGUAGE]: `zh-CN,en-US;q=0.9`,
            ["X-Requested-With"]: `com.bilibili.madoka.bilibili`,
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

    private async batchHttp2GetSave(urlList: Array<URL>, concurrent = 8, _retries = 4): Promise<Array<http2BatchGetResultItem>> {
        let urlStrSet = new Set<string>();
        urlList.forEach((url) => {
            const key = url.href;
            if (urlStrSet.has(key)) throw new Error(`found duplicate url=${key} in urlList`);
        });

        concurrent = Math.floor(concurrent);
        if (concurrent < 1 || concurrent > 8) throw new Error("concurrent < 1 || concurrent > 8");

        let resultMap = new Map<string, http2BatchGetResultItem>();

        let hasError = false;
        let crawl = async (index: number): Promise<number | undefined> => {
            if (hasError) return undefined;
            if (isNaN(index)) throw new Error("isNaN(index)");
            if (index < 0 || index >= urlList.length) throw new Error("index < 0 || index >= urlList.length");

            let url = urlList[index];
            try {
                let resp = await this.http2GetBuf(url);
                let key = url.href;
                if (resp.is404) {
                    this.staticFile404Set.add(key);
                    urlStrSet.delete(key);
                } else {
                    this.saveFile(url.pathname, resp.body, resp.contentType);
                    if (resultMap.has(key)) throw new Error(`resultMap already has key=[${key}]`);
                    resultMap.set(key, { url: url, resp: resp });
                }
            } catch (e) {
                hasError = true;
                console.error(`batchHttp2Get error on url=[${url.href}]`, e);
                throw e;
            }

            let next = index + concurrent;
            if (next < urlList.length) return next;
            else return undefined;
        }

        let startPromises = urlList.slice(0, Math.min(concurrent, urlList.length))
            .map(async (_url, index) => {
                for (
                    let next: number | undefined = index;
                    next != null;
                    next = await crawl(next)
                );
            });
        await Promise.allSettled(startPromises);
        await Promise.all(startPromises);

        urlStrSet.forEach((urlStr) => {
            if (!resultMap.has(urlStr)) throw new Error(`resultMap does not have key=[${urlStr}]`); // should never happen
        });
        let results: Array<http2BatchGetResultItem> = [];
        resultMap.forEach((val) => results.push(val));
        return results;
    }


    private async fetchIndexHtml(): Promise<string> {
        const host = this.prodHost, path = "/magica/index.html";
        const reqHeaders: http2.OutgoingHttpHeaders = {
            [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_GET,
            [http2.constants.HTTP2_HEADER_PATH]: path,
            [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
            [http2.constants.HTTP2_HEADER_HOST]: host,
            [http2.constants.HTTP2_HEADER_ACCEPT_ENCODING]: `gzip, deflate`,
            [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: `text/plain; charset=utf-8`,
            ["Deviceid"]: `d00c434c-4744-46a8-bb66-c2aaec6972cb`,
            ["User-Id-Fba9x88mae"]: `magica_`,
            ["X-Platform-Host"]: `https://${host}`,
            ["Ticket"]: "",
            ["Ticket-Verify"]: `from_cocos`,
        }
        const indexUrl = new URL(`https://${host}${path}`);
        const resp = await this.http2GetStr(indexUrl, reqHeaders);
        const contentType = resp.contentType;
        if (!contentType?.match(/^text\/html(?=(\s|;|$))/)) throw new Error(`index.html contentType=[${contentType}] not text/html`);
        this.saveFile(indexUrl.pathname, Buffer.from(resp.body, 'utf-8'), contentType);
        return resp.body;
    }
    private async fetchFilesInReplacementJs(headTime: number): Promise<void> {
        const replacementJsUrl = new URL(`${this.httpsProdMagicaNoSlash}/js/system/replacement.js?${headTime}`);
        const resp = await this.http2GetStr(replacementJsUrl);
        const contentType = resp.contentType;
        if (!contentType?.match(/^application\/javascript(?=(\s|;|$))/)) throw new Error(`replacement.js contentType=[${contentType}] not application/javascript`);
        const replacementJs = resp.body;
        this.saveFile(replacementJsUrl.pathname, Buffer.from(replacementJs, 'utf-8'), contentType);
        const fileTimeStampObj: Record<string, string> = JSON.parse(
            replacementJs.replace(/^\s*window\.fileTimeStamp\s*=\s*/, "")
        );
        let urlList: Array<URL> = [];
        for (let subPath in fileTimeStampObj) {
            let fileTimeStamp = fileTimeStampObj[subPath]; //it's actually unknown what this value is
            if (!subPath?.match(/^([0-9a-z\-\._ \(\)]+\/)+[0-9a-z\-\._ \(\)]+\.[0-9a-z]+$/i)) throw new Error(`invalid subPath=[${subPath}] fileTimeStamp=[${fileTimeStamp}]`);
            if (!fileTimeStamp?.match(/^[0-9a-f]{16}$/)) throw new Error(`subPath=[${subPath}] has invalid fileTimeStamp=[${fileTimeStamp}]`);
            urlList.push(new URL(`${this.httpsProdMagicaNoSlash}/${subPath}`));
        }
        await this.batchHttp2GetSave(urlList);
    }

}