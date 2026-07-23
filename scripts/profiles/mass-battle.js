import { MODULE_ID } from "../config.js";
import { openDicePicker } from "../rolls.js";
import { getActionSlot } from "../state.js";
import { getMassBattleCandidates } from "./tracker.js";
import { getTargetToken, notify, promptSelect } from "../utils.js";

export function getMassBattleActions() {
    return ["assault", "challenge", "rally", "reinforce"];
}

async function selectContext(actor) {
    const { armies, cohorts } = getMassBattleCandidates(actor);
    const combatContext = game.combat?.getFlag(MODULE_ID, "massBattle") ?? {};
    const localContext = actor.getFlag(MODULE_ID, "massBattleSelection") ?? {};
    const context = { ...localContext, ...combatContext };

    if (!armies.some((army) => army.id === context.armyId)) {
        if (armies.length === 1) context.armyId = armies[0].id;
        else if (armies.length > 1) {
            context.armyId = await promptSelect({
                title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.select_army`),
                label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.army`),
                choices: armies.map((army) => ({ value: army.id, label: army.name })),
            });
        }
    }

    if (!cohorts.some(({ item }) => item.id === context.cohortId)) {
        if (cohorts.length === 1) context.cohortId = cohorts[0].item.id;
        else if (cohorts.length > 1) {
            context.cohortId = await promptSelect({
                title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.select_cohort`),
                label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.cohort`),
                choices: cohorts.map(({ item, army }) => ({ value: item.id, label: `${item.name} — ${army.name}` })),
            });
        }
    }

    await actor.setFlag(MODULE_ID, "massBattleSelection", context);
    if (game.user.isGM && game.combat?.started) await game.combat.setFlag(MODULE_ID, "massBattle", context);
    return context;
}

export async function executeMassBattleAction(actor, actionId) {
    if (!getActionSlot(actor, { actionId })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    await selectContext(actor);
    const configs = {
        assault: { skillsList: "command,tactics", actions: { attack: true } },
        challenge: { skillId: "command", actions: { scheme: true } },
        rally: { skillId: "command", actions: { support: true } },
        reinforce: { skillsList: "labor,tactics", actions: { support: true } },
    };
    const dialog = openDicePicker(actor, {
        ...(configs[actionId] ?? configs.assault),
        actionId,
        rollContext: { actionId },
        target: getTargetToken(),
    });
    if (!dialog) return false;
    return true;
}
