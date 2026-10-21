"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomGuid = exports.getRandomHex = exports.decompress = exports.compress = exports.resolveToIP = exports.reviver = exports.replacer = void 0;
const crypto_1 = require("crypto");
const dns = require("dns");
const zlib = require("zlib");
// stringify ES6 map
// Author: Stefnotch
// https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map/73155667#73155667
const replacer = (key, value) => {
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
};
exports.replacer = replacer;
const reviver = (key, value) => {
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
};
exports.reviver = reviver;
const resolveToIP = async (hostname) => {
    return new Promise((res, rej) => dns.lookup(hostname, (err, address, family) => {
        if (err == null)
            res(address);
        else
            rej(err);
    }));
};
exports.resolveToIP = resolveToIP;
const decompressSingle = (data, encoding) => {
    if (encoding == null)
        return data = Buffer.concat([data]);
    let decompressed;
    switch (encoding) {
        case 'gzip':
            decompressed = zlib.gunzipSync(data);
            break;
        case 'deflate':
            decompressed = zlib.inflateSync(data);
            break;
        case 'br':
            decompressed = zlib.brotliDecompressSync(data);
            break;
        default:
            throw new Error(`unknown compress encoding=${encoding}`);
    }
    return decompressed;
};
const compress = (data, encoding, quality = 8) => {
    if (encoding == null)
        return data = Buffer.concat([data]);
    let compressed;
    switch (encoding) {
        case 'gzip':
            compressed = zlib.gzipSync(data);
            break;
        case 'deflate':
            compressed = zlib.deflateSync(data);
            break;
        case 'br':
            compressed = zlib.brotliCompressSync(data, {
                params: {
                    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
                    [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
                    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.byteLength,
                },
            });
            break;
        default:
            throw new Error(`unknown compress encoding=${encoding}`);
    }
    return compressed;
};
exports.compress = compress;
const decompress = (data, encoding) => {
    if (encoding == null)
        return data = Buffer.concat([data]);
    let decompressed = data;
    let encodingArray = encoding.replace(/\s/g, "").split(",").filter((enc) => enc !== "");
    try {
        encodingArray.forEach((enc) => {
            decompressed = decompressSingle(decompressed, enc);
        });
    }
    catch (e) {
        console.error(`decompress failed, try reverse...`, e);
        try {
            decompressed = data;
            encodingArray.reverse().forEach((enc) => {
                decompressed = decompressSingle(decompressed, enc);
            });
        }
        catch (e2) {
            console.error(`decompressing in reversed order failed, try JSON.parse...`, e2);
            try {
                JSON.parse(data.toString('utf-8'));
                console.warn(`data is uncompressed json`);
                return data = Buffer.concat([data]);
            }
            catch (e3) {
                let msg = `JSON.parse after decompress decompressing in reversed order attempt failed`;
                console.error(msg, e3);
                throw new Error(msg);
            }
        }
    }
    return decompressed;
};
exports.decompress = decompress;
const getRandomHex = (charCount) => {
    return (0, crypto_1.randomBytes)(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
};
exports.getRandomHex = getRandomHex;
const getRandomGuid = () => {
    return [8, 4, 4, 4, 12].map((len) => (0, exports.getRandomHex)(len)).join("-");
};
exports.getRandomGuid = getRandomGuid;
