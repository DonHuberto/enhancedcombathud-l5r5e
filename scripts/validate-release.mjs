import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const failures = [];
const requireFile = (relative, source) => {
    const clean = String(relative).replace(/^\.\//, "").split(/[?#]/)[0];
    if (!fs.existsSync(path.join(root, clean))) failures.push(`${source}: missing ${clean}`);
};
for (const key of ["esmodules", "scripts", "styles"]) for (const entry of manifest[key] ?? []) requireFile(entry, key);
for (const language of manifest.languages ?? []) requireFile(language.path, "language");

const base = "https://github.com/DonHuberto/enhancedcombathud-l5r5e";
if (manifest.manifest !== `${base}/releases/latest/download/module.json`) failures.push("manifest URL is not stable");
if (manifest.download !== `${base}/releases/download/v${manifest.version}/module.zip`) failures.push("download URL/tag/basename mismatch");
if (!manifest.changelog?.endsWith("/CHANGELOG.md")) failures.push("public changelog URL is missing");
if (manifest.relationships?.systems?.find(({ id }) => id === "l5r5e")?.compatibility?.minimum !== "1.14.108") failures.push("core minimum must be 1.14.108");

const files = [];
const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else if (/\.(?:js|css|json|md)$/.test(entry.name)) files.push(absolute);
    }
};
for (const directory of ["scripts", "styles", "languages", "docs"]) walk(path.join(root, directory));
for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/modules\/enhancedcombathud-l5r5e\/([A-Za-z0-9_./-]+\.(?:svg|png|webp|css|js))/g)) {
        requireFile(match[1], path.relative(root, file));
    }
}
const config = fs.readFileSync(path.join(root, "scripts", "config.js"), "utf8");
if (config.includes('"free_movement",')) failures.push("Free Movement must not be in an action profile");
const state = fs.readFileSync(path.join(root, "scripts", "state.js"), "utf8");
if (state.includes(`setFlag(MODULE_ID, LEGACY_TURN_FLAG`)) failures.push("module turnState must never be written");

if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exit(1);
}
console.log(`Release contract and local-link/UI audit passed for ${manifest.id} ${manifest.version}.`);
