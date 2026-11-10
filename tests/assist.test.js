import assert from "node:assert/strict";
import test from "node:test";
import { assistDiceCount, createPendingAssistMutation, registerAssistDicePicker } from "../scripts/assist.js";
import { getActionDefinition } from "../scripts/state.js";
import { classifyActionIds } from "../scripts/action-layout.js";

test("HUD adapter classifies Assist as a no-check Support action without mutating the core registry", () => {
    const assist = { actionId: "assist", actionTypes: ["support"], requiresCheck: true, profiles: ["skirmish"] };
    globalThis.game = { l5r5e: { actionRegistry: { assist } } };

    const hudDefinition = getActionDefinition("assist");
    assert.equal(hudDefinition.requiresCheck, false);
    assert.deepEqual(hudDefinition.actionTypes, ["support"]);
    assert.deepEqual(classifyActionIds({ assist: hudDefinition }, ["assist"]), {
        requiresCheck: [],
        noCheck: ["assist"],
    });
    assert.equal(assist.requiresCheck, true);
});

test("first Assist grant preserves the missing flag as undefined for transaction preconditions", () => {
    const actor = { uuid: "Actor.assisting" };
    const targetActor = { uuid: "Actor.target", getFlag: () => undefined };
    const targetToken = { uuid: "Scene.test.Token.target" };
    const { pendingAssist, mutation } = createPendingAssistMutation(actor, targetActor, targetToken);

    assert.equal(mutation.before, undefined);
    assert.equal(mutation.path, "flags.enhancedcombathud-l5r5e.pendingAssist");
    assert.deepEqual(pendingAssist, {
        bonusKeptDice: 1,
        targetTokenUuid: targetToken.uuid,
        createdBy: actor.uuid,
    });
});

test("subsequent Assist grants stack on the pending benefit", () => {
    const existing = { bonusKeptDice: 2, targetTokenUuid: "old-token", createdBy: "Actor.other" };
    const actor = { uuid: "Actor.assisting" };
    const targetActor = { uuid: "Actor.target", getFlag: () => existing };
    const targetToken = { uuid: "Scene.test.Token.target" };
    const { pendingAssist, mutation } = createPendingAssistMutation(actor, targetActor, targetToken);

    assert.equal(mutation.before, existing);
    assert.equal(pendingAssist.bonusKeptDice, 3);
    assert.equal(pendingAssist.targetTokenUuid, targetToken.uuid);
});

test("pending Assist is offered at the target's next check and adds a kept assistance die", async () => {
    let dialogResult = true;
    let removed = false;
    let submitted = false;
    class DicePicker {
        constructor() {
            this._actor = {
                getFlag: () => ({ bonusKeptDice: 1 }),
                unsetFlag: async () => { removed = true; },
            };
            this.object = { skill: { value: 2, assistance: 0 } };
            this._rollTransferred = false;
        }
        _quantityChange(_field, amount) { this.object.skill.value += amount; }
        async _updateObject() {
            submitted = true;
            this._rollTransferred = true;
            return true;
        }
    }
    globalThis.game = { l5r5e: { DicePickerDialog: DicePicker }, i18n: { localize: (key) => key, format: (key) => key } };
    globalThis.foundry = { applications: { api: { DialogV2: { confirm: async () => dialogResult } } } };

    assert.equal(registerAssistDicePicker(), true);
    const picker = new game.l5r5e.DicePickerDialog();
    await picker._updateObject();

    assert.equal(submitted, true);
    assert.equal(picker.object.skill.value, 3);
    assert.equal(picker.object.skill.assistance, 1);
    assert.equal(removed, true);
    assert.equal(assistDiceCount({ bonusKeptDice: 1 }), 1);
});

test("declining pending Assist consumes it and submits the check without a bonus", async () => {
    let removed = false;
    let submitted = false;
    class DicePicker {
        constructor() {
            this._actor = {
                getFlag: () => ({ bonusKeptDice: 1 }),
                unsetFlag: async () => { removed = true; },
            };
            this.object = { skill: { value: 2, assistance: 0 } };
        }
        _quantityChange(_field, amount) { this.object.skill.value += amount; }
        async _updateObject() { submitted = true; return true; }
    }
    globalThis.game = { l5r5e: { DicePickerDialog: DicePicker }, i18n: { localize: (key) => key, format: (key) => key } };
    globalThis.foundry = { applications: { api: { DialogV2: { confirm: async () => false } } } };

    assert.equal(registerAssistDicePicker(), true);
    const picker = new game.l5r5e.DicePickerDialog();
    await picker._updateObject();

    assert.equal(removed, true);
    assert.equal(submitted, true);
    assert.equal(picker.object.skill.value, 2);
    assert.equal(picker.object.skill.assistance, 0);
});
