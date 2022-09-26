import * as crypto from "crypto";
import * as http2 from "http2";
import * as parameters from "./parameters";
import { localServer } from "./local_server";
import * as bsgamesdkPwdAuthenticate from "./bsgamesdk-pwd-authenticate";

export type magirecoIDs = {
    device_id: string;
}

export type openIdTicket = {
    open_id: string,
    ticket: string,
}

export class userdataDmp {
    private readonly params: parameters.params;
    private localServer: localServer;
    get magirecoIDs(): magirecoIDs { return this.params.magirecoIDs; }

    get bsgamesdkResponse(): bsgamesdkPwdAuthenticate.bsgamesdkResponse | undefined { return this.params.bsgamesdkResponse; }
    get openIdTicket(): openIdTicket | undefined { return this.params.openIdTicket; }

    constructor(params: parameters.params, localServer: localServer) {
        this.params = params;
        this.localServer = localServer;
    }

    static newRandomID(): magirecoIDs {
        console.log("generated new random magireco IDs");
        return {
            device_id: [8, 4, 4, 4, 12].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
                .toString('hex').substring(0, len)).join("-"),
        }
    }
}