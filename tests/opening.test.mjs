import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled } from './support/load.mjs';

const {
    createGame,
    createOpening,
    createRenderCtx,
    drawOpening,
    openingFrame,
    openingSounds,
    openingState,
    OPENING_BEATS,
    OPENING_DURATION,
    OPENING_SOUND_CUES,
    SOUNDS,
    translate,
    previewScenes,
} = await bundled({
    loader: { '.wav': 'dataurl' },
    stdin: {
        resolveDir: process.cwd(),
        contents: `
    export { createGame } from './src/game/game';
    export { createOpening } from './src/ui/opening';
    export { createRenderCtx } from './tests/support/render-context';
    export { drawOpening, openingFrame, openingState, OPENING_BEATS, OPENING_DURATION } from './src/render/scene/opening';
    export { openingSounds, OPENING_SOUND_CUES } from './src/presentation/opening-sfx';
    export { SOUNDS } from './src/ui/sfx';
    export { translate } from './src/i18n';
    export { previewScenes } from './src/preview-scenes';
`,
    },
});
const B = OPENING_BEATS;

test('the opening plays once per page load after either a skip or a full run', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const scene = { append() {} };
    /** @type {any} */ (globalThis).window = { addEventListener() {} };
    /** @type {any} */ (globalThis).document = {
        createElement: () => ({
            setAttribute() {},
            append() {},
            addEventListener() {},
            focus() {},
            remove() {},
        }),
    };
    const root = { querySelector: () => scene };

    try {
        const skipped = createOpening(root, () => 'en');
        assert.equal(skipped.seen, false);
        let finished = 0;
        skipped.start(() => finished++);
        assert.equal(skipped.active, true);
        skipped.skip();
        assert.equal(finished, 1);
        assert.equal(skipped.seen, true);
        skipped.destroy();

        const reloaded = createOpening(root, () => 'en');
        assert.equal(reloaded.seen, false);
        reloaded.start(() => finished++);
        reloaded.advance(OPENING_DURATION);
        assert.equal(finished, 2);
        assert.equal(reloaded.seen, true);
        reloaded.destroy();

        const nextLoad = createOpening(root, () => 'en');
        assert.equal(nextLoad.seen, false);
        nextLoad.destroy();
    } finally {
        /** @type {any} */ (globalThis).window = originalWindow;
        /** @type {any} */ (globalThis).document = originalDocument;
    }
});

function render(time, locale = 'ko') {
    const ctx = createRenderCtx({});
    const game = createGame();
    game.reset();
    const frame = openingFrame(time);
    const state = openingState(game.getSnapshot(), frame);
    Object.assign(ctx, {
        state,
        player: state.player,
        mode: state.mode,
        locale,
        t: state.time,
        W: 800,
        H: 510,
        VW: 800 / frame.zoom,
        scale: frame.zoom,
        cam: state.player.x - 400 / frame.zoom,
        vertical: 0,
        LEN: state.level.length,
        GOAL: state.level.goal,
        solids: state.solids,
        people: state.people,
        cleaning: state.cleaning,
        bin: { ...state.bin, bottom: 520 },
        copier: { ...state.copier, flash: 0 },
        papers: state.papers,
        monitors: [],
        urgentCopier: state.urgentCopier,
    });
    drawOpening(ctx, frame);
    for (const cmd of ctx.commands) {
        for (const point of cmd.points) {
            for (const n of point) {
                assert.ok(Number.isFinite(n), `finite point at t=${time}`);
            }
        }
        for (const curve of cmd.curves ?? []) {
            for (const n of curve) {
                assert.ok(Number.isFinite(n), `finite curve at t=${time}`);
            }
        }
    }
    const labels = ctx.commands
        .filter((cmd) => cmd.text)
        .map(({ text }) => ({
            text: text.content,
            x: text.x,
            y: text.y,
            alpha: text.opacity ?? 1,
        }));
    return { frame, commands: ctx.commands, labels };
}

test('the clock walks from 6 pm to 9 pm and never runs backwards', () => {
    assert.equal(openingFrame(B.sixPm).hours, 18);
    assert.equal(openingFrame(B.sevenPm).hours, 19);
    assert.equal(openingFrame(B.eightPm).hours, 20);
    assert.equal(openingFrame(B.ninePm).hours, 21);
    let last = 0;
    for (let t = 0; t <= OPENING_DURATION; t += 1 / 60) {
        const { hours } = openingFrame(t);
        assert.ok(hours >= last, `clock went back at ${t}`);
        last = hours;
    }
    assert.ok(openingFrame((B.spinToEight + B.eightPm) / 2).spin > 0.9);
    assert.equal(openingFrame(B.sevenPm + 0.1).spin, 0);
});

test('beats switch between the clock and the office in the planned order', () => {
    assert.equal(openingFrame(0.5).shot, 'clock');
    assert.equal(openingFrame(B.irisOpen + 0.3).shot, 'office');
    assert.ok(openingFrame(B.irisOpen + 0.3).iris > 0);
    assert.equal(openingFrame(B.riderOvertime + 0.1).iris, null);
    assert.equal(
        openingFrame(B.chairHope + 0.5).zoom,
        openingFrame(B.rage).zoom,
    );
    assert.ok(
        openingFrame(B.chairHope + 0.5).zoom >
            openingFrame(B.riderSales).zoom * 2,
    );
    assert.equal(openingFrame(B.spinToNine).shot, 'clock');
    assert.equal(openingFrame(B.rage + 0.5).shot, 'office');
    assert.equal(openingFrame(B.rage + 0.5).dusk, 1);
    assert.equal(openingFrame(OPENING_DURATION).handoff, 1);
    assert.equal(openingFrame(OPENING_DURATION).lighting, 0);
    assert.equal(openingFrame(OPENING_DURATION).done, true);
    assert.equal(openingFrame(OPENING_DURATION - 0.01).done, false);
});

test('the worker talks first, the chair hopes, then the chair snaps while the worker keeps typing', () => {
    const said = (t) =>
        openingFrame(t).bubbles.map(
            (b) => `${b.speaker}:${b.style}:${b.message}`,
        );
    assert.deepEqual(said(B.riderOvertime + 0.5), [
        'rider:solid:opening.riderOvertime',
    ]);
    assert.deepEqual(said(B.riderSales + 0.5), [
        'rider:solid:opening.riderSales',
    ]);
    assert.deepEqual(said(B.chairHope + 1), ['chair:glass:opening.chairHope']);
    assert.deepEqual(said(B.riderTyping + 0.5), [
        'chair:rage:opening.chairRage',
        'rider:solid:opening.riderTyping',
    ]);
    assert.deepEqual(said(1), []);
    assert.deepEqual(said(B.spinToNine), []);
    for (const t of [B.riderOvertime, B.chairHope + 0.1, B.rage]) {
        for (const bubble of openingFrame(t + 1).bubbles) {
            for (const locale of ['en', 'ko']) {
                assert.ok(translate(bubble.message, locale).length > 0);
            }
        }
    }
    assert.ok(openingFrame(B.chairHope + 1).hum > 0.9);
    assert.ok(openingFrame(B.rage + 1).rage > 0.9);
});

test('7 pm the chair creaks harder and faster; 8 pm the backrest bucks the worker', () => {
    const at = (t) => openingFrame(t);
    for (const t of [B.creak + 1, B.kick + 0.5]) {
        assert.equal(at(t).shot, 'office');
    }
    assert.equal(at(B.spinToEight + 0.5).shot, 'clock');
    assert.equal(
        at(B.creak + 1).zoom,
        at(B.rage).zoom,
        'both are close-ups on the chair',
    );
    const loudest = (from, to) =>
        Math.max(
            ...Array.from(
                { length: 120 },
                (_, i) => at(from + ((to - from) * i) / 120).creakPulse,
            ),
        );
    assert.ok(
        loudest(B.creakClose - 1.2, B.creakClose - 0.2) >
            loudest(B.creak, B.creak + 1) + 0.2,
    );
    assert.equal(at(B.kick - 0.1).chair.backrest, 0);
    assert.ok(
        at(B.kick + 0.17).chair.backrest < -0.4,
        'the backrest leans back',
    );
    assert.ok(
        Math.max(
            ...Array.from(
                { length: 60 },
                (_, i) => at(B.kick + 0.3 + i / 100).chair.riderPop,
            ),
        ) > 20,
        'the worker is thrown up',
    );
    assert.ok(
        at(B.kick + 2).bubbles.some((b) => b.message === 'opening.riderTyping'),
        'and he types on',
    );
    const kick = render(B.kick + 0.5);
    assert.ok(
        !kick.commands.some((c) => c.layer?.key === 'opening-anger'),
        'no anger marks at 8 pm',
    );
    for (const t of [
        B.riderOvertime + 1,
        B.chairHope + 1,
        B.creak + 1,
        B.kick + 0.5,
    ]) {
        assert.ok(
            !render(t).commands.some(
                (c) =>
                    !c.text &&
                    c.stroke &&
                    typeof c.fill === 'string' &&
                    c.fill.startsWith('#f4f1ea'),
            ),
            `no keycap hints in the film at ${t}`,
        );
    }
});

test('the cutscene state only poses the chair; the core snapshot is untouched', () => {
    const game = createGame();
    game.reset();
    const base = game.getSnapshot();
    const copy = structuredClone(base);
    const posed = openingState(base, openingFrame(B.rage + 0.3));
    assert.deepEqual(base, copy);
    assert.equal(posed.player.x, base.player.x);
    assert.equal(posed.time, B.rage + 0.3);
});

test('clock frames use one ThorVG mask, trims, clips and blur', () => {
    const iris = render(B.irisOpen + 0.4);
    assert.ok(
        !iris.commands.some((c) => c.layer?.mask),
        'clock layers carry no mask of their own',
    );
    const open = iris.commands.findIndex((c) => c.kind === 'group' && c.group);
    const close = iris.commands.findIndex(
        (c) => c.kind === 'group' && !c.group,
    );
    assert.ok(open > 0 && close > open, 'the clock is drawn before the office');
    const { group } = iris.commands[open];
    assert.ok(group.mask && !group.maskInvert && !group.clip);
    assert.ok(
        iris.commands
            .slice(0, open)
            .some((c) => c.layer?.key === 'opening-clock-ticks'),
        'the dial ticks are retained geometry',
    );
    assert.ok(
        iris.commands.slice(open + 1, close).some((c) => !c.layer),
        'the office shows inside the iris',
    );
    assert.ok(
        !iris.commands.some((c) => c.layer?.key === 'opening-clock-shadow'),
        'the clock shadow is a radial gradient, not a blurred layer',
    );

    let inGroup = false;
    const blendInGroup = [];
    const blendLayers = [];
    for (const c of iris.commands.slice(open)) {
        if (c.kind === 'group') {
            inGroup = !!c.group;
            continue;
        }
        if (c.layer?.blend && c.layer.blend !== 'normal') {
            (inGroup ? blendInGroup : blendLayers).push(c.layer);
        }
    }
    assert.deepEqual(
        blendInGroup.map((l) => l.key),
        [],
        'blend layers stay outside the masked group so they blend with the office',
    );
    assert.ok(
        blendLayers.some((l) => l.key === 'opening-sunbeams'),
        'the sunbeams still screen over the office',
    );
    assert.ok(
        blendLayers.every((l) => l.clip && !l.mask),
        'blend layers take the iris as a clip, not a mask',
    );

    const wide = render(B.riderOvertime - 0.1);
    const covered = new Set(
        wide.commands
            .filter((c) => c.layer?.key?.startsWith('opening-clock-'))
            .map((c) => c.layer.key),
    );
    assert.ok(
        !covered.has('opening-clock-ticks') &&
            !covered.has('opening-clock-glass'),
        'clock parts inside the iris are not drawn',
    );

    const closed = render(B.sixPm + 0.5);
    assert.ok(
        !closed.commands.some((c) => c.kind === 'group'),
        'a closed iris needs no office group',
    );

    const spin = render((B.spinToNine + B.ninePm) / 2);
    assert.ok(
        spin.commands.some((c) => c.trim && c.stroke),
        'minute trail is a trimmed stroke',
    );
    assert.ok(
        spin.commands.some(
            (c) => c.layer?.key === 'opening-clock-ghost' && c.layer.blur > 0,
        ),
    );
    assert.ok(
        spin.commands.some((c) => c.layer?.clip),
        'window view is clipped',
    );
    assert.equal(spin.labels.length, 0, 'no words on the clock');
});

test('office frames light the scene and draw the bubbles with their words', () => {
    const wide = render(B.riderOvertime + 1.5);
    assert.ok(
        wide.commands.some(
            (c) =>
                c.layer?.key === 'opening-dusk' && c.layer.blend === 'multiply',
        ),
    );
    assert.ok(
        wide.commands.some(
            (c) =>
                c.layer?.key === 'opening-sunbeams' &&
                c.layer.blend === 'screen',
        ),
    );
    assert.ok(
        wide.labels.some(
            (l) =>
                l.text ===
                translate('opening.riderOvertime', 'ko').replace('…', '...'),
        ),
    );

    const hope = render(B.chairHope + 2.5);
    const chairBubble = hope.commands.find(
        (c) => c.layer?.key === 'opening-bubble-0' && !c.text && c.stroke,
    );
    const riderBubble = wide.commands.find(
        (c) => c.layer?.key === 'opening-bubble-0' && !c.text && c.stroke,
    );
    assert.notEqual(
        chairBubble.fill,
        riderBubble.fill,
        'the chair and the worker have bubbles of their own colour',
    );
    assert.ok(
        hope.commands.some(
            (c) => c.layer?.key.endsWith('-glow') && c.layer.blur > 0,
        ),
        'the chair bubble glows',
    );
    assert.ok(hope.commands.some((c) => c.layer?.key === 'opening-notes'));
    assert.ok(
        hope.commands.some((c) => c.layer?.key.endsWith('-note')),
        'the chair hums a drawn note in place of the missing ♪ glyph',
    );
    assert.ok(hope.labels.every((l) => !l.text.includes('♪')));

    const rage = render(B.riderTyping + 1);
    assert.ok(
        rage.commands.some(
            (c) => c.layer?.key === 'opening-laptop' && c.layer.blend === 'add',
        ),
    );
    assert.ok(
        !rage.commands.some(
            (c) => c.layer?.key === 'opening-rage' && c.stroke?.dash,
        ),
        'no dashed lines round the chair',
    );
    assert.ok(
        rage.commands.some((c) => c.layer?.key === 'opening-chair-afterimage'),
        'the chair trembles in afterimages',
    );
    assert.ok(
        rage.commands.some((c) => c.layer?.key === 'opening-floor-dust'),
        'dust jumps off the floor',
    );
    assert.ok(
        !render(B.chairHope + 1).commands.some(
            (c) => c.layer?.key === 'opening-chair-afterimage',
        ),
        'calm before 9 pm',
    );
    const words = rage.labels.map((l) => l.text).join(' ');
    assert.ok(words.includes(translate('opening.riderTyping', 'ko')));
    assert.ok(words.includes('극악무도'), 'the rage line has typed out');
});

test('the opening preview is registered and seeks deterministically', () => {
    const scene = previewScenes
        .find((scene) => scene.id === 'opening')
        ?.create();
    assert.ok(scene);
    assert.equal(scene.duration, OPENING_DURATION);
    assert.ok(scene.markers.some((marker) => marker.at === B.rage));
    const at = scene.sample(B.chairHope + 1);
    scene.sample(0);
    assert.deepEqual(scene.sample(B.chairHope + 1), at);
    assert.deepEqual(scene.opening(B.rage), openingFrame(B.rage));
});

test('opening sound cues track the timeline beats, stay silent before rage and have recipes', () => {
    let lastAt = -1;
    for (const cue of OPENING_SOUND_CUES) {
        assert.ok(cue.at >= 0 && cue.at < OPENING_DURATION, cue.sound);
        assert.ok(cue.at >= lastAt, `out-of-order cue ${cue.sound}`);
        assert.ok(SOUNDS[cue.sound], `missing synth recipe ${cue.sound}`);
        lastAt = cue.at;
    }
    const heard = [];
    let prev = -0.001;
    for (let step = 0; step <= Math.ceil(OPENING_DURATION * 60); step++) {
        const next = Math.min(OPENING_DURATION, step / 60);
        heard.push(...openingSounds(prev, next));
        prev = next;
    }
    assert.deepEqual(
        heard,
        OPENING_SOUND_CUES.map((cue) => cue.sound),
    );
    assert.deepEqual(openingSounds(null, 1), []);
    assert.deepEqual(openingSounds(5, 4), []);
    assert.deepEqual(
        openingSounds(B.darkChair, B.rage - 0.01),
        [],
        'the dark chair pause before rage stays silent',
    );
    assert.deepEqual(openingSounds(B.rage - 0.01, B.rage), ['openingRageSnap']);
    for (const cue of OPENING_SOUND_CUES) {
        if (cue.sound.startsWith('openingCreak')) {
            assert.ok(
                openingFrame(cue.at + 0.05).creakPulse > 0.2,
                `creak cue aligns with visual pulse at ${cue.at}`,
            );
        }
    }
});
