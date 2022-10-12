import * as parameters from "./parameters";
export declare class httpProxy {
    private readonly params;
    private httpServer;
    constructor(params: parameters.params);
    private createHttpServer;
    close(): Promise<void>;
    restart(): Promise<void>;
}
