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

export type snapshot = {
    timestamp: number, httpResp: {
        get: Map<string, any>,
        post: Map<string, Map<string, any>>
    }
}

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
        const httpGetRespMap = new Map<string, any>(), httpPostRespMap = new Map<string, Map<string, any>>();

        const grow = async (seeds: Array<Promise<{ url: string, respBody: any }>>) => {
            const fetchResult = await Promise.allSettled(seeds);
            const succCount = fetchResult.filter((promise) => promise.status === 'fulfilled').length;
            const failCount = fetchResult.filter((promise) => promise.status !== 'fulfilled').length;
            console.log(`succCount=${succCount} failCount=${failCount}`);
            if (failCount != 0) throw new Error(`failCount != 0`);
        }
        const reap = async (
            crops: Array<Promise<{ url: string, postData?: { obj: any }, respBody: any }>>,
            httpGetMap: Map<string, any>, httpPostMap: Map<string, Map<string, any>>
        ) => {
            await Promise.all(crops.map((promise) => promise.then((result) => {
                if (result.postData == null) {
                    const map = httpGetMap;
                    const key = result.url, val = result.respBody;
                    if (map.has(key)) throw new Error(`key=[${key}] already exists`);
                    map.set(key, val);
                } else {
                    const map = httpPostMap;
                    const key = result.url, valMapVal = result.respBody;
                    const existingValMap = map.get(key);
                    const valMap = existingValMap != null ? existingValMap : new Map<string, any>();
                    const valMapKey = JSON.stringify(result.postData.obj);
                    if (valMap.has(valMapKey)) throw new Error(`key=[${key}] already exists`);
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

        //TODO 获得履历翻页、左上角个人头像、好友等等

        this._lastSnapshot = {
            timestamp: timestamp,
            httpResp: {
                get: httpGetRespMap,
                post: httpPostRespMap,
            }
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

    private magirecoJsonRequst(url: URL, postData?: { obj: any }): Promise<NonNullable<any>> {
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
            //礼物奖励箱
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

    private async execHttpGetApi(url: URL, retries = 0, retryAfterSec = 4): Promise<{ url: string, respBody: any }> {
        const retryAfter = Math.trunc((retryAfterSec + Math.random() * 2) * 1000);
        let lastError: any = new Error("execHttpGetApi max retries exceeded");
        for (let i = 0, resp; i <= retries && resp == null; i++) {
            try {
                resp = await this.magirecoJsonRequst(url);
                if (resp.resultCode === "error") {
                    console.error(`execHttpGetApi unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
                    throw new Error(JSON.stringify(resp));
                }
                return { url: url.href, respBody: resp };
            } catch (e) {
                lastError = e;
                console.error(`execHttpGetApi error`, e, `will retry after ${retryAfter}ms...`);
                await new Promise<void>((resolve) => setTimeout(() => resolve(), retryAfter));
            }
        }
        throw lastError;
    }
    private async execHttpPostApi(url: URL, postData: { obj: any }, retries = 0, retryAfterSec = 4
    ): Promise<{ url: string, postData: { obj: any }, respBody: any }> {
        const retryAfter = Math.trunc((retryAfterSec + Math.random() * 2) * 1000);
        let lastError: any = new Error("execHttpPostApi max retries exceeded");
        for (let i = 0, resp; i <= retries && resp == null; i++) {
            try {
                resp = await this.magirecoJsonRequst(url, postData);
                if (resp.resultCode === "error") {
                    console.error(`execHttpPostApi unsuccessful resultCode=${resp.resultCode} errorTxt=${resp.errorTxt}`);
                    throw new Error(JSON.stringify(resp));
                }
                return { url: url.href, postData: postData, respBody: resp };
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