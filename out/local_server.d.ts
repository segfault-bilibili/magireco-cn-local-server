import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as parameters from "./parameters";
import { URL } from "url";
export declare enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
    IS_SELF_IP = "IS_SELF_IP"
}
interface hookNextAction {
    nextAction: string;
    interceptResponse: boolean;
}
export interface fakeResponse extends hookNextAction {
    nextAction: "fakeResponse";
    fakeResponse: {
        statusCode: number;
        statusMessage: string;
        headers: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader);
        body?: string | Buffer;
    };
}
export interface passOnRequest extends hookNextAction {
    nextAction: "passOnRequest";
    replaceRequest?: {
        host?: string;
        method?: string;
        path?: string;
    };
}
export interface passOnRequestBody extends hookNextAction {
    nextAction: "passOnRequestBody";
}
export interface hook {
    matchRequest: (method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders) => Promise<fakeResponse | passOnRequest>;
    onMatchedRequest: (method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, body?: string | Buffer) => fakeResponse | passOnRequestBody;
    onMatchedResponse: (statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer) => void;
}
export declare class localServer {
    private readonly params;
    private readonly http2SecureServer;
    private readonly certGen;
    private readonly openSess;
    private readonly pendingSess;
    private readonly hooks;
    constructor(params: parameters.params);
    close(): Promise<void>;
    private checkOfflineMode;
    private static readonly offlineModeHostnameWhiteList;
    addHook(newHook: hook): void;
    private static isHostSelfAsync;
    private static socketRemoteIPAsync;
    getH2SessionAsync(authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean): Promise<http2.ClientHttp2Session>;
    private getH2SessionAsyncPromise;
    static getTlsSocketAsync(params: parameters.params, rejectUnauthorized: boolean, authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean): Promise<tls.TLSSocket>;
    private static httpTunnelAsync;
    private static directConnectAsync;
    private static createTlsSocketAsync;
    private createClientH2SessionAsync;
    sendHttp2RequestAsync(url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody: string | Buffer | undefined, cvtBufToStr: boolean): Promise<{
        headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
        respBody: string | Buffer;
    }>;
    emitHttp2RequestAsync(url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody: string | Buffer | undefined, cvtBufToStr: boolean): Promise<{
        headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
        respBody: string | Buffer;
    }>;
    private handleHttp2Response;
}
export {};
