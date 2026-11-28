import type { RenderCtx } from '../../context';

const DOOR = { w: 70, h: 124, period: 11 };
const smooth = (v: number) => v * v * (3 - 2 * v);

function doorOpening(t: number): number {
    const u = t % DOOR.period;
    if (u < 6) {
        return 0;
    }
    if (u < 7) {
        return smooth(u - 6);
    }
    if (u < 9.4) {
        return 1;
    }
    if (u < 9.8) {
        return 1 - smooth((u - 9.4) / 0.4);
    }
    return 0;
}

export function floatingDoor(
    ctx: RenderCtx,
    top: number,
    height: number,
): void {
    const span = ctx.VW + 500;
    const travel = (ctx.cam * 0.22 + ctx.t * 16) % span;
    const x = ctx.cam + ctx.VW + 250 - travel;
    const y = top + height * 0.17 + Math.sin(ctx.t * 0.7) * 18;
    const open = doorOpening(ctx.t);
    ctx.withTransform(
        {
            ox: x,
            oy: y,
            rotation: Math.sin(ctx.t * 0.42) * 0.22 * (1 - open * 0.7),
            localScale: 0.72,
        },
        () => drawDoor(ctx, open),
    );
}

const WOOD = {
    frame: '#d9d4c6',
    frameShade: '#a9a291',
    leaf: '#efebe0',
    leafShade: '#cfc8b6',
    panel: '#ddd6c5',
    flake: '#9c8f78',
    vine: '#4f7a3a',
    leafGreen: '#6fa34c',
};

function drawDoor(ctx: RenderCtx, open: number) {
    const hw = DOOR.w / 2;
    const hh = DOOR.h / 2;
    ctx.rect(-hw - 9, -hh - 9, DOOR.w + 18, DOOR.h + 12, WOOD.frame);
    ctx.rect(-hw - 9, -hh - 9, 4, DOOR.h + 12, WOOD.frameShade);
    ctx.rect(-hw - 12, hh + 2, DOOR.w + 24, 6, WOOD.frameShade);
    ctx.rect(-hw, -hh, DOOR.w, DOOR.h, '#1b1d2a');
    if (open > 0) {
        afterworldPeek(ctx, hw, hh, open);
    }
    const leaf = hw * 2 * Math.cos((open * Math.PI) / 2.2);
    const skew = 10 * Math.sin((open * Math.PI) / 2.2);
    ctx.gradientPolygon(
        [
            [-hw, -hh],
            [-hw + leaf, -hh - skew],
            [-hw + leaf, hh + skew],
            [-hw, hh],
        ],
        ctx.gradientFill(-hw, 0, -hw + DOOR.w, 0, {
            stops: [
                [0, WOOD.leaf],
                [0.7, WOOD.leaf],
                [1, WOOD.leafShade],
            ],
        }),
    );
    if (leaf > 18) {
        const k = leaf / DOOR.w;
        const px = (u: number) => -hw + leaf * u;
        for (const [top, bottom] of [
            [-hh + 10, -6],
            [6, hh - 10],
        ]) {
            ctx.polygon(
                [
                    [px(0.18), top - skew * 0.4],
                    [px(0.82), top - skew * 0.8],
                    [px(0.82), bottom + skew * 0.8],
                    [px(0.18), bottom + skew * 0.4],
                ],
                WOOD.panel,
            );
        }
        for (const [u, v, r] of [
            [0.3, -40, 3.5],
            [0.7, -18, 2.5],
            [0.25, 30, 4],
            [0.6, 48, 2],
        ]) {
            ctx.ellipse(px(u), v, r * k, r * 0.7, { c: WOOD.flake });
        }
        ctx.ellipse(px(0.86), 4, 4 * k, 4, { c: '#b38b45' });
    }
    vines(ctx, hw, hh);
}

function vines(ctx: RenderCtx, hw: number, hh: number) {
    ctx.strokePath(
        [-hw - 7, hh + 4],
        [
            [-hw - 14, hh - 30, -hw + 2, hh - 50, -hw - 8, hh - 80],
            [-hw - 16, hh - 100, -hw, -hh + 10, -hw + 14, -hh - 7],
            [-hw + 30, -hh - 14, -hw + 40, -hh - 2, -hw + 52, -hh - 8],
        ],
        { width: 2.5, color: WOOD.vine },
    );
    for (const [x, y, a] of [
        [-hw - 11, hh - 22, -0.6],
        [-hw - 4, hh - 62, 0.5],
        [-hw - 12, hh - 92, -0.4],
        [-hw - 2, -hh + 18, 0.7],
        [-hw + 24, -hh - 12, -0.3],
        [-hw + 46, -hh - 6, 0.4],
    ]) {
        ctx.withTransform({ ox: x, oy: y, rotation: a }, () => {
            ctx.ellipse(0, 0, 5, 2.6, { c: WOOD.leafGreen });
        });
    }
}

function afterworldPeek(ctx: RenderCtx, hw: number, hh: number, open: number) {
    ctx.gradientPolygon(
        [
            [-hw, -hh],
            [hw, -hh],
            [hw, hh],
            [-hw, hh],
        ],
        ctx.gradientFill(0, -hh, 0, hh, {
            stops: [
                [0, '#1c2350'],
                [0.6, '#5a4a8a'],
                [1, '#e9a27a'],
            ],
            alpha: open,
        }),
    );
    for (const [x, y] of [
        [-24, -50],
        [10, -42],
        [22, -24],
        [-12, -30],
        [-26, -10],
        [28, -54],
    ]) {
        ctx.ellipse(x, y, 1.3, 1.3, { c: ctx.tint('#fff6d8', open) });
    }
    ctx.rect(-hw + 8, 18, DOOR.w - 16, 5, ctx.tint('#a0784a', open));
    ctx.rect(-hw + 12, 23, 4, 30, ctx.tint('#7a5a38', open));
    ctx.rect(hw - 16, 23, 4, 30, ctx.tint('#7a5a38', open));
    ctx.rect(-12, -6, 24, 18, ctx.tint('#4b5866', open));
    ctx.rect(-10, -4, 20, 13, ctx.tint('#9fd6ff', open));
    ctx.rect(-2, 12, 4, 6, ctx.tint('#4b5866', open));
    ctx.rect(-hw + 6, hh - 8, DOOR.w - 12, 8, ctx.tint('#5f8a4a', open));
}
