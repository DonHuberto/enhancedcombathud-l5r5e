import { ACTION_ICONS, MODULE_ID, TECHNIQUE_TYPES } from "./config.js";
import { collectTechniques, getTechniqueType, techniqueRequiresCheck } from "./data.js";
import { bindHudPointerActivation, installDelayedHudTooltip, installHudButtonIcon } from "./hud-buttons.js";
import { getTechniqueLabel, openTechniqueRoll } from "./rolls.js";
import { getProfile } from "./state.js";
import { enrichText, escapeHtml, getSourceLabel, notify } from "./utils.js";

const FAVORITES_FLAG = "favoriteTechniques";

export function getFavoriteTechniqueIds(actor) {
    return new Set(actor?.getFlag?.(MODULE_ID, FAVORITES_FLAG) ?? []);
}

export async function toggleFavoriteTechnique(actor, item) {
    const ids = getFavoriteTechniqueIds(actor);
    if (ids.has(item.uuid)) ids.delete(item.uuid);
    else ids.add(item.uuid);
    await actor.setFlag(MODULE_ID, FAVORITES_FLAG, Array.from(ids));
    ui.ARGON?.refresh();
}

export function getTechniqueAvailability(item, profile) {
    const hasRoll = techniqueRequiresCheck(item);
    if (!hasRoll) return { usable: false, reason: `${MODULE_ID}.techniques.informational_only` };
    if (profile === "universal" && getTechniqueType(item) !== "ritual") {
        return { usable: false, uncertain: true, reason: `${MODULE_ID}.techniques.context_unknown` };
    }
    return { usable: true, uncertain: false, reason: null };
}

function localizedSkillList(value) {
    return String(value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((id) => {
            const category = CONFIG.l5r5e?.skills?.get(id);
            const key = category ? `l5r5e.skills.${category}.${id}` : `l5r5e.skills.${id}.title`;
            const translated = game.i18n.localize(key);
            return translated === key ? id : translated;
        })
        .join(", ");
}

export async function getTechniqueTooltip(item, actor) {
    const type = getTechniqueType(item);
    const profile = getProfile(actor);
    const availability = getTechniqueAvailability(item, profile);
    const details = [
        { label: `${MODULE_ID}.techniques.type`, value: escapeHtml(getTechniqueLabel(type)) },
        {
            label: "l5r5e.rings.label",
            value: escapeHtml(item.system?.ring ? game.i18n.localize(`l5r5e.rings.${item.system.ring}`) : "—"),
        },
        { label: "l5r5e.skills.title", value: escapeHtml(localizedSkillList(item.system?.skill) || "—") },
        { label: "l5r5e.dice.dicepicker.difficulty_title", value: escapeHtml(item.system?.difficulty || "—") },
        {
            label: `${MODULE_ID}.techniques.availability`,
            value: game.i18n.localize(availability.reason ?? `${MODULE_ID}.techniques.available`),
        },
    ];

    const actionTypes = item.system?.activation?.action_types ?? item.system?.action_types ?? [];
    const localizedTypes = actionTypes
        .filter((type) => typeof type === "string" && type)
        .map((type) => game.i18n.localize(`${MODULE_ID}.action_types.${type}`))
        .join(", ");
    if (localizedTypes) details.push({ label: `${MODULE_ID}.techniques.action_types`, value: escapeHtml(localizedTypes) });

    return {
        title: escapeHtml(item.name),
        subtitle: escapeHtml(getTechniqueLabel(type)),
        description: await enrichText(item.system?.description, { relativeTo: item }),
        details,
        properties: [],
        footerText: [getSourceLabel(item)].filter(Boolean),
    };
}

export function createTechniqueClasses(ARGON, { L5R5eSearchableAccordionPanel }) {
    class L5R5eTechniqueButton extends ARGON.MAIN.BUTTONS.ItemButton {
        get hasTooltip() {
            return true;
        }

        get isFavorite() {
            return getFavoriteTechniqueIds(this.actor).has(this.item?.uuid);
        }

        async getTooltipData() {
            return getTechniqueTooltip(this.item, this.actor);
        }

        async activateTooltipListeners() {
            installDelayedHudTooltip(this);
        }

        async _onLeftClick() {
            const availability = getTechniqueAvailability(this.item, getProfile(this.actor));
            if (availability.usable) return openTechniqueRoll(this.actor, this.item);
            notify(availability.reason, "info");
            return null;
        }

        async _onRightClick(event) {
            if (event.shiftKey) {
                await toggleFavoriteTechnique(this.actor, this.item);
                notify(
                    this.isFavorite ? `${MODULE_ID}.notifications.favorite_added` : `${MODULE_ID}.notifications.favorite_removed`,
                    "info",
                    { name: this.item.name },
                );
                return;
            }
            this.item?.sheet?.render({ force: true, editable: false });
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            bindHudPointerActivation(element, {
                onLeft: (event) => this._onPreLeftClick(event),
                onRight: (event) => this._onRightClick(event),
            });
            element.onkeydown = (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                this._onLeftClick(event);
            };
            element.onfocus = () => element.dispatchEvent(new MouseEvent("mouseenter"));
            element.onblur = () => element.dispatchEvent(new MouseEvent("mouseleave"));
        }

        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("l5r5e-palette-entry");
            installHudButtonIcon(this.element, this.icon, "l5r5e-entry-icon");
            this.element.classList.toggle("l5r5e-favorite", this.isFavorite);
            this.element.classList.toggle("l5r5e-informational", !getTechniqueAvailability(this.item, getProfile(this.actor)).usable);
            this.element.dataset.search = [this.item?.name, getTechniqueLabel(getTechniqueType(this.item))].filter(Boolean).join(" ");
            this.element.setAttribute("aria-label", this.item?.name ?? "");
            this.element.setAttribute("tabindex", "0");
        }
    }

    class L5R5eTechniquesPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
        get id() {
            return "l5r5e-techniques";
        }

        get label() {
            return `${MODULE_ID}.techniques.label`;
        }

        get icon() {
            return ACTION_ICONS.techniques;
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            element.onkeydown = (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                this._onClick(event);
            };
        }

        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("l5r5e-palette-action", "l5r5e-action-techniques");
            installHudButtonIcon(this.element, this.icon, "l5r5e-palette-icon");
            this.element.setAttribute("aria-label", game.i18n.localize(this.label));
            this.element.setAttribute("tabindex", "0");
        }

        async _getPanel() {
            const favorites = getFavoriteTechniqueIds(this.actor);
            const techniques = collectTechniques(this.actor).sort((a, b) => {
                const favoriteDiff = Number(favorites.has(b.uuid)) - Number(favorites.has(a.uuid));
                return favoriteDiff || a.name.localeCompare(b.name, game.i18n.lang);
            });
            const categories = [];
            for (const type of TECHNIQUE_TYPES) {
                const items = techniques.filter((item) => getTechniqueType(item) === type);
                if (!items.length) continue;
                categories.push(
                    new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({
                        label: getTechniqueLabel(type),
                        buttons: items.map((item) => new L5R5eTechniqueButton({ item })),
                    }),
                );
            }
            return new L5R5eSearchableAccordionPanel({
                id: this.id,
                accordionPanelCategories: categories,
            });
        }
    }

    return { L5R5eTechniqueButton, L5R5eTechniquesPanelButton };
}
