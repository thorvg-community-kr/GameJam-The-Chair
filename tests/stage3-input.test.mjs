import assert from 'node:assert/strict';
import test from 'node:test';

import { installInputEnvironment } from './support/input.mjs';
import { bundled } from './support/load.mjs';
import { driveStageThree } from './support/stage3-route.mjs';
const { createGame, bindInput } = await bundled({
    stdin: {
        contents: `export { createGame } from './src/game/game'; export { bindInput } from './src/ui/input';`,
        resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
});
test('Space holds spray in stage three, releases on keyup/blur', async (t) => {
    const { window, key } = installInputEnvironment(t);
    const { settle, advance, game, unbind } = verifyDetails();
    try {
        settle();
        key('keydown', ' ', 'Space');
        advance();
        assert.equal(
            game.drainEvents().filter((e) => e.id === 'spray').length,
            3,
        );
        key('keyup', ' ', 'Space');
        advance();
        assert.equal(game.getSnapshot().spray.burst, 0);
        settle();
        key('keydown', 'f');
        advance();
        assert.equal(
            game.drainEvents().filter((e) => e.id === 'spray').length,
            0,
            'F no longer sprays',
        );
        key('keydown', ' ');
        window.dispatchEvent(new Event('blur'));
        advance();
        assert.equal(
            game.drainEvents().filter((e) => e.id === 'spray').length,
            0,
        );
        settle();
        key('keydown', 'ArrowUp');
        game.step(1 / 120);
        assert.ok(game.getSnapshot().player.vy < -300);
        game.startStage(1);
        for (let i = 0; i < 20; i++) {
            game.step(1 / 120);
        }
        key('keydown', ' ', 'Space');
        game.step(1 / 120);
        assert.ok(
            game.getSnapshot().player.vy > -300,
            'Space no longer jumps in the office',
        );
        for (let i = 0; i < 20; i++) {
            game.step(1 / 120);
        }
        key('keydown', 'ArrowUp');
        game.step(1 / 120);
        assert.ok(
            game.getSnapshot().player.vy < -300,
            'Up jumps in the office',
        );
        await Promise.resolve();
    } finally {
        unbind();
    }
});
function verifyDetails() {
    const game = createGame();
    game.startStage(3);
    driveStageThree(game, (state) => state.hasExtinguisher);
    const root = {
        isConnected: true,
        querySelector: () => null,
        querySelectorAll: () => [],
    };
    const unbind = bindInput(root, game);
    const settle = () => {
        game.restart();
        for (let i = 0; i < 20; i++) {
            game.step(1 / 120);
        }
        game.drainEvents();
    };
    const advance = () => {
        for (let i = 0; i < 60; i++) {
            game.step(1 / 120);
        }
    };
    return { settle, advance, game, unbind };
}
