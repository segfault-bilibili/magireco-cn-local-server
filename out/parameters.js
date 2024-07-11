"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.params = exports.mode = void 0;
const util_1 = require("./util");
const port_finder_1 = require("./port_finder");
const certGenerator = require("./cert_generator");
const net = require("net");
const tls = require("tls");
const bsgamesdkPwdAuthenticate = require("./bsgamesdk-pwd-authenticate");
const userdataDump = require("./userdata_dump");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const http = require("http");
var mode;
(function (mode) {
    mode[mode["ONLINE"] = 1] = "ONLINE";
    mode[mode["LOCAL_OFFLINE"] = 2] = "LOCAL_OFFLINE";
})(mode || (exports.mode = mode = {}));
const persistParams = {
    mode: mode.LOCAL_OFFLINE,
    autoOpenWeb: true,
    injectMadokamiSE: false,
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
    concurrentCrawl: true,
    lastDownloadedFileName: undefined,
};
class params {
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
                let parsed = JSON.parse(fileContent, util_1.reviver);
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
        return JSON.stringify(this.mapData, util_1.replacer);
    }
    save(param, path) {
        let lastPromise = this.unfinishedSave.shift();
        let promise = new Promise((resolve, reject) => {
            let doSave = () => {
                let unmodifiedMap = JSON.parse(this.stringify(), util_1.reviver);
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
                            let parsed = JSON.parse(param, util_1.reviver);
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
                        let fileContent = JSON.stringify(preparedMapData, util_1.replacer);
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
                let parsed = JSON.parse(fileContent, util_1.reviver);
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
            fs.writeFileSync(params.overridesDBPath, JSON.stringify(this.overridesDB, util_1.replacer), 'utf-8');
        }
        catch (e) {
            console.error(`error writting to ${params.overridesDBPath}`, e);
        }
    }
    get mode() { return this.mapData.get("mode"); }
    get autoOpenWeb() { return this.mapData.get("autoOpenWeb"); }
    get injectMadokamiSE() { return this.mapData.get("injectMadokamiSE"); }
    get listenList() { return this.mapData.get("listenList"); }
    get lastHttpProxy() { return this.mapData.get("lastHttpProxy"); }
    get httpProxyUsername() { return this.mapData.get("httpProxyUsername"); }
    get httpProxyPassword() { return this.mapData.get("httpProxyPassword"); }
    getClashYaml(host) {
        if (host == null)
            host = this.listenList.httpProxy.host;
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
            + `\n   password: "${password}"`;
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
    get concurrentCrawl() { return this.mapData.get("concurrentCrawl"); }
    get lastDownloadedFileName() { return this.mapData.get("lastDownloadedFileName"); }
    set lastDownloadedFileName(fileName) { this.mapData.set("lastDownloadedFileName", fileName); }
    get CACertPEM() { return this.CACertAndKey.cert; }
    get CACertSubjectHashOld() { return "9489bdaf"; } //FIXME
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
                overridesDB = JSON.parse(content, util_1.reviver);
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
                case "mode":
                    val = mode.LOCAL_OFFLINE;
                    break;
                case "listenList":
                    if (!isSaving)
                        val = await params.avoidUsedPorts(val);
                    break;
                case "httpProxyUsername":
                    val = "mgrc";
                    break;
                case "httpProxyPassword":
                    if (val == null)
                        val = (0, util_1.getRandomHex)(32);
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
                    let ip = await (0, util_1.resolveToIP)(host);
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
            if (name === "controlInterface" && port != list[name].port) {
                if ((await this.checkIsAliveMarker(host, list[name].port))) {
                    console.error(`已有本地服务器在运行`);
                    throw new Error(`another instance is running`);
                }
            }
            list[name] = { port: port, host: host };
            portInUse.set(port, name);
        }
        return list;
    }
    static checkIsAliveMarker(host, port) {
        return new Promise((resolve, reject) => {
            const timeout = 50;
            const req = http.request({
                host: host,
                port: port,
                path: `/api/is_alive_${params.isAliveReqMarker}`,
                headers: {
                    ["Referer"]: new URL(`http://${host}:${port}/`).href,
                },
                timeout: timeout,
            }, (resp) => {
                resp.on('error', (err) => reject(err));
                let buffers = [];
                resp.on('data', (chunk) => {
                    if (buffers.reduce((prev, curr) => prev + curr.byteLength, 0) > 128) {
                        resp.destroy();
                        resolve(false);
                    }
                    else
                        buffers.push(chunk);
                });
                resp.on('end', () => {
                    let respBody = Buffer.concat(buffers).toString('utf-8');
                    resolve(respBody === this.isAliveRespMarker);
                });
            }).on('error', (err) => {
                console.error("error when checkIsAliveMarker", err);
                resolve(false);
            }).setTimeout(timeout, () => {
                req.destroy();
                resolve(false);
            }).end();
        });
    }
}
exports.params = params;
params.VERBOSE = false;
params.isAliveReqMarker = "2f53b99c5bc307e9e4005ea1087eeca0";
params.isAliveRespMarker = "614cb4bf76a743055e924a0a3073f850";
params.defaultPath = path.join(".", "params.json");
params.overridesDBPath = path.join(".", "overrides.json");
