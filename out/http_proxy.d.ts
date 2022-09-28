import * as parameters from "./parameters";
export declare class httpProxy {
    private readonly params;
    private readonly httpServer;
    constructor(params: parameters.params);
    close(): Promise<void>;
}
