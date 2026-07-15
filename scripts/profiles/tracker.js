import { MODULE_ID } from "../config.js";
import { getTurnState } from "../state.js";
import { getKnownTargetData, getTargetRangeBand, getTargetToken } from "../utils.js";
import { getWeapons, weaponCoversRange } from "../data.js";

function detail(label, value, hidden = false) {
    return { label, value: hidden ? "?" : value ?? "—" };
}

function getMassBattleLinks(actor) {
    const armies = game.actors.filter(
        (candidate) =>
            candidate.type === "army" &&
            (game.user.isGM || candidate.testUserPermission(game.user, "OBSERVER")) &&
            [candidate.system?.commander_actor_id, candidate.system?.warlord_actor_id].includes(actor.id),
    );
    const cohorts = [];
    for (const army of game.actors.filter(
        (candidate) => candidate.type === "army" && (game.user.isGM || candidate.testUserPermission(game.user, "OBSERVER")),
    )) {
        for (const item of army.items.filter((candidate) => candidate.type === "army_cohort")) {
            if (item.system?.leader_actor_id === actor.id) cohorts.push({ item, army });
        }
    }
    return { armies, cohorts };
}

export function getProfileTrackerData(actor, profile) {
    const combat = game.combat?.started ? game.combat : null;
    if (!combat || profile === "universal") return null;
    const flags = combat.flags?.[MODULE_ID] ?? {};

    if (profile === "intrigue") {
        const context = flags.intrigue ?? {};
        const objectiveHidden = !!context.secret && !game.user.isGM;
        const selectedTargets = Array.from(game.user.targets ?? [])
            .map((token) => getKnownTargetData(token.document))
            .filter(Boolean)
            .map((target) => target.name)
            .join(", ");
        const targetToken = getTargetToken();
        const targetData = getKnownTargetData(targetToken);
        const targetStatus = targetData?.observer ? Number(targetToken.actor?.system?.social?.status ?? 0) : null;
        const actorStatus = Number(actor.system?.social?.status ?? 0);
        const statusRelation = Number.isFinite(targetStatus)
            ? `${actorStatus} / ${targetStatus} (Δ ${actorStatus - targetStatus >= 0 ? "+" : ""}${actorStatus - targetStatus})`
            : null;
        const objective = context.objectiveType
            ? game.i18n.localize(`${MODULE_ID}.trackers.intrigue.objectives.${context.objectiveType}`)
            : context.objective;
        return {
            title: `${MODULE_ID}.trackers.intrigue.title`,
            details: [
                detail(`${MODULE_ID}.trackers.intrigue.objective`, objective, objectiveHidden),
                detail(`${MODULE_ID}.trackers.intrigue.target`, context.target),
                detail(`${MODULE_ID}.trackers.intrigue.targets`, selectedTargets),
                detail(`${MODULE_ID}.trackers.intrigue.status_relation`, statusRelation, !!targetToken && !targetData?.observer),
                detail(`${MODULE_ID}.trackers.intrigue.momentum`, context.momentum ?? 0),
                detail(`${MODULE_ID}.trackers.intrigue.difficulty`, context.difficulty, !!context.hiddenTn && !game.user.isGM),
            ],
        };
    }

    if (profile === "duel") {
        const context = flags.duel ?? {};
        const combatant = combat.combatants.find((entry) => entry.actor?.id === actor.id);
        const bid = combatant?.getFlag(MODULE_ID, "duelBid");
        const center = combatant?.getFlag(MODULE_ID, "duelCenter");
        const predict = combatant?.getFlag(MODULE_ID, "duelPredict");
        const target = game.actors.get(context.targetActorId);
        const targetVisible = !!game.user.isGM || !!target?.testUserPermission?.(game.user, "OBSERVER");
        const bidValue = bid?.revealed ? bid.bid : bid ? "✓" : null;
        const predictValue = predict?.revealed ? (predict.correct ? "✓" : "—") : predict ? "✓" : null;
        return {
            title: `${MODULE_ID}.trackers.duel.title`,
            details: [
                detail(`${MODULE_ID}.trackers.duel.round`, combat.round ?? 0),
                detail(`${MODULE_ID}.trackers.duel.base_initiative`, combatant?.initiative),
                detail(`${MODULE_ID}.trackers.duel.conditions`, context.conditions),
                detail(`${MODULE_ID}.trackers.duel.target`, targetVisible ? target?.name : null, !!target && !targetVisible),
                detail(`${MODULE_ID}.trackers.duel.allowed_weapons`, context.allowedWeapons),
                detail(`${MODULE_ID}.trackers.duel.staredown_strife`, combat.round ?? 0),
                detail(`${MODULE_ID}.trackers.duel.bid`, bidValue),
                detail(`${MODULE_ID}.trackers.duel.temporary_initiative`, combatant?.initiative),
                detail(`${MODULE_ID}.trackers.duel.center`, center ? `${center.dice?.length ?? 0} / R${center.expiresRound}` : null),
                detail(`${MODULE_ID}.trackers.duel.predict`, predictValue),
                detail(`${MODULE_ID}.trackers.duel.finishing_blow`, context.finishingBlowActors?.includes(actor.id) ? "✓" : "—"),
                detail(`${MODULE_ID}.trackers.duel.conceded`, context.concededActors?.includes(actor.id) ? "✓" : "—"),
            ],
        };
    }

    if (profile === "skirmish") {
        const state = getTurnState(actor);
        const target = getTargetToken();
        const readied = getWeapons(actor, { readiedOnly: true })[0];
        const rangeBand = getTargetRangeBand(ui.ARGON?._token, target);
        return {
            title: `${MODULE_ID}.trackers.skirmish.title`,
            details: [
                detail(`${MODULE_ID}.trackers.skirmish.action`, state.actionUsed ? "—" : "✓"),
                detail(`${MODULE_ID}.trackers.skirmish.movement`, state.movementUsed ? "—" : "✓"),
                detail(`${MODULE_ID}.trackers.skirmish.water_action`, actor.system?.stance === "water" && !state.waterActionUsed ? "✓" : "—"),
                detail(`${MODULE_ID}.trackers.skirmish.target_range`, rangeBand),
                detail(`${MODULE_ID}.trackers.skirmish.weapon_range`, readied?.system?.range),
                detail(
                    `${MODULE_ID}.trackers.skirmish.weapon_in_range`,
                    weaponCoversRange(readied?.system?.range, rangeBand) === null
                        ? null
                        : game.i18n.localize(`${MODULE_ID}.common.${weaponCoversRange(readied?.system?.range, rangeBand) ? "yes" : "no"}`),
                ),
                detail(`${MODULE_ID}.trackers.skirmish.maneuver`, state.maneuver ? "✓" : "—"),
                detail(`${MODULE_ID}.trackers.skirmish.guard`, state.guard ? "✓" : "—"),
                detail(`${MODULE_ID}.trackers.skirmish.wait`, state.wait),
            ],
        };
    }

    if (profile === "mass_battle") {
        const context = flags.massBattle ?? {};
        const links = getMassBattleLinks(actor);
        const army = game.actors.get(context.armyId) ?? (links.armies.length === 1 ? links.armies[0] : null);
        const cohortLink = links.cohorts.find((entry) => entry.item.id === context.cohortId) ?? (links.cohorts.length === 1 ? links.cohorts[0] : null);
        const canSeeArmy = !!game.user.isGM || !!army?.testUserPermission?.(game.user, "OBSERVER");
        const readiness = canSeeArmy ? army?.system?.battle_readiness : null;
        const cohortReadiness = canSeeArmy ? cohortLink?.item?.system?.battle_readiness : null;
        const fortifications = canSeeArmy ? army?.items?.filter((item) => item.type === "army_fortification") ?? [] : [];
        const fortificationText = fortifications
            .map((item) => `${item.name} (TN ${item.system?.difficulty ?? 0}, AR ${item.system?.attrition_reduction ?? 0})`)
            .join(", ");
        return {
            title: `${MODULE_ID}.trackers.mass_battle.title`,
            details: [
                detail(`${MODULE_ID}.trackers.mass_battle.army`, canSeeArmy ? army?.name : null, !!army && !canSeeArmy),
                detail(
                    `${MODULE_ID}.trackers.mass_battle.casualties`,
                    readiness ? `${readiness.casualties_strength?.value ?? 0}/${readiness.casualties_strength?.max ?? 0}` : null,
                    !!army && !canSeeArmy,
                ),
                detail(
                    `${MODULE_ID}.trackers.mass_battle.panic`,
                    readiness ? `${readiness.panic_discipline?.value ?? 0}/${readiness.panic_discipline?.max ?? 0}` : null,
                    !!army && !canSeeArmy,
                ),
                detail(`${MODULE_ID}.trackers.mass_battle.cohort`, canSeeArmy ? cohortLink?.item?.name : null, !!cohortLink && !canSeeArmy),
                detail(
                    `${MODULE_ID}.trackers.mass_battle.cohort_readiness`,
                    cohortReadiness
                        ? `${cohortReadiness.casualties_strength?.value ?? 0}/${cohortReadiness.casualties_strength?.max ?? 0}; ${cohortReadiness.panic_discipline?.value ?? 0}/${cohortReadiness.panic_discipline?.max ?? 0}`
                        : null,
                    !!cohortLink && !canSeeArmy,
                ),
                detail(`${MODULE_ID}.trackers.mass_battle.commander`, canSeeArmy ? army?.system?.commander : null, !!army && !canSeeArmy),
                detail(`${MODULE_ID}.trackers.mass_battle.leader`, canSeeArmy ? cohortLink?.item?.system?.leader : null, !!cohortLink && !canSeeArmy),
                detail(`${MODULE_ID}.trackers.mass_battle.position`, context.position),
                detail(`${MODULE_ID}.trackers.mass_battle.fortification`, fortificationText, !!army && !canSeeArmy),
                detail(`${MODULE_ID}.trackers.mass_battle.objective`, context.objective),
                detail(`${MODULE_ID}.trackers.mass_battle.momentum`, context.momentum ?? 0),
            ],
            selectionRequired: links.armies.length > 1 || links.cohorts.length > 1,
        };
    }

    return null;
}

export function getMassBattleCandidates(actor) {
    return getMassBattleLinks(actor);
}
