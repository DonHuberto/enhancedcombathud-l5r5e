import assert from "node:assert/strict";
import test from "node:test";

import { canUseActor, getTurnState, normalizeProfile } from "../scripts/state.js";

test("profile normalization only admits supported conflict profiles", () => {
    assert.equal(normalizeProfile("intrigue"), "intrigue");
    assert.equal(normalizeProfile("mass_battle"), "mass_battle");
    assert.equal(normalizeProfile("unknown"), "skirmish");
    assert.equal(normalizeProfile("unknown", null), null);
});

test("HUD projects the canonical core Combatant turn state without module flags", () => {
    const canonical = {
        primaryAction: { used: true, actionId: "guard" },
        freeMovement: { used: false },
        waterExtraAction: { used: false },
        wait: null,
    };
    const actor = { id: "actor" };
    const combatant = { actor };
    globalThis.game = {
        combat: { started: true, combatants: [combatant] },
        l5r5e: { turns: { getState: () => canonical } },
    };
    const state = getTurnState(actor);
    assert.equal(state.actionUsed, true);
    assert.equal(state.movementUsed, false);
    assert.equal(state.guard, true);
    assert.equal(JSON.stringify(state).includes("enhancedcombathud-l5r5e"), false);
});

test("actor access supports owned characters and NPCs but never armies", () => {
    const user = { id: "u", isGM: false };
    const actor = (type, owner) => ({ type, testUserPermission: () => owner });
    assert.equal(canUseActor(actor("character", true), user), true);
    assert.equal(canUseActor(actor("npc", true), user), true);
    assert.equal(canUseActor(actor("npc", false), user), false);
    assert.equal(canUseActor(actor("army", true), user), false);
    assert.equal(canUseActor(actor("npc", false), { isGM: true }), true);
});
