import { MODULE_ID } from "./config.js";
import { getWeapons, isReadiedWeapon } from "./data.js";
import { canUpdate, notify, promptSelect } from "./utils.js";

export async function updateEquipmentState(item, { equipped = item?.system?.equipped, readied = item?.system?.readied } = {}) {
    if (!item || !canUpdate(item)) {
        notify(`${MODULE_ID}.notifications.no_permission`, "warn");
        return false;
    }

    const update = { "system.equipped": !!equipped };
    if (item.type === "weapon") {
        update["system.readied"] = !!readied && !!equipped;
    }
    await item.update(update);
    return true;
}

export function toggleEquipped(item) {
    return updateEquipmentState(item, {
        equipped: !item.system?.equipped,
        readied: item.system?.equipped ? false : item.system?.readied,
    });
}

export function toggleReadied(item) {
    if (item?.type !== "weapon") return false;
    const readied = !item.system?.readied;
    return updateEquipmentState(item, { equipped: readied ? true : item.system?.equipped, readied });
}

export async function setGrip(item, grip) {
    if (item?.type !== "weapon" || !["grip_1", "grip_2"].includes(grip) || !canUpdate(item)) return false;
    await item.setFlag(MODULE_ID, "currentGrip", grip);
    ui.ARGON?.refresh();
    return true;
}

export function getCurrentGrip(item) {
    return item?.getFlag?.(MODULE_ID, "currentGrip") ?? "grip_1";
}

export async function chooseWeapon(actor, { readiedOnly = false, equippedOnly = false, titleKey = "prepare_item" } = {}) {
    const weapons = getWeapons(actor, { readiedOnly, equippedOnly });
    if (!weapons.length) {
        notify(`${MODULE_ID}.notifications.no_weapon`, "warn");
        return null;
    }
    if (weapons.length === 1) return weapons[0];

    const id = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.actions.${titleKey}.label`),
        label: game.i18n.localize(`${MODULE_ID}.equipment.choose_weapon`),
        choices: weapons.map((weapon) => ({
            value: weapon.id,
            label: `${weapon.name}${isReadiedWeapon(weapon) ? ` — ${game.i18n.localize(`${MODULE_ID}.equipment.readied`)}` : ""}`,
        })),
    });
    return actor.items.get(id) ?? null;
}

export function createWeaponSetsClass(ARGON) {
    return class L5R5eWeaponSets extends ARGON.WeaponSets {
        async getDefaultSets() {
            const weapons = getWeapons(this.actor, { equippedOnly: true });
            return {
                1: { primary: weapons[0]?.uuid ?? null, secondary: weapons[1]?.uuid ?? null },
                2: { primary: weapons[2]?.uuid ?? null, secondary: weapons[3]?.uuid ?? null },
                3: { primary: weapons[4]?.uuid ?? null, secondary: weapons[5]?.uuid ?? null },
            };
        }

        async _onSetChange({ sets, active }) {
            const activeItems = new Set(
                Object.values(sets[active] ?? {}).filter(
                    (item) => item?.type === "weapon" && item.parent?.id === this.actor.id,
                ),
            );
            const updates = [];

            for (const weapon of getWeapons(this.actor)) {
                const isActive = activeItems.has(weapon);
                const update = { _id: weapon.id };
                if (isActive && !weapon.system.equipped) update["system.equipped"] = true;
                if (!!weapon.system.readied !== isActive) update["system.readied"] = isActive;
                if (Object.keys(update).length > 1) updates.push(update);
            }

            if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
        }
    };
}
