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
    private readonly params;
    private readonly crawler;
    private readonly userdataDmp;
    private readonly magirecoProdUrlRegEx;
    private readonly magirecoPatchUrlRegEx;
    private readonly apiPathNameRegEx;
    private readonly slashGuidEndRegEx;
    private readonly bsgameSdkLoginRegEx;
    private readonly bsgameSdkCipherRegEx;
    private readonly bsgameSdkOtpSendRegEx;
    private readonly bilibiliGameAgreementRegEx;
    private readonly arenaSimulateMap;
    get stringifiedOverrideDB(): string;
    private get overrides();
    getOverrideValue(key: string): any;
    setOverrideValue(key: string, val: string | number | Map<number, Map<string, string | number>> | undefined): void;
    get bgItemId(): string | undefined;
    set bgItemId(val: string | undefined);
    get leaderId(): string | undefined;
    set leaderId(val: string | undefined);
    constructor(params: parameters.params, crawler: staticResCrawler.crawler, dmp: userdataDump.userdataDmp);
    matchRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders): fakeResponse | passOnRequest;
    onMatchedRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, reqBody?: string | Buffer): fakeResponse | passOnRequestBody;
    onMatchedResponse(statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer): void;
    private fakeBsgamesdkCipherResp;
    private fakeBsgamesdkOtpSendResp;
    private fakeBsgamesdkLoginResp;
    private fakeSystemLogin;
    private fakeEmptyResp;
    private getDateTimeString;
    private fakeMyPage;
    private modifyGameUser;
    private getModifiedGameChara;
    private modifyGameChara;
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
    private getRandomHex;
    private getRandomGuid;
}
