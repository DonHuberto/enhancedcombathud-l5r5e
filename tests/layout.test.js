import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "styles/hud.css"), "utf8");
const correction = css.slice(css.indexOf("/* L5R5e cRPG layout correction"));

test("the corrected HUD preserves Argon's compensating width and two-tier layout", () => {
    assert.ok(correction.includes("max-width: none;"), "Argon's scaled width must not be clamped to 100vw");
    assert.ok(correction.includes("--l5r5e-upper-height:"), "upper character/equipment tier is missing");
    assert.ok(correction.includes("--l5r5e-action-height:"), "lower action tier is missing");
    assert.ok(
        correction.includes("height: calc(var(--l5r5e-upper-height) + var(--l5r5e-action-height)) !important;"),
        "HUD height must combine the character/equipment and action tiers",
    );
});

test("weapon and armor use full square tiles beside the character panel", () => {
    assert.ok(correction.includes("--l5r5e-gear-tile: var(--l5r5e-large-tile);"));
    assert.match(correction, /grid-template-columns:\s*repeat\(2, var\(--l5r5e-gear-tile\)\)/);
    assert.match(correction, /\.l5r5e-gear-strip > \* \{[\s\S]*?height: var\(--l5r5e-large-tile\);[\s\S]*?width: var\(--l5r5e-gear-tile\);/);
});

test("Universal remains compact while conflict profiles can span Argon's full width", () => {
    assert.match(correction, /\.extended-combat-hud:has\(\.l5r5e-profile-universal\)\s*\{/);
    assert.match(correction, /\.action-hud\s*\{[\s\S]*?width: 100%;/);
});
