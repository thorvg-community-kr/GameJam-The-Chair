import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSource } from './support/load.mjs';
const { createRenderCtx, breadCloud, puffCloud, CLOUD_TONES } =
    await loadSource(`
    export { createRenderCtx } from './tests/support/render-context';
    export { breadCloud } from './src/render/scene/shared/cloud-art';
    export { puffCloud, CLOUD_TONES } from './src/render/scene/shared/cloud-art';
`);
const context = () =>
    Object.assign(createRenderCtx({}), {
        W: 1000,
        H: 510,
        scale: 1,
        cam: 0,
        vertical: 0,
    });
test('shared bread clouds use the exact stage four silhouette, gradients and underside fade', () => {
    for (const near of [false, true]) {
        const retained = context();
        const reference = context();
        breadCloud(retained, 500, 300, 1, {
            seed: 901,
            near,
        });
        puffCloud(reference, 500, 300, 1, {
            seed: 901,
            tone: CLOUD_TONES.bread,
            options: {
                alpha: near ? 0.95 : 0.72,
                fade: true,
            },
        });
        assert.deepEqual(retained.commands, reference.commands);
    }
});
test('moving clouds reuse retained local geometry and only change the Scene transform', () => {
    const ctx = context();
    breadCloud(ctx, 500, 300, 1, { seed: 902 });
    const first = ctx.commands;
    ctx.commands = [];
    ctx.cam = 40;
    breadCloud(ctx, 520, 310, 1.2, { seed: 902 });
    const second = ctx.commands;
    assert.equal(second.length, first.length);
    assert.equal(second[0].points, first[0].points, 'geometry is cached');
    assert.equal(second[0].layer.key, first[0].layer.key);
    assert.equal(
        second[0].layer.retained.geometry,
        first[0].layer.retained.geometry,
    );
    assert.notDeepEqual(
        second[0].layer.retained.transform,
        first[0].layer.retained.transform,
    );
});
test('fading clouds keep their Scene slot while their geometry key changes', () => {
    const ctx = context();
    const draw = (alpha) => {
        ctx.commands = [];
        puffCloud(ctx, 500, 300, 1, {
            seed: 903,
            tone: CLOUD_TONES.dusk,
            options: { alpha },
        });
        return ctx.commands[0].layer;
    };
    const opaque = draw(1);
    const faded = draw(0.4);
    assert.equal(faded.key, opaque.key);
    assert.notEqual(faded.retained.geometry, opaque.retained.geometry);
});
test('clouds inside an effect layer keep that layer instead of a retained Scene', () => {
    const ctx = context();
    const layer = { key: 'soft', opacity: 0.75 };
    ctx.withLayer(layer, () => breadCloud(ctx, 500, 300, 1, { seed: 904 }));
    assert.ok(ctx.commands.length > 0);
    assert.ok(ctx.commands.every((command) => command.layer === layer));
});
test('simplified outlines keep the flat underside and stay compact', () => {
    const ctx = context();
    puffCloud(ctx, 0, 0, 1, {
        seed: 905,
        tone: CLOUD_TONES.bread,
        options: { detail: 'full' },
    });
    const outline = ctx.commands[0];
    assert.ok(outline.curves.length <= 48, `${outline.curves.length} curves`);
    let from = outline.points[0];
    let longestFlat = 0;
    for (const curve of outline.curves) {
        for (let i = 1; i < 6; i += 2) {
            assert.ok(curve[i] <= 35, 'nothing dips below the base');
        }
        if ([from[1], curve[1], curve[3], curve[5]].every((y) => y === 34)) {
            longestFlat = Math.max(longestFlat, Math.abs(curve[4] - from[0]));
        }
        from = [curve[4], curve[5]];
    }
    // Dense samples are about 6 units apart; a flat run collapses into one line.
    assert.ok(longestFlat > 50, 'flat underside runs become single segments');
});
