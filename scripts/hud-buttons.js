export function installHudButtonIcon(element, source, className) {
    if (!element || !source || !className) return null;

    let icon = element.querySelector(`.${className}`);
    if (!icon) {
        icon = element.ownerDocument.createElement("img");
        icon.className = className;
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        const title = element.querySelector(".action-element-title")
            ?? element.querySelector(".feature-element-title");
        element.insertBefore(icon, title ?? element.firstChild);
    }
    icon.src = source;
    element.classList.add("l5r5e-explicit-icon");
    element.style.setProperty("background-image", "none", "important");
    return icon;
}

export function bindHudPointerActivation(element, { onLeft, onRight } = {}) {
    element.onmouseup = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 0) return onLeft?.(event);
        if (event.button === 2) return onRight?.(event);
        return undefined;
    };
    element.oncontextmenu = (event) => event.preventDefault();
}
