import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSource } from './support/load.mjs';

const { createRenderCtx, drawSky } = await loadSource(`
    export { createRenderCtx } from './tests/support/render-context';
    export { drawSky } from './src/render/scene/sky';
`);

function cloudsAt(drift) {
    const ctx = createRenderCtx({});
    ctx.cam = 3400;
    ctx.t = (drift - ctx.cam * 0.18) / 4;
    const clouds = new Map();
    ctx.effectPath = (start, curves, fill) => {
        if (
            JSON.stringify(fill.stops?.[0]?.[1]) !==
            JSON.stringify(ctx.rgba('#f8d98d', 0.72))
        ) {
            return;
        }
        const x = ctx.ox - ctx.cam;
        if (x < 200 || x > 850) {
            return;
        }
        clouds.set(JSON.stringify(curves), {
            x,
            y: ctx.oy,
            size: ctx.localScale,
        });
    };
    drawSky(ctx);
    return clouds;
}

for (const boundary of [-290, 0, 290, 870]) {
    test(`clouds retain their identity and appearance across drift ${boundary}`, () => {
        const before = cloudsAt(boundary - 0.00001);
        const after = cloudsAt(boundary + 0.00001);
        assert.ok(before.size > 0);
        assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
        for (const [shape, cloud] of before) {
            const next = after.get(shape);
            assert.equal(next.y, cloud.y);
            assert.equal(next.size, cloud.size);
            assert.ok(Math.abs(next.x - cloud.x) < 0.001);
        }
    });
}
