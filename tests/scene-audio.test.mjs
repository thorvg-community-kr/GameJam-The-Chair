import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from './support/load.mjs';

const { createGame, parseState } = await load('src/game/game.ts');
const { sceneAudio } = await load('src/presentation/scene-audio.ts');
const { createGameAudio } = await load('src/ui/game-audio.ts');
const { STAGE_THREE } = await load('src/game/stages/rooftop/data.ts');
const { STAGE_FIVE } = await load('src/game/stages/orbit/data.ts');
const { previewScenes } = await load('src/preview-scenes.ts');
const frame = (stage) => {
    const game = createGame();
    game.startStage(stage);
    return game.getSnapshot();
};
const names = (audio) => audio.shots.map((shot) => shot.name);

test('held spray and rolling use persistent loop intents and stop when motion ends', () => {
    const before = frame(3);
    const active = {
        ...before,
        time: before.time + 0.1,
        spray: { ...before.spray, burst: 0.24 },
        ground: true,
        player: { ...before.player, vx: 250 },
    };
    const loops = sceneAudio(before, active).loops;
    assert.ok(loops.some((loop) => loop.name === 'gasLoop'));
    assert.ok(loops.some((loop) => loop.name === 'wheelLoop'));
    const stopped = {
        ...active,
        time: active.time + 0.1,
        spray: { ...active.spray, burst: 0 },
        player: { ...active.player, vx: 0 },
    };
    assert.ok(
        !sceneAudio(active, stopped).loops.some((loop) =>
            ['gasLoop', 'wheelLoop'].includes(loop.name),
        ),
    );
    assert.deepEqual(sceneAudio(active, { ...stopped, mode: 'pause' }), {
        shots: [],
        loops: [],
    });
    assert.deepEqual(sceneAudio(active, stopped, [{ type: 'reset' }]), {
        shots: [],
        loops: [],
    });
});

test('typing, lift arrivals and express horns fire at transitions and respect distance', () => {
    const before = frame(2);
    const near = {
        ...before,
        time: 1,
        player: { ...before.player, x: before.corridor.offices[0].x },
        corridor: {
            ...before.corridor,
            offices: before.corridor.offices.map((office, index) => ({
                ...office,
                life: index === 0 ? 1.5 : 0,
            })),
        },
    };
    assert.ok(names(sceneAudio(before, near)).includes('typing'));
    assert.ok(
        !names(sceneAudio(near, { ...near, time: 1.1 })).includes('typing'),
    );
    assert.ok(
        !names(
            sceneAudio(before, {
                ...near,
                player: { ...near.player, x: 6000 },
            }),
        ).includes('typing'),
    );
    const arriving = {
        ...before,
        corridor: { ...before.corridor, lift: { kind: 'arriving', age: 1.19 } },
        player: { ...before.player, x: 11500 },
    };
    const open = {
        ...arriving,
        time: 1.2,
        corridor: { ...arriving.corridor, lift: { kind: 'open', age: 0 } },
    };
    assert.ok(names(sceneAudio(arriving, open)).includes('liftArrival'));
    assert.ok(
        !names(sceneAudio(open, { ...open, time: 1.3 })).includes(
            'liftArrival',
        ),
    );
    assert.ok(
        names(
            sceneAudio(before, {
                ...before,
                time: 1,
                corridor: { ...before.corridor, pace: 'express' },
            }),
        ).includes('honk'),
    );
});

test('nearby vents announce the warning before blowing and distant vents stay quiet', () => {
    const base = frame(3);
    const vent = STAGE_THREE.vents[0];
    const state = (time, x = vent.x) => ({
        ...base,
        time,
        player: { ...base.player, x, y: vent.y },
    });
    const warning = sceneAudio(state(1.59), state(1.7));
    assert.ok(
        warning.loops.some((loop) => loop.id === 'vent-0' && loop.gain > 0),
    );
    assert.ok(!names(warning).includes('ventBlow'));
    assert.ok(names(sceneAudio(state(2.29), state(2.31))).includes('ventBlow'));
    assert.ok(
        !names(sceneAudio(state(2.29, -1000), state(2.31, -1000))).includes(
            'ventBlow',
        ),
    );
});

test('the last photograph whirs before one shutter cue and stays quiet after it', () => {
    const scene = previewScenes
        .find((item) => item.id === 'orbit-photo')
        .create();
    assert.equal(scene.markers.length, 1);
    let previous = scene.sample(0).state;
    let shutters = 0;
    let whirBefore = false;
    let whirAfter = false;
    for (let t = 1 / 60; t < scene.duration; t += 1 / 60) {
        const next = scene.sample(t).state;
        const audio = sceneAudio(previous, next);
        shutters += names(audio).filter((name) => name === 'shutter').length;
        const whir = audio.loops.some((loop) => loop.name === 'satelliteScan');
        if (shutters === 0) {
            whirBefore ||= whir;
        } else {
            whirAfter ||= whir;
        }
        previous = next;
    }
    assert.equal(shutters, 1);
    assert.ok(whirBefore, 'the scan whir leads into the photograph');
    assert.ok(!whirAfter, 'the scan whir stops once the shutter fires');
});

test('world audio stays silent in release and parked ending frames', () => {
    const sky = frame(4);
    const quiet = { ...sky, sky: { ...sky.sky, phase: 'reveal' } };
    assert.deepEqual(sceneAudio(sky, quiet), { shots: [], loops: [] });
    const orbit = frame(5);
    const parked = { ...orbit, orbit: { ...orbit.orbit, phase: 'parked' } };
    assert.deepEqual(sceneAudio(parked, { ...parked, time: 1 }), {
        shots: [],
        loops: [],
    });
});

test('the shared player clicks the lever once and resets audio for pause, seek and replay', () => {
    const played = [];
    const loops = [];
    let stops = 0;
    const player = createGameAudio({
        play(name) {
            played.push(name);
        },
        syncLoops(next) {
            loops.push(next);
        },
        stop() {
            stops++;
        },
    });
    const base = frame(3);
    player.update(base);
    const spray = { ...base, time: 0.1, spray: { ...base.spray, burst: 0.24 } };
    player.update(spray, [{ type: 'cue', id: 'spray' }]);
    player.update({ ...spray, time: 0.2 }, [{ type: 'cue', id: 'spray' }]);
    assert.equal(played.filter((name) => name === 'sprayLever').length, 1);
    player.update({ ...spray, time: 0.3, mode: 'pause' });
    assert.equal(loops.at(-1).length, 0);
    player.update(null);
    assert.ok(stops >= 2);
});

test('recorded preview scenes retain collision cues for game audio playback', () => {
    const scene = previewScenes
        .find((item) => item.id === 'copier-volley')
        .create();
    const events = [];
    for (let t = 0; t < scene.duration; t += 1 / 60) {
        events.push(...(scene.sample(t).events ?? []));
    }
    assert.ok(events.some((event) => event.type === 'volley'));
});

test('audio observation never changes serialized gameplay', () => {
    const game = createGame();
    game.startStage(3);
    const before = game.getSnapshot();
    game.step();
    const next = game.getSnapshot();
    const state = game.serialize();
    sceneAudio(before, next);
    assert.deepEqual(parseState(game.serialize()), parseState(state));
});

test('the employee-of-the-month portrait drops with one paper sound after the door shuts', () => {
    const scene = previewScenes
        .find((item) => item.id === 'rooftop-entrance')
        .create();
    let previous = scene.sample(0).state;
    const heard = [];
    for (let t = 1 / 60; t < scene.duration; t += 1 / 60) {
        const next = scene.sample(t).state;
        for (const name of names(sceneAudio(previous, next))) {
            heard.push({ name, t });
        }
        previous = next;
    }
    const at = (name) => heard.filter((item) => item.name === name);
    const [close] = at('doorClose');
    const falls = at('portraitFall');
    assert.equal(falls.length, 1);
    assert.ok(close.t < falls[0].t);
});

test('the shutter fires when a satellite damage zone opens, even if the chair dodges it', () => {
    const base = frame(5);
    const beam = STAGE_FIVE.satelliteLight.beams[0];
    const at = (z, time) => ({
        ...base,
        mode: 'play',
        time,
        orbit: {
            ...base.orbit,
            phase: 'door',
            z,
            speed: 300,
            freeze: 0,
            aims: base.orbit.aims.map(() => ({ x: 900, y: 900 })),
        },
    });
    const shutters = (prev, next) =>
        names(sceneAudio(prev, next)).filter((name) => name === 'shutter')
            .length;
    assert.equal(shutters(at(beam.from - 10, 10), at(beam.from - 5, 10.01)), 0);
    assert.equal(shutters(at(beam.from - 1, 10), at(beam.from + 4, 10.01)), 1);
    assert.equal(shutters(at(beam.from + 4, 10), at(beam.from + 9, 10.01)), 0);
});
