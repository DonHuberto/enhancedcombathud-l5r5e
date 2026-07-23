import { MODULE_ID, RINGS } from "../config.js";
import { collectSkills } from "../data.js";
import { getSkillLabel, openDicePicker } from "../rolls.js";
import { executeImmediateAction, getActionSlot, getCombatant } from "../state.js";
import { isPrimaryGM, requestGm } from "../socket.js";
import {
    confirmAction,
    createChatCard,
    getTargetToken,
    notify,
    promptSelect,
} from "../utils.js";

const pendingCenters = new Map();
const finishingBlowNotifications = new Set();

function storageKey(type, combatantId, round = game.combat?.round ?? 0) {
    return `${MODULE_ID}:${type}:${combatantId}:${round}`;
}

async function hashSecret(value, salt) {
    const bytes = new TextEncoder().encode(`${value}:${salt}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function duelCombatants() {
    const configuredIds = game.combat?.getFlag(MODULE_ID, "duel")?.participantActorIds ?? [];
    return (game.combat?.combatants ?? []).filter(
        (combatant) =>
            !combatant.isDefeated &&
            combatant.actor?.type === "character" &&
            (!configuredIds.length || configuredIds.includes(combatant.actor.id)),
    );
}

export function getDuelActions() {
    return ["calming_breath", "center", "predict", "prepare_item", "strike", "custom_action", "staredown", "concede"];
}

export function isFinishingBlowAvailable(actor) {
    const duel = game.combat?.getFlag(MODULE_ID, "duel") ?? {};
    return !!duel.finishingBlowActors?.includes(actor?.id);
}

async function beginCenter(actor) {
    if (!getActionSlot(actor, { actionId: "center" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const skills = collectSkills(actor.system);
    const skillId = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.actions.center.label`),
        label: game.i18n.localize(`${MODULE_ID}.actions.center.skill`),
        choices: skills.map((skill) => ({ value: skill.id, label: `${getSkillLabel(skill.id, skill.category)} (${skill.rank})` })),
    });
    if (!skillId) return false;
    const combatant = getCombatant(actor);
    if (!combatant) return false;
    pendingCenters.set(actor.id, {
        skillId,
        combatantId: combatant.id,
        owner: game.user.id,
        expiresRound: (game.combat?.round ?? 0) + 1,
    });
    const dialog = openDicePicker(actor, {
        ringId: "void",
        skillId,
        actions: { support: true },
        actionId: "center",
        rollContext: { actionId: "center" },
    });
    if (!dialog) {
        pendingCenters.delete(actor.id);
        return false;
    }
    return true;
}

async function beginPredict(actor) {
    if (!getActionSlot(actor, { actionId: "predict" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const target = getTargetToken();
    if (!target?.actor || target.actor.id === actor.id) {
        notify(`${MODULE_ID}.notifications.no_target`, "warn");
        return false;
    }
    const ring = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.actions.predict.label`),
        label: game.i18n.localize(`${MODULE_ID}.actions.predict.ring`),
        choices: RINGS.map((id) => ({ value: id, label: game.i18n.localize(`l5r5e.rings.${id}`) })),
    });
    if (!ring) return false;
    const combatant = getCombatant(actor);
    if (!combatant) return false;
    const salt = foundry.utils.randomID(32);
    const commitment = await hashSecret(ring, salt);
    sessionStorage.setItem(storageKey("predict", combatant.id), JSON.stringify({ ring, salt }));
    const prediction = {
        commitment,
        opponentActorId: target.actor.id,
        owner: game.user.id,
        expiresRound: (game.combat?.round ?? 0) + 1,
        revealed: false,
    };
    const applied = await executeImmediateAction(actor, "predict", {
        mutations: [{
            documentUuid: combatant.uuid,
            path: `flags.${MODULE_ID}.duelPredict`,
            before: combatant.getFlag(MODULE_ID, "duelPredict") ?? null,
            after: prediction,
            reason: "predict",
        }],
    });
    if (!applied.ok) return false;
    return createChatCard({
        actor,
        title: game.i18n.localize(`${MODULE_ID}.actions.predict.label`),
        body: game.i18n.localize(`${MODULE_ID}.actions.predict.committed`),
    });
}

async function beginStaredown(actor) {
    const combat = game.combat;
    const combatant = getCombatant(actor);
    if (!combat || !combatant || duelCombatants().length < 2) {
        notify(`${MODULE_ID}.notifications.duel_participants`, "warn");
        return false;
    }
    const existing = combatant.getFlag(MODULE_ID, "duelBid");
    if (existing?.round === combat.round) {
        notify(`${MODULE_ID}.notifications.bid_already_committed`, "warn");
        return false;
    }
    const focus = Math.max(0, Number(actor.system?.focus ?? 0));
    const bidText = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.actions.staredown.label`),
        label: game.i18n.localize(`${MODULE_ID}.actions.staredown.bid`),
        choices: Array.from({ length: focus + 1 }, (_value, bid) => ({ value: String(bid), label: String(bid) })),
    });
    if (bidText === null) return false;
    const bid = Number(bidText);
    const salt = foundry.utils.randomID(32);
    const commitment = await hashSecret(bid, salt);
    sessionStorage.setItem(storageKey("bid", combatant.id, combat.round), JSON.stringify({ bid, salt }));

    await actor.update({ "system.strife.value": Number(actor.system?.strife?.value ?? 0) + Number(combat.round ?? 0) });
    await combatant.setFlag(MODULE_ID, "duelBid", {
        round: combat.round,
        commitment,
        revealed: false,
        baselineInitiative: combatant.initiative ?? 0,
        owner: game.user.id,
    });
    await createChatCard({
        actor,
        title: game.i18n.localize(`${MODULE_ID}.actions.staredown.label`),
        body: game.i18n.localize(`${MODULE_ID}.actions.staredown.committed`),
        details: [{ label: game.i18n.localize(`${MODULE_ID}.resources.strife`), value: `+${combat.round}` }],
    });
    await tryRevealBids();
    return true;
}

async function concede(actor) {
    const confirmed = await confirmAction({
        title: game.i18n.localize(`${MODULE_ID}.actions.concede.label`),
        content: `<p>${game.i18n.localize(`${MODULE_ID}.actions.concede.confirm`)}</p>`,
    });
    if (!confirmed) return false;
    if (game.user.isGM || game.combat?.isOwner) {
        const duel = foundry.utils.deepClone(game.combat.getFlag(MODULE_ID, "duel") ?? {});
        duel.concededActors = Array.from(new Set([...(duel.concededActors ?? []), actor.id]));
        await game.combat.setFlag(MODULE_ID, "duel", duel);
    } else requestGm("concede", actor);
    return createChatCard({ actor, title: game.i18n.localize(`${MODULE_ID}.actions.concede.label`) });
}

export async function executeDuelAction(actor, actionId) {
    if (actionId === "center") return beginCenter(actor);
    if (actionId === "predict") return beginPredict(actor);
    if (actionId === "staredown") return beginStaredown(actor);
    if (actionId === "concede") return concede(actor);
    return false;
}

async function captureCenterRoll(message) {
    const roll = message.rolls?.[0];
    const actorId = roll?.l5r5e?.actor?.id;
    const pending = pendingCenters.get(actorId);
    if (!pending || !roll?.l5r5e?.rnkEnded) return;
    const combatant = game.combat?.combatants.get(pending.combatantId);
    if (!combatant?.isOwner) return;

    const dice = roll.dice.flatMap((term) =>
        term.results
            .filter((result) => result.active !== false && result.discarded !== true)
            .map((result) => ({ denomination: term.denomination, result: result.result })),
    );
    await combatant.setFlag(MODULE_ID, "duelCenter", {
        skillId: pending.skillId,
        dice,
        owner: pending.owner,
        expiresRound: pending.expiresRound,
        messageId: message.id,
    });
    pendingCenters.delete(actorId);
    ui.ARGON?.components?.portrait?.refresh?.();
}

async function revealPredictOnStanceChange(actor, changes) {
    if (!foundry.utils.hasProperty(changes, "system.stance") && changes.system?.stance === undefined) return;
    for (const combatant of duelCombatants()) {
        const predict = combatant.getFlag(MODULE_ID, "duelPredict");
        if (!predict || predict.revealed || predict.opponentActorId !== actor.id || !combatant.isOwner) continue;
        const stored = JSON.parse(sessionStorage.getItem(storageKey("predict", combatant.id)) ?? "null");
        if (!stored) continue;
        const commitment = await hashSecret(stored.ring, stored.salt);
        if (commitment !== predict.commitment) continue;
        const correct = stored.ring === actor.system?.stance;
        await combatant.setFlag(MODULE_ID, "duelPredict", {
            ...predict,
            revealed: true,
            ring: stored.ring,
            salt: stored.salt,
            correct,
        });
        await createChatCard({
            actor: combatant.actor,
            title: game.i18n.localize(`${MODULE_ID}.actions.predict.label`),
            details: [
                { label: game.i18n.localize(`${MODULE_ID}.actions.predict.ring`), value: game.i18n.localize(`l5r5e.rings.${stored.ring}`) },
                { label: game.i18n.localize(`${MODULE_ID}.actions.predict.result`), value: correct ? "✓" : "—" },
            ],
        });
    }
}

async function tryRevealBids() {
    const combat = game.combat;
    if (!combat) return;
    const participants = duelCombatants();
    const bids = participants.map((combatant) => combatant.getFlag(MODULE_ID, "duelBid"));
    if (bids.some((bid) => !bid || bid.round !== combat.round)) return;

    for (const combatant of participants) {
        const bid = combatant.getFlag(MODULE_ID, "duelBid");
        if (bid.revealed || !combatant.isOwner) continue;
        const stored = JSON.parse(sessionStorage.getItem(storageKey("bid", combatant.id, combat.round)) ?? "null");
        if (!stored || (await hashSecret(stored.bid, stored.salt)) !== bid.commitment) continue;
        await combatant.setFlag(MODULE_ID, "duelBid", { ...bid, ...stored, revealed: true });
    }

    if (!isPrimaryGM()) return;
    const refreshed = participants.map((combatant) => ({ combatant, bid: combatant.getFlag(MODULE_ID, "duelBid") }));
    if (refreshed.some(({ bid }) => !bid?.revealed || bid.round !== combat.round)) return;
    const duel = foundry.utils.deepClone(combat.getFlag(MODULE_ID, "duel") ?? {});
    if (duel.bidsAppliedRound === combat.round) return;

    for (const { bid } of refreshed) {
        if ((await hashSecret(bid.bid, bid.salt)) !== bid.commitment) return;
    }
    duel.bidsAppliedRound = combat.round;
    await combat.setFlag(MODULE_ID, "duel", duel);
    await combat.updateEmbeddedDocuments(
        "Combatant",
        refreshed.map(({ combatant, bid }) => ({
            _id: combatant.id,
            initiative: Number(bid.baselineInitiative ?? combatant.initiative ?? 0) + Number(bid.bid),
        })),
    );
}

async function restoreDuelInitiative(combat, changes) {
    if (!isPrimaryGM() || changes.round === undefined) return;
    const updates = [];
    for (const combatant of combat.combatants) {
        const bid = combatant.getFlag(MODULE_ID, "duelBid");
        if (!bid || bid.round >= changes.round) continue;
        updates.push({
            _id: combatant.id,
            initiative: Number(bid.baselineInitiative ?? combatant.initiative ?? 0),
            [`flags.${MODULE_ID}.-=duelBid`]: null,
        });
    }
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
}

async function expireDuelDeclarations(combat, changes) {
    if (!isPrimaryGM() || changes.round === undefined) return;
    const updates = [];
    for (const combatant of combat.combatants) {
        const update = { _id: combatant.id };
        const center = combatant.getFlag(MODULE_ID, "duelCenter");
        const predict = combatant.getFlag(MODULE_ID, "duelPredict");
        if (center && Number(center.expiresRound ?? Infinity) < Number(changes.round)) {
            update[`flags.${MODULE_ID}.-=duelCenter`] = null;
        }
        if (predict && Number(predict.expiresRound ?? Infinity) < Number(changes.round)) {
            update[`flags.${MODULE_ID}.-=duelPredict`] = null;
        }
        if (Object.keys(update).length > 1) updates.push(update);
    }
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
}

async function markFinishingBlow(triggerActor) {
    if (!isPrimaryGM() || !game.combat?.started) return;
    const profile = game.combat.getFlag(MODULE_ID, "profile") ?? game.combat.getFlag(MODULE_ID, "encounterType");
    if (profile !== "duel") return;
    const opponents = duelCombatants().map((entry) => entry.actor.id).filter((id) => id !== triggerActor.id);
    const duel = foundry.utils.deepClone(game.combat.getFlag(MODULE_ID, "duel") ?? {});
    duel.finishingBlowActors = Array.from(new Set([...(duel.finishingBlowActors ?? []), ...opponents]));
    await game.combat.setFlag(MODULE_ID, "duel", duel);
}

async function clearFinishingBlow(actor) {
    if (!game.combat) return;
    if (game.user.isGM || game.combat.isOwner) {
        const duel = foundry.utils.deepClone(game.combat.getFlag(MODULE_ID, "duel") ?? {});
        duel.finishingBlowActors = (duel.finishingBlowActors ?? []).filter((id) => id !== actor.id);
        await game.combat.setFlag(MODULE_ID, "duel", duel);
    } else requestGm("clearFinishingBlow", actor);
}

function effectHasStatus(effect, status) {
    return effect?.statuses?.has(status) || Array.from(effect?.statuses ?? []).includes(status);
}

function notifyFinishingBlow(combat, changes) {
    const actors = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.duel.finishingBlowActors`);
    const actor = ui.ARGON?._actor;
    if (!Array.isArray(actors) || actor?.type !== "character" || !actors.includes(actor.id)) return;
    const key = `${combat.id}:${combat.round}:${actor.id}`;
    if (finishingBlowNotifications.has(key)) return;
    finishingBlowNotifications.add(key);
    notify(`${MODULE_ID}.notifications.finishing_blow_available`, "warn");
}

export function registerDuelHooks() {
    Hooks.on("createChatMessage", captureCenterRoll);
    Hooks.on("updateActor", revealPredictOnStanceChange);
    Hooks.on("updateCombatant", tryRevealBids);
    Hooks.on("updateCombat", restoreDuelInitiative);
    Hooks.on("updateCombat", expireDuelDeclarations);
    Hooks.on("updateCombat", notifyFinishingBlow);
    Hooks.on("createActiveEffect", (effect) => effectHasStatus(effect, "compromised") && markFinishingBlow(effect.parent));
    Hooks.on(`${MODULE_ID}.unmask`, markFinishingBlow);
    Hooks.on(`${MODULE_ID}.finishingBlowUsed`, clearFinishingBlow);
}
