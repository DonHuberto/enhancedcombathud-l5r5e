const HIDDEN_ACTIONS = new Set(["wait"]);

export function resolveProfileActionIds(registry = {}, profile, fallback = []) {
    const registered = Object.values(registry ?? {})
        .filter((definition) => definition?.profiles?.includes(profile))
        .map((definition) => definition.actionId)
        .filter(Boolean);
    const source = registered.length ? registered : fallback;
    return [...new Set(source)].filter((actionId) => !HIDDEN_ACTIONS.has(actionId) && actionId !== "end_turn");
}

export function classifyActionIds(registry = {}, actionIds = []) {
    return actionIds.reduce(
        (groups, actionId) => {
            const definition = registry?.[actionId];
            const key = definition?.requiresCheck === false ? "noCheck" : "requiresCheck";
            groups[key].push(actionId);
            return groups;
        },
        { requiresCheck: [], noCheck: [] },
    );
}

export function turnEconomyView(state = {}) {
    const movementBudget = Number(state.freeMovement?.budget ?? 0);
    const movementSpent = Number(state.freeMovement?.spent ?? 0);
    return {
        primary: { available: !state.primaryAction?.used, used: Boolean(state.primaryAction?.used) },
        water: {
            available: Boolean(state.waterExtraAction?.available) && !state.waterExtraAction?.used,
            used: Boolean(state.waterExtraAction?.used),
        },
        movement: {
            available: !state.freeMovement?.used,
            used: Boolean(state.freeMovement?.used),
            remainingFields: Math.max(0, movementBudget - movementSpent),
            remainingBands: Math.ceil(Math.max(0, movementBudget - movementSpent) / 3),
        },
    };
}

export function profileUiState(profile, { activeTurn = false } = {}) {
    const inConflict = profile !== "universal";
    return {
        inConflict,
        showEconomy: inConflict,
        showEndTurn: inConflict && activeTurn,
        palettes: ["skills", "techniques", "equipment"],
    };
}

export function waterExtraActionRestriction(state = {}, definition = {}) {
    if (!state.primaryAction?.used || !state.waterExtraAction?.available || state.waterExtraAction?.used) return null;
    if (definition.requiresCheck !== false) return "requiresCheck";
    const usedTypes = new Set(state.actionTypesUsed ?? []);
    return (definition.actionTypes ?? []).some((type) => usedTypes.has(type)) ? "actionTypeConflict" : null;
}
