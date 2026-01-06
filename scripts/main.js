// main.js

import { L5R5eHUD } from "./hud.js";

Hooks.once("ready", () => {
    console.log("EnhancedCombatHUD-L5R5e | Ready hook fired");

    const echModule = game.modules.get("enhancedcombathud");

    if (!echModule || !echModule.active) {
        console.error("EnhancedCombatHUD-L5R5e | ERROR: Enhanced Combat HUD module is not active!");
        return;
    }

    const echApi = echModule.api;

    if (!echApi) {
        console.error("EnhancedCombatHUD-L5R5e | ERROR: Enhanced Combat HUD API not available!");
        return;
    }

    console.log("EnhancedCombatHUD-L5R5e | Registering HUD via API");

    echApi.registerSystem("l5r5e", {
        label: "Legend of the Five Rings 5e",
        system: "l5r5e",
        template: "modules/enhancedcombathud-l5r5e/templates/hud.html",
        getData: L5R5eHUD.getData,
        actions: L5R5eHUD.actions
    });
});

Hooks.on("renderEnhancedCombatHUD", (app, html) => {
    html.find(".effect-icon").each((_, el) => {
        const $el = $(el);
        const name = $el.data("tooltip");
        const description = $el.data("description");

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