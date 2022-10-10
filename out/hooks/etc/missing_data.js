"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.missingData = void 0;
class missingData {
    constructor(userId) {
        this.createdAt = "2020/10/13 13:00:00";
        this.userId = userId;
    }
    get userChapterList() {
        return [
            {
                chapterId: 21,
                userId: this.userId,
                chapter: {
                    chapterId: 21,
                    partNo: 2,
                    chapterNo: 0,
                    chapterType: "NORMAL",
                    questType: "MAIN",
                    chapterNoForView: "序章",
                    title: "起始的记载",
                    sectionCount: 1
                },
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt,
            },
            {
                chapterId: 22,
                userId: this.userId,
                chapter: {
                    chapterId: 22,
                    partNo: 2,
                    chapterNo: 1,
                    chapterType: "NORMAL",
                    questType: "MAIN",
                    chapterNoForView: "第1章",
                    title: "序言伴随着脚步声",
                    sectionCount: 4
                },
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt,
            },
            {
                chapterId: 23,
                userId: this.userId,
                chapter: {
                    chapterId: 23,
                    partNo: 2,
                    chapterNo: 2,
                    chapterType: "NORMAL",
                    questType: "MAIN",
                    chapterNoForView: "第2章",
                    title: "微笑与火花",
                    sectionCount: 2
                },
                cleared: false,
                createdAt: this.createdAt,
            },
        ];
    }
    get userSectionList() {
        return [
            {
                userId: this.userId,
                sectionId: 102101,
                section: {
                    sectionId: 102101,
                    questType: 'MAIN',
                    genericId: 21,
                    genericIndex: 1,
                    parameter: '1001',
                    secret: '7hv6A',
                    areaMapId: 102101,
                    mapFileExtention: 'png',
                    imagePath: '11021',
                    areaDetailName: '新西区·街道',
                    title: '二人的步调',
                    charaId: 1001,
                    charaName: '环彩羽',
                    defaultCardId: 10011,
                    message: '奇妙的魔力反应？＠忧，你能告诉我＠是从哪里感知到的吗？',
                    outline: '神滨市因强大魔女的攻击遭到了重创。神滨的魔法少女们正在帮助重建神滨，并结成了一个大团体。＠在这个“神滨魔法联盟”中，有以彩羽一行为首的三日月别墅成员，也有曾是敌人、打算“解放魔法少女”的“玛吉斯之翼”成员。＠魔法少女终将变成她们所讨伐的敌人——魔女，“解放魔法少女”的目的就是为了逃离这种命运。在“自动净化系统”的帮助下，只有在神滨市的魔法少女能不变成魔女，而今后就要想办法将这种影响扩散至全世界。＠就在这时，几个黑影逼近了神滨，即将打破短暂的和平。',
                    ap: 7,
                    difficulty: 10,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102201,
                section: {
                    sectionId: 102201,
                    questType: 'MAIN',
                    genericId: 22,
                    genericIndex: 1,
                    parameter: '1001',
                    secret: 'y8o0a',
                    areaMapId: 102201,
                    mapFileExtention: 'png',
                    imagePath: '21201',
                    areaDetailName: '八千代的家·客厅',
                    title: '立下约定的少女们',
                    charaId: 1001,
                    charaName: '环彩羽',
                    defaultCardId: 10011,
                    message: '窗户也上锁了，＠之后只要出门就好！',
                    outline: '忧察觉到了奇怪的魔力反应，那既不是魔女也不是传闻，是有别于他们的新事物。＠彩羽一行追踪着这个反应，于是遇上了谜团重重的敌人，对方只能用“魔女”这个词来形容，但她们依旧不清楚她的真面目。＠谜团不止这一个。环在打倒敌人后，手腕上出现了手镯，这让她十分不安。＠而遇到过彩羽一行的“佐鸟笼目”此时已拿起了笔，想将魔法少女的情况公诸于世。',
                    ap: 7,
                    difficulty: 10,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102202,
                section: {
                    sectionId: 102202,
                    questType: 'MAIN',
                    genericId: 22,
                    genericIndex: 2,
                    parameter: '1002',
                    secret: 'c0RDf',
                    areaMapId: 102202,
                    mapFileExtention: 'png',
                    imagePath: '12022',
                    areaDetailName: '水名区·街道',
                    title: '为他人努力着的少女们',
                    charaId: 1002,
                    charaName: '七海八千代',
                    defaultCardId: 10022,
                    message: '既然是美冬准备的，＠那这些吃的肯定都是她从店里买来的。',
                    outline: '身为神滨魔法联盟的中心人物，彩羽思考了很多。而最令人烦恼的莫过于出现在自己手腕上的“手镯”。＠但在未知魔法少女的魔力反应出现后，状况开始有了改变。＠彩羽一行回到了得到手镯的地方，她们在那里遭到了神秘魔法少女的袭击。对手是由好几名魔法少女组成的集团，领头的少女自称是“红晴结菜”与“煌里光”，之后便离开了。＠而其他魔法少女也逐渐聚集到了神滨。',
                    ap: 7,
                    difficulty: 10,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102203,
                section: {
                    sectionId: 102203,
                    questType: 'MAIN',
                    genericId: 22,
                    genericIndex: 3,
                    parameter: '1026',
                    secret: 'RwJVJ',
                    areaMapId: 102203,
                    mapFileExtention: 'png',
                    imagePath: '21421',
                    areaDetailName: '荣区·大公园',
                    title: '逐梦少女们',
                    charaId: 1026,
                    charaName: '广江千春',
                    defaultCardId: 10264,
                    message: '咦？大家看起来好奇怪……＠我有说什么奇怪的话吗？',
                    outline: '彩羽与八千代与二木市的魔法少女“应许之血”发生了冲突。过了一阵子，她们为了解开手镯上的谜团来到了灯花她们所在的射电望远镜处。忧一行带着刚离开乡下的“时女静香”、“广江千春”和“土岐沙绪”逛神滨，以便帮助她们克服对人群的恐惧。＠在路上，忧一行人得知静香她们是名为“时女一族”的魔法少女，并与她们共同战斗，打倒了新出现的不明敌人。而彩羽她们得到了灯花的分析结果，离手镯的真相更进一步了。＠就在这时，迷信“魔法少女至上”主义的魔法少女与二木市的结菜与光正赶向射电望远镜处。',
                    ap: 7,
                    difficulty: 10,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemy: '149',
                    openEnemyList: [Array],
                    openDate: '2022/05/19 13:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102204,
                section: {
                    sectionId: 102204,
                    questType: 'MAIN',
                    genericId: 22,
                    genericIndex: 4,
                    parameter: '1012',
                    secret: 'yV4hL',
                    areaMapId: 102204,
                    mapFileExtention: 'png',
                    imagePath: '17121',
                    areaDetailName: '大东区·摩天轮草原',
                    title: '记录着的少女',
                    charaId: 1012,
                    charaName: '御园花凛',
                    defaultCardId: 10124,
                    message: '我、我一提起玛吉斯＠就惹人生气了……',
                    outline: '彩羽与八千代为了调查手镯来到了射电望远镜处。她们在那里遇到了“宫尾时雨”与“安积育梦”这两名信奉“魔法少女至上主义”的新玛吉斯成员。二人想要带走灯花与音梦，不料却被以结菜为首的应许之血与带着时女一族出现的鹤乃一行打乱了计划。一片混战中，彩羽得知了各个团体为得到自动净化系统、寻求巨大能量的原因。＠对彩羽她们而言，将自动净化系统的影响扩散至全世界是有必要的。彩羽提议一起去找给出情报的丘比问个明白。＠而此时的花凛正陷入苦战。',
                    ap: 7,
                    difficulty: 10,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102301,
                section: {
                    sectionId: 102301,
                    questType: 'MAIN',
                    genericId: 23,
                    genericIndex: 1,
                    parameter: '1012',
                    secret: 'Z9WSZ',
                    areaMapId: 102301,
                    mapFileExtention: 'png',
                    imagePath: '21014',
                    areaDetailName: '里见医疗中心',
                    title: '哞哞牧场疑云',
                    charaId: 1012,
                    charaName: '御园花凛',
                    defaultCardId: 10124,
                    message: '……',
                    outline: '来到射电望远镜处的彩羽一行得知，保存了能量的石头其实就是夏娃的碎片。而争抢自动净化系统获取能量这件事说穿了只是丘比利用她们做的一场实验。＠在那之后，彩羽一行在返程途中得知笼目被“散播魔法少女的相关信息的传闻”附身了。接着她们就遇到了“莉薇娅·梅黛洛斯”、“篠目夜鹤”和“佐和月出里”这三名调整专家。＠而遭到应许之血攻击的花凛虽然得到了同伴的帮助，但她依旧挺身而出作战，为此身负重伤。对手自称是“大庭树里”与“笠音青”后便离开了。',
                    ap: 7,
                    difficulty: 20,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                sectionId: 102302,
                section: {
                    sectionId: 102302,
                    questType: 'MAIN',
                    genericId: 23,
                    genericIndex: 2,
                    parameter: '1001',
                    secret: 'ZdxJi',
                    areaMapId: 102302,
                    mapFileExtention: 'png',
                    imagePath: '13033',
                    areaDetailName: '参京区·街道',
                    title: '敌影重重',
                    charaId: 1001,
                    charaName: '环彩羽',
                    defaultCardId: 10011,
                    message: '要跟桃子打电话才行，＠花凛她没事吧？',
                    outline: '魔法少女们开始寻找心魔之石以得到自动净化系统。为了找到心魔，彩羽一行假装四处玩耍，掌握了心魔的大致位置。＠而应许之血的青与光追踪着彩羽一行，来到了心魔的所在地，即北养区的哞哞牧场。但那只是彩羽一行设下的陷阱。青与光陷入了绝境，但在结菜与树里的帮助之下，她们顺利脱困了。＠结菜想得到熟悉神滨之人的帮助。树里物色起了人选，然后与新玛吉斯的时雨与育梦接触，逼迫她们为自己所用。',
                    ap: 7,
                    difficulty: 20,
                    clearRewardCode: 'ITEM_PRESENTED_MONEY_5',
                    clearReward: [Object],
                    openEnemyList: [],
                    openDate: '2099/01/01 12:00:00'
                },
                canPlay: true,
                cleared: true,
                clearedAt: this.createdAt,
                createdAt: this.createdAt
            },
        ];
    }
    get userQuestBattleList() {
        return [
            {
                userId: this.userId,
                questBattleId: 1021011,
                questBattle: {
                    questBattleId: 1021011,
                    sectionId: 102101,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102101-1",
                    endStory: "102101-2",
                    placeId: "21181",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8111,
                    dropItem1: {
                        dropItemId: 8111,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 52550,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1021012,
                questBattle: {
                    questBattleId: 1021012,
                    sectionId: 102101,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102101-3",
                    endStory: "102101-5",
                    questStory: "102101-4",
                    storyWaveIndex: 1,
                    placeId: "11095",
                    bgm: "bgm01_battle01",
                    bossBgm: "bgm02_boss01",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8211,
                    dropItem1: {
                        dropItemId: 8211,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 39609,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1021013,
                questBattle: {
                    questBattleId: 1021013,
                    sectionId: 102101,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102101-6",
                    endStory: "102101-8",
                    questStory: "102101-7",
                    storyWaveIndex: 1,
                    placeId: "11095",
                    bgm: "bgm22_battle21",
                    bossBgm: "bgm22_battle21",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_873_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8711,
                    dropItem1: {
                        dropItemId: 8711,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 3,
                maxDamage: 41061,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022011,
                questBattle: {
                    questBattleId: 1022011,
                    sectionId: 102201,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-1",
                    endStory: "102201-2",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8311,
                    dropItem1: {
                        dropItemId: 8311,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 86806,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022012,
                questBattle: {
                    questBattleId: 1022012,
                    sectionId: 102201,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-3",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8411,
                    dropItem1: {
                        dropItemId: 8411,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 29413,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022013,
                questBattle: {
                    questBattleId: 1022013,
                    sectionId: 102201,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-4",
                    endStory: "102201-5",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8511,
                    dropItem1: {
                        dropItemId: 8511,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 46690,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022014,
                questBattle: {
                    questBattleId: 1022014,
                    sectionId: 102201,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-6",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8611,
                    dropItem1: {
                        dropItemId: 8611,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 93146,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022015,
                questBattle: {
                    questBattleId: 1022015,
                    sectionId: 102201,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-7",
                    endStory: "102201-8",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8711,
                    dropItem1: {
                        dropItemId: 8711,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 50410,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022016,
                questBattle: {
                    questBattleId: 1022016,
                    sectionId: 102201,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-9",
                    questStory: "102201-10",
                    storyWaveIndex: 1,
                    placeId: "11022",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle09",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8811,
                    dropItem1: {
                        dropItemId: 8811,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45614,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022017,
                questBattle: {
                    questBattleId: 1022017,
                    sectionId: 102201,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-11",
                    endStory: "102201-13",
                    questStory: "102201-12",
                    storyWaveIndex: 1,
                    placeId: "11022",
                    bgm: "bgm22_battle08",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8111,
                    dropItem1: {
                        dropItemId: 8111,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 30281,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022018,
                questBattle: {
                    questBattleId: 1022018,
                    sectionId: 102201,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102201-14",
                    endStory: "102201-15",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8211,
                    dropItem1: {
                        dropItemId: 8211,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 2,
                maxDamage: 48795,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022021,
                questBattle: {
                    questBattleId: 1022021,
                    sectionId: 102202,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-1",
                    endStory: "102202-2",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 48061,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022022,
                questBattle: {
                    questBattleId: 1022022,
                    sectionId: 102202,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-3",
                    endStory: "102202-4",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 29133,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022023,
                questBattle: {
                    questBattleId: 1022023,
                    sectionId: 102202,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-5",
                    endStory: "102202-6",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 30033,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022024,
                questBattle: {
                    questBattleId: 1022024,
                    sectionId: 102202,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-7",
                    endStory: "102202-8",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 39996,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022025,
                questBattle: {
                    questBattleId: 1022025,
                    sectionId: 102202,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-9",
                    endStory: "102202-10",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8712,
                    dropItem1: {
                        dropItemId: 8712,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 49480,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022026,
                questBattle: {
                    questBattleId: 1022026,
                    sectionId: 102202,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-11",
                    endStory: "102202-12",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8812,
                    dropItem1: {
                        dropItemId: 8812,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45041,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022027,
                questBattle: {
                    questBattleId: 1022027,
                    sectionId: 102202,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-13",
                    questStory: "102202-14",
                    storyWaveIndex: 1,
                    placeId: "15063",
                    bgm: "bgm01_battle01",
                    bossBgm: "bgm02_boss01",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8112,
                    dropItem1: {
                        dropItemId: 8112,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45897,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022028,
                questBattle: {
                    questBattleId: 1022028,
                    sectionId: 102202,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-15",
                    placeId: "15063",
                    bgm: "bgm22_battle22",
                    bossBgm: "bgm22_battle22",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_863_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 28327,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022029,
                questBattle: {
                    questBattleId: 1022029,
                    sectionId: 102202,
                    sectionIndex: 9,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-16",
                    endStory: "102202-17",
                    placeId: "15063",
                    bgm: "bgm22_battle22",
                    bossBgm: "bgm22_battle22",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_863_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 47167,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 10220210,
                questBattle: {
                    questBattleId: 10220210,
                    sectionId: 102202,
                    sectionIndex: 10,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102202-18",
                    endStory: "102202-19",
                    placeId: "47105",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8212,
                    dropItem1: {
                        dropItemId: 8212,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 71659,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022031,
                questBattle: {
                    questBattleId: 1022031,
                    sectionId: 102203,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-1",
                    endStory: "102203-2",
                    placeId: "19151",
                    bgm: "bgm22_battle13",
                    bossBgm: "bgm22_battle13",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 51179,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022032,
                questBattle: {
                    questBattleId: 1022032,
                    sectionId: 102203,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-3",
                    endStory: "102203-4",
                    placeId: "17022",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle09",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45760,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022033,
                questBattle: {
                    questBattleId: 1022033,
                    sectionId: 102203,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-5",
                    endStory: "102203-7",
                    questStory: "102203-6",
                    storyWaveIndex: 1,
                    placeId: "19151",
                    bgm: "bgm22_battle13",
                    bossBgm: "bgm22_battle13",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 106288,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022034,
                questBattle: {
                    questBattleId: 1022034,
                    sectionId: 102203,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-8",
                    endStory: "102203-9",
                    placeId: "17122",
                    bgm: "bgm01_battle01",
                    bossBgm: "bgm02_boss01",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 35858,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022035,
                questBattle: {
                    questBattleId: 1022035,
                    sectionId: 102203,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-10",
                    endStory: "102203-12",
                    questStory: "102203-11",
                    storyWaveIndex: 1,
                    placeId: "19152",
                    bgm: "bgm22_battle08",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8712,
                    dropItem1: {
                        dropItemId: 8712,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 39334,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022036,
                questBattle: {
                    questBattleId: 1022036,
                    sectionId: 102203,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-13",
                    endStory: "102203-15",
                    questStory: "102203-14",
                    storyWaveIndex: 1,
                    placeId: "17122",
                    bgm: "bgm22_battle23",
                    bossBgm: "bgm22_battle23",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_833_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 21562,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022037,
                questBattle: {
                    questBattleId: 1022037,
                    sectionId: 102203,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-16",
                    endStory: "102203-17",
                    placeId: "46109",
                    bgm: "bgm20_song05",
                    bossBgm: "bgm20_song05",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 10220371,
                    dropItem1: {
                        dropItemId: 10220371,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2",
                        rewardCode3: "GIFT_559_1"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 35334,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022038,
                questBattle: {
                    questBattleId: 1022038,
                    sectionId: 102203,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102203-18",
                    endStory: "102203-19",
                    placeId: "47103",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8112,
                    dropItem1: {
                        dropItemId: 8112,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 67712,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022041,
                questBattle: {
                    questBattleId: 1022041,
                    sectionId: 102204,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-1",
                    endStory: "102204-2",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8212,
                    dropItem1: {
                        dropItemId: 8212,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 44073,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022042,
                questBattle: {
                    questBattleId: 1022042,
                    sectionId: 102204,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-3",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45261,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022043,
                questBattle: {
                    questBattleId: 1022043,
                    sectionId: 102204,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-4",
                    endStory: "102204-5",
                    placeId: "17123",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle09",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 113397,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022044,
                questBattle: {
                    questBattleId: 1022044,
                    sectionId: 102204,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-6",
                    endStory: "102204-8",
                    questStory: "102204-7",
                    storyWaveIndex: 1,
                    placeId: "17123",
                    bgm: "bgm22_battle08",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 35617,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022045,
                questBattle: {
                    questBattleId: 1022045,
                    sectionId: 102204,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-9",
                    placeId: "17123",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle09",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 43209,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022046,
                questBattle: {
                    questBattleId: 1022046,
                    sectionId: 102204,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-10",
                    endStory: "102204-11",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8712,
                    dropItem1: {
                        dropItemId: 8712,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 39090,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022047,
                questBattle: {
                    questBattleId: 1022047,
                    sectionId: 102204,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-12",
                    endStory: "102204-13",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8812,
                    dropItem1: {
                        dropItemId: 8812,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45159,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022048,
                questBattle: {
                    questBattleId: 1022048,
                    sectionId: 102204,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-14",
                    endStory: "102204-15",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8112,
                    dropItem1: {
                        dropItemId: 8112,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 2,
                maxDamage: 51388,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1022049,
                questBattle: {
                    questBattleId: 1022049,
                    sectionId: 102204,
                    sectionIndex: 9,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102204-16",
                    endStory: "102204-17",
                    placeId: "47104",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8212,
                    dropItem1: {
                        dropItemId: 8212,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 44933,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023011,
                questBattle: {
                    questBattleId: 1023011,
                    sectionId: 102301,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    endStory: "102301-1",
                    placeId: "21251",
                    bgm: "bgm02_boss02",
                    bossBgm: "bgm02_boss02",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "TIMBER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 8,
                maxDamage: 112837,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023012,
                questBattle: {
                    questBattleId: 1023012,
                    sectionId: 102301,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-2",
                    endStory: "102301-3",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 5,
                maxDamage: 55042,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023013,
                questBattle: {
                    questBattleId: 1023013,
                    sectionId: 102301,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-4",
                    endStory: "102301-5",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 30151,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023014,
                questBattle: {
                    questBattleId: 1023014,
                    sectionId: 102301,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-6",
                    endStory: "102301-7",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 42280,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023015,
                questBattle: {
                    questBattleId: 1023015,
                    sectionId: 102301,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-8",
                    endStory: "102301-9",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8712,
                    dropItem1: {
                        dropItemId: 8712,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 41274,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023016,
                questBattle: {
                    questBattleId: 1023016,
                    sectionId: 102301,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-10",
                    endStory: "102301-11",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8812,
                    dropItem1: {
                        dropItemId: 8812,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 29283,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023017,
                questBattle: {
                    questBattleId: 1023017,
                    sectionId: 102301,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-12",
                    endStory: "102301-13",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8112,
                    dropItem1: {
                        dropItemId: 8112,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 43155,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023018,
                questBattle: {
                    questBattleId: 1023018,
                    sectionId: 102301,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-14",
                    placeId: "47001",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8212,
                    dropItem1: {
                        dropItemId: 8212,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "WATER",
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 31768,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023019,
                questBattle: {
                    questBattleId: 1023019,
                    sectionId: 102301,
                    sectionIndex: 9,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-15",
                    endStory: "102301-17",
                    questStory: "102301-16",
                    storyWaveIndex: 1,
                    placeId: "19302",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 94325,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 10230110,
                questBattle: {
                    questBattleId: 10230110,
                    sectionId: 102301,
                    sectionIndex: 10,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102301-18",
                    endStory: "102301-20",
                    questStory: "102301-19",
                    storyWaveIndex: 1,
                    placeId: "21593",
                    bgm: "bgm22_battle13",
                    bossBgm: "bgm22_battle13",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "FIRE"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 38376,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023021,
                questBattle: {
                    questBattleId: 1023021,
                    sectionId: 102302,
                    sectionIndex: 1,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-1",
                    endStory: "102302-2",
                    placeId: "47000",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 7,
                maxDamage: 92270,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023022,
                questBattle: {
                    questBattleId: 1023022,
                    sectionId: 102302,
                    sectionIndex: 2,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-3",
                    endStory: "102302-4",
                    placeId: "47000",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_862_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8612,
                    dropItem1: {
                        dropItemId: 8612,
                        rewardCode1: "GIFT_861_1",
                        rewardCode2: "GIFT_861_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 2,
                maxDamage: 40547,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023023,
                questBattle: {
                    questBattleId: 1023023,
                    sectionId: 102302,
                    sectionIndex: 3,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-5",
                    endStory: "102302-7",
                    questStory: "102302-6",
                    storyWaveIndex: 1,
                    placeId: "16021",
                    bgm: "bgm22_battle13",
                    bossBgm: "bgm22_battle13",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_872_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8712,
                    dropItem1: {
                        dropItemId: 8712,
                        rewardCode1: "GIFT_871_1",
                        rewardCode2: "GIFT_871_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 24803,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023024,
                questBattle: {
                    questBattleId: 1023024,
                    sectionId: 102302,
                    sectionIndex: 4,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-8",
                    endStory: "102302-9",
                    placeId: "47000",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_882_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8812,
                    dropItem1: {
                        dropItemId: 8812,
                        rewardCode1: "GIFT_881_1",
                        rewardCode2: "GIFT_881_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 45322,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023025,
                questBattle: {
                    questBattleId: 1023025,
                    sectionId: 102302,
                    sectionIndex: 5,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-10",
                    endStory: "102302-11",
                    placeId: "47000",
                    bgm: "bgm01_anime12",
                    bossBgm: "bgm01_anime12",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_812_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8112,
                    dropItem1: {
                        dropItemId: 8112,
                        rewardCode1: "GIFT_811_1",
                        rewardCode2: "GIFT_811_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "TIMBER",
                        "DARK"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 43704,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023026,
                questBattle: {
                    questBattleId: 1023026,
                    sectionId: 102302,
                    sectionIndex: 6,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-12",
                    endStory: "102302-14",
                    questStory: "102302-13",
                    storyWaveIndex: 1,
                    placeId: "14028",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_822_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8212,
                    dropItem1: {
                        dropItemId: 8212,
                        rewardCode1: "GIFT_821_1",
                        rewardCode2: "GIFT_821_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 50003,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023027,
                questBattle: {
                    questBattleId: 1023027,
                    sectionId: 102302,
                    sectionIndex: 7,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-15",
                    endStory: "102302-17",
                    questStory: "102302-16",
                    storyWaveIndex: 1,
                    placeId: "14133",
                    bgm: "bgm01_battle10",
                    bossBgm: "bgm01_battle10",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_832_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8312,
                    dropItem1: {
                        dropItemId: 8312,
                        rewardCode1: "GIFT_831_1",
                        rewardCode2: "GIFT_831_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "VOID"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 2,
                maxDamage: 68397,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023028,
                questBattle: {
                    questBattleId: 1023028,
                    sectionId: 102302,
                    sectionIndex: 8,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    npcHelpId: "179,180",
                    npcHelpNameHidden: false,
                    npcHelpNameQuestHidden: false,
                    npcHelpDisplayHidden: false,
                    npcHelpSupportHidden: false,
                    startStory: "102302-18",
                    endStory: "102302-20",
                    questStory: "102302-19",
                    storyWaveIndex: 1,
                    placeId: "19137",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle09",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_842_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8412,
                    dropItem1: {
                        dropItemId: 8412,
                        rewardCode1: "GIFT_841_1",
                        rewardCode2: "GIFT_841_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 109817,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                questBattleId: 1023029,
                questBattle: {
                    questBattleId: 1023029,
                    sectionId: 102302,
                    sectionIndex: 9,
                    questBattleType: "NORMAL",
                    bossFlag: false,
                    startStory: "102302-21",
                    endStory: "102302-23",
                    questStory: "102302-22",
                    storyWaveIndex: 1,
                    placeId: "14028",
                    bgm: "bgm22_battle09",
                    bossBgm: "bgm22_battle08",
                    consumeType: "NORMAL",
                    exp: 42,
                    cardExp: 100,
                    baseBondsPt: 56,
                    riche: 476,
                    firstClearRewardCodes: "GIFT_852_1",
                    defaultDropItemId: 106,
                    defaultDropItem: {
                        dropItemId: 106,
                        rewardCode1: "RICHE_300"
                    },
                    dropItemId1: 8512,
                    dropItem1: {
                        dropItemId: 8512,
                        rewardCode1: "GIFT_851_1",
                        rewardCode2: "GIFT_851_2"
                    },
                    mission1: "NOT_DEAD",
                    missionMaster1: {
                        description: "无人退场下通关"
                    },
                    mission2: "ACTION_15",
                    missionMaster2: {
                        description: "15回合内通关"
                    },
                    mission3: "NOT_CONTINUE",
                    missionMaster3: {
                        description: "不使用续关下通关"
                    },
                    missionRewardCode: "ITEM_PRESENTED_MONEY_3",
                    waveEnemyAttributeIdList: [
                        "FIRE",
                        "WATER",
                        "LIGHT"
                    ],
                    parameterMap: {},
                    automationPossibleAtFirst: true
                },
                cleared: true,
                missionStatus1: "CLEARED",
                missionStatus2: "CLEARED",
                missionStatus3: "CLEARED",
                rewardDone: true,
                firstClearedAt: this.createdAt,
                lastClearedAt: this.createdAt,
                clearCount: 1,
                maxDamage: 44100,
                createdAt: this.createdAt
            }
        ];
    }
    get userQuestAdventureList() {
        return [
            {
                userId: this.userId,
                adventureId: "102101-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102101-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-9",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-9",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-9",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-9",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-9",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102303-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-1",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-2",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-3",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-4",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-5",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-6",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-7",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102304-8",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-11",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102201-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-11",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-13",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-15",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-16",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-17",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102202-18",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-11",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-13",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-15",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-16",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-17",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-18",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102203-19",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102204-16",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-11",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-13",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-15",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-16",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-17",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-18",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-19",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102301-20",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-10",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-11",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-12",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-13",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-14",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-15",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-16",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-17",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-18",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-19",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-20",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-21",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-22",
                skipped: true,
                createdAt: this.createdAt
            },
            {
                userId: this.userId,
                adventureId: "102302-23",
                skipped: true,
                createdAt: this.createdAt
            }
        ];
    }
}
exports.missingData = missingData;
