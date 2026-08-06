import { RINGS, SKILL_CATEGORIES, TECHNIQUE_TYPES } from "./config.js";

export function numberValue(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function getResourceData(system = {}) {
    return {
        fatigue: {
            value: numberValue(system.fatigue?.value),
            max: numberValue(system.endurance ?? system.fatigue?.max),
        },
        strife: {
            value: numberValue(system.strife?.value),
            max: numberValue(system.composure ?? system.strife?.max),
        },
        void: {
            value: numberValue(system.void_points?.value),
            max: numberValue(system.void_points?.max ?? system.rings?.void, 1),
        },
    };
}

export function getWarningIds(system = {}, statuses = new Set()) {
    const resources = getResourceData(system);
    const warnings = [];

    if (resources.strife.max > 0 && resources.strife.value >= resources.strife.max) warnings.push("high_strife");
    if (resources.strife.value > resources.strife.max) warnings.push("strife_over_composure");
    if (resources.fatigue.value > resources.fatigue.max) warnings.push("fatigue_over_endurance");
    if (resources.void.value <= 0) warnings.push("no_void");

    for (const status of ["compromised", "incapacitated", "dying"]) {
        if (statuses.has(status)) warnings.push(status);
    }
    return warnings;
}

export function collectSkills(system = {}) {
    const result = [];
    for (const category of SKILL_CATEGORIES) {
        const skills = system.skills?.[category] ?? {};
        if (typeof skills === "number") {
            result.push({ id: category, category, rank: numberValue(skills) });
            continue;
        }
        for (const [id, rank] of Object.entries(skills)) {
            result.push({ id, category, rank: numberValue(rank) });
        }
    }
    return result;
}

export function collectTechniques(actor) {
    const techniques = [];
    for (const item of actor?.items ?? []) {
        if (item.type === "technique") techniques.push(item);
        if (item.type !== "title" || !(item.system?.items instanceof Map)) continue;

        for (const embedded of item.system.items.values()) {
            if (embedded.type === "technique") techniques.push(embedded);
        }

        if ((item.system?.xp_used ?? 0) >= (item.system?.xp_cost ?? Infinity)) {
            techniques.push(item);
        }
    }

    return techniques.sort((a, b) => {
        const aType = getTechniqueType(a);
        const bType = getTechniqueType(b);
        const typeDiff = TECHNIQUE_TYPES.indexOf(aType) - TECHNIQUE_TYPES.indexOf(bType);
        return typeDiff || a.name.localeCompare(b.name, globalThis.game?.i18n?.lang);
    });
}

export function getTechniqueType(item) {
    if (item?.type === "title") return "title_ability";
    const type = item?.system?.technique_type;
    return TECHNIQUE_TYPES.includes(type) ? type : "specificity";
}

export function getItemProperties(item) {
    const values = item?.system?.properties;
    if (!Array.isArray(values)) return [];
    return values
        .map((property) => (typeof property === "string" ? property : property?.name ?? property?.id))
        .filter(Boolean);
}

export function isEquipped(item) {
    return !!item?.system?.equipped;
}

export function isReadiedWeapon(item) {
    return item?.type === "weapon" && isEquipped(item) && !!item.system?.readied;
}

export function getEquippedArmor(actor) {
    return (actor?.items ?? []).filter((item) => item.type === "armor" && isEquipped(item));
}

export function getWeapons(actor, { equippedOnly = false, readiedOnly = false } = {}) {
    return (actor?.items ?? []).filter((item) => {
        if (item.type !== "weapon") return false;
        if (equippedOnly && !isEquipped(item)) return false;
        if (readiedOnly && !isReadiedWeapon(item)) return false;
        return true;
    });
}

export function getActiveWeaponProfile(actor, equipmentApi = globalThis.game?.l5r5e?.equipment) {
    const profiles = (equipmentApi?.getAttackProfiles?.(actor) ?? [])
        .filter((profile) => profile?.available !== false);
    const profile = profiles.find((entry) => entry.source === "weapon")
        ?? profiles.find((entry) => entry.id === "unarmed-punch")
        ?? profiles[0]
        ?? null;
    const item = profile?.itemUuid
        ? [...(actor?.items ?? [])].find((candidate) => candidate.uuid === profile.itemUuid) ?? null
        : null;
    return { profile, item };
}

export function weaponCoversRange(range, band) {
    if (!Number.isFinite(Number(band))) return null;
    const values = String(range ?? "").match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
    if (!values.length) return null;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return Number(band) >= minimum && Number(band) <= maximum;
}

export function getRingData(system = {}) {
    return RINGS.map((id) => ({ id, value: numberValue(system.rings?.[id], 1), selected: system.stance === id }));
}
