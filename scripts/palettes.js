import { MODULE_ID } from "./config.js";

function addSearchUi(panel, itemSelector) {
    const header = document.createElement("header");
    header.className = "l5r5e-palette-header";

    const icon = document.createElement("i");
    icon.className = "fas fa-magnifying-glass";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "l5r5e-palette-search";
    input.placeholder = game.i18n.localize(`${MODULE_ID}.palettes.search`);
    input.setAttribute("aria-label", input.placeholder);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "l5r5e-palette-close";
    close.setAttribute("aria-label", game.i18n.localize(`${MODULE_ID}.palettes.close`));
    close.innerHTML = '<i class="fas fa-xmark"></i>';
    header.append(icon, input, close);
    panel.element.prepend(header);

    const filter = () => {
        const query = input.value.trim().toLocaleLowerCase(game.i18n.lang);
        for (const item of panel.element.querySelectorAll(itemSelector)) {
            const searchText = `${item.dataset.search ?? ""} ${item.textContent ?? ""}`.toLocaleLowerCase(game.i18n.lang);
            item.classList.toggle("l5r5e-search-hidden", Boolean(query) && !searchText.includes(query));
        }
        for (const category of panel.element.querySelectorAll(".features-accordion")) {
            const items = [...category.querySelectorAll(itemSelector)];
            category.classList.toggle("l5r5e-search-hidden", items.length > 0 && items.every((item) => item.classList.contains("l5r5e-search-hidden")));
        }
    };
    input.addEventListener("input", filter);
    input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        panel.toggle(false);
        panel._parent?.element?.focus?.();
    });
    close.addEventListener("click", () => panel.toggle(false));
}

export function createSearchablePanelClasses(ARGON) {
    class L5R5eSearchableButtonPanel extends ARGON.MAIN.BUTTON_PANELS.ButtonPanel {
        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("l5r5e-palette-panel");
            addSearchUi(this, ".feature-element");
        }
    }

    class L5R5eSearchableAccordionPanel extends ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel {
        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("l5r5e-palette-panel");
            addSearchUi(this, ".feature-element");
        }
    }

    return { L5R5eSearchableButtonPanel, L5R5eSearchableAccordionPanel };
}
