import { MODULE_ID } from "../config.js";
import { getProfile, setCombatContext } from "../state.js";
import { getMassBattleCandidates } from "./tracker.js";
import { promptSelect, promptText } from "../utils.js";

async function configureIntrigue() {
    const current = game.combat.getFlag(MODULE_ID, "intrigue") ?? {};
    const objective = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.objective`),
        value: current.objectiveType,
        choices: ["appeal", "discern", "discredit", "rumor", "custom"].map((value) => ({
            value,
            label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.objectives.${value}`),
        })),
    });
    if (!objective) return;
    const target = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.target`),
        value: current.target ?? "",
    });
    if (target === null) return;
    const difficulty = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.difficulty`),
        value: String(current.difficulty ?? 2),
        choices: Array.from({ length: 9 }, (_unused, index) => {
            const value = index + 1;
            return { value: String(value), label: String(value) };
        }),
    });
    if (difficulty === null) return;
    const hidden = await promptSelect({
        title: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.hidden_tn`),
        value: current.hiddenTn ? "yes" : "no",
        choices: [
            { value: "no", label: game.i18n.localize(`${MODULE_ID}.common.no`) },
            { value: "yes", label: game.i18n.localize(`${MODULE_ID}.common.yes`) },
        ],
    });
    if (hidden === null) return;
    return setCombatContext("intrigue", {
        ...current,
        objectiveType: objective,
        objective: game.i18n.localize(`${MODULE_ID}.trackers.intrigue.objectives.${objective}`),
        target,
        // Combat flags are visible to clients. Never persist a secret TN there;
        // the primary GM derives it from the targeted actors when the roll opens.
        difficulty: hidden === "yes" ? null : Number(difficulty),
        hiddenTn: hidden === "yes",
        momentum: Number(current.momentum ?? 0),
    });
}

async function configureDuel(actor) {
    const current = game.combat.getFlag(MODULE_ID, "duel") ?? {};
    const conditions = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.trackers.duel.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.duel.conditions`),
        value: current.conditions ?? "",
    });
    if (conditions === null) return;
    const allowedWeapons = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.trackers.duel.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.duel.allowed_weapons`),
        value: current.allowedWeapons ?? "",
    });
    if (allowedWeapons === null) return;
    const target = Array.from(game.user.targets ?? [])[0]?.actor;
    return setCombatContext("duel", {
        ...current,
        conditions,
        allowedWeapons,
        targetActorId: target?.id ?? current.targetActorId ?? null,
        participantActorIds: Array.from(
            new Set([actor.id, target?.id ?? current.targetActorId].filter(Boolean)),
        ),
    });
}

async function configureMassBattle(actor) {
    const current = game.combat.getFlag(MODULE_ID, "massBattle") ?? {};
    const { armies, cohorts } = getMassBattleCandidates(actor);
    let armyId = current.armyId;
    if (armies.length) {
        armyId = await promptSelect({
            title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.configure`),
            label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.army`),
            value: armyId,
            choices: armies.map((army) => ({ value: army.id, label: army.name })),
        });
    }
    let cohortId = current.cohortId;
    if (cohorts.length) {
        cohortId = await promptSelect({
            title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.configure`),
            label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.cohort`),
            value: cohortId,
            choices: cohorts.map(({ item, army }) => ({ value: item.id, label: `${item.name} — ${army.name}` })),
        });
    }
    const objective = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.objective`),
        value: current.objective ?? "",
    });
    if (objective === null) return;
    const position = await promptText({
        title: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.configure`),
        label: game.i18n.localize(`${MODULE_ID}.trackers.mass_battle.position`),
        value: current.position ?? "",
    });
    if (position === null) return;
    return setCombatContext("massBattle", {
        ...current,
        armyId,
        cohortId,
        objective,
        position,
        momentum: Number(current.momentum ?? 0),
    });
}

export async function configureProfileTracker(actor) {
    if (!game.user.isGM || !game.combat?.started) return false;
    const profile = getProfile(actor);
    if (profile === "intrigue") return configureIntrigue();
    if (profile === "duel") return configureDuel(actor);
    if (profile === "mass_battle") return configureMassBattle(actor);
    return false;
}
