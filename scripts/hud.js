// hud.js

import { getEquippedWeapons, toggleSheathed } from "./weapons.js";
import { getSkirmishActions, executeAction } from "./actions.js";
import { getTechniques, useTechnique } from "./techniques.js";

/* -------------------------------------------------------------
 * Utility: Determine color class for fatigue/strife values
 * ------------------------------------------------------------- */
function getColor(value, max) {
    if (value <= max / 2) return "green";
    if (value <= max) return "yellow";
    return "red";
}

/* -------------------------------------------------------------
 * Utility: Resolve active effect descriptions from compendiums
 * ------------------------------------------------------------- */
async function resolveEffectDescriptions(actor) {
    const effects = [];

    for (const effect of actor.effects) {
        let description = "";

        // Try to resolve from compendium if origin is known
        if (effect.origin) {
            try {
                const uuid = effect.origin;
                const doc = await fromUuid(uuid);
                description = doc?.system?.description ?? "";
            } catch (err) {
                description = "";
            }
        }

        effects.push({
            id: effect.id,
            name: effect.name,
            icon: effect.icon,
            description
        });
    }

    return effects;
}

/* -------------------------------------------------------------
 * Main HUD Object
 * ------------------------------------------------------------- */
export const L5R5eHUD = {

    /* ---------------------------------------------------------
     * getData(actor)
     * Called by Enhanced Combat HUD to populate the template
     * --------------------------------------------------------- */
    getData: async (actor) => {

        // Extract resources safely
        const fatigue = actor.system.fatigue ?? { value: 0, max: 0 };
        const strife = actor.system.strife ?? { value: 0, max: 0 };
        const voidPoints = actor.system.voidPoints ?? { value: 0, max: 0 };

        // Resolve active effects with descriptions
        const effects = await resolveEffectDescriptions(actor);

        return {
            actor,
            effects,

            weapons: getEquippedWeapons(actor).map(w => ({
                id: w.id,
                name: w.name,
                sheathed: w.system.sheathed
            })),

            actions: getSkirmishActions(),

            techniques: getTechniques(actor).map(t => ({
                id: t.id,
                name: t.name
            })),

            resources: {
                fatigue,
                strife,
                voidPoints
            },

            fatigueColor: getColor(fatigue.value, fatigue.max),
            strifeColor: getColor(strife.value, strife.max)
        };
    },

    /* ---------------------------------------------------------
     * actions
     * Maps HUD click events to system logic
     * --------------------------------------------------------- */
    actions: {
        "toggle-weapon": (actor, weaponId) => toggleSheathed(actor, weaponId),
        "skirmish-action": (actor, actionId) => executeAction(actor, actionId),
        "use-technique": (actor, techniqueId) => useTechnique(actor, techniqueId)
    }
};