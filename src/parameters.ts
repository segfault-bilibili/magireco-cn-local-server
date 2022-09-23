import { portFinder } from "./port_finder";
import * as certGenerator from "./cert_generator";
import * as net from "net";
import * as dns from "dns";
import * as tls from "tls";

export type listenAddr = {
    port: number,
    host: string,
}

export type listenList = Record<string, listenAddr> & {
    controlInterface: listenAddr,
    httpProxy: listenAddr,
    localServer: listenAddr,
    localHttp1Server: listenAddr,
}

export enum mode {
    ACCOUNT_DUMP = 1,
    TAP_PROXY = 2,
    LOCAL_OFFLINE = 3,
}

const persistParams: Record<string, any> = {
    mode: mode.ACCOUNT_DUMP,
    listenList: {
        controlInterface: { port: 10000, host: "127.0.0.1" },
        httpProxy: { port: 10001, host: "127.0.0.1" },
        localServer: { port: 10002, host: "127.0.0.1" },
        localHttp1Server: { port: 10003, host: "127.0.0.1" },
    },
    upstreamProxy: {
        //HTTP
        host: "127.0.0.1",
        port: 8080,
    },
    upstreamProxyEnabled: false,
    upstreamProxyCACert: null,
    CACertAndKey: null,
}

export class params {
    private mapData: Map<string, any>;
    stringify(): string {
        let mapJsonData = new Map<string, string>();
        this.mapData.forEach((val, key) => mapJsonData.set(key, JSON.stringify(val, replacer)));
        return JSON.stringify(mapJsonData, replacer);
    }

    get mode(): mode { return this.mapData.get("mode"); }
    get listenList(): listenList { return this.mapData.get("listenList"); }
    get upstreamProxy(): listenAddr { return this.mapData.get("upstreamProxy"); }
    get upstreamProxyEnabled(): boolean { return this.mapData.get("upstreamProxyEnabled"); }
    get upstreamProxyCACert(): string | undefined | null { return this.mapData.get("upstreamProxyCACert"); }
    get CACertAndKey(): certGenerator.certAndKey { return this.mapData.get("CACertAndKey"); }
    get CACertPEM(): string { return this.CACertAndKey.cert; }
    get CACertSubjectHashOld(): string { return "9489bdaf"; }//FIXME
    readonly CACerts: Array<string>;
    private readonly supportH2Map: Map<string, { h2: boolean, time: number }>;
    private supportH2Expire = 3600 * 1000;
    private supportH2MaxSize = 1024;

    private constructor(mapData: Map<string, any>) {
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
    }
    static async init(mapJsonData: Map<string, string>): Promise<params> {
        let mapData = new Map<string, any>();
        for (let key in persistParams) {
            let defaultVal = persistParams[key];
            let val: any = mapJsonData.get(key);
            try {
                if (val != null) val = JSON.parse(val);
            } catch (e) {
                console.error(`cannot parse key=[${key}]`);
            }
            if (val == null) val = defaultVal;
            switch (key) {
                case "listenList":
                    let portInUse = new Map<number, string>();
                    for (let name in persistParams.listenList) {
                        if (val[name] == null) val[name] = persistParams.listenList[name];
                        let host = val[name].host;
                        if (!net.isIP(host)) try {
                            let ip = await resolveToIP(host);
                            console.log(`lookup hostname=[${host}] result ip=${ip}`);
                            host = ip;
                        } catch (e) {
                            console.error(`error lookup hostname=${host}`, e);
                            throw e;
                        }
                        let port = val[name].port;
                        while (true) {
                            port = await portFinder.findAfter(port, host);
                            if (portInUse.get(port) == null) break;
                            else do { port++; } while (portInUse.get(port) != null);
                        }
                        val[name] = { port: port, host: host };
                        portInUse.set(port, name);
                    }
                    break;
                case "CACertAndKey":
                    if (val.cert == null || val.key == null) val = certGenerator.certGen.newCertAndKey(true);
                    break;
            }
            mapData.set(key, val);
        };
        return new params(mapData);
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
}

//https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
export function replacer(key: any, value: any) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    } else {
        return value;
    }
}
export function reviver(key: any, value: any) {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
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