"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bsgamesdkPwdAuth = exports.app_key_Android = void 0;
const crypto = require("crypto");
const http2 = require("http2");
const parameters = require("./parameters");
exports.app_key_Android = "add83765a53c4664944eabc18298731b";
class bsgamesdkPwdAuth {
    constructor(params, localServer) {
        this.params = params;
        this.localServer = localServer;
    }
    get IDs() { return this.params.bsgamesdkIDs; }
    async login(username, password) {
        if (this.params.mode === parameters.mode.LOCAL_OFFLINE)
            throw new Error("cannot do bilibili login in local offline mode");
        let hashAndCipherKey = await this.issueCipherV3();
        let hashsalt = hashAndCipherKey.hash;
        let pubkey = crypto.createPublicKey(hashAndCipherKey.cipher_key);
        let loginResult = await this.loginV3(username, password, hashsalt, pubkey);
        return loginResult;
    }
    bsgamesdkReq(url, postData) {
        return new Promise((resolve, reject) => {
            const host = url.host;
            const path = url.pathname + url.search;
            const method = postData == null ? http2.constants.HTTP2_METHOD_GET : http2.constants.HTTP2_METHOD_POST;
            const reqHeaders = {
                [http2.constants.HTTP2_HEADER_METHOD]: method,
                [http2.constants.HTTP2_HEADER_PATH]: path,
                [http2.constants.HTTP2_HEADER_AUTHORITY]: host,
                [http2.constants.HTTP2_HEADER_HOST]: host,
                [http2.constants.HTTP2_HEADER_USER_AGENT]: "Mozilla/5.0 BSGameSDK",
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: "application/x-www-form-urlencoded",
                [http2.constants.HTTP2_HEADER_ACCEPT_ENCODING]: "gzip, deflate",
            };
            const cvtBufToStr = true;
            this.localServer.emitHttp2RequestAsync(url, reqHeaders, postData, cvtBufToStr).then((result) => {
                const statusCode = result.headers[":status"];
                if (statusCode != 200)
                    reject(new Error(`status=[${statusCode}]`));
                else if (typeof result.respBody !== 'string')
                    reject(new Error("cannot parse binary data"));
                else
                    try {
                        let respBodyParsed = JSON.parse(result.respBody);
                        if (respBodyParsed == null)
                            reject(new Error("respBodyParsed == null"));
                        else
                            resolve(respBodyParsed);
                    }
                    catch (e) {
                        reject(e);
                    }
            }).catch((e) => reject(e));
        });
    }
    static getPostDataSign(unsigned) {
        let postDataMap = new Map();
        let keys = unsigned.split("&").map((p) => {
            let s = p.split("=");
            let key = s.shift();
            if (key == null)
                key = "";
            let val = s.join("=");
            val = decodeURIComponent(val);
            postDataMap.set(key, val);
            return key;
        }).filter((key) => key !== "" && key !== "sign" && key !== "item_name" && key !== "item_desc").sort();
        let toBeSigned = keys.reduce((prev, curr) => prev + postDataMap.get(curr), "") + exports.app_key_Android;
        let buf = Buffer.from(toBeSigned, 'utf-8');
        let sign = crypto.createHash('md5').update(buf).digest().toString('hex');
        return sign;
    }
    async issueCipherV3() {
        let postData = `merchant_id=1&`
            + `domain_switch_count=0&`
            + `sdk_type=1&`
            + `sdk_log_type=1&`
            + `timestamp=${encodeURIComponent(new Date().getTime())}&`
            + `sdk_ver=5.4.2&`
            + `original_domain=https%3A%2F%2Fline1-sdk-center-login-sh.biligame.net&`
            + `version=3&`
            + `udid=${encodeURIComponent(this.IDs.udid)}&`
            + `platform_type=3&`
            + `apk_sign=4502a02a00395dec05a4134ad593224d&`
            + `old_buvid=${encodeURIComponent(this.IDs.buvid)}&`
            + `current_env=0&`
            + `app_ver=2.2.1&`
            + `server_id=1034&`
            + `domain=line1-sdk-center-login-sh.biligame.net&`
            + `app_id=810&`
            + `bd_id=${encodeURIComponent(this.IDs.bd_id)}&`
            + `version_code=136&`
            + `platform=3&`
            + `cur_buvid=${encodeURIComponent(this.IDs.buvid)}&`
            + `cipher_type=bili_login_rsa&`
            + `channel_id=1&`
            + `game_id=810`;
        let sign = bsgamesdkPwdAuth.getPostDataSign(postData);
        postData += `&sign=${sign}`;
        const issueCipherURL = new URL("https://line1-sdk-center-login-sh.biligame.net/api/external/issue/cipher/v3");
        let resp = await this.bsgamesdkReq(issueCipherURL, postData);
        if (resp.code != 0)
            throw new Error(`resp.code=[${resp.code}] resp.message=[${resp.message}]`
                + ` resp.server_message=[${resp.server_message}]`);
        if (resp.hash == null)
            throw new Error(`resp.hash == null`);
        if (resp.cipher_key == null)
            throw new Error(`resp.cipher_key == null`);
        return { hash: resp.hash, cipher_key: resp.cipher_key };
    }
    async loginV3(user_id, plainPwd, hashsalt, pubkey) {
        let pwdBuf = Buffer.from(hashsalt + plainPwd, 'utf8');
        pwdBuf = crypto.publicEncrypt({ key: pubkey, padding: crypto.constants.RSA_PKCS1_PADDING }, pwdBuf);
        let encryptedPwd = pwdBuf.toString('base64');
        let postData = `merchant_id=1&`
            + `domain_switch_count=0&`
            + `sdk_type=1&`
            + `sdk_log_type=1&`
            + `timestamp=${new Date().getTime()}&`
            + `sdk_ver=5.4.2&`
            + `original_domain=https%3A%2F%2Fline1-sdk-center-login-sh.biligame.net&`
            + `version=3&`
            + `udid=${encodeURIComponent(this.IDs.udid)}&`
            + `platform_type=3&`
            + `apk_sign=4502a02a00395dec05a4134ad593224d&`
            + `old_buvid=${encodeURIComponent(this.IDs.buvid)}&`
            + `current_env=0&`
            + `app_ver=2.2.1&`
            + `server_id=1034&`
            + `domain=line1-sdk-center-login-sh.biligame.net&`
            + `app_id=810&`
            + `pwd=${encodeURIComponent(encryptedPwd)}&`
            + `bd_id=${encodeURIComponent(this.IDs.bd_id)}&`
            + `version_code=136&`
            + `platform=3&`
            + `cur_buvid=${encodeURIComponent(this.IDs.buvid)}&`
            + `channel_id=1&`
            + `game_id=810&`
            + `user_id=${encodeURIComponent(user_id)}`;
        let sign = bsgamesdkPwdAuth.getPostDataSign(postData);
        postData += `&sign=${sign}`;
        const loginV3URL = new URL("https://line1-sdk-center-login-sh.biligame.net/api/external/login/v3");
        let resp = await this.bsgamesdkReq(loginV3URL, postData);
        if (resp.code != 0)
            throw new Error(`resp.code=[${resp.code}] resp.message=[${resp.message}]`
                + ` resp.server_message=[${resp.server_message}]`);
        if (resp.access_key == null)
            throw new Error(`resp.access_key == null`);
        return resp;
    }
    static newRandomID() {
        console.log("generated new random bsgamesdk IDs");
        return {
            buvid: "XY511" + crypto.randomBytes(16).toString('hex').toUpperCase(),
            udid: crypto.randomBytes(15).toString('base64'),
            bd_id: [8, 4, 4, 4, 12, 8, 4, 4, 4, 3].map((len) => crypto.randomBytes(Math.trunc((len + 1) / 2))
                .toString('hex').substring(0, len)).join("-"),
        };
    }
}
exports.bsgamesdkPwdAuth = bsgamesdkPwdAuth;
