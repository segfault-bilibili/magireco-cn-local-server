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
    ONLINE = 1,
    LOCAL_OFFLINE = 2
}
export declare type overrides = {
    gameUser?: {
        bgItemId?: string;
        modifyChara?: [number, Record<string, string | number>];
    };
};
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
    readonly overridesDB: Map<number, overrides>;
    static readonly overridesDBPath: string;
    saveOverrideDB(fileContent?: string): void;
    get mode(): mode;
    get autoOpenWeb(): boolean;
    get listenList(): listenList;
    get lastHttpProxy(): listenAddr;
    get httpProxyUsername(): string;
    get httpProxyPassword(): string;
    getClashYaml(host?: string): string;
    get upstreamProxy(): listenAddr;
    get upstreamProxyEnabled(): boolean;
    get upstreamProxyCACert(): string | undefined | null;
    get CACertAndKey(): certGenerator.certAndKey;
    get bsgamesdkIDs(): bsgamesdkPwdAuthenticate.bsgamesdkIDs;
    get magirecoIDs(): userdataDump.magirecoIDs;
    get bsgamesdkResponse(): bsgamesdkPwdAuthenticate.bsgamesdkResponse | undefined;
    get openIdTicket(): userdataDump.openIdTicket | undefined;
    get fetchCharaEnhancementTree(): boolean;
    get arenaSimulate(): boolean;
    get concurrentFetch(): boolean;
    get crawlWebRes(): boolean;
    get crawlAssets(): boolean;
    get concurrentCrawl(): boolean;
    get lastDownloadedFileName(): string;
    set lastDownloadedFileName(fileName: string);
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
