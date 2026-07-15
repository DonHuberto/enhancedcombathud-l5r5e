import { ACTION_ICONS, MODULE_ID } from "./config.js";
import { prepareItem } from "./actions.js";
import { getEquippedArmor, getItemProperties, getWeapons, isReadiedWeapon } from "./data.js";
import { openWeaponStrike } from "./rolls.js";
import { getProfile } from "./state.js";
import { getCurrentGrip, setGrip, toggleEquipped, toggleReadied } from "./weapons.js";
import { enrichText, escapeHtml, getSourceLabel, notify, withActionLock } from "./utils.js";

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
            { label: `${MODULE_ID}.equipment.grip_1`, value: escapeHtml(item.system.grip_1 || "—") },
            { label: `${MODULE_ID}.equipment.grip_2`, value: escapeHtml(item.system.grip_2 || "—") },
            {
                label: `${MODULE_ID}.equipment.current_grip`,
                value: escapeHtml(item.system?.[getCurrentGrip(item)] || getCurrentGrip(item)),
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

export function createEquipmentClasses(ARGON) {
    class L5R5eEquipmentItemButton extends ARGON.MAIN.BUTTONS.ItemButton {
        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            return getEquipmentTooltip(this.item);
        }

        async _onLeftClick(event) {
            if (this.item.type === "weapon") {
                if (event.shiftKey && (this.item.system.grip_1 || this.item.system.grip_2)) {
                    const next = getCurrentGrip(this.item) === "grip_1" ? "grip_2" : "grip_1";
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
            this.item?.sheet?.render(true);
        }

        async _renderInner() {
            await super._renderInner();
            if (!this.item) return;
            this.element.classList.toggle("l5r5e-readied", isReadiedWeapon(this.item));
            this.element.classList.toggle("l5r5e-equipped", !!this.item.system?.equipped);
        }
    }

    class L5R5eWeaponSetButton extends L5R5eEquipmentItemButton {
        async _onLeftClick() {
            if (!this.item) return;
            const profile = getProfile(this.actor);
            if (profile === "universal") {
                notify(`${MODULE_ID}.notifications.strike_conflict_only`, "info");
                return this.item.sheet.render(true);
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

        async _getPanel() {
            const items = [
                ...getWeapons(this.actor),
                ...this.actor.items.filter((item) => item.type === "armor"),
                ...this.actor.items.filter((item) => item.type === "item" && item.system?.equipped),
            ];
            return new ARGON.MAIN.BUTTON_PANELS.ButtonPanel({
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
