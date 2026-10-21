"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jpApiHook = void 0;
const fs = require("fs");
const path = require("path");
const parameters = require("../parameters");
const index404_1 = require("../index404");
const util_1 = require("../util");
const tag = "API";
const log = (...msg) => console.log(`[${tag}]`, ...msg);
const warn = (...msg) => console.warn(`[${tag}]`, ...msg);
const error = (...msg) => console.error(`[${tag}]`, ...msg);
class jpApiHook {
    constructor(params, dmp) {
        this.jpDomain = 'android.magi-reco.com';
        this.apiPath = '/magica/api';
        this.friendSearch = '/search/friend_search/_search';
        this.QuestBattleResultMap = new Map();
        this.lastInviteCode = "";
        this.params = params;
    }
    async onMatchRequestHeaders(ctx) {
        var _a, _b, _c;
        if (!((_a = ctx.host) === null || _a === void 0 ? void 0 : _a.startsWith(this.jpDomain)))
            return false;
        if (!((_b = ctx.path) === null || _b === void 0 ? void 0 : _b.startsWith(this.apiPath)) && !((_c = ctx.path) === null || _c === void 0 ? void 0 : _c.startsWith(this.friendSearch)))
            return false;
        warn(`Request Headers ${ctx.method} origPath=[${ctx.origPath}]`);
        return true;
    }
    async onMatchRequestBody(ctx) {
        var _a;
        warn(`Request Body ${ctx.method} origPath=[${ctx.origPath}] origReqBody.byteLength=[${(_a = ctx.origReqBody) === null || _a === void 0 ? void 0 : _a.byteLength}]`);
        const url = new URL(`https://${this.jpDomain}${ctx.origPath}`);
        const pathInUrl = url.pathname;
        if (this.params.mode === parameters.mode.LOCAL_OFFLINE) {
            this.lastInviteCode = 'eK5zp4WJ'; // DEBUG
            if (pathInUrl.startsWith(`/magica/api/page/`))
                return await this.fakePageJson(ctx, url);
            if (pathInUrl.startsWith(this.friendSearch))
                return await this.fakeFriendSearch(ctx, url);
        }
        return true;
    }
    async fakePageJson(ctx, url) {
        var _a;
        const method = ctx.method;
        const pathInUrl = url.pathname;
        if (pathInUrl.startsWith(`/magica/api/page/MainQuestBranch`))
            return await this.fakeEmptyJson(ctx, url);
        const lastInviteCode = this.lastInviteCode;
        const dir = path.join('.', 'user_page_jsons', lastInviteCode);
        if (!fs.existsSync(dir)) {
            ctx.rst = true;
            return false;
        }
        const pageName = pathInUrl.replace(/^\/magica\/api\/page\//, "");
        const pageJsonPath = path.join(dir, `${pageName}.json`);
        if (!fs.existsSync(pageJsonPath)) {
            ctx.rst = true;
            return false;
        }
        log(`${method} ${pathInUrl} found pageJson file`);
        let resp = JSON.parse(fs.readFileSync(pageJsonPath, 'utf-8'));
        const neededModelIdSet = new Set((_a = url.searchParams.get('value')) === null || _a === void 0 ? void 0 : _a.split(','));
        if (neededModelIdSet.size > 0) {
            const existingPageJsonNameList = fs.readdirSync(dir).filter((subpath) => fs.statSync(path.join(dir, subpath)).isDirectory());
            for (let modelId of neededModelIdSet) {
                if (resp[modelId] == null) {
                    let subdir = existingPageJsonNameList.find((subdir) => fs.existsSync(path.join(dir, subdir, `${modelId}.json`)));
                    if (subdir == null) {
                        let isList = modelId.toLowerCase().endsWith('list');
                        error(`${method} ${pathInUrl} cannot find json for modelId=[${modelId}], fake an empty ${isList ? 'array' : 'object'}`);
                        resp[modelId] = isList ? [] : {};
                    }
                    else {
                        log(`${method} ${pathInUrl} found json for modelId=[${modelId}]`);
                        resp[modelId] = JSON.parse(fs.readFileSync(path.join(dir, subdir, `${modelId}.json`), 'utf-8'));
                    }
                }
            }
        }
        let respBodyBuf = Buffer.from(JSON.stringify(resp));
        let hdr = {};
        hdr['content-type'] = `application/json; charset=utf-8`;
        hdr['content-length'] = `${respBodyBuf.byteLength}`;
        hdr["cache-control"] = `no-cache`;
        ctx.statusCode = 200;
        ctx.respHeaders = hdr;
        ctx.respBody = respBodyBuf;
        ctx.fakeResp = true;
        log(`${method} ${pathInUrl} faked pageJson body length=${respBodyBuf.byteLength}`);
        return false;
    }
    async fakeFriendSearch(ctx, url) {
        const method = ctx.method;
        const pathInUrl = url.pathname;
        let respBodyBuf = Buffer.from(JSON.stringify({ "took": 5, "timed_out": false, "_shards": { "total": 20, "successful": 20, "failed": 0 }, "hits": { "total": 13021, "max_score": 1.9999692, "hits": [{ "_index": "friend_search", "_type": "user", "_id": "643bd5d0-9001-11e8-9487-063266ca3740", "_score": 1.9999692, "fields": { "attributeId": ["VOID"], "displayCardId": [10445], "level": [100], "lastAccessDate": ["2024-07-29T19:44:51.000Z"], "inviteCode": ["jHa95sTs"], "cardId": [10445], "userRank": [94], "id": ["643bd5d0-9001-11e8-9487-063266ca3740"], "userName": ["GOD"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "629a74fd-86bd-11e7-a39a-06f31224d96c", "_score": 1.9997932, "fields": { "attributeId": ["TIMBER"], "displayCardId": [25035], "level": [100], "lastAccessDate": ["2024-07-27T21:41:32.000Z"], "inviteCode": ["yQWf3U23"], "cardId": [25035], "userRank": [100], "id": ["629a74fd-86bd-11e7-a39a-06f31224d96c"], "userName": ["\u98fc\u3044\u732b"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "7665a24b-9056-11e9-8122-064bd48087ec", "_score": 1.9997125, "fields": { "attributeId": ["FIRE"], "displayCardId": [26015], "level": [100], "lastAccessDate": ["2024-07-29T16:35:30.000Z"], "inviteCode": ["CtQm3pTE"], "cardId": [26015], "userRank": [96], "id": ["7665a24b-9056-11e9-8122-064bd48087ec"], "userName": ["\u307e\u3057\u308d"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "7b79dedf-bfde-11e9-9950-06bd907f608e", "_score": 1.9993633, "fields": { "attributeId": ["VOID"], "displayCardId": [11334], "level": [100], "lastAccessDate": ["2024-07-29T01:16:53.000Z"], "inviteCode": ["V8p1XwpK"], "cardId": [11335], "userRank": [99], "id": ["7b79dedf-bfde-11e9-9950-06bd907f608e"], "userName": ["\u308f\u305f"], "cardRank": ["RANK_5"], "revision": [2] } }, { "_index": "friend_search", "_type": "user", "_id": "9c1245fa-da88-11e7-916c-066295a33c46", "_score": 1.9993086, "fields": { "attributeId": ["LIGHT"], "displayCardId": [10195], "level": [100], "lastAccessDate": ["2024-07-29T18:37:05.000Z"], "inviteCode": ["v3zKU8Te"], "cardId": [10195], "userRank": [101], "id": ["9c1245fa-da88-11e7-916c-066295a33c46"], "userName": ["\u5c71\u98a8"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "878ea327-3ec7-11ee-87c2-06fcab9cf749", "_score": 1.9991555, "fields": { "attributeId": ["WATER"], "displayCardId": [11014], "level": [1], "lastAccessDate": ["2024-07-29T16:09:10.000Z"], "inviteCode": ["auKh7j2h"], "cardId": [11014], "userRank": [101], "id": ["878ea327-3ec7-11ee-87c2-06fcab9cf749"], "userName": ["ready"], "cardRank": ["RANK_4"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "9d0ef2c5-6bf7-11ed-ad6f-06eaf48c930f", "_score": 1.9990462, "fields": { "attributeId": ["DARK"], "displayCardId": [22025], "level": [100], "lastAccessDate": ["2024-07-29T01:15:23.000Z"], "inviteCode": ["1pMaHbeY"], "cardId": [22025], "userRank": [101], "id": ["9d0ef2c5-6bf7-11ed-ad6f-06eaf48c930f"], "userName": ["\u8240"], "cardRank": ["RANK_5"], "revision": [1] } }, { "_index": "friend_search", "_type": "user", "_id": "818aefce-6228-11e8-899c-068eeb080410", "_score": 1.9986933, "fields": { "attributeId": ["VOID"], "displayCardId": [11445], "level": [100], "lastAccessDate": ["2024-07-28T15:43:44.000Z"], "inviteCode": ["72Zf4Rym"], "cardId": [11445], "userRank": [101], "id": ["818aefce-6228-11e8-899c-068eeb080410"], "userName": ["\u306a\u3053\u3061\u3083\u3093"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "3f892d07-2604-11e9-805e-06bf43be7630", "_score": 1.9985054, "fields": { "attributeId": ["LIGHT"], "displayCardId": [15014], "level": [1], "lastAccessDate": ["2024-07-30T00:35:41.000Z"], "inviteCode": ["AWUyzcTE"], "cardId": [15014], "userRank": [97], "id": ["3f892d07-2604-11e9-805e-06bf43be7630"], "userName": ["Macaroni"], "cardRank": ["RANK_4"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "acd67517-a68f-11e8-8e05-067df4dc3146", "_score": 1.9984654, "fields": { "attributeId": ["FIRE"], "displayCardId": [40515], "level": [100], "lastAccessDate": ["2024-07-30T03:36:12.000Z"], "inviteCode": ["117CwbnN"], "cardId": [40515], "userRank": [103], "id": ["acd67517-a68f-11e8-8e05-067df4dc3146"], "userName": ["\u65e5\u5098"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "368690d7-9985-11ea-9e55-06aca0b4a7fa", "_score": 1.9984003, "fields": { "attributeId": ["WATER"], "displayCardId": [11014], "level": [80], "lastAccessDate": ["2024-07-28T15:15:20.000Z"], "inviteCode": ["WmBRbH2V"], "cardId": [11014], "userRank": [97], "id": ["368690d7-9985-11ea-9e55-06aca0b4a7fa"], "userName": ["\u3046\u306e\u306f\u306a"], "cardRank": ["RANK_4"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "bdca5574-15f7-11e9-bbb3-06941b8293b0", "_score": 1.9983343, "fields": { "attributeId": ["WATER"], "displayCardId": [11015], "level": [100], "lastAccessDate": ["2024-07-28T12:33:21.000Z"], "inviteCode": ["TQ3hLtyf"], "cardId": [11015], "userRank": [103], "id": ["bdca5574-15f7-11e9-bbb3-06941b8293b0"], "userName": ["\u30de\u30ea\u30eb"], "cardRank": ["RANK_5"], "revision": [1] } }, { "_index": "friend_search", "_type": "user", "_id": "709536f3-ea03-11ea-b1bd-068dfe59e3e2", "_score": 1.9982796, "fields": { "attributeId": ["LIGHT"], "displayCardId": [21015], "level": [100], "lastAccessDate": ["2024-07-26T04:21:03.000Z"], "inviteCode": ["MVnu4Xzx"], "cardId": [21015], "userRank": [102], "id": ["709536f3-ea03-11ea-b1bd-068dfe59e3e2"], "userName": ["\u307e\u3061\u3083\u308a\u3093"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "9bc5f4c4-8b47-11e7-8267-066b91567f44", "_score": 1.998231, "fields": { "attributeId": ["LIGHT"], "displayCardId": [17015], "level": [100], "lastAccessDate": ["2024-07-23T17:03:43.000Z"], "inviteCode": ["aHHFxczJ"], "cardId": [17015], "userRank": [104], "id": ["9bc5f4c4-8b47-11e7-8267-066b91567f44"], "userName": ["\u4e2dqb"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "135cf779-d0e4-11e7-b4a5-06d41cb75536", "_score": 1.9980868, "fields": { "attributeId": ["DARK"], "displayCardId": [20075], "level": [98], "lastAccessDate": ["2024-07-30T05:50:16.000Z"], "inviteCode": ["EfFSTQCk"], "cardId": [20075], "userRank": [102], "id": ["135cf779-d0e4-11e7-b4a5-06d41cb75536"], "userName": ["\u304a\u3082\u3061"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "2c498786-d8f6-11e7-9085-0616e13d9f84", "_score": 1.9979476, "fields": { "attributeId": ["LIGHT"], "displayCardId": [30435], "level": [100], "lastAccessDate": ["2024-07-30T01:36:57.000Z"], "inviteCode": ["22xwELxn"], "cardId": [30435], "userRank": [95], "id": ["2c498786-d8f6-11e7-9085-0616e13d9f84"], "userName": ["\u5c0f\u3055\u3044\u3057\u3085\u3046\u3079\u3047"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "f14bb71a-5acc-11e9-9678-06e2180be028", "_score": 1.9978975, "fields": { "attributeId": ["WATER"], "displayCardId": [30325], "level": [100], "lastAccessDate": ["2024-07-29T13:59:51.000Z"], "inviteCode": ["Qf7D3ETn"], "cardId": [30325], "userRank": [104], "id": ["f14bb71a-5acc-11e9-9678-06e2180be028"], "userName": ["voc"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "a8b51fd1-347d-11ea-b840-06a704828d84", "_score": 1.9976445, "fields": { "attributeId": ["DARK"], "displayCardId": [22025], "level": [100], "lastAccessDate": ["2024-07-21T09:50:40.000Z"], "inviteCode": ["jt3sBEve"], "cardId": [22025], "userRank": [94], "id": ["a8b51fd1-347d-11ea-b840-06a704828d84"], "userName": ["\u30a2\u30eb\u30b9\u30ce\u30fc\u30c8"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "52f55a66-e8e1-11ed-bd31-06e8ad7ed813", "_score": 1.997492, "fields": { "attributeId": ["DARK"], "displayCardId": [20075], "level": [100], "lastAccessDate": ["2024-07-29T12:15:24.000Z"], "inviteCode": ["4yxmxhA4"], "cardId": [20075], "userRank": [101], "id": ["52f55a66-e8e1-11ed-bd31-06e8ad7ed813"], "userName": ["uu"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "25d9c577-89ee-11e7-9752-06f6c0566e00", "_score": 1.9974633, "fields": { "attributeId": ["LIGHT"], "displayCardId": [10015], "level": [100], "lastAccessDate": ["2024-07-25T14:07:29.000Z"], "inviteCode": ["kj7YuPWr"], "cardId": [10015], "userRank": [98], "id": ["25d9c577-89ee-11e7-9752-06f6c0566e00"], "userName": ["\u30e6\u30c3\u30ad\u30fc"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "51a6db5d-8737-11e7-8568-0651193e24ca", "_score": 1.9972265, "fields": { "attributeId": ["WATER"], "displayCardId": [10095], "level": [100], "lastAccessDate": ["2024-07-29T12:04:22.000Z"], "inviteCode": ["QxTz5LPa"], "cardId": [10095], "userRank": [103], "id": ["51a6db5d-8737-11e7-8568-0651193e24ca"], "userName": ["gorofuku"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "4d55d613-874a-11e7-a894-06761db22f3c", "_score": 1.9971958, "fields": { "attributeId": ["DARK"], "displayCardId": [22025], "level": [100], "lastAccessDate": ["2024-07-26T15:14:56.000Z"], "inviteCode": ["XWRv5abT"], "cardId": [22025], "userRank": [100], "id": ["4d55d613-874a-11e7-a894-06761db22f3c"], "userName": ["\u3055\u304b\u306a\u7d33\u58eb"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "fb2693a8-d3b5-11e7-9a97-0603dd80d6b8", "_score": 1.9969525, "fields": { "attributeId": ["DARK"], "displayCardId": [30595], "level": [100], "lastAccessDate": ["2024-07-28T16:46:38.000Z"], "inviteCode": ["pFntbKVr"], "cardId": [30595], "userRank": [99], "id": ["fb2693a8-d3b5-11e7-9a97-0603dd80d6b8"], "userName": ["\u79d1\u7814QB"], "cardRank": ["RANK_5"], "revision": [2] } }, { "_index": "friend_search", "_type": "user", "_id": "5c226588-a4d5-11ec-b1c7-06484f8854a5", "_score": 1.9969296, "fields": { "attributeId": ["TIMBER"], "displayCardId": [10085], "level": [100], "lastAccessDate": ["2024-07-29T07:28:49.000Z"], "inviteCode": ["26yMHnEd"], "cardId": [10085], "userRank": [96], "id": ["5c226588-a4d5-11ec-b1c7-06484f8854a5"], "userName": ["Tavi"], "cardRank": ["RANK_5"], "revision": [2] } }, { "_index": "friend_search", "_type": "user", "_id": "7dc9c6a6-228a-11ed-9423-06f444855491", "_score": 1.9965427, "fields": { "attributeId": ["DARK"], "displayCardId": [39025], "level": [100], "lastAccessDate": ["2024-07-29T07:21:07.000Z"], "inviteCode": ["DnfMQcrz"], "cardId": [39025], "userRank": [97], "id": ["7dc9c6a6-228a-11ed-9423-06f444855491"], "userName": ["\u8389\u7d05"], "cardRank": ["RANK_5"], "revision": [1] } }, { "_index": "friend_search", "_type": "user", "_id": "9f55070b-75db-11ec-b3ae-064d096ecb45", "_score": 1.996512, "fields": { "attributeId": ["TIMBER"], "displayCardId": [10085], "level": [100], "lastAccessDate": ["2024-07-28T15:02:32.000Z"], "inviteCode": ["DGyCxPb9"], "cardId": [10085], "userRank": [95], "id": ["9f55070b-75db-11ec-b3ae-064d096ecb45"], "userName": ["\u767d\u9f8d"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "295fdb36-8956-11e7-851c-060b340d924c", "_score": 1.9963361, "fields": { "attributeId": ["WATER"], "displayCardId": [10095], "level": [100], "lastAccessDate": ["2024-07-24T22:39:14.000Z"], "inviteCode": ["nxMHZP41"], "cardId": [10095], "userRank": [97], "id": ["295fdb36-8956-11e7-851c-060b340d924c"], "userName": ["\u30b3\u30af"], "cardRank": ["RANK_5"], "revision": [3] } }, { "_index": "friend_search", "_type": "user", "_id": "0a993bf5-4d78-11ea-a497-067afd3c9bee", "_score": 1.9963025, "fields": { "attributeId": ["TIMBER"], "displayCardId": [11205], "level": [100], "lastAccessDate": ["2024-07-29T15:26:34.000Z"], "inviteCode": ["eYj694PY"], "cardId": [11205], "userRank": [101], "id": ["0a993bf5-4d78-11ea-a497-067afd3c9bee"], "userName": ["\u3081\u308c\u3093\u3052\u3002"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "24dd27f9-3a42-11ee-9fc7-06e8ad7ed813", "_score": 1.9960351, "fields": { "attributeId": ["DARK"], "displayCardId": [20025], "level": [100], "lastAccessDate": ["2024-07-27T16:09:32.000Z"], "inviteCode": ["4QRjMQ5R"], "cardId": [20025], "userRank": [94], "id": ["24dd27f9-3a42-11ee-9fc7-06e8ad7ed813"], "userName": ["QB"], "cardRank": ["RANK_5"], "revision": [0] } }, { "_index": "friend_search", "_type": "user", "_id": "3c64d6eb-5d03-11ed-80cc-06cbb75d5b73", "_score": 1.9959867, "fields": { "attributeId": ["FIRE"], "displayCardId": [11215], "level": [100], "lastAccessDate": ["2024-07-27T05:43:20.000Z"], "inviteCode": ["LBzXBNT7"], "cardId": [11215], "userRank": [99], "id": ["3c64d6eb-5d03-11ed-80cc-06cbb75d5b73"], "userName": ["\u30ac\u5cf6\u30b7\u30e7\u30b3\u30e9"], "cardRank": ["RANK_5"], "revision": [3] } }] } }));
        let hdr = {};
        hdr['content-type'] = `application/json; charset=utf-8`;
        hdr['content-length'] = `${respBodyBuf.byteLength}`;
        hdr["cache-control"] = `no-cache`;
        ctx.statusCode = 200;
        ctx.respHeaders = hdr;
        ctx.respBody = respBodyBuf;
        ctx.fakeResp = true;
        log(`${method} ${pathInUrl} faked friend search body length=${respBodyBuf.byteLength}`);
        return false;
    }
    async fakeEmptyJson(ctx, url) {
        const method = ctx.method;
        const pathInUrl = url.pathname;
        const d = new Date(Date.now() + 9 * 3600 * 1000);
        let respBodyBuf = Buffer.from(JSON.stringify({ currentTime: `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}` }));
        let hdr = {};
        hdr['content-type'] = `application/json; charset=utf-8`;
        hdr['content-length'] = `${respBodyBuf.byteLength}`;
        hdr["cache-control"] = `no-cache`;
        ctx.statusCode = 200;
        ctx.respHeaders = hdr;
        ctx.respBody = respBodyBuf;
        ctx.fakeResp = true;
        log(`${method} ${pathInUrl} faked empty page json body length=${respBodyBuf.byteLength}`);
        return false;
    }
    async onMatchResponseHeaders(ctx) {
        log(`Response Headers ${ctx.method} origPath=[${ctx.origPath}] origStatusCode=[${ctx.origStatusCode}]`);
        return true;
    }
    async onMatchResponseBody(ctx) {
        var _a, _b, _c;
        log(`Response Body ${ctx.method} origPath=[${ctx.origPath}] origStatusCode=[${ctx.origStatusCode}] origRespBody.byteLength=[${(_a = ctx.origRespBody) === null || _a === void 0 ? void 0 : _a.byteLength}]`);
        if (ctx.method !== 'POST' && ctx.method !== 'GET')
            return;
        if (ctx.statusCode != 200)
            return;
        const url = new URL(`https://${this.jpDomain}${ctx.origPath}`);
        const pathInUrl = url.pathname;
        const writeFile = (path, data) => {
            if (fs.existsSync(path))
                warn(`[${pathInUrl}] [${path}] already exists!`);
            fs.writeFileSync(path, data);
            warn(`[${pathInUrl}] written to [${path}]`);
        };
        const respHeaders = ctx.respHeaders;
        const contentType = respHeaders === null || respHeaders === void 0 ? void 0 : respHeaders["content-type"];
        if (!(contentType === null || contentType === void 0 ? void 0 : contentType.startsWith('application/json')) && !(contentType === null || contentType === void 0 ? void 0 : contentType.startsWith('text/json')))
            return;
        let respBody = ctx.origRespBody;
        if (respBody == null)
            return;
        let reqBody = ctx.origReqBody;
        if (ctx.method === 'POST')
            if (reqBody == null) {
                error(`[${pathInUrl}] reqBody == null`);
                return;
            }
        const contentEncoding = respHeaders === null || respHeaders === void 0 ? void 0 : respHeaders["content-encoding"];
        if (contentEncoding != null) {
            try {
                respBody = (0, util_1.decompress)(respBody, contentEncoding);
            }
            catch (e) {
                error(`[${pathInUrl}] decompress respBody`, e);
                return;
            }
        }
        if (respBody.byteLength == index404_1.index404.byteLength && Buffer.compare(respBody, index404_1.index404) == 0) {
            log(`[${pathInUrl}] is fake index404`);
            return;
        }
        let req;
        if (ctx.method === 'POST')
            try {
                if (reqBody == null)
                    return;
                req = JSON.parse(reqBody.toString('utf-8'));
            }
            catch (e) {
                error(`cannot parse req json`, e);
                return;
            }
        let resp;
        try {
            resp = JSON.parse(respBody.toString('utf-8'));
        }
        catch (e) {
            error(`cannot parse resp json`, e);
            return;
        }
        if (pathInUrl === `/magica/api/quest/start`
            || pathInUrl === `/magica/api/quest/native/get`
            || pathInUrl === `/magica/api/page/TopPage`
            || pathInUrl === `/magica/api/page/CharaEnhancementTree`) {
            const questsDir = path.join('.', 'jp_quests');
            switch (pathInUrl) {
                case '/magica/api/quest/start': {
                    if (reqBody == null)
                        return;
                    const questBattleId = req.questBattleId;
                    if (typeof questBattleId !== 'number' || isNaN(questBattleId)) {
                        error(`[${pathInUrl}] questBattleId is not number`);
                        return;
                    }
                    if ((resp === null || resp === void 0 ? void 0 : resp.userQuestBattleResultList) == null)
                        return;
                    const id = (_b = resp === null || resp === void 0 ? void 0 : resp.userQuestBattleResultList[0]) === null || _b === void 0 ? void 0 : _b.id;
                    if (typeof id !== 'string') {
                        error(`[${pathInUrl}] id is not string`);
                        return;
                    }
                    if (!fs.existsSync(questsDir))
                        fs.mkdirSync(questsDir);
                    const reqWritePath = path.join(questsDir, `${questBattleId}-start-req.json`);
                    const respWritePath = path.join(questsDir, `${questBattleId}-start-resp.json`);
                    if (fs.existsSync(reqWritePath) && fs.existsSync(respWritePath)) {
                        warn(`[${pathInUrl}] [${questBattleId}] already exists`);
                    }
                    else {
                        fs.writeFileSync(reqWritePath, reqBody);
                        fs.writeFileSync(respWritePath, respBody);
                    }
                    this.QuestBattleResultMap.set(id, questBattleId);
                    warn(`[${pathInUrl}] [${id}] => [${questBattleId}]`);
                    break;
                }
                case '/magica/api/quest/native/get': {
                    if (reqBody == null)
                        return;
                    const userQuestBattleResultId = req.userQuestBattleResultId;
                    if (typeof userQuestBattleResultId !== 'string') {
                        error(`[${pathInUrl}] userQuestBattleResultId is not string`);
                        return;
                    }
                    const questBattleId = this.QuestBattleResultMap.get(userQuestBattleResultId);
                    if (questBattleId == null) {
                        error(`[${pathInUrl}] cannot find corresponding questBattleId (userQuestBattleResultId=${userQuestBattleResultId})`);
                        return;
                    }
                    if (!fs.existsSync(questsDir))
                        fs.mkdirSync(questsDir);
                    const reqWritePath = path.join(questsDir, `${questBattleId}-native-get-req.json`);
                    const respWritePath = path.join(questsDir, `${questBattleId}-native-get-resp.json`);
                    if (fs.existsSync(reqWritePath) && fs.existsSync(respWritePath)) {
                        warn(`[${pathInUrl}] [${questBattleId}] already exists`);
                        return;
                    }
                    fs.writeFileSync(reqWritePath, reqBody);
                    fs.writeFileSync(respWritePath, respBody);
                    this.QuestBattleResultMap.delete(userQuestBattleResultId);
                    warn(`[${pathInUrl}] [${userQuestBattleResultId}] => [${questBattleId}]`);
                    break;
                }
                case `/magica/api/page/TopPage`: {
                    let inviteCode = (_c = resp === null || resp === void 0 ? void 0 : resp.gameUser) === null || _c === void 0 ? void 0 : _c.inviteCode;
                    if (typeof inviteCode !== 'string') {
                        error(pathInUrl, `inviteCode is not string`);
                        return;
                    }
                    this.lastInviteCode = inviteCode;
                    break;
                }
                case `/magica/api/page/CharaEnhancementTree`: {
                    try {
                        let charaId = req.charaId;
                        if (isNaN(Number(charaId))) {
                            error(`charaId cannot be converted to number`);
                            return;
                        }
                        let charaEnhancementDir = path.join('.', 'charaEnhancement');
                        if (!fs.existsSync(charaEnhancementDir))
                            fs.mkdirSync(charaEnhancementDir);
                        let filename = `charaEnhancement-${this.lastInviteCode}-${charaId}.json`;
                        let writePath = path.join(charaEnhancementDir, filename);
                        writeFile(writePath, respBody);
                    }
                    catch (e) {
                        error(`${pathInUrl}`, e);
                    }
                    break;
                }
            }
        }
        if (pathInUrl.startsWith(`/magica/api/page/`)) {
            const lastInviteCode = this.lastInviteCode;
            if (lastInviteCode !== '') {
                const dir = path.join('.', 'user_page_jsons', lastInviteCode);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                const pageName = pathInUrl.replace(/^\/magica\/api\/page\//, "");
                const pageJsonPath = path.join(dir, `${pageName}.json`);
                writeFile(pageJsonPath, respBody);
                for (let key in resp) {
                    if (typeof resp[key] === 'object') {
                        let subdir = path.join(dir, pageName);
                        let subpath = path.join(subdir, `${key}.json`);
                        if (!fs.existsSync(subdir))
                            fs.mkdirSync(subdir, { recursive: true });
                        writeFile(subpath, JSON.stringify(resp[key]));
                    }
                }
            }
        }
    }
}
exports.jpApiHook = jpApiHook;
