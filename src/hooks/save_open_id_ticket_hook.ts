import * as http from "http";
import * as http2 from "http2";
import * as parameters from "../parameters";
import { saveResponseBodyHook } from "./save_response_body_hook";

export class saveOpenIdTicketHook extends saveResponseBodyHook {
    constructor(params: parameters.params) {
        const urlRegEx = /^(http|https):\/\/l\d+-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/magica\/api\/system\/game\/login((|\?.*)$)/;
        const paramKey = "openIdTicket";
        super(params, urlRegEx, paramKey);
    }

    onMatchedResponse(
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: Buffer | string
    ): void {
        const tag = "saveOpenIdTicket";
        if (typeof body === 'string') {
            try {
                let resp = JSON.parse(body);
                if (resp.resultCode === 'success' && resp.data != null && typeof resp.data.open_id === 'string') {
                    console.log(`${tag} login successful`);
                    this.params.save({ key: this.paramKey, val: resp })
                        .then(() => console.log(`${tag} saved to paramKey=[${this.paramKey}]`));
                } else {
                    console.error(`${tag} login unsuccessful resp.resultCode=[${resp.resultCode}]`);
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