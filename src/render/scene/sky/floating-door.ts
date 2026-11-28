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
            localScale: 0.95,
        },
        () => drawDoor(ctx, open),
    );
}

const WOOD = {
    frame: '#f1efe8',
    leaf: '#f4f2ec',
    leafShade: '#d9d6cc',
    trim: '#5c7fc4',
    flake: '#c9864a',
    flakeDark: '#9a5e2e',
    vine: '#4f7a3a',
    leafGreen: '#7cc25a',
    knob: '#c9a24a',
};
const PANELS: ReadonlyArray<[number, number, number, number]> = [
    [0.14, 0.47, 0.06, 0.2],
    [0.53, 0.86, 0.06, 0.2],
    [0.14, 0.47, 0.26, 0.56],
    [0.53, 0.86, 0.26, 0.56],
    [0.14, 0.47, 0.64, 0.94],
    [0.53, 0.86, 0.64, 0.94],
];
const FLAKES: ReadonlyArray<[number, number, number, number]> = [
    [0.3, 0.17, 5, 2.5],
    [0.92, 0.38, 3, 7],
    [0.36, 0.5, 4, 5],
    [0.5, 0.6, 7, 2],
    [0.7, 0.86, 7, 6],
    [0.3, 0.9, 5, 4],
    [0.55, 0.985, 9, 1.6],
    [0.06, 0.8, 2.5, 5],
];

function drawDoor(ctx: RenderCtx, open: number) {
    const hw = DOOR.w / 2;
    const hh = DOOR.h / 2;
    ctx.rect(-hw - 8, -hh - 8, DOOR.w + 16, DOOR.h + 12, WOOD.frame);
    ctx.rect(-hw - 2, -hh - 2, DOOR.w + 4, DOOR.h + 2, WOOD.trim);
    ctx.rect(-hw, -hh, DOOR.w, DOOR.h, '#151a33');
    if (open > 0) {
        afterworldPeek(ctx, hw, hh, open);
    }
    const leaf = DOOR.w * Math.cos((open * Math.PI) / 2.2);
    const skew = 10 * Math.sin((open * Math.PI) / 2.2);
    const left = hw - leaf;
    const at = (u: number, v: number): [number, number] => [
        left + leaf * u,
        -hh + DOOR.h * v + (v - 0.5) * 2 * skew * (1 - u),
    ];
    ctx.gradientPolygon(
        [at(0, 0), at(1, 0), at(1, 1), at(0, 1)],
        ctx.gradientFill(left, 0, hw, 0, {
            stops: [
                [0, WOOD.leafShade],
                [0.25, WOOD.leaf],
                [1, WOOD.leaf],
            ],
        }),
    );
    if (leaf > 16) {
        const k = leaf / DOOR.w;
        for (const [u0, u1, v0, v1] of PANELS) {
            const ring = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
            ctx.strokePath(
                ring[0],
                ring.slice(1).map(([px, py]) => [px, py, px, py, px, py]),
                { width: 1.3, color: WOOD.trim },
                { closed: true },
            );
        }
        FLAKES.forEach(([u, v, rx, ry], i) => {
            const [px, py] = at(u, v);
            const jag: Array<[number, number]> = [];
            for (let j = 0; j < 7; j++) {
                const ang = (j / 7) * Math.PI * 2;
                const r = 0.55 + 0.45 * Math.abs(Math.sin(i * 3.7 + j * 2.3));
                jag.push([
                    px + Math.cos(ang) * rx * k * r,
                    py + Math.sin(ang) * ry * r,
                ]);
            }
            ctx.polygon(jag, WOOD.flake);
            ctx.polygon(
                jag.map(([fx, fy]) => [
                    px + (fx - px) * 0.45,
                    py + (fy - py) * 0.45,
                ]),
                WOOD.flakeDark,
            );
        });
        const [kx, ky] = at(0.07, 0.6);
        ctx.ellipse(kx, ky, 3.4 * k + 0.6, 3.4, { c: WOOD.knob });
        ctx.ellipse(kx - k, ky - 1, 1.2 * k, 1.2, { c: '#f3dd96' });
    }
    vines(ctx, hw, hh);
}

function vines(ctx: RenderCtx, hw: number, hh: number) {
    ctx.strokePath(
        [-hw + 26, -hh - 6],
        [
            [-hw + 44, -hh - 14, hw - 14, -hh - 2, hw + 4, -hh - 6],
            [hw + 12, -hh + 20, hw + 2, -hh + 40, hw + 8, -hh + 62],
        ],
        { width: 2, color: WOOD.vine },
    );
    ctx.strokePath(
        [-hw - 4, hh + 4],
        [[-hw - 12, hh - 20, -hw + 2, hh - 36, -hw - 6, hh - 56]],
        { width: 2, color: WOOD.vine },
    );
    for (const [x, y, a] of [
        [-hw + 30, -hh - 10, -0.4],
        [-hw + 42, -hh - 13, 0.5],
        [-hw + 54, -hh - 10, -0.2],
        [hw - 10, -hh - 7, 0.6],
        [hw + 6, -hh + 10, 1.2],
        [hw + 9, -hh + 28, 1.6],
        [hw + 5, -hh + 46, 1.1],
        [hw + 9, -hh + 60, 1.8],
        [-hw - 9, hh - 12, -1.2],
        [-hw - 3, hh - 30, 1.1],
        [-hw - 8, hh - 48, -1.4],
    ]) {
        const c = Math.cos(a);
        const n = Math.sin(a);
        const pt = (u: number, v: number): [number, number] => [
            x + u * c - v * n,
            y + u * n + v * c,
        ];
        ctx.polygon(
            [pt(-6, 0), pt(-1, -4), pt(6, 0), pt(-1, 4)],
            WOOD.leafGreen,
        );
        ctx.rod(...pt(-5, 0), ...pt(5, 0), { w: 0.8, c: WOOD.vine });
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
