import { hook, hookContext } from "../local_server";
import * as parameters from "../parameters";
import { userdataDmp } from "../userdata_dump";
export declare class jpApiHook implements hook {
    readonly params: parameters.params;
    readonly jpDomain = "android.magi-reco.com";
    readonly apiPath = "/magica/api";
    readonly friendSearch = "/search/friend_search/_search";
    private readonly QuestBattleResultMap;
    lastInviteCode: string;
    constructor(params: parameters.params, dmp: userdataDmp);
    onMatchRequestHeaders(ctx: hookContext): Promise<boolean>;
    onMatchRequestBody(ctx: hookContext): Promise<boolean>;
    private fakePageJson;
    private fakeFriendSearch;
    private fakeEmptyJson;
    onMatchResponseHeaders(ctx: hookContext): Promise<boolean>;
    onMatchResponseBody(ctx: hookContext): Promise<void>;
}
