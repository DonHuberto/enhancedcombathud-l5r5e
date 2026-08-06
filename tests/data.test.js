import assert from "node:assert/strict";
import test from "node:test";

import {
    collectSkills,
    getActiveWeaponProfile,
    getResourceData,
    getResourceOrbView,
    getRingData,
    getTechniqueSkills,
    getWarningIds,
    getWeapons,
    numberValue,
    weaponCoversRange,
} from "../scripts/data.js";

test("numberValue normalizes finite values and preserves a fallback", () => {
    assert.equal(numberValue("4"), 4);
    assert.equal(numberValue(undefined, 2), 2);
    assert.equal(numberValue("not-a-number", 3), 3);
});

test("technique skills normalize strings, arrays and keyed objects", () => {
    assert.deepEqual(getTechniqueSkills({ system: { skill: "melee, fitness" } }), ["melee", "fitness"]);
    assert.deepEqual(getTechniqueSkills({ system: { skill: ["theology", "meditation"] } }), ["theology", "meditation"]);
    assert.deepEqual(getTechniqueSkills({ system: { skill: { melee: true, ranged: false } } }), ["melee"]);
});

test("weapon range strings cover only their declared abstract bands", () => {
    assert.equal(weaponCoversRange("1-2", 1), true);
    assert.equal(weaponCoversRange("1–2", 3), false);
    assert.equal(weaponCoversRange("3", 3), true);
    assert.equal(weaponCoversRange("special", 1), null);
});

test("resource data uses the L5R5e endurance, composure and void fields", () => {
    assert.deepEqual(
        getResourceData({
            fatigue: { value: 3 },
            endurance: 8,
            strife: { value: 4 },
            composure: 9,
            void_points: { value: 1, max: 2 },
        }),
        {
            fatigue: { value: 3, max: 8 },
            strife: { value: 4, max: 9 },
            void: { value: 1, max: 2 },
        },
    );
});

test("Fatigue and Strife tracks fill upward, grow past their thresholds and cap visually at 24", () => {
    assert.deepEqual(getResourceOrbView({ value: 0, max: 12, growsBeyondMax: true }), {
        threshold: 12,
        current: 0,
        displayed: 12,
        filled: 0,
        truncated: false,
    });
    assert.deepEqual(getResourceOrbView({ value: 13, max: 10, growsBeyondMax: true }), {
        threshold: 10,
        current: 13,
        displayed: 13,
        filled: 13,
        truncated: false,
    });
    assert.deepEqual(getResourceOrbView({ value: 25, max: 32, growsBeyondMax: true }), {
        threshold: 32,
        current: 25,
        displayed: 24,
        filled: 24,
        truncated: true,
    });
});

test("bounded Void points fill only their fixed diamond track", () => {
    assert.deepEqual(getResourceOrbView({ value: 2, max: 4 }), {
        threshold: 4,
        current: 2,
        displayed: 4,
        filled: 2,
        truncated: false,
    });
});

test("warnings cover thresholds and important system statuses", () => {
    const warnings = getWarningIds(
        {
            fatigue: { value: 9 },
            endurance: 8,
            strife: { value: 10 },
            composure: 9,
            void_points: { value: 0, max: 2 },
        },
        new Set(["compromised", "dying"]),
    );

    assert.deepEqual(warnings, [
        "high_strife",
        "strife_over_composure",
        "fatigue_over_endurance",
        "no_void",
        "compromised",
        "dying",
    ]);
});

test("skills, rings and weapon state are read from the system schema", () => {
    const skills = collectSkills({ skills: { martial: { fitness: 2, tactics: "3" }, social: { courtesy: 1 } } });
    assert.deepEqual(skills, [
        { id: "fitness", category: "martial", rank: 2 },
        { id: "tactics", category: "martial", rank: 3 },
        { id: "courtesy", category: "social", rank: 1 },
    ]);

    assert.deepEqual(getRingData({ rings: { earth: 2, water: 3 }, stance: "water" }).slice(0, 2), [
        { id: "earth", value: 2, selected: false },
        { id: "water", value: 3, selected: true },
    ]);

    const actor = {
        items: [
            { type: "weapon", system: { equipped: true, readied: true } },
            { type: "weapon", system: { equipped: true, readied: false } },
            { type: "armor", system: { equipped: true } },
        ],
    };
    assert.equal(getWeapons(actor).length, 2);
    assert.equal(getWeapons(actor, { equippedOnly: true }).length, 2);
    assert.equal(getWeapons(actor, { readiedOnly: true }).length, 1);
});

test("NPC skill groups are exposed without assuming the nested PC schema", () => {
    assert.deepEqual(collectSkills({ skills: { martial: 3, social: 2 } }), [
        { id: "martial", category: "martial", rank: 3 },
        { id: "social", category: "social", rank: 2 },
    ]);
});

test("active weapon uses the core readied profile and preserves its grip", () => {
    const readied = { uuid: "Actor.a.Item.katana", type: "weapon", name: "Katana" };
    const actor = { items: [readied] };
    const equipment = {
        getAttackProfiles: () => [
            { id: "unarmed-punch", source: "unarmed", grip: "unarmed", available: true },
            { id: "katana-two-handed", source: "weapon", itemUuid: readied.uuid, grip: "2h", damage: 6, available: true },
        ],
    };
    assert.deepEqual(getActiveWeaponProfile(actor, equipment), {
        profile: { id: "katana-two-handed", source: "weapon", itemUuid: readied.uuid, grip: "2h", damage: 6, available: true },
        item: readied,
    });
});
