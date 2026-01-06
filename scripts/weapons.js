// weapons.js

/* -------------------------------------------------------------
 * Extract equipped weapons from the actor
 * ------------------------------------------------------------- */
export function getEquippedWeapons(actor) {
    return actor.items.filter(item =>
        item.type === "weapon" &&
        item.system?.equipped === true
    );
}

/* -------------------------------------------------------------
 * Toggle the sheathed state of a weapon
 * ------------------------------------------------------------- */
export async function toggleSheathed(actor, weaponId) {
    const weapon = actor.items.get(weaponId);
    if (!weapon) return;

    const current = weapon.system?.sheathed ?? false;
    const newState = !current;

    await weapon.update({ "system.sheathed": newState });

    ui.notifications.info(
        `${weapon.name} is now ${newState ? "sheathed" : "unsheathed"}.`
    );
}