import assert from 'node:assert/strict';
import test from 'node:test';

import { createGame } from './support/harness.mjs';
import { loadSource } from './support/load.mjs';

const { STAGE_TWO, CHAIR_DEPARTURE } = await loadSource(`
    export { STAGE_TWO, CHAIR_DEPARTURE } from './src/game/stages/building/data';
`);

for (const direction of ['left', 'right']) {
    test(`a grounded rider can leave the packed lift chairs by moving ${direction}`, () => {
        const game = createGame();
        game.startStage(2);
        const state = JSON.parse(game.serialize());
        state.ground = true;
        state.p = { x: STAGE_TWO.lift + 29, y: 392, vx: 0, vy: 0, a: 0, w: 0 };
        Object.assign(state.building.corridor, {
            dispatchStarted: true,
            dispatchAge: 10,
            convoy: 'carried',
            pace: 'express',
            departure: { kind: 'boarding', age: 2, reason: 'abduction' },
            lift: { kind: 'open', age: 2 },
        });
        state.building.furniture.forEach((chair, index) => {
            Object.assign(chair, {
                x: STAGE_TWO.lift + CHAIR_DEPARTURE.slots[index],
                vx: 0,
                released: true,
            });
        });
        game.restore(JSON.stringify(state));
        game.setInput(direction);
        for (let tick = 0; tick < 240; tick++) {
            game.step(1 / 120);
        }
        const end = game.getSnapshot();
        assert.ok(
            direction === 'right'
                ? end.player.x > STAGE_TWO.lift + 100
                : end.player.x < STAGE_TWO.lift - 100,
            `rider remains trapped at x=${end.player.x}`,
        );
        assert.equal(end.mode, 'play');
    });
}
