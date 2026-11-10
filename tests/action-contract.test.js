import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { getActionRoute, throwItem } from "../scripts/actions.js";
import { ACTIONS_BY_PROFILE } from "../scripts/config.js";
import { getUniversalActions } from "../scripts/profiles/universal.js";
import { getIntrigueActions } from "../scripts/profiles/intrigue.js";
import { getDuelActions } from "../scripts/profiles/duel.js";
import { getSkirmishActions } from "../scripts/profiles/skirmish.js";
import { getMassBattleActions } from "../scripts/profiles/mass-battle.js";
import { openTechniqueRoll, openWeaponStrike } from "../scripts/rolls.js";
import { executeImmediateAction, getActionDefinition } from "../scripts/state.js";
import {
    classifyActionIds,
    profileUiState,
    resolveProfileActionIds,
    turnEconomyView,
    waterExtraActionRestriction,
} from "../scripts/action-layout.js";
import { getTechniqueAvailability } from "../scripts/techniques.js";

const registry = {
    wait: { actionId: "wait", actionTypes: ["support"], requiresCheck: false, profiles: ["skirmish"] },
    strike: { actionId: "strike", actionTypes: ["attack"], requiresCheck: true, profiles: ["duel", "skirmish"] },
    calming_breath: { actionId: "calming_breath", actionTypes: ["support"], requiresCheck: false, profiles: ["duel", "skirmish"] },
    throw_item: { actionId: "throw_item", actionTypes: ["attack"], requiresCheck: true, profiles: ["duel", "skirmish"] },
};

test("every fallback profile action has an executable route", () => {
    const runtimeActions = {
        universal: getUniversalActions(),
        intrigue: getIntrigueActions(),
        duel: getDuelActions(),
        skirmish: getSkirmishActions(),
        mass_battle: getMassBattleActions(),
    };
    for (const [profile, actions] of Object.entries(ACTIONS_BY_PROFILE)) {
        assert.deepEqual(runtimeActions[profile], actions, `${profile} profile actions drifted from the public configuration`);
        for (const actionId of actions) {
            assert.ok(getActionRoute(profile, actionId), `${profile}.${actionId} has no executable route`);
        }
    }
    assert.equal(getActionRoute("skirmish", "challenge"), "direct");
    assert.equal(getActionRoute("mass_battle", "challenge"), "mass_battle");
    assert.equal(getActionRoute("skirmish", "end_turn"), "direct");
    assert.equal(getActionRoute("skirmish", "unknown"), null);
});

test("profile actions are registry-driven, omit Wait and group by check requirement", () => {
    const skirmish = resolveProfileActionIds(registry, "skirmish", ACTIONS_BY_PROFILE.skirmish);
    assert.deepEqual(skirmish, ["strike", "calming_breath", "throw_item"]);
    assert.equal(skirmish.includes("wait"), false);
    assert.equal(skirmish.includes("throw_item"), true);
    assert.deepEqual(classifyActionIds(registry, skirmish), {
        requiresCheck: ["strike", "throw_item"],
        noCheck: ["calming_breath"],
    });
    assert.equal(ACTIONS_BY_PROFILE.skirmish.includes("wait"), false);
});

test("turn economy view exposes movement in tiles and reset eligibility", () => {
    assert.deepEqual(turnEconomyView({
        primaryAction: { used: true },
        waterExtraAction: { available: true, used: false },
        freeMovement: { budget: 7, spent: 2, used: false, movementIds: ["move-1"] },
        movementUndoAvailable: true,
    }), {
        primary: { available: false, used: true },
        water: { available: true, used: false },
        movement: { available: true, used: false, remainingFields: 5, resetAvailable: true },
    });
});

test("movement reset stays disabled while an action is reserved", () => {
    const view = turnEconomyView({
        freeMovement: { budget: 3, spent: 1, movementIds: ["move-1"] },
        movementUndoAvailable: true,
        reservations: { action: { reservationId: "action" } },
    });
    assert.equal(view.movement.resetAvailable, false);
});

test("palettes persist outside combat while conflict-only chrome does not", () => {
    assert.deepEqual(profileUiState("universal", { activeTurn: true }), {
        inConflict: false,
        showEconomy: false,
        showEndTurn: false,
        palettes: ["skills", "techniques", "equipment"],
    });
    assert.deepEqual(profileUiState("skirmish", { activeTurn: true }), {
        inConflict: true,
        showEconomy: true,
        showEndTurn: true,
        palettes: ["skills", "techniques", "equipment"],
    });
});

test("Water extra-action disabled reasons come from check and action-type metadata", () => {
    const state = {
        primaryAction: { used: true },
        waterExtraAction: { available: true, used: false },
        actionTypesUsed: ["support"],
    };
    assert.equal(waterExtraActionRestriction(state, { requiresCheck: true, actionTypes: ["attack"] }), "requiresCheck");
    assert.equal(waterExtraActionRestriction(state, { requiresCheck: false, actionTypes: ["support"] }), "actionTypeConflict");
    assert.equal(waterExtraActionRestriction(state, { requiresCheck: false, actionTypes: ["move"] }), null);
});

test("incomplete techniques fail safely and non-rituals remain informational outside combat", () => {
    assert.deepEqual(getTechniqueAvailability({ system: { technique_type: "kata", skill: "" } }, "skirmish"), {
        usable: false,
        reason: "enhancedcombathud-l5r5e.techniques.informational_only",
    });
    assert.deepEqual(getTechniqueAvailability({ system: { technique_type: "kata", skill: "melee" } }, "universal"), {
        usable: false,
        uncertain: true,
        reason: "enhancedcombathud-l5r5e.techniques.context_unknown",
    });
    assert.equal(getTechniqueAvailability({
        system: { technique_type: "kata", skill: "", activation: { requires_check: true } },
    }, "skirmish").usable, true);
    assert.equal(getTechniqueAvailability({ system: { technique_type: "ritual", skill: "theology" } }, "universal").usable, true);
});

test("HUD consumes the core action registry and immediate API with stable metadata", async () => {
    const calls = [];
    const actor = { id: "a", uuid: "Actor.a" };
    const combatant = { actor };
    globalThis.game = {
        user: { isGM: true },
        combat: { started: true, combatants: [combatant] },
        l5r5e: {
            actionRegistry: registry,
            actions: { executeImmediate: async (...args) => { calls.push(args); return { ok: true }; } },
        },
    };
    assert.equal(getActionDefinition("wait"), registry.wait);
    const result = await executeImmediateAction(actor, "wait", { turnStateChanges: { wait: "when attacked" } });
    assert.equal(result.ok, true);
    assert.equal(calls[0][1].context.actionId, "wait");
    assert.deepEqual(calls[0][1].context.actionTypes, ["support"]);
    assert.deepEqual(calls[0][1].turnStateChanges, { wait: "when attacked" });
});

test("HUD Strike freezes active profile, target and stable action context", () => {
    let options;
    globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
    globalThis.game = {
        user: { isGM: true, targets: new Set() },
        l5r5e: { DicePickerDialog: class { constructor(value) { options = value; } render() {} } },
    };
    globalThis.canvas = { tokens: { controlled: [] } };
    const actor = { type: "npc", system: { stance: "fire" }, testUserPermission: () => false };
    const target = { uuid: "Scene.s.Token.t" };
    const weapon = {
        type: "weapon",
        system: { equipped: true, readied: true, skill: "melee" },
        attackProfile: { deadliness: 6, range_min: 1, range_max: 2 },
    };
    assert.ok(openWeaponStrike(actor, weapon, { target }));
    assert.equal(options.actionId, "strike");
    assert.deepEqual(options.actions, { attack: true });
    assert.equal(options.rollContext.targetUuid, target.uuid);
    assert.deepEqual(options.rollContext.attackProfileSnapshot, weapon.attackProfile);
    assert.notEqual(options.rollContext.attackProfileSnapshot, weapon.attackProfile);
});

test("HUD attack kata carries the active weapon profile and the selected target into the core roll", () => {
    let options;
    const targetDocument = { uuid: "Scene.scene.Token.target" };
    const profile = { range: { minimum: 1, maximum: 2 }, damage: 4, deadliness: 5, skillId: "melee", itemUuid: "Actor.a.Item.katana" };
    const weapon = { uuid: profile.itemUuid };
    const actor = { id: "a", uuid: "Actor.a", type: "character", isOwner: true, system: { stance: "water" }, items: [weapon] };
    const technique = {
        type: "technique",
        system: {
            rulesKey: "heartpiercing-strike",
            ring: "fire",
            difficulty: 4,
            activation: { requires_check: true, action_types: ["attack", "move"], weapon: { skill_mode: "active-profile" } },
        },
    };
    globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
    globalThis.game = {
        user: { isGM: true, targets: new Set([{ document: targetDocument }]) },
        l5r5e: {
            equipment: { getAttackProfiles: () => [profile] },
            DicePickerDialog: class { constructor(value) { options = value; } render() {} },
        },
    };
    assert.ok(openTechniqueRoll(actor, technique));
    assert.equal(options.target, targetDocument);
    assert.deepEqual(options.actions, { attack: true, move: true });
    assert.equal(options.rollContext.targetUuid, targetDocument.uuid);
    assert.deepEqual(options.rollContext.attackProfileSnapshot, profile);
    assert.notEqual(options.rollContext.attackProfileSnapshot, profile);
    assert.equal(options.skillsList, "melee");
});

test("checked actions are not consumed by module turn-state writes", () => {
    const actions = fs.readFileSync(new URL("../scripts/actions.js", import.meta.url), "utf8");
    const state = fs.readFileSync(new URL("../scripts/state.js", import.meta.url), "utf8");
    assert.equal(actions.includes("consumeAction"), false);
    assert.equal(state.includes(`setFlag(MODULE_ID, LEGACY_TURN_FLAG`), false);
});

test("Throw Item preserves the configured improvised profile for non-weapon objects", async () => {
    const skirmish = fs.readFileSync(new URL("../scripts/profiles/skirmish.js", import.meta.url), "utf8");
    const duel = fs.readFileSync(new URL("../scripts/profiles/duel.js", import.meta.url), "utf8");
    assert.match(skirmish, /"throw_item"/);
    assert.match(duel, /"throw_item"/);

    let assessedOptions;
    let pickerOptions;
    const item = {
        id: "item-1",
        uuid: "Actor.a.Item.item-1",
        type: "item",
        name: "Lantern",
        system: { equipped: true },
    };
    const items = [item];
    items.get = (id) => items.find((entry) => entry.id === id);
    const actor = {
        id: "a",
        uuid: "Actor.a",
        type: "character",
        isOwner: true,
        system: { stance: "fire" },
        items,
    };
    const targetActor = { uuid: "Actor.target" };
    const target = { uuid: "Scene.scene.Token.target", actor: targetActor };
    const intent = {
        ok: true,
        intentId: "throw-1",
        status: "assess",
        assessment: {
            roll: {
                actionId: "improvised-throw",
                skillId: "ranged",
                difficulty: 2,
                rollContext: { equipmentIntentId: "throw-1", throwMode: "improvised" },
            },
        },
    };
    const equipment = {
        heldItems: () => [item],
        throwableItems: () => [item],
        isSoaringSliceWeapon: () => false,
        throw: (_actor, _item, options) => {
            assessedOptions = options;
            return intent;
        },
        confirm: (value) => ({ ...value, status: "confirmed" }),
        reserve: async (value) => ({ ...value, status: "reserved" }),
        cancel: async () => {},
    };
    globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
    globalThis.game = {
        settings: { get: (_namespace, key) => key === "enableImprovisedThrowAction" },
        user: { isGM: false, targets: new Set([{ document: target }]) },
        l5r5e: {
            equipment,
            DicePickerDialog: class {
                constructor(options) { pickerOptions = options; }
                render() {}
            },
        },
    };

    assert.equal(await throwItem(actor), true);
    assert.deepEqual(assessedOptions, { mode: "improvised", trackIndividual: true });
    assert.equal(pickerOptions.actionId, "improvised-throw");
    assert.equal(pickerOptions.item, item);
    assert.equal(pickerOptions.target, target);
    assert.equal(pickerOptions.rollContext.equipmentIntentId, "throw-1");
    assert.equal(pickerOptions.rollContext.targetUuid, targetActor.uuid);
    assert.equal(pickerOptions.rollContext.targetTokenUuid, target.uuid);
});

test("Throw Item routes eligible one-handed weapons through the Soaring Slice profile", async () => {
    const weapon = {
        id: "knife-1",
        uuid: "Actor.a.Item.knife-1",
        type: "weapon",
        name: "Concealable Knife",
        system: { equipped: true, readied: false, properties: [{ rulesKey: "concealable" }] },
        attackProfile: { grip: "one-handed", skillId: "melee", damage: 2, deadliness: 4 },
    };
    const items = [weapon];
    items.get = (id) => items.find((entry) => entry.id === id);
    const actor = { id: "a", uuid: "Actor.a", type: "character", isOwner: true, system: { stance: "water" }, items };
    const targetActor = { uuid: "Actor.target" };
    const target = { uuid: "Scene.scene.Token.target", actor: targetActor };
    let assessedOptions;
    let pickerOptions;
    const intent = { ok: true, intentId: "throw-2", status: "assess", assessment: { roll: { actionId: "soaring-slice", skillId: "melee", difficulty: 2, rollContext: { equipmentIntentId: "throw-2", throwMode: "soaring-slice" } } } };
    const equipment = {
        throwableItems: () => [weapon],
        isSoaringSliceWeapon: (item) => item === weapon,
        throw: (_actor, _item, options) => { assessedOptions = options; return intent; },
        confirm: (value) => ({ ...value, status: "confirmed" }),
        reserve: async (value) => ({ ...value, status: "reserved" }),
        cancel: async () => {},
    };
    globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
    globalThis.game = {
        settings: { get: (_namespace, key) => key === "enableImprovisedThrowAction" },
        user: { isGM: false, targets: new Set([{ document: target }]) },
        l5r5e: { equipment, DicePickerDialog: class { constructor(options) { pickerOptions = options; } render() {} } },
    };

    assert.equal(await throwItem(actor), true);
    assert.deepEqual(assessedOptions, { mode: "soaring-slice", trackIndividual: true });
    assert.equal(pickerOptions.actionId, "soaring-slice");
    assert.equal(pickerOptions.skillId, "melee");
    assert.equal(pickerOptions.rollContext.throwMode, "soaring-slice");
    assert.equal(pickerOptions.rollContext.targetTokenUuid, target.uuid);
});

test("HUD layout keeps the portrait clear and exposes persistent equipment cards", () => {
    const portrait = fs.readFileSync(new URL("../scripts/portrait.js", import.meta.url), "utf8");
    const actions = fs.readFileSync(new URL("../scripts/actions.js", import.meta.url), "utf8");
    const weapons = fs.readFileSync(new URL("../scripts/weapons.js", import.meta.url), "utf8");
    const styles = fs.readFileSync(new URL("../styles/hud.css", import.meta.url), "utf8");
    const mockup = styles.slice(styles.indexOf("/* v2.0.11 final cascade overrides"));
    assert.match(portrait, /#buildWeapon\(\)/);
    assert.match(portrait, /l5r5e-gear-strip/);
    assert.match(portrait, /this\.element\.matches\?\.\("\.portrait-hud"\)/);
    assert.match(portrait, /l5r5e-weapon-card/);
    assert.match(portrait, /l5r5e-armor-row/);
    assert.match(portrait, /rangeHighlight/);
    assert.match(styles, /--l5r5e-washi/);
    assert.match(styles, /--l5r5e-large-tile:\s*300px/);
    assert.match(styles, /--l5r5e-gear-width:\s*calc\(var\(--l5r5e-gear-tile\) \* 2\)/);
    assert.match(styles, /\.extended-combat-hud > \.weapon-sets \{\s*display:\s*grid !important;/);
    assert.equal(styles.includes(".extended-combat-hud > .weapon-sets {\n    display: none !important;"), false);
    assert.match(styles, /\.l5r5e-gear-strip[\s\S]*grid-template-columns:\s*repeat\(2/);
    assert.match(styles, /\.l5r5e-turn-economy/);
    assert.match(styles, /\.l5r5e-action-group-buttons/);
    assert.match(styles, /\.l5r5e-palette-rail/);
    assert.match(styles, /\.l5r5e-palette-search/);
    assert.match(styles, /mask-image:\s*none/);
    assert.match(mockup, /grid-template-rows:\s*minmax\(0, 1fr\)/);
    assert.match(styles, /display:\s*grid !important/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(actions, /aria-label/);
    assert.match(actions, /classifyActionIds/);
    assert.match(actions, /resolveProfileActionIds/);
    assert.match(actions, /actionId === "strike" && !getTargetToken\(\)/);
    assert.match(weapons, /equipment\.changeLoadout\(this\.actor,\s*activeItems\)/);
    assert.match(weapons, /_initialSetSynchronized/);
    assert.doesNotMatch(weapons, /setFlag\(MODULE_ID,\s*"currentGrip"/);
    assert.doesNotMatch(weapons, /updateEmbeddedDocuments/);
});
