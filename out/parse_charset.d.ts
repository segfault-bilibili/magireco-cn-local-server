import { IncomingMessage } from "http";
import { IncomingHttpHeaders } from "http2";
export declare class parseCharset {
    static readonly allowed: Set<string>;
    static get(header: IncomingHttpHeaders | IncomingMessage["headers"]): BufferEncoding;
}
