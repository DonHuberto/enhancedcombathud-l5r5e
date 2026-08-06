import { MODULE_ID } from "./config.js";
import { enrichText } from "./utils.js";

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
}

export async function buildNinjoGiri(actor) {
    const section = element("div", "l5r5e-ninjo-giri l5r5e-action-identity");
    for (const id of ["ninjo", "giri"]) {
        const raw = actor.system?.social?.[id] ?? "";
        if (!String(raw).trim()) continue;
        const wrapper = element("div", "l5r5e-social-secret");
        const button = element("button", `l5r5e-${id}`);
        button.type = "button";
        button.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.social.${id}_tooltip`);
        button.append(
            element("i", id === "ninjo" ? "fas fa-heart" : "fas fa-scroll"),
            element("span", null, game.i18n.localize(`l5r5e.social.${id}`)),
        );
        const popover = element("div", "l5r5e-social-popover hidden");
        popover.innerHTML = await enrichText(raw, { relativeTo: actor });
        button.setAttribute("aria-expanded", "false");
        const toggle = (open = popover.classList.contains("hidden")) => {
            popover.classList.toggle("hidden", !open);
            button.setAttribute("aria-expanded", String(open));
        };
        button.addEventListener("click", () => toggle());
        button.addEventListener("keydown", (event) => {
            if (event.key === "Escape") toggle(false);
        });
        wrapper.append(button, popover);
        section.appendChild(wrapper);
    }
    section.classList.toggle("hidden", !section.children.length);
    return section;
}
