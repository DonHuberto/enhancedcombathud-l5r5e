import { MODULE_ID } from "./config.js";

const PATCH_MARKER = Symbol.for(`${MODULE_ID}.assistDicePickerPatched`);

export function assistDiceCount(pendingAssist) {
    const count = Number(pendingAssist?.bonusKeptDice);
    return Number.isFinite(count) ? Math.max(0, Math.min(9, Math.floor(count))) : 0;
}

export function createPendingAssistMutation(actor, targetActor, targetToken) {
    const current = targetActor.getFlag?.(MODULE_ID, "pendingAssist");
    const pendingAssist = {
        bonusKeptDice: Math.max(0, Number(current?.bonusKeptDice) || 0) + 1,
        targetTokenUuid: targetToken.uuid,
        createdBy: actor.uuid,
    };
    return {
        pendingAssist,
        mutation: {
            documentUuid: targetActor.uuid,
            path: `flags.${MODULE_ID}.pendingAssist`,
            // Missing Foundry flags read as undefined; preserve that exact value
            // so the transaction service does not report a false apply conflict.
            before: current,
            after: pendingAssist,
            reason: "assist",
        },
    };
}

export function registerAssistDicePicker() {
    const prototype = game.l5r5e?.DicePickerDialog?.prototype;
    const original = prototype?._updateObject;
    if (typeof original !== "function" || prototype[PATCH_MARKER]) return false;

    Object.defineProperty(prototype, PATCH_MARKER, { value: true });
    prototype._updateObject = async function (...args) {
        const actor = this._actor;
        const pendingAssist = actor?.getFlag?.(MODULE_ID, "pendingAssist");
        const bonusDice = assistDiceCount(pendingAssist);
        if (!bonusDice) return original.apply(this, args);

        const useAssist = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize(`${MODULE_ID}.actions.assist.label`) },
            content: `<p>${game.i18n.format(`${MODULE_ID}.actions.assist.use_prompt`, { dice: bonusDice })}</p>`,
            defaultYes: false,
        });

        // The target can decline the assistance. Declining consumes it, while
        // cancelling or failing to create a roll leaves it available to retry.
        if (!useAssist) {
            await actor.unsetFlag(MODULE_ID, "pendingAssist");
            return original.apply(this, args);
        }

        const priorSkillDice = Number(this.object?.skill?.value) || 0;
        const priorAssistance = Number(this.object?.skill?.assistance) || 0;
        this._quantityChange("skill", bonusDice);
        this.object.skill.assistance = Math.min(9, priorAssistance + bonusDice);
        try {
            const result = await original.apply(this, args);
            if (this._rollTransferred) {
                await actor.unsetFlag(MODULE_ID, "pendingAssist");
            } else {
                this.object.skill.value = priorSkillDice;
                this.object.skill.assistance = priorAssistance;
            }
            return result;
        } catch (error) {
            this.object.skill.value = priorSkillDice;
            this.object.skill.assistance = priorAssistance;
            throw error;
        }
    };
    return true;
}
