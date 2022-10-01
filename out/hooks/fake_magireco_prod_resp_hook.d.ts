/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import * as http from "http";
import * as http2 from "http2";
import { fakeResponse, hook, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
export declare class fakeMagirecoProdRespHook implements hook {
    private readonly params;
    private readonly crawler;
    private readonly magirecoProdUrlRegEx;
    private readonly apiPathNameRegEx;
    constructor(params: parameters.params, crawler: staticResCrawler.crawler);
    matchRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders): fakeResponse | passOnRequest;
    onMatchedRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, body?: string | Buffer): fakeResponse | passOnRequestBody;
    onMatchedResponse(statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer): void;
}
