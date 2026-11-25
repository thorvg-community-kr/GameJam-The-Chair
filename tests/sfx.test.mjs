import assert from 'node:assert/strict';
import test from 'node:test';

import { begin } from './support/harness.mjs';
import { load } from './support/load.mjs';

const { frameSounds, cueSound, createSfxGate, silentFrame } = await load(
    'src/presentation/sfx.ts',
);
const { SOUNDS, soundLength } = await load('src/ui/sfx.ts');

const frame = (patch = {}) => ({
    mode: 'play',
    stage: 1,
    ground: true,
    deaths: 0,
    player: { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0 },
    sky: { phase: 'course' },
    orbit: undefined,
    ...patch,
});
const air = (vy, patch = {}) =>
    frame({ ground: false, player: { ...frame().player, vy }, ...patch });
const cue = (id) => ({ type: 'cue', id });

test('key actions map to sounds and speech cues stay silent', () => {
    assert.equal(cueSound('spray'), 'spray');
    assert.equal(cueSound('checkpoint'), 'checkpoint');
    assert.equal(cueSound('stage-clear'), 'clear');
    assert.equal(cueSound('extinguisher-pickup'), 'pickup');
    assert.equal(cueSound('head-hit'), 'bonk');
    assert.equal(cueSound('head-game-over'), 'fail');
    assert.equal(cueSound('head-comment'), null);
    assert.equal(cueSound('person-comment'), null);
});

test('every sound has a synth recipe', () => {
    for (const name of Object.keys(SOUNDS)) {
        assert.ok(soundLength(name) > 0, name);
    }
});

test('jump and landing come from snapshot transitions', () => {
    assert.deepEqual(frameSounds(frame(), air(-372), []), ['jump']);
    assert.deepEqual(frameSounds(air(356), air(9), []), ['land']);
    assert.deepEqual(frameSounds(air(100), air(9), []), []);
});

test('a spray lift-off plays the spray, not a jump', () => {
    assert.deepEqual(frameSounds(frame(), air(-470), [cue('spray')]), [
        'spray',
    ]);
});

test('falling off the level plays a slide whistle', () => {
    const next = frame({ deaths: 1 });
    assert.deepEqual(frameSounds(air(600), next, [{ type: 'reset' }]), [
        'fall',
    ]);
    assert.deepEqual(
        frameSounds(air(600), next, [cue('bin-fall'), { type: 'reset' }]),
        ['crash'],
    );
});

test('a manual restart, pause, stage change and first frame are silent', () => {
    const restarted = frame({ deaths: 1 });
    assert.deepEqual(frameSounds(frame(), restarted, [{ type: 'reset' }]), []);
    assert.deepEqual(frameSounds(null, frame(), [cue('checkpoint')]), []);
    assert.deepEqual(
        frameSounds(frame({ stage: 4 }), frame({ stage: 5 }), [
            cue('checkpoint'),
        ]),
        [],
    );
    assert.deepEqual(
        frameSounds(frame({ mode: 'pause' }), frame({ mode: 'pause' }), [
            cue('spray'),
        ]),
        [],
    );
});

test('the stage four release and the ending stay silent', () => {
    for (const phase of ['reveal', 'depth']) {
        assert.equal(silentFrame(frame({ stage: 4, sky: { phase } })), true);
    }
    assert.equal(silentFrame(frame({ stage: 4 })), false);
    for (const phase of ['entry', 'parked']) {
        assert.equal(silentFrame(frame({ stage: 5, orbit: { phase } })), true);
    }
    assert.equal(
        silentFrame(frame({ stage: 5, orbit: { phase: 'rings' } })),
        false,
    );
});

test('repeated sounds are throttled and capped', () => {
    const gate = createSfxGate({ voices: 2, gap: 0.1, gaps: {} });
    assert.equal(gate.pass('jump', 0, 0.5), true);
    assert.equal(gate.pass('jump', 0.05, 0.5), false);
    assert.equal(gate.pass('land', 0.05, 0.5), true);
    assert.equal(gate.pass('bonk', 0.06, 0.5), false);
    assert.equal(gate.pass('bonk', 0.6, 0.5), true);
});

test('a real office run triggers jump, landing, bonk and failure', () => {
    const game = begin(7, { stage: 1 });
    let prev = game.getSnapshot();
    const heard = new Set();
    for (let t = 0; t < 700; t++) {
        if (t === 1) {
            game.setInput('right');
        }
        if (t % 150 === 100) {
            game.jump();
        }
        game.step(1 / 120);
        if (t % 2) {
            continue;
        }
        const next = game.getSnapshot();
        for (const sound of frameSounds(prev, next, game.drainEvents())) {
            heard.add(sound);
        }
        prev = next;
    }
    for (const sound of ['jump', 'land', 'bonk', 'fail']) {
        assert.ok(heard.has(sound), sound);
    }
});
