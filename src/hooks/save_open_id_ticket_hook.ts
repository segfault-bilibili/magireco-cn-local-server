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

    private readonly openIdKeyRegEx = /^User-Id-[0-9a-zA-Z]+$/i;
    private readonly ticketKeyRegEx = /^Ticket$/i;

    matchRequest(
        method?: string,
        url?: URL,
        httpVersion?: string,
        headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders
    ): boolean {
        const tag = "saveOpenIdTicketHook";

        const isGameLogin = super.matchRequest(method, url, httpVersion, headers);
        if (isGameLogin) return true;

        const magirecoRegEx = /^(http|https):\/\/l\d+-[0-9a-z\-]+-mfsn\d*\.bilibiligame\.net\//;
        const isMagiReco = url != null && url.href.match(magirecoRegEx);
        if (!isMagiReco) return isGameLogin;

        if (headers == null) return isGameLogin;
        let open_id: string | undefined, ticket: string | undefined;
        for (let key in headers) {
            let val = headers[key];
            if (typeof val !== 'string' || val === "") continue;
            if (key.match(this.openIdKeyRegEx)) open_id = val;
            if (key.match(this.ticketKeyRegEx)) ticket = val;
            if (open_id != null && ticket != null) break;
        }
        if (open_id == null || ticket == null) {
            return isGameLogin;
        }

        //console.log(`${tag} got open_id and ticket from request`);//DEBUG
        let last = this.params.openIdTicket;
        if (
            last != null
            && last.open_id === open_id
            && last.ticket === ticket
        ) {
            return isGameLogin;//no need to update
        }

        console.log(`${tag} got open_id and ticket from request`);
        this.params.save({ key: this.paramKey, val: { open_id: open_id, ticket: ticket } })
            .then(() => console.log(`${tag} saved to paramKey=[${this.paramKey}]`));
        return false; // no need to capture request/response body
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