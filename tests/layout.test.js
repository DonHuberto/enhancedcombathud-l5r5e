import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "styles/hud.css"), "utf8");
const correction = css.slice(css.indexOf("/* L5R5e cRPG layout correction"));
const mockup = css.slice(css.indexOf("/* v2.0.10 final cascade overrides"));
const portrait = readFileSync(resolve(root, "scripts/portrait.js"), "utf8");
const actions = readFileSync(resolve(root, "scripts/actions.js"), "utf8");

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

test("accumulating resources wrap after twelve spheres and Void uses diamonds", () => {
    assert.match(mockup, /grid-template-columns:\s*repeat\(12, var\(--l5r5e-orb-size\)\)/);
    assert.match(mockup, /\.l5r5e-resource-orbs-void[\s\S]*?transform:\s*rotate\(45deg\)/);
    assert.match(portrait, /growsBeyondMax/);
    assert.doesNotMatch(portrait, /l5r5e-resource-orb-overflow/);
});

test("secondary stats, palettes, economy and actions follow the mockup hierarchy", () => {
    assert.match(css, /\.l5r5e-stat-list[\s\S]*?grid-template-columns:\s*1fr/);
    assert.match(css, /\.l5r5e-palette-action::before/);
    assert.match(css, /\.l5r5e-palette-action::after/);
    assert.match(mockup, /\.l5r5e-action-group-buttons,[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\)/);
    assert.match(actions, /id === "water" && this\.actor\.system\?\.stance !== "water"/);
    assert.match(actions, /l5r5e-economy-icon/);
});

test("equipment uses system Conflict icons and the obsolete profile popup is absent", () => {
    const range = portrait.indexOf("fas fa-arrows-alt-h");
    const damage = portrait.indexOf("fas fa-tint", range);
    const deadliness = portrait.indexOf("fas fa-skull", damage);
    assert.ok(range > 0 && range < damage && damage < deadliness);
    assert.match(mockup, /\.l5r5e-armor-name,[\s\S]*?grid-column:\s*1 \/ -1/);
    assert.doesNotMatch(portrait, /#buildProfileTracker/);
});
