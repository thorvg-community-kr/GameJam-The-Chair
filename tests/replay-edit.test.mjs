import assert from 'node:assert/strict';
import test from 'node:test';

import { balancePolicy } from './support/harness.mjs';
import { bundled } from './support/load.mjs';

const R = await bundled({
    stdin: {
        contents: `export { createGame } from './src/game/game'; export * from './src/game/replay';`,
        resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
});

function recordedAttempt() {
    const settings = { ...R.REPLAY_DEFAULTS };
    const recorder = R.createRecorder(() => settings, 21);
    const game = R.createGame({ seed: 21, ...recorder });
    game.startStage(1);
    for (let i = 0; i < 120 * 30; i++) {
        const state = game.getSnapshot();
        if (state.mode === 'dead' || state.mode === 'won') {
            break;
        }
        balancePolicy(state, game);
        game.advance([1 / 60, 1 / 144, 0.011][i % 3]);
    }
    return recorder.latest();
}

test('a clipped range plays on its own and ends in the same state as the original', () => {
    const file = recordedAttempt();
    const timeline = R.buildTimeline(file);
    const span = timeline.endTick - timeline.startTick;
    const range = {
        start: timeline.startTick + Math.floor(span / 3),
        end: timeline.startTick + Math.floor((span * 2) / 3),
    };
    const edit = {
        markers: [
            { tick: timeline.startTick + 1, label: 'outside' },
            { tick: range.start + 10, label: 'inside' },
        ],
        range,
    };
    const clip = R.clipReplay(timeline, range, edit);
    const parsed = R.parseReplay(JSON.stringify(clip));
    assert.equal(parsed.start.tick, range.start);
    assert.equal(parsed.endTick, range.end);
    assert.deepEqual(parsed.edit, {
        markers: [{ tick: range.start + 10, label: 'inside' }],
        range: null,
    });
    const clipped = R.buildTimeline(parsed);
    assert.equal(clipped.divergedAt, null);
    assert.equal(clipped.error, null);
    assert.ok(parsed.hashes.length > 0);
    assert.equal(
        JSON.stringify(R.seekTimeline(clipped, range.end).state),
        JSON.stringify(R.seekTimeline(timeline, range.end).state),
    );
    assert.equal(file.edit, undefined, 'the original stays untouched');
});

test('replay edits round-trip through files and are validated', () => {
    const file = recordedAttempt();
    const start = file.start.tick;
    const edit = {
        markers: [
            { tick: start + 50, label: '' },
            { tick: start + 20, label: 'jump' },
        ],
        range: { start: start + 10, end: start + 90 },
    };
    const parsed = R.parseReplay(JSON.stringify({ ...file, edit }));
    assert.deepEqual(parsed.edit.markers, [
        { tick: start + 20, label: 'jump' },
        { tick: start + 50, label: '' },
    ]);
    assert.deepEqual(parsed.edit.range, edit.range);
    assert.equal(R.replayEditKey(parsed), R.replayEditKey(file));
    for (const bad of [
        { markers: 'x', range: null },
        { markers: [{ tick: file.endTick + 1 }], range: null },
        { markers: [], range: { start: start + 9, end: start + 9 } },
        { markers: [{ tick: start, label: 'x'.repeat(81) }], range: null },
    ]) {
        assert.throws(() =>
            R.parseReplay(JSON.stringify({ ...file, edit: bad })),
        );
        assert.equal(R.readReplayEdit(bad, file), null);
    }
    assert.deepEqual(
        R.normalizeReplayEdit(
            {
                markers: [
                    { tick: start - 5, label: 'a' },
                    { tick: start, label: 'b' },
                ],
                range: { start: file.endTick, end: file.endTick + 50 },
            },
            start,
            file.endTick,
        ),
        { markers: [{ tick: start, label: 'a' }], range: null },
    );
});
