// main.js

import { L5R5eHUD } from "./hud.js";

/* -------------------------------------------------------------
 * Register the L5R5e HUD with Enhanced Combat HUD
 * ------------------------------------------------------------- */
Hooks.once("init", () => {
    console.log("EnhancedCombatHUD-L5R5e | Initializing L5R5e HUD");

    EnhancedCombatHUD.registerSystem("l5r5e", {
        label: "Legend of the Five Rings 5e",
        system: "l5r5e",
        template: "modules/enhancedcombathud-l5r5e/templates/hud.html",
        getData: L5R5eHUD.getData,
        actions: L5R5eHUD.actions
    });
});

/* -------------------------------------------------------------
 * Tooltip handling for active effects
 * ------------------------------------------------------------- */
Hooks.on("renderEnhancedCombatHUD", (app, html) => {
    html.find(".effect-icon").each((_, el) => {
        const $el = $(el);
        const name = $el.data("tooltip");
        const description = $el.data("description");

        // Foundry's built-in tooltip system
        $el.tooltipster({
            theme: "tooltipster-shadow",
            content: `
                <strong>${name}</strong><br>
                ${description || "No description available."}
            `,
            contentAsHTML: true,
            delay: 100,
            animation: "fade",
            side: "right"
        });
    });
});