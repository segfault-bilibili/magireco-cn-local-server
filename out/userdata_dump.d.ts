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
export declare type dumpRespEntry = {
    ts?: number;
    body?: any;
    brBody: string;
};
export declare type dump = {
    uid: number;
    timestamp: number;
    isBr: boolean;
    httpResp: {
        get: Map<string, dumpRespEntry>;
        post: Map<string, Map<string, dumpRespEntry>>;
    };
};
export declare const brBase64: (data: any) => string;
export declare const unBrBase64: (brBase64?: string) => any;
export declare const getUnBrBody: (map: Map<string, dumpRespEntry>, key: string) => any;
export declare const guidRegEx: RegExp;
export declare class userdataDmp {
    private readonly params;
    private localServer;
    private get magirecoIDs();
    get lastDump(): dump | undefined;
    private _lastDump?;
    get isDownloading(): boolean;
    private _isDownloading;
    get lastError(): any;
    private _lastError?;
    get fetchStatus(): string;
    private _fetchStatus;
    get isImporting(): boolean;
    private _isImporting;
    get lastImportError(): any;
    private _lastImportError?;
    private get timeStamp();
    private get flag();
    private _flag;
    private clientSessionId;
    private get webSessionId();
    private dateTimeNumberStr;
    private get accessKey();
    private get uid();
    private get uname();
    get isGameLoggedIn(): boolean;
    get userdataDumpFileName(): string;
    private getUserdataDumpFileName;
    readonly userdataDumpFileNameRegEx: RegExp;
    readonly oldInternalUserdataDumpFileName = "lastUserdataDump.br";
    readonly internalUserdataDumpFileName = "lastUserdataDumpBr.json";
    constructor(params: parameters.params, localServer: localServer);
    getDumpAsync(): Promise<dump>;
    private getDumpPromise;
    loadLastDump(): void;
    importDumpAsync(src: Buffer): Promise<void>;
    private getImportDumpPromise;
    private static convertDumpToBrBase64;
    private testLogin;
    private magirecoJsonRequst;
    private gameLogin;
    private get firstRoundUrlList();
    static readonly fakeFriends: string[];
    private getSecondRoundRequests;
    private getThirdRoundRequests;
    private mirrorsSimulateAll;
    private readonly tsRegEx;
    private execHttpGetApi;
    private execHttpPostApi;
    static newRandomID(): magirecoIDs;
}
