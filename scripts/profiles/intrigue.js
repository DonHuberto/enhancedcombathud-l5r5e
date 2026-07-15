import { MODULE_ID } from "../config.js";
import { getCombatant } from "../state.js";
import { createChatCard } from "../utils.js";
import { isPrimaryGM } from "../socket.js";

export function getIntrigueActions() {
    return ["persuade", "assist", "calming_breath", "custom_action"];
}

export async function markPersuadePending(actor) {
    const combatant = getCombatant(actor);
    if (!combatant?.isOwner) return false;
    const tracker = game.combat?.getFlag(MODULE_ID, "intrigue");
    if (!tracker?.objective) return true;
    await combatant.setFlag(MODULE_ID, "pendingPersuade", {
        round: game.combat.round,
        turn: game.combat.turn,
        userId: game.user.id,
    });
    return true;
}

export async function clearPersuadePending(actor) {
    const combatant = getCombatant(actor);
    if (combatant?.isOwner) await combatant.unsetFlag(MODULE_ID, "pendingPersuade");
}

async function capturePersuade(message) {
    if (!isPrimaryGM() || !game.combat?.started) return;
    const roll = message.rolls?.[0];
    if (!roll?.l5r5e?.rnkEnded || !roll.l5r5e.actions?.scheme) return;
    const actor = roll.l5r5e.actor;
    const combatant = getCombatant(actor);
    const pending = combatant?.getFlag(MODULE_ID, "pendingPersuade");
    if (!pending) return;
    await combatant.unsetFlag(MODULE_ID, "pendingPersuade");

    const summary = roll.l5r5e.summary ?? {};
    const successes = Number(summary.totalSuccess ?? 0);
    const difficulty = Number(roll.l5r5e.difficulty ?? 0);
    if (successes < difficulty) return;
    const gained = Math.max(1, 1 + successes - difficulty);
    const context = foundry.utils.deepClone(game.combat.getFlag(MODULE_ID, "intrigue") ?? {});
    if (!context.objective) return;
    context.momentum = Number(context.momentum ?? 0) + gained;
    await game.combat.setFlag(MODULE_ID, "intrigue", context);
    await createChatCard({
        actor,
        title: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.momentum`),
        details: [{ label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.gained`), value: `+${gained}` }],
    });
}

export function registerIntrigueHooks() {
    Hooks.on("createChatMessage", capturePersuade);
}
