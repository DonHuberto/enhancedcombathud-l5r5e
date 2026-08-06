export const MODULE_ID = "enhancedcombathud-l5r5e";
export const CORE_ID = "enhancedcombathud";
export const SYSTEM_ID = "l5r5e";

export const PROFILES = Object.freeze([
    "universal",
    "intrigue",
    "duel",
    "skirmish",
    "mass_battle",
]);

export const RINGS = Object.freeze(["earth", "water", "fire", "air", "void"]);
export const SKILL_CATEGORIES = Object.freeze(["artisan", "martial", "scholar", "social", "trade"]);

export const ACTION_TYPES = Object.freeze(["attack", "scheme", "support", "move"]);

export const HUD_ICONS = Object.freeze({
    stats: Object.freeze({
        focus: `modules/${MODULE_ID}/icons/stats/focus.svg`,
        vigilance: `modules/${MODULE_ID}/icons/stats/vigilance.svg`,
        honor: `modules/${MODULE_ID}/icons/stats/honor.svg`,
        glory: `modules/${MODULE_ID}/icons/stats/glory.svg`,
        status: `modules/${MODULE_ID}/icons/stats/status.svg`,
    }),
    economy: Object.freeze({
        primary: `modules/${MODULE_ID}/icons/economy/action.svg`,
        water: "systems/l5r5e/assets/icons/rings/water.svg",
        movement: `modules/${MODULE_ID}/icons/economy/movement.svg`,
    }),
});

export const ACTIONS_BY_PROFILE = Object.freeze({
    universal: ["generic_roll"],
    intrigue: ["persuade", "assist", "calming_breath", "custom_action"],
    duel: ["calming_breath", "center", "predict", "prepare_item", "strike", "throw_item", "custom_action", "staredown", "concede"],
    skirmish: [
        "assist",
        "calming_breath",
        "challenge",
        "guard",
        "maneuver",
        "prepare_item",
        "strike",
        "throw_item",
        "custom_action",
    ],
    mass_battle: ["assault", "challenge", "rally", "reinforce"],
});

export const ACTION_ICONS = Object.freeze({
    generic_roll: "systems/l5r5e/assets/icons/rings/void.svg",
    skills: `modules/${MODULE_ID}/icons/palettes/skills.svg`,
    assist: `modules/${MODULE_ID}/icons/assist.svg`,
    calming_breath: `modules/${MODULE_ID}/icons/calming-breath.svg`,
    challenge: `modules/${MODULE_ID}/icons/challenge.svg`,
    center: `modules/${MODULE_ID}/icons/center.svg`,
    predict: `modules/${MODULE_ID}/icons/predict.svg`,
    prepare_item: `modules/${MODULE_ID}/icons/prepare-item.svg`,
    strike: `modules/${MODULE_ID}/icons/strike.svg`,
    throw_item: `modules/${MODULE_ID}/icons/throw-item.svg`,
    guard: `modules/${MODULE_ID}/icons/guard.svg`,
    maneuver: `modules/${MODULE_ID}/icons/maneuver.svg`,
    end_turn: `modules/${MODULE_ID}/icons/wait.svg`,
    wait: `modules/${MODULE_ID}/icons/wait.svg`,
    custom_action: `modules/${MODULE_ID}/icons/custom-action.svg`,
    persuade: `modules/${MODULE_ID}/icons/persuade.svg`,
    assault: `modules/${MODULE_ID}/icons/assault.svg`,
    rally: `modules/${MODULE_ID}/icons/rally.svg`,
    reinforce: `modules/${MODULE_ID}/icons/reinforce.svg`,
    staredown: `modules/${MODULE_ID}/icons/challenge.svg`,
    concede: `modules/${MODULE_ID}/icons/concede.svg`,
    techniques: `modules/${MODULE_ID}/icons/palettes/techniques.svg`,
    equipment: `modules/${MODULE_ID}/icons/palettes/equipment.svg`,
});

export const TECHNIQUE_TYPES = Object.freeze([
    "kata",
    "kiho",
    "inversion",
    "invocation",
    "ritual",
    "shuji",
    "maho",
    "ninjutsu",
    "mantra",
    "school_ability",
    "mastery_ability",
    "title_ability",
    "specificity",
]);

export const IMPORTANT_STATUSES = Object.freeze([
    "compromised",
    "incapacitated",
    "dying",
    "unconscious",
]);

export function localize(key, data) {
    if (data) return game.i18n.format(key, data);
    return game.i18n.localize(key);
}

export function moduleKey(suffix) {
    return `${MODULE_ID}.${suffix}`;
}
