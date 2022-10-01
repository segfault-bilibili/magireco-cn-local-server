import * as http from "http";
import * as http2 from "http2";
import { passOnRequest } from "../local_server";
import * as parameters from "../parameters";
import * as userdataDump from "../userdata_dump";
import { saveResponseBodyHook } from "./save_response_body_hook";

export class saveOpenIdTicketHook extends saveResponseBodyHook {
    constructor(params: parameters.params) {
        const urlRegEx = /^(http|https):\/\/l\d+-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\/magica\/api\/system\/game\/login((|\?.*)$)/;
        const paramKey = "openIdTicket";
        super(params, urlRegEx, paramKey);
    }

    private readonly openIdKeyRegEx = /^User-Id-[0-9a-zA-Z]+$/i;
    private readonly ticketKeyRegEx = /^Ticket$/i;
    private readonly webSessionIdRegEx = /^Webview-Session-Id$/i;
    private readonly webSessionIdValueRegEx = /^\d{14}$/;

    matchRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ): passOnRequest {
        const tag = "saveOpenIdTicketHook";

        const isGameLogin = super.matchRequest(method, url, httpVersion, headers).interceptResponse;
        if (isGameLogin) return {
            nextAction: "passOnRequest",
            interceptResponse: true,
        }

        const magirecoRegEx = /^(http|https):\/\/l\d+-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\//;
        const isMagiReco = url != null && url.href.match(magirecoRegEx) != null;
        if (!isMagiReco) return {
            nextAction: "passOnRequest",
            interceptResponse: isGameLogin,
        }

        if (headers == null) return {
            nextAction: "passOnRequest",
            interceptResponse: isGameLogin,
        }
        let open_id: string | undefined, ticket: string | undefined, webSessionId: string | undefined, timestamp: number | undefined;
        for (let key in headers) {
            let val = headers[key];
            if (typeof val !== 'string' || val === "") continue;
            if (key.match(this.openIdKeyRegEx)) open_id = val;
            if (key.match(this.ticketKeyRegEx)) ticket = val;
            if (key.match(this.webSessionIdRegEx)) webSessionId = val;
            if (open_id != null && ticket != null) break;
        }
        if (open_id == null || ticket == null) {
            return {
                nextAction: "passOnRequest",
                interceptResponse: isGameLogin,
            }
        }

        //console.log(`${tag} got open_id and ticket from request`);//DEBUG
        let last = this.params.openIdTicket;
        if (
            last != null
            && last.open_id === open_id
            && last.ticket === ticket
        ) {
            return {
                nextAction: "passOnRequest",
                interceptResponse: isGameLogin, //no need to update
            }
        }

        console.log(`${tag} got open_id and ticket from request`);
        if (webSessionId != null && webSessionId.match(this.webSessionIdValueRegEx)) try {
            let year = Number(webSessionId.substring(0, 4));
            let month = Number(webSessionId.substring(4, 6)) - 1;
            let date = Number(webSessionId.substring(6, 8));
            let hour = Number(webSessionId.substring(8, 10));
            let minute = Number(webSessionId.substring(10, 12));
            let second = Number(webSessionId.substring(12, 14));
            let d = new Date();
            d.setFullYear(year);
            d.setMonth(month);
            d.setDate(date);
            d.setHours(hour);
            d.setMinutes(minute);
            d.setSeconds(second);
            timestamp = d.getTime();
        } catch (e) {}
        let val: userdataDump.openIdTicket = { open_id: open_id, ticket: ticket };
        if (timestamp != null && !isNaN(timestamp)) val.timestamp = timestamp;
        this.params.save({ key: this.paramKey, val: val })
            .then(() => console.log(`${tag} saved to paramKey=[${this.paramKey}]`));
        return {
            nextAction: "passOnRequest",
            interceptResponse: false, // no need to capture request/response body
        }
    }

    onMatchedResponse(
        statusCode?: number,
        statusMessage?: string,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader),
        body?: Buffer | string
    ): void {
        const tag = "saveOpenIdTicketHook";

        // save ticket
        let ticket: string | undefined;
        if (headers != null) {
            for (let key in headers) {
                let val = headers[key];
                if (typeof val !== 'string' || val === "") continue;
                if (key.match(this.ticketKeyRegEx)) ticket = val;
                if (ticket != null) break;
            }
        }
        if (ticket == null) {
            console.error(`${tag} ticket == null`);
            return;
        }

        // save open_id
        if (typeof body === 'string') {
            try {
                let resp = JSON.parse(body);
                if (resp == null) {
                    console.error(`${tag} response body is null`);
                    return;
                }
                if (resp.resultCode !== 'success') {
                    console.error(`${tag} login unsuccessful resp.resultCode=[${resp.resultCode}]`);
                    return;
                }
                if (
                    typeof resp.data.open_id !== 'string'
                    || resp.data.open_id === ""
                ) {
                    console.error(`${tag} open_id is empty`);
                    return;
                }

                console.log(`${tag} login successful`);
                resp.data["ticket"] = ticket;
                this.params.save({ key: this.paramKey, val: resp.data })
                    .then(() => console.log(`${tag} saved to paramKey=[${this.paramKey}]`));
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