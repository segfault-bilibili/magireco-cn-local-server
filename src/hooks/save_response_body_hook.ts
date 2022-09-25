import * as http from "http";
import * as http2 from "http2";
import { hook } from "../local_server";
import * as parameters from "../parameters";

export class saveResponseBodyHook implements hook {
    readonly params: parameters.params;
    readonly urlRegEx: RegExp;
    readonly paramKey: string;

    constructor(params: parameters.params, urlRegEx: RegExp, paramKey: string) {
        this.params = params;
        this.urlRegEx = urlRegEx;
        this.paramKey = paramKey;
    }

    // if matched, keep a copy of request/response data in memory
    matchRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ): boolean {
        if (url == null) return false;
        return url.href.match(this.urlRegEx) ? true : false;
    }

    onMatchedRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders,
        body?: string | Buffer
    ): void {
    }

    onMatchedResponse(
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: string | Buffer
    ): void {
        const tag = "saveResponseBodyHook";
        const key = this.paramKey;
        const val = body;
        if (typeof val === 'string') {
            this.params.save({key: key, val: val}).then(() => console.log(`${tag} saved paramKey=[${key}]`));
        } else {
            if (val == null) {
                console.error(`${tag} nothing to save paramKey=[${key}]`);
            } else {
                console.error(`${tag} cannot save binary paramKey=[${key}]`);
            }
        }
    }
}