import * as crypto from "crypto";
import * as http2 from "http2";
import * as parameters from "./parameters";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";

export type magirecoIDs = {
    device_id: string;
}

export type openIdTicket = {
    open_id: string,
    ticket: string,
    uname?: string,
}

type postData = { obj: any }
type httpApiRequest = { url: URL, postData?: postData }
type httpGetApiResult = { url: string, ts?: number, respBody: any }
type httpPostApiResult = { url: string, ts?: number, postData: postData, respBody: any }
type httpApiResult = { url: string, ts?: number, postData?: postData, respBody: any }

type snapshotRespEntry = { ts?: number, body: any }

export type snapshot = {
    timestamp: number,
    httpResp: {
        get: Map<string, snapshotRespEntry>,
        post: Map<string, Map<string, snapshotRespEntry>>
    }
}

export const guidRegEx = /^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i;

export class userdataDmp {
    private readonly params: parameters.params;
    private localServer: localServer;
    private get magirecoIDs(): magirecoIDs { return this.params.magirecoIDs; }
    get lastSnapshot(): snapshot | undefined {
        return this._lastSnapshot;
    }
    private _lastSnapshot?: snapshot;
    get isDownloading(): boolean {
        return this._isDownloading;
    }
    private _isDownloading = false;
    get lastError(): any {
        return this._lastError;
    }
    private _lastError?: any;

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
        const date = new Date(Number(loginTime));
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
        let obj: openIdTicket | bsgamesdkPwdAuthenticate.bsgamesdkResponse | undefined = this.params.openIdTicket;
        if (obj == null) obj = this.params.bsgamesdkResponse;
        if (obj == null) throw new Error("unable to read uname, both openIdTicket and bsgamesdkResponse is null");
        const uname = obj.uname;
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
        try {
            return `magireco_cn_dump_uid_${this.uid}.json`;
        } catch (e) {
            console.error(`get userdataDumpFileName error`, e);
            return "magireco_cn_dump.json"
        }
    }
    readonly userdataDumpFileNameRegEx = /^\/magireco_cn_dump[^\/\\]*\.json$/;

    constructor(params: parameters.params, localServer: localServer) {
        this.params = params;
        this.localServer = localServer;
        this.clientSessionId = 100 + Math.floor(Math.random() * 899);
    }

    getSnapshotAsync(): Promise<snapshot> {
        return new Promise((resolve, reject) =>
            this.getSnapshotPromise()
                .then((result) => resolve(result))
                .catch((err) => {
                    this._isDownloading = false;
                    reject(this._lastError = err);
                })
        );
    }
    private async getSnapshotPromise(): Promise<snapshot> {
        if (this.isDownloading) throw new Error("previous download has not finished");
        this._isDownloading = true;
        this._lastError = undefined;

        const timestamp = new Date().getTime();
        const httpGetRespMap = new Map<string, snapshotRespEntry>(),
            httpPostRespMap = new Map<string, Map<string, snapshotRespEntry>>();

        const grow = async (seeds: Array<Promise<httpApiResult>>) => {
            const fetchResult = await Promise.allSettled(seeds);
            const succCount = fetchResult.filter((promise) => promise.status === 'fulfilled').length;
            const failCount = fetchResult.filter((promise) => promise.status !== 'fulfilled').length;
            console.log(`succCount=${succCount} failCount=${failCount}`);
            if (failCount != 0) throw new Error(`failCount != 0`);
        }
        const reap = async (
            crops: Array<Promise<httpApiResult>>,
            httpGetMap: Map<string, snapshotRespEntry>, httpPostMap: Map<string, Map<string, snapshotRespEntry>>
        ) => {
            await Promise.all(crops.map((promise) => promise.then((result) => {
                if (result.postData == null) {
                    const map = httpGetMap;
                    const key = result.url, body = result.respBody, ts = result.ts;
                    if (map.has(key)) throw new Error(`key=[${key}] already exists`);
                    let val: snapshotRespEntry = { body: body };
                    if (ts != null) val.ts = ts;
                    map.set(key, val);
                } else {
                    const map = httpPostMap;
                    const key = result.url, body = result.respBody, ts = result.ts;
                    const existingValMap = map.get(key);
                    const valMap = existingValMap != null ? existingValMap : new Map<string, snapshotRespEntry>();
                    const valMapKey = JSON.stringify(result.postData.obj);
                    if (valMap.has(valMapKey)) throw new Error(`key=[${key}] already exists`);
                    let valMapVal: snapshotRespEntry = { body: body };
                    if (ts != null) valMapVal.ts = ts;
                    valMap.set(valMapKey, valMapVal);
                    map.set(key, valMap);
                }
            })));
        }

        if (!this.isGameLoggedIn || !(await this.testLogin())) {
            console.log(`reattempt login...`);
            await this.gameLogin();
            if (!(await this.testLogin())) throw new Error("login test failed, cannot login");
        }

        const retries = 4;

        const fetchPromises1 = this.firstRoundUrlList.map((url) => this.execHttpGetApi(url, retries));
        console.log(`userdataDmp.getSnapshot() 1st round fetching...`);
        await grow(fetchPromises1);
        console.log(`userdataDmp.getSnapshot() 1st round collecting...`);
        await reap(fetchPromises1, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getSnapshot() 1st round completed`);

        const fetchPromises2 = this.getSecondRoundRequests(httpGetRespMap).map((item) =>
            item.postData != null ? this.execHttpPostApi(item.url, item.postData, retries)
                : this.execHttpGetApi(item.url, 2)
        );
        console.log(`userdataDmp.getSnapshot() 2nd round fetching...`);
        await grow(fetchPromises2);
        console.log(`userdataDmp.getSnapshot() 2nd round collecting...`);
        await reap(fetchPromises2, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getSnapshot() 2nd round completed`);

        const fetchPromises3 = this.getThirdRoundRequests(httpGetRespMap, httpPostRespMap).map((item) =>
            item.postData != null ? this.execHttpPostApi(item.url, item.postData, retries)
                : this.execHttpGetApi(item.url, 2)
        );
        console.log(`userdataDmp.getSnapshot() 3rd round fetching...`);
        await grow(fetchPromises3);
        console.log(`userdataDmp.getSnapshot() 3rd round collecting...`);
        await reap(fetchPromises3, httpGetRespMap, httpPostRespMap);
        console.log(`userdataDmp.getSnapshot() 3rd round completed`);

        this._lastSnapshot = {
            timestamp: timestamp,
            httpResp: {
                get: httpGetRespMap,
                post: httpPostRespMap,
            },
        };
        this._isDownloading = false;
        return this._lastSnapshot;
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

    private magirecoJsonRequst(url: URL, postData?: postData): Promise<NonNullable<any>> {
        return new Promise((resolve, reject) => {
            const host = url.host;
            const path = url.pathname + url.search;
            const isPOST = postData != null;
            const postDataStr = isPOST ? JSON.stringify(postData.obj) : undefined;
            const method = isPOST ? http2.constants.HTTP2_METHOD_POST : http2.constants.HTTP2_METHOD_GET;
            const reqHeaders = {
                [http2.constants.HTTP2_HEADER_METHOD]: method,
                [http2.constants.HTTP2_HEADER_PATH]: path,
                [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
                [http2.constants.HTTP2_HEADER_HOST]: host,
                ["Client-Os-Ver"]: "Android OS 6.0.1 / API-23 (V417IR/eng.duanlusheng.20220819.111943)",
                ["X-Platform-Host"]: host,
                ["Client-Model-Name"]: "MuMu",
                ["User-Agent"]: "Mozilla/5.0 (Linux; Android 6.0.1; MuMu Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 Mobile Safari/537.36",
                ["Flag"]: `${this.flag}:${this.timeStamp}`,
                ["Accept"]: "application/json, text/javascript, */*; q=0.01",
                ["X-Requested-With"]: "XMLHttpRequest",
                ["Client-Session-Id"]: `${this.clientSessionId}`,
                ["F4s-Client-Ver"]: "2.2.1",
                ["Referer"]: `https://${host}/magica/index.html`,
                ["Accept-Encoding"]: "gzip, deflate",
                ["Accept-Language"]: "zh-CN,en-US;q=0.9",
            }
            if (isPOST) reqHeaders["Content-Type"] = "application/json";
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
                this.localServer.http2RequestAsync(url, reqHeaders, postDataStr).then((result) => {
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
        return [
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
            //好友（关注）
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FollowTop?value=`
                + `userFollowList`
                + `&timeStamp=${ts}`
            ),
            //好友（粉丝）
            new URL(
                `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/follower/list/1`
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
    }
    private getSecondRoundRequests(map: Map<string, snapshotRespEntry>): Array<httpApiRequest> {
        const requests: Array<httpApiRequest> = [];

        const getPageCount = (total: number, perPage: number) => {
            let remainder = total % perPage;
            let floored = total - remainder;
            let pageCount = floored / perPage;
            if (remainder > 0) pageCount += 1;
            return pageCount;
        }

        const topPage = map.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
            + `user`
            + `%2CgameUser`
            + `%2CitemList`
            + `%2CgiftList`
            + `%2CpieceList`
            + `%2CuserQuestAdventureList`
            + `&timeStamp=`
        )?.body;
        const myPage = map.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MyPage?value=`
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
        )?.body;

        //左上角个人头像
        const userLive2dList = myPage["userLive2dList"];
        if (userLive2dList == null || !Array.isArray(userLive2dList)) throw new Error("unable to read userLive2dList");
        const charaIds = userLive2dList.map((item) => {
            let charaId = item["charaId"];
            if (typeof charaId !== 'number' || isNaN(charaId)) throw new Error("invalid charaId");
            return charaId;
        });
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
        //助战选择
        //看上去来自这里：https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/json/friend_search/_search.json?72e447c0eff8c6a7
        const fakeFriends = [
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
        requests.push({
            url: new URL(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SupportSelect`),
            postData: {
                obj: {
                    strUserIds: fakeFriends.join(","),
                    strNpcHelpIds: "102",//214水波的NPC桃子
                }
            }
        });
        //扭蛋获得履历（仅GUID）
        const gachasPerPage = 50;
        const gachaHistory = map.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
            + `&timeStamp=`
        )?.body;
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
        const presentList = map.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentList?value=`
            + `&timeStamp=`
        )?.body;
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
        const presentHistory = map.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory?value=`
            + `&timeStamp=`
        )?.body;
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
        httpGetMap: Map<string, snapshotRespEntry>,
        httpPostMap: Map<string, Map<string, snapshotRespEntry>>
    ): Array<httpApiRequest> {
        //扭蛋获得履历
        const gachaHistoryPages: Array<{ gachaHistoryList: Array<{ id: string }> }> = [];
        const gachaIds: Array<string> = [];

        const gachaHistoryFirstPage = httpGetMap.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
            + `&timeStamp=`
        )?.body;
        gachaHistoryPages.push(gachaHistoryFirstPage);

        const gachaHistoryMap = httpPostMap.get(`https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory`);
        gachaHistoryMap?.forEach((resp) => gachaHistoryPages.push(resp.body));
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

        return requests;
    }

    private readonly tsRegEx = /(?<=timeStamp\=)\d+/;
    private async execHttpGetApi(url: URL, retries = 0, retryAfterSec = 4): Promise<httpGetApiResult> {
        const retryAfter = Math.trunc((retryAfterSec + Math.random() * 2) * 1000);
        let lastError: any = new Error("execHttpGetApi max retries exceeded");
        for (let i = 0, resp; i <= retries && resp == null; i++) {
            try {
                resp = await this.magirecoJsonRequst(url);
                if (resp.resultCode === "error") {
                    console.error(`execHttpGetApi unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
                    throw new Error(JSON.stringify(resp));
                }
                let ret: httpGetApiResult = { url: url.href, respBody: resp };
                const urlTs = url.href.match(this.tsRegEx);
                if (urlTs != null && !isNaN(Number(urlTs[0]))) {
                    ret.url = ret.url.replace(this.tsRegEx, "");
                    ret.ts = Number(urlTs[0]);
                }
                return ret;
            } catch (e) {
                lastError = e;
                console.error(`execHttpGetApi error`, e, `will retry after ${retryAfter}ms...`);
                await new Promise<void>((resolve) => setTimeout(() => resolve(), retryAfter));
            }
        }
        throw lastError;
    }
    private async execHttpPostApi(url: URL, postData: postData, retries = 0, retryAfterSec = 4
    ): Promise<httpPostApiResult> {
        const retryAfter = Math.trunc((retryAfterSec + Math.random() * 2) * 1000);
        let lastError: any = new Error("execHttpPostApi max retries exceeded");
        for (let i = 0, resp; i <= retries && resp == null; i++) {
            try {
                resp = await this.magirecoJsonRequst(url, postData);
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
            } catch (e) {
                lastError = e;
                console.error(`execHttpPostApi error`, e, `will retry after ${retryAfter}ms...`);
                await new Promise<void>((resolve) => setTimeout(() => resolve(), retryAfter));
            }
        }
        throw lastError;
    }

    static newRandomID(): magirecoIDs {
        console.log("generated new random magireco IDs");
        return {
            device_id: [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
                .toString('hex').substring(0, len)).join("-"),
        }
    }
}