import { IncomingMessage } from "http";
import { IncomingHttpHeaders } from "http2";

export class parseCharset {
    static readonly allowed = new Set<string>(["ascii", "utf8", "utf-8", "utf16le", "ucs2", "ucs-2", "base64", "base64url", "latin1", "binary", "hex"]);
    static get(header: IncomingHttpHeaders | IncomingMessage["headers"]): BufferEncoding {
        if (header == null) return 'utf-8';
        let contentType = header["content-type"];
        if (contentType == null) return 'utf-8';
        let foundStr = contentType.toLowerCase().split(';').find((s) => s.match(/^\s*charset=\S+/));
        if (foundStr == null) return 'utf-8';
        foundStr = foundStr.replace(/(^\s*charset=)|(\s*$)/g, "");
        if (this.allowed.has(foundStr)) return foundStr as BufferEncoding;
        else throw new Error(`unsupported encoding [${foundStr}]`);
    }
}