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

test("open palettes rise above the portrait tier and tooltips share one flexible width", () => {
    assert.match(css, /\.action-hud:has\(> \.features-container\.show\)\s*\{[\s\S]*?z-index:\s*15;/);
    assert.ok(css.includes("bottom: calc(100% + var(--l5r5e-upper-height) + 18px);"));
    assert.match(css, /\.ech-tooltip-container:has\(> \.l5r5e-tooltip\)[\s\S]*?width:\s*min\(560px, calc\(100vw - 32px\)\) !important;/);
    assert.match(css, /\.ech-tooltip-container > \.l5r5e-tooltip[\s\S]*?width:\s*100%;/);
});

test("Focus and Vigilance use solid panels while bounded resources expose sphere rows", () => {
    assert.match(css, /\.l5r5e-resource-focus,[\s\S]*?\.l5r5e-resource-vigilance\s*\{[\s\S]*?background:\s*linear-gradient/);
    assert.match(css, /\.l5r5e-resource-orbs\s*\{[\s\S]*?grid-auto-flow:\s*column;/);
    assert.match(css, /\.l5r5e-resource-orb-overflow[\s\S]*?background:\s*radial-gradient/);
    assert.match(css, /\.l5r5e-weapon-properties,[\s\S]*?\.l5r5e-armor-properties\s*\{[\s\S]*?display:\s*block !important;/);
});
