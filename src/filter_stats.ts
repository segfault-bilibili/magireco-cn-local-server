import * as fs from "fs";
import * as path from "path";

export const filterStats = () => {
    const unresolvedImgPaths = new Map<string, string>(JSON.parse(fs.readFileSync('unresolvedImgPaths.json', 'utf-8')));
    const errImgPaths = new Map<string, string>(JSON.parse(fs.readFileSync('errImgPaths.json', 'utf-8')));

    let filtered = Array.from(unresolvedImgPaths).filter((e) => {
        let url = e[0], src = e[1];
        if (!url.startsWith('/magica/')) url = `/magica/${url}`;
        if (url.startsWith('/magica/resource/image_native')) return false;
        if (url.includes(' resDir ')) return false;
        return true;
    });

    fs.writeFileSync('unresolvedImgPaths_filtered.json', JSON.stringify(filtered, undefined, 2));
    console.log('unresolvedImgPaths_filtered.json', filtered.length);


    const errImgPaths_image_web = new Map();
    function checkFile(p: string) { if (!p.startsWith('/magica/')) p = `/magica/${p}`; return fs.existsSync(path.join('static_staging_jp', p)) }
    filtered = Array.from(errImgPaths).filter((e) => {
        let url = e[0], src = e[1];
        let origUrl = url;
        if (!url.startsWith('/magica/')) url = `/magica/${url}`;

        if (checkFile(url)) return false;
        if (checkFile(`/magica/resource/image_native/tips/${origUrl}`)) return false;
        if (checkFile(`/magica/resource/image_native/bg/story/${origUrl}`)) return false;
        if (checkFile(`/magica/resource/image_web/page/mission/doppelMission/common${origUrl}`)) return false;
        if (origUrl.includes(' ')) {
            let filtered = origUrl.split(' ').filter(u => !checkFile(`/magica/resource/image_web/event/singleraid/common/animation/${u}`));
            if (filtered.length == 0) return false;
        }

        if (src === "replacement_cn.js") return false;
        let checkedOkaySrc = new Set([
            "js/view/mission/MissionTopView.js",
            "js/gacha/GachaResult.js",
            "js/collection/DoppelCollection.js",
            "js/view/user/GlobalMenuView.js",
            "js/gacha/GachaTop.js",
            "js/test/RealGachaTop.js",
            "js/event/accomplish/EventAccomplishTop.js",
            "js/quest/EventQuest.js",
            "js/quest/puellaHistoria/MirrorPartsView.js",
            "js/mission/DoppelMissionTop.js",
            "template/event/raid/EventRaidTop.html", // only two, covered by replacement_cn
            "template/event/raid/EventRaidCurePopupParts.html",
            "template/event/raid/EventRaidRewardParts.html",
            "template/patrol/PatrolTop.html",
            "template/event/singleraid/EventSingleRaidTop.html",
            "template/event/singleraid/EventSingleRaidSelect.html",
            "template/base/ItemImgView.html",
            "template/event/dailytower/EventDailyTowerTop.html", // incomplete
            "template/formation/DeckFormation.html",
            "template/event/accomplish/EventAccomplishTop.html",
            "template/event/training/EventTrainingCharaSelect.html",
            "template/arena/ArenaConfirm.html",
            "template/event/arenaMission/EventArenaMissionConfirm.html", // only one, covered by replacement_cn
            "template/event/arenaMission/EventArenaMissionTop.html",
            "template/event/arenaMission/EventArenaMissionResult.html",
            "template/event/branch/EventBranchTop.html", // incomplete, lacks item id
            "template/event/tower/EventTowerTop.html",
            "template/event/dungeon/EventDungeonTop.html",
            "template/event/dungeon/EventDungeonClearAnimation.html",
            "template/event/storyraid/EventStoryRaidSelect.html", // not exist in StoryCollection
            "template/event/storyraid/EventStoryRaidBoss.html",
            "template/event/storyraid/EventStoryRaidTop.html",
            "template/regularEvent/groupBattle/RegularEventGroupBattleMission.html", // ignore
            "template/follow/FollowPopup.html", // titles
            "template/user/SetTitlePopup.html",
            "template/event/EventArenaRankMatch/Result.html",
            "template/event/EventWitch/parts/IconCharaGauge.html",
            "template/quest/puellaHistoria/lastBattle/QuestResultSubBoss.html",
            "template/quest/puellaHistoria/lastBattle/Stamp.html",
            "template/arena/ArenaResult.html",
            "template/arena/ArenaTop.html",
            "template/arena/ArenaReward.html",
            "template/present/GachaHistory.html",
            "template/test/PresentListTest.html",
            "template/test/Backdoor.html",
            "template/quest/SectionClearAnimation.html",
            "template/quest/EventQuest.html",
            "template/quest/PreQuestPopup.html",
            "template/quest/SupportSelect.html",
            "template/collection/MagiRepoDetail.html",
            "template/item/ItemListTop.html", // stickers
            "template/tutorial/TutorialNavi.html", // incomplete, dont know how to handle campaign
        ]);
        if (checkedOkaySrc.has(src)) return false;

        if (url.startsWith('/magica/resource/image_web/')) {
            errImgPaths_image_web.set(origUrl, src);
            return false;
        }
        return true;
    });

    fs.writeFileSync('errImgPaths_filtered.json', JSON.stringify(filtered, undefined, 2));
    console.log('errImgPaths_filtered.json', filtered.length);


    fs.writeFileSync('errImgPaths_image_web.json', JSON.stringify(Array.from(errImgPaths_image_web.entries()), undefined, 2));
    console.log('errImgPaths_image_web.json', errImgPaths_image_web.size);
}