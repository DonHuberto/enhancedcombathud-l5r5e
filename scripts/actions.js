import { ACTION_ICONS, MODULE_ID } from "./config.js";
import { getWeapons } from "./data.js";
import { getPersuadeOptions, openDicePicker, openGenericRoll, openPersuadeRoll, openWeaponStrike } from "./rolls.js";
import {
    consumeAction,
    consumeMovement,
    getActionSlot,
    getCombatant,
    getProfile,
    getTurnState,
    setGuard,
    setWait,
    updateTurnState,
} from "./state.js";
import {
    confirmAction,
    createChatCard,
    getTargetToken,
    notify,
    promptText,
    withActionLock,
} from "./utils.js";
import { chooseWeapon, toggleReadied } from "./weapons.js";
import { requestGm } from "./socket.js";
import { getUniversalActions } from "./profiles/universal.js";
import { clearPersuadePending, getIntrigueActions, markPersuadePending } from "./profiles/intrigue.js";
import { executeDuelAction, getDuelActions, isFinishingBlowAvailable } from "./profiles/duel.js";
import { getSkirmishActions } from "./profiles/skirmish.js";
import { executeMassBattleAction, getMassBattleActions } from "./profiles/mass-battle.js";

const PROFILE_ACTIONS = {
    universal: getUniversalActions,
    intrigue: getIntrigueActions,
    duel: getDuelActions,
    skirmish: getSkirmishActions,
    mass_battle: getMassBattleActions,
};

const NO_CHECK_ACTIONS = new Set(["calming_breath", "prepare_item", "predict", "wait"]);
const ACTION_EXEMPT_ACTIONS = new Set(["concede", "staredown"]);

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
    if (!getActionSlot(actor, { requiresCheck: false })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }

    return withActionLock(`calming-breath:${actor.uuid}`, async () => {
        const update = {};
        if (removeFatigue) update["system.fatigue.value"] = Math.max(0, fatigue - 1);
        if (removeStrife) update["system.strife.value"] = Math.max(0, strife - 1);
        await actor.update(update);
        await consumeAction(actor, { requiresCheck: false });
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
    if (!getActionSlot(actor, { requiresCheck: false })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const result = await toggleReadied(weapon);
    if (result) {
        await consumeAction(actor, { requiresCheck: false });
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
    const weapon = await chooseWeapon(actor, { readiedOnly: true, titleKey: "strike" });
    if (!weapon) return false;
    const finishing = isFinishingBlowAvailable(actor);
    if (!finishing && !getActionSlot(actor, { requiresCheck: true })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const dialog = openWeaponStrike(actor, weapon);
    if (!dialog) return false;
    if (!finishing) await consumeAction(actor, { requiresCheck: true });
    else Hooks.callAll(`${MODULE_ID}.finishingBlowUsed`, actor);
    return true;
}

async function openActionRoll(actor, options) {
    if (!getActionSlot(actor, { requiresCheck: true })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const dialog = openDicePicker(actor, options);
    if (!dialog) return false;
    await consumeAction(actor, { requiresCheck: true });
    return true;
}

async function waitAction(actor) {
    if (!getActionSlot(actor, { requiresCheck: false })) {
        notify(`${MODULE_ID}.notifications.no_action`, "warn");
        return false;
    }
    const condition = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.actions.wait.label`),
        label: game.i18n.localize(`${MODULE_ID}.actions.wait.condition`),
    });
    if (!condition) return false;
    await setWait(actor, condition);
    await consumeAction(actor, { requiresCheck: false });
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
        target: getTargetToken(),
    });
    if (success) await setGuard(actor, true);
    return success;
}

async function maneuver(actor) {
    const success = await openActionRoll(actor, {
        skillId: "fitness",
        difficulty: 2,
        actions: { move: true },
        target: getTargetToken(),
    });
    if (success) await updateTurnState(actor, { maneuver: true });
    return success;
}

async function assist(actor) {
    return openActionRoll(actor, {
        skillsList: "artisan,martial,scholar,social,trade",
        actions: { support: true },
        target: getTargetToken(),
    });
}

async function challenge(actor) {
    return openActionRoll(actor, {
        skillsList: "command,courtesy,performance",
        actions: { scheme: true },
        target: getTargetToken(),
    });
}

async function persuade(actor) {
    if (!getActionSlot(actor, { requiresCheck: true })) {
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
        await consumeAction(actor, { requiresCheck: true });
        return true;
    }
    const dialog = openPersuadeRoll(actor);
    if (!dialog) {
        await clearPersuadePending(actor);
        return false;
    }
    await consumeAction(actor, { requiresCheck: true });
    return true;
}

async function customAction(actor) {
    return openActionRoll(actor, {
        skillsList: "artisan,martial,scholar,social,trade",
        target: getTargetToken(),
    });
}

export async function executeAction(actor, actionId) {
    if (actor?.type !== "character" || !actor.isOwner) return false;
    if (["center", "predict", "concede", "staredown"].includes(actionId)) return executeDuelAction(actor, actionId);
    if (getProfile(actor) === "mass_battle" && ["assault", "challenge", "rally", "reinforce"].includes(actionId)) {
        return executeMassBattleAction(actor, actionId);
    }

    const handlers = {
        generic_roll: () => openGenericRoll(actor),
        calming_breath: () => calmingBreath(actor),
        prepare_item: () => prepareItem(actor),
        strike: () => strike(actor),
        assist: () => assist(actor),
        guard: () => guard(actor),
        maneuver: () => maneuver(actor),
        wait: () => waitAction(actor),
        challenge: () => challenge(actor),
        persuade: () => persuade(actor),
        custom_action: () => customAction(actor),
        free_movement: async () => {
            const consumed = await consumeMovement(actor);
            if (!consumed) notify(`${MODULE_ID}.notifications.movement_used`, "warn");
            return consumed;
        },
    };
    return handlers[actionId]?.() ?? false;
}

function actionAvailability(actor, actionId) {
    if (actionId === "generic_roll") return { enabled: true };
    if (!game.combat?.started) return { enabled: false, reason: `${MODULE_ID}.notifications.conflict_only` };
    if (actionId === "free_movement") {
        return getTurnState(actor).movementUsed
            ? { enabled: false, reason: `${MODULE_ID}.notifications.movement_used` }
            : { enabled: true };
    }
    if (actionId === "staredown") {
        const bid = getCombatant(actor)?.getFlag(MODULE_ID, "duelBid");
        if (bid?.round === game.combat.round) {
            return { enabled: false, reason: `${MODULE_ID}.notifications.bid_already_committed` };
        }
    }
    if (actionId === "strike" && !getWeapons(actor, { readiedOnly: true }).length) {
        return { enabled: false, reason: `${MODULE_ID}.notifications.no_readied_weapon` };
    }
    const finishingBlow = actionId === "strike" && isFinishingBlowAvailable(actor);
    if (!finishingBlow && !ACTION_EXEMPT_ACTIONS.has(actionId)) {
        const requiresCheck = !NO_CHECK_ACTIONS.has(actionId);
        if (!getActionSlot(actor, { requiresCheck })) {
            return { enabled: false, reason: `${MODULE_ID}.notifications.no_action` };
        }
    }
    return { enabled: true };
}

export function createActionPanels(ARGON, { L5R5eEquipmentPanelButton }, { L5R5eTechniquesPanelButton }) {
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
            return {
                title: game.i18n.localize(this.label),
                description: game.i18n.localize(`${MODULE_ID}.actions.${this.actionId}.tooltip`),
                details: [
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

        async _renderInner() {
            await super._renderInner();
            this.element.classList.toggle("l5r5e-disabled", !this.availability.enabled);
            if (this.actionId === "strike") this.element.classList.toggle("l5r5e-finishing-blow", isFinishingBlowAvailable(this.actor));
        }
    }

    function makePanelClass(profile) {
        return class L5R5eProfileActionPanel extends ARGON.MAIN.ActionPanel {
            get label() {
                return `${MODULE_ID}.profiles.${profile}`;
            }

            get maxActions() {
                return profile === "universal" ? null : 1;
            }

            get currentActions() {
                return profile === "universal" ? null : Number(!getTurnState(this.actor).actionUsed);
            }

            async _getButtons() {
                if (getProfile(this.actor) !== profile) return [];
                const actionIds = PROFILE_ACTIONS[profile]?.() ?? [];
                const buttons = actionIds.map((actionId) => new L5R5eActionButton(actionId));
                buttons.push(new L5R5eEquipmentPanelButton(), new L5R5eTechniquesPanelButton());
                return buttons;
            }
        };
    }

    return {
        L5R5eActionButton,
        panels: ["universal", "intrigue", "duel", "skirmish", "mass_battle"].map(makePanelClass),
    };
}
