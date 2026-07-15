import { MODULE_ID, PROFILES } from "./config.js";

const PROFILE_FLAG = "profile";
const ENCOUNTER_FLAG = "encounterType";
const TURN_FLAG = "turnState";

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
    if (actor?.type !== "character") return null;
    const combat = getActiveCombat();
    if (!combat) return "universal";
    const override = combat.getFlag(MODULE_ID, PROFILE_FLAG);
    const snapshot = combat.getFlag(MODULE_ID, ENCOUNTER_FLAG);
    return normalizeProfile(override ?? snapshot ?? getSystemEncounterType());
}

export async function ensureCombatProfileSnapshot(combat = getActiveCombat()) {
    if (!combat || !game.user?.isGM) return;
    if (combat.getFlag(MODULE_ID, ENCOUNTER_FLAG)) return;
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

export function getTurnKey(combat = getActiveCombat(), actor = null) {
    if (!combat) return null;
    const combatant = actor ? getCombatant(actor, combat) : combat.combatant;
    return `${combat.id}:${combat.round ?? 0}:${combatant?.id ?? combat.turn ?? -1}`;
}

export function createTurnState(turnKey) {
    return {
        turnKey,
        actionUsed: false,
        movementUsed: false,
        waterActionUsed: false,
        reactionUsed: false,
        guard: false,
        maneuver: false,
        wait: null,
    };
}

export function getTurnState(actor) {
    const combat = getActiveCombat();
    const combatant = getCombatant(actor, combat);
    const turnKey = getTurnKey(combat, actor);
    if (!combatant || !turnKey) return createTurnState(turnKey);
    const stored = combatant.getFlag(MODULE_ID, TURN_FLAG);
    return stored?.turnKey === turnKey ? { ...createTurnState(turnKey), ...stored } : createTurnState(turnKey);
}

export async function updateTurnState(actor, changes) {
    const combatant = getCombatant(actor);
    if (!combatant || !combatant.isOwner) return null;
    const next = { ...getTurnState(actor), ...changes, turnKey: getTurnKey(getActiveCombat(), actor) };
    await combatant.setFlag(MODULE_ID, TURN_FLAG, next);
    ui.ARGON?.components?.main?.forEach((component) => component.updateActionUse?.());
    ui.ARGON?.components?.portrait?.refresh?.();
    return next;
}

export function getActionSlot(actor, { requiresCheck = true } = {}) {
    const combat = getActiveCombat();
    if (!combat) return null;
    const state = getTurnState(actor);
    if (!state.actionUsed) return "actionUsed";
    if (!requiresCheck && actor.system?.stance === "water" && !state.waterActionUsed) return "waterActionUsed";
    return null;
}

export async function consumeAction(actor, options = {}) {
    const slot = getActionSlot(actor, options);
    if (!slot) return false;
    await updateTurnState(actor, { [slot]: true });
    return true;
}

export async function consumeMovement(actor) {
    const state = getTurnState(actor);
    if (state.movementUsed) return false;
    await updateTurnState(actor, { movementUsed: true });
    return true;
}

export async function setGuard(actor, active = true) {
    return updateTurnState(actor, { guard: active });
}

export async function setWait(actor, condition) {
    return updateTurnState(actor, { wait: condition || null });
}

export async function clearTransientCombatState(combat) {
    if (!combat || !game.user?.isGM) return;
    const updates = combat.combatants
        .filter((combatant) => combatant.getFlag(MODULE_ID, TURN_FLAG) !== undefined)
        .map((combatant) => ({ _id: combatant.id, [`flags.${MODULE_ID}.-=${TURN_FLAG}`]: null }));
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
    Hooks.on("combatStart", (combat) => ensureCombatProfileSnapshot(combat));
    Hooks.on("updateCombat", async (combat, changes) => {
        if (changes.active === true || changes.round === 1) await ensureCombatProfileSnapshot(combat);
        if (changes.active === false) await clearTransientCombatState(combat);
        if (ui.ARGON?._actor?.type === "character") ui.ARGON.refresh();
    });
    Hooks.on("deleteCombat", () => ui.ARGON?._actor?.type === "character" && ui.ARGON.refresh());
}
