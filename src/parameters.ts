import { portFinder } from "./port_finder";
import * as certGenerator from "./cert_generator";

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

    private constructor(mapData: Map<string, any>) {
        this.mapData = mapData;
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