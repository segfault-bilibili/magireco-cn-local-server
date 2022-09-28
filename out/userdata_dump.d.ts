/// <reference types="node" />
import * as parameters from "./parameters";
import { localServer } from "./local_server";
export declare type magirecoIDs = {
    device_id: string;
};
export declare type openIdTicket = {
    open_id: string;
    ticket: string;
    uname?: string;
    timestamp?: number;
};
declare type snapshotRespEntry = {
    ts?: number;
    body: any;
};
export declare type snapshot = {
    uid: number;
    timestamp: number;
    httpResp: {
        get: Map<string, snapshotRespEntry>;
        post: Map<string, Map<string, snapshotRespEntry>>;
    };
};
export declare const guidRegEx: RegExp;
export declare class userdataDmp {
    private readonly params;
    private localServer;
    private get magirecoIDs();
    get lastSnapshot(): snapshot | undefined;
    get lastSnapshotBr(): Buffer | undefined;
    get lastSnapshotGzip(): Buffer | undefined;
    private _lastSnapshot?;
    private _lastSnapshotBr?;
    private _lastSnapshotGzip?;
    get isDownloading(): boolean;
    private _isDownloading;
    get lastError(): any;
    private _lastError?;
    get fetchStatus(): string;
    private _fetchStatus;
    private get timeStamp();
    private get flag();
    private _flag;
    private clientSessionId;
    private get webSessionId();
    private get accessKey();
    private get uid();
    private get uname();
    get isGameLoggedIn(): boolean;
    get userdataDumpFileName(): string;
    readonly userdataDumpFileNameRegEx: RegExp;
    constructor(params: parameters.params, localServer: localServer);
    getSnapshotAsync(): Promise<snapshot>;
    private getSnapshotPromise;
    private testLogin;
    private magirecoJsonRequst;
    private gameLogin;
    private get firstRoundUrlList();
    private getSecondRoundRequests;
    private getThirdRoundRequests;
    private readonly tsRegEx;
    private execHttpGetApi;
    private execHttpPostApi;
    static newRandomID(): magirecoIDs;
}
export {};
