"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fakeMagirecoProdRespHook = void 0;
const http2 = require("http2");
const parameters = require("../parameters");
const staticResCrawler = require("../static_res_crawler");
class fakeMagirecoProdRespHook {
    constructor(params, crawler) {
        this.params = params;
        this.crawler = crawler;
        this.magirecoProdUrlRegEx = /^(http|https):\/\/l\d+-prod-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/(|maintenance\/)magica\/.+$/;
        this.magirecoPatchUrlRegEx = /^(http|https):\/\/line\d+-prod-patch-mfsn\d*\.bilibiligame\.net\/magica\/.+$/;
        this.apiPathNameRegEx = /^\/magica\/api\/.+$/;
    }
    // if matched, keep a copy of request/response data in memory
    matchRequest(method, url, httpVersion, headers) {
        const mode = this.params.mode;
        if (mode !== parameters.mode.LOCAL_OFFLINE)
            return {
                nextAction: "passOnRequest",
                interceptResponse: false,
            };
        const isMagiRecoProd = (url === null || url === void 0 ? void 0 : url.href.match(this.magirecoProdUrlRegEx)) != null;
        const isMagiRecoPatch = (url === null || url === void 0 ? void 0 : url.href.match(this.magirecoPatchUrlRegEx)) != null;
        if (!isMagiRecoProd && !isMagiRecoPatch)
            return {
                nextAction: "passOnRequest",
                interceptResponse: false,
            };
        const isApi = url.pathname.match(this.apiPathNameRegEx) != null;
        if (isApi) {
            //TODO
        }
        else {
            let statusCode;
            let contentType = this.crawler.getContentType(url.pathname);
            let body;
            try {
                body = this.crawler.readFile(url.pathname);
            }
            catch (e) {
                console.error(`error serving [${url.pathname}]`, e);
                contentType = staticResCrawler.crawler.defMimeType;
                body = undefined;
            }
            if (body == null) {
                statusCode = 404;
                body = Buffer.from(new ArrayBuffer(0));
                if (!this.crawler.isKnown404(url.pathname))
                    console.error(`responding 404 [${url.pathname}]`);
            }
            else {
                statusCode = 200;
            }
            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            };
            if (parameters.params.VERBOSE)
                console.log(`serving static ${url.pathname}${url.search} (ignored query part)`);
            return {
                nextAction: "fakeResponse",
                fakeResponse: {
                    statusCode: statusCode,
                    statusMessage: "OK",
                    headers: headers,
                    body: body,
                },
                interceptResponse: false,
            };
        }
        return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        };
    }
    onMatchedRequest(method, url, httpVersion, headers, body) {
        return {
            nextAction: "passOnRequestBody",
            interceptResponse: false,
        };
    }
    onMatchedResponse(statusCode, statusMessage, httpVersion, headers, body) {
    }
}
exports.fakeMagirecoProdRespHook = fakeMagirecoProdRespHook;
