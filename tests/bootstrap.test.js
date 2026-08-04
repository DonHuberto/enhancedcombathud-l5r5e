import assert from "node:assert/strict";
import test from "node:test";

test("bootstrap registers the V14 adapter surface for character and NPC actors", async () => {
    const onceHooks = new Map();
    globalThis.Hooks = {
        once: (name, callback) => onceHooks.set(name, callback),
        on: () => null,
    };
    globalThis.game = { system: { id: "l5r5e" } };

    await import("../scripts/main.js?bootstrap-test");

    class Component {}
    const registrations = {};
    const CoreHUD = {
        ARGON: {
            CORE: { Tooltip: Component },
            PORTRAIT: { PortraitPanel: Component },
            DRAWER: { DrawerButton: Component, DrawerPanel: Component },
            MAIN: {
                BUTTONS: { ItemButton: Component, ButtonPanelButton: Component, ActionButton: Component },
                BUTTON_PANELS: { ButtonPanel: Component },
                ActionPanel: Component,
            },
            WeaponSets: Component,
        },
        definePortraitPanel: (value) => (registrations.portrait = value),
        defineDrawerPanel: (value) => (registrations.drawer = value),
        defineMainPanels: (value) => (registrations.main = value),
        defineWeaponSets: (value) => (registrations.weaponSets = value),
        defineMovementHud: (value) => (registrations.movement = value),
        defineTooltip: (value) => (registrations.tooltip = value),
        defineSupportedActorTypes: (value) => (registrations.actorTypes = value),
    };

    assert.equal(typeof onceHooks.get("argonInit"), "function");
    onceHooks.get("argonInit")(CoreHUD);

    assert.equal(typeof registrations.portrait, "function");
    assert.equal(typeof registrations.drawer, "function");
    assert.equal(typeof registrations.weaponSets, "function");
    assert.equal(typeof registrations.tooltip, "function");
    assert.equal(registrations.main.length, 5);
    assert.equal(registrations.movement, null);
    assert.deepEqual(registrations.actorTypes, ["character", "npc"]);
});

test("missing optional Argon settings fail closed for player clients", async () => {
    globalThis.Hooks = { once: () => null, on: () => null };
    globalThis.game = {
        system: { id: "l5r5e" },
        settings: { get: () => { throw new Error('"enhancedcombathud.alwaysOn" is not a registered game setting'); } },
    };
    const { isCoreSettingEnabled } = await import(`../scripts/main.js?missing-setting=${Date.now()}`);
    assert.equal(isCoreSettingEnabled("alwaysOn"), false);
});
