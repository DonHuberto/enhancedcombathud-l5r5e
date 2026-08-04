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
import { openWeaponStrike } from "../scripts/rolls.js";
import { executeImmediateAction, getActionDefinition } from "../scripts/state.js";

const registry = {
    wait: { actionId: "wait", actionTypes: ["support"], requiresCheck: false },
    strike: { actionId: "strike", actionTypes: ["attack"], requiresCheck: true },
};

test("every displayed profile action has one executable route and profile lists cannot drift", () => {
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

test("checked actions are not consumed by module turn-state writes", () => {
    const actions = fs.readFileSync(new URL("../scripts/actions.js", import.meta.url), "utf8");
    const state = fs.readFileSync(new URL("../scripts/state.js", import.meta.url), "utf8");
    assert.equal(actions.includes("consumeAction"), false);
    assert.equal(state.includes(`setFlag(MODULE_ID, LEGACY_TURN_FLAG`), false);
});

test("Throw Item reserves an improvised core intent and opens the system check", async () => {
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
});

test("HUD layout keeps the portrait clear and exposes persistent equipment cards", () => {
    const portrait = fs.readFileSync(new URL("../scripts/portrait.js", import.meta.url), "utf8");
    const actions = fs.readFileSync(new URL("../scripts/actions.js", import.meta.url), "utf8");
    const weapons = fs.readFileSync(new URL("../scripts/weapons.js", import.meta.url), "utf8");
    const styles = fs.readFileSync(new URL("../styles/hud.css", import.meta.url), "utf8");
    assert.match(portrait, /#buildWeapon\(\)/);
    assert.match(portrait, /l5r5e-gear-strip/);
    assert.match(portrait, /this\.element\.matches\?\.\("\.portrait-hud"\)/);
    assert.match(portrait, /l5r5e-weapon-card/);
    assert.match(portrait, /l5r5e-armor-row/);
    assert.match(portrait, /rangeHighlight/);
    assert.match(styles, /--l5r5e-washi/);
    assert.match(styles, /--l5r5e-large-tile:\s*300px/);
    assert.match(styles, /> \.weapon-sets[\s\S]*display:\s*none !important/);
    assert.match(styles, /\.l5r5e-gear-strip[\s\S]*grid-template-columns:\s*repeat\(2/);
    assert.match(styles, /mask-image:\s*none/);
    assert.match(styles, /grid-template-rows:\s*repeat\(2/);
    assert.match(styles, /display:\s*grid !important/);
    assert.match(styles, /\.action-element\.l5r5e-large-action/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.match(actions, /aria-label/);
    assert.match(actions, /actionId === "strike" && !getTargetToken\(\)/);
    assert.match(weapons, /equipment\.changeLoadout\(this\.actor,\s*activeItems\)/);
    assert.match(weapons, /_initialSetSynchronized/);
    assert.doesNotMatch(weapons, /setFlag\(MODULE_ID,\s*"currentGrip"/);
    assert.doesNotMatch(weapons, /updateEmbeddedDocuments/);
});
