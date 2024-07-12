import * as parameters from "./parameters";
import { localServer } from "./local_server";
export declare type bsgamesdkIDs = {
    buvid: string;
    udid: string;
    bd_id: string;
};
export declare type bsgamesdkResponse = {
    requestId: string;
    timestamp: string;
    code: number;
    hash?: string;
    cipher_key?: string;
    message?: string;
    auth_name?: string;
    realname_verified?: number;
    remind_status?: number;
    h5_paid_download?: number;
    h5_paid_download_sign?: string;
    face?: string;
    s_face?: string;
    uname?: string;
    access_key?: string;
    uid?: number;
    expires?: number;
    server_message: string;
};
export declare const app_key_Android = "add83765a53c4664944eabc18298731b";
export declare class bsgamesdkPwdAuth {
    private readonly params;
    private localServer;
    private get IDs();
    constructor(params: parameters.params, localServer: localServer);
    login(username: string, password: string): Promise<bsgamesdkResponse>;
    private bsgamesdkReq;
    static getPostDataSign(unsigned: string): string;
    private issueCipherV3;
    private loginV3;
    static newRandomID(): bsgamesdkIDs;
}
