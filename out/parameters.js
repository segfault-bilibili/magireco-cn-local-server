"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToIP = exports.reviver = exports.replacer = exports.params = exports.mode = void 0;
const port_finder_1 = require("./port_finder");
const certGenerator = require("./cert_generator");
const net = require("net");
const dns = require("dns");
const tls = require("tls");
const bsgamesdkPwdAuthenticate = require("./bsgamesdk-pwd-authenticate");
const userdataDump = require("./userdata_dump");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
var mode;
(function (mode) {
    mode[mode["ONLINE"] = 1] = "ONLINE";
    mode[mode["LOCAL_OFFLINE"] = 2] = "LOCAL_OFFLINE";
})(mode = exports.mode || (exports.mode = {}));
const persistParams = {
    mode: mode.ONLINE,
    autoOpenWeb: true,
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
    lastDownloadedFileName: undefined,
};
class params {
    constructor(mapData, lastSaved, filePath) {
        this.supportH2Expire = 3600 * 1000;
        this.supportH2MaxSize = 1024;
        this.mapData = mapData;
        const CACerts = tls.rootCertificates.slice();
        CACerts.push(this.CACertPEM);
        const upstreamProxyCACert = this.upstreamProxyCACert;
        if (upstreamProxyCACert != null) {
            CACerts.unshift(upstreamProxyCACert);
            console.log("added upstreamProxyCACert to CACerts");
        }
        this.CACerts = CACerts;
        this.supportH2Map = new Map();
        this.lastSaved = lastSaved;
        this.unfinishedSave = [];
        this.path = filePath;
        let overridesDB;
        if (fs.existsSync(params.overridesDBPath) && fs.statSync(params.overridesDBPath).isFile()) {
            try {
                let content = fs.readFileSync(params.overridesDBPath, 'utf-8');
                overridesDB = JSON.parse(content, reviver);
                if (!(overridesDB instanceof Map))
                    throw new Error("not instance of map");
            }
            catch (e) {
                console.error(`error loading from ${params.overridesDBPath}, creating new one`, e);
            }
        }
        if (overridesDB == null)
            overridesDB = new Map();
        this.overridesDB = overridesDB;
    }
    static async load(path) {
        if (path == null)
            path = this.defaultPath;
        let fileContent;
        if (!fs.existsSync(path))
            fileContent = null;
        else
            try {
                if ((await fsPromises.stat(path)).isFile())
                    fileContent = fs.readFileSync(path, { encoding: "utf8" });
                else
                    fileContent = null;
            }
            catch (e) {
                console.error(e);
                fileContent = null;
            }
        return await this.import(fileContent, path);
    }
    static async import(fileContent, path) {
        //path will be used when save() is called without argument
        //WILL NOT WRITE FILE HERE
        let importedMapData;
        if (fileContent == null) {
            console.log("Creating empty params.json");
            importedMapData = new Map();
            fileContent = "";
        }
        else
            try {
                let parsed = JSON.parse(fileContent, reviver);
                if (parsed instanceof Map)
                    importedMapData = parsed;
                else
                    throw new Error("not a Map");
            }
            catch (e) {
                console.log("Error reading params.json, creating empty one");
                importedMapData = new Map();
            }
        let preparedMapData = await this.prepare(importedMapData, false);
        return new params(preparedMapData, fileContent, path);
    }
    stringify() {
        return JSON.stringify(this.mapData, replacer);
    }
    save(param, path) {
        let lastPromise = this.unfinishedSave.shift();
        let promise = new Promise((resolve, reject) => {
            let doSave = () => {
                let unmodifiedMap = JSON.parse(this.stringify(), reviver);
                let modified = false;
                if (param != null) {
                    if (Array.isArray(param)) {
                        param.forEach((p) => unmodifiedMap.set(p.key, p.val));
                        modified = true;
                    }
                    else if (typeof param !== 'string') {
                        unmodifiedMap.set(param.key, param.val);
                        if (param.key === "upstreamProxyCACert")
                            this.refreshCACert();
                        modified = true;
                    }
                    else
                        try {
                            let parsed = JSON.parse(param, reviver);
                            if (!(parsed instanceof Map))
                                throw new Error("not a Map");
                            unmodifiedMap.clear();
                            parsed.forEach((val, key) => unmodifiedMap.set(key, val));
                            modified = true;
                        }
                        catch (e) {
                            console.error(`cannot save whole params.json from string`, e);
                        }
                }
                // may be modified, but still not taking effect now
                params.prepare(unmodifiedMap, true).then((preparedMapData) => {
                    try {
                        let fileContent = JSON.stringify(preparedMapData, replacer);
                        if (path == null)
                            path = this.path;
                        fs.writeFileSync(path, fileContent, { encoding: "utf-8" });
                        this.lastSaved = fileContent;
                        this.mapData.clear();
                        preparedMapData.forEach((val, key) => this.mapData.set(key, val));
                        // saved and taking effect now
                        console.log("saved params.json");
                        resolve();
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            };
            if (lastPromise != null)
                lastPromise.then(() => doSave());
            else
                doSave();
        });
        this.unfinishedSave.push(promise);
        return promise;
    }
    checkModified() {
        return this.stringify() !== this.lastSaved;
    }
    saveOverrideDB(fileContent) {
        if (fileContent != null) {
            try {
                let parsed = JSON.parse(fileContent, reviver);
                if (!(parsed instanceof Map))
                    throw new Error(`parsed fileContent is not map`);
                this.overridesDB.clear();
                parsed.forEach((val, key) => this.overridesDB.set(key, val));
            }
            catch (e) {
                console.error(`saveOverrideDB error`, e);
                throw e;
            }
        }
        try {
            fs.writeFileSync(params.overridesDBPath, JSON.stringify(this.overridesDB, replacer), 'utf-8');
        }
        catch (e) {
            console.error(`error writting to ${params.overridesDBPath}`, e);
        }
    }
    get mode() { return this.mapData.get("mode"); }
    get autoOpenWeb() { return this.mapData.get("autoOpenWeb"); }
    get listenList() { return this.mapData.get("listenList"); }
    get clashYaml() {
        const host = this.listenList.httpProxy.host;
        const port = this.listenList.httpProxy.port;
        return `mode: global`
            + `\n`
            + `\nproxies:`
            + `\n - name: "magirecolocal"`
            + `\n   type: http`
            + `\n   server: ${host}`
            + `\n   port: ${port}`;
    }
    get upstreamProxy() { return this.mapData.get("upstreamProxy"); }
    get upstreamProxyEnabled() { return this.mapData.get("upstreamProxyEnabled"); }
    get upstreamProxyCACert() { return this.mapData.get("upstreamProxyCACert"); }
    get CACertAndKey() { return this.mapData.get("CACertAndKey"); }
    get bsgamesdkIDs() { return this.mapData.get("bsgamesdkIDs"); }
    get magirecoIDs() { return this.mapData.get("magirecoIDs"); }
    get bsgamesdkResponse() { return this.mapData.get("bsgamesdkResponse"); }
    get openIdTicket() { return this.mapData.get("openIdTicket"); }
    get fetchCharaEnhancementTree() { return this.mapData.get("fetchCharaEnhancementTree"); }
    get arenaSimulate() { return this.mapData.get("arenaSimulate"); }
    get concurrentFetch() { return this.mapData.get("concurrentFetch"); }
    get crawlWebRes() { return this.mapData.get("crawlWebRes"); }
    get crawlAssets() { return this.mapData.get("crawlAssets"); }
    get lastDownloadedFileName() { return this.mapData.get("lastDownloadedFileName"); }
    set lastDownloadedFileName(fileName) { this.mapData.set("lastDownloadedFileName", fileName); }
    get CACertPEM() { return this.CACertAndKey.cert; }
    get CACertSubjectHashOld() { return "9489bdaf"; } //FIXME
    refreshCACert() {
        const CACerts = tls.rootCertificates.slice();
        CACerts.push(this.CACertPEM);
        const upstreamProxyCACert = this.upstreamProxyCACert;
        if (upstreamProxyCACert != null) {
            CACerts.unshift(upstreamProxyCACert);
            console.log("added upstreamProxyCACert to CACerts");
        }
        while (this.CACerts.length > 0)
            this.CACerts.pop();
        CACerts.forEach((cert) => this.CACerts.push(cert));
    }
    static async prepare(oldMapData, isSaving) {
        let newMapData = new Map();
        for (let key in persistParams) {
            let defaultVal = persistParams[key];
            let val = oldMapData.get(key);
            if (val == null)
                val = defaultVal;
            switch (key) {
                case "listenList":
                    if (!isSaving)
                        val = await params.avoidUsedPorts(val);
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
        }
        ;
        return newMapData;
    }
    cleanupSupportH2() {
        while (this.supportH2Map.size > this.supportH2MaxSize) {
            let key = this.supportH2Map.entries().next().value[0];
            this.supportH2Map.delete(key);
        }
        const time = new Date().getTime();
        let keysToDel = [];
        this.supportH2Map.forEach((val, key) => {
            if (time - val.time > this.supportH2Expire)
                keysToDel.push(key);
        });
        keysToDel.forEach((key) => this.supportH2Map.delete(key));
    }
    getSupportH2(url) {
        if (this.supportH2Map.size > this.supportH2MaxSize)
            this.cleanupSupportH2();
        let val = this.supportH2Map.get(url.href);
        if (val == null)
            return val;
        else
            return val.h2;
    }
    setSupportH2(url, supportH2 /* not undefined */) {
        if (this.supportH2Map.size > this.supportH2MaxSize)
            this.cleanupSupportH2();
        if (supportH2 == null)
            this.supportH2Map.delete(url.href);
        else
            this.supportH2Map.set(url.href, { h2: supportH2, time: new Date().getTime() });
    }
    static async avoidUsedPorts(list) {
        if (list == null) {
            let newList = {};
            for (let name in persistParams.listenList) {
                let def = persistParams.listenList[name];
                newList[name] = { host: def.host, port: def.port };
            }
            list = newList;
        }
        let portInUse = new Map();
        for (let name in list) {
            if (persistParams.listenList[name] == null) {
                delete list[name];
            }
        }
        for (let name in persistParams.listenList) {
            if (list[name] == null)
                list[name] = persistParams.listenList[name];
            let host = list[name].host;
            if (!net.isIP(host))
                try {
                    let ip = await resolveToIP(host);
                    console.log(`lookup hostname=[${host}] result ip=${ip}`);
                    host = ip;
                }
                catch (e) {
                    console.error(`error lookup hostname=${host}`, e);
                    throw e;
                }
            let port = list[name].port;
            while (true) {
                port = await port_finder_1.portFinder.findAfter(port, host);
                if (portInUse.get(port) == null)
                    break;
                else
                    do {
                        port++;
                    } while (portInUse.get(port) != null);
            }
            list[name] = { port: port, host: host };
            portInUse.set(port, name);
        }
        return list;
    }
}
exports.params = params;
params.VERBOSE = false;
params.defaultPath = path.join(".", "params.json");
params.overridesDBPath = path.join(".", "overrides.json");
// Author: Stefnotch
// https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map/73155667#73155667
function replacer(key, value) {
    if (typeof value === "object" && value !== null) {
        if (value instanceof Map) {
            return {
                _meta: { type: "map" },
                value: Array.from(value.entries()),
            };
        }
        else if (value instanceof Set) { // bonus feature!
            return {
                _meta: { type: "set" },
                value: Array.from(value.values()),
            };
        }
        else if ("_meta" in value) {
            // Escape "_meta" properties
            return Object.assign(Object.assign({}, value), { _meta: {
                    type: "escaped-meta",
                    value: value["_meta"],
                } });
        }
    }
    return value;
}
exports.replacer = replacer;
function reviver(key, value) {
    if (typeof value === "object" && value !== null) {
        if ("_meta" in value) {
            if (value._meta.type === "map") {
                return new Map(value.value);
            }
            else if (value._meta.type === "set") {
                return new Set(value.value);
            }
            else if (value._meta.type === "escaped-meta") {
                // Un-escape the "_meta" property
                return Object.assign(Object.assign({}, value), { _meta: value._meta.value });
            }
            else {
                console.warn("Unexpected meta", value._meta);
            }
        }
    }
    return value;
}
exports.reviver = reviver;
async function resolveToIP(hostname) {
    return new Promise((res, rej) => dns.lookup(hostname, (err, address, family) => {
        if (err == null)
            res(address);
        else
            rej(err);
    }));
}
exports.resolveToIP = resolveToIP;
