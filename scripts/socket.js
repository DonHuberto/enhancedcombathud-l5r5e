import { MODULE_ID } from "./config.js";

const CHANNEL = `module.${MODULE_ID}`;

export function isPrimaryGM() {
    const activeGms = game.users.filter((user) => user.active && user.isGM);
    return game.user.isGM && activeGms[0]?.id === game.user.id;
}

function userOwnsActor(userId, actorId) {
    const user = game.users.get(userId);
    const actor = game.actors.get(actorId);
    return !!user && !!actor && actor.testUserPermission(user, "OWNER");
}

async function handleRequest(request) {
    if (!isPrimaryGM()) return;
    const combat = game.combats.get(request.combatId);
    if (!combat || !userOwnsActor(request.userId, request.actorId)) return;
    const duel = foundry.utils.deepClone(combat.getFlag(MODULE_ID, "duel") ?? {});

    if (request.type === "clearFinishingBlow") {
        duel.finishingBlowActors = (duel.finishingBlowActors ?? []).filter((id) => id !== request.actorId);
        await combat.setFlag(MODULE_ID, "duel", duel);
    }

    if (request.type === "concede") {
        duel.concededActors = Array.from(new Set([...(duel.concededActors ?? []), request.actorId]));
        await combat.setFlag(MODULE_ID, "duel", duel);
    }

    if (request.type === "hiddenPersuade") {
        const user = game.users.get(request.userId);
        const actor = game.actors.get(request.actorId);
        const scene = game.scenes.get(request.sceneId);
        const targets = (request.targetTokenIds ?? []).map((id) => scene?.tokens?.get(id)).filter(Boolean);
        const difficulties = targets.map((token) => Number(token.actor?.system?.vigilance)).filter(Number.isFinite);
        const difficulty = difficulties.length ? Math.max(...difficulties) : 2;
        game.l5r5e.sockets.openDicePicker({
            users: [user],
            actors: [actor],
            dpOptions: {
                skillsList: "social",
                difficulty,
                difficultyHidden: true,
                actions: { scheme: true },
            },
        });
    }
}

export function requestGm(type, actor, data = {}) {
    const combat = game.combat;
    if (!combat || !actor || !game.users.some((user) => user.active && user.isGM)) return false;
    game.socket.emit(CHANNEL, {
        type,
        combatId: combat.id,
        actorId: actor.id,
        userId: game.user.id,
        ...data,
    });
    return true;
}

export function registerSocket() {
    game.socket.on(CHANNEL, handleRequest);
}
