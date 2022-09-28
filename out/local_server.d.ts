/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as parameters from "./parameters";
import { URL } from "url";
export declare enum constants {
    DOWNGRADE_TO_HTTP1 = "DOWNGRADE_TO_HTTP1",
    IS_SELF_IP = "IS_SELF_IP"
}
export interface hook {
    matchRequest: (method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders) => boolean;
    onMatchedRequest: (method?: string, url?: URL, httpVersion?: string, headers?: http.IncomingHttpHeaders | http2.IncomingHttpHeaders, body?: string | Buffer) => void;
    onMatchedResponse: (statusCode?: number, statusMessage?: string, httpVersion?: string, headers?: http.IncomingHttpHeaders | (http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader), body?: string | Buffer) => void;
}
export declare class localServer {
    private readonly params;
    private readonly http2SecureServer;
    private readonly http1TlsServer;
    private readonly certGen;
    private readonly openSess;
    private readonly pendingSess;
    private readonly hooks;
    constructor(params: parameters.params);
    close(): Promise<void>;
    private static isHostSelfAsync;
    private static socketRemoteIPAsync;
    getH2SessionAsync(authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean): Promise<http2.ClientHttp2Session>;
    private getH2SessionAsyncPromise;
    static getTlsSocketAsync(params: parameters.params, rejectUnauthorized: boolean, authorityURL: URL, alpn?: string | null | boolean, sni?: string | null | boolean): Promise<tls.TLSSocket>;
    private static httpTunnelAsync;
    private static directConnectAsync;
    private static createTlsSocketAsync;
    private createClientH2SessionAsync;
    http2RequestAsync(url: URL, reqHeaders: http2.OutgoingHttpHeaders, reqBody?: string | Buffer): Promise<{
        headers: http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;
        respBody: string | Buffer;
    }>;
    static compress(data: Buffer, encoding?: string): Buffer;
    static decompress(data: Buffer, encoding?: string): Buffer;
}
