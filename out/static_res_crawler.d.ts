/// <reference types="node" />
import { localServer } from "./local_server";
import * as parameters from "./parameters";
export declare class crawler {
    private readonly params;
    private readonly localServer;
    readonly isWebResCompleted: boolean;
    readonly isAssetsCompleted: boolean;
    private static readonly htmlRegEx;
    private static readonly javaScriptRegEx;
    private static readonly jsonRegEx;
    private static readonly md5RegEx;
    private readonly device_id;
    private get timeStampSec();
    static readonly defMimeType = "application/octet-stream";
    private readonly staticFileMap;
    private readonly staticFile404Set;
    private readonly localRootDir;
    private readonly localConflictDir;
    private static readonly staticFileMapPath;
    private static readonly staticFile404SetPath;
    private static readonly prodHost;
    private get httpsProdMagicaNoSlash();
    private static readonly patchHost;
    private get httpsPatchMagicaNoSlash();
    stopCrawling: boolean;
    get isCrawling(): boolean;
    private _isCrawling;
    get lastError(): any;
    private _lastError?;
    get crawlingStatus(): string;
    private _crawlingStatus;
    get isCrawlingFullyCompleted(): boolean;
    private isCrawlingCompleted;
    constructor(params: parameters.params, localServer: localServer);
    fetchAllAsync(): Promise<void>;
    getFetchAllPromise(): Promise<void>;
    getContentType(pathInUrl: string): string;
    readFile(pathInUrl: string, specifiedMd5?: string): Buffer | undefined;
    saveFile(pathInUrl: string, content: Buffer, contentType: string | undefined, preCalcMd5?: string): void;
    private checkAlreadyExist;
    private updateFileMeta;
    private http2Request;
    private http2GetStr;
    private http2GetBuf;
    private http2PostRetStr;
    private http2PostRetBuf;
    private batchHttp2GetSave;
    private fetchSinglePage;
    private fetchFilesInReplacementJs;
    private static readonly assetListFileNameList;
    private readAssetVer;
    private fetchAssetConfig;
    private fetchAssets;
}
