import * as http from "http";
import * as http2 from "http2";
import * as parameters from "../parameters";
import { saveResponseBodyHook } from "./save_response_body_hook";

export class saveAccessKeyHook extends saveResponseBodyHook {
    constructor(params: parameters.params) {
        const urlRegEx = /^(http|https):\/\/line1-sdk-center-login-sh\.biligame\.net\/api\/external\/(login|user\.token\.oauth\.login)\/v3((|\?.*)$)/;
        const paramKey = "bsgamesdkResponse";
        super(params, urlRegEx, paramKey);
    }

    onMatchedResponse(
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: Buffer | string
    ): void {
        const tag = "saveAccessKeyHook";
        if (typeof body === 'string') {
            try {
                let resp = JSON.parse(body);
                if (resp.code == 0 && resp.access_key != null) {
                    console.log(`${tag} login successful`);
                    this.params.save({ key: this.paramKey, val: resp })
                        .then(() => console.log(`${tag} saved to paramKey=[${this.paramKey}]`));
                } else {
                    console.error(`${tag} login unsuccessful resp.code=[${resp.code}]`
                    +` resp.access_key=${resp.access_key}`);
                }
            } catch (e) {
                console.error(`${tag} error parsing resp`, e);
            }
        } else if (body == null) {
            console.error(`${tag} nothing to save`);
        } else {
            console.error(`${tag} cannot save binary data`);
        }
    }
}