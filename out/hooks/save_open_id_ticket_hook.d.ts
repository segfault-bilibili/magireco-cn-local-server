/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import * as http from "http";
import * as http2 from "http2";
import * as parameters from "../parameters";
import { saveResponseBodyHook } from "./save_response_body_hook";
export declare class saveOpenIdTicketHook extends saveResponseBodyHook {
    constructor(params: parameters.params);
    private readonly openIdKeyRegEx;
    private readonly ticketKeyRegEx;
    private readonly webSessionIdRegEx;
    private readonly webSessionIdValueRegEx;
    matchRequest(method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders): boolean;
    onMatchedResponse(statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: Buffer | string): void;
}
