"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jpResHook = void 0;
const crypto = require("crypto");
const parameters = require("../parameters");
const tag = "Resource";
const log = (...msg) => console.log(`[${tag}]`, ...msg);
const warn = (...msg) => console.warn(`[${tag}]`, ...msg);
const error = (...msg) => console.error(`[${tag}]`, ...msg);
class jpResHook {
    constructor(params, crawler) {
        this.jpDomain = 'android.magi-reco.com';
        this.apiPath = '/magica/api';
        this.params = params;
        this.crawler = crawler;
    }
    async onMatchRequestHeaders(ctx) {
        var _a;
        if (!((_a = ctx.host) === null || _a === void 0 ? void 0 : _a.startsWith(this.jpDomain)))
            return false;
        const path = ctx.path;
        if (path === null || path === void 0 ? void 0 : path.startsWith(this.apiPath))
            return false;
        log(`Request Headers ${ctx.method} origPath=[${ctx.origPath}]`);
        const url = new URL(`https://${this.jpDomain}${path}`);
        if (ctx.method === 'GET') {
            return await this.fakeResp(ctx, url);
        }
        return true;
    }
    async matchRequest(method, url, httpVersion, headers) {
        return {
            nextAction: "passOnRequest"
        };
    }
    onMatchedRequest(method, url, httpVersion, headers, body) {
    }
    async fakeResp(ctx, url) {
        const pathInUrl = url.pathname;
        let body = await this.crawler.readFileAsync('jp', pathInUrl);
        if (body != null) {
            let outHdr = Object.create(null);
            let inHdr = ctx.reqHeaders;
            let md5 = crypto.createHash('md5').update(body).digest().toString('hex');
            outHdr.etag = `W/"${md5}"`;
            outHdr["content-type"] = this.crawler.getContentType(pathInUrl.replace(/\.gz$/, ""));
            outHdr["content-length"] = `${body.byteLength}`;
            outHdr["cache-control"] = `max-age=31536000`;
            if (pathInUrl.match(/\.gz$/))
                outHdr["content-encoding"] = `gzip`;
            const ifNoneMatch = inHdr === null || inHdr === void 0 ? void 0 : inHdr["if-none-match"];
            if (ifNoneMatch == null || !ifNoneMatch.match(/^"[0-9a-z]{32}"$/)) {
                ctx.statusCode = 200;
                ctx.respHeaders = outHdr;
                ctx.respBody = body;
            }
            else if (ifNoneMatch === `"${md5}"`) {
                ctx.statusCode = 304;
                ctx.respHeaders = outHdr;
            }
            else {
                warn(`[${pathInUrl}] md5 mismatch!`);
                if (this.params.mode !== parameters.mode.LOCAL_OFFLINE)
                    return true;
            }
            ctx.fakeResp = true;
            log(`faked resp [${pathInUrl}]`);
            return false;
        }
        return true;
    }
    async onMatchRequestBody(ctx) {
        var _a;
        log(`Request Body ${ctx.method} origPath = [${ctx.origPath}] origReqBody.byteLength = [${(_a = ctx.origReqBody) === null || _a === void 0 ? void 0 : _a.byteLength}]`);
        return true;
    }
    async onMatchResponseHeaders(ctx) {
        log(`Response Headers ${ctx.method} origPath = [${ctx.origPath}] origStatusCode = [${ctx.origStatusCode}]`);
        return true;
    }
    async onMatchResponseBody(ctx) {
        var _a;
        log(`Response Body ${ctx.method} origPath = [${ctx.origPath}] origStatusCode = [${ctx.origStatusCode}] origRespBody.byteLength = [${(_a = ctx.origRespBody) === null || _a === void 0 ? void 0 : _a.byteLength}]`);
        /*
        if (ctx.method !== 'GET') return;
        if (ctx.statusCode != 200) return;

        const url = new URL(`https://${this.jpDomain}${ctx.origPath}`);
const pathInUrl = url.pathname;

const respHeaders = ctx.respHeaders;
const contentEncoding = respHeaders?.["content-encoding"];
let body = ctx.origRespBody;
if (body == null) return;

if (contentEncoding != null) switch (contentEncoding) {
    case 'gzip': {
        if (!pathInUrl.endsWith('gz')) body = zlib.gunzipSync(body);
        break;
    }
    case 'deflate': {
        body = zlib.inflateSync(body);
        break;
    }
    case 'br': {
        body = zlib.brotliDecompressSync(body);
        break;
    }
    default: error(`[${pathInUrl}] has unknown content-encoding [${contentEncoding}]`);
}

if (body.byteLength == index404.byteLength && Buffer.compare(body, index404) == 0) {
    log(`[${pathInUrl}] is fake index404`);
    return;
}

if (respHeaders?.["content-type"]?.startsWith('text/html')) {
    if (body.byteLength <= 16384 && !body.toString('utf-8').match(/<body aria-hidden="true">/)) {
        log(`[${pathInUrl}] is NEWER fake index404`);
        return;
    }
}

let existing = await this.crawler.readFileAsync('jp', pathInUrl);
if (existing != null && body.byteLength == existing.byteLength && Buffer.compare(body, existing) == 0) return;

warn(`onMatchResponseHeaders [${pathInUrl}] looks new/different!`);
await this.crawler.saveFileAsync('jp', pathInUrl, body);
        */
    }
}
exports.jpResHook = jpResHook;
