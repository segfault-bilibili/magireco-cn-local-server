import { hook, hookContext } from "../local_server";
import * as parameters from "../parameters";
import * as staticResCrawler from "../static_res_crawler";
export declare class jpResHook implements hook {
    readonly params: parameters.params;
    private readonly crawler;
    readonly jpDomain = "android.magi-reco.com";
    readonly apiPath = "/magica/api";
    constructor(params: parameters.params, crawler: staticResCrawler.crawler);
    onMatchRequestHeaders(ctx: hookContext): Promise<boolean>;
    private matchRequest;
    private onMatchedRequest;
    private fakeResp;
    onMatchRequestBody(ctx: hookContext): Promise<boolean>;
    onMatchResponseHeaders(ctx: hookContext): Promise<boolean>;
    onMatchResponseBody(ctx: hookContext): Promise<void>;
}
