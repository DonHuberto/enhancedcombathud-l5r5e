import { MODULE_ID, SKILL_CATEGORIES } from "./config.js";
import { collectSkills, getItemProperties } from "./data.js";
import { getSkillLabel, openGenericRoll, openSkillRoll } from "./rolls.js";
import { enrichText, escapeHtml, getSourceLabel } from "./utils.js";
import { toggleEquipped, toggleReadied } from "./weapons.js";

function categoryLabel(category) {
    const key = `l5r5e.skills.${category}.title`;
    const translated = game.i18n.localize(key);
    return translated === key ? game.i18n.localize(`${MODULE_ID}.skills.categories.${category}`) : translated;
}

async function itemTooltip(item) {
    return {
        title: escapeHtml(item.name),
        subtitle: game.i18n.localize(`TYPES.Item.${item.type}`),
        description: await enrichText(item.system?.description, { relativeTo: item }),
        propertiesLabel: `${MODULE_ID}.equipment.properties`,
        properties: getItemProperties(item).map((label) => ({ label: escapeHtml(label), secondary: true })),
        footerText: [getSourceLabel(item)].filter(Boolean),
    };
}

export function createDrawerClasses(ARGON) {
    class L5R5eDrawerButton extends ARGON.DRAWER.DrawerButton {
        constructor(buttons, tooltipData = null) {
            super(buttons);
            this.tooltipData = tooltipData;
        }

        get hasTooltip() {
            return !!this.tooltipData;
        }

        async getTooltipData() {
            return typeof this.tooltipData === "function" ? this.tooltipData() : this.tooltipData;
        }
    }

    class L5R5eDrawerPanel extends ARGON.DRAWER.DrawerPanel {
        get title() {
            return game.i18n.localize(`${MODULE_ID}.drawer.title`);
        }

        get categories() {
            return [this.#skillsPanel(), this.#peculiaritiesPanel(), this.#equipmentPanel()];
        }

        #skillsPanel() {
            const skills = collectSkills(this.actor.system);
            const categories = SKILL_CATEGORIES.map((category) => ({
                gridCols: "7fr 2fr",
                captions: [
                    { label: categoryLabel(category), align: "left" },
                    { label: game.i18n.localize(`${MODULE_ID}.skills.rank`), align: "center" },
                ],
                buttons: skills
                    .filter((skill) => skill.category === category)
                    .map(
                        (skill) =>
                            new L5R5eDrawerButton(
                                [
                                    {
                                        label: getSkillLabel(skill.id, category),
                                        onClick: () => openSkillRoll(this.actor, skill.id),
                                    },
                                    { label: String(skill.rank), onClick: () => openSkillRoll(this.actor, skill.id) },
                                ],
                                {
                                    title: getSkillLabel(skill.id, category),
                                    subtitle: categoryLabel(category),
                                    description: game.i18n.localize(`${MODULE_ID}.skills.roll_tooltip`),
                                    details: [{ label: `${MODULE_ID}.skills.rank`, value: skill.rank }],
                                },
                            ),
                    ),
            }));

            categories.unshift({
                gridCols: "9fr",
                captions: [{ label: game.i18n.localize(`${MODULE_ID}.skills.generic`) }],
                buttons: [
                    new L5R5eDrawerButton(
                        [{ label: game.i18n.localize(`${MODULE_ID}.skills.generic`), onClick: () => openGenericRoll(this.actor) }],
                        {
                            title: game.i18n.localize(`${MODULE_ID}.skills.generic`),
                            description: game.i18n.localize(`${MODULE_ID}.skills.generic_tooltip`),
                        },
                    ),
                ],
            });
            return { title: game.i18n.localize(`${MODULE_ID}.skills.label`), categories };
        }

        #peculiaritiesPanel() {
            const groups = ["distinction", "passion", "adversity", "anxiety"];
            const categories = groups.map((type) => ({
                gridCols: "9fr",
                captions: [{ label: game.i18n.localize(`${MODULE_ID}.peculiarities.${type}`) }],
                buttons: this.actor.items
                    .filter((item) => item.type === "peculiarity" && item.system?.peculiarity_type === type)
                    .map(
                        (item) =>
                            new L5R5eDrawerButton(
                                [{ label: escapeHtml(item.name), onClick: () => item.sheet.render({ force: true, editable: false }) }],
                                () => itemTooltip(item),
                            ),
                    ),
            }));
            return { title: game.i18n.localize(`${MODULE_ID}.peculiarities.label`), categories };
        }

        #equipmentPanel() {
            const items = this.actor.items.filter((item) => ["weapon", "armor", "item"].includes(item.type));
            const makeRow = (item) => {
                const state = item.system?.equipped
                    ? item.type === "weapon" && item.system?.readied
                        ? game.i18n.localize(`${MODULE_ID}.equipment.readied`)
                        : game.i18n.localize(`${MODULE_ID}.equipment.equipped`)
                    : game.i18n.localize(`${MODULE_ID}.equipment.stowed`);
                const buttons = [
                    { label: escapeHtml(item.name), onClick: () => item.sheet.render({ force: true, editable: false }) },
                    { label: state, onClick: () => toggleEquipped(item) },
                ];
                if (item.type === "weapon") {
                    buttons.push({
                        label: item.system?.readied ? "✓" : "—",
                        onClick: () => toggleReadied(item),
                    });
                } else buttons.push({ label: "" });
                return new L5R5eDrawerButton(buttons, () => itemTooltip(item));
            };

            return {
                title: game.i18n.localize(`${MODULE_ID}.equipment.label`),
                categories: [
                    {
                        gridCols: "6fr 2fr 1fr",
                        captions: [
                            { label: game.i18n.localize(`${MODULE_ID}.equipment.item`), align: "left" },
                            { label: game.i18n.localize(`${MODULE_ID}.equipment.state`), align: "center" },
                            { label: game.i18n.localize(`${MODULE_ID}.equipment.ready_short`), align: "center" },
                        ],
                        buttons: items.map(makeRow),
                    },
                ],
            };
        }
    }

    return { L5R5eDrawerButton, L5R5eDrawerPanel };
}
