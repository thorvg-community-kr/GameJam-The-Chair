import assert from 'node:assert/strict';
import test from 'node:test';

import { installInputEnvironment } from './support/input.mjs';
import { loadSource } from './support/load.mjs';

const {
    ORBIT_ENDING,
    STAGE_FIVE,
    CREDITS,
    CREDITS_END,
    CREDITS_CLOSE,
    creditRows,
    creditsEnd,
    creditsScroll,
    creditsColumn,
    drawCredits,
    creditsSkippable,
    creditsFinished,
    epilogueBeat,
    stageEpilogue,
    wideGag,
    WIDE_GAG,
    createGame,
    viewState,
    parseCommand,
    createRecorder,
    REPLAY_DEFAULTS,
    buildTimeline,
    replayCommands,
    drawOrbit,
    createRenderCtx,
    collect,
    registerLottie,
    previewScenes,
    bindInput,
} = await loadSource(`
    export { ORBIT_ENDING } from './src/render/scene/orbit/ending-timeline';
    export { STAGE_FIVE } from './src/game/stages/orbit/data';
    export { CREDITS } from './src/render/scene/orbit/credits-data';
    export {
        CREDITS_END,
        CREDITS_CLOSE,
        creditRows,
        creditsEnd,
        creditsScroll,
        creditsColumn,
        drawCredits,
    } from './src/render/scene/orbit/credits';
    export { creditsSkippable, creditsFinished } from './src/presentation/credits';
    export { epilogueBeat } from './src/render/scene/orbit/epilogue-beats';
    export { stageEpilogue, wideGag, WIDE_GAG } from './src/render/scene/orbit/epilogue-staging';
    export { createGame, viewState, replayCommands } from './src/game/game';
    export { parseCommand } from './src/game/commands';
    export { createRecorder, REPLAY_DEFAULTS, buildTimeline } from './src/game/replay';
    export { drawOrbit } from './src/render/scene/orbit';
    export { createRenderCtx } from './tests/support/render-context';
    export { collect } from './src/render/paint/commands';
    export { registerLottie } from './src/render/lottie';
    export { previewScenes } from './src/preview-scenes';
    export { bindInput } from './src/ui/input';
`);

const E = ORBIT_ENDING;
const C = STAGE_FIVE.credits;
/** Stand-in content with long lines, as the real credits will have later. */
const SAMPLE = {
    title: ['THE CHAIR'],
    roles: [
        { label: 'settings.language', names: ['Kim Somebody', 'Lee Someone'] },
        { label: 'settings.bgm', names: ['A Rather Long Composer Name'] },
    ],
    assets: [
        {
            label: 'settings.sfx',
            names: ['SFXMint', 'Mildly Useless', 'CC0'],
        },
    ],
    engine: true,
    thanks: ['intro.desc'],
};

/** A stage-five game parked at the door, `t` seconds into the ending. */
function parkedAt(t, options = {}) {
    const game = createGame({ seed: 55, ...options });
    game.startStage(5);
    const state = JSON.parse(game.serialize());
    Object.assign(state.orbit, {
        phase: 'parked',
        z: STAGE_FIVE.checkpoint.z,
        speed: 0,
        settled: 1 + t,
    });
    state.checkpoint = STAGE_FIVE.restarts.length + 1;
    game.restore(JSON.stringify(state));
    game.drainEvents();
    return game;
}
const endingOf = (game) => game.getSnapshot().orbit.settled - 1;

function context(t, { W = 1000, H = 510, locale = 'en' } = {}) {
    const state = JSON.parse(parkedAt(0).serialize());
    state.orbit.settled = 1 + t;
    const ctx = createRenderCtx({});
    Object.assign(ctx, { state: viewState(state), t: 80 + t, W, H, locale });
    return ctx;
}
function frame(t, options) {
    const ctx = context(t, options);
    drawOrbit(ctx);
    const layer = (key) =>
        ctx.commands.filter((command) => command.layer?.key === key);
    return { ctx, layer, commands: ctx.commands };
}

test('the timeline cuts wide after the last stare, rolls the credits a second later and closes after the roll', () => {
    assert.equal(E.ultraWide, E.hold, 'the wide cut follows the last stare');
    assert.equal(E.credits, E.ultraWide + 1, 'one still second first');
    assert.ok(CREDITS_END > E.credits);
    assert.equal(CREDITS_CLOSE, CREDITS_END + 1, 'a beat after the roll');
    assert.ok(E.closing > CREDITS_CLOSE + 60, 'closing is past any roll');
    assert.ok(E.toTitle > E.closing && E.toTitle - E.closing <= 1);
    assert.equal(epilogueBeat(E.ultraWide - 0.01).cut, 'stare-rider');
    assert.equal(epilogueBeat(E.ultraWide).cut, 'wide');
    assert.equal(epilogueBeat(E.closing + 0.5).cut, 'wide');
});

test('the credits keep their sections but only the engine is filled in for now', () => {
    assert.deepEqual(CREDITS, {
        title: [],
        roles: [],
        assets: [],
        engine: true,
        thanks: [],
    });
    const { rows, length } = creditRows('en');
    assert.deepEqual(
        rows.map((row) => row.kind),
        ['logo'],
        'empty sections leave no rows',
    );
    assert.equal(length, rows[0].height, 'and no gaps');
    const none = { ...CREDITS, engine: false };
    assert.deepEqual(creditRows('en', none), { rows: [], length: 0 });
    assert.ok(Number.isFinite(creditsEnd(none)));
});

test('adding credits lengthens the roll and moves its end, the same in every language', () => {
    const en = creditRows('en', SAMPLE);
    const ko = creditRows('ko', SAMPLE);
    assert.equal(en.length, ko.length);
    assert.deepEqual(
        en.rows.map((row) => row.y),
        ko.rows.map((row) => row.y),
    );
    assert.ok(creditsEnd(SAMPLE) > CREDITS_END + 5, 'more content, later end');
    for (const content of [CREDITS, SAMPLE]) {
        const { length } = creditRows('en', content);
        const end = creditsEnd(content);
        assert.equal(creditsScroll(E.credits, length), 1, 'starts below');
        assert.ok(
            Math.abs(creditsScroll(end, length) + length) < 1e-9,
            'the last line has left the top at the end',
        );
        let previous = Infinity;
        for (let t = E.credits; t <= end; t += 0.25) {
            const top = creditsScroll(t, length);
            assert.ok(top < previous, 'always rising');
            previous = top;
        }
    }
});

test('the roll is drawn in a masked column on the right as a pure function of time', () => {
    const draw = (t, options) => {
        const ctx = context(t, options);
        ctx.commands = [];
        drawCredits(ctx, t, SAMPLE);
        return ctx;
    };
    const ctx = draw(E.credits + 4);
    const credits = ctx.commands.filter(
        (command) => command.layer?.key === 'orbit-credits',
    );
    assert.ok(credits.length > 2, 'credit lines are drawn');
    assert.equal(credits[0].layer.holdsText, true, 'inside the Scene');
    const stops = credits[0].layer.mask.fill.stops.map(([at, color]) => [
        at,
        color[3],
    ]);
    assert.deepEqual(stops.at(0), [0, 0], 'transparent at the top');
    assert.deepEqual(stops.at(-1), [1, 0], 'transparent at the bottom');
    assert.ok(stops.some(([, alpha]) => alpha === 255));
    const column = creditsColumn(ctx.W, ctx.H);
    assert.ok(credits.every((command) => command.text.x >= column.left));
    const items = collect(credits);
    assert.equal(items.length, 1, 'one masked Scene');
    assert.equal(items[0].texts.length, credits.length);
    assert.deepEqual(
        draw(E.credits + 4).commands,
        ctx.commands,
        'same time, same frame',
    );
    assert.deepEqual(draw(E.credits - 0.1).commands, []);
    assert.deepEqual(draw(creditsEnd(SAMPLE) + 0.1).commands, []);
});

test('credit lines fit the column on phones in English and Korean', () => {
    for (const [W, H] of [
        [568, 320],
        [667, 375],
        [740, 360],
        [800, 600],
        [1280, 720],
    ]) {
        const column = creditsColumn(W, H);
        assert.ok(column.left > W * 0.45 && column.right <= W - 12);
        for (const locale of ['en', 'ko']) {
            for (let t = E.credits; t < creditsEnd(SAMPLE); t += 0.5) {
                const ctx = context(t, { W, H, locale });
                ctx.commands = [];
                drawCredits(ctx, t, SAMPLE);
                for (const command of ctx.commands) {
                    if (command.kind !== 'text') {
                        continue;
                    }
                    const { content, size, font, x } = command.text;
                    const half = (ctx.measureText(content, 1, font) * size) / 2;
                    assert.ok(
                        x - half >= column.left - 0.5 &&
                            x + half <= column.right + 0.5,
                        `${content} fits ${W}x${H} ${locale}`,
                    );
                    assert.ok(size >= 8, `${content} stays legible`);
                }
            }
        }
    }
});

test('the ThorVG logo rolls through as the splash Lottie, screened over space', () => {
    const logo = (t) => frame(t).commands.filter((c) => c.kind === 'lottie');
    const middle = (E.credits + CREDITS_END) / 2;
    const fallback = frame(middle)
        .layer('orbit-credits')
        .map((command) => command.text.content);
    assert.deepEqual(fallback, ['Powered by ThorVG'], 'text until it loads');
    registerLottie('thorvg-logo', '{}');
    const [lottie] = logo(middle);
    assert.ok(lottie, 'the logo scrolls through');
    assert.equal(lottie.lottie.asset, 'thorvg-logo');
    assert.equal(lottie.layer.blend, 'screen');
    assert.ok(lottie.layer.mask, 'and fades with the column');
    assert.ok(lottie.lottie.time > 0);
    assert.ok(logo(middle + 1)[0].lottie.time > lottie.lottie.time);
    assert.equal(collect([lottie])[0].lotties.length, 1);
    assert.deepEqual(logo(CREDITS_END + 0.1), []);
});

test('the two specks bob out of step, and mid-credits the chair creeps up and he flinches away', () => {
    const at = (u) => stageEpilogue({ cut: 'wide', u, t: u + 10, shot: 0 });
    const chairY = (u) => at(u).figures[0].chair([0, 0, 0])[1];
    const riderY = (u) => at(u).figures[1].rider([0, 0, 0])[1];
    const samples = Array.from({ length: 40 }, (_, i) => i * 0.1);
    const chairPeak = samples.reduce((a, u) => (chairY(u) > chairY(a) ? u : a));
    const riderPeak = samples.reduce((a, u) => (riderY(u) > riderY(a) ? u : a));
    assert.ok(Math.abs(chairPeak - riderPeak) > 0.5, 'never in step');
    const gagAt = E.ultraWide + WIDE_GAG.at;
    assert.ok(gagAt > E.credits && gagAt < CREDITS_END - 2, 'mid-credits');
    const before = wideGag(WIDE_GAG.at - 0.1);
    assert.deepEqual([before.chair, before.rider], [0, 0]);
    const crept = wideGag(WIDE_GAG.at + WIDE_GAG.creep);
    assert.ok(crept.chair > 50 && crept.rider === 0, 'the chair creeps first');
    const after = wideGag(WIDE_GAG.at + WIDE_GAG.creep + 1.5);
    assert.ok(after.rider > after.chair, 'then he jumps further away');
    const x = (u) => at(u).figures[1].rider([0, 0, 0])[0];
    assert.ok(x(WIDE_GAG.at + WIDE_GAG.creep + 1.5) > x(WIDE_GAG.at) + 50);
    assert.ok(
        frame(gagAt + WIDE_GAG.creep + 0.3).layer('epilogue-flinch').length > 0,
        'with a shudder of motion lines',
    );
});

test('closing fades the whole frame to black before the title', () => {
    const black = (t) => {
        const [card] = frame(t).layer('orbit-ending-black');
        return card ? parseInt(card.fill.slice(7, 9), 16) / 255 : 0;
    };
    assert.equal(black(CREDITS_CLOSE - 0.1), 0, 'the empty sky holds');
    assert.equal(black(E.closing), 0);
    assert.ok(black((E.closing + E.toTitle) / 2) > 0.2);
    assert.ok(black(E.toTitle - 0.001) > 0.95);
    assert.deepEqual(frame(E.closing + 0.2).layer('orbit-credits'), []);
});

test('closing the credits only works once they roll, and jumps to the closing fade', () => {
    assert.deepEqual(parseCommand({ type: 'closeCredits' }), {
        type: 'closeCredits',
    });
    const early = parkedAt(E.credits - 0.5);
    early.closeCredits();
    assert.ok(Math.abs(endingOf(early) - (E.credits - 0.5)) < 1e-9);
    assert.equal(creditsSkippable(early.getSnapshot()), false);
    const rolling = parkedAt(E.credits + 3);
    assert.equal(creditsSkippable(rolling.getSnapshot()), true);
    assert.equal(creditsFinished(rolling.getSnapshot()), false);
    rolling.closeCredits();
    assert.equal(endingOf(rolling), C.closing);
    assert.equal(creditsSkippable(rolling.getSnapshot()), false);
    rolling.closeCredits();
    assert.equal(endingOf(rolling), C.closing, 'a second close does nothing');
    const paused = parkedAt(E.credits + 3);
    paused.pause();
    paused.closeCredits();
    assert.ok(endingOf(paused) < C.closing, 'ignored while paused');
    assert.equal(creditsFinished(parkedAt(CREDITS_CLOSE).getSnapshot()), true);
    assert.equal(
        creditsFinished(parkedAt(CREDITS_CLOSE - 0.1).getSnapshot()),
        false,
    );
});

test('after the closing fade the game is back on the title, keeping progress like a restart', () => {
    const game = parkedAt(C.closing + C.fade - 0.05, {
        progress: { deaths: 7, completedStage: 4 },
    });
    let reset = 0;
    for (let i = 0; i < 12; i++) {
        game.step();
        reset += game
            .drainEvents()
            .filter((event) => event.type === 'reset').length;
    }
    const after = game.getSnapshot();
    assert.equal(after.mode, 'intro');
    assert.equal(after.stage, 1);
    assert.equal(after.deaths, 7);
    assert.equal(after.completedStage, 4);
    assert.equal(reset, 1, 'a new attempt starts like any restart');
});

test('replays reproduce the credits roll and a skip back to the title', () => {
    const recorder = createRecorder(() => REPLAY_DEFAULTS, 55);
    const game = parkedAt(E.credits - 1, {
        onAttemptStart: recorder.onAttemptStart,
        onCommand: recorder.onCommand,
        onStep: recorder.onStep,
    });
    // Restoring does not start an attempt; record from the parked state.
    recorder.onAttemptStart(game.serialize());
    const start = JSON.parse(game.serialize());
    const log = [];
    for (let i = 0; i < 120 * 4; i++) {
        if (i === 120 * 3) {
            log.push([
                JSON.parse(game.serialize()).tick,
                { type: 'closeCredits' },
            ]);
            game.closeCredits();
        }
        game.step();
    }
    const live = JSON.parse(game.serialize());
    assert.equal(live.mode, 'intro', 'skipped to the title');
    const replayed = replayCommands(start, log, live.tick);
    assert.deepEqual(replayed.state, live);
    const file = recorder.latest(1);
    assert.ok(
        file.commands.some(([, command]) => command.type === 'closeCredits'),
    );
    assert.equal(buildTimeline(file).divergedAt, null);
});

test('the skip button shows from the first credit, not during the epilogue, and Esc skips too', (t) => {
    const env = installInputEnvironment(t);
    const skip = Object.assign(new EventTarget(), { hidden: true });
    const root = {
        isConnected: true,
        querySelector: (selector) =>
            selector === '[data-skip-credits]' ? skip : null,
        querySelectorAll: () => [],
    };
    assert.equal(creditsSkippable(parkedAt(E.stare + 1).getSnapshot()), false);
    assert.equal(
        creditsSkippable(parkedAt(E.ultraWide + 0.5).getSnapshot()),
        false,
        'not during the still second either',
    );
    const game = parkedAt(E.credits + 2);
    const unbind = bindInput(root, game);
    try {
        skip.dispatchEvent(new Event('click'));
        assert.equal(endingOf(game), C.closing, 'the button skips');
    } finally {
        unbind();
    }
    const keyed = parkedAt(E.credits + 2);
    const unbindKeyed = bindInput(root, keyed);
    try {
        env.key('keydown', 'Escape');
        assert.equal(endingOf(keyed), C.closing, 'Esc skips');
        assert.equal(keyed.status().mode, 'play', 'instead of pausing');
    } finally {
        unbindKeyed();
    }
});

test('the preview registers the ultra-wide, credits and title markers', () => {
    const credits = previewScenes
        .find((scene) => scene.id === 'orbit-ending-credits')
        .create();
    const labels = credits.markers.map((marker) => marker.label).join('\n');
    for (const label of [
        'Ultra-wide',
        'Credits start',
        'Credits end',
        'Title',
    ]) {
        assert.ok(labels.includes(label), label);
    }
    const title = credits.markers.find((marker) => marker.label === 'Title');
    assert.equal(credits.sample(title.at + 0.2).state.mode, 'intro');
    assert.ok(
        previewScenes.some((scene) => scene.id === 'orbit-ending-credits-skip'),
    );
});
