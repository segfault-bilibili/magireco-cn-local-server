export declare class missingData {
    readonly "userId": string;
    private readonly createdAt;
    constructor(userId: string);
    get userChapterList(): ({
        chapterId: number;
        userId: string;
        chapter: {
            chapterId: number;
            partNo: number;
            chapterNo: number;
            chapterType: string;
            questType: string;
            chapterNoForView: string;
            title: string;
            sectionCount: number;
        };
        cleared: boolean;
        clearedAt: string;
        createdAt: string;
    } | {
        chapterId: number;
        userId: string;
        chapter: {
            chapterId: number;
            partNo: number;
            chapterNo: number;
            chapterType: string;
            questType: string;
            chapterNoForView: string;
            title: string;
            sectionCount: number;
        };
        cleared: boolean;
        createdAt: string;
        clearedAt?: undefined;
    })[];
    get userSectionList(): ({
        userId: string;
        sectionId: number;
        section: {
            sectionId: number;
            questType: string;
            genericId: number;
            genericIndex: number;
            parameter: string;
            secret: string;
            areaMapId: number;
            mapFileExtention: string;
            imagePath: string;
            areaDetailName: string;
            title: string;
            charaId: number;
            charaName: string;
            defaultCardId: number;
            message: string;
            outline: string;
            ap: number;
            difficulty: number;
            clearRewardCode: string;
            clearReward: ObjectConstructor[];
            openEnemyList: never[];
            openDate: string;
            openEnemy?: undefined;
        };
        canPlay: boolean;
        cleared: boolean;
        clearedAt: string;
        createdAt: string;
    } | {
        userId: string;
        sectionId: number;
        section: {
            sectionId: number;
            questType: string;
            genericId: number;
            genericIndex: number;
            parameter: string;
            secret: string;
            areaMapId: number;
            mapFileExtention: string;
            imagePath: string;
            areaDetailName: string;
            title: string;
            charaId: number;
            charaName: string;
            defaultCardId: number;
            message: string;
            outline: string;
            ap: number;
            difficulty: number;
            clearRewardCode: string;
            clearReward: ObjectConstructor[];
            openEnemy: string;
            openEnemyList: ArrayConstructor[];
            openDate: string;
        };
        canPlay: boolean;
        cleared: boolean;
        clearedAt: string;
        createdAt: string;
    })[];
    get userQuestBattleList(): ({
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            startStory: string;
            endStory: string;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            questStory?: undefined;
            storyWaveIndex?: undefined;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            startStory: string;
            endStory: string;
            questStory: string;
            storyWaveIndex: number;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            startStory: string;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            endStory?: undefined;
            questStory?: undefined;
            storyWaveIndex?: undefined;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            startStory: string;
            questStory: string;
            storyWaveIndex: number;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            endStory?: undefined;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            startStory: string;
            endStory: string;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3: string;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            questStory?: undefined;
            storyWaveIndex?: undefined;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            endStory: string;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
            startStory?: undefined;
            questStory?: undefined;
            storyWaveIndex?: undefined;
            npcHelpId?: undefined;
            npcHelpNameHidden?: undefined;
            npcHelpNameQuestHidden?: undefined;
            npcHelpDisplayHidden?: undefined;
            npcHelpSupportHidden?: undefined;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    } | {
        userId: string;
        questBattleId: number;
        questBattle: {
            questBattleId: number;
            sectionId: number;
            sectionIndex: number;
            questBattleType: string;
            bossFlag: boolean;
            npcHelpId: string;
            npcHelpNameHidden: boolean;
            npcHelpNameQuestHidden: boolean;
            npcHelpDisplayHidden: boolean;
            npcHelpSupportHidden: boolean;
            startStory: string;
            endStory: string;
            questStory: string;
            storyWaveIndex: number;
            placeId: string;
            bgm: string;
            bossBgm: string;
            consumeType: string;
            exp: number;
            cardExp: number;
            baseBondsPt: number;
            riche: number;
            firstClearRewardCodes: string;
            defaultDropItemId: number;
            defaultDropItem: {
                dropItemId: number;
                rewardCode1: string;
            };
            dropItemId1: number;
            dropItem1: {
                dropItemId: number;
                rewardCode1: string;
                rewardCode2: string;
                rewardCode3?: undefined;
            };
            mission1: string;
            missionMaster1: {
                description: string;
            };
            mission2: string;
            missionMaster2: {
                description: string;
            };
            mission3: string;
            missionMaster3: {
                description: string;
            };
            missionRewardCode: string;
            waveEnemyAttributeIdList: string[];
            parameterMap: {};
            automationPossibleAtFirst: boolean;
        };
        cleared: boolean;
        missionStatus1: string;
        missionStatus2: string;
        missionStatus3: string;
        rewardDone: boolean;
        firstClearedAt: string;
        lastClearedAt: string;
        clearCount: number;
        maxDamage: number;
        createdAt: string;
    })[];
    get userQuestAdventureList(): {
        userId: string;
        adventureId: string;
        skipped: boolean;
        createdAt: string;
    }[];
}
