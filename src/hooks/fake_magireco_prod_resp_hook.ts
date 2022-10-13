import * as http from "http";
import * as http2 from "http2";
import * as crypto from "crypto";
import { fakeResponse, hook, localServer, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
import * as userdataDump from "../userdata_dump";
import { bsgamesdkPwdAuth } from "../bsgamesdk-pwd-authenticate";
import { missingData } from "./etc/missing_data";
import { getRandomHex } from "../get_random_bytes";

export class fakeMagirecoProdRespHook implements hook {
    private readonly params: parameters.params;
    private readonly crawler: staticResCrawler.crawler;
    private readonly userdataDmp: userdataDump.userdataDmp;

    private readonly magirecoProdUrlRegEx: RegExp;
    private readonly magirecoPatchUrlRegEx: RegExp;
    private readonly apiPathNameRegEx: RegExp;
    private readonly slashGuidEndRegEx: RegExp;

    private readonly bsgameSdkLoginRegEx: RegExp;
    private readonly bsgameSdkCipherRegEx: RegExp;
    private readonly bsgameSdkOtpSendRegEx: RegExp;

    private readonly bilibiliGameAgreementRegEx: RegExp;

    private readonly part2Section3RegEx: RegExp;

    private readonly arenaSimulateMap: Map<string, string>;

    get stringifiedOverrideDB(): string {
        return JSON.stringify(this.params.overridesDB, parameters.replacer);
    }

    private missingData?: missingData;

    private get overrides(): parameters.overrides | undefined {
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return;
        const uid = lastDump.uid;
        if (typeof uid !== 'number' || isNaN(uid)) return;
        let overrides = this.params.overridesDB.get(uid);
        if (overrides == null) {
            overrides = {};
            this.params.overridesDB.set(uid, overrides);
        }
        return overrides;
    }

    getOverrideValue(key: string): any {
        return key.split(".").reduce((prev, curr) => {
            if (prev == null) return;
            if (!(curr in prev)) return;
            return prev[curr];
        }, this.overrides as any);
    }
    setOverrideValue(key: string, val: string | number | Map<number, Map<string, string | number>> | undefined): void {
        console.log(`setOverrideValue ... key=[${key}] val`, val);
        const keysPop = key.split(".");
        const lastKey = keysPop.pop();
        if (lastKey == null) return;
        const obj = keysPop.reduce((prev, curr) => {
            if (prev == null) return;
            if (prev[curr] == null) prev[curr] = {};
            return prev[curr];
        }, this.overrides as any);
        if (obj == null) return;
        if (val == null) delete obj[lastKey];
        else obj[lastKey] = val;
        console.log(`setOverrideValue done key=[${key}] val`, val);
        this.params.saveOverrideDB();
    }
    get bgItemId(): string | undefined { return this.getOverrideValue("gameUser.bgItemId"); }
    set bgItemId(val: string | undefined) { this.setOverrideValue("gameUser.bgItemId", val); }
    get leaderId(): string | undefined { return this.getOverrideValue("gameUser.leaderId"); }
    set leaderId(val: string | undefined) { this.setOverrideValue("gameUser.leaderId", val); }

    constructor(params: parameters.params, crawler: staticResCrawler.crawler, dmp: userdataDump.userdataDmp) {
        this.params = params;
        this.crawler = crawler;
        this.userdataDmp = dmp;

        this.magirecoProdUrlRegEx = /^(http|https):\/\/l\d+-prod-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/(|maintenance\/)magica\/.+$/;
        this.magirecoPatchUrlRegEx = /^(http|https):\/\/line\d+-prod-patch-mfsn\d*\.bilibiligame\.net\/magica\/.+$/;
        this.apiPathNameRegEx = /^\/magica\/api\/.+$/;
        this.slashGuidEndRegEx = /\/[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/;

        this.bsgameSdkLoginRegEx = /^(http|https):\/\/line\d+-sdk-center-login-sh\.biligame\.net\/api\/external\/(login|login\/otp|user\.token\.oauth\.login)\/v3((|\?.*)$)/;
        this.bsgameSdkCipherRegEx = /^(http|https):\/\/line\d+-sdk-center-login-sh\.biligame\.net\/api\/external\/issue\/cipher\/v3((|\?.*)$)/;
        this.bsgameSdkOtpSendRegEx = /^(http|https):\/\/line\d+-sdk-center-login-sh\.biligame\.net\/api\/external\/otp\/send\/v3((|\?.*)$)/;

        this.bilibiliGameAgreementRegEx = /^(http|https):\/\/game\.bilibili\.com\/agreement\/(userterms|privacy)\/.+$/;

        this.part2Section3RegEx = /^\/magica\/resource\/download\/asset\/master\/resource\/2207081501\/asset_section_10230(1|2|3)\.json$/;

        this.arenaSimulateMap = new Map<string, string>();
    }

    // if matched, keep a copy of request/response data in memory
    matchRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ): fakeResponse | passOnRequest {
        const mode = this.params.mode;
        if (mode !== parameters.mode.LOCAL_OFFLINE) return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }

        const isMagiRecoProd = url?.href.match(this.magirecoProdUrlRegEx) != null;
        const isMagiRecoPatch = url?.href.match(this.magirecoPatchUrlRegEx) != null;
        const isBsgamesdkLogin = url?.href.match(this.bsgameSdkLoginRegEx) != null;
        const isBsgamesdkCipher = url?.href.match(this.bsgameSdkCipherRegEx) != null;
        const isBsgamesdkOtpSend = url?.href.match(this.bsgameSdkOtpSendRegEx) != null;
        const isBilibiliGameAgreement = url?.href.match(this.bilibiliGameAgreementRegEx) != null;

        if (
            !isMagiRecoProd && !isMagiRecoPatch
            && !isBsgamesdkLogin && !isBsgamesdkCipher && !isBsgamesdkOtpSend
            && !isBilibiliGameAgreement
        ) return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }

        if (isBsgamesdkCipher || isBsgamesdkOtpSend || isBsgamesdkLogin) {
            let contentType = 'application/json;charset=UTF-8';
            let respBody: Buffer | undefined;
            if (isBsgamesdkCipher) {
                console.log(`attempt to fake bsgamesdk cipher response`);
                respBody = this.fakeBsgamesdkCipherResp();
            } else if (isBsgamesdkOtpSend) {
                console.log(`attempt to fake bsgamesdk otp response`);
                respBody = this.fakeBsgamesdkOtpSendResp();
            } else if (isBsgamesdkLogin) {
                console.log(`attempt to fake bsgamesdk login response`);
                respBody = this.fakeBsgamesdkLoginResp();
            }
            if (respBody == null) console.log(`failed to fake bsgamesdk login response`);
            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            };
            if (respBody != null) {
                return {
                    nextAction: "fakeResponse",
                    fakeResponse: {
                        statusCode: 200,
                        statusMessage: "OK",
                        headers: headers,
                        body: respBody,
                    },
                    interceptResponse: false,
                }
            }
        }

        if (isBilibiliGameAgreement) {
            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "text/html; charset=utf-8",
            };
            const html = `<!doctype html><html><head><meta charset=\"UTF-8\"><script>`
                + `document.addEventListener(\"WebViewJavascriptBridgeReady\",function(){`
                + `var obj={status:1,type:1,event:1};`
                + `[obj,JSON.stringify(obj)].forEach(o=>{try{window.bridge.callHandler("finishWithJson",o,function(){});}catch(e){}});`
                + `});`
                + `</script></head></html>`;
            const respBody = Buffer.from(html, 'utf-8');
            return {
                nextAction: "fakeResponse",
                fakeResponse: {
                    statusCode: 200,
                    statusMessage: "OK",
                    headers: headers,
                    body: respBody,
                },
                interceptResponse: false,
            }
        }

        const isApi = url.pathname.match(this.apiPathNameRegEx) != null;
        let apiUnimplemented = false;
        if (isApi) {
            let statusCode = 200;
            let contentType = `application/json;charset=UTF-8`;
            let body: Buffer | undefined;

            const apiName = url.pathname.replace(/^\/magica\/api\//, "")
                .replace(this.slashGuidEndRegEx, "");
            switch (apiName) {
                // (can be) HTTP POST
                case "test/logger/error":
                case "gameUser/setBackground":
                case "page/PresentHistory":
                case "page/GachaHistory":
                case "gameUser/changeLeader":
                case "userChara/visualize":
                case "userLive2d/set":
                case "arena/start":
                case "quest/native/get":
                case "quest/native/result/send":
                case "page/ArenaResult":
                case "page/CharaEnhancementTree":
                    {
                        return {
                            nextAction: "passOnRequest",
                            interceptResponse: true,
                        }
                    }
                // empty ones
                case "page/ResumeBackground":
                case "page/BackgroundSet":
                case "page/CharaListCompose":
                case "page/CharaListComposeMagia":
                case "page/CharaListCustomize":
                case "page/CharaListEquip":
                case "page/QuestBattleSelect":
                case "page/QuestBackground":
                case "page/MainQuestSingleRaid":
                case "page/MainQuestBranch":
                case "page/MemoriaEquip":
                case "page/MemoriaList":
                case "page/MemoriaSetList":
                case "page/MagiRepoDetail":
                    {
                        body = this.fakeEmptyResp(apiName);
                        break;
                    }
                // simple fake responses
                case "announcements/red/obvious":
                case "event_banner/list/1":
                    {
                        body = Buffer.from(JSON.stringify(this.fakeResp[apiName]), 'utf-8');
                        break;
                    }
                // special ones
                case "system/game/login":
                    {
                        body = this.fakeSystemLogin();
                        if (body != null) console.log(`faked system login`);
                        else console.error(`failed to fake system login`);
                        break;
                    }
                case "page/MyPage":
                    {
                        body = this.fakeMyPage(apiName);
                        break;
                    }
                case "gacha/result":
                case "friend/user":
                    {
                        body = this.fakeGuidResult(apiName, url.pathname);
                        break;
                    }
                case "page/MagiRepo":
                    {
                        body = this.fakeMagiRepo(apiName);
                        break;
                    }
                // remaining ones
                case "page/TopPage":
                case "page/CharaListTop":
                case "page/MemoriaTop":
                case "page/PieceArchive":
                case "page/GachaTop":
                case "page/MissionTop":
                case "page/PanelMissionTop":
                case "page/ShopTop":
                case "page/PresentList":
                case "page/CollectionTop":
                case "page/CharaCollection":
                case "page/PieceCollection":
                case "page/StoryCollection":
                case "page/DoppelCollection":
                case "page/EnemyCollection":
                case "page/ItemListTop":
                case "page/SearchQuest":
                case "page/FollowTop":
                case "friend/follower/list/1":
                case "page/ProfileFormationSupport":
                case "page/ConfigTop":
                case "page/FormationTop":
                case "page/DeckFormation":
                case "page/MemoriaSetEquip":
                case "page/ArenaTop":
                case "page/ArenaFreeRank":
                case "page/ArenaSimulate":
                case "page/ArenaHistory":
                case "page/EventArenaRankingHistory":
                case "page/ArenaReward":
                case "page/MainQuest":
                case "page/SubQuest":
                case "page/CharaQuest":
                case "page/EventQuest":
                    {
                        const lastDump = this.userdataDmp.lastDump;
                        if (lastDump != null) {
                            let respBodyObj = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys[apiName]);
                            if (respBodyObj != null) {
                                if (apiName === "page/MainQuest") {
                                    respBodyObj = this.patchMainQuest(apiName, respBodyObj);
                                }
                                if (apiName === "page/CharaListTop") {
                                    respBodyObj = this.patchCharaListTop(apiName, respBodyObj);
                                }
                                body = Buffer.from(JSON.stringify(respBodyObj), 'utf-8');
                            }
                        }
                        break;
                    }
                default:
                    {
                        body = Buffer.from(this.fakeErrorResp("错误", "API尚未实现", false), 'utf-8');
                        apiUnimplemented = true;
                    }
            }

            if (body == null || apiUnimplemented) {
                console.error(`matchRequest responding with fakeErrorResp [${url.pathname}]`);
                if (!apiUnimplemented) body = Buffer.from(this.fakeErrorResp(), 'utf-8');
            }

            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            }
            return {
                nextAction: "fakeResponse",
                fakeResponse: {
                    statusCode: statusCode,
                    statusMessage: "OK",
                    headers: headers,
                    body: body,
                },
                interceptResponse: false,
            }
        } else {
            let statusCode: number;
            let contentType = this.crawler.getContentType(url.pathname);
            let contentEncoding: string | undefined;
            let body: Buffer | undefined;
            try {
                body = this.crawler.readFile(url.pathname);
                if (body == null) {
                    if (url.pathname.match(this.part2Section3RegEx) != null) {
                        // not a workaround: response from offical server was like this
                        body = Buffer.from(JSON.stringify([]), 'utf-8');
                    }
                }
            } catch (e) {
                console.error(`error serving[${url.pathname}]`, e);
                body = undefined;
            }
            if (body != null) {
                if (url.pathname in this.staticModList) {
                    const bodyStr = body.toString("utf-8");
                    const mod = this.staticModList[url.pathname];
                    if (bodyStr.match(mod.matchPattern)) {
                        body = Buffer.from(bodyStr.replace(mod.replacePattern, mod.replacement), 'utf-8');
                    }
                }
            }
            if (body == null && url.pathname.endsWith(".gz")) {
                try {
                    let uncompressed = this.crawler.readFile(url.pathname.replace(/\.gz$/, ""));
                    if (uncompressed != null) {
                        contentType = this.crawler.getContentType(url.pathname);
                        body = localServer.compress(uncompressed, "gzip");
                        contentEncoding = "gzip";
                    }
                } catch (e) {
                    console.error(`error retrying generating gz`, e);
                    body = undefined;
                }
            }
            if (body == null) {
                // imitated xml response but it still doesn't trigger error dialog (which then leads to toppage) as expected
                statusCode = 404;
                contentType = "application/xml";
                body = Buffer.from(this.get404xml(url.hostname, url.pathname), 'utf-8');
                if (!this.crawler.isKnown404(url.pathname)) console.error(`responding 404 [${url.pathname}]`);
            } else {
                statusCode = 200;
            }
            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            }
            if (contentEncoding != null) {
                headers[http2.constants.HTTP2_HEADER_CONTENT_ENCODING] = contentEncoding;
            }
            if (parameters.params.VERBOSE) console.log(`serving static ${url.pathname}${url.search}(ignored query part)`);
            return {
                nextAction: "fakeResponse",
                fakeResponse: {
                    statusCode: statusCode,
                    statusMessage: "OK",
                    headers: headers,
                    body: body,
                },
                interceptResponse: false,
            }
        }

        /*
        return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }
        */
    }

    onMatchedRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
        reqBody?: string | Buffer
    ): fakeResponse | passOnRequestBody {
        const mode = this.params.mode;
        if (mode !== parameters.mode.LOCAL_OFFLINE) return {
            nextAction: "passOnRequestBody",
            interceptResponse: false,
        }

        const isMagiRecoProd = url?.href.match(this.magirecoProdUrlRegEx) != null;
        const isMagiRecoPatch = url?.href.match(this.magirecoPatchUrlRegEx) != null;
        if (!isMagiRecoProd && !isMagiRecoPatch) return {
            nextAction: "passOnRequestBody",
            interceptResponse: false,
        }

        const isApi = url.pathname.match(this.apiPathNameRegEx) != null;
        let apiUnimplemented = false;
        if (isApi) {
            let statusCode = 200;
            let contentType = `application/json;charset=UTF-8`;
            let respBody: Buffer | undefined;

            const apiName = url.pathname.replace(/^\/magica\/api\//, "")
                .replace(this.slashGuidEndRegEx, "");
            switch (apiName) {
                case "test/logger/error":
                    {
                        console.error(`onMatchedRequest ${apiName} reqBody=[${reqBody}]`);
                        respBody = Buffer.from(JSON.stringify({ resultCode: "success" }));
                        break;
                    }
                case "gameUser/setBackground":
                case "gameUser/changeLeader":
                    {
                        respBody = this.modifyGameUser(apiName, reqBody);
                        break;
                    }
                case "userChara/visualize":
                case "userLive2d/set":
                    {
                        respBody = this.modifyGameChara(apiName, reqBody);
                        break;
                    }

                case "page/CharaEnhancementTree":
                case "page/PresentHistory":
                case "page/GachaHistory":
                    {
                        let type: "page" | "charaId" = apiName === "page/CharaEnhancementTree" ? "charaId" : "page";
                        respBody = this.fakePagedResult(apiName, reqBody, type);
                        break;
                    }
                case "arena/start":
                case "quest/native/get":
                case "quest/native/result/send":
                case "page/ArenaResult":
                    {
                        respBody = this.fakeArenaResp(apiName, reqBody);
                        break;
                    }
                default:
                    {
                        respBody = Buffer.from(this.fakeErrorResp("错误", "API尚未实现", false), 'utf-8');
                        apiUnimplemented = true;
                    }
            }

            if (respBody == null || apiUnimplemented) {
                if (typeof reqBody === 'string') {
                    console.error(`onMatchedRequest [${apiName}] error reqBody=[${reqBody}]`);
                }
                console.error(`onMatchedRequest responding with fakeErrorResp [${url.pathname}]`);
                if (!apiUnimplemented) respBody = Buffer.from(this.fakeErrorResp(), 'utf-8');
            }

            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            }
            return {
                nextAction: "fakeResponse",
                fakeResponse: {
                    statusCode: statusCode,
                    statusMessage: "OK",
                    headers: headers,
                    body: respBody,
                },
                interceptResponse: false,
            }
        } else {
            return {
                nextAction: "passOnRequestBody",
                interceptResponse: false,
            }
        }
    }

    onMatchedResponse(
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: string | Buffer
    ): void {
    }

    private fakeBsgamesdkCipherResp(): Buffer {
        const obj = {
            requestId: `${getRandomHex(32)}`,
            timestamp: `${new Date().getTime()}`,
            code: 0,
            hash: `${getRandomHex(16)}`, // fake one
            cipher_key: "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDjb4V7EidX/ym28t2ybo0U6t0n\n6p4ej8VjqKHg100va6jkNbNTrLQqMCQCAYtXMXXp2Fwkk6WR+12N9zknLjf+C9sx\n/+l48mjUU8RqahiFD1XT/u2e0m2EN029OhCgkHx3Fc/KlFSIbak93EH/XlYis0w+\nXl69GV6klzgxW6d2xQIDAQAB\n-----END PUBLIC KEY-----",
            server_message: "",
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }
    private fakeBsgamesdkOtpSendResp(): Buffer {
        const obj = {
            requestId: `${getRandomHex(32)}`,
            timestamp: `${new Date().getTime()}`,
            code: 0,
            captcha_key: `${getRandomHex(32)}`,
            verify_tkt: null,
            verify_tkt_type: null,
            server_message: "",
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }
    private fakeBsgamesdkLoginResp(): Buffer | undefined {
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return;

        const uid = lastDump.uid;
        if (typeof uid !== 'number' || isNaN(uid)) return;

        const topPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/TopPage"]);
        if (topPage == null) return;

        const user = topPage["user"];
        if (user == null) return;
        const loginName = user["loginName"];

        const requestId = getRandomHex(32);
        const tsStr = `${new Date().getTime()}`;
        const expires = Number(tsStr) + 30 * 24 * 60 * 60 * 1000;
        const h5_paid_download = 1;
        const h5_paid_download_sign = bsgamesdkPwdAuth.getPostDataSign(`requestId=${requestId}&uid=${uid}&timestamp=${tsStr}`
            + `&h5_paid_download=${h5_paid_download}`);
        const obj = {
            requestId: `${requestId}`,
            timestamp: `${tsStr}`,
            auth_name: `离线登录用户`,
            realname_verified: 1,
            remind_status: 0,
            h5_paid_download: h5_paid_download,
            h5_paid_download_sign: `${h5_paid_download_sign}`,
            code: 0,
            access_key: `${getRandomHex(32)}_sh`,
            expires: expires,
            uid: uid,
            face: "http://static.hdslb.com/images/member/noface.gif",
            s_face: "http://static.hdslb.com/images/member/noface.gif",
            uname: `${loginName}`,
            server_message: "",
            isCache: "true",
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }

    private fakeSystemLogin(): Buffer | undefined {
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return;

        const topPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/TopPage"]);
        if (topPage == null) return;

        const loginName = topPage["loginName"];

        const obj = {
            data: {
                open_id: `${this.getRandomGuid()}`,
                uname: `${loginName}`,
                code: 0,
                timestamp: new Date().getTime(),
            },
            resultCode: "success"
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }

    private fakeEmptyResp(apiName: string): Buffer | undefined {
        console.log(`fakeEmptyResp for apiName=[${apiName}]`);

        const obj = {
            currentTime: this.getDateTimeString(),
            resourceUpdated: false,
            eventList: [],
            regularEventList: [],
            functionMaintenanceList: [],
            campaignList: [],
            forceClearCache: false,
        };
        return Buffer.from(JSON.stringify(obj));
    }
    private getDateTimeString(): string {
        const d = new Date();
        let year = String(d.getFullYear());
        let monthDate = [
            String(d.getMonth() + 1),
            String(d.getDate()),
        ];
        let time = [
            String(d.getHours()),
            String(d.getMinutes()),
            String(d.getSeconds()),
        ];
        [monthDate, time].forEach((array) => {
            array.forEach((str, index) => {
                if (str.length < 2) str = Array.from({ length: 2 - str.length }, () => "0").join("") + str;
                array[index] = str;
            });
        });
        return `${year}/${monthDate.join("/")} ${time.join(":")}`;
    }

    private fakeMyPage(apiName: string): Buffer | undefined {
        if (apiName !== "page/MyPage") {
            console.error(`fakeMyPage invalid apiName=[${apiName}]`);
            return;
        }

        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');
        let respBodyObj = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys[apiName]);
        if (respBodyObj == null) return Buffer.from(this.fakeErrorResp("错误", "读取个人账号数据出错"), 'utf-8');

        // make a replica to avoid changing original
        let replica = JSON.parse(JSON.stringify(respBodyObj));
        // copy "missing" parts from other page to populate common.storage,
        // so that StoryCollection etc won't crash
        for (let pageKey in this.myPagePatchList) {
            let page = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys[pageKey]);
            if (page == null) {
                console.error(`[${pageKey}] is missing, cannot copy data from it to [${apiName}]`);
                continue;
            }
            this.myPagePatchList[pageKey].forEach((key) => {
                replica[key] = page[key];
                if (replica[key] == null) {
                    switch (key) {
                        default: {
                            console.error(`cannot copy [${key}] from [${pageKey}] to [${apiName}]`);
                        }
                    }
                }
            });
        }
        const replicaGameUser = replica?.gameUser;
        const userId = replicaGameUser?.userId;
        if (typeof userId === 'string') {
            if (this.missingData?.userId !== userId) this.missingData = new missingData(userId);
            this.checkForMissing(replica.userChapterList, this.missingData.userChapterList, "chapterId");
            this.checkForMissing(replica.userSectionList, this.missingData.userSectionList, "sectionId");
            this.checkForMissing(replica.userQuestBattleList, this.missingData.userQuestBattleList, "questBattleId");
            this.checkForMissing(replica.userQuestAdventureList, this.missingData.userQuestAdventureList, "adventureId");
        }
        // overrides
        const userItemList = replica.userItemList;
        if (
            userItemList != null && Array.isArray(userItemList)
            && replicaGameUser != null
        ) {
            // setBackground
            const newBgItemId = this.bgItemId;
            if (newBgItemId != null && typeof newBgItemId === "string") {
                const foundBgItem = userItemList.find((itemInfo) => itemInfo?.itemId === newBgItemId)?.item;
                if (foundBgItem != null) {
                    replicaGameUser.bgItemId = newBgItemId;
                    if (replicaGameUser.bgItem == null) replicaGameUser.bgItem = {};
                    Object.keys(foundBgItem).forEach((key) => replicaGameUser.bgItem[key] = foundBgItem[key]);
                }
            }
            // changeLeader
            const newLeaderId = this.leaderId;
            if (newLeaderId != null && typeof newLeaderId === "string") {
                replicaGameUser.leaderId = newLeaderId;
            }
            // userChara/visualize, userLive2d/set
            const userCharaList = replica["userCharaList"];
            const userCardList = replica["userCardList"];
            const charaModMap: Map<number, Map<string, string | number>> = this.getOverrideValue(`userCharaList`);
            if (
                userCharaList != null && Array.isArray(userCharaList)
                && userCardList != null && Array.isArray(userCardList)
                && charaModMap != null && charaModMap instanceof Map
            ) {
                charaModMap.forEach((map, charaId) => {
                    map.forEach((val, key) => {
                        this.getModifiedGameChara(userCharaList, userCardList, charaId, key, val);
                    });
                });
            }
        }
        // convert to buffer
        return Buffer.from(JSON.stringify(replica), 'utf-8');
    }

    private modifyGameUser(apiName: string, reqBody: string | Buffer | undefined): Buffer | undefined {
        if (typeof reqBody !== 'string') return;

        const changeLeader = "gameUser/changeLeader";
        const gameUserKeys: Record<string, [string, string]> = {
            ["gameUser/setBackground"]: [`itemId`, `bgItemId`],
            [changeLeader]: [`userCardId`, `leaderId`],
        }
        if (!(apiName in gameUserKeys)) {
            console.error(`modifyGameUser invalid apiName=[${apiName}]`);
            return;
        }
        const reqKey = gameUserKeys[apiName][0]
        const gameUserKey = gameUserKeys[apiName][1];

        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');

        try {
            const parsed = JSON.parse(reqBody);
            const setToVal = parsed[reqKey];
            if (typeof setToVal === 'string' && setToVal !== "") {
                this.setOverrideValue(`gameUser.${gameUserKey}`, setToVal);
            }
            const myPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/MyPage"]);
            const gameUser = myPage["gameUser"];
            if (gameUser == null || typeof gameUser !== 'object') throw new Error("unable to read gameUser from MyPage");
            const gameUserMod = JSON.parse(JSON.stringify(gameUser));
            gameUserMod[gameUserKey] = setToVal;
            return Buffer.from(JSON.stringify({
                resultCode: "success",
                gameUser: gameUserMod,
            }), 'utf-8');
        } catch (e) {
            console.error(`modifyGameUser error parsing reqBody=${reqBody}`, e);
        }
    }

    private getModifiedGameChara(
        userCharaList: Array<Record<string, any>>,
        userCardList: Array<Record<string, any>>,
        charaId: number, key: string, val: string | number
    ): Record<string, any> | undefined {
        try {
            if (typeof charaId !== 'number' || isNaN(charaId)) return;
            const indexInUserCharaList = userCharaList.findIndex((c) => c?.charaId === charaId);
            if (indexInUserCharaList < 0) return;
            const unmodifiedChara = userCharaList[indexInUserCharaList];
            const indexInUserCardList = userCardList.findIndex((c) => c?.card?.charaNo === charaId);
            if (indexInUserCardList < 0) return;
            const unmodifiedCard = userCardList[indexInUserCardList];

            const modifiedChara = JSON.parse(JSON.stringify(unmodifiedChara));
            const modifiedCard = JSON.parse(JSON.stringify(unmodifiedCard));

            switch (key) {
                case "commandVisualType":
                case "commandVisualId":
                case "displayCardId":
                case "live2dId":
                    {
                        if ((typeof val === 'string' && val !== '') || (typeof val === 'number' && !isNaN(Number(val)))) {
                            modifiedChara[key] = val;
                            modifiedCard[key] = val;
                        }
                        break;
                    }
                default: {
                    console.error(`getModifiedGameChara invalid key=[${key}]`);
                }
            }
            userCharaList[indexInUserCharaList] = modifiedChara;
            userCardList[indexInUserCardList] = modifiedCard;
            return modifiedChara;
        } catch (e) {
            console.error(`getModifiedGameChara error charaId=[${charaId}] key=[${key}] val=[${val}]`, e);
        }
    }
    private modifyGameChara(apiName: string, reqBody: string | Buffer | undefined): Buffer | undefined {
        if (typeof reqBody !== 'string') return;
        if (apiName !== "userChara/visualize" && apiName !== "userLive2d/set") {
            console.error(`modifyGameChara invalid apiName=[${apiName}]`);
            return;
        }
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');

        const myPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/MyPage"]);
        const userCharaList = myPage["userCharaList"];
        const userCardList = myPage["userCardList"];
        if (
            userCharaList == null || !Array.isArray(userCharaList)
            && userCardList == null || !Array.isArray(userCardList)
        ) {
            return Buffer.from(this.fakeErrorResp("错误", "读取角色列表时出错"), 'utf-8');
        }

        let charaModMap: Map<number, Map<string, string | number>> = this.getOverrideValue(`userCharaList`);
        if (charaModMap == null || !(charaModMap instanceof Map)) {
            charaModMap = new Map<number, Map<string, string | number>>();
        }
        let charaId: number | undefined;
        const tempMap = new Map<string, string | number>();

        let parsedReqBody: Record<string, string | number> | undefined;
        try {
            parsedReqBody = JSON.parse(reqBody);
            if (parsedReqBody == null) throw new Error("parsedReqBody == null");
            if (typeof parsedReqBody !== 'object') throw new Error("parsedReqBody is not object");
            for (let key in parsedReqBody) {
                let val = parsedReqBody[key];
                switch (key) {
                    case "commandVisualType":
                    case "live2dId":
                        {
                            if (typeof val !== 'string' || val === "") continue;
                            break;
                        }
                    case "charaId":
                    case "commandVisualId":
                    case "displayCardId":
                        {
                            if (typeof val !== 'number' || isNaN(val)) continue;
                            if (key === "charaId") {
                                charaId = val;
                                continue;
                            }
                            break;
                        }
                    default:
                        {
                            continue;
                        }
                }
                tempMap.set(key, val);
            }
            if (charaId == null) throw new Error("cannot read charaId");
            const actualMap = charaModMap.get(charaId);
            if (actualMap == null) {
                charaModMap.set(charaId, tempMap);
            } else {
                tempMap.forEach((val, key) => actualMap.set(key, val));
            }
        } catch (e) {
            console.error(`modifyGameChara error parsing reqBody`, e);
            parsedReqBody = undefined;
        }

        let modifiedCharaArray: Array<Record<string, string | number>> | undefined;
        if (
            userCharaList != null && Array.isArray(userCharaList)
            && userCardList != null && Array.isArray(userCardList)
        ) {
            charaModMap.forEach((map, charaId) => {
                map.forEach((val, key) => {
                    const modifiedChara = this.getModifiedGameChara(userCharaList, userCardList, charaId, key, val);
                    if (modifiedChara != null) modifiedCharaArray = [modifiedChara];
                });
            });
        }
        if (modifiedCharaArray != null) {
            this.setOverrideValue(`userCharaList`, charaModMap);
            return Buffer.from(JSON.stringify({
                resultCode: "success",
                userCharaList: modifiedCharaArray,
            }), 'utf-8');
        }
    }

    private parsePageNum(reqBody: string | Buffer | undefined, type: "page" | "charaId"): number | undefined {
        if (reqBody != null && typeof reqBody !== 'string') return;

        if (reqBody == null || reqBody === "") {
            return 1;
        } else {
            try {
                const parsed = JSON.parse(reqBody);
                const parsedPageNum = parsed != null ? parsed[type] : undefined;
                if (
                    (typeof parsedPageNum !== 'number' && typeof parsedPageNum !== 'string')
                    || isNaN(Number(parsedPageNum))
                ) {
                    console.error(`parsePageNum invalid pageNum`);
                }
                return Number(parsedPageNum);
            } catch (e) {
                console.error(`parsePageNum error`, e);
            }
        }
    }
    private fakePagedResult(apiName: string, reqBody: string | Buffer | undefined, type: "page" | "charaId"): Buffer | undefined {
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');

        const urlBases: Record<string, string> = {
            ["page/PresentHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory`,
            ["page/GachaHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory`,
            ["page/CharaEnhancementTree"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaEnhancementTree`,
        }
        if (!(apiName in urlBases)) {
            console.error(`fakePagedResult invalid apiName=[${apiName}]`);
            return;
        }
        const urlBase = urlBases[apiName];

        const pageNum: number | undefined = this.parsePageNum(reqBody, type);
        if (pageNum == null) return;

        if (pageNum == 1) {
            const respBodyObj = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys[apiName]);
            if (respBodyObj == null) return;
            return Buffer.from(JSON.stringify(respBodyObj), 'utf-8');
        } else {
            const respBodyObj = userdataDump.unBrBase64(
                lastDump.httpResp.post.get(urlBase)?.get(JSON.stringify({ [type]: `${pageNum}` }))?.brBody);
            if (respBodyObj == null) return Buffer.from(this.fakeErrorResp("错误", `找不到指定${type}`), 'utf-8');
            return Buffer.from(JSON.stringify(respBodyObj), 'utf-8');
        }
    }
    private fakeGuidResult(apiName: string, pathname: string): Buffer | undefined {
        const urlBases: Record<string, string> = {
            ["friend/user"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/user/`,
            ["gacha/result"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/gacha/result/`,
        }
        if (!(apiName in urlBases)) {
            console.error(`fakeGuidResult invalid apiName=[${apiName}]`);
            return;
        }
        const urlBase = urlBases[apiName];

        const matched = pathname.match(this.slashGuidEndRegEx);
        const userId = matched != null ? matched[0].replace(/^\//, "") : undefined;
        if (userId == null) {
            return Buffer.from(this.fakeErrorResp("错误", "参数非法"), 'utf-8');
        }

        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');

        let respBodyObj = userdataDump.getUnBrBody(lastDump.httpResp.get,
            `${urlBase}${userId}`
        );
        if (respBodyObj == null) {
            console.error(`fakeGuidResult userId=[${userId}] not found`);
            return Buffer.from(this.fakeErrorResp("错误", "找不到此项数据"), 'utf-8');
        }

        return Buffer.from(JSON.stringify(respBodyObj), 'utf-8');
    }

    private fakeArenaResp(apiName: string, reqBody: string | Buffer | undefined): Buffer | undefined {
        if (typeof reqBody !== 'string') return;

        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return Buffer.from(this.fakeErrorResp("错误", "未加载个人账号数据"), 'utf-8');

        const myUserId = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/TopPage"])?.gameUser?.userId;
        if (typeof myUserId !== 'string' || !myUserId.match(userdataDump.guidRegEx)) {
            return Buffer.from(this.fakeErrorResp("错误", "无法读取用户ID"), 'utf-8');
        }

        switch (apiName) {
            case "arena/start":
                {
                    let opponentUserId: string | undefined;
                    let arenaBattleOpponentTeamType: string | undefined;
                    try {
                        const parsed = JSON.parse(reqBody);
                        if (parsed.arenaBattleType !== "SIMULATE") {
                            return Buffer.from(this.fakeErrorResp("错误", "目前镜层只支持演习", false), 'utf-8');
                        }
                        opponentUserId = parsed.opponentUserId;
                        if (typeof opponentUserId !== 'string' || !opponentUserId.match(userdataDump.guidRegEx)) {
                            console.error("opponentUserId must be string and guid");
                            return;
                        }
                        arenaBattleOpponentTeamType = parsed.arenaBattleOpponentTeamType;
                        if (typeof arenaBattleOpponentTeamType !== 'string') {
                            console.error("arenaBattleOpponentTeamType must be string");
                            return;
                        }
                    } catch (e) {
                        console.error(`fakeArenaStart error parsing`, e);
                        return;
                    }

                    const userQuestBattleResultId = this.getRandomGuid();
                    this.arenaSimulateMap.set(userQuestBattleResultId, opponentUserId);

                    const createdAt = this.getDateTimeString();

                    const obj = {
                        userQuestBattleResultList: [
                            {
                                id: userQuestBattleResultId,
                                userId: myUserId,
                                createdAt: createdAt,
                            }
                        ],
                        resultCode: "success",
                        userArenaBattleResultList: [
                            {
                                userQuestBattleResultId: userQuestBattleResultId,
                                userId: myUserId,
                                opponentUserId: opponentUserId,
                                arenaBattleType: "SIMULATE",
                                arenaBattleStatus: "CREATED",
                                arenaBattleOpponentType: "HIGHER",
                                arenaBattleOpponentTeamType: arenaBattleOpponentTeamType,
                                numberOfConsecutiveWins: 0,
                                point: 0,
                                createdAt: createdAt,
                            }
                        ]
                    }
                    return Buffer.from(JSON.stringify(obj), 'utf-8');
                    break;
                }
            case "quest/native/get":
                {
                    try {
                        const parsed = JSON.parse(reqBody);
                        const userQuestBattleResultId = parsed?.userQuestBattleResultId;
                        if (
                            typeof userQuestBattleResultId !== 'string'
                            || !userQuestBattleResultId.match(userdataDump.guidRegEx)
                        ) {
                            console.error(`fakeArenaNativeGet userQuestBattleResultId must be guid`);
                            return;
                        }
                        const opponentUserId = this.arenaSimulateMap.get(userQuestBattleResultId);
                        if (typeof opponentUserId !== 'string' || !opponentUserId.match(userdataDump.guidRegEx)) {
                            console.error(`fakeArenaNativeGet opponentUserId not found or invalid`);
                            return;
                        }

                        const arenaStartUrlStr = `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/arena/start`;
                        let arenaStartMap = lastDump.httpResp.post.get(arenaStartUrlStr);
                        if (arenaStartMap == null || !(arenaStartMap instanceof Map)) {
                            console.error(`fakeArenaNativeGet arenaStartMap is null or not map`);
                            return;
                        }
                        const nativeGetUrlStr = `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/quest/native/get`;
                        let nativeGetMap = lastDump.httpResp.post.get(nativeGetUrlStr);
                        if (nativeGetMap == null || !(nativeGetMap instanceof Map)) {
                            console.error(`fakeArenaNativeGet nativeGetMap is null or not map`);
                            return;
                        }

                        let foundArenaStartKey: string | undefined;
                        for (let key of arenaStartMap.keys()) {
                            let postDataObj = JSON.parse(key);
                            if (postDataObj.opponentUserId === opponentUserId) {
                                foundArenaStartKey = key;
                                break;
                            }
                        }
                        if (foundArenaStartKey == null) {
                            console.error(`fakeArenaNativeGet foundArenaStartKey == null`);
                            return;
                        }
                        const arenaStartResp = userdataDump.getUnBrBody(arenaStartMap, foundArenaStartKey);
                        if (arenaStartResp == null) {
                            console.error(`fakeArenaNativeGet arenaStartResp == null`);
                            return;
                        }
                        const userArenaBattleResultList = arenaStartResp.userArenaBattleResultList;
                        if (
                            userArenaBattleResultList == null || !Array.isArray(userArenaBattleResultList)
                            || userArenaBattleResultList.length == 0
                        ) {
                            console.error(`fakeArenaNativeGet cannot read userArenaBattleResultList`);
                            return;
                        }
                        const origUserQuestBattleResultId = userArenaBattleResultList[0]?.userQuestBattleResultId;
                        if (
                            typeof origUserQuestBattleResultId !== 'string' ||
                            !origUserQuestBattleResultId.match(userdataDump.guidRegEx)
                        ) {
                            console.error(`fakeArenaNativeGet origUserQuestBattleResultId must be guid`);
                            return;
                        }
                        const nativeGetKey = JSON.stringify({ userQuestBattleResultId: origUserQuestBattleResultId });
                        let nativeGetResp = userdataDump.getUnBrBody(nativeGetMap, nativeGetKey);
                        if (nativeGetResp == null || typeof nativeGetResp !== 'object') {
                            console.error(`fakeArenaNativeGet nativeGetResp must be object`);
                            return;
                        }
                        const replica = JSON.parse(JSON.stringify(nativeGetResp));
                        const replicaUserArenaBattleResultList = replica.webData?.userArenaBattleResultList;
                        if (replicaUserArenaBattleResultList == null || !Array.isArray(replicaUserArenaBattleResultList)) {
                            console.error(`fakeArenaNativeGet replicaUserArenaBattleResultList must be array`);
                            return;
                        }
                        replicaUserArenaBattleResultList.forEach((item) => {
                            item.userQuestBattleResultId = userQuestBattleResultId;
                        });
                        const replicaUserQuestBattleResultList = replica.webData?.userQuestBattleResultList;
                        if (replicaUserQuestBattleResultList == null || !Array.isArray(replicaUserQuestBattleResultList)) {
                            console.error(`fakeArenaNativeGet replicaUserQuestBattleResultList must be array`);
                            return;
                        }
                        replicaUserQuestBattleResultList.forEach((item) => {
                            item.id = userQuestBattleResultId;
                        });
                        if (replica.webData?.gameUser == null) {
                            console.error(`fakeArenaNativeGet replica.webData?.gameUser == null`);
                            return;
                        }
                        replica.webData.gameUser.userQuestBattleResultId = userQuestBattleResultId;
                        console.error(`fakeArenaNativeGet faked quest/native/get response`);
                        return Buffer.from(JSON.stringify(replica), 'utf-8');
                    } catch (e) {
                        console.error(`fakeArenaNativeGet error parsing`, e);
                        return;
                    }
                    break;
                }
            case "quest/native/result/send":
                {
                    try {
                        const parsed = JSON.parse(JSON.parse(reqBody).param);
                        const userQuestBattleResultId = parsed.userQuestBattleResultId;
                        if (
                            typeof userQuestBattleResultId !== 'string'
                            || !userQuestBattleResultId.match(userdataDump.guidRegEx)
                        ) {
                            console.error(`fakeArenaNativeResultSend userQuestBattleResultId must be string and guid`);
                            return;
                        }
                        const opponentUserId = this.arenaSimulateMap.get(userQuestBattleResultId);
                        if (typeof opponentUserId !== 'string' || !opponentUserId.match(userdataDump.guidRegEx)) {
                            console.error(`fakeArenaNativeResultSend opponentUserId must be string and guid`);
                            return;
                        }

                        // FIXME
                        return Buffer.from(JSON.stringify({
                            resultCode: "success",
                            gameUser: {
                                userId: myUserId,
                                freeRankArenaPoint: 18000,
                            },
                            userArenaBattle: {
                                userId: myUserId,
                                freeRankArenaPoint: 18000,
                                currentFreeRankClass: {
                                    arenaBattleFreeRankClass: "FREE_RANK_30",
                                    prevClass: "FREE_RANK_29",
                                    nextClass: "FREE_RANK_30",
                                    requiredPoint: 18000,
                                    className: "第30镜层",
                                },
                                previousFreeRankClass: {
                                    arenaBattleFreeRankClass: "FREE_RANK_29",
                                    prevClass: "FREE_RANK_28",
                                    nextClass: "FREE_RANK_30",
                                    requiredPoint: 18000,
                                    className: "第29镜层",
                                    nextClassName: "第30镜层",
                                }
                            },
                            userQuestBattleResultList: [
                                {
                                    id: userQuestBattleResultId,
                                    userId: myUserId,
                                }
                            ],
                            userArenaBattleResultList: [
                                {
                                    userQuestBattleResultId: userQuestBattleResultId,
                                    userId: myUserId,
                                    opponentUserId: opponentUserId,
                                    arenaBattleStatus: parsed.result === "FAILED" ? "LOSE" : "WIN",
                                    completedAt: this.getDateTimeString(),
                                    createdAt: this.getDateTimeString(),
                                }
                            ]
                        }));
                    } catch (e) {
                        console.error(`fakeArenaNativeResultSend error parsing`, e);
                    }
                    break;
                }
            case "page/ArenaResult":
                {
                    try {
                        const parsed = JSON.parse(reqBody);
                        const strUserId = parsed.strUserId;
                        if (typeof strUserId !== 'string' || !strUserId.match(userdataDump.guidRegEx)) {
                            console.error(`fakeArenaResult strUserId must be guid`);
                            return;
                        }
                        // FIXME
                        return Buffer.from(JSON.stringify({
                            resultCode: "success",
                            userProfile: {
                                userId: strUserId,
                                userDeck: {
                                    userId: strUserId,
                                },
                                leaderUserCard: {
                                    displayCardId: 10011,
                                },
                                userArenaBattle: {
                                    freeRankArenaPoint: 18000,
                                    arenaBattleFreeRankClass: "FREE_RANK_30",
                                    prevClass: "FREE_RANK_29",
                                    nextClass: "FREE_RANK_30",
                                    requiredPoint: 18000,
                                    className: "第30镜层",
                                }
                            }
                        }), 'utf-8');
                    } catch (e) {
                        console.error(`fakeArenaResult error parsing`, e);
                    }
                    break;
                }
            default:
                {
                    console.error(`fakeArena invalid apiName=[${apiName}]`);
                    return;
                }
        }
    }

    private fakeMagiRepo(apiName: string): Buffer | undefined {
        if (apiName !== "page/MagiRepo") {
            console.error(`fakeMagiRepo invalid apiName=[${apiName}]`);
            return;
        }
        const obj: Record<string, any> = {
            currentTime: this.getDateTimeString(),
            resourceUpdated: false,
            eventList: [],
            regularEventList: [],
            functionMaintenanceList: [],
            campaignList: [],
            magiRepoList: [],
            forceClearCache: false,
        }
        const lastNumber = [46, 100];
        for (let part = 1; part <= 2; part++) {
            for (let number = 1; number <= lastNumber[part - 1]; number++) {
                let numberStr = String(number);
                if (numberStr.length < 3) {
                    numberStr = Array.from({ length: 3 - numberStr.length }, () => "0").join("") + numberStr;
                }
                let item: Record<string, number | string> = {
                    part: part,
                    number: number,
                    imagePath: `/part${part}/magirepo_0${part}_${numberStr}.png`
                }
                if (part == 2) {
                    if (item.number <= 30) delete item.startAt;
                    else if (item.number <= 36) item.startAt = "2021/05/31 13:00:00";
                    else if (item.number <= 40) item.startAt = "2021/06/24 13:00:00";
                    else if (item.number <= 47) item.startAt = "2021/08/05 13:00:00";
                    else if (item.number <= 50) item.startAt = "2021/09/13 13:00:00";
                    else if (item.number <= 56) item.startAt = "2021/10/12 13:00:00";
                    else if (item.number <= 60) item.startAt = "2021/11/26 13:00:00";
                    else if (item.number <= 69) item.startAt = "2022/01/25 13:00:00";
                    else if (item.number <= 77) item.startAt = "2022/02/21 13:00:00";
                    else if (item.number <= 83) item.startAt = "2022/04/12 13:00:00";
                    else if (item.number <= 88) item.startAt = "2022/05/13 12:00:00";
                    else if (item.number <= 91) item.startAt = "2022/06/21 13:00:00";
                    else if (item.number <= 100) item.startAt = "2022/07/29 12:00:00";
                }
                obj.magiRepoList.push(item);
            }
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }

    private get404xml(host: string, key: string): string {
        return `<? xml version = "1.0" encoding = "UTF-8" ?> `
            + `\n<Error>`
            + `\n < Code > NoSuchKey < /Code>`
            + `\n  <Message>The specified key does not exist.</Message>`
            + `\n  <RequestId>${crypto.randomBytes(12).toString('hex').toUpperCase()}</RequestId>`
            + `\n  <HostId>${host}</HostId>`
            + `\n  <Key>${key}</Key>`
            + `\n</Error>`
            + `\n`;
    }

    private fakeErrorResp(title?: string, errorTxt?: string, forceGoto: string | boolean = true): string {
        const obj: Record<string, string> = {
            forceGoto: "first",
            resultCode: "error",
            title: title == null ? "错误" : title,
            errorTxt: errorTxt == null ? "出现错误" : errorTxt,
        }
        if (typeof forceGoto === 'string') obj.forceGoto = forceGoto;
        else if (!forceGoto) delete obj.forceGoto;
        return JSON.stringify(obj);
    }

    private readonly pageKeys: Record<string, string> = {
        //登录页
        ["page/TopPage"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
            + `user`
            + `%2CgameUser`
            + `%2CitemList`
            + `%2CgiftList`
            + `%2CpieceList`
            + `%2CuserQuestAdventureList`
            + `&timeStamp=`,
        //首页
        ["page/MyPage"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MyPage?value=`
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
            + `&timeStamp=`,
        //魔法少女首页
        ["page/CharaListTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaListTop?value=`
            + `&timeStamp=`,
        //记忆结晶首页
        ["page/MemoriaTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MemoriaTop?value=`
            + `&timeStamp=`,
        //记忆结晶保管库
        ["page/PieceArchive"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PieceArchive?value=`
            + `&timeStamp=`,
        //扭蛋首页
        ["page/GachaTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaTop?value=`
            + `&timeStamp=`,
        //扭蛋获得履历（仅GUID，仅第一页）
        ["page/GachaHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/GachaHistory?value=`
            + `&timeStamp=`,
        //任务
        ["page/MissionTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MissionTop?value=`
            + `userDailyChallengeList`
            + `%2CuserTotalChallengeList`
            + `%2CuserNormalAchievementList`
            + `%2CuserMoneyAchievementList`
            + `%2CGrowthFundList`
            + `%2CGrowth2FundList`
            + `%2CgameUser`
            + `%2CuserLimitedChallengeList&timeStamp=`,
        //集章卡
        ["page/PanelMissionTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PanelMissionTop?value=`
            + `&timeStamp=`,
        //商店
        ["page/ShopTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ShopTop?value=`
            + `userFormationSheetList`
            + `&timeStamp=`,
        //礼物奖励箱（只有第一页）
        ["page/PresentList"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentList?value=`
            + `&timeStamp=`,
        //获得履历（只有第一页）
        ["page/PresentHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PresentHistory?value=`
            + `&timeStamp=`,
        //档案
        ["page/CollectionTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CollectionTop?value=`
            + `&timeStamp=`,
        //魔法少女图鉴
        ["page/CharaCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaCollection?value=`
            + `&timeStamp=`,
        //记忆结晶图鉴
        ["page/PieceCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PieceCollection?value=`
            + `&timeStamp=`,
        //剧情存档
        ["page/StoryCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/StoryCollection?value=`
            + `&timeStamp=`,
        //魔女化身图鉴
        ["page/DoppelCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/DoppelCollection?value=`
            + `&timeStamp=`,
        //魔女·传闻图鉴
        ["page/EnemyCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EnemyCollection?value=`
            + `&timeStamp=`,
        //道具首页
        ["page/ItemListTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ItemListTop?value=`
            + `&timeStamp=`,
        //不同素材副本一览
        ["page/SearchQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SearchQuest?value=`
            + `userFollowList`
            + `&timeStamp=`,
        //好友（关注，仅GUID）
        ["page/FollowTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FollowTop?value=`
            + `userFollowList`
            + `&timeStamp=`,
        //好友（粉丝，仅GUID）
        ["friend/follower/list/1"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/friend/follower/list/1`,
        //长按好友打开支援详情
        ["page/ProfileFormationSupport"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ProfileFormationSupport?value=`
            + `userFormationSheetList`
            + `&timeStamp=`,
        //设定
        ["page/ConfigTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ConfigTop?value=`
            + `&timeStamp=`,
        //队伍首页
        ["page/FormationTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/FormationTop?value=`
            + `&timeStamp=`,
        //任务/支援/镜界组队
        ["page/DeckFormation"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/DeckFormation?value=`
            + `&timeStamp=`,
        //记忆结晶组合
        ["page/MemoriaSetEquip"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MemoriaSetEquip?value=`
            + `&timeStamp=`,
        //镜层首页
        ["page/ArenaTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaTop?value=`
            + `userArenaBattle&timeStamp=`,
        //普通镜层对战
        ["page/ArenaFreeRank"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaFreeRank?value=`
            + `&timeStamp=`,
        //镜层演习
        ["page/ArenaSimulate"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaSimulate?value=`
            + `&timeStamp=`,
        //对战记录
        ["page/ArenaHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaHistory?value=`
            + `&timeStamp=`,
        //排名战绩
        ["page/EventArenaRankingHistory"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EventArenaRankingHistory?value=` +
            `&timeStamp=`,
        //报酬一览（从游戏界面上看好像每个人都一样）
        ["page/ArenaReward"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaReward?value=`
            + `&timeStamp=`,
        //主线剧情
        ["page/MainQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MainQuest?value=`
            + `userChapterList`
            + `%2CuserSectionList`
            + `%2CuserQuestBattleList`
            + `%2CuserFollowList&timeStamp=`,
        //支线剧情
        ["page/SubQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/SubQuest?value=`
            + `&timeStamp=`,
        //魔法少女剧情
        ["page/CharaQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaQuest?value=`
            + `&timeStamp=`,
        //狗粮本
        ["page/EventQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EventQuest?value=`
            + `&timeStamp=`,
    }

    private readonly myPagePatchList: Record<string, Array<string>> = {
        ["page/TopPage"]: [
            `userQuestAdventureList`,
        ],
        ["page/MainQuest"]: [
            `userChapterList`,
            `userSectionList`,
            `userQuestBattleList`,
            `userFollowList`,
        ],
        ["page/ArenaTop"]: [
            `userArenaBattle`,
        ],
        ["page/ProfileFormationSupport"]: [
            `userFormationSheetList`,
        ],
    }

    private readonly fakeResp: Record<string, any> = {
        ["announcements/red/obvious"]: {
            resultCode: "success",
            count: 0
        },
        ["event_banner/list/1"]: [
            /*
            {
                bannerId: 355,
                description: "期间限定扭蛋 夏日寻宝！～火中消失的夏之宝物～",
                bannerText: "期间限定扭蛋 夏日寻宝！～火中消失的夏之宝物～",
                startAt: "2022/10/02 13:00:00",
                endAt: "2022/10/05 12:59:59",
                sortKey: 7,
                showAnnounce: true,
                showMypage: true,
                showMypageSub: 0,
                imagePath: "/magica/resource/image_web/banner/announce/banner_0255",
                bannerLink: "#/GachaTop/279",
                createdAt: "2020/05/27 10:11:38",
            },
            {
                bannerId: 356,
                description: "鹿目圆生日扭蛋",
                bannerText: "鹿目圆生日扭蛋",
                startAt: "2022/10/03 00:00:00",
                endAt: "2022/10/05 23:59:59",
                sortKey: 7,
                showAnnounce: true,
                showMypage: true,
                showMypageSub: 0,
                imagePath: "/magica/resource/image_web/banner/announce/banner_0284",
                bannerLink: "#/GachaTop/332",
                createdAt: "2020/05/27 10:11:38",
            },
            {
                bannerId: 350,
                description: "1日1次稀有扭蛋免费10连",
                bannerText: "1日1次稀有扭蛋免费10连",
                startAt: "2022/09/08 10:00:00",
                endAt: "2022/10/11 23:59:59",
                sortKey: 7,
                showAnnounce: true,
                showMypage: true,
                showMypageSub: 0,
                imagePath: "/magica/resource/image_web/banner/announce/banner_0263",
                bannerLink: "#/GachaTop/2890001",
                createdAt: "2020/05/27 10:11:38",
            },
            */
            {
                bannerId: 211,
                description: "【新成就】累消成就正式实装",
                bannerText: "【新成就】累消成就正式实装",
                startAt: "2021/10/12 13:00:00",
                endAt: "2099/10/24 23:59:59",
                sortKey: 9860,
                showAnnounce: true,
                showMypage: true,
                showMypageSub: 0,
                imagePath: "/magica/resource/image_web/banner/announce/banner_0154_6",
                bannerLink: "#/MissionTop",
                createdAt: "2020/05/27 10:11:38",
            },
        ],
    }

    private staticModList: Record<string, {
        matchPattern: string | RegExp,
        replacePattern: string | RegExp,
        replacement: string,
    }> = {
            ["/magica/template/collection/StoryCollection.html"]: {
                matchPattern: /^<div id="StoryCollection">/,
                replacePattern: /(<li class="TE btn se_tabs current" data-wrap="main"><span>主线【第1部】<\/span><\/li>)/,
                replacement: "$1 <li class=\"TE btn se_tabs\" data-wrap=\"mainSecond\"><span>主线【第2部】</span></li>",
            },
            ["/magica/template/chara/CharaTop.html"]: {
                matchPattern: /^<div id="CharaTop">/,
                replacePattern: /(<li class="TE customize"><span class="linkBtn se_decide" data-href="#\/CharaListCustomize"><\/span><\/li>)/,
                replacement: "$1 <li class=\"TE enhance\"><span class=\"enhanceLink se_decide\"></span></li>",
            },
        }

    private checkForMissing = (existingArray: Array<any>, missingArray: Array<any>, key: string) => {
        if (existingArray == null || missingArray == null) return;
        if (!Array.isArray(existingArray) || !Array.isArray(missingArray)) return;
        missingArray.forEach((missing) => {
            if (
                existingArray.find(
                    (existing: any) => existing != null && missing != null && missing[key] === existing[key]
                ) == null
            ) {
                existingArray.push(missing);
            }
        });
    }

    private patchMainQuest(apiName: string, respBodyObj: any): any {
        if (apiName !== "page/MainQuest") return respBodyObj;
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return respBodyObj;
        const myPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/MyPage"]);
        const userId = myPage?.gameUser?.userId;
        if (typeof userId === 'string') {
            if (this.missingData?.userId !== userId) this.missingData = new missingData(userId);
            this.checkForMissing(respBodyObj.userChapterList, this.missingData.userChapterList, "chapterId");
            this.checkForMissing(respBodyObj.userSectionList, this.missingData.userSectionList, "sectionId");
            this.checkForMissing(respBodyObj.userQuestBattleList, this.missingData.userQuestBattleList, "questBattleId");
        }
        return respBodyObj;
    }

    private patchCharaListTop(apiName: string, respBodyObj: any): any {
        if (apiName !== "page/CharaListTop") return respBodyObj;
        const lastDump = this.userdataDmp.lastDump;
        if (lastDump == null) return respBodyObj;
        const myPage = userdataDump.getUnBrBody(lastDump.httpResp.get, this.pageKeys["page/MyPage"]);
        const userId = myPage?.gameUser?.userId;
        if (typeof userId === 'string') {
            let pageKey = this.pageKeys["page/ProfileFormationSupport"];
            const argName = `%2CuserCharaEnhancementCellList&`;
            if (pageKey.match(argName) == null) {
                pageKey = pageKey.replace(/&(timeStamp=)$/, `${argName}$1`);
            }
            let page = userdataDump.getUnBrBody(lastDump.httpResp.get, pageKey);
            if (page == null) return respBodyObj;
            const key = "userCharaEnhancementCellList";
            respBodyObj[key] = page[key];
            if (respBodyObj[key] == null) {
                respBodyObj[key] = [];
            }
        }
        return respBodyObj;
    }

    private getRandomGuid(): string {
        return [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
            .toString('hex').substring(0, len)).join("-");
    }

}