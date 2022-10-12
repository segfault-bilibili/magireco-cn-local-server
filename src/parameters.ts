import { portFinder } from "./port_finder";
import * as certGenerator from "./cert_generator";
import * as net from "net";
import * as dns from "dns";
import * as tls from "tls";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";
import * as userdataDump from "./userdata_dump";
import * as path from "path";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as http from "http";
import { getRandomHex } from "./get_random_bytes";

export type listenAddr = {
    port: number,
    host: string,
}

export type listenList = Record<string, listenAddr> & {
    controlInterface: listenAddr,
    httpProxy: listenAddr,
    localServer: listenAddr,
}

export enum mode {
    ONLINE = 1,
    LOCAL_OFFLINE = 2,
}

const persistParams: {
    mode: mode,
    autoOpenWeb: boolean,
    listenList: listenList,
    lastHttpProxy: listenAddr,
    httpProxyUsername: string,
    httpProxyPassword?: string,
    upstreamProxy: listenAddr,
    upstreamProxyEnabled: boolean,
    upstreamProxyCACert?: string,
    CACertAndKey?: certGenerator.certAndKey,
    bsgamesdkIDs?: bsgamesdkPwdAuthenticate.bsgamesdkIDs,
    bsgamesdkResponse?: bsgamesdkPwdAuthenticate.bsgamesdkResponse,
    openIdTicket?: userdataDump.openIdTicket,
    magirecoIDs?: userdataDump.magirecoIDs,
    fetchCharaEnhancementTree: boolean,
    arenaSimulate: boolean,
    concurrentFetch: boolean,
    crawlWebRes: boolean,
    crawlAssets: boolean,
    concurrentCrawl: boolean,
    lastDownloadedFileName?: string,
} = {
    mode: mode.ONLINE,
    autoOpenWeb: true,
    listenList: {
        controlInterface: { port: 10000, host: "127.0.0.1" },
        httpProxy: { port: 10001, host: "127.0.0.1" },
        localServer: { port: 10002, host: "127.0.0.1" },
    },
    lastHttpProxy: { port: 10001, host: "0.0.0.0" },
    httpProxyUsername: "mgrc",
    httpProxyPassword: undefined,
    upstreamProxy: {
        //HTTP
        host: "127.0.0.1",
        port: 8080,
    } as listenAddr,
    upstreamProxyEnabled: false,
    upstreamProxyCACert: undefined,
    CACertAndKey: undefined,
    bsgamesdkIDs: undefined,
    bsgamesdkResponse: undefined,
    openIdTicket: undefined,
    magirecoIDs: undefined,
    fetchCharaEnhancementTree: false,
    arenaSimulate: true,
    concurrentFetch: true,
    crawlWebRes: true,
    crawlAssets: true,
    concurrentCrawl: true,
    lastDownloadedFileName: undefined,
}

export type overrides = {
    gameUser?: {
        bgItemId?: string,
        modifyChara?: [number, Record<string, string | number>],
    }
}

export class params {
    static VERBOSE = false;

    static readonly isAliveReqMarker = "2f53b99c5bc307e9e4005ea1087eeca0";
    static readonly isAliveRespMarker = "614cb4bf76a743055e924a0a3073f850";

    static readonly defaultPath = path.join(".", "params.json");
    private path: string;
    private mapData: Map<string, any>;
    private lastSaved: string;
    private unfinishedSave: Array<Promise<void>>;
    static async load(path?: string): Promise<params> {
        if (path == null) path = this.defaultPath;
        let fileContent: string | null;
        if (!fs.existsSync(path)) fileContent = null;
        else try {
            if ((await fsPromises.stat(path)).isFile())
                fileContent = fs.readFileSync(path, { encoding: "utf8" });
            else fileContent = null;
        } catch (e) {
            console.error(e);
            fileContent = null;
        }
        return await this.import(fileContent, path);
    }
    private static async import(fileContent: string | null, path: string): Promise<params> {
        //path will be used when save() is called without argument
        //WILL NOT WRITE FILE HERE
        let importedMapData: Map<string, any>;
        if (fileContent == null) {
            console.log("Creating empty params.json");
            importedMapData = new Map<string, any>();
            fileContent = "";
        } else try {
            let parsed = JSON.parse(fileContent, reviver);
            if (parsed instanceof Map) importedMapData = parsed;
            else throw new Error("not a Map");
        } catch (e) {
            console.log("Error reading params.json, creating empty one");
            importedMapData = new Map<string, any>();
        }
        let preparedMapData = await this.prepare(importedMapData, false);
        return new params(preparedMapData, fileContent, path);
    }
    stringify(): string {
        return JSON.stringify(this.mapData, replacer);
    }
    save(param?: { key: string, val: any } | Array<{ key: string, val: any }> | string, path?: string): Promise<void> {
        let lastPromise = this.unfinishedSave.shift();
        let promise = new Promise<void>((resolve, reject) => {
            let doSave = () => {
                let unmodifiedMap = JSON.parse(this.stringify(), reviver);
                let modified = false;
                if (param != null) {
                    if (Array.isArray(param)) {
                        param.forEach((p) => unmodifiedMap.set(p.key, p.val));
                        modified = true;
                    } else if (typeof param !== 'string') {
                        unmodifiedMap.set(param.key, param.val);
                        if (param.key === "upstreamProxyCACert") this.refreshCACert();
                        modified = true;
                    } else try {
                        let parsed = JSON.parse(param, reviver);
                        if (!(parsed instanceof Map)) throw new Error("not a Map");
                        unmodifiedMap.clear();
                        parsed.forEach((val, key) => unmodifiedMap.set(key, val));
                        modified = true;
                    } catch (e) {
                        console.error(`cannot save whole params.json from string`, e);
                    }
                }
                // may be modified, but still not taking effect now
                params.prepare(unmodifiedMap, true).then((preparedMapData) => {
                    try {
                        let fileContent = JSON.stringify(preparedMapData, replacer);
                        if (path == null) path = this.path;
                        fs.writeFileSync(path, fileContent, { encoding: "utf-8" });
                        this.lastSaved = fileContent;
                        this.mapData.clear();
                        preparedMapData.forEach((val, key) => this.mapData.set(key, val));
                        // saved and taking effect now
                        console.log("saved params.json");
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            }
            if (lastPromise != null) lastPromise.then(() => doSave());
            else doSave();
        });
        this.unfinishedSave.push(promise);
        return promise;
    }
    checkModified(): boolean {
        return this.stringify() !== this.lastSaved;
    }

    readonly overridesDB: Map<number, overrides>;
    static readonly overridesDBPath = path.join(".", "overrides.json");
    saveOverrideDB(fileContent?: string): void {
        if (fileContent != null) {
            try {
                let parsed = JSON.parse(fileContent, reviver);
                if (!(parsed instanceof Map)) throw new Error(`parsed fileContent is not map`);
                this.overridesDB.clear();
                parsed.forEach((val, key) => this.overridesDB.set(key, val));
            } catch (e) {
                console.error(`saveOverrideDB error`, e);
                throw e;
            }
        }
        try {
            fs.writeFileSync(params.overridesDBPath,
                JSON.stringify(this.overridesDB, replacer), 'utf-8');
        } catch (e) {
            console.error(`error writting to ${params.overridesDBPath}`, e);
        }
    }

    get mode(): mode { return this.mapData.get("mode"); }
    get autoOpenWeb(): boolean { return this.mapData.get("autoOpenWeb"); }
    get listenList(): listenList { return this.mapData.get("listenList"); }
    get lastHttpProxy(): listenAddr { return this.mapData.get("lastHttpProxy"); }
    get httpProxyUsername(): string { return this.mapData.get("httpProxyUsername"); }
    get httpProxyPassword(): string { return this.mapData.get("httpProxyPassword"); }
    getClashYaml(host?: string): string {
        if (host == null) host = this.listenList.httpProxy.host;
        const port = this.listenList.httpProxy.port;
        const username = this.httpProxyUsername;
        const password = this.httpProxyPassword;
        return `mode: global`
            + `\n`
            + `\nproxies:`
            + `\n - name: "magirecolocal${port}"`
            + `\n   type: http`
            + `\n   server: ${host}`
            + `\n   port: ${port}`
            + `\n   username: "${username}"`
            + `\n   password: "${password}"`
    }
    get upstreamProxy(): listenAddr { return this.mapData.get("upstreamProxy"); }
    get upstreamProxyEnabled(): boolean { return this.mapData.get("upstreamProxyEnabled"); }
    get upstreamProxyCACert(): string | undefined | null { return this.mapData.get("upstreamProxyCACert"); }
    get CACertAndKey(): certGenerator.certAndKey { return this.mapData.get("CACertAndKey"); }
    get bsgamesdkIDs(): bsgamesdkPwdAuthenticate.bsgamesdkIDs { return this.mapData.get("bsgamesdkIDs"); }
    get magirecoIDs(): userdataDump.magirecoIDs { return this.mapData.get("magirecoIDs"); }

    get bsgamesdkResponse(): bsgamesdkPwdAuthenticate.bsgamesdkResponse | undefined { return this.mapData.get("bsgamesdkResponse"); }
    get openIdTicket(): userdataDump.openIdTicket | undefined { return this.mapData.get("openIdTicket"); }

    get fetchCharaEnhancementTree(): boolean { return this.mapData.get("fetchCharaEnhancementTree"); }
    get arenaSimulate(): boolean { return this.mapData.get("arenaSimulate"); }
    get concurrentFetch(): boolean { return this.mapData.get("concurrentFetch"); }

    get crawlWebRes(): boolean { return this.mapData.get("crawlWebRes"); }
    get crawlAssets(): boolean { return this.mapData.get("crawlAssets"); }
    get concurrentCrawl(): boolean { return this.mapData.get("concurrentCrawl"); }

    get lastDownloadedFileName(): string { return this.mapData.get("lastDownloadedFileName"); }
    set lastDownloadedFileName(fileName: string) { this.mapData.set("lastDownloadedFileName", fileName); }

    get CACertPEM(): string { return this.CACertAndKey.cert; }
    get CACertSubjectHashOld(): string { return "9489bdaf"; }//FIXME
    readonly CACerts: Array<string>;
    private readonly supportH2Map: Map<string, { h2: boolean, time: number }>;
    private supportH2Expire = 3600 * 1000;
    private supportH2MaxSize = 1024;

    private constructor(mapData: Map<string, any>, lastSaved: string, filePath: string) {
        this.mapData = mapData;
        const CACerts = tls.rootCertificates.slice();
        CACerts.push(this.CACertPEM);
        const upstreamProxyCACert = this.upstreamProxyCACert;
        if (upstreamProxyCACert != null) {
            CACerts.unshift(upstreamProxyCACert);
            console.log("added upstreamProxyCACert to CACerts");
        }
        this.CACerts = CACerts;
        this.supportH2Map = new Map<string, { h2: boolean, time: number }>();
        this.lastSaved = lastSaved;
        this.unfinishedSave = [];
        this.path = filePath;

        let overridesDB: Map<number, overrides> | undefined;
        if (fs.existsSync(params.overridesDBPath) && fs.statSync(params.overridesDBPath).isFile()) {
            try {
                let content = fs.readFileSync(params.overridesDBPath, 'utf-8');
                overridesDB = JSON.parse(content, reviver);
                if (!(overridesDB instanceof Map)) throw new Error("not instance of map");
            } catch (e) {
                console.error(`error loading from ${params.overridesDBPath}, creating new one`, e);
            }
        }
        if (overridesDB == null) overridesDB = new Map<number, overrides>();
        this.overridesDB = overridesDB;
    }
    private refreshCACert(): void {
        const CACerts = tls.rootCertificates.slice();
        CACerts.push(this.CACertPEM);
        const upstreamProxyCACert = this.upstreamProxyCACert;
        if (upstreamProxyCACert != null) {
            CACerts.unshift(upstreamProxyCACert);
            console.log("added upstreamProxyCACert to CACerts");
        }
        while (this.CACerts.length > 0) this.CACerts.pop();
        CACerts.forEach((cert) => this.CACerts.push(cert));
    }
    private static async prepare(oldMapData: Map<string, any>, isSaving: boolean): Promise<Map<string, any>> {
        let newMapData = new Map<string, any>();
        for (let key in persistParams) {
            let defaultVal = (persistParams as any)[key];
            let val: any = oldMapData.get(key);
            if (val == null) val = defaultVal;
            switch (key) {
                case "listenList":
                    if (!isSaving) val = await params.avoidUsedPorts(val);
                    break;
                case "httpProxyUsername":
                    val = "mgrc";
                    break;
                case "httpProxyPassword":
                    if (val == null) val = getRandomHex(32);
                    break;
                case "CACertAndKey":
                    if (val == null || val.cert == null || val.key == null)
                        val = certGenerator.certGen.newCertAndKey(true);
                    break;
                case "bsgamesdkIDs":
                    if (val == null || val.buvid == null || val.udid == null || val.bd_id == null)
                        val = bsgamesdkPwdAuthenticate.bsgamesdkPwdAuth.newRandomID();
                    break;
                case "magirecoIDs":
                    if (val == null || val.device_id == null)
                        val = userdataDump.userdataDmp.newRandomID();
                    break;
            }
            newMapData.set(key, val);
        };
        return newMapData;
    }

    private cleanupSupportH2(): void {
        while (this.supportH2Map.size > this.supportH2MaxSize) {
            let key = this.supportH2Map.entries().next().value[0];
            this.supportH2Map.delete(key);
        }
        const time = new Date().getTime();
        let keysToDel: Array<string> = [];
        this.supportH2Map.forEach((val, key) => {
            if (time - val.time > this.supportH2Expire) keysToDel.push(key);
        });
        keysToDel.forEach((key) => this.supportH2Map.delete(key));
    }
    getSupportH2(url: URL): boolean | undefined {
        if (this.supportH2Map.size > this.supportH2MaxSize) this.cleanupSupportH2();
        let val = this.supportH2Map.get(url.href);
        if (val == null) return val;
        else return val.h2;
    }
    setSupportH2(url: URL, supportH2: boolean | null/* not undefined */): void {
        if (this.supportH2Map.size > this.supportH2MaxSize) this.cleanupSupportH2();
        if (supportH2 == null) this.supportH2Map.delete(url.href);
        else this.supportH2Map.set(url.href, { h2: supportH2, time: new Date().getTime() });
    }

    private static async avoidUsedPorts(list?: listenList): Promise<listenList> {
        if (list == null) {
            let newList: Record<string, listenAddr> = {};
            for (let name in persistParams.listenList) {
                let def = persistParams.listenList[name];
                newList[name] = { host: def.host, port: def.port }
            }
            list = newList as listenList;
        }
        let portInUse = new Map<number, string>();
        for (let name in list) {
            if (persistParams.listenList[name] == null) {
                delete list[name];
            }
        }
        for (let name in persistParams.listenList) {
            if (list[name] == null) list[name] = persistParams.listenList[name];
            let host = list[name].host;
            if (!net.isIP(host)) try {
                let ip = await resolveToIP(host);
                console.log(`lookup hostname=[${host}] result ip=${ip}`);
                host = ip;
            } catch (e) {
                console.error(`error lookup hostname=${host}`, e);
                throw e;
            }
            let port = list[name].port;
            while (true) {
                port = await portFinder.findAfter(port, host);
                if (portInUse.get(port) == null) break;
                else do { port++; } while (portInUse.get(port) != null);
            }
            if (name === "controlInterface" && port != list[name].port) {
                if ((await this.checkIsAliveMarker(host, list[name].port))) {
                    console.error(`已有本地服务器在运行`)
                    throw new Error(`another instance is running`);
                }
            }
            list[name] = { port: port, host: host };
            portInUse.set(port, name);
        }
        return list;
    }
    private static checkIsAliveMarker(host: string, port: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            http.request({
                host: host,
                port: port,
                path: `/api/is_alive_${params.isAliveReqMarker}`,
                headers: {
                    ["Referer"]: new URL(`http://${host}:${port}/`).href,
                }
            }, (resp) => {
                resp.on('error', (err) => reject(err));
                let buffers: Array<Buffer> = [];
                resp.on('data', (chunk) => {
                    if (buffers.reduce((prev, curr) => prev + curr.byteLength, 0) > 128) {
                        resp.destroy();
                        resolve(false);
                    } else buffers.push(chunk);
                });
                resp.on('end', () => {
                    let respBody = Buffer.concat(buffers).toString('utf-8');
                    resolve(respBody === this.isAliveRespMarker);
                });
            }).on('error', (err) => reject(err)).end();
        });
    }
}

// Author: Stefnotch
// https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map/73155667#73155667
export function replacer(key: any, value: any) {
    if (typeof value === "object" && value !== null) {
        if (value instanceof Map) {
            return {
                _meta: { type: "map" },
                value: Array.from(value.entries()),
            };
        } else if (value instanceof Set) { // bonus feature!
            return {
                _meta: { type: "set" },
                value: Array.from(value.values()),
            };
        } else if ("_meta" in value) {
            // Escape "_meta" properties
            return {
                ...value,
                _meta: {
                    type: "escaped-meta",
                    value: value["_meta"],
                },
            };
        }
    }
    return value;
}
export function reviver(key: any, value: any) {
    if (typeof value === "object" && value !== null) {
        if ("_meta" in value) {
            if (value._meta.type === "map") {
                return new Map(value.value);
            } else if (value._meta.type === "set") {
                return new Set(value.value);
            } else if (value._meta.type === "escaped-meta") {
                // Un-escape the "_meta" property
                return {
                    ...value,
                    _meta: value._meta.value,
                };
            } else {
                console.warn("Unexpected meta", value._meta);
            }
        }
    }
    return value;
}

export async function resolveToIP(hostname: string): Promise<string> {
    return new Promise((res, rej) => dns.lookup(hostname, (err, address, family) => {
        if (err == null) res(address);
        else rej(err);
    }))
}