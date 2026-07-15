import assert from "node:assert/strict";
import test from "node:test";

import { createTurnState, normalizeProfile } from "../scripts/state.js";

test("profile normalization only admits supported conflict profiles", () => {
    assert.equal(normalizeProfile("intrigue"), "intrigue");
    assert.equal(normalizeProfile("mass_battle"), "mass_battle");
    assert.equal(normalizeProfile("unknown"), "skirmish");
    assert.equal(normalizeProfile("unknown", null), null);
});

test("a fresh conflict turn has deterministic unused action economy", () => {
    assert.deepEqual(createTurnState("combat:2:1"), {
        turnKey: "combat:2:1",
        actionUsed: false,
        movementUsed: false,
        waterActionUsed: false,
        reactionUsed: false,
        guard: false,
        maneuver: false,
        wait: null,
    });
});
