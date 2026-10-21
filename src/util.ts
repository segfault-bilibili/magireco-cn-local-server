import * as fs from "fs"
import * as crypto from "crypto";
import * as dns from "dns";
import * as zlib from "zlib";

// stringify ES6 map
// Author: Stefnotch
// https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map/73155667#73155667
export const replacer = (key: any, value: any): any => {
    if (typeof value === "object" && value !== null) {
        if (value instanceof Map) {
            return {
                _meta: { type: "map" },
                value: Array.from(value.entries()),
            };
        } else if (value instanceof Set) { // bonus feature!
            return {
                _meta: { type: "set" },
                value: Array.from(value.values()),
            };
        } else if ("_meta" in value) {
            // Escape "_meta" properties
            return {
                ...value,
                _meta: {
                    type: "escaped-meta",
                    value: value["_meta"],
                },
            };
        }
    }
    return value;
}
export const reviver = (key: any, value: any): any => {
    if (typeof value === "object" && value !== null) {
        if ("_meta" in value) {
            if (value._meta.type === "map") {
                return new Map(value.value);
            } else if (value._meta.type === "set") {
                return new Set(value.value);
            } else if (value._meta.type === "escaped-meta") {
                // Un-escape the "_meta" property
                return {
                    ...value,
                    _meta: value._meta.value,
                };
            } else {
                console.warn("Unexpected meta", value._meta);
            }
        }
    }
    return value;
}


export const resolveToIP = async (hostname: string): Promise<string> => {
    return new Promise((res, rej) => dns.lookup(hostname, (err, address, family) => {
        if (err == null) res(address);
        else rej(err);
    }))
}


const decompressSingle = (data: Buffer, encoding?: string): Buffer => {
    if (encoding == null) return data = Buffer.concat([data]);
    let decompressed: Buffer;
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
}
export const compress = (data: Buffer, encoding?: string, quality = 8): Buffer => {
    if (encoding == null) return data = Buffer.concat([data]);
    let compressed: Buffer;
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
}
export const decompress = (data: Buffer, encoding?: string): Buffer => {
    if (encoding == null) return data = Buffer.concat([data]);

    let decompressed = data;
    let encodingArray = encoding.replace(/\s/g, "").split(",").filter((enc) => enc !== "");
    try {
        encodingArray.forEach((enc) => {
            decompressed = decompressSingle(decompressed, enc);
        });
    } catch (e) {
        console.error(`decompress failed, try reverse...`, e);
        try {
            decompressed = data;
            encodingArray.reverse().forEach((enc) => {
                decompressed = decompressSingle(decompressed, enc);
            });
        } catch (e2) {
            console.error(`decompressing in reversed order failed, try JSON.parse...`, e2);
            try {
                JSON.parse(data.toString('utf-8'));
                console.warn(`data is uncompressed json`);
                return data = Buffer.concat([data]);
            } catch (e3) {
                let msg = `JSON.parse after decompress decompressing in reversed order attempt failed`;
                console.error(msg, e3);
                throw new Error(msg);
            }
        }
    }
    return decompressed;
}


export const getRandomHex = (charCount: number): string => {
    return crypto.randomBytes(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
}
export const getRandomGuid = (): string => {
    return [8, 4, 4, 4, 12].map((len) => getRandomHex(len)).join("-");
}
export const md5 = (file: Buffer): string => {
    return crypto.createHash('md5').update(file).digest().toString('hex');
}


const defMime = "application/octet-stream";
const mimeMap = new Map<string, string>();
mimeMap.set(".css", "text/css");
mimeMap.set(".gz", "application/gzip");
mimeMap.set(".html", "text/html; charset=utf-8");
mimeMap.set(".jpg", "image/jpeg");
mimeMap.set(".js", "application/javascript; charset=utf-8");
mimeMap.set(".json", "application/json; charset=utf-8");
mimeMap.set(".ExportJson", "application/json; charset=utf-8");
mimeMap.set(".mp4", "video/mp4");
mimeMap.set(".plist", "application/x-plist");
mimeMap.set(".png", "image/png");
export const getMime = (fullpath: string): string => {
    let ext = fullpath.match(/\.[^\.]*$/)?.[0];
    if (ext == null) return defMime;
    let mime = mimeMap.get(ext);
    if (mime == null) {
        mime = defMime;
    }
    return mime;
}


export const isDir = (dirpath: string): boolean => fs.existsSync(dirpath) && fs.statSync(dirpath).isDirectory();
export const isFile = (dirpath: string): boolean => fs.existsSync(dirpath) && fs.statSync(dirpath).isFile();