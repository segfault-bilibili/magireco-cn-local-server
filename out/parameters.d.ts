import * as certGenerator from "./cert_generator";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import * as userdataDump from "./userdata_dump";
export declare type listenAddr = {
    port: number;
    host: string;
};
export declare type listenList = Record<string, listenAddr> & {
    controlInterface: listenAddr;
    httpProxy: listenAddr;
    localServer: listenAddr;
    localHttp1Server: listenAddr;
};
export declare enum mode {
    ACCOUNT_DUMP = 1,
    TAP_PROXY = 2,
    LOCAL_OFFLINE = 3
}
export declare class params {
    static VERBOSE: boolean;
    static readonly defaultPath: string;
    private path;
    private mapData;
    private lastSaved;
    private unfinishedSave;
    static load(path?: string): Promise<params>;
    private static import;
    stringify(): string;
    save(param?: {
        key: string;
        val: any;
    } | Array<{
        key: string;
        val: any;
    }> | string, path?: string): Promise<void>;
    checkModified(): boolean;
    get mode(): mode;
    get autoOpenWeb(): boolean;
    get listenList(): listenList;
    get clashYaml(): string;
    get upstreamProxy(): listenAddr;
    get upstreamProxyEnabled(): boolean;
    get upstreamProxyCACert(): string | undefined | null;
    get CACertAndKey(): certGenerator.certAndKey;
    get bsgamesdkIDs(): bsgamesdkPwdAuthenticate.bsgamesdkIDs;
    get magirecoIDs(): userdataDump.magirecoIDs;
    get bsgamesdkResponse(): bsgamesdkPwdAuthenticate.bsgamesdkResponse | undefined;
    get openIdTicket(): userdataDump.openIdTicket | undefined;
    get fetchCharaEnhancementTree(): boolean;
    get concurrentFetch(): boolean;
    get CACertPEM(): string;
    get CACertSubjectHashOld(): string;
    readonly CACerts: Array<string>;
    private readonly supportH2Map;
    private supportH2Expire;
    private supportH2MaxSize;
    private constructor();
    private refreshCACert;
    private static prepare;
    private cleanupSupportH2;
    getSupportH2(url: URL): boolean | undefined;
    setSupportH2(url: URL, supportH2: boolean | null): void;
    private static avoidUsedPorts;
}
export declare function replacer(key: any, value: any): any;
export declare function reviver(key: any, value: any): any;
export declare function resolveToIP(hostname: string): Promise<string>;
