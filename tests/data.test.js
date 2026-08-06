import assert from "node:assert/strict";
import test from "node:test";

import {
    collectSkills,
    getActiveWeaponProfile,
    getResourceData,
    getRingData,
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
