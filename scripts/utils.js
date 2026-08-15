import { MODULE_ID, localize } from "./config.js";

const inFlightActions = new Set();

export function canUpdate(document) {
    return !!document?.isOwner || !!game.user?.isGM;
}

export function openDocumentPreview(document) {
    const preview = game.l5r5e?.HelpersL5r5e?.openDocumentPreview;
    if (typeof preview === "function") return preview.call(game.l5r5e.HelpersL5r5e, document);
    return document?.sheet?.render({ force: true, editable: false });
}

export function getTargetToken() {
    return Array.from(game.user?.targets ?? [])[0]?.document ?? null;
}

export function getKnownTargetData(targetToken) {
    if (!targetToken) return null;
    const actor = targetToken.actor;
    const observer = !!game.user?.isGM || !!actor?.testUserPermission?.(game.user, "OBSERVER");
    const visible = game.user?.isGM || targetToken.object?.visible !== false;
    if (!visible) return null;

    return {
        name: observer ? targetToken.name : localize(`${MODULE_ID}.target.unknown`),
        image: observer ? actor?.img ?? targetToken.texture?.src : "icons/svg/mystery-man.svg",
        stance: observer ? actor?.system?.stance : null,
        tn: game.user?.isGM ? actor?.system?.vigilance ?? null : null,
        statuses: Array.from(actor?.statuses ?? []).filter((id) => isPublicStatus(id)),
        observer,
    };
}

export function isPublicStatus(statusId) {
    return (CONFIG.l5r5e?.conditions ?? []).some((condition) => condition.id === statusId);
}

export async function enrichText(content, { relativeTo = null } = {}) {
    const text = String(content ?? "").trim();
    if (!text) return `<span class="l5r5e-empty">${localize(`${MODULE_ID}.common.empty`)}</span>`;
    return foundry.applications.ux.TextEditor.implementation.enrichHTML(text, {
        async: true,
        relativeTo,
        secrets: !!game.user?.isGM,
    });
}

export function stripHtml(content) {
    const element = document.createElement("div");
    element.innerHTML = String(content ?? "");
    return element.textContent?.trim() ?? "";
}

export function escapeHtml(content) {
    return String(content ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function createChatCard({ actor, title, body = "", details = [] }) {
    const card = document.createElement("section");
    card.className = "l5r5e argon-l5r5e-chat-card";

    const heading = document.createElement("h3");
    heading.textContent = title;
    card.appendChild(heading);

    if (body) {
        const paragraph = document.createElement("p");
        paragraph.textContent = body;
        card.appendChild(paragraph);
    }

    if (details.length) {
        const list = document.createElement("dl");
        for (const detail of details) {
            const term = document.createElement("dt");
            term.textContent = detail.label;
            const value = document.createElement("dd");
            value.textContent = String(detail.value ?? "—");
            list.append(term, value);
        }
        card.appendChild(list);
    }

    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: card.outerHTML,
    });
}

export async function confirmAction({ title, content }) {
    return foundry.applications.api.DialogV2.confirm({
        window: { title },
        content,
        defaultYes: false,
    });
}

export async function promptText({ title, label, value = "", hint = "" }) {
    const inputId = `${MODULE_ID}-${foundry.utils.randomID()}`;
    const wrapper = document.createElement("div");
    wrapper.className = "standard-form";

    const group = document.createElement("div");
    group.className = "form-group";
    const labelElement = document.createElement("label");
    labelElement.htmlFor = inputId;
    labelElement.textContent = label;
    const textarea = document.createElement("textarea");
    textarea.id = inputId;
    textarea.name = "value";
    textarea.value = value;
    textarea.rows = 4;
    group.append(labelElement, textarea);
    if (hint) {
        const hintElement = document.createElement("p");
        hintElement.className = "hint";
        hintElement.textContent = hint;
        group.appendChild(hintElement);
    }
    wrapper.appendChild(group);

    return foundry.applications.api.DialogV2.prompt({
        window: { title },
        content: wrapper.outerHTML,
        ok: {
            label: localize(`${MODULE_ID}.common.confirm`),
            callback: (_event, button) => button.form?.elements?.value?.value?.trim() ?? "",
        },
        rejectClose: false,
    });
}

export async function promptSelect({ title, label, choices, value = "" }) {
    const inputId = `${MODULE_ID}-${foundry.utils.randomID()}`;
    const wrapper = document.createElement("div");
    wrapper.className = "standard-form";
    const group = document.createElement("div");
    group.className = "form-group";
    const labelElement = document.createElement("label");
    labelElement.htmlFor = inputId;
    labelElement.textContent = label;
    const select = document.createElement("select");
    select.id = inputId;
    select.name = "value";
    for (const choice of choices) {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        option.selected = choice.value === value;
        select.appendChild(option);
    }
    group.append(labelElement, select);
    wrapper.appendChild(group);

    return foundry.applications.api.DialogV2.prompt({
        window: { title },
        content: wrapper.outerHTML,
        ok: {
            label: localize(`${MODULE_ID}.common.confirm`),
            callback: (_event, button) => button.form?.elements?.value?.value ?? null,
        },
        rejectClose: false,
    });
}

export async function withActionLock(key, callback) {
    if (inFlightActions.has(key)) return null;
    inFlightActions.add(key);
    try {
        return await callback();
    } finally {
        inFlightActions.delete(key);
    }
}

export function notify(key, type = "info", data) {
    const message = data ? game.i18n.format(key, data) : game.i18n.localize(key);
    ui.notifications[type](message);
}

export function getPropertyNames(item) {
    return (item?.system?.properties ?? [])
        .map((property) => (typeof property === "string" ? property : property?.name ?? property?.id))
        .filter(Boolean);
}

export function getSourceLabel(item) {
    const source = item?.system?.source_reference;
    if (!source?.source && !source?.page) return "";
    const sourceConfig = CONFIG.l5r5e?.sourceReference?.[source.source];
    const sourceName = sourceConfig?.label ? game.i18n.localize(sourceConfig.label) : source.source;
    return escapeHtml([sourceName, source.page ? `p. ${source.page}` : ""].filter(Boolean).join(" "));
}

export function getRangeBandFromDistance(distance) {
    if (!Number.isFinite(distance)) return null;
    let settings;
    try {
        settings = game.settings.get("l5r5e", "tactical-grid-settings-world");
    } catch (_error) {
        return null;
    }
    if (!settings?.enabled || !settings.ranges) return null;
    const entries = Object.entries(settings.ranges).sort(([a], [b]) => Number(b) - Number(a));
    for (const [range, data] of entries) {
        if (distance >= Number(data.start)) return Number(range);
    }
    return null;
}

export function getTargetRangeBand(sourceToken, targetToken) {
    if (!sourceToken?.center || !targetToken?.object?.center || !canvas?.grid) return null;
    try {
        const measurement = canvas.grid.measurePath([sourceToken.center, targetToken.object.center]);
        const diagonalCost = Number(canvas.grid.distance ?? 0) * Number(measurement?.diagonals ?? 0);
        return getRangeBandFromDistance(Number(measurement?.distance) + diagonalCost);
    } catch (_error) {
        return null;
    }
}
