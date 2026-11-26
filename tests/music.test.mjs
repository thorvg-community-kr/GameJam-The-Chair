import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled, load } from './support/load.mjs';

const { musicTrack } = await load('src/presentation/music.ts');

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
        music.play('start', false);
        settle(music);
        const [start] = created;
        assert.equal(start.paused, false);
        assert.ok(start.volume > 0.5);

        music.play(null, false);
        music.advance(0.1);
        assert.ok(start.volume > 0 && start.volume < 0.55);
        settle(music);
        assert.equal(start.volume, 0);
        assert.equal(start.paused, true);

        music.play('stage1-2', false);
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
        musicTrack({ mode: 'play', stage, orbit: { phase: 'rings' } }, false),
    );
    assert.deepEqual(tracks, [
        'stage1-2',
        'stage1-2',
        'stage3',
        'stage4',
        'stage5',
    ]);
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
