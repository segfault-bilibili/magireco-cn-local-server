import * as crypto from "crypto";
import * as http2 from "http2";
import * as fs from "fs";
import * as path from "path";
import * as parameters from "./parameters";
import { localServer } from "./local_server";

export type magirecoIDs = {
    device_id: string;
}

export type openIdTicket = {
    open_id: string,
    ticket: string,
    uname?: string,
    timestamp?: number,
}

type postData = { obj: any }
type httpApiRequest = { url: URL, postData?: postData }
type httpPostApiRequest = { url: URL, postData: postData }
type httpGetApiResult = { url: string, ts?: number, respBody: any }
type httpPostApiResult = { url: string, ts?: number, postData: postData, respBody: any }
type httpApiResult = { url: string, ts?: number, postData?: postData, respBody: any }
type httpApiBrResult = { url: string, ts?: number, postData?: postData, respBrBody: string }

export type dumpRespEntry = { ts?: number, body?: any, brBody: string }

export type dump = {
    uid: number,
    timestamp: number,
    isBr: boolean,
    httpResp: {
        get: Map<string, dumpRespEntry>,
        post: Map<string, Map<string, dumpRespEntry>>
    }
}

export const brBase64 = (data: any): string => {
    const stringified = JSON.stringify(data, parameters.replacer);
    const buf = Buffer.from(stringified, 'utf-8');
    const compressedBase64 = localServer.compress(buf, "br").toString('base64');
    return compressedBase64;
}

export const unBrBase64 = (brBase64?: string): any => {
    if (brBase64 == null) return brBase64;
    const compressedBuf = Buffer.from(brBase64, 'base64');
    const decompressedStr = localServer.decompress(compressedBuf, "br").toString("utf-8");
    const parsed = JSON.parse(decompressedStr, parameters.reviver);
    return parsed;
}

export const getUnBrBody = (map: Map<string, dumpRespEntry>, key: string): any => {
    const val = map.get(key);
    if (val == null) return;
    if (val.brBody == null) throw new Error("val.brBody == null");
    const buf = Buffer.from(val.brBody, 'base64');
    const decompressed = localServer.decompress(buf, "br").toString('utf-8');
    const parsed = JSON.parse(decompressed, parameters.reviver);
    return parsed;
}

export const guidRegEx = /^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i;

export class userdataDmp {
    private readonly params: parameters.params;
    private localServer: localServer;
    private get magirecoIDs(): magirecoIDs { return this.params.magirecoIDs; }
    get lastDump(): dump | undefined {
        return this._lastDump;
    }
    private _lastDump?: dump;
    get isDownloading(): boolean {
        return this._isDownloading;
    }
    private _isDownloading = false;
    get lastError(): any {
        return this._lastError;
    }
    private _lastError?: any;
    get fetchStatus(): string {
        return this._fetchStatus;
    }
    private _fetchStatus = "";

    private get timeStamp(): string {
        return String(new Date().getTime());
    }
    private get flag(): number {
        return this._flag++;
    }
    private _flag = 1;
    private clientSessionId: number;
    private get webSessionId(): string {
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse == null) throw new Error("unable to calculate webSessionId, bsgamesdkResponse == null");
        const loginTime = bsgamesdkResponse.timestamp;
        if (loginTime == null || loginTime === "") throw new Error("login timestamp is empty");
        if (isNaN(Number(loginTime))) throw new Error(`login timestamp=[${loginTime}] converted to NaN`);
        return this.dateTimeNumberStr(Number(loginTime));
    }
    private dateTimeNumberStr(time: number): string {
        const date = new Date(time);
        const year = String(date.getFullYear()).padStart(4, "0");
        const mon = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        const sec = String(date.getSeconds()).padStart(2, "0");
        return year + mon + day + hour + min + sec;
    }

    private get accessKey(): string {
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse == null) throw new Error("unable to read accessKey, bsgamesdkResponse == null");
        const accessKey = bsgamesdkResponse.access_key;
        if (accessKey == null || accessKey === "") throw new Error("accessKey is empty");
        return accessKey;
    }
    private get uid(): number {
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse == null) throw new Error("unable to read uid, bsgamesdkResponse == null");
        const uid = bsgamesdkResponse.uid;
        if (uid == null) throw new Error("uid is empty");
        return uid;
    }
    private get uname(): string {
        const bsgamesdkResponse = this.params.bsgamesdkResponse;
        if (bsgamesdkResponse == null) throw new Error("unable to read uname, bsgamesdkResponse is null");
        const uname = bsgamesdkResponse.uname;
        if (uname == null) throw new Error("unable to read uname, uname == null");
        return uname;
    }

    get isGameLoggedIn(): boolean {
        const openIdTicket = this.params.openIdTicket;
        if (openIdTicket == null) return false;
        const open_id = openIdTicket.open_id;
        if (open_id == null || open_id === "") return false;
        const ticket = openIdTicket.ticket;
        if (ticket == null || ticket === "") return false;
        return true;
    }

    get userdataDumpFileName(): string {
        return this.getUserdataDumpFileName(true);
    }
    private getUserdataDumpFileName(includeDateTime: boolean): string {
        let time = this._lastDump?.timestamp;
        const dateTimeNumberStr = includeDateTime ? this.dateTimeNumberStr(time == null ? new Date().getTime() : time)
            : "last";
        const filenameWithoutUid = `magireco_cn_dump_${dateTimeNumberStr}.json`;
        const lastDump = this.lastDump;
        if (lastDump == null) return filenameWithoutUid;
        return `magireco_cn_dump_uid_${lastDump.uid}_${dateTimeNumberStr}.json`;
    }
    readonly userdataDumpFileNameRegEx = /^\/magireco_cn_dump[^\/\\]*\.json$/;
    readonly oldInternalUserdataDumpFileName = "lastUserdataDump.br";
    readonly internalUserdataDumpFileName = "lastUserdataDumpBr.json";

    constructor(params: parameters.params, localServer: localServer) {
        this.params = params;
        this.localServer = localServer;
        this.clientSessionId = 100 + Math.floor(Math.random() * 899);
        this.loadLastDump();
    }

    getDumpAsync(): Promise<dump> {
        return new Promise((resolve, reject) =>
            this.getDumpPromise()
                .then((result) => resolve(result))
                .catch((err) => {
                    this.params.save({ key: "openIdTicket", val: undefined })
                        .finally(() => {
                            this._isDownloading = false;
                            reject(this._lastError = err);
                        });
                })
        );
    }
    private async getDumpPromise(concurrent = 8): Promise<dump> {
        if (this.params.mode === parameters.mode.LOCAL_OFFLINE) throw new Error("cannot dump userdata in local offline mode");
        if (this.isDownloading) throw new Error("previous download has not finished");
        this._isDownloading = true;
        this._lastError = undefined;
        this._fetchStatus = "";

        if (!this.params.concurrentFetch) concurrent = 1;
        concurrent = Math.trunc(concurrent);
        if (concurrent < 1 || concurrent > 8) throw new Error("concurrent < 1 || concurrent > 8");

        const timestamp = new Date().getTime();
        const httpGetRespMap = new Map<string, dumpRespEntry>(),
            httpPostRespMap = new Map<string, Map<string, dumpRespEntry>>();

        let stage = 1;

        const grow = async (seeds: Array<httpApiRequest>) => {
            let results: Array<httpApiBrResult> = [];
            for (let start = 0, total = seeds.length; start < total; start += concurrent) {
                let end = Math.min(start + concurrent, total);
                let requests = seeds.slice(start, end);
                let promises = requests.map((request) => (request.postData == null ? this.execHttpGetApi(request.url)
                    : this.execHttpPostApi(request.url, request.postData)).then((result: unknown) => {
                        (result as httpApiBrResult).respBrBody = brBase64((result as httpApiResult).respBody);
                        delete (result as httpApiResult).respBody;
                        return result as httpApiBrResult;
                    }));
                let settleStatus = await Promise.allSettled(promises);
                let failed = settleStatus.filter((s) => s.status !== 'fulfilled').length;
                if (failed > 0) {
                    this._fetchStatus = `stage [${stage}/3]: ${failed} of ${settleStatus.length} failed, total [${total}]`;
                    let err: any = new Error(this._fetchStatus);
                    try {
                        let firstFailedIndex = settleStatus.findIndex((s) => s.status !== 'fulfilled');
                        let firstFailedPromise = promises[firstFailedIndex];
                        await firstFailedPromise;
                    } catch (e) {
                        console.error(this._fetchStatus, err = e);
                        if (err instanceof Error) this._fetchStatus += `\n${err.message}`;
                    }
                    throw this._lastError = err;
                }
                console.log(this._fetchStatus = `stage [${stage}/3]: fetched/total [${end}/${total}]`);
                let responses = await Promise.all(promises);
                responses.forEach((response) => results.push(response));
            }
            return results;
        }
        const reap = (
            crops: Array<httpApiBrResult>,
            httpGetMap: Map<string, dumpRespEntry>, httpPostMap: Map<string, Map<string, dumpRespEntry>>
        ) => {
            crops.map((result) => {
                if (result.postData == null) {
                    const map = httpGetMap;
                    const key = result.url, brBody = result.respBrBody, ts = result.ts;
                    if (map.has(key)) throw new Error(`key=[${key}] already exists`);
                    let val: dumpRespEntry = { brBody: brBody };
                    if (ts != null) val.ts = ts;
                    map.set(key, val);
                } else {
                    const map = httpPostMap;
                    const key = result.url, brBody = result.respBrBody, ts = result.ts;
                    const existingValMap = map.get(key);
                    const valMap = existingValMap != null ? existingValMap : new Map<string, dumpRespEntry>();
                    const valMapKey = JSON.stringify(result.postData.obj);
                    if (valMap.has(valMapKey)) throw new Error(`key=[${key}] already exists`);
                    let valMapVal: dumpRespEntry = { brBody: brBody };
                    if (ts != null) valMapVal.ts = ts;
                    valMap.set(valMapKey, valMapVal);
                    map.set(key, valMap);
                }
            });
            stage++;
        }

        if (!this.isGameLoggedIn || !(await this.testLogin())) {
            console.log(`reattempt login...`);
            await this.gameLogin();
            if (!(await this.testLogin())) throw new Error("login test failed, cannot login");
        }

        const requests1 = this.firstRoundUrlList.map((url) => { return { url: url }; });
        console.log(`userdataDmp.getDump() 1st round fetching...`);
        const responses1 = await grow(requests1);
        console.log(`userdataDmp.getDump() 1st round collecting...`);
        reap(responses1, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getDump() 1st round completed`);

        console.log(`userdataDmp.getDump() 2nd round fetching...`);
        const responses2 = await grow(this.getSecondRoundRequests(httpGetRespMap));
        console.log(`userdataDmp.getDump() 2nd round collecting...`);
        reap(responses2, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getDump() 2nd round completed`);

        console.log(`userdataDmp.getDump() 3rd round fetching...`);
        const responses3 = await grow(this.getThirdRoundRequests(httpGetRespMap, httpPostRespMap));
        console.log(`userdataDmp.getDump() 3rd round collecting...`);
        reap(responses3, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getDump() 3rd round completed`);

        if (this.params.arenaSimulate) {
            await this.mirrorsSimulateAll(httpGetRespMap, httpPostRespMap);
        }

        this._lastDump = {
            uid: this.uid,
            isBr: true,
            timestamp: timestamp,
            httpResp: {
                get: httpGetRespMap,
                post: httpPostRespMap,
            },
        };

        console.log(this._fetchStatus = "JSON.stringify()...");
        let jsonBuf = Buffer.from(JSON.stringify(this._lastDump, parameters.replacer), 'utf-8');
        console.log(this._fetchStatus = `writting to [${this.internalUserdataDumpFileName}] ...`);
        fs.writeFileSync(path.join(".", this.internalUserdataDumpFileName), jsonBuf);
        console.log(this._fetchStatus = `written to [${this.internalUserdataDumpFileName}]`);

        this._isDownloading = false;
        return this._lastDump;
    }

    loadLastDump(): void {
        if (this._lastDump != null) {
            console.log("won't replace current dump");
            return;
        }
        try {
            const filePath = path.join(".", this.internalUserdataDumpFileName);
            const legacyFilePath = path.join(".", this.oldInternalUserdataDumpFileName);
            if (fs.existsSync(legacyFilePath) && fs.statSync(legacyFilePath).isFile()) {
                console.log(`converting [${legacyFilePath}] ...`);
                let compressed = fs.readFileSync(legacyFilePath);
                let decompressedStr = localServer.decompress(compressed, "br").toString('utf-8');
                let parsed: dump = JSON.parse(decompressedStr, parameters.reviver);
                let mapArray = [parsed.httpResp.get];
                parsed.httpResp.post.forEach((val) => mapArray.push(val));
                mapArray.forEach((map) => {
                    map.forEach((val) => {
                        let stringified = JSON.stringify(val.body, parameters.replacer);
                        let compressedBase64 = localServer.compress(Buffer.from(stringified, 'utf-8'), "br")
                            .toString('base64');
                        val.brBody = compressedBase64;
                        delete val.body;
                    });
                });
                parsed.isBr = true;
                let convertedStr = JSON.stringify(parsed, parameters.replacer);
                fs.writeFileSync(filePath, convertedStr);
                fs.rmSync(legacyFilePath);
            }

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                console.log(`loading [${filePath}] ...`);
                let lastDumpStr = fs.readFileSync(filePath, 'utf-8');
                this._lastDump = JSON.parse(lastDumpStr, parameters.reviver);
                console.log(`loaded ${this.userdataDumpFileName}`);
            }
        } catch (e) {
            console.log(`loadLastDump`, e);
        }
    }

    private async testLogin(): Promise<boolean> {
        const testURL = new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/announcements/red/obvious`);
        try {
            const testResult = await this.execHttpGetApi(testURL);
            if (testResult.respBody.resultCode !== "success") {
                const msg = `resultCode=${testResult.respBody.resultCode} errorTxt=${testResult.respBody.errorTxt}`;
                throw new Error(msg);
            }
            return true;
        } catch (e) {
            console.error(`login test failed`, e);
            return false;
        }
    }

    private magirecoJsonRequst(url: URL, postData?: postData, isNative = false): Promise<NonNullable<any>> {
        return new Promise((resolve, reject) => {
            const host = url.host;
            const path = url.pathname + url.search;
            const isPOST = postData != null;
            const postDataStr = isPOST ? JSON.stringify(postData.obj) : undefined;
            const method = isPOST ? http2.constants.HTTP2_METHOD_POST : http2.constants.HTTP2_METHOD_GET;
            const reqHeaders = isNative ? {
                [http2.constants.HTTP2_HEADER_METHOD]: method,
                [http2.constants.HTTP2_HEADER_PATH]: path,
                [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
                [http2.constants.HTTP2_HEADER_HOST]: host,
                [http2.constants.HTTP2_HEADER_ACCEPT_ENCODING]: "gzip, deflate",
                ["Devicedata"]: "",
                ["Deviceid"]: `${this.magirecoIDs.device_id}`,
                ["X-Platform-Host"]: "https://l3-prod-all-gs-mfsn2.bilibiligame.net",
                ["Ticket-Verify"]: "from_cocos",
            } : {
                [http2.constants.HTTP2_HEADER_METHOD]: method,
                [http2.constants.HTTP2_HEADER_PATH]: path,
                [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
                [http2.constants.HTTP2_HEADER_HOST]: host,
                ["Client-Os-Ver"]: "Android OS 6.0.1 / API-23 (V417IR/eng.duanlusheng.20220819.111943)",
                ["X-Platform-Host"]: host,
                ["Client-Model-Name"]: "MuMu",
                [http2.constants.HTTP2_HEADER_USER_AGENT]: "Mozilla/5.0 (Linux; Android 6.0.1; MuMu Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36",
                ["Flag"]: `${this.flag}:${this.timeStamp}`,
                [http2.constants.HTTP2_HEADER_ACCEPT]: "application/json, text/javascript, */*; q=0.01",
                ["X-Requested-With"]: "XMLHttpRequest",
                ["Client-Session-Id"]: `${this.clientSessionId}`,
                ["F4s-Client-Ver"]: "2.2.1",
                [http2.constants.HTTP2_HEADER_REFERER]: `https://${host}/magica/index.html`,
                [http2.constants.HTTP2_HEADER_CONTENT_ENCODING]: "gzip, deflate",
                [http2.constants.HTTP2_HEADER_ACCEPT_LANGUAGE]: "zh-CN,en-US;q=0.9",
            }
            if (isPOST) reqHeaders[http2.constants.HTTP2_HEADER_CONTENT_TYPE] = "application/json; charset=utf-8";
            const isLogin = url.pathname === "/magica/api/system/game/login";
            const openIdTicket = this.params.openIdTicket;
            const open_id = openIdTicket?.open_id;
            const ticket = openIdTicket?.ticket;
            try {
                if (isLogin) {
                    if (open_id != null) reqHeaders["User-Id-Fba9x88mae"] = open_id;
                } else {
                    if (ticket == null) throw new Error("not login but ticket == null");
                    if (open_id == null) throw new Error("not login but open_id == null");
                    reqHeaders["Ticket"] = ticket;
                    reqHeaders["User-Id-Fba9x88mae"] = open_id;
                    reqHeaders["Webview-Session-Id"] = this.webSessionId;
                }
                this.localServer.emitHttp2RequestAsync(url, reqHeaders, postDataStr, true).then((result) => {
                    const openIdTicket = this.params.openIdTicket;
                    const newTicket = result.headers["ticket"];
                    let ticketRenewed = false;
                    if (openIdTicket != null && typeof newTicket === 'string') {
                        if (openIdTicket.ticket !== newTicket && newTicket.match(guidRegEx)) {
                            console.log(`renew ticket`);
                            openIdTicket.ticket = newTicket;
                            ticketRenewed = true;
                        }
                    }
                    const resolveOrReject = () => {
                        const statusCode = result.headers[":status"];
                        if (statusCode != 200) reject(new Error(`statusCode=[${statusCode}]`));
                        else if (typeof result.respBody !== 'string') reject(new Error("cannot parse binary data"));
                        else try {
                            if (result.respBody === "") reject(new Error("respBody is empty"));
                            const respBodyParsed = JSON.parse(result.respBody);
                            if (respBodyParsed == null) reject(new Error("respBodyParsed == null"));
                            else resolve(respBodyParsed);
                        } catch (e) {
                            reject(e);
                        }
                    }
                    if (ticketRenewed) this.params.save().then(() => resolveOrReject());
                    else resolveOrReject();
                }).catch((e) => reject(e));
            } catch (e) {
                reject(e);
            }
        });
    }

    private async gameLogin(): Promise<NonNullable<any>> {
        let postDataObj = {
            accessKey: `${this.accessKey}`,
            sdkGameId: "810",
            sdkMerchantId: "1",
            sdkServerId: "1034",
            game_id: 1,
            product_type: 1,
            hotfix_ver: "30011",
            platform_id: 2,
            channel_id: 1,
            account_name: `${this.uname}`,
            account_uid: `${this.uid}`,
            server_id: 20000,
            deviceinfo: `${this.magirecoIDs.device_id};Android OS 6.0.1 / API-23 (V417IR/eng.duanlusheng.20220819.111943);MuMu;com.bilibili.madoka.bilibili`,
            reg_device_id: `${this.magirecoIDs.device_id}`,
            last_device_id: `${this.magirecoIDs.device_id}`,
            app_version: "2.2.1",
        }
        const gameLoginURL = new URL("https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/system/game/login");
        const resp = await this.magirecoJsonRequst(gameLoginURL, { obj: postDataObj });
        if (resp.resultCode !== "success") {
            console.error(`gameLogin unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
            throw new Error(JSON.stringify(resp));
        }
        this._flag = 1;
        return resp;
    }

    private get firstRoundUrlList(): Array<URL> {
        const ts = this.timeStamp;
        const list = [
            //登录页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
                + `user`
                + `%2CgameUser`
                + `%2CitemList`
                + `%2CgiftList`
                + `%2CpieceList`
                + `%2CuserQuestAdventureList`
                + `&timeStamp=${ts}`
            ),
            //首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MyPage?value=`
                + `user`
                + `%2CgameUser`
                + `%2CuserStatusList`
                + `%2CuserCharaList`
                + `%2CuserCardList`
                + `%2CuserDoppelList`
                + `%2CuserItemList`
                + `%2CuserGiftList`
                + `%2CuserDoppelChallengeList`
                + `%2CuserDailyChallengeList`
                + `%2CuserTotalChallengeList`
                + `%2CuserNormalAchievementList`
                + `%2CuserMoneyAchievementList`
                + `%2CuserLimitedChallengeList`
                + `%2CuserGiftList`
                + `%2CuserPieceList`
                + `%2CuserPieceSetList`
                + `%2CuserDeckList`
                + `%2CuserLive2dList`
                + `&timeStamp=${ts}`
            ),
            //魔法少女首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaListTop?value=`
                + `&timeStamp=${ts}`
            ),
            //记忆结晶首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MemoriaTop?value=`
                + `&timeStamp=${ts}`
            ),
            //记忆结晶保管库
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PieceArchive?value=`
                + `&timeStamp=${ts}`),
            //扭蛋首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaTop?value=`
                + `&timeStamp=${ts}`
            ),
            //扭蛋获得履历（仅GUID，仅第一页）
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
                + `&timeStamp=${ts}`
            ),
            //任务
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MissionTop?value=`
                + `userDailyChallengeList`
                + `%2CuserTotalChallengeList`
                + `%2CuserNormalAchievementList`
                + `%2CuserMoneyAchievementList`
                + `%2CGrowthFundList`
                + `%2CGrowth2FundList`
                + `%2CgameUser`
                + `%2CuserLimitedChallengeList&timeStamp=${ts}`
            ),
            //集章卡
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PanelMissionTop?value=`
                + `&timeStamp=${ts}`
            ),
            //商店
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ShopTop?value=`
                + `userFormationSheetList`
                + `&timeStamp=${ts}`
            ),
            //礼物奖励箱（只有第一页）
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentList?value=`
                + `&timeStamp=${ts}`
            ),
            //获得履历（只有第一页）
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory?value=`
                + `&timeStamp=${ts}`
            ),
            //档案
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CollectionTop?value=`
                + `&timeStamp=${ts}`
            ),
            //魔法少女图鉴
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaCollection?value=`
                + `&timeStamp=${ts}`
            ),
            //记忆结晶图鉴
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PieceCollection?value=`
                + `&timeStamp=${ts}`
            ),
            //剧情存档
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/StoryCollection?value=`
                + `&timeStamp=${ts}`
            ),
            //魔女化身图鉴
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/DoppelCollection?value=`
                + `&timeStamp=${ts}`
            ),
            //魔女·传闻图鉴
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EnemyCollection?value=`
                + `&timeStamp=${ts}`
            ),
            //道具首页
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ItemListTop?value=`
                + `&timeStamp=${ts}`
            ),
            //不同素材副本一览
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SearchQuest?value=`
                + `userFollowList`
                + `&timeStamp=${ts}`
            ),
            //好友（关注，仅GUID）
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FollowTop?value=`
                + `userFollowList`
                + `&timeStamp=${ts}`
            ),
            //好友（粉丝，仅GUID）
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/follower/list/1`
            ),
            //长按好友打开支援详情
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ProfileFormationSupport?value=`
                + `userFormationSheetList`
                + `&timeStamp=${ts}`
            ),
            //设定
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ConfigTop?value=`
                + `&timeStamp=${ts}`
            ),
            //队伍首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FormationTop?value=`
                + `&timeStamp=${ts}`
            ),
            //任务/支援/镜界组队
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/DeckFormation?value=`
                + `&timeStamp=${ts}`
            ),
            //记忆结晶组合
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MemoriaSetEquip?value=`
                + `&timeStamp=${ts}`
            ),
            //镜层首页
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaTop?value=`
                + `userArenaBattle&timeStamp=${ts}`
            ),
            //普通镜层对战
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaFreeRank?value=`
                + `&timeStamp=${ts}`
            ),
            //镜层演习
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaSimulate?value=`
                + `&timeStamp=${ts}`
            ),
            //对战记录
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaHistory?value=`
                + `&timeStamp=${ts}`
            ),
            //排名战绩
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EventArenaRankingHistory?value=` +
                `&timeStamp=${ts}`
            ),
            //报酬一览（从游戏界面上看好像每个人都一样）
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaReward?value=`
                + `&timeStamp=${ts}`
            ),
            //主线剧情
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MainQuest?value=`
                + `userChapterList`
                + `%2CuserSectionList`
                + `%2CuserQuestBattleList`
                + `%2CuserFollowList&timeStamp=${ts}`
            ),
            //支线剧情
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SubQuest?value=`
                + `&timeStamp=${ts}`
            ),
            //魔法少女剧情
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaQuest?value=`
                + `&timeStamp=${ts}`
            ),
            //狗粮本
            new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EventQuest?value=`
                + `&timeStamp=${ts}`
            ),
        ];
        if (this.params.fetchCharaEnhancementTree) {
            //长按好友打开支援详情时出现，可能与精神强化有关
            list.push(new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ProfileFormationSupport?value=`
                + `userFormationSheetList`
                + `%2CuserCharaEnhancementCellList`
                + `&timeStamp=${ts}`
            ));
        }
        return list;
    }
    static readonly fakeFriends = [
        "87a24321-6c49-11e7-a958-0600870902db",
        "2979c9c3-6c45-11e7-a337-0671507456ff",
        "399b7919-6c85-11e7-8d60-0600870902db",
        "825a7c41-6c49-11e7-a337-0671507456ff",
        "f333fb92-6c46-11e7-a958-0600870902db",
        "319e4655-6c4c-11e7-a958-0600870902db",
        "0092c036-6c45-11e7-a958-0600870902db",
        "6ddce439-6c47-11e7-a337-0671507456ff",
        "3cc2ec68-6c45-11e7-a958-0600870902db",
        "056a8707-6c45-11e7-a958-0600870902db"
    ]
    private getSecondRoundRequests(map: Map<string, dumpRespEntry>): Array<httpApiRequest> {
        const requests: Array<httpApiRequest> = [];

        const getPageCount = (total: number, perPage: number) => {
            let remainder = total % perPage;
            let floored = total - remainder;
            let pageCount = floored / perPage;
            if (remainder > 0) pageCount += 1;
            return pageCount;
        }

        const topPage = getUnBrBody(map, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
            + `user`
            + `%2CgameUser`
            + `%2CitemList`
            + `%2CgiftList`
            + `%2CpieceList`
            + `%2CuserQuestAdventureList`
            + `&timeStamp=`
        );
        const myPage = getUnBrBody(map, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MyPage?value=`
            + `user`
            + `%2CgameUser`
            + `%2CuserStatusList`
            + `%2CuserCharaList`
            + `%2CuserCardList`
            + `%2CuserDoppelList`
            + `%2CuserItemList`
            + `%2CuserGiftList`
            + `%2CuserDoppelChallengeList`
            + `%2CuserDailyChallengeList`
            + `%2CuserTotalChallengeList`
            + `%2CuserNormalAchievementList`
            + `%2CuserMoneyAchievementList`
            + `%2CuserLimitedChallengeList`
            + `%2CuserGiftList`
            + `%2CuserPieceList`
            + `%2CuserPieceSetList`
            + `%2CuserDeckList`
            + `%2CuserLive2dList`
            + `&timeStamp=`
        );

        //左上角个人头像
        const userLive2dList = myPage["userLive2dList"];
        if (userLive2dList == null || !Array.isArray(userLive2dList)) throw new Error("unable to read userLive2dList");
        const allCharaIds = userLive2dList.map((item) => {
            let charaId = item["charaId"];
            if (typeof charaId !== 'number' || isNaN(charaId)) throw new Error("invalid charaId");
            return charaId;
        });
        console.log(`allCharaIds.length=[${allCharaIds.length}]`);
        const gameUser = topPage["gameUser"];
        const myUserId = gameUser["userId"];
        if (typeof myUserId !== 'string') throw new Error("myUserId must be string");
        if (myUserId.match(guidRegEx) == null) throw new Error("myUserId is not guid");
        requests.push({
            url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/user/${myUserId}`),
        });
        //好友推荐
        requests.push({
            url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/search/friend_search/_search`),
            postData: { obj: { type: 0 } }
        });
        //好友
        const friendList: Set<string> = new Set<string>();
        //关注列表
        const followTop = getUnBrBody(map,
            `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FollowTop?value=`
            + `userFollowList`
            + `&timeStamp=`
        );
        const userFollowList = followTop["userFollowList"];
        if (userFollowList == null || !Array.isArray(userFollowList)) throw new Error("unable to read userFollowList");
        userFollowList.forEach((item) => {
            const followUserId = item["followUserId"];
            if (typeof followUserId !== 'string') throw new Error("unable to read followUserId");
            if (!followUserId.match(guidRegEx)) throw new Error("followUserId must be guid");
            friendList.add(followUserId);
        });
        //粉丝列表
        const friendFollowerList = getUnBrBody(map,
            `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/follower/list/1`
        );
        if (friendFollowerList == null || !Array.isArray(friendFollowerList)) throw new Error("unable to read friendFollowerList");
        friendFollowerList.forEach((item) => {
            const followerUserId = item["followerUserId"];
            if (typeof followerUserId !== 'string') throw new Error("unable to read followerUserId");
            if (!followerUserId.match(guidRegEx)) throw new Error("followerUserId must be guid");
            friendList.add(followerUserId);
        });
        //把关注和粉丝汇总
        friendList.forEach((id) => requests.push({
            url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/user/${id}`)
        }));
        //助战选择
        //看上去来自这里：https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/json/friend_search/_search.json?72e447c0eff8c6a7
        requests.push({
            url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SupportSelect`),
            postData: {
                obj: {
                    strUserIds: userdataDmp.fakeFriends.join(","),
                    strNpcHelpIds: "102",//214水波的NPC桃子
                }
            }
        });
        //扭蛋获得履历（仅GUID）
        const gachasPerPage = 50;
        const gachaHistory = getUnBrBody(map, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
            + `&timeStamp=`
        );
        const gachaHistoryCount = gachaHistory["gachaHistoryCount"];
        if (typeof gachaHistoryCount !== 'number' || isNaN(gachaHistoryCount)) throw new Error("gachaHistoryCount must be number");
        const gachaPageCount = getPageCount(gachaHistoryCount, gachasPerPage);
        for (let i = 2; i <= gachaPageCount; i++) {
            requests.push({
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory`),
                postData: { obj: { page: `${i}` } }
            });
        }
        //礼物奖励箱
        const presentPerPage = 50;
        const presentList = getUnBrBody(map, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentList?value=`
            + `&timeStamp=`
        );
        const presentCount = presentList["presentCount"];
        if (typeof presentCount !== 'number' || isNaN(presentCount)) throw new Error("presentCount must be number");
        const presentPageCount = getPageCount(presentCount, presentPerPage);
        for (let i = 2; i <= presentPageCount; i++) {
            requests.push({
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentList`),
                postData: { obj: { page: `${i}` } }
            })
        }
        //获得履历
        const presentHistoryPerPage = 100;
        const presentHistory = getUnBrBody(map, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory?value=`
            + `&timeStamp=`
        );
        const presentHistoryCount = presentHistory["presentHistoryCount"];
        if (typeof presentHistoryCount !== 'number' || isNaN(presentHistoryCount)) throw new Error("presentHistoryCount must be number");
        const presentHistoryPageCount = getPageCount(presentHistoryCount, presentHistoryPerPage);
        for (let i = 2; i <= presentHistoryPageCount; i++) {
            requests.push({
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory`),
                postData: { obj: { page: `${i}` } }
            })
        }
        //精神强化（未开放）
        if (this.params.fetchCharaEnhancementTree) {
            const userFormationSheetList = getUnBrBody(map,
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ProfileFormationSupport?value=`
                + `userFormationSheetList`
                + `%2CuserCharaEnhancementCellList`
                + `&timeStamp=`
            );
            const userCharaEnhancementCellList = userFormationSheetList["userCharaEnhancementCellList"];
            if (userCharaEnhancementCellList == null || !Array.isArray(userCharaEnhancementCellList))
                throw new Error("unable to read userCharaEnhancementCellList");
            const charaIds = userCharaEnhancementCellList.map((item) => {
                let charaId = item["charaId"];
                if (typeof charaId !== 'number' || isNaN(charaId)) throw new Error("unable to read charaId");
                return charaId;
            });
            charaIds.forEach((charaId) => {
                requests.push({
                    url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaEnhancementTree`),
                    postData: { obj: { charaId: `${charaId}` } }
                });
            });
        }
        return requests;
    }
    private getThirdRoundRequests(
        httpGetMap: Map<string, dumpRespEntry>,
        httpPostMap: Map<string, Map<string, dumpRespEntry>>
    ): Array<httpApiRequest> {
        //扭蛋获得履历
        const gachaHistoryPages: Array<{ gachaHistoryList: Array<{ id: string }> }> = [];
        const gachaIds: Array<string> = [];

        const gachaHistoryFirstPage = getUnBrBody(httpGetMap, `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
            + `&timeStamp=`
        );
        gachaHistoryPages.push(gachaHistoryFirstPage);

        const gachaHistoryMap = httpPostMap.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory`);
        gachaHistoryMap?.forEach((resp) => gachaHistoryPages.push(unBrBase64(resp.brBody)));
        gachaHistoryPages.map((item) => {
            let gachaHistoryList = item["gachaHistoryList"];
            if (gachaHistoryList == null || !Array.isArray(gachaHistoryList)) throw new Error("unable to read gachaHistoryList");
            gachaHistoryList.forEach((item) => {
                let id = item["id"];
                if (typeof id !== 'string' || id.match(guidRegEx) == null) throw new Error("unable to read gacha id");
                gachaIds.push(id);
            });
        });

        const requests = gachaIds.map((id) => {
            return {
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/gacha/result/${id}`),
            };
        });

        //好友
        const friendList: Set<string> = new Set<string>();
        //好友推荐
        const friend_search = unBrBase64(httpPostMap.get(
            `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/search/friend_search/_search`
        )?.get(JSON.stringify({ type: 0, }))?.brBody);
        if (friend_search == null || !Array.isArray(friend_search)) throw new Error("unable to read friend_search type 0");
        friend_search.forEach((item) => {
            const id = item["id"];
            if (typeof id !== 'string') throw new Error("unable to read id from friend_search type 0");
            if (!id.match(guidRegEx)) throw new Error("id (from friend_search type 0) must be guid");
            friendList.add(id);
        });
        //214水波
        const SupportSelect = unBrBase64(httpPostMap.get(
            `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SupportSelect`
        )?.get(JSON.stringify({
            strUserIds: userdataDmp.fakeFriends.join(","),
            strNpcHelpIds: "102",//214水波的NPC桃子
        }))?.brBody);
        const supportUserList = SupportSelect["supportUserList"];
        if (supportUserList == null || !Array.isArray(supportUserList)) throw new Error("unable to read supportUserList");
        supportUserList.forEach((item) => {
            const userId = item["userId"];
            if (typeof userId !== 'string') throw new Error("unable to read id from supportUserList");
            if (!userId.match(guidRegEx)) throw new Error("id (from supportUserList) must be guid");
            friendList.add(userId);
        });
        //把好友推荐和214水波合并
        friendList.forEach((id) => {
            let urlStr = new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/user/${id}`);
            if (!httpGetMap.has(urlStr.href)) requests.push({ url: urlStr }); //跳过之前下载过的
        });

        return requests;
    }
    private async mirrorsSimulateAll(httpGetMap: Map<string, dumpRespEntry>,
        httpPostMap: Map<string, Map<string, dumpRespEntry>>
    ): Promise<void> {
        if (!this.params.arenaSimulate) return;
        //镜层演习开战
        const arenaStartUrlStr = `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/arena/start`;
        let arenaStartMap = httpPostMap.get(arenaStartUrlStr);
        if (arenaStartMap == null || !(arenaStartMap instanceof Map)) {
            arenaStartMap = new Map<string, dumpRespEntry>();
            httpPostMap.set(arenaStartUrlStr, arenaStartMap);
        }
        const nativeGetUrlStr = `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/quest/native/get`;
        let nativeGetMap = httpPostMap.get(nativeGetUrlStr);
        if (nativeGetMap == null || !(nativeGetMap instanceof Map)) {
            nativeGetMap = new Map<string, dumpRespEntry>();
            httpPostMap.set(nativeGetUrlStr, nativeGetMap);
        }

        const requests: Array<httpPostApiRequest> = [];
        const arenaSimulate = getUnBrBody(httpGetMap,
            `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaSimulate?value=`
            + `&timeStamp=`
        );
        const opponentUserArenaBattleInfoList = arenaSimulate?.userArenaBattleMatch?.opponentUserArenaBattleInfoList;
        if (opponentUserArenaBattleInfoList == null || !Array.isArray(opponentUserArenaBattleInfoList))
            throw new Error("unable to read opponentUserArenaBattleInfoList");
        opponentUserArenaBattleInfoList.forEach((item) => {
            const userId = item.userId;
            if (typeof userId !== 'string') throw new Error("userId must be string");
            if (!userId.match(guidRegEx)) throw new Error("userId must be guid");
            const arenaBattleOpponentTeamType = item.arenaBattleOpponentTeamType;
            if (typeof arenaBattleOpponentTeamType !== 'string') throw new Error("arenaBattleOpponentTeamType must be string");
            requests.push({
                url: new URL(arenaStartUrlStr),
                postData: {
                    obj: {
                        opponentUserId: userId,
                        arenaBattleType: "SIMULATE",
                        arenaBattleOpponentTeamType: arenaBattleOpponentTeamType,
                    }
                }
            })
        });

        for (let i = 0; i < requests.length; i++) {
            let req = requests[i];
            let resp = await this.execHttpPostApi(req.url, req.postData);
            let userArenaBattleResultList1 = resp.respBody?.userArenaBattleResultList;
            if (userArenaBattleResultList1 == null) throw new Error("userArenaBattleResultList1 == null");
            if (!Array.isArray(userArenaBattleResultList1)) throw new Error("userArenaBattleResultList1 must be array");
            if (userArenaBattleResultList1.length == 0) throw new Error("userArenaBattleResultList1 is empty");
            let userQuestBattleResultId = userArenaBattleResultList1[0].userQuestBattleResultId;
            if (typeof userQuestBattleResultId !== 'string') throw new Error("userQuestBattleResultId must be string");
            if (!userQuestBattleResultId.match(guidRegEx)) throw new Error("userQuestBattleResultId must be guid");
            let startBattleReq = {
                url: new URL(nativeGetUrlStr),
                postData: { obj: { userQuestBattleResultId: userQuestBattleResultId } },
            }
            let startBattleResp = await this.execHttpPostApi(startBattleReq.url, startBattleReq.postData, true);
            let playerList = startBattleResp.respBody?.playerList;
            if (playerList == null || !Array.isArray(playerList)) throw new Error("cannot read playerList from battleStartResp");
            let playerListInResult = playerList.map((player) => ({
                cardId: player.cardId,
                pos: player.pos,
                hp: player.hp,
                hpRemain: 0,
                mpRemain: 1000,
                attack: player.attack,
                defence: player.defence,
                mpup: player.mpup,
                blast: 0,
                charge: 0,
                rateGainMpAtk: player.rateGainMpAtk,
                rateGainMpDef: player.rateGainMpDef,
            }));
            let resultObj = {
                userQuestBattleResultId: userQuestBattleResultId,
                totalWave: 1,
                totalTurn: 1,
                continueNum: 0,
                clearTime: 59,
                result: 'FAILED',
                finishType: 'UNKNOWN',
                lastAttackCardId: null,
                isFinishLeader: false,
                killNum: 0,
                rateHp: 0,
                questLoop: false,
                stackedChargeNum: 0,
                deadNum: playerList.length,
                diskAcceleNum: 0,
                diskBlastNum: 0,
                diskChargeNum: 0,
                comboAcceleNum: 0,
                comboBlastNum: 0,
                comboChargeNum: 0,
                chainNum: 0,
                chargeNum: 0,
                chargeMax: 0,
                skillNum: 0,
                connectNum: 0,
                magiaNum: 0,
                doppelNum: 0,
                abnormalNum: 0,
                avoidNum: 0,
                counterNum: 0,
                totalDamageByFire: 0,
                totalDamageByWater: 0,
                totalDamageByTimber: 0,
                totalDamageByLight: 0,
                totalDamageByDark: 0,
                totalDamageBySkill: 0,
                totalDamageByVoid: 0,
                totalDamage: 999999,
                totalDamageFromPoison: 0,
                badCharmNum: 0,
                badStunNum: 0,
                badRestraintNum: 0,
                badPoisonNum: 0,
                badBurnNum: 0,
                badCurseNum: 0,
                badFogNum: 0,
                badDarknessNum: 0,
                badBlindnessNum: 0,
                badBanSkillNum: 0,
                badBanMagiaNum: 0,
                badInvalidHealHpNum: 0,
                badInvalidHealMpNum: 0,
                waveList: [{ totalDamage: 0, mostDamage: 0 }],
                playerList: playerListInResult
            }
            let stopBattleReq = {
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/quest/native/result/send`),
                postData: { obj: { param: JSON.stringify(resultObj) } }
            }
            let stopBattleResp = await this.execHttpPostApi(stopBattleReq.url, stopBattleReq.postData, true);
            let userArenaBattleResultList = stopBattleResp.respBody?.userArenaBattleResultList;
            if (userArenaBattleResultList == null || !Array.isArray(userArenaBattleResultList))
                throw new Error("cannot read userArenaBattleResultList");
            if (userArenaBattleResultList.length == 0)
                throw new Error("userArenaBattleResultList is empty");
            let opponentUserId = userArenaBattleResultList[0]?.opponentUserId;
            if (typeof opponentUserId !== 'string') throw new Error("opponentUserId must be string");
            if (!opponentUserId.match(guidRegEx)) throw new Error("opponentUserId must be guid");
            let arenaResultReq = {
                url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaResult`),
                postData: { obj: { strUserId: opponentUserId } }
            }
            await this.execHttpPostApi(arenaResultReq.url, arenaResultReq.postData);

            arenaStartMap.set(JSON.stringify(req.postData.obj), {
                brBody: brBase64(resp.respBody),
            })
            nativeGetMap.set(JSON.stringify(startBattleReq.postData.obj), {
                brBody: brBase64(startBattleResp.respBody),
            });

            console.log(this._fetchStatus = `mirrorsSimulateAll [${i + 1}/${requests.length}] completed`);
        }
    }

    private readonly tsRegEx = /(?<=timeStamp\=)\d+/;
    private async execHttpGetApi(url: URL): Promise<httpGetApiResult> {
        let resp = await this.magirecoJsonRequst(url);
        if (resp.resultCode === "error") {
            console.error(`execHttpGetApi unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
            throw new Error(JSON.stringify(resp));
        }
        if (resp.interrupt != null) {
            let interruptStr = JSON.stringify(resp.interrupt);
            console.error(`execHttpGetApi unsuccessful interrupt=${interruptStr}`);
            throw new Error(interruptStr);
        }
        let ret: httpGetApiResult = { url: url.href, respBody: resp };
        const urlTs = url.href.match(this.tsRegEx);
        if (urlTs != null && !isNaN(Number(urlTs[0]))) {
            ret.url = ret.url.replace(this.tsRegEx, "");
            ret.ts = Number(urlTs[0]);
        }
        return ret;
    }
    private async execHttpPostApi(url: URL, postData: postData, isNative = false): Promise<httpPostApiResult> {
        let resp = await this.magirecoJsonRequst(url, postData, isNative);
        if (resp.resultCode === "error") {
            console.error(`execHttpPostApi unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
            throw new Error(JSON.stringify(resp));
        }
        let ret: httpPostApiResult
            = { url: url.href, postData: postData, respBody: resp };
        const urlTs = url.href.match(this.tsRegEx);
        if (urlTs != null && !isNaN(Number(urlTs[0]))) {
            ret.url = ret.url.replace(this.tsRegEx, "");
            ret.ts = Number(urlTs[0]);
        }
        return ret;
    }

    static newRandomID(): magirecoIDs {
        console.log("generated new random magireco IDs");
        return {
            device_id: [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
                .toString('hex').substring(0, len)).join("-"),
        }
    }
}