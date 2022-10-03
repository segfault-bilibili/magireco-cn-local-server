import * as http from "http";
import * as http2 from "http2";
import * as crypto from "crypto";
import { fakeResponse, hook, localServer, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
import * as userdataDump from "../userdata_dump";

export class fakeMagirecoProdRespHook implements hook {
    private readonly params: parameters.params;
    private readonly crawler: staticResCrawler.crawler;
    private readonly userdataDmp: userdataDump.userdataDmp;

    private readonly magirecoProdUrlRegEx: RegExp;
    private readonly magirecoPatchUrlRegEx: RegExp;
    private readonly apiPathNameRegEx: RegExp;

    constructor(params: parameters.params, crawler: staticResCrawler.crawler, dmp: userdataDump.userdataDmp) {
        this.params = params;
        this.crawler = crawler;
        this.userdataDmp = dmp;

        this.magirecoProdUrlRegEx = /^(http|https):\/\/l\d+-prod-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/(|maintenance\/)magica\/.+$/;
        this.magirecoPatchUrlRegEx = /^(http|https):\/\/line\d+-prod-patch-mfsn\d*\.bilibiligame\.net\/magica\/.+$/;
        this.apiPathNameRegEx = /^\/magica\/api\/.+$/;
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
        if (!isMagiRecoProd && !isMagiRecoPatch) return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }

        const isApi = url.pathname.match(this.apiPathNameRegEx) != null;
        if (isApi) {
            let statusCode = 200;
            let contentType = `application/json;charset=UTF-8`;
            let body: Buffer | undefined;

            const apiName = url.pathname.replace(/^\/magica\/api\//, "");
            switch (apiName) {
                case "system/game/login":
                    return {
                        nextAction: "passOnRequest",
                        interceptResponse: false,
                    }
                case "announcements/red/obvious":
                case "event_banner/list/1":
                    {
                        body = Buffer.from(JSON.stringify(this.fakeResp[apiName]), 'utf-8');
                        break;
                    }
                /*
                case "test/logger/error": {
                    return {
                        nextAction: "passOnRequest",
                        interceptResponse: false,
                    }
                }
                */
                case "page/MyPage":
                    {
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
                                body = Buffer.from(JSON.stringify(replica), 'utf-8');
                            }
                        }
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
        return {
            nextAction: "passOnRequestBody",
            interceptResponse: false,
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
        ["page/TopPage"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/TopPage?value=`
            + `user`
            + `%2CgameUser`
            + `%2CitemList`
            + `%2CgiftList`
            + `%2CpieceList`
            + `%2CuserQuestAdventureList`
            + `&timeStamp=`,
        ["page/CollectionTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CollectionTop?value=`
            + `&timeStamp=`,
        ["page/CharaCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/CharaCollection?value=`
            + `&timeStamp=`,
        ["page/PieceCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/PieceCollection?value=`
            + `&timeStamp=`,
        ["page/StoryCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/StoryCollection?value=`
            + `&timeStamp=`,
        ["page/DoppelCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/DoppelCollection?value=`
            + `&timeStamp=`,
        ["page/EnemyCollection"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/EnemyCollection?value=`
            + `&timeStamp=`,
        ["page/MainQuest"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/MainQuest?value=`
            + `userChapterList`
            + `%2CuserSectionList`
            + `%2CuserQuestBattleList`
            + `%2CuserFollowList&timeStamp=`,
        ["page/ArenaTop"]: `https://l3-prod-all-gs-mfsn2.bilibiligame.net/magica/api/page/ArenaTop?value=`
            + `userArenaBattle&timeStamp=`
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

    private readonly fakeResp = {
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

}