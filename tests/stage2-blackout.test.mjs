import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSource } from './support/load.mjs';

const {
    createGame,
    applyCorridor,
    STAGE_TWO,
    cableBlackout,
    buildTimeline,
    REPLAY_FORMAT,
    seekTimeline,
} = await loadSource(`
    export { createGame } from './src/game/game';
    export { applyCorridor } from './src/game/stages/building/corridor/apply';
    export { STAGE_TWO } from './src/game/stages/building/data';
    export { cableBlackout } from './src/preview/building';
    export { buildTimeline, REPLAY_FORMAT, seekTimeline } from './src/game/replay';
`);
const dt = 1 / 120;
function state() {
    const game = createGame({ seed: 167 });
    game.startStage(2);
    return JSON.parse(game.serialize());
}
function hit(s, index) {
    Object.assign(s.p, {
        x: STAGE_TWO.orientation.obstacles[index].x,
        y: 392,
        vx: 0,
        vy: 0,
    });
    s.building.corridor.convoy = 'free';
    s.building.corridor.tripped = -1;
    applyCorridor(s, [], dt, s.p.x);
}
function wait(s, seconds) {
    s.p.x = 3500;
    for (let i = 0; i < Math.ceil(seconds / dt); i++) {
        applyCorridor(s, [], dt, s.p.x);
    }
}

test('cable removal persists, counts once, and sleepers do not change lighting', () => {
    const s = state();
    hit(s, 0);
    assert.deepEqual(s.building.corridor.unplugged, [{ obstacle: 0, age: 0 }]);
    assert.equal(s.building.corridor.blackout.level, 1);
    hit(s, 0);
    assert.equal(s.building.corridor.unplugged.length, 1);
    assert.equal(s.building.corridor.blackout.level, 1);
    hit(s, 3);
    assert.equal(s.building.corridor.unplugged.length, 1);
    assert.equal(s.building.corridor.blackout.level, 1);
});

test('darkness is capped and recovers one level per interval without reconnecting plugs', () => {
    const s = state();
    for (const index of [0, 1, 2, 5, 6]) {
        hit(s, index);
    }
    assert.equal(s.building.corridor.blackout.level, 4);
    wait(s, 2.02);
    assert.equal(s.building.corridor.blackout.level, 3);
    wait(s, 6.05);
    assert.equal(s.building.corridor.blackout.level, 0);
    assert.equal(s.building.corridor.blackout.remaining, 0);
    assert.equal(s.building.corridor.unplugged.length, 5);
});

test('serialized lighting resumes deterministically and restart clears cables and darkness', () => {
    const s = state();
    hit(s, 0);
    s.p.x = 3500;
    const a = createGame({ seed: 167 });
    const b = createGame({ seed: 167 });
    a.restore(JSON.stringify(s));
    b.restore(JSON.stringify(s));
    for (let i = 0; i < 300; i++) {
        a.step();
        b.step();
    }
    assert.equal(a.serialize(), b.serialize());
    assert.equal(a.getSnapshot().corridor.blackout.level, 0);
    a.restart();
    assert.deepEqual(a.getSnapshot().corridor.unplugged, []);
    assert.equal(a.getSnapshot().corridor.blackout.level, 0);
});

test('preview records a real unplug and all four recovery steps', () => {
    const scene = cableBlackout(true);
    assert.equal(scene.sample(0).state.corridor.unplugged.length, 3);
    assert.equal(scene.sample(0.1).state.corridor.unplugged.length, 4);
    assert.equal(scene.sample(0.1).state.corridor.blackout.level, 4);
    for (let i = 1; i <= 4; i++) {
        assert.equal(
            scene.sample(i * 2 + 0.15).state.corridor.blackout.level,
            4 - i,
        );
    }
});

test('a replay reproduces cable removal and recovery at the same ticks', () => {
    const start = state();
    Object.assign(start.p, { x: 4050, y: 392, vx: 0, vy: 0 });
    start.building.furniture.forEach((chair, i) => {
        chair.x = 5500 + i * 130;
    });
    const game = createGame({ seed: 167 });
    game.restore(JSON.stringify(start));
    const checkpoints = [];
    for (let i = 0; i < 300; i++) {
        game.step();
        if (i === 10 || i === 299) {
            checkpoints.push(game.getSnapshot().corridor);
        }
    }
    const timeline = buildTimeline({
        format: REPLAY_FORMAT,
        version: '',
        seed: 167,
        start,
        commands: [],
        hashes: [],
        endTick: start.tick + 300,
        truncated: false,
        error: null,
    });
    assert.equal(checkpoints[0].unplugged.length, 1);
    assert.equal(checkpoints[0].blackout.level, 1);
    assert.equal(checkpoints[1].blackout.level, 0);
    assert.equal(timeline.divergedAt, null);
    assert.equal(timeline.error, null);
    for (const [i, tick] of [11, 300].entries()) {
        assert.deepEqual(
            seekTimeline(timeline, start.tick + tick).state.building.corridor,
            checkpoints[i],
        );
    }
});

test('checkpoint retry resets both the unplugged cables and lighting', () => {
    const s = state();
    s.checkpoint = 3;
    hit(s, 6);
    const game = createGame();
    game.restore(JSON.stringify(s));
    game.restart();
    assert.equal(game.getSnapshot().checkpoint, 3);
    assert.deepEqual(game.getSnapshot().corridor.unplugged, []);
    assert.equal(game.getSnapshot().corridor.blackout.level, 0);
});
