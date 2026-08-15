import { ACTION_ICONS, MODULE_ID } from "./config.js";
import { prepareItem, throwItem } from "./actions.js";
import { getEquippedArmor, getItemProperties, getWeapons, isReadiedWeapon } from "./data.js";
import { bindHudPointerActivation, installDelayedHudTooltip, installHudButtonIcon } from "./hud-buttons.js";
import { openWeaponStrike } from "./rolls.js";
import { getProfile } from "./state.js";
import { dropItem, getCurrentGrip, setGrip, toggleEquipped, toggleReadied } from "./weapons.js";
import { enrichText, escapeHtml, getSourceLabel, notify, promptSelect, withActionLock } from "./utils.js";

function itemSubtitle(item) {
    if (item.type === "weapon") {
        return `${game.i18n.localize("l5r5e.weapons.damage")} ${escapeHtml(item.system.damage)} · ${game.i18n.localize("l5r5e.weapons.deadliness")} ${escapeHtml(item.system.deadliness)} · ${game.i18n.localize("l5r5e.weapons.range")} ${escapeHtml(item.system.range)}`;
    }
    if (item.type === "armor") {
        return `${game.i18n.localize("l5r5e.armors.physical")} ${item.system.armor?.physical ?? 0} · ${game.i18n.localize("l5r5e.armors.supernatural")} ${item.system.armor?.supernatural ?? 0}`;
    }
    return game.i18n.localize(`TYPES.Item.${item.type}`);
}

export async function getEquipmentTooltip(item) {
    const properties = getItemProperties(item).map((label) => ({ label: escapeHtml(label), secondary: true }));
    const details = [];
    if (item.type === "weapon") {
        details.push(
            { label: "l5r5e.weapons.damage", value: item.system.damage ?? 0 },
            { label: "l5r5e.weapons.deadliness", value: item.system.deadliness ?? 0 },
            { label: "l5r5e.weapons.range", value: escapeHtml(item.system.range ?? 0) },
            { label: "l5r5e.skills.label", value: escapeHtml(item.system.skill ?? "—") },
            {
                label: `${MODULE_ID}.equipment.current_grip`,
                value: escapeHtml(getCurrentGrip(item)),
            },
        );
    } else if (item.type === "armor") {
        details.push(
            { label: "l5r5e.armors.physical", value: item.system.armor?.physical ?? 0 },
            { label: "l5r5e.armors.supernatural", value: item.system.armor?.supernatural ?? 0 },
        );
    }
    details.push(
        { label: `${MODULE_ID}.equipment.equipped`, value: item.system.equipped ? "✓" : "—" },
    );
    if (item.type === "weapon") details.push({ label: `${MODULE_ID}.equipment.readied`, value: item.system.readied ? "✓" : "—" });

    return {
        title: escapeHtml(item.name),
        subtitle: itemSubtitle(item),
        description: await enrichText(item.system?.description, { relativeTo: item }),
        details,
        propertiesLabel: `${MODULE_ID}.equipment.properties`,
        properties,
        footerText: [getSourceLabel(item)].filter(Boolean),
    };
}

export function createEquipmentClasses(ARGON, { L5R5eSearchableButtonPanel }) {
    class L5R5eEquipmentItemButton extends ARGON.MAIN.BUTTONS.ItemButton {
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            return getEquipmentTooltip(this.item);
        }

        async activateTooltipListeners() {
            installDelayedHudTooltip(this);
        }

        async _onLeftClick(event) {
            if (this.item.type === "weapon") {
                const grips = Object.keys(this.item.system?.grip_profiles ?? {});
                if (event.shiftKey && grips.length > 1) {
                    const current = getCurrentGrip(this.item);
                    const next = grips[(grips.indexOf(current) + 1) % grips.length];
                    return setGrip(this.item, next);
                }
                if (getProfile(this.actor) !== "universal") {
                    return withActionLock(`equipment:${this.item.uuid}`, () => prepareItem(this.actor, this.item));
                }
                return withActionLock(`equipment:${this.item.uuid}`, () => toggleReadied(this.item));
            }
            return withActionLock(`equipment:${this.item.uuid}`, () => toggleEquipped(this.item));
        }

        async _onRightClick() {
            if (!this.item) return false;
            const choices = [
                { value: "view", label: game.i18n.localize(`${MODULE_ID}.equipment.menu_view`) },
                {
                    value: "prepare",
                    label: game.i18n.localize(
                        `${MODULE_ID}.equipment.${this.item.type === "weapon" && this.item.system?.readied ? "menu_sheathe" : "menu_prepare"}`,
                    ),
                },
            ];
            if (this.item.type === "weapon") {
                for (const grip of Object.keys(this.item.system?.grip_profiles ?? {})) {
                    if (grip === getCurrentGrip(this.item)) continue;
                    choices.push({
                        value: `grip:${grip}`,
                        label: game.i18n.format(`${MODULE_ID}.equipment.menu_grip`, { grip }),
                    });
                }
            }
            if (game.l5r5e?.equipment?.isHeld?.(this.item)) {
                choices.push({ value: "drop", label: game.i18n.localize(`${MODULE_ID}.equipment.menu_drop`) });
                try {
                    if (game.settings.get("l5r5e", "enableImprovisedThrowAction")) {
                        choices.push({ value: "throw", label: game.i18n.localize(`${MODULE_ID}.equipment.menu_throw_house_rule`) });
                    }
                } catch (_error) {
                    // The core setting is unavailable on an incompatible system version.
                }
            }
            const action = await promptSelect({
                title: this.item.name,
                label: game.i18n.localize(`${MODULE_ID}.equipment.menu_action`),
                choices,
            });
            if (!action) return false;
            if (action === "view") return this.item.sheet.render({ force: true, editable: false });
            if (action === "prepare") return prepareItem(this.actor, this.item);
            if (action === "drop") return dropItem(this.actor, this.item);
            if (action === "throw") return throwItem(this.actor, this.item);
            if (action.startsWith("grip:")) return setGrip(this.item, action.slice(5));
            return false;
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            bindHudPointerActivation(element, {
                onLeft: (event) => this._onPreLeftClick(event),
                onRight: (event) => this._onRightClick(event),
            });
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
            if (!this.item) return;
            this.element.classList.add("l5r5e-palette-entry");
            installHudButtonIcon(this.element, this.icon, "l5r5e-entry-icon");
            this.element.classList.toggle("l5r5e-readied", isReadiedWeapon(this.item));
            this.element.classList.toggle("l5r5e-equipped", !!this.item.system?.equipped);
            this.element.dataset.search = [this.item.name, itemSubtitle(this.item), getItemProperties(this.item).join(" ")].join(" ");
            this.element.setAttribute("aria-label", this.item.name);
            this.element.setAttribute("tabindex", "0");
        }
    }

    class L5R5eWeaponSetButton extends L5R5eEquipmentItemButton {
        async _onLeftClick() {
            if (!this.item) return;
            const profile = getProfile(this.actor);
            if (profile === "universal") {
                notify(`${MODULE_ID}.notifications.strike_conflict_only`, "info");
                return this.item.sheet.render({ force: true, editable: false });
            }
            return openWeaponStrike(this.actor, this.item);
        }
    }

    class L5R5eEquipmentPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
        get id() {
            return "l5r5e-equipment";
        }

        get label() {
            return `${MODULE_ID}.equipment.label`;
        }

        get icon() {
            return ACTION_ICONS.equipment;
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            element.onkeydown = (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                this._onClick(event);
            };
        }

        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("l5r5e-palette-action", "l5r5e-action-equipment");
            installHudButtonIcon(this.element, this.icon, "l5r5e-palette-icon");
            this.element.setAttribute("aria-label", game.i18n.localize(this.label));
            this.element.setAttribute("tabindex", "0");
        }

        async _getPanel() {
            const items = [
                ...getWeapons(this.actor),
                ...this.actor.items.filter((item) => item.type === "armor"),
                ...this.actor.items.filter((item) => item.type === "item" && item.system?.equipped),
            ];
            return new L5R5eSearchableButtonPanel({
                id: this.id,
                buttons: items.map((item) => new L5R5eEquipmentItemButton({ item })),
            });
        }
    }

    return {
        L5R5eEquipmentItemButton,
        L5R5eWeaponSetButton,
        L5R5eEquipmentPanelButton,
        getPortraitArmor: (actor) => getEquippedArmor(actor),
    };
}
