import assert from "node:assert/strict";
import test from "node:test";

import { getPersuadeOptions } from "../scripts/rolls.js";
import { escapeHtml } from "../scripts/utils.js";

test("hidden Persuade targets are delegated without reading their Vigilance client-side", () => {
    const hiddenActor = {
        testUserPermission: () => false,
        system: {
            get vigilance() {
                throw new Error("hidden Vigilance was read");
            },
        },
    };
    const targetDocument = { id: "hidden-token", actor: hiddenActor };
    globalThis.game = {
        user: {
            isGM: false,
            targets: new Set([{ document: targetDocument }]),
        },
    };
    globalThis.canvas = { scene: { id: "scene-id" } };

    const options = getPersuadeOptions({ id: "actor-id" });
    assert.equal(options.remoteRequired, true);
    assert.equal(options.difficultyHidden, true);
    assert.equal(options.difficulty, 2);
    assert.deepEqual(options.targetTokenIds, ["hidden-token"]);
});

test("HTML originating in document labels is escaped before Argon triple-brace templates", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});
