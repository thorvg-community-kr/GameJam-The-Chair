import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from './support/load.mjs';

const { createGame } = await load('src/game/game.ts');
const { createHud } = await load('src/ui/hud.ts');
const { createFeedback } = await load('src/ui/feedback.ts');
const { createEffects } = await load('src/render/effects.ts');

test('pause menu shows unlocked stages and the play HUD hides during cutscenes', () => {
    const originalMatchMedia = globalThis.matchMedia;
    /** @type {any} */ (globalThis).matchMedia = () => ({ matches: false });
    try {
        const elements = new Map(
            [
                '[data-stage-menu]',
                '[data-play-hud]',
                '[data-stage="1"]',
                '[data-stage="2"]',
                '[data-stage="3"]',
            ].map((selector) => [
                selector,
                {
                    hidden: false,
                    classList: { toggle() {} },
                    toggleAttribute() {},
                },
            ]),
        );
        const hud = createHud({
            querySelector: (selector) => elements.get(selector) ?? null,
        });
        const effects = createEffects().snapshot();
        const feedback = createFeedback().snapshot();
        const fresh = createGame();
        fresh.reset();
        hud.draw(fresh.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-stage-menu]').hidden, true);
        assert.equal(elements.get('[data-play-hud]').hidden, false);
        hud.draw(fresh.getSnapshot(), feedback, effects, true);
        assert.equal(elements.get('[data-play-hud]').hidden, true);
        hud.draw(fresh.getSnapshot(), feedback, effects, false);
        assert.equal(elements.get('[data-play-hud]').hidden, false);

        const continued = createGame({ progress: { completedStage: 1 } });
        continued.startStage(2);
        hud.draw(continued.getSnapshot(), feedback, effects);
        assert.equal(elements.get('[data-stage-menu]').hidden, false);
        assert.equal(elements.get('[data-stage="1"]').hidden, false);
        assert.equal(elements.get('[data-stage="2"]').hidden, false);
        assert.equal(elements.get('[data-stage="3"]').hidden, true);
    } finally {
        if (originalMatchMedia === undefined) {
            delete globalThis.matchMedia;
        } else /** @type {any} */ {
            globalThis.matchMedia = originalMatchMedia;
        }
    }
});
