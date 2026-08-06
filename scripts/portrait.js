import { MODULE_ID, PROFILES, RINGS } from "./config.js";
import {
    getActiveWeaponProfile,
    getEquippedArmor,
    getResourceData,
    getResourceOrbView,
    getWarningIds,
    getWeapons,
    weaponCoversRange,
} from "./data.js";
import { performUnmask } from "./actions.js";
import { getProfile, setCombatProfile } from "./state.js";
import { getProfileTrackerData } from "./profiles/tracker.js";
import { configureProfileTracker } from "./profiles/configure.js";
import {
    enrichText,
    escapeHtml,
    getKnownTargetData,
    getTargetRangeBand,
    getTargetToken,
    promptSelect,
} from "./utils.js";

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
}

function localized(key) {
    const translated = game.i18n.localize(key);
    return translated === key ? key.split(".").at(-1) : translated;
}

function tacticalGridApi() {
    return game.modules.get("aedifs-tactical-grid")?.active
        ? game.modules.get("aedifs-tactical-grid")?.api ?? globalThis.TacticalGrid
        : null;
}

function profileRange(profile) {
    const minimum = Number(profile?.range?.minimum ?? profile?.range_min ?? 0);
    const maximum = Number(profile?.range?.maximum ?? profile?.range_max ?? minimum);
    return {
        minimum: Number.isFinite(minimum) ? Math.max(0, minimum) : 0,
        maximum: Number.isFinite(maximum) ? Math.max(0, maximum) : 0,
    };
}

async function resolveEffectDescription(effect) {
    if (effect.description) return effect.description;
    const statusId = Array.from(effect.statuses ?? [])[0];
    const condition = CONFIG.l5r5e?.conditions?.find((entry) => entry.id === statusId || entry.img === effect.img);
    const documentId = effect.system?.id ?? condition?.system?.id;
    const uuid = effect.system?.uuid;

    try {
        let journal = uuid ? await fromUuid(uuid) : null;
        if (!journal && documentId) journal = await game.packs.get("l5r5e.core-journal-conditions")?.getDocument(documentId);
        if (journal?.content) return journal.content;
        const pageContent = journal?.pages?.map((page) => page.text?.content).filter(Boolean).join("\n");
        if (pageContent) return pageContent;
    } catch (error) {
        console.debug(`${MODULE_ID} | Could not resolve effect description`, effect, error);
    }
    return game.i18n.localize(`${MODULE_ID}.effects.no_description`);
}

function effectDuration(effect) {
    const duration = effect.duration;
    if (!duration) return "";
    if (duration.label) return duration.label;
    if (Number.isFinite(duration.remaining)) return game.i18n.format(`${MODULE_ID}.effects.remaining`, { value: duration.remaining });
    if (Number.isFinite(duration.rounds)) return game.i18n.format(`${MODULE_ID}.effects.rounds`, { value: duration.rounds });
    return "";
}

export function createPortraitPanel(ARGON) {
    return class L5R5ePortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
        get description() {
            const profile = getProfile(this.actor);
            const school = this.actor.system?.identity?.school;
            const profileLabel = game.i18n.localize(`${MODULE_ID}.profiles.${profile}`);
            return [school, profileLabel].filter(Boolean).join(" · ");
        }

        get isDying() {
            return this.actor.statuses?.has("dying") || this.actor.statuses?.has("unconscious");
        }

        get isDead() {
            return this.actor.statuses?.has("dead");
        }

        async getEffects() {
            const effects = [];
            for (const effect of this.actor.effects) {
                if (effect.disabled || effect.active === false) continue;
                const description = await resolveEffectDescription(effect);
                const duration = effectDuration(effect);
                effects.push({
                    img: effect.img,
                    name: escapeHtml(localized(effect.name)),
                    uuid: effect.uuid,
                    tooltip: [description, duration].filter(Boolean).join("<hr>"),
                });
            }
            return effects;
        }

        async _getButtons() {
            const buttons = (await super._getButtons()).filter((button) => button.id !== "roll-initiative" || this.token);
            if (this.actor.statuses?.has("compromised")) {
                buttons.unshift({
                    id: "unmask",
                    icon: "fas fa-masks-theater",
                    label: game.i18n.localize(`${MODULE_ID}.unmask.label`),
                    onClick: () => performUnmask(this.actor),
                });
            }
            if (game.user.isGM && game.combat?.started) {
                const profile = getProfile(this.actor);
                if (["intrigue", "duel", "mass_battle"].includes(profile)) {
                    buttons.unshift({
                        id: "configure-profile-tracker",
                        icon: "fas fa-list-check",
                        label: game.i18n.localize(`${MODULE_ID}.trackers.configure`),
                        onClick: () => configureProfileTracker(this.actor),
                    });
                }
                buttons.unshift({
                    id: "select-profile",
                    icon: "fas fa-torii-gate",
                    label: game.i18n.localize(`${MODULE_ID}.profiles.select`),
                    onClick: () => this.#selectProfile(),
                });
            }
            return buttons;
        }

        async #selectProfile() {
            const current = getProfile(this.actor);
            const profile = await promptSelect({
                title: game.i18n.localize(`${MODULE_ID}.profiles.select`),
                label: game.i18n.localize(`${MODULE_ID}.profiles.select_hint`),
                value: current,
                choices: PROFILES.filter((entry) => entry !== "universal").map((entry) => ({
                    value: entry,
                    label: game.i18n.localize(`${MODULE_ID}.profiles.${entry}`),
                })),
            });
            if (profile) await setCombatProfile(profile);
        }

        async _renderInner() {
            await super._renderInner();
            const portraitRoot = this.element.matches?.(".portrait-hud")
                ? this.element
                : this.element.querySelector(".portrait-hud");
            if (!portraitRoot) return;

            const gearStrip = element("section", "l5r5e-gear-strip");
            gearStrip.append(await this.#buildWeapon(), await this.#buildArmor());

            const container = element("section", "l5r5e-portrait-panel");
            container.append(
                this.#buildResources(),
                this.#buildSocial(),
                await this.#buildNinjoGiri(),
                this.#buildRings(),
                this.#buildWarnings(),
                this.#buildTarget(),
                this.#buildProfileTracker(),
            );
            portraitRoot.append(gearStrip, container);
            for (const effectElement of portraitRoot.querySelectorAll(".effects-container > *")) {
                effectElement.setAttribute("tabindex", "0");
                effectElement.setAttribute("role", "button");
                effectElement.onfocus = () => effectElement.dispatchEvent(new MouseEvent("mouseenter"));
                effectElement.onblur = () => effectElement.dispatchEvent(new MouseEvent("mouseleave"));
            }
        }

        #buildResources() {
            const section = element("div", "l5r5e-resource-grid");
            const resources = getResourceData(this.actor.system);
            const values = [
                ["fatigue", resources.fatigue.value, resources.fatigue.max, `${MODULE_ID}.resources.fatigue_tooltip`],
                ["strife", resources.strife.value, resources.strife.max, `${MODULE_ID}.resources.strife_tooltip`],
                ["void", resources.void.value, resources.void.max, `${MODULE_ID}.resources.void_tooltip`],
                ["focus", this.actor.system?.focus ?? 0, null, `${MODULE_ID}.resources.focus_tooltip`],
                ["vigilance", this.actor.system?.vigilance ?? 0, null, `${MODULE_ID}.resources.vigilance_tooltip`],
            ];
            for (const [id, value, max, tooltip] of values) {
                const tile = element("div", `l5r5e-resource l5r5e-resource-${id}`);
                tile.dataset.tooltip = game.i18n.localize(tooltip);
                if (max !== null) {
                    tile.setAttribute("role", "progressbar");
                    tile.setAttribute("aria-valuemin", "0");
                    tile.setAttribute("aria-valuenow", String(value));
                    tile.setAttribute("aria-valuemax", String(max));
                }
                tile.append(
                    element("span", "l5r5e-resource-label", game.i18n.localize(`${MODULE_ID}.resources.${id}`)),
                    element("strong", "l5r5e-resource-value", max === null ? value : `${value}/${max}`),
                );
                if (max !== null && max > 0) {
                    const view = getResourceOrbView({ value, max });
                    const orbs = element("span", `l5r5e-resource-orbs l5r5e-resource-orbs-${id}`);
                    orbs.setAttribute("aria-hidden", "true");
                    for (let index = 0; index < view.normalCount; index += 1) {
                        orbs.appendChild(element(
                            "i",
                            `l5r5e-resource-orb ${index < view.normalAvailable ? "available" : "spent"}`,
                        ));
                    }
                    if (view.overflow) {
                        const overflow = element(
                            "i",
                            `l5r5e-resource-orb l5r5e-resource-orb-overflow ${view.overflow.available > 0 ? "available" : "spent"}`,
                            view.overflow.available > 0 ? `+${view.overflow.available}` : "0",
                        );
                        overflow.dataset.tooltip = game.i18n.format(`${MODULE_ID}.resources.overflow_tooltip`, {
                            value: view.overflow.available,
                            max: view.overflow.capacity,
                        });
                        orbs.appendChild(overflow);
                    }
                    tile.appendChild(orbs);
                }
                section.appendChild(tile);
            }
            return section;
        }

        #buildSocial() {
            const section = element("div", "l5r5e-social-values");
            for (const id of ["honor", "glory", "status"]) {
                const value = Number(this.actor.system?.social?.[id] ?? 0);
                const tile = element("div", "l5r5e-social-value");
                tile.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.social.${id}_tooltip`);
                tile.append(
                    element("span", null, game.i18n.localize(`l5r5e.social.${id}`)),
                    element("strong", null, value),
                    element("small", null, game.i18n.format(`${MODULE_ID}.social.rank`, { value: Math.floor(value / 10) })),
                );
                section.appendChild(tile);
            }
            return section;
        }

        async #buildNinjoGiri() {
            const section = element("div", "l5r5e-ninjo-giri");
            for (const id of ["ninjo", "giri"]) {
                const raw = this.actor.system?.social?.[id] ?? "";
                if (!String(raw).trim()) continue;
                const wrapper = element("div", "l5r5e-social-secret");
                const button = element("button", `l5r5e-${id}`);
                button.type = "button";
                button.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.social.${id}_tooltip`);
                const icon = element("i", id === "ninjo" ? "fas fa-heart" : "fas fa-scroll");
                const label = element("span", null, game.i18n.localize(`l5r5e.social.${id}`));
                button.append(icon, label);
                const popover = element("div", "l5r5e-social-popover hidden");
                popover.innerHTML = await enrichText(raw, { relativeTo: this.actor });
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

        #buildRings() {
            const section = element("div", "l5r5e-rings");
            for (const ring of RINGS) {
                const button = element("button", `l5r5e-ring ${this.actor.system?.stance === ring ? "selected" : ""}`);
                button.type = "button";
                button.dataset.ring = ring;
                button.dataset.tooltip = game.i18n.localize(`l5r5e.conflict.stances.${ring}tip`);
                const icon = element("i", `i_${ring}`);
                button.setAttribute("aria-label", game.i18n.localize(`l5r5e.rings.${ring}`));
                button.append(
                    icon,
                    element("strong", "l5r5e-ring-value", this.actor.system?.rings?.[ring] ?? 1),
                    element("small", "l5r5e-ring-name", game.i18n.localize(`l5r5e.rings.${ring}`)),
                );
                button.addEventListener("click", async () => {
                    if (this.actor.system?.stance === ring) return;
                    await this.actor.update({ "system.stance": ring });
                });
                section.appendChild(button);
            }
            return section;
        }

        #buildWarnings() {
            const warnings = getWarningIds(this.actor.system, this.actor.statuses);
            const section = element("div", `l5r5e-warnings ${warnings.length ? "" : "hidden"}`);
            for (const warning of warnings) {
                const badge = element("span", `l5r5e-warning l5r5e-warning-${warning}`, game.i18n.localize(`${MODULE_ID}.warnings.${warning}`));
                badge.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.warnings.${warning}_tooltip`);
                section.appendChild(badge);
            }
            return section;
        }

        async #buildItemPopover(item, details = []) {
            const popover = element("aside", "l5r5e-card-popover");
            popover.setAttribute("role", "tooltip");
            if (!item) return popover;
            popover.appendChild(element("h3", null, item.name));
            if (details.length) {
                const list = element("dl", "l5r5e-card-popover-stats");
                for (const [label, value] of details) {
                    list.append(element("dt", null, label), element("dd", null, value));
                }
                popover.appendChild(list);
            }
            const description = element("div", "l5r5e-card-popover-description");
            description.innerHTML = await enrichText(item.system?.description, { relativeTo: item });
            popover.appendChild(description);
            const properties = (item.system?.properties ?? [])
                .map((property) => (typeof property === "string" ? property : property?.name ?? property?.id))
                .filter(Boolean);
            if (properties.length) popover.appendChild(element("p", "l5r5e-card-popover-properties", properties.join(" · ")));
            return popover;
        }

        async #buildWeapon() {
            const { profile, item } = getActiveWeaponProfile(this.actor);
            const section = element("div", `l5r5e-weapon-summary ${profile ? "" : "hidden"}`);
            if (!profile) return section;
            const range = profileRange(profile);
            const card = element("button", `l5r5e-weapon-card ${profile.virtual ? "unarmed" : ""}`);
            card.type = "button";
            card.setAttribute("aria-label", item?.name ?? game.i18n.localize(profile.labelKey));
            card.dataset.tooltip = game.i18n.localize(`${MODULE_ID}.equipment.active_weapon_tooltip`);
            const image = element("img");
            image.src = item?.img ?? "systems/l5r5e/assets/icons/weapons/unarmed.svg";
            image.alt = item?.name ?? game.i18n.localize(profile.labelKey);
            const details = element("div", "l5r5e-weapon-details");
            details.append(
                element("strong", null, item?.name ?? game.i18n.localize(profile.labelKey)),
                element("span", "l5r5e-weapon-grip", game.i18n.format(`${MODULE_ID}.equipment.grip_value`, {
                    value: profile.grip ?? "unarmed",
                })),
            );
            const stats = element("div", "l5r5e-weapon-stats");
            stats.append(
                element("span", null, game.i18n.format(`${MODULE_ID}.equipment.damage_value`, { value: profile.damage ?? 0 })),
                element("span", null, game.i18n.format(`${MODULE_ID}.equipment.deadliness_value`, { value: profile.deadliness ?? 0 })),
                element("span", null, game.i18n.format(`${MODULE_ID}.equipment.range_value`, {
                    minimum: range.minimum,
                    maximum: range.maximum,
                })),
            );
            details.appendChild(stats);
            const properties = (item?.system?.properties ?? [])
                .map((property) => (typeof property === "string" ? property : property?.name ?? property?.id))
                .filter(Boolean)
                .join(" · ");
            if (properties) details.appendChild(element("small", "l5r5e-weapon-properties", properties));
            card.append(image, details);
            card.addEventListener("click", () => item?.sheet?.render({ force: true }));
            card.addEventListener("mouseenter", () => {
                const api = tacticalGridApi();
                if (!api?.rangeHighlight || !this.token || !canvas?.dimensions?.distance) return;
                const unit = Number(canvas.dimensions.distance) * Number(game.l5r5e?.rangeBands?.fieldsPerBand ?? 3);
                const ranges = [];
                if (range.minimum > 0) ranges.push({
                    range: range.minimum * unit,
                    shaded: true,
                    shadeColor: "#5f1b1b",
                    shadeAlpha: 0.24,
                });
                ranges.push({ range: range.maximum * unit, lineColor: "#b59052", lineWidth: 2 });
                api.rangeHighlight(this.token, { ranges });
            });
            card.addEventListener("mouseleave", () => tacticalGridApi()?.clearRangeHighlight?.(this.token));
            section.appendChild(element("h4", null, game.i18n.localize(`${MODULE_ID}.equipment.active_weapon`)));
            section.appendChild(card);
            section.appendChild(await this.#buildItemPopover(item, [
                [game.i18n.localize(`${MODULE_ID}.equipment.current_grip`), profile.grip ?? "unarmed"],
                [game.i18n.localize("l5r5e.weapons.range"), `${range.minimum}–${range.maximum}`],
                [game.i18n.localize("l5r5e.weapons.damage"), profile.damage ?? 0],
                [game.i18n.localize("l5r5e.weapons.deadliness"), profile.deadliness ?? 0],
            ]));
            return section;
        }

        async #buildArmor() {
            const armors = getEquippedArmor(this.actor);
            const armor = armors[0] ?? null;
            const section = element("div", `l5r5e-armor-summary ${armor ? "" : "empty"}`);
            const row = element("button", "l5r5e-armor-row");
            row.type = "button";
            row.disabled = !armor;
            row.dataset.tooltip = armor
                ? game.i18n.localize(`${MODULE_ID}.equipment.open_sheet`)
                : game.i18n.localize(`${MODULE_ID}.equipment.no_armor`);
            const image = element("img");
            image.src = armor?.img ?? "systems/l5r5e/assets/icons/items/armor.svg";
            image.alt = armor?.name ?? game.i18n.localize(`${MODULE_ID}.equipment.no_armor`);
            const details = element("span", "l5r5e-armor-details");
            details.appendChild(element(
                "strong",
                "l5r5e-armor-name",
                armor?.name ?? game.i18n.localize(`${MODULE_ID}.equipment.no_armor`),
            ));
            if (armor) {
                const resistance = game.l5r5e?.qualities?.armorResistance?.(armor) ?? {
                    physical: armor.system?.armor?.physical ?? 0,
                    supernatural: armor.system?.armor?.supernatural ?? 0,
                };
                const physical = element("span", "l5r5e-resistance physical");
                physical.dataset.tooltip = game.i18n.localize("l5r5e.armors.physical");
                physical.append(element("i", "fas fa-shield-halved"), document.createTextNode(` ${resistance.physical}`));
                const supernatural = element("span", "l5r5e-resistance supernatural");
                supernatural.dataset.tooltip = game.i18n.localize("l5r5e.armors.supernatural");
                supernatural.append(element("i", "fas fa-sparkles"), document.createTextNode(` ${resistance.supernatural}`));
                const properties = (armor.system?.properties ?? [])
                    .map((property) => (typeof property === "string" ? property : property?.name ?? property?.id))
                    .filter(Boolean)
                    .join(", ");
                details.append(physical, supernatural);
                if (properties) details.appendChild(element("small", "l5r5e-armor-properties", properties));
                row.addEventListener("click", () => armor.sheet.render(true));
            }
            row.append(image, details);
            section.append(
                element("h4", null, game.i18n.localize(`${MODULE_ID}.equipment.active_armor`)),
                row,
            );
            if (armor) {
                const resistance = game.l5r5e?.qualities?.armorResistance?.(armor) ?? {
                    physical: armor.system?.armor?.physical ?? 0,
                    supernatural: armor.system?.armor?.supernatural ?? 0,
                };
                section.appendChild(await this.#buildItemPopover(armor, [
                    [game.i18n.localize("l5r5e.armors.physical"), resistance.physical],
                    [game.i18n.localize("l5r5e.armors.supernatural"), resistance.supernatural],
                ]));
            }
            return section;
        }

        #buildTarget() {
            const targetToken = getTargetToken();
            const data = getKnownTargetData(targetToken);
            const section = element("div", `l5r5e-target ${data ? "" : "hidden"}`);
            if (!data) return section;
            const image = element("img");
            image.src = data.image;
            image.alt = data.name;
            const info = element("div", "l5r5e-target-info");
            const rangeBand = getTargetRangeBand(this.token, targetToken);
            const activeWeapon = getWeapons(this.actor, { readiedOnly: true })[0];
            info.append(
                element("strong", null, data.name),
                element(
                    "span",
                    null,
                    game.i18n.format(`${MODULE_ID}.target.range`, {
                        value: rangeBand ?? "—",
                    }),
                ),
                element("span", null, game.i18n.format(`${MODULE_ID}.target.tn`, { value: data.tn ?? "?" })),
            );
            if (data.stance) info.appendChild(element("span", null, game.i18n.format(`${MODULE_ID}.target.stance`, { value: localized(`l5r5e.rings.${data.stance}`) })));
            if (data.statuses.length) {
                const statuses = data.statuses
                    .map((id) => CONFIG.l5r5e.conditions.find((condition) => condition.id === id)?.name ?? id)
                    .map(localized)
                    .join(", ");
                info.appendChild(element("span", null, game.i18n.format(`${MODULE_ID}.target.conditions`, { value: statuses })));
            }
            const inRange = activeWeapon ? weaponCoversRange(activeWeapon.system?.range, rangeBand) : null;
            if (inRange !== null) {
                info.appendChild(
                    element(
                        "span",
                        `l5r5e-target-range-${inRange ? "valid" : "invalid"}`,
                        game.i18n.format(`${MODULE_ID}.target.weapon_in_range`, {
                            value: game.i18n.localize(`${MODULE_ID}.common.${inRange ? "yes" : "no"}`),
                        }),
                    ),
                );
            }
            section.append(image, info);
            return section;
        }

        #buildProfileTracker() {
            const profile = getProfile(this.actor);
            const tracker = getProfileTrackerData(this.actor, profile);
            const section = element("div", `l5r5e-profile-tracker ${tracker ? "" : "hidden"}`);
            if (!tracker) return section;
            section.appendChild(element("h4", null, game.i18n.localize(tracker.title)));
            const list = element("dl");
            for (const entry of tracker.details) {
                list.append(
                    element("dt", null, game.i18n.localize(entry.label)),
                    element("dd", null, entry.value),
                );
            }
            section.appendChild(list);
            if (tracker.selectionRequired) section.appendChild(element("small", "l5r5e-warning", game.i18n.localize(`${MODULE_ID}.trackers.selection_required`)));
            return section;
        }
    };
}
