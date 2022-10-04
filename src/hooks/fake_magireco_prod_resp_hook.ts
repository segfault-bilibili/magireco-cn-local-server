import * as http from "http";
import * as http2 from "http2";
import * as crypto from "crypto";
import { fakeResponse, hook, localServer, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
import * as userdataDump from "../userdata_dump";
import { bsgamesdkPwdAuth } from "../bsgamesdk-pwd-authenticate";

export class fakeMagirecoProdRespHook implements hook {
    private readonly params: parameters.params;
    private readonly crawler: staticResCrawler.crawler;
    private readonly userdataDmp: userdataDump.userdataDmp;

    private readonly magirecoProdUrlRegEx: RegExp;
    private readonly magirecoPatchUrlRegEx: RegExp;
    private readonly apiPathNameRegEx: RegExp;

    private readonly bsgameSdkLoginRegEx: RegExp;
    private readonly bsgameSdkCipherRegEx: RegExp;

    constructor(params: parameters.params, crawler: staticResCrawler.crawler, dmp: userdataDump.userdataDmp) {
        this.params = params;
        this.crawler = crawler;
        this.userdataDmp = dmp;

        this.magirecoProdUrlRegEx = /^(http|https):\/\/l\d+-prod-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/(|maintenance\/)magica\/.+$/;
        this.magirecoPatchUrlRegEx = /^(http|https):\/\/line\d+-prod-patch-mfsn\d*\.bilibiligame\.net\/magica\/.+$/;
        this.apiPathNameRegEx = /^\/magica\/api\/.+$/;

        this.bsgameSdkLoginRegEx = /^(http|https):\/\/line\d+-sdk-center-login-sh\.biligame\.net\/api\/external\/(login|user\.token\.oauth\.login)\/v3((|\?.*)$)/;
        this.bsgameSdkCipherRegEx = /^(http|https):\/\/line\d+-sdk-center-login-sh\.biligame\.net\/api\/external\/issue\/cipher\/v3((|\?.*)$)/;
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
        if (!isMagiRecoProd && !isMagiRecoPatch && !isBsgamesdkLogin && !isBsgamesdkCipher) return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }

        if (isBsgamesdkCipher || isBsgamesdkLogin) {
            let contentType = 'application/json;charset=UTF-8';
            let respBody: Buffer | undefined;
            if (isBsgamesdkCipher) {
                console.log(`attempt to fake bsgamesdk cipher response`);
                respBody = this.fakeBsgamesdkCipherResp();
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

        const isApi = url.pathname.match(this.apiPathNameRegEx) != null;
        if (isApi) {
            let statusCode = 200;
            let contentType = `application/json;charset=UTF-8`;
            let body: Buffer | undefined;

            const apiName = url.pathname.replace(/^\/magica\/api\//, "");
            switch (apiName) {
                case "system/game/login":
                    {
                        body = this.fakeSystemLogin();
                        if (body != null) console.log(`faked system login`);
                        else console.error(`failed to fake system login`);
                        break;
                    }
                case "announcements/red/obvious":
                case "event_banner/list/1":
                    {
                        body = Buffer.from(JSON.stringify(this.fakeResp[apiName]), 'utf-8');
                        break;
                    }
                case "test/logger/error": {
                    return {
                        nextAction: "passOnRequest",
                        interceptResponse: true,
                    }
                }
                case "page/ResumeBackground":
                    {
                        body = this.fakeResumeBackground();
                        break;
                    }
                case "page/MyPage":
                    {
                        body = this.fakeMyPage();
                        break;
                    }
                case "page/TopPage":
                case "page/CollectionTop":
                case "page/CharaCollection":
                case "page/PieceCollection":
                case "page/StoryCollection":
                case "page/DoppelCollection":
                case "page/EnemyCollection":
                    {
                        const lastSnapshot = this.userdataDmp.lastSnapshot;
                        if (lastSnapshot != null) {
                            let respBodyObj = lastSnapshot.httpResp.get.get(this.pageKeys[apiName])?.body;
                            if (respBodyObj != null) {
                                body = Buffer.from(JSON.stringify(respBodyObj), 'utf-8');
                            }
                        }
                        break;
                    }
                default:
                    {
                    }
            }

            if (body == null) {
                console.error(`responding with forceGotoFirst [${url.pathname}]`);
                body = Buffer.from(this.forceGotoFirst(), 'utf-8');
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
            } catch (e) {
                console.error(`error serving[${url.pathname}]`, e);
                body = undefined;
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
                if (!this.crawler.isKnown404(url.pathname)) console.error(`responding 404[${url.pathname}]`);
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
        body?: string | Buffer
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
        if (isApi) {
            let statusCode = 200;
            let contentType = `application/json;charset=UTF-8`;
            let respBody: Buffer | undefined;

            const apiName = url.pathname.replace(/^\/magica\/api\//, "");
            switch (apiName) {
                case "test/logger/error":
                    {
                        if (typeof body === 'string') {
                            console.error(`[test/logger/error]`, body);
                        }
                        break;
                    }
                default:
                    {
                    }
            }

            if (respBody == null) {
                console.error(`responding with forceGotoFirst [${url.pathname}]`);
                respBody = Buffer.from(this.forceGotoFirst(), 'utf-8');
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
            requestId: `${this.getRandomHex(32)}`,
            timestamp: `${new Date().getTime()}`,
            code: 0,
            hash: `${this.getRandomHex(16)}`, // fake one
            cipher_key: "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDjb4V7EidX/ym28t2ybo0U6t0n\n6p4ej8VjqKHg100va6jkNbNTrLQqMCQCAYtXMXXp2Fwkk6WR+12N9zknLjf+C9sx\n/+l48mjUU8RqahiFD1XT/u2e0m2EN029OhCgkHx3Fc/KlFSIbak93EH/XlYis0w+\nXl69GV6klzgxW6d2xQIDAQAB\n-----END PUBLIC KEY-----",
            server_message: "",
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }
    private fakeBsgamesdkLoginResp(): Buffer | undefined {
        const lastSnapshot = this.userdataDmp.lastSnapshot;
        if (lastSnapshot == null) return;

        const uid = lastSnapshot.uid;
        if (typeof uid !== 'number' || isNaN(uid)) return;

        const topPage = lastSnapshot.httpResp.get.get(this.pageKeys["page/TopPage"])?.body;
        if (topPage == null) return;

        const user = topPage["user"];
        if (user == null) return;
        const loginName = user["loginName"];

        const requestId = this.getRandomHex(32);
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
            access_key: `${this.getRandomHex(32)}_sh`,
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
        const lastSnapshot = this.userdataDmp.lastSnapshot;
        if (lastSnapshot == null) return;

        const topPage = lastSnapshot.httpResp.get.get(this.pageKeys["page/TopPage"])?.body;
        if (topPage == null) return;

        const loginName = topPage["loginName"];

        const obj = {
            data: {
                open_id: `${this.getRandomOpenId()}`,
                uname: `${loginName}`,
                code: 0,
                timestamp: new Date().getTime(),
            },
            resultCode: "success"
        }
        return Buffer.from(JSON.stringify(obj), 'utf-8');
    }

    private fakeResumeBackground(): Buffer {
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

    private fakeMyPage(): Buffer | undefined {
        const apiName = "page/MyPage";
        const lastSnapshot = this.userdataDmp.lastSnapshot;
        if (lastSnapshot != null) {
            let respBodyObj = lastSnapshot.httpResp.get.get(this.pageKeys[apiName])?.body;
            if (respBodyObj != null) {
                // make a replica to avoid changing original
                let replica = JSON.parse(JSON.stringify(respBodyObj));
                // copy "missing" parts from other page to populate common.storage,
                // so that StoryCollection etc won't crash
                for (let pageKey in this.myPagePatchList) {
                    let page = lastSnapshot.httpResp.get.get(this.pageKeys[pageKey])?.body;
                    if (page == null) {
                        console.error(`[${pageKey}] is missing, cannot copy data from it to [${apiName}]`);
                        continue;
                    }
                    this.myPagePatchList[pageKey].forEach((key) => {
                        replica[key] = page[key];
                        if (replica[key] == null) {
                            console.error(`cannot copy [${key}] from [${pageKey}] to [${apiName}]`);
                        }
                    });
                }
                // convert to buffer
                return Buffer.from(JSON.stringify(replica), 'utf-8');
            }
        }
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

    private forceGotoFirst(title?: string, errorTxt?: string): string {
        return JSON.stringify({
            forceGoto: "first",
            resultCode: "error",
            title: title == null ? "错误" : title,
            errorTxt: errorTxt == null ? "API尚未实现" : errorTxt,
        });
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
        //主线剧情
        ["page/MainQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MainQuest?value=`
            + `userChapterList`
            + `%2CuserSectionList`
            + `%2CuserQuestBattleList`
            + `%2CuserFollowList&timeStamp=`,
        //镜层首页
        ["page/ArenaTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaTop?value=`
            + `userArenaBattle&timeStamp=`,

    }

    private readonly myPagePatchList: Record<string, Array<string>> = {
        ["page/MainQuest"]: [
            `userChapterList`,
            `userSectionList`,
            `userQuestBattleList`,
            `userFollowList`,
        ],
        ["page/ArenaTop"]: [
            `userArenaBattle`,
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

    private getRandomHex(charCount: number): string {
        return crypto.randomBytes(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
    }

    private getRandomOpenId(): string {
        return [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
            .toString('hex').substring(0, len)).join("-");
    }

}