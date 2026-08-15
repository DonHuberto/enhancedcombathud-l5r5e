import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseCss = readFileSync(resolve(root, "styles/hud.css"), "utf8");
const fixes = readFileSync(resolve(root, "styles/hud-v2.0.12.css"), "utf8");
const css = `${baseCss}\n${fixes}`;
const correction = css.slice(css.indexOf("/* L5R5e cRPG layout correction"));
const mockup = baseCss.slice(baseCss.indexOf("/* v2.0.11 final cascade overrides"));
const portrait = readFileSync(resolve(root, "scripts/portrait.js"), "utf8");
const actions = readFileSync(resolve(root, "scripts/actions.js"), "utf8");
const identity = readFileSync(resolve(root, "scripts/identity.js"), "utf8");
const palettes = readFileSync(resolve(root, "scripts/palettes.js"), "utf8");
const skills = readFileSync(resolve(root, "scripts/skills.js"), "utf8");
const techniques = readFileSync(resolve(root, "scripts/techniques.js"), "utf8");
const equipment = readFileSync(resolve(root, "scripts/equipment.js"), "utf8");
const drawer = readFileSync(resolve(root, "scripts/drawer.js"), "utf8");

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
    assert.match(actions, /id === "movement" \? noCheckEconomy : checkEconomy/);
    assert.match(actions, /--l5r5e-fit-width/);
    assert.match(identity, /l5r5e-action-identity/);
    assert.doesNotMatch(portrait, /#buildNinjoGiri/);
    assert.match(mockup, /"identity economy-check economy-no-check end"/);
    assert.match(mockup, /background-position:\s*calc\(100% - 12px\) center/);
});

test("palettes are compact vertical lists and their close control removes the visible state", () => {
    assert.match(css, /\.l5r5e-palette-panel \.features-accordion-content[\s\S]*?flex-direction:\s*column/);
    assert.match(css, /\.l5r5e-palette-panel \.feature-element[\s\S]*?height:\s*38px !important/);
    assert.match(palettes, /panel\.element\.classList\.remove\("show"\)/);
    assert.match(palettes, /event\.stopPropagation\(\)/);
});

test("skills share the compact palette contract and have an explicit primary-click route", () => {
    assert.match(skills, /classList\.add\("l5r5e-palette-entry", "l5r5e-skill-entry"\)/);
    assert.match(skills, /bindHudPointerActivation\(element, \{ onLeft:/);
    assert.match(palettes, /addSearchUi\(this, "\.l5r5e-palette-entry"\)/);
    assert.match(fixes, /\.l5r5e-palette-entry[\s\S]*?height:\s*31px !important/);
    assert.match(fixes, /grid-template-columns:\s*1\.05rem minmax\(0, 1fr\)/);
    assert.match(fixes, /\.features-accordion-content\s*\{[\s\S]*?transform:\s*none !important/);
});

test("identity popovers stack inside the viewport and resource values remain bounded", () => {
    assert.match(identity, /l5r5e-social-popovers/);
    assert.match(fixes, /\.l5r5e-social-popovers\s*\{[\s\S]*?flex-direction:\s*column-reverse/);
    assert.match(fixes, /\.l5r5e-social-popovers \.l5r5e-social-popover\s*\{[\s\S]*?position:\s*static/);
    assert.match(fixes, /\.l5r5e-resource-value\s*\{[\s\S]*?justify-self:\s*end/);
    assert.match(fixes, /\.l5r5e-warnings\s*\{[\s\S]*?flex-direction:\s*column/);
    assert.match(fixes, /left:\s*calc\(-1 \* var\(--l5r5e-large-tile\) \+ 8px\)/);
});

test("actions use dedicated icon nodes and movement reserves independent label/value space", () => {
    assert.match(actions, /installHudButtonIcon\(this\.element, this\.icon, "l5r5e-action-icon"\)/);
    assert.match(fixes, /grid-template-rows:\s*minmax\(0, 1fr\) minmax\(2\.35em, auto\)/);
    assert.match(fixes, /\.l5r5e-end-turn-slot \.action-element[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto/);
    assert.match(fixes, /\.l5r5e-economy-pill\.l5r5e-economy-movement[\s\S]*?min-width:\s*var\(--l5r5e-movement-width\)/);
});

test("resource and secondary-stat rows no longer request native tooltips", () => {
    const resourceBlock = portrait.slice(portrait.indexOf("#buildResources"), portrait.indexOf("#buildStats"));
    const statsBlock = portrait.slice(portrait.indexOf("#buildStats"), portrait.indexOf("#buildRings"));
    assert.doesNotMatch(resourceBlock, /dataset\.tooltip/);
    assert.doesNotMatch(statsBlock, /dataset\.tooltip/);
});

test("all Argon HUD tooltips use the paper surface and readable detail grid", () => {
    assert.match(fixes, /\.ech-tooltip-container > \.l5r5e-tooltip[\s\S]*?background:\s*#e8dcc1 !important/);
    assert.match(fixes, /\.ech-tooltip-details[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(fixes, /body:has\(\.extended-combat-hud:hover\) #tooltip/);
    assert.match(fixes, /max-height:\s*min\(333px, 33vh\) !important/);
    assert.match(fixes, /overflow-x:\s*hidden/);
    assert.match(fixes, /overflow-y:\s*auto/);
});

test("HUD documents use LMB preview and RMB edit without losing shifted actions", () => {
    assert.match(techniques, /if \(!event\?\.shiftKey\) return this\.item\?\.sheet\?\.render\(\{ force: true, editable: false \}\)/);
    assert.match(techniques, /editable:\s*true/);
    assert.match(equipment, /if \(!event\?\.shiftKey\) return this\.item\?\.sheet\?\.render\(\{ force: true, editable: false \}\)/);
    assert.match(equipment, /if \(!event\?\.shiftKey\) return this\.item\.sheet\.render\(\{ force: true, editable: true \}\)/);
    assert.doesNotMatch(drawer, /item\.sheet\.render\(true\)/);
    assert.match(drawer, /editable:\s*false/);
});

test("equipment uses system Conflict icons and the obsolete profile popup is absent", () => {
    const range = portrait.indexOf("fas fa-arrows-alt-h");
    const damage = portrait.indexOf("fas fa-tint", range);
    const deadliness = portrait.indexOf("fas fa-skull", damage);
    assert.ok(range > 0 && range < damage && damage < deadliness);
    assert.match(mockup, /\.l5r5e-armor-name,[\s\S]*?grid-column:\s*1 \/ -1/);
    assert.doesNotMatch(portrait, /#buildProfileTracker/);
});
