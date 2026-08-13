import { ACTION_ICONS, MODULE_ID, SKILL_CATEGORIES } from "./config.js";
import { collectSkills } from "./data.js";
import { bindHudPointerActivation, installHudButtonIcon } from "./hud-buttons.js";
import { getSkillLabel, openGenericRoll, openSkillRoll } from "./rolls.js";
import { withActionLock } from "./utils.js";

function categoryLabel(category) {
    const key = `l5r5e.skills.${category}.title`;
    const translated = game.i18n.localize(key);
    return translated === key ? game.i18n.localize(`${MODULE_ID}.skills.categories.${category}`) : translated;
}

export function createSkillClasses(ARGON, { L5R5eSearchableAccordionPanel }) {
    class L5R5eSkillButton extends ARGON.MAIN.BUTTONS.ActionButton {
        constructor(skill = null) {
            super();
            this.skill = skill;
        }

        get label() {
            return this.skill ? getSkillLabel(this.skill.id, this.skill.category) : `${MODULE_ID}.skills.generic`;
        }

        get icon() {
            return this.skill
                ? `systems/l5r5e/assets/icons/rings/${this.actor.system?.stance ?? "void"}.svg`
                : ACTION_ICONS.generic_roll;
        }

        get hasTooltip() {
            return true;
        }

        async getTooltipData() {
            return {
                title: game.i18n.localize(this.label),
                subtitle: this.skill ? categoryLabel(this.skill.category) : game.i18n.localize(`${MODULE_ID}.skills.generic`),
                description: game.i18n.localize(`${MODULE_ID}.skills.${this.skill ? "roll_tooltip" : "generic_tooltip"}`),
                details: this.skill ? [{ label: `${MODULE_ID}.skills.rank`, value: this.skill.rank }] : [],
            };
        }

        async _onLeftClick() {
            const id = this.skill?.id ?? "generic";
            return withActionLock(`skill-palette:${this.actor.uuid}:${id}`, () =>
                this.skill ? openSkillRoll(this.actor, this.skill.id) : openGenericRoll(this.actor),
            );
        }

        async activateListeners(element) {
            await super.activateListeners(element);
            bindHudPointerActivation(element, { onLeft: (event) => this._onLeftClick(event) });
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
            this.element.classList.add("l5r5e-palette-entry", "l5r5e-skill-entry");
            installHudButtonIcon(this.element, this.icon, "l5r5e-entry-icon");
            this.element.dataset.search = [game.i18n.localize(this.label), this.skill ? categoryLabel(this.skill.category) : ""].join(" ");
            this.element.setAttribute("aria-label", game.i18n.localize(this.label));
            this.element.setAttribute("tabindex", "0");
        }
    }

    class L5R5eSkillsPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
        get id() {
            return "l5r5e-skills";
        }

        get label() {
            return `${MODULE_ID}.skills.label`;
        }

        get icon() {
            return ACTION_ICONS.skills;
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
            this.element.classList.add("l5r5e-palette-action", "l5r5e-action-skills");
            installHudButtonIcon(this.element, this.icon, "l5r5e-palette-icon");
            this.element.setAttribute("aria-label", game.i18n.localize(this.label));
            this.element.setAttribute("tabindex", "0");
        }

        async _getPanel() {
            const skills = collectSkills(this.actor.system);
            const categories = [
                new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({
                    label: game.i18n.localize(`${MODULE_ID}.skills.generic`),
                    buttons: [new L5R5eSkillButton()],
                }),
            ];
            for (const category of SKILL_CATEGORIES) {
                const entries = skills.filter((skill) => skill.category === category);
                if (!entries.length) continue;
                categories.push(new ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory({
                    label: categoryLabel(category),
                    buttons: entries.map((skill) => new L5R5eSkillButton(skill)),
                }));
            }
            return new L5R5eSearchableAccordionPanel({ id: this.id, accordionPanelCategories: categories });
        }
    }

    return { L5R5eSkillButton, L5R5eSkillsPanelButton };
}
