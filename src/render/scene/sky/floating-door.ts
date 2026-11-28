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

function drawDoor(ctx: RenderCtx, open: number) {
    const hw = DOOR.w / 2;
    const hh = DOOR.h / 2;
    ctx.ellipse(0, hh + 30, hw + 6, 6, { c: '#2f4a6020' });
    ctx.rect(-hw - 6, -hh - 6, DOOR.w + 12, DOOR.h + 12, '#d65c92');
    ctx.rect(-hw, -hh, DOOR.w, DOOR.h, '#2b2420');
    if (open > 0) {
        officePeek(ctx, hw, hh, open);
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
                [0, '#ff9cc6'],
                [0.6, '#f27bb0'],
                [1, '#e0629a'],
            ],
        }),
    );
    if (leaf > 18) {
        const k = leaf / DOOR.w;
        ctx.ellipse(-hw + leaf - 10 * k, 4, 4 * k, 4, { c: '#f7d36b' });
        ctx.rect(-hw + 8 * k, -hh + 12, leaf - 16 * k, 2, '#ffc2dc');
    }
}

function officePeek(ctx: RenderCtx, hw: number, hh: number, open: number) {
    ctx.gradientPolygon(
        [
            [-hw, -hh],
            [hw, -hh],
            [hw, hh],
            [-hw, hh],
        ],
        ctx.gradientFill(0, -hh, 0, hh, {
            stops: [
                [0, '#fff3c4'],
                [1, '#d8c79a'],
            ],
            alpha: open,
        }),
    );
    ctx.rect(-hw + 8, 18, DOOR.w - 16, 5, ctx.tint('#a0784a', open));
    ctx.rect(-hw + 12, 23, 4, 30, ctx.tint('#7a5a38', open));
    ctx.rect(hw - 16, 23, 4, 30, ctx.tint('#7a5a38', open));
    ctx.rect(-12, -6, 24, 18, ctx.tint('#4b5866', open));
    ctx.rect(-10, -4, 20, 13, ctx.tint('#9fd6ff', open));
    ctx.rect(-2, 12, 4, 6, ctx.tint('#4b5866', open));
    for (let i = 0; i < 3; i++) {
        ctx.rect(-hw + 10, -hh + 12 + i * 7, 22, 4, ctx.tint('#f4f1e6', open));
    }
}
