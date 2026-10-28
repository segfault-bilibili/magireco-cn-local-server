/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import * as http from "http";
import * as http2 from "http2";
import { fakeResponse, hook, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
import * as userdataDump from "../userdata_dump";
export declare class fakeMagirecoProdRespHook implements hook {
    private readonly cnNpcSupportMap;
    private readonly cnQuestsMap;
    private readonly cnFakeQuestResultsMap;
    private readonly params;
    private readonly crawler;
    private readonly userdataDmp;
    private readonly questStartMap;
    private readonly arenaSimulateMap;
    get stringifiedOverrideDB(): string;
    private missingData?;
    private get overrides();
    getOverrideValue(key: string): any;
    isOverriden(key: string): boolean;
    setOverrideValue(key: string, val: string | number | Map<number, Map<string, string | number>> | undefined, reset?: boolean): void;
    private readonly etagDict;
    constructor(params: parameters.params, crawler: staticResCrawler.crawler, dmp: userdataDump.userdataDmp);
    matchRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders): Promise<fakeResponse | passOnRequest>;
    onMatchedRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, reqBody?: string | Buffer): fakeResponse | passOnRequestBody;
    onMatchedResponse(statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer): void;
    private fakeBsgamesdkCipherResp;
    private fakeBsgamesdkOtpSendResp;
    private fakeBsgamesdkTouristBindTelPwdResp;
    private fakeBsgamesdkLoginResp;
    private fakeSystemLogin;
    private fakeEmptyResp;
    private get currentTime();
    private fixCurrentTime;
    private fakeMyPage;
    private modifyGameUser;
    private getModifiedGameChara;
    private modifyGameChara;
    private fakeFriendSearch;
    private fakeSupportSelect;
    private parsePageNum;
    private fakePagedResult;
    private fakeGuidResult;
    private fakeArenaResp;
    private fakeMagiRepo;
    private get404xml;
    private fakeErrorResp;
    private readonly pageKeys;
    private readonly myPagePatchList;
    private readonly fakeResp;
    private staticModList;
    private checkForMissing;
    private patchMainQuest;
    private patchCharaListTop;
    private injectUltimateMadokaSpiritEnhancement;
}
