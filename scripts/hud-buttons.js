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
    element.onmouseup = null;
    element.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        return onLeft?.(event);
    };
    element.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        return onRight?.(event);
    };
}

export function installDelayedHudTooltip(component, delay = 3000) {
    const element = component?.element;
    if (!element) return;

    const previous = element._l5r5eTooltipHandlers;
    if (previous) {
        element.removeEventListener("mouseenter", previous.enter);
        element.removeEventListener("mouseleave", previous.leave);
    }

    let timer = null;
    const enter = (event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            if (element.matches(":hover")) component._onTooltipMouseEnter(event);
        }, delay);
    };
    const leave = (event) => {
        clearTimeout(timer);
        timer = null;
        component._onTooltipMouseLeave(event);
    };
    element.addEventListener("mouseenter", enter);
    element.addEventListener("mouseleave", leave);
    element._l5r5eTooltipHandlers = { enter, leave };
}
