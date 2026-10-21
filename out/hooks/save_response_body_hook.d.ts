import * as http from "http";
import * as http2 from "http2";
import { hook, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
export declare class saveResponseBodyHook implements hook {
    readonly params: parameters.params;
    readonly urlRegEx: RegExp;
    readonly paramKey: string;
    constructor(params: parameters.params, urlRegEx: RegExp, paramKey: string);
    matchRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders): Promise<passOnRequest>;
    onMatchedRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, body?: string | Buffer): passOnRequestBody;
    onMatchedResponse(statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer): void;
}
