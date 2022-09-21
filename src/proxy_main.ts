import * as parameters from "./parameters";
import { localServer } from "./local_server";
import { httpProxy } from "./http_proxy";
import { controlInterface } from "./control_interface";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";

(async () => {
    let mapJsonData = new Map<string, string>();
    const paramsPath = path.join(".", "params.json");
    try {
        if ((await fsPromises.stat(paramsPath)).isFile()) {
            let fileContent = fs.readFileSync(paramsPath, {encoding: "utf8"});
            mapJsonData = JSON.parse(fileContent, parameters.reviver);
        } else console.log("Creating empty params.json");
    } catch (e) {
        console.log("Error reading params.json, creating empty one", e);
    }
    let params = await parameters.params.init(mapJsonData);

    let localserver = new localServer(params);
    let httpproxy = new httpProxy(params);
    let controlinterface = new controlInterface(params, [localserver, httpproxy]);

    fs.writeFileSync(paramsPath, params.stringify(), {encoding: "utf-8"});
    console.log("saved params.json");
})();