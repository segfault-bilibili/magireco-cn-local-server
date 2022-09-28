"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveResponseBodyHook = void 0;
class saveResponseBodyHook {
    constructor(params, urlRegEx, paramKey) {
        this.params = params;
        this.urlRegEx = urlRegEx;
        this.paramKey = paramKey;
    }
    // if matched, keep a copy of request/response data in memory
    matchRequest(method, url, httpVersion, headers) {
        if (url == null)
            return false;
        return url.href.match(this.urlRegEx) ? true : false;
    }
    onMatchedRequest(method, url, httpVersion, headers, body) {
    }
    onMatchedResponse(statusCode, statusMessage, httpVersion, headers, body) {
        const tag = "saveResponseBodyHook";
        const key = this.paramKey;
        const val = body;
        if (typeof val === 'string') {
            this.params.save({ key: key, val: val }).then(() => console.log(`${tag} saved paramKey=[${key}]`));
        }
        else {
            if (val == null) {
                console.error(`${tag} nothing to save paramKey=[${key}]`);
            }
            else {
                console.error(`${tag} cannot save binary paramKey=[${key}]`);
            }
        }
    }
}
exports.saveResponseBodyHook = saveResponseBodyHook;
