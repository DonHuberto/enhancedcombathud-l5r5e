import { ACTION_ICONS, ACTIONS_BY_PROFILE, HUD_ICONS, MODULE_ID } from "./config.js";
import {
    classifyActionIds,
    profileUiState,
    resolveProfileActionIds,
    turnEconomyView,
    waterExtraActionRestriction,
} from "./action-layout.js";
import { getWeapons } from "./data.js";
import { installHudButtonIcon } from "./hud-buttons.js";
import { buildNinjoGiri } from "./identity.js";
import { getPersuadeOptions, openDicePicker, openGenericRoll, openPersuadeRoll, openWeaponStrike } from "./rolls.js";
import {
    canUseActor,
    executeImmediateAction,
    getActionDefinition,
    getActionSlot,
    getCombatant,
    getProfile,
    getTurnState,
} from "./state.js";
import {
    confirmAction,
    createChatCard,
    getTargetToken,
    notify,
    promptText,
    promptSelect,
    withActionLock,
} from "./utils.js";
import { chooseWeapon, executeEquipmentIntent } from "./weapons.js";
import { requestGm } from "./socket.js";
import { clearPersuadePending, markPersuadePending } from "./profiles/intrigue.js";
import { executeDuelAction, isFinishingBlowAvailable } from "./profiles/duel.js";
import { executeMassBattleAction } from "./profiles/mass-battle.js";

const ACTION_EXEMPT_ACTIONS = new Set(["concede", "staredown"]);

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
}

const ACTION_ROUTES = Object.freeze({
    generic_roll: "direct",
    persuade: "direct",
    assist: "direct",
    calming_breath: "direct",
    custom_action: "direct",
    center: "duel",
    predict: "duel",
    prepare_item: "direct",
    strike: "direct",
    throw_item: "direct",
    staredown: "duel",
    concede: "duel",
    challenge: "profile",
    guard: "direct",
    maneuver: "direct",
    wait: "direct",
    assault: "mass_battle",
    rally: "mass_battle",
    reinforce: "mass_battle",
    end_turn: "direct",
});

export function getActionRoute(profile, actionId) {
    const route = ACTION_ROUTES[actionId];
    if (route === "profile") return profile === "mass_battle" ? "mass_battle" : "direct";
    return route ?? null;
}

export async function performUnmask(actor) {
    if (!actor?.isOwner || !actor.statuses?.has("compromised")) return false;
    const confirmed = await confirmAction({
        title: game.i18n.localize(`${MODULE_ID}.unmask.label`),
        content: `<p>${game.i18n.localize(`${MODULE_ID}.unmask.confirm`)}</p>`,
    });
    if (!confirmed) return false;
    const description = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.unmask.label`),
        label: game.i18n.localize(`${MODULE_ID}.unmask.description`),
        hint: game.i18n.localize(`${MODULE_ID}.unmask.description_hint`),
    });
    if (description === null) return false;

    return withActionLock(`unmask:${actor.uuid}`, async () => {
        const removed = Number(actor.system?.strife?.value ?? 0);
        await actor.update({ "system.strife.value": 0 });
        await createChatCard({
            actor,
            title: game.i18n.localize(`${MODULE_ID}.unmask.label`),
            body: description || game.i18n.localize(`${MODULE_ID}.unmask.default_message`),
            details: [{ label: game.i18n.localize(`${MODULE_ID}.unmask.strife_removed`), value: removed }],
        });
        Hooks.callAll(`${MODULE_ID}.unmask`, actor);
        return true;
    });
}

async function calmingBreath(actor) {
    if (!game.combat?.started) {
        notify(`${MODULE_ID}.notifications.conflict_only`, "warn");
        return false;
    }
    const fatigue = Number(actor.system?.fatigue?.value ?? 0);
    const endurance = Number(actor.system?.endurance ?? 0);
    const strife = Number(actor.system?.strife?.value ?? 0);
    const composure = Number(actor.system?.composure ?? 0);
    const removeFatigue = fatigue > endurance / 2;
    const removeStrife = strife > composure / 2;
    if (!removeFatigue && !removeStrife) {
        notify(`${MODULE_ID}.notifications.calming_breath_no_effect`, "info");
        return false;
    }
    if (!getActionSlot(actor, { actionId: "calming_breath" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }

    return withActionLock(`calming-breath:${actor.uuid}`, async () => {
        const mutations = [];
        if (removeFatigue) mutations.push({ documentUuid: actor.uuid, path: "system.fatigue.value", before: fatigue, after: Math.max(0, fatigue - 1), reason: "calmingBreath" });
        if (removeStrife) mutations.push({ documentUuid: actor.uuid, path: "system.strife.value", before: strife, after: Math.max(0, strife - 1), reason: "calmingBreath" });
        const applied = await executeImmediateAction(actor, "calming_breath", { mutations });
        if (!applied.ok) return false;
        await createChatCard({
            actor,
            title: game.i18n.localize(`${MODULE_ID}.actions.calming_breath.label`),
            details: [
                ...(removeFatigue ? [{ label: game.i18n.localize(`${MODULE_ID}.resources.fatigue`), value: "−1" }] : []),
                ...(removeStrife ? [{ label: game.i18n.localize(`${MODULE_ID}.resources.strife`), value: "−1" }] : []),
            ],
        });
        return true;
    });
}

export async function prepareItem(actor, selectedWeapon = null) {
    const weapon = selectedWeapon ?? (await chooseWeapon(actor, { titleKey: "prepare_item" }));
    if (!weapon) return false;
    if (!getActionSlot(actor, { actionId: "prepare_item" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const before = Boolean(weapon.system?.readied);
    const equipment = game.l5r5e?.equipment;
    const result = equipment?.prepare
        ? Boolean(await executeEquipmentIntent(equipment.prepare(actor, weapon, { ready: !before })))
        : false;
    if (result) {
        await createChatCard({
            actor,
            title: game.i18n.localize(`${MODULE_ID}.actions.prepare_item.label`),
            body: game.i18n.format(
                weapon.system?.readied ? `${MODULE_ID}.chat.weapon_readied` : `${MODULE_ID}.chat.weapon_stowed`,
                { name: weapon.name },
            ),
        });
    }
    return result;
}

async function strike(actor) {
    const target = getTargetToken();
    if (!target) {
        notify(`${MODULE_ID}.notifications.no_target`, "warn");
        return false;
    }
    const profiles = (game.l5r5e?.equipment?.getAttackProfiles(actor) ?? []).filter((profile) => profile.available !== false);
    if (!profiles.length) return false;
    let profile = profiles[0];
    if (profiles.length > 1) {
        const selected = await promptSelect({
            title: game.i18n.localize(`${MODULE_ID}.actions.strike.label`),
            label: game.i18n.localize(`${MODULE_ID}.equipment.choose_attack_profile`),
            choices: profiles.map((entry) => {
                const item = entry.itemUuid ? [...actor.items].find((candidate) => candidate.uuid === entry.itemUuid) : null;
                return {
                    value: entry.itemUuid ?? entry.id,
                    label: item?.name ?? game.i18n.localize(entry.labelKey ?? `${MODULE_ID}.equipment.unarmed`),
                };
            }),
        });
        if (!selected) return false;
        profile = profiles.find((entry) => (entry.itemUuid ?? entry.id) === selected);
    }
    const weapon = profile.itemUuid
        ? [...actor.items].find((item) => item.uuid === profile.itemUuid)
        : profile;
    if (!weapon) return false;
    const finishing = isFinishingBlowAvailable(actor);
    if (!finishing && !getActionSlot(actor, { actionId: "strike" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const dialog = openWeaponStrike(actor, weapon, { target });
    if (!dialog) return false;
    if (finishing) Hooks.callAll(`${MODULE_ID}.finishingBlowUsed`, actor);
    return true;
}

function improvisedThrowEnabled() {
    try {
        return Boolean(game.settings.get("l5r5e", "enableImprovisedThrowAction"));
    } catch (_error) {
        return false;
    }
}

function isThrowItemVisible(actor) {
    return improvisedThrowEnabled() && (game.l5r5e?.equipment?.heldItems(actor) ?? []).length > 0;
}

export async function throwItem(actor, selectedItem = null) {
    const equipment = game.l5r5e?.equipment;
    if (!equipment?.throw || !equipment?.confirm || !equipment?.reserve) {
        notify(`${MODULE_ID}.notifications.throw_api_unavailable`, "error");
        return false;
    }
    const target = getTargetToken();
    if (!target) {
        notify(`${MODULE_ID}.notifications.no_target`, "warn");
        return false;
    }
    if (!improvisedThrowEnabled()) return false;
    const throwable = equipment.heldItems(actor);
    if (!throwable.length) {
        notify(`${MODULE_ID}.notifications.no_throwable_item`, "warn");
        return false;
    }
    const itemId = selectedItem?.id ?? (throwable.length === 1
        ? throwable[0].id
        : await promptSelect({
            title: game.i18n.localize(`${MODULE_ID}.actions.throw_item.label`),
            label: game.i18n.localize(`${MODULE_ID}.equipment.choose_throw_item`),
            choices: throwable.map((item) => ({ value: item.id, label: item.name })),
        }));
    const item = actor.items.get(itemId);
    if (!item) return false;

    const assessed = equipment.throw(actor, item, { mode: "improvised", trackIndividual: true });
    if (!assessed.ok) {
        notify(`${MODULE_ID}.notifications.throw_blocked`, "warn", { reason: assessed.assessment?.code ?? "blocked" });
        return false;
    }
    const reserved = await equipment.reserve(equipment.confirm(assessed));
    if (!reserved.ok) {
        notify(`${MODULE_ID}.notifications.throw_blocked`, "warn", { reason: reserved.code ?? "blocked" });
        return false;
    }
    const roll = reserved.assessment.roll;
    const dialog = openDicePicker(actor, {
        item,
        skillId: roll.skillId,
        difficulty: roll.difficulty,
        target,
        actions: { attack: true },
        actionId: roll.actionId,
        rollContext: {
            ...foundry.utils.deepClone(roll.rollContext),
            targetUuid: target.actor?.uuid ?? target.uuid,
        },
    });
    if (!dialog) {
        await equipment.cancel(reserved);
        return false;
    }
    return true;
}

async function openActionRoll(actor, options) {
    if (!getActionSlot(actor, { actionId: options.actionId, actionTypes: Object.entries(options.actions ?? {}).filter(([, active]) => active).map(([type]) => type) })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const dialog = openDicePicker(actor, options);
    if (!dialog) return false;
    return true;
}

async function waitAction(actor) {
    if (!getActionSlot(actor, { actionId: "wait" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const condition = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.actions.wait.label`),
        label: game.i18n.localize(`${MODULE_ID}.actions.wait.condition`),
    });
    if (!condition) return false;
    const applied = await executeImmediateAction(actor, "wait", { turnStateChanges: { wait: condition } });
    if (!applied.ok) return false;
    return createChatCard({
        actor,
        title: game.i18n.localize(`${MODULE_ID}.actions.wait.label`),
        body: condition,
    });
}

async function guard(actor) {
    const success = await openActionRoll(actor, {
        skillId: "tactics",
        difficulty: 1,
        actions: { support: true },
        actionId: "guard",
        rollContext: { actionId: "guard" },
        target: getTargetToken(),
    });
    return success;
}

async function maneuver(actor) {
    const success = await openActionRoll(actor, {
        skillId: "fitness",
        difficulty: 2,
        actions: { move: true },
        actionId: "maneuver",
        rollContext: { actionId: "maneuver" },
        target: getTargetToken(),
    });
    return success;
}

async function assist(actor) {
    return openActionRoll(actor, {
        skillsList: "artisan,martial,scholar,social,trade",
        actions: { support: true },
        actionId: "assist",
        rollContext: { actionId: "assist" },
        target: getTargetToken(),
    });
}

async function challenge(actor) {
    return openActionRoll(actor, {
        skillsList: "command,courtesy,performance",
        actions: { scheme: true },
        actionId: "challenge",
        rollContext: { actionId: "challenge" },
        target: getTargetToken(),
    });
}

async function persuade(actor) {
    if (!getActionSlot(actor, { actionId: "persuade" })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    await markPersuadePending(actor);
    const options = getPersuadeOptions(actor);
    if (options.remoteRequired) {
        const requested = requestGm("hiddenPersuade", actor, {
            targetTokenIds: options.targetTokenIds,
            sceneId: options.sceneId,
        });
        if (!requested) {
            await clearPersuadePending(actor);
            notify(`${MODULE_ID}.notifications.no_active_gm`, "warn");
            return false;
        }
        return true;
    }
    const dialog = openPersuadeRoll(actor);
    if (!dialog) {
        await clearPersuadePending(actor);
        return false;
    }
    return true;
}

async function customAction(actor) {
    return openActionRoll(actor, {
        skillsList: "artisan,martial,scholar,social,trade",
        actionId: "custom_action",
        rollContext: { actionId: "custom_action" },
        target: getTargetToken(),
    });
}

export async function executeAction(actor, actionId) {
    if (!canUseActor(actor)) return false;
    const route = getActionRoute(getProfile(actor), actionId);
    if (route === "duel") return executeDuelAction(actor, actionId);
    if (route === "mass_battle") return executeMassBattleAction(actor, actionId);

    const handlers = {
        generic_roll: () => openGenericRoll(actor),
        calming_breath: () => calmingBreath(actor),
        prepare_item: () => prepareItem(actor),
        strike: () => strike(actor),
        throw_item: () => throwItem(actor),
        assist: () => assist(actor),
        guard: () => guard(actor),
        maneuver: () => maneuver(actor),
        wait: () => waitAction(actor),
        challenge: () => challenge(actor),
        persuade: () => persuade(actor),
        custom_action: () => customAction(actor),
        end_turn: async () => {
            const combatant = getCombatant(actor);
            if (combatant !== game.combat?.combatant) return false;
            await game.combat.nextTurn();
            return true;
        },
    };
    return route === "direct" ? handlers[actionId]?.() ?? false : false;
}

export function actionAvailability(actor, actionId) {
    if (actionId === "generic_roll") return { enabled: true };
    if (!game.combat?.started) return { enabled: false, reason: `${MODULE_ID}.notifications.conflict_only` };
    if (actionId === "end_turn") return getCombatant(actor) === game.combat?.combatant
        ? { enabled: true }
        : { enabled: false, reason: `${MODULE_ID}.notifications.not_active_turn` };
    if (actionId === "staredown") {
        const bid = getCombatant(actor)?.getFlag(MODULE_ID, "duelBid");
        if (bid?.round === game.combat.round) {
            return { enabled: false, reason: `${MODULE_ID}.notifications.bid_already_committed` };
        }
    }
    if (actionId === "strike" && !(game.l5r5e?.equipment?.getAttackProfiles(actor) ?? []).some((profile) => profile.available !== false)) {
        return { enabled: false, reason: `${MODULE_ID}.notifications.no_readied_weapon` };
    }
    if (actionId === "strike" && !getTargetToken()) {
        return { enabled: false, reason: `${MODULE_ID}.notifications.no_target` };
    }
    if (actionId === "throw_item" && !isThrowItemVisible(actor)) {
        return { enabled: false, reason: `${MODULE_ID}.notifications.no_throwable_item` };
    }
    const finishingBlow = actionId === "strike" && isFinishingBlowAvailable(actor);
    if (!finishingBlow && !ACTION_EXEMPT_ACTIONS.has(actionId)) {
        const definition = getActionDefinition(actionId);
        if (!getActionSlot(actor, {
            actionId,
            actionTypes: definition?.actionTypes,
            requiresCheck: definition?.requiresCheck,
        })) {
            const state = getTurnState(actor);
            const waterRestriction = waterExtraActionRestriction(state, definition);
            if (waterRestriction === "requiresCheck") {
                return { enabled: false, reason: `${MODULE_ID}.notifications.water_requires_no_check` };
            }
            if (waterRestriction === "actionTypeConflict") {
                return { enabled: false, reason: `${MODULE_ID}.notifications.water_action_type_conflict` };
            }
            return { enabled: false, reason: `${MODULE_ID}.notifications.no_action` };
        }
    }
    return { enabled: true };
}

export function createActionPanels(ARGON, { L5R5eEquipmentPanelButton }, { L5R5eTechniquesPanelButton }, { L5R5eSkillsPanelButton }) {
    class L5R5eActionButton extends ARGON.MAIN.BUTTONS.ActionButton {
        constructor(actionId) {
            super();
            this.actionId = actionId;
        }

        get label() {
            return `${MODULE_ID}.actions.${this.actionId}.label`;
        }

        get icon() {
            return ACTION_ICONS[this.actionId] ?? ACTION_ICONS.generic_roll;
        }

        get hasTooltip() {
            return true;
        }

        get availability() {
            return actionAvailability(this.actor, this.actionId);
        }

        async getTooltipData() {
            const available = this.availability;
            const definition = getActionDefinition(this.actionId);
            const types = (definition?.actionTypes ?? [])
                .map((type) => game.i18n.localize(`${MODULE_ID}.action_types.${type}`))
                .join(", ") || "—";
            return {
                title: game.i18n.localize(this.label),
                description: game.i18n.localize(`${MODULE_ID}.actions.${this.actionId}.tooltip`),
                details: [
                    { label: `${MODULE_ID}.actions.types`, value: types },
                    {
                        label: `${MODULE_ID}.actions.check_requirement`,
                        value: game.i18n.localize(`${MODULE_ID}.actions.${definition?.requiresCheck === false ? "no_check" : "requires_check"}`),
                    },
                    {
                        label: `${MODULE_ID}.actions.availability`,
                        value: game.i18n.localize(available.enabled ? `${MODULE_ID}.actions.available` : available.reason),
                    },
                ],
            };
        }

        async _onLeftClick() {
            if (!this.availability.enabled) {
                notify(this.availability.reason, "warn");
                return;
            }
            return withActionLock(`action-button:${this.actor.uuid}:${this.actionId}`, () =>
                executeAction(this.actor, this.actionId),
            );
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            element.onkeydown = (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                this._onLeftClick(event);
            };
            element.onfocus = () => element.dispatchEvent(new MouseEvent("mouseenter"));
            element.onblur = () => element.dispatchEvent(new MouseEvent("mouseleave"));
        }

        async _renderInner() {
            await super._renderInner();
            this.element.classList.add(`l5r5e-action-${this.actionId}`);
            installHudButtonIcon(this.element, this.icon, "l5r5e-action-icon");
            this.element.setAttribute("aria-label", game.i18n.localize(this.label));
            this.element.setAttribute("tabindex", "0");
            this.element.classList.toggle("l5r5e-disabled", !this.availability.enabled);
            const definition = getActionDefinition(this.actionId);
            this.element.classList.add(definition?.requiresCheck === false ? "l5r5e-no-check-action" : "l5r5e-check-action");
            if (this.actionId === "strike") this.element.classList.toggle("l5r5e-finishing-blow", isFinishingBlowAvailable(this.actor));
        }
    }

    function makePanelClass(profile) {
        return class L5R5eProfileActionPanel extends ARGON.MAIN.ActionPanel {
            get label() {
                return `${MODULE_ID}.profiles.${profile}`;
            }

            get maxActions() {
                return null;
            }

            get currentActions() {
                return null;
            }

            async _getButtons() {
                if (getProfile(this.actor) !== profile) return [];
                const uiState = profileUiState(profile, { activeTurn: getCombatant(this.actor) === game.combat?.combatant });
                const actionIds = resolveProfileActionIds(
                    game.l5r5e?.actionRegistry,
                    profile,
                    ACTIONS_BY_PROFILE[profile] ?? [],
                ).filter(
                    (actionId) => actionId !== "throw_item" || isThrowItemVisible(this.actor),
                );
                const buttons = actionIds.map((actionId) => new L5R5eActionButton(actionId));
                buttons.push(new L5R5eSkillsPanelButton(), new L5R5eTechniquesPanelButton(), new L5R5eEquipmentPanelButton());
                if (uiState.showEndTurn) {
                    buttons.push(new L5R5eActionButton("end_turn"));
                }
                return buttons;
            }

            async _renderInner() {
                await super._renderInner();
                this.element.classList.add("l5r5e-action-layout", `l5r5e-profile-${profile}`);
                const uiState = profileUiState(profile);
                const actionIds = this._buttons.map((button) => button.actionId).filter((id) => id && id !== "end_turn");
                const groups = classifyActionIds(game.l5r5e?.actionRegistry, actionIds);
                const byActionId = new Map(this._buttons.filter((button) => button.actionId).map((button) => [button.actionId, button]));
                const paletteButtons = this._buttons.filter((button) => button.id?.startsWith?.("l5r5e-"));
                const endTurn = byActionId.get("end_turn");

                const identity = await buildNinjoGiri(this.actor);
                const palette = element("section", "l5r5e-palette-rail");
                palette.setAttribute("aria-label", game.i18n.localize(`${MODULE_ID}.palettes.title`));
                for (const button of paletteButtons) palette.appendChild(button.element);

                const makeGroup = (ids, kind, labelKey) => {
                    const section = element("section", `l5r5e-action-group l5r5e-action-group-${kind}`);
                    section.appendChild(element("h3", "l5r5e-action-group-title", game.i18n.localize(labelKey)));
                    const body = element("div", "l5r5e-action-group-buttons");
                    for (const actionId of ids) {
                        const button = byActionId.get(actionId);
                        if (button) body.appendChild(button.element);
                    }
                    section.appendChild(body);
                    return section;
                };

                const checkEconomy = element("section", `l5r5e-turn-economy l5r5e-turn-economy-check ${uiState.showEconomy ? "" : "hidden"}`);
                const noCheckEconomy = element("section", `l5r5e-turn-economy l5r5e-turn-economy-no-check ${uiState.showEconomy ? "" : "hidden"}`);
                if (uiState.showEconomy) {
                    const view = turnEconomyView(getTurnState(this.actor));
                    for (const [id, state] of Object.entries(view)) {
                        if (id === "water" && this.actor.system?.stance !== "water") continue;
                        const status = state.used ? "used" : state.available ? "available" : "unavailable";
                        const value = id === "movement"
                            ? game.i18n.format(`${MODULE_ID}.turn.movement_value`, { value: state.remainingBands })
                            : String(state.available && !state.used ? 1 : 0);
                        const pill = element("div", `l5r5e-economy-pill l5r5e-economy-${id} ${status}`);
                        const icon = element("img", "l5r5e-economy-icon");
                        icon.src = HUD_ICONS.economy[id];
                        icon.alt = "";
                        pill.append(
                            icon,
                            element("span", "l5r5e-economy-label", game.i18n.localize(`${MODULE_ID}.turn.${id}`)),
                            element("strong", "l5r5e-economy-value", value),
                        );
                        (id === "movement" ? noCheckEconomy : checkEconomy).appendChild(pill);
                    }
                }

                this.element.replaceChildren();
                this.element.append(identity, palette, checkEconomy, noCheckEconomy);
                if (groups.requiresCheck.length) {
                    this.element.appendChild(makeGroup(
                        groups.requiresCheck,
                        "check",
                        `${MODULE_ID}.action_groups.${profile === "universal" ? "quick" : "roll_required"}`,
                    ));
                }
                if (groups.noCheck.length) {
                    this.element.appendChild(makeGroup(groups.noCheck, "no-check", `${MODULE_ID}.action_groups.no_roll`));
                }
                if (endTurn) {
                    const endSection = element("section", "l5r5e-end-turn-slot");
                    endSection.appendChild(endTurn.element);
                    this.element.appendChild(endSection);
                }
                requestAnimationFrame(() => {
                    const hud = this.element.closest(".extended-combat-hud");
                    if (!hud) return;
                    const style = getComputedStyle(hud);
                    const number = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
                    const upperWidth = number("--l5r5e-large-tile")
                        + number("--l5r5e-stat-width")
                        + number("--l5r5e-gear-width")
                        + 8;
                    const fitWidth = Math.ceil(Math.max(upperWidth, this.element.scrollWidth));
                    hud.style.setProperty("--l5r5e-fit-width", `${fitWidth}px`);
                    hud.classList.add("l5r5e-fit-content");
                });
            }
        };
    }

    return {
        L5R5eActionButton,
        panels: ["universal", "intrigue", "duel", "skirmish", "mass_battle"].map(makePanelClass),
    };
}
