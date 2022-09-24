import * as parameters from "./parameters";
import { localServer } from "./local_server";
import { httpProxy } from "./http_proxy";
import { controlInterface } from "./control_interface";

(async () => {
    const params = await parameters.params.load();
    let localserver = new localServer(params);
    let httpproxy = new httpProxy(params);
    let controlinterface = new controlInterface(params, [localserver, httpproxy]);
    params.save();
})();