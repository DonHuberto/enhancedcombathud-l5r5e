import { CORE_ID, MODULE_ID, SYSTEM_ID } from "./config.js";
import { createPortraitPanel } from "./portrait.js";
import { createDrawerClasses } from "./drawer.js";
import { createEquipmentClasses } from "./equipment.js";
import { createTechniqueClasses } from "./techniques.js";
import { createActionPanels } from "./actions.js";
import { createSearchablePanelClasses } from "./palettes.js";
import { createSkillClasses } from "./skills.js";
import { createWeaponSetsClass } from "./weapons.js";
import { SUPPORTED_ACTOR_TYPES, canUseActor, clearLegacyTurnState, ensureCombatProfileSnapshot, registerStateHooks } from "./state.js";
import { registerDuelHooks } from "./profiles/duel.js";
import { registerIntrigueHooks } from "./profiles/intrigue.js";
import { registerSocket } from "./socket.js";

let configured = false;

export function isCoreSettingEnabled(key) {
    try {
        return Boolean(game.settings?.get?.(CORE_ID, key));
    } catch (_error) {
        return false;
    }
}

Hooks.once("argonInit", (CoreHUD) => {
    if (game.system.id !== SYSTEM_ID || configured) return;
    configured = true;

    const ARGON = CoreHUD.ARGON;
    const paletteClasses = createSearchablePanelClasses(ARGON);
    const equipmentClasses = createEquipmentClasses(ARGON, paletteClasses);
    const techniqueClasses = createTechniqueClasses(ARGON, paletteClasses);
    const skillClasses = createSkillClasses(ARGON, paletteClasses);
    const { L5R5eDrawerPanel } = createDrawerClasses(ARGON);
    const { panels } = createActionPanels(ARGON, equipmentClasses, techniqueClasses, skillClasses);

    class L5R5eTooltip extends ARGON.CORE.Tooltip {
        get classes() {
            return [...super.classes, "l5r5e-tooltip"];
        }
    }

    CoreHUD.L5R5E = Object.freeze({
        moduleId: MODULE_ID,
        profiles: ["universal", "intrigue", "duel", "skirmish", "mass_battle"],
    });

    CoreHUD.definePortraitPanel(createPortraitPanel(ARGON));
    CoreHUD.defineDrawerPanel(L5R5eDrawerPanel);
    CoreHUD.defineMainPanels(panels);
    CoreHUD.defineWeaponSets(createWeaponSetsClass(ARGON));
    CoreHUD.defineMovementHud(null);
    CoreHUD.defineTooltip(L5R5eTooltip);
    CoreHUD.defineSupportedActorTypes([...SUPPORTED_ACTOR_TYPES]);

    console.info(`${MODULE_ID} | Registered Argon V14 adapter for character and NPC actors`);
});

Hooks.once("init", () => {
    registerStateHooks();
    registerDuelHooks();
    registerIntrigueHooks();

    const refreshBoundHud = foundry.utils.debounce((document) => {
        const actor = document?.documentName === "Actor" ? document : document?.parent;
        if (actor && actor !== ui.ARGON?._actor) return;
        if (SUPPORTED_ACTOR_TYPES.includes(ui.ARGON?._actor?.type)) ui.ARGON.refresh();
    }, 60);

    Hooks.on("updateActor", (actor) => refreshBoundHud(actor));
    Hooks.on("createActiveEffect", (effect) => refreshBoundHud(effect));
    Hooks.on("updateActiveEffect", (effect) => refreshBoundHud(effect));
    Hooks.on("deleteActiveEffect", (effect) => refreshBoundHud(effect));
    Hooks.on("updateCombatant", (combatant) => refreshBoundHud(combatant.actor));
    Hooks.on("l5r5e.turnStateChanged", (combatant) => refreshBoundHud(combatant?.actor));

    Hooks.on("targetToken", () => SUPPORTED_ACTOR_TYPES.includes(ui.ARGON?._actor?.type) && ui.ARGON.components?.portrait?.refresh?.());
    Hooks.on("controlToken", (token, controlled) => {
        if (!isCoreSettingEnabled("alwaysOn")) return;
        if (controlled && canUseActor(token.actor)) return;
        setTimeout(() => {
            if (canvas?.tokens?.controlled?.some((entry) => canUseActor(entry.actor))) return;
            const actor = game.user.character;
            if (canUseActor(actor)) ui.ARGON?.bind(actor);
        }, 150);
    });
    Hooks.on("updateItem", (item, changes) => {
        if (item.parent !== ui.ARGON?._actor) return;
        const flattened = foundry.utils.flattenObject(changes);
        if (
            Object.keys(flattened).some((path) =>
                ["system.equipped", "system.readied", "system.properties", "flags.enhancedcombathud-l5r5e"].some((prefix) =>
                    path.startsWith(prefix),
                ),
            )
        ) {
            refreshBoundHud(item);
        }
    });
});

Hooks.once("ready", async () => {
    const core = game.modules.get(CORE_ID);
    if (!core?.active) {
        ui.notifications.error(game.i18n.localize(`${MODULE_ID}.notifications.core_missing`), { permanent: true });
        return;
    }
    registerSocket();
    await ensureCombatProfileSnapshot();
    await clearLegacyTurnState(game.combat);

    if (isCoreSettingEnabled("alwaysOn") && !ui.ARGON?._target) {
        const target = canvas?.tokens?.controlled?.[0] ?? game.user.character;
        const actor = target?.actor ?? target;
        if (canUseActor(actor)) ui.ARGON.bind(target);
    }
});
