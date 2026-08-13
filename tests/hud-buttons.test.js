import assert from "node:assert/strict";
import test from "node:test";

import { bindHudPointerActivation, installHudButtonIcon } from "../scripts/hud-buttons.js";

function node(className = "") {
    const attributes = new Map();
    const children = [];
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    const result = {
        attributes,
        children,
        className,
        classList: {
            add: (...names) => names.forEach((name) => classes.add(name)),
            contains: (name) => classes.has(name),
        },
        firstChild: null,
        ownerDocument: null,
        querySelector(selector) {
            const wanted = selector.startsWith(".") ? selector.slice(1) : selector;
            return children.find((child) => child.className.split(/\s+/).includes(wanted)) ?? null;
        },
        insertBefore(child, before) {
            const index = before ? children.indexOf(before) : -1;
            if (index >= 0) children.splice(index, 0, child);
            else children.push(child);
            this.firstChild = children[0] ?? null;
        },
        setAttribute: (name, value) => attributes.set(name, value),
        style: {
            values: new Map(),
            setProperty(name, value, priority) {
                this.values.set(name, { value, priority });
            },
        },
    };
    result.ownerDocument = { createElement: () => node() };
    return result;
}

test("explicit HUD icons are inserted before labels and reused on refresh", () => {
    const element = node("action-element");
    const title = node("action-element-title");
    element.insertBefore(title, null);

    const icon = installHudButtonIcon(element, "icons/strike.svg", "l5r5e-action-icon");
    assert.equal(element.children[0], icon);
    assert.equal(element.children[1], title);
    assert.equal(icon.src, "icons/strike.svg");
    assert.equal(icon.attributes.get("aria-hidden"), "true");
    assert.equal(element.classList.contains("l5r5e-explicit-icon"), true);
    assert.deepEqual(element.style.values.get("background-image"), { value: "none", priority: "important" });

    const refreshed = installHudButtonIcon(element, "icons/new-strike.svg", "l5r5e-action-icon");
    assert.equal(refreshed, icon);
    assert.equal(element.children.length, 2);
    assert.equal(icon.src, "icons/new-strike.svg");
});

test("palette pointer activation routes primary and secondary mouse buttons exactly once", () => {
    const element = node();
    const calls = [];
    bindHudPointerActivation(element, {
        onLeft: () => calls.push("left"),
        onRight: () => calls.push("right"),
    });
    const event = (button) => ({
        button,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
    });

    const left = event(0);
    element.onmouseup(left);
    const right = event(2);
    element.onmouseup(right);
    element.onmouseup(event(1));

    assert.deepEqual(calls, ["left", "right"]);
    assert.equal(left.prevented && left.stopped, true);
    assert.equal(right.prevented && right.stopped, true);
});
