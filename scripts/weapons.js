import { MODULE_ID } from "./config.js";
import { getWeapons, isReadiedWeapon } from "./data.js";
import { canUpdate, notify, promptSelect } from "./utils.js";

function equipmentApi() {
    return game.l5r5e?.equipment ?? null;
}

async function collectReleaseDecisions(intent) {
    if (intent.assessment?.code !== "occupiedHands") return [];
    const candidates = [...(intent.assessment?.hands?.heldItems ?? [])];
    const releases = [];
    let releasedHands = 0;
    const required = Number(intent.assessment?.hands?.deficit ?? 0);

    while (releasedHands < required) {
        const remaining = candidates.filter((entry) => !releases.some((release) => release.itemUuid === entry.itemUuid));
        if (!remaining.length) return null;
        const choice = await promptSelect({
            title: game.i18n.localize(`${MODULE_ID}.equipment.occupied_hands`),
            label: game.i18n.format(`${MODULE_ID}.equipment.release_hands`, {
                remaining: Math.max(0, required - releasedHands),
            }),
            choices: remaining.flatMap((entry) => [
                {
                    value: `${entry.itemUuid}|stow`,
                    label: game.i18n.format(`${MODULE_ID}.equipment.release_stow`, { name: entry.name }),
                },
                {
                    value: `${entry.itemUuid}|drop`,
                    label: game.i18n.format(`${MODULE_ID}.equipment.release_drop`, { name: entry.name }),
                },
            ]),
        });
        if (!choice) return null;
        const [itemUuid, mode] = choice.split("|");
        const candidate = remaining.find((entry) => entry.itemUuid === itemUuid);
        if (!candidate) return null;
        releases.push({ itemUuid, mode });
        releasedHands += Number(candidate.hands ?? 0);
    }
    return releases;
}

export async function executeEquipmentIntent(intent) {
    const equipment = equipmentApi();
    if (!equipment?.confirm || !equipment?.reserve || !equipment?.commit) {
        notify(`${MODULE_ID}.notifications.equipment_api_unavailable`, "error");
        return false;
    }
    if (!intent?.ok && intent?.assessment?.code !== "occupiedHands") {
        notify(`${MODULE_ID}.notifications.equipment_blocked`, "warn", {
            reason: intent?.assessment?.code ?? "blocked",
        });
        return false;
    }

    const releases = await collectReleaseDecisions(intent);
    if (releases === null) return false;
    const confirmed = equipment.confirm(intent, { releases });
    if (!confirmed.ok) {
        notify(`${MODULE_ID}.notifications.equipment_blocked`, "warn", { reason: confirmed.code ?? "blocked" });
        return false;
    }
    const reserved = await equipment.reserve(confirmed);
    if (!reserved.ok) {
        notify(`${MODULE_ID}.notifications.equipment_blocked`, "warn", { reason: reserved.code ?? "blocked" });
        return false;
    }
    const committed = await equipment.commit(reserved);
    if (!committed.ok) {
        await equipment.cancel?.(reserved);
        notify(`${MODULE_ID}.notifications.equipment_blocked`, "warn", { reason: committed.code ?? "blocked" });
        return false;
    }
    ui.ARGON?.refresh?.();
    return committed;
}

export async function updateEquipmentState(item, { equipped = item?.system?.equipped, readied = item?.system?.readied } = {}) {
    if (!item || !canUpdate(item)) {
        notify(`${MODULE_ID}.notifications.no_permission`, "warn");
        return false;
    }
    const equipment = equipmentApi();
    if (!equipment?.prepare) {
        notify(`${MODULE_ID}.notifications.equipment_api_unavailable`, "error");
        return false;
    }
    const ready = item.type === "weapon" ? Boolean(readied && equipped) : Boolean(equipped);
    return executeEquipmentIntent(equipment.prepare(item.parent, item, { ready }));
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
    if (item?.type !== "weapon" || !item.system?.grip_profiles?.[grip] || !canUpdate(item)) return false;
    const equipment = equipmentApi();
    if (!equipment?.changeGrip) {
        notify(`${MODULE_ID}.notifications.equipment_api_unavailable`, "error");
        return false;
    }
    return executeEquipmentIntent(equipment.changeGrip(item.parent, item, grip));
}

export function getCurrentGrip(item) {
    return item?.system?.active_grip ?? "one-handed";
}

export async function dropItem(actor, item) {
    const equipment = equipmentApi();
    if (!equipment?.drop) {
        notify(`${MODULE_ID}.notifications.equipment_api_unavailable`, "error");
        return false;
    }
    return executeEquipmentIntent(equipment.drop(actor, item));
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
            const equipment = equipmentApi();
            if (!equipment?.changeLoadout) {
                notify(`${MODULE_ID}.notifications.equipment_api_unavailable`, "error");
                return false;
            }
            const activeItems = Object.values(sets[active] ?? {}).filter(
                (item) => item?.type === "weapon" && item.parent?.id === this.actor.id,
            );
            return Boolean(await executeEquipmentIntent(equipment.changeLoadout(this.actor, activeItems)));
        }
    };
}
