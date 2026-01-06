// techniques.js

/* -------------------------------------------------------------
 * Extract all techniques known by the actor
 * ------------------------------------------------------------- */
export function getTechniques(actor) {
    return actor.items.filter(item =>
        item.type === "technique"
    );
}

/* -------------------------------------------------------------
 * Use a technique (basic chat-card style)
 * ------------------------------------------------------------- */
export function useTechnique(actor, techniqueId) {
    const technique = actor.items.get(techniqueId);
    if (!technique) return;

    const name = technique.name;
    const description = technique.system?.description ?? "";

    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
            <div class="l5r-technique-card">
                <h2>${name}</h2>
                <div>${description}</div>
            </div>
        `
    });
}