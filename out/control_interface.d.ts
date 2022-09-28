import * as parameters from "./parameters";
import { httpProxy } from "./http_proxy";
import { localServer } from "./local_server";
export declare class controlInterface {
    private closing;
    private readonly params;
    private readonly httpServerSelf;
    private readonly serverList;
    private readonly bsgamesdkPwdAuth;
    private readonly userdataDmp;
    static launch(): Promise<void>;
    openWebOnAndroid(): void;
    constructor(params: parameters.params, serverList: Array<localServer | httpProxy>);
    private closeAll;
    shutdown(): Promise<void>;
    restart(): Promise<void>;
    private getParsedPostData;
    private getPostData;
    private homepageHTML;
    private sendResultAsync;
}
