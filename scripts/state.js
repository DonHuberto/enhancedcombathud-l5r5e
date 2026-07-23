import { MODULE_ID, PROFILES } from "./config.js";

const PROFILE_FLAG = "profile";
const ENCOUNTER_FLAG = "encounterType";
const LEGACY_TURN_FLAG = "turnState";
export const SUPPORTED_ACTOR_TYPES = Object.freeze(["character", "npc"]);

export function canUseActor(actor, user = game.user) {
    return SUPPORTED_ACTOR_TYPES.includes(actor?.type) &&
        Boolean(user?.isGM || actor?.testUserPermission?.(user, "OWNER") || actor?.isOwner);
}

export function getActiveCombat() {
    return game.combat?.started ? game.combat : null;
}

export function normalizeProfile(profile, fallback = "skirmish") {
    return PROFILES.includes(profile) ? profile : fallback;
}

export function getSystemEncounterType() {
    try {
        return normalizeProfile(game.settings.get("l5r5e", "initiative-encounter"));
    } catch (_error) {
        return "skirmish";
    }
}

export function getProfile(actor) {
    if (!canUseActor(actor)) return null;
    const combat = getActiveCombat();
    if (!combat) return "universal";
    return normalizeProfile(
        combat.getFlag(MODULE_ID, PROFILE_FLAG) ??
        combat.getFlag(MODULE_ID, ENCOUNTER_FLAG) ??
        getSystemEncounterType(),
    );
}

export async function ensureCombatProfileSnapshot(combat = getActiveCombat()) {
    if (!combat || !game.user?.isGM || combat.getFlag(MODULE_ID, ENCOUNTER_FLAG)) return;
    await combat.setFlag(MODULE_ID, ENCOUNTER_FLAG, getSystemEncounterType());
}

export async function setCombatProfile(profile) {
    const combat = getActiveCombat();
    if (!combat || !game.user?.isGM) return false;
    const normalized = normalizeProfile(profile, null);
    if (!normalized || normalized === "universal") return false;
    await combat.setFlag(MODULE_ID, PROFILE_FLAG, normalized);
    ui.ARGON?.refresh();
    return true;
}

export function getCombatant(actor, combat = getActiveCombat()) {
    if (!combat || !actor) return null;
    return combat.combatants.find((combatant) => combatant.actor?.id === actor.id) ?? null;
}

export function getTurnState(actor) {
    const combatant = getCombatant(actor);
    const core = combatant && game.l5r5e?.turns?.getState(combatant);
    if (!core) {
        return {
            primaryAction: { used: false },
            freeMovement: { used: false },
            waterExtraAction: { used: false },
            actionUsed: false,
            movementUsed: false,
            waterActionUsed: false,
            guard: null,
            wait: null,
        };
    }
    return {
        ...core,
        actionUsed: Boolean(core.primaryAction?.used),
        movementUsed: Boolean(core.freeMovement?.used),
        waterActionUsed: Boolean(core.waterExtraAction?.used),
        guard: core.guard ?? (core.primaryAction?.actionId === "guard"),
    };
}

export function getActionDefinition(actionId) {
    return game.l5r5e?.actionRegistry?.[actionId] ?? null;
}

export function getActionSlot(actor, { actionId, requiresCheck, actionTypes } = {}) {
    const combatant = getCombatant(actor);
    if (!combatant || !game.l5r5e?.turns) return null;
    const definition = getActionDefinition(actionId);
    const result = game.l5r5e.turns.reserveAction(getTurnState(actor), {
        actionId,
        actionTypes: actionTypes ?? definition?.actionTypes ?? [],
        requiresCheck: requiresCheck ?? definition?.requiresCheck ?? true,
        intentId: `availability:${actor.uuid}:${actionId ?? "action"}`,
    });
    return result.ok ? result.slot : null;
}

export async function executeImmediateAction(actor, actionId, { mutations = [], turnStateChanges = {} } = {}) {
    const combatant = getCombatant(actor);
    const definition = getActionDefinition(actionId);
    if (!combatant || !definition || !game.l5r5e?.actions?.executeImmediate) return { ok: false, code: "coreApiUnavailable" };
    return game.l5r5e.actions.executeImmediate(combatant, {
        context: {
            actor,
            actionId,
            actionTypes: definition.actionTypes,
            requiresCheck: false,
            lifecycle: { combat: game.combat },
        },
        mutations,
        turnStateChanges,
    });
}

export async function clearLegacyTurnState(combat) {
    if (!combat || !game.user?.isGM) return;
    const updates = combat.combatants
        .filter((combatant) => combatant.getFlag(MODULE_ID, LEGACY_TURN_FLAG) !== undefined)
        .map((combatant) => ({ _id: combatant.id, [`flags.${MODULE_ID}.-=${LEGACY_TURN_FLAG}`]: null }));
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
}

export async function getCombatContext(key, fallback = null) {
    return getActiveCombat()?.getFlag(MODULE_ID, key) ?? fallback;
}

export async function setCombatContext(key, value) {
    const combat = getActiveCombat();
    if (!combat || !game.user?.isGM) return false;
    await combat.setFlag(MODULE_ID, key, value);
    ui.ARGON?.refresh();
    return true;
}

export function registerStateHooks() {
    Hooks.on("combatStart", async (combat) => {
        await ensureCombatProfileSnapshot(combat);
        await clearLegacyTurnState(combat);
    });
    Hooks.on("updateCombat", async (combat, changes) => {
        if (changes.active === true || changes.round === 1) await ensureCombatProfileSnapshot(combat);
        if (SUPPORTED_ACTOR_TYPES.includes(ui.ARGON?._actor?.type)) ui.ARGON.refresh();
    });
    Hooks.on("deleteCombat", () => SUPPORTED_ACTOR_TYPES.includes(ui.ARGON?._actor?.type) && ui.ARGON.refresh());
}
