// actions.js

/* -------------------------------------------------------------
 * List of available skirmish actions in L5R5e
 * ------------------------------------------------------------- */
export function getSkirmishActions() {
    return [
        { id: "calming-breath", label: "Calming Breath" },
        { id: "challenge", label: "Challenge" },
        { id: "guard", label: "Guard" },
        { id: "maneuver", label: "Maneuver" },
        { id: "strike", label: "Strike" },
        { id: "wait", label: "Wait" }
    ];
}

/* -------------------------------------------------------------
 * Execute a skirmish action
 * (You can later expand this with automation)
 * ------------------------------------------------------------- */
export function executeAction(actor, actionId) {
    const action = getSkirmishActions().find(a => a.id === actionId);
    const label = action?.label ?? actionId;

    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>${actor.name}</strong> performs <em>${label}</em>.`
    });
}