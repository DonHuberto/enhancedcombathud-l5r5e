import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { openWeaponStrike } from "../scripts/rolls.js";
import { executeImmediateAction, getActionDefinition } from "../scripts/state.js";

const registry = {
    wait: { actionId: "wait", actionTypes: ["support"], requiresCheck: false },
    strike: { actionId: "strike", actionTypes: ["attack"], requiresCheck: true },
};

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
