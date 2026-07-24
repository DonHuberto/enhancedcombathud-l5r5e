import { MODULE_ID, SKILL_CATEGORIES, localize } from "./config.js";
import { canUseActor } from "./state.js";
import { getTargetToken, notify } from "./utils.js";

export function openDicePicker(actor, options = {}) {
    if (!canUseActor(actor)) {
        notify(`${MODULE_ID}.notifications.no_permission`, "warn");
        return null;
    }
    if (!game.l5r5e?.DicePickerDialog) {
        notify(`${MODULE_ID}.notifications.dice_picker_unavailable`, "error");
        return null;
    }

    const pickerOptions = {
        actor,
        ringId: options.ringId ?? actor.system?.stance,
        target: options.target ?? getTargetToken(),
        ...options,
    };

    for (const [key, value] of Object.entries(pickerOptions)) {
        if (value === null || value === undefined || value === "") delete pickerOptions[key];
    }

    const dialog = new game.l5r5e.DicePickerDialog(pickerOptions);
    dialog.render(true);
    return dialog;
}

export function openSkillRoll(actor, skillId) {
    return openDicePicker(actor, { skillId });
}

export function openGenericRoll(actor, overrides = {}) {
    return openDicePicker(actor, {
        skillsList: SKILL_CATEGORIES.join(","),
        difficulty: 2,
        ...overrides,
    });
}

export function openTechniqueRoll(actor, technique) {
    const skill = String(technique?.system?.skill ?? "").trim();
    if (!skill) {
        notify(`${MODULE_ID}.notifications.technique_informational`, "info", { name: technique?.name ?? "" });
        technique?.sheet?.render(true);
        return null;
    }

    const actionId = String(technique.system?.activation?.action_id ?? "").trim() || null;
    const actionTypes = technique.system?.activation?.action_types ?? [];
    return openDicePicker(actor, {
        item: technique,
        ringId: technique.system?.ring || actor.system?.stance,
        difficulty: technique.system?.difficulty || 2,
        skillsList: skill,
        actions: Object.fromEntries(actionTypes.map((type) => [type, true])),
        actionId,
        rollContext: actionId ? { actionId } : undefined,
    });
}

export function openWeaponStrike(actor, weapon, { difficulty = 2, target = getTargetToken() } = {}) {
    const virtual = Boolean(weapon?.virtual);
    if (!virtual && (!weapon?.system?.equipped || !weapon?.system?.readied)) {
        notify(`${MODULE_ID}.notifications.weapon_not_readied`, "warn", { name: weapon?.name ?? "" });
        return null;
    }
    if (weapon?.available === false) {
        notify(`${MODULE_ID}.notifications.attack_profile_unavailable`, "warn");
        return null;
    }
    const attackProfileSnapshot = foundry.utils.deepClone((virtual ? weapon : weapon.attackProfile) ?? {
        damage: weapon.system.damage,
        deadliness: weapon.system.deadliness,
        range_min: weapon.system.grip_profiles?.[weapon.system.active_grip]?.range_min ?? 0,
        range_max: weapon.system.grip_profiles?.[weapon.system.active_grip]?.range_max ?? (Number(weapon.system.range) || 0),
    });
    return openDicePicker(actor, {
        item: virtual ? undefined : weapon,
        skillId: attackProfileSnapshot.skillId ?? weapon.system?.skill,
        difficulty,
        target,
        actions: { attack: true },
        actionId: "strike",
        rollContext: {
            actionId: "strike",
            attackProfileSnapshot,
            targetUuid: target?.uuid ?? null,
        },
    });
}

export function getPersuadeOptions(actor) {
    const targets = Array.from(game.user?.targets ?? []).map((token) => token.document).filter(Boolean);
    const first = targets[0] ?? null;
    const hiddenTargets = targets.filter((token) => {
        const targetActor = token.actor;
        return !game.user?.isGM && !targetActor?.testUserPermission?.(game.user, "OBSERVER");
    });
    const difficulties = targets
        .filter((token) => game.user?.isGM || token.actor?.testUserPermission?.(game.user, "OBSERVER"))
        .map((token) => Number(token.actor?.system?.vigilance))
        .filter(Number.isFinite);
    const difficulty = difficulties.length ? Math.max(...difficulties) : 2;
    const difficultyHidden = hiddenTargets.length > 0;

    return {
        actor,
        target: first,
        difficulty,
        difficultyHidden,
        skillsList: "social",
        actions: { scheme: true },
        actionId: "persuade",
        rollContext: { actionId: "persuade" },
        remoteRequired: difficultyHidden && !game.user?.isGM,
        targetTokenIds: targets.map((token) => token.id),
        sceneId: canvas.scene?.id,
    };
}

export function openPersuadeRoll(actor) {
    const options = getPersuadeOptions(actor);
    if (!options.target) notify(`${MODULE_ID}.notifications.no_target`, "warn");
    delete options.remoteRequired;
    delete options.targetTokenIds;
    delete options.sceneId;
    return openDicePicker(actor, options);
}

export function getSkillLabel(skillId, category = CONFIG.l5r5e?.skills?.get(skillId)) {
    const key = `l5r5e.skills.${category}.${skillId}`;
    const translated = game.i18n.localize(key);
    return translated === key ? skillId : translated;
}

export function getTechniqueLabel(type) {
    const key = `l5r5e.techniques.${type}`;
    const translated = game.i18n.localize(key);
    return translated === key ? localize(`${MODULE_ID}.techniques.types.${type}`) : translated;
}
