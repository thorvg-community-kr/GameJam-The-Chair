import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled, load } from './support/load.mjs';

const { musicDuck, musicTrack } = await load('src/presentation/music.ts');

const created = [];
class FakeAudio {
    constructor(src) {
        this.src = src;
        this.paused = true;
        this.volume = 0;
        this.currentTime = 0;
        created.push(this);
    }
    play() {
        this.paused = false;
        return Promise.resolve();
    }
    pause() {
        this.paused = true;
    }
    removeAttribute() {}
}
const noop = () => {};
const events = { addEventListener: noop, removeEventListener: noop };
for (const [key, value] of Object.entries({
    Audio: FakeAudio,
    window: events,
    document: { ...events, hidden: false },
})) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
}
const stubUrls = {
    name: 'stub-urls',
    setup(build) {
        build.onResolve({ filter: /\?url$/ }, (args) => ({
            path: args.path,
            namespace: 'stub-url',
        }));
        build.onLoad({ filter: /.*/, namespace: 'stub-url' }, (args) => ({
            contents: `export default ${JSON.stringify(args.path)};`,
            loader: 'js',
        }));
    },
};
const { createMusic } = await bundled({
    entryPoints: ['src/ui/music.ts'],
    plugins: [stubUrls],
});

const settle = (music) => {
    for (let i = 0; i < 40; i++) {
        music.advance(0.1);
    }
};

test('the title screen plays the start theme', () => {
    assert.equal(musicTrack({ mode: 'intro', stage: 1 }, false), 'start');
});

test('the prologue plays no music', () => {
    assert.equal(musicTrack({ mode: 'intro', stage: 1 }, true), null);
    assert.equal(musicTrack({ mode: 'play', stage: 1 }, true), null);
});

test('silence fades every track out and the next track fades back in', () => {
    const music = createMusic(1);
    created.length = 0;
    try {
        music.play('start');
        settle(music);
        const [start] = created;
        assert.equal(start.paused, false);
        assert.ok(start.volume > 0.5);

        music.play(null);
        music.advance(0.1);
        assert.ok(start.volume > 0 && start.volume < 0.55);
        settle(music);
        assert.equal(start.volume, 0);
        assert.equal(start.paused, true);

        music.play('stage1-2');
        settle(music);
        const stage = created[1];
        assert.equal(stage.paused, false);
        assert.ok(stage.volume > 0.5);
        assert.equal(start.paused, true);
    } finally {
        music.destroy();
    }
});

test('each stage plays its own theme', () => {
    const tracks = [1, 2, 3, 4, 5].map((stage) =>
        musicTrack(
            {
                mode: 'play',
                stage,
                orbit: { phase: 'rings' },
                sky: { phase: 'course' },
            },
            false,
        ),
    );
    assert.deepEqual(tracks, [
        'stage1-2',
        'stage1-2',
        'stage3',
        'stage4',
        'stage5',
    ]);
});

test('the stage four to five camera turn is silent and stage five restarts the music', () => {
    const sky = (phase) =>
        musicTrack({ mode: 'play', stage: 4, sky: { phase } }, false);
    assert.equal(sky('course'), 'stage4');
    assert.equal(sky('reveal'), null);
    assert.equal(sky('depth'), null);
    assert.equal(
        musicTrack(
            { mode: 'play', stage: 5, orbit: { phase: 'entry' } },
            false,
        ),
        'stage5',
    );
});

test('parking at the orbit door switches to the ending theme', () => {
    assert.equal(
        musicTrack(
            { mode: 'play', stage: 5, orbit: { phase: 'parked' } },
            false,
        ),
        'ending',
    );
});

test('a track blocked by autoplay stays silent and fades in after unlocking', () => {
    const music = createMusic(1);
    created.length = 0;
    const play = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function () {
        return Promise.reject(new Error('NotAllowedError'));
    };
    try {
        music.play('start');
        settle(music);
        const [start] = created;
        assert.equal(start.paused, true);
        assert.equal(start.volume, 0, 'no volume builds up while blocked');

        start.paused = false;
        music.advance(0.1);
        assert.ok(start.volume > 0 && start.volume < 0.2, 'fades in from zero');
        settle(music);
        assert.ok(start.volume > 0.5);
    } finally {
        FakeAudio.prototype.play = play;
        music.destroy();
    }
});

test('every losing mode ducks for death and pause keeps its own duck', () => {
    assert.equal(musicDuck({ mode: 'play' }), 'none');
    assert.equal(musicDuck({ mode: 'intro' }), 'none');
    assert.equal(musicDuck({ mode: 'won' }), 'none');
    assert.equal(musicDuck({ mode: 'pause' }), 'pause');
    for (const mode of ['impact', 'focuslost', 'dead']) {
        assert.equal(musicDuck({ mode }), 'death', mode);
    }
});

test('death ducks the same track and a restart restores it', () => {
    const music = createMusic(1);
    created.length = 0;
    try {
        music.play('stage3');
        settle(music);
        const [stage] = created;
        const full = stage.volume;
        assert.ok(full > 0.5);
        stage.currentTime = 12;

        music.play('stage3', 'death');
        settle(music);
        assert.equal(stage.paused, false, 'death keeps the track playing');
        assert.ok(stage.volume > 0 && stage.volume < 0.1);

        music.play('stage3', 'none');
        settle(music);
        assert.equal(created.length, 1, 'no new voice on restart');
        assert.equal(stage.currentTime, 12, 'playback position is kept');
        assert.equal(stage.volume, full);
    } finally {
        music.destroy();
    }
});

test('ducking multiplies the user volume without replacing it', () => {
    const music = createMusic(0.5);
    created.length = 0;
    try {
        music.play('stage4', 'death');
        settle(music);
        const [stage] = created;
        const ducked = stage.volume;
        assert.ok(Math.abs(ducked - 0.08 * 0.5) < 1e-9);

        music.setVolume(0);
        assert.equal(stage.volume, 0, 'mute holds while ducked');
        music.setVolume(1);
        assert.ok(Math.abs(stage.volume - 0.08) < 1e-9);

        music.setVolume(0.5);
        music.play('stage4');
        settle(music);
        assert.ok(Math.abs(stage.volume - 0.55 * 0.5) < 1e-9);
    } finally {
        music.destroy();
    }
});
