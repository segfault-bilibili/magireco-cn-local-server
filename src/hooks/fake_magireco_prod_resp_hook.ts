import * as http from "http";
import * as http2 from "http2";
import * as crypto from "crypto";
import { fakeResponse, hook, localServer, passOnRequest, passOnRequestBody } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";

export class fakeMagirecoProdRespHook implements hook {
    private readonly params: parameters.params;
    private readonly crawler: staticResCrawler.crawler;

    private readonly magirecoProdUrlRegEx: RegExp;
    private readonly magirecoPatchUrlRegEx: RegExp;
    private readonly apiPathNameRegEx: RegExp;

    constructor(params: parameters.params, crawler: staticResCrawler.crawler) {
        this.params = params;
        this.crawler = crawler;

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
            //TODO
        } else {
            let statusCode: number;
            let contentType = this.crawler.getContentType(url.pathname);
            let contentEncoding: string | undefined;
            let body: Buffer | undefined;
            try {
                body = this.crawler.readFile(url.pathname);
            } catch (e) {
                console.error(`error serving [${url.pathname}]`, e);
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
                if (!this.crawler.isKnown404(url.pathname)) console.error(`responding 404 [${url.pathname}]`);
            } else {
                statusCode = 200;
            }
            const headers = {
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: contentType,
            }
            if (contentEncoding != null) {
                headers[http2.constants.HTTP2_HEADER_CONTENT_ENCODING] = contentEncoding;
            }
            if (parameters.params.VERBOSE) console.log(`serving static ${url.pathname}${url.search} (ignored query part)`);
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

        return {
            nextAction: "passOnRequest",
            interceptResponse: false,
        }
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
        return `<?xml version="1.0" encoding="UTF-8"?>`
            + `\n<Error>`
            + `\n  <Code>NoSuchKey</Code>`
            + `\n  <Message>The specified key does not exist.</Message>`
            + `\n  <RequestId>${crypto.randomBytes(12).toString('hex').toUpperCase()}</RequestId>`
            + `\n  <HostId>${host}</HostId>`
            + `\n  <Key>${key}</Key>`
            + `\n</Error>`
            + `\n`;
    }

}