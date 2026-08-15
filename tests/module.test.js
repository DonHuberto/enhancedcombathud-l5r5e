import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ACTIONS_BY_PROFILE, ACTION_ICONS, HUD_ICONS, MODULE_ID, PROFILES } from "../scripts/config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function json(path) {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function getProperty(object, path) {
    return path.split(".").reduce((value, part) => value?.[part], object);
}

test("manifest targets Foundry 14 and the supported Core/System baselines", () => {
    const manifest = json("module.json");
    assert.equal(manifest.id, MODULE_ID);
    assert.deepEqual(manifest.compatibility, { minimum: "14", verified: "14", maximum: "14" });
    assert.equal(manifest.relationships.requires[0].id, "enhancedcombathud");
    assert.equal(manifest.relationships.requires[0].compatibility.minimum, "5.0.1");
    assert.equal(manifest.relationships.systems[0].id, "l5r5e");
    assert.equal(manifest.relationships.systems[0].compatibility.minimum, "1.14.116");
    assert.equal(manifest.version, "2.0.13");
    assert.equal(manifest.manifest.endsWith("/releases/latest/download/module.json"), true);
    assert.equal(manifest.download.endsWith("/releases/download/v2.0.13/module.zip"), true);
    assert.ok(manifest.changelog);
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.systems, undefined);
});

test("English and Polish localization trees have exactly the same keys", () => {
    const flatten = (value, prefix = "", output = []) => {
        for (const [key, child] of Object.entries(value)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (child && typeof child === "object") flatten(child, path, output);
            else output.push(path);
        }
        return output.sort();
    };

    assert.deepEqual(flatten(json("languages/pl.json")), flatten(json("languages/en.json")));
});

test("every profile action is localized and every referenced module icon exists", () => {
    const en = json("languages/en.json");
    const pl = json("languages/pl.json");
    for (const profile of PROFILES) {
        assert.ok(getProperty(en, `${MODULE_ID}.profiles.${profile}`));
        assert.ok(getProperty(pl, `${MODULE_ID}.profiles.${profile}`));
        for (const action of ACTIONS_BY_PROFILE[profile]) {
            assert.ok(getProperty(en, `${MODULE_ID}.actions.${action}.label`), `missing en action: ${action}`);
            assert.ok(getProperty(pl, `${MODULE_ID}.actions.${action}.label`), `missing pl action: ${action}`);
            assert.ok(ACTION_ICONS[action], `missing action icon mapping: ${action}`);
        }
    }

    for (const icon of Object.values(ACTION_ICONS)) {
        const prefix = `modules/${MODULE_ID}/`;
        if (icon.startsWith(prefix)) assert.ok(existsSync(resolve(root, icon.slice(prefix.length))), `missing icon: ${icon}`);
    }
    for (const group of Object.values(HUD_ICONS)) {
        for (const icon of Object.values(group)) {
            const prefix = `modules/${MODULE_ID}/`;
            if (icon.startsWith(prefix)) assert.ok(existsSync(resolve(root, icon.slice(prefix.length))), `missing HUD icon: ${icon}`);
        }
    }
});

test("static adapter localization references resolve", () => {
    const en = json("languages/en.json");
    const localizableRoots = new Set([
        "common",
        "profiles",
        "resources",
        "warnings",
        "social",
        "target",
        "drawer",
        "palettes",
        "action_groups",
        "action_types",
        "turn",
        "skills",
        "peculiarities",
        "equipment",
        "techniques",
        "effects",
        "unmask",
        "actions",
        "notifications",
        "chat",
        "trackers",
    ]);
    const files = (directory) =>
        readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
            const path = resolve(directory, entry.name);
            return entry.isDirectory() ? files(path) : entry.name.endsWith(".js") ? [path] : [];
        });
    const keys = new Set();
    for (const path of files(resolve(root, "scripts"))) {
        const source = readFileSync(path, "utf8");
        for (const match of source.matchAll(/\$\{MODULE_ID\}\.([a-z0-9_.-]+)/gi)) {
            const suffix = match[1];
            if (!suffix.endsWith(".") && localizableRoots.has(suffix.split(".")[0])) keys.add(`${MODULE_ID}.${suffix}`);
        }
    }
    for (const key of keys) assert.notEqual(getProperty(en, key), undefined, `missing localization: ${key}`);
});
