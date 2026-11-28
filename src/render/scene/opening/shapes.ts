import type { RenderCtx } from '../../context';
import type {
    Bounds,
    Curve,
    DrawCommand,
    PathCommand,
    Gradient,
    Stroke,
    Vector,
} from '../../types';
const K = 0.5522847498;
export class PathBuilder {
    readonly start: Vector;
    readonly curves: Curve[] = [];
    private at: Vector;
    constructor(x: number, y: number) {
        this.start = [x, y];
        this.at = [x, y];
    }
    line(x: number, y: number): this {
        this.curves.push([...this.at, x, y, x, y]);
        this.at = [x, y];
        return this;
    }
    cubic(
        ax: number,
        ay: number,
        bx: number,
        by: number,
        {
            x,
            y,
        }: {
            x: number;
            y: number;
        },
    ): this {
        this.curves.push([ax, ay, bx, by, x, y]);
        this.at = [x, y];
        return this;
    }
    corner(cx: number, cy: number, x: number, y: number): this {
        const [px, py] = this.at;
        return this.cubic(
            px + (cx - px) * K,
            py + (cy - py) * K,
            x + (cx - x) * K,
            y + (cy - y) * K,
            {
                x,
                y,
            },
        );
    }
    command(
        fill: string | Gradient | null,
        stroke?: Stroke,
        open = false,
    ): PathCommand {
        const cmd: PathCommand = {
            kind: 'path',
            points: [this.start],
            curves: this.curves,
            fill,
        };
        if (stroke) {
            cmd.stroke = stroke;
        }
        if (open) {
            cmd.open = true;
        }
        return cmd;
    }
}
export function circle(
    cx: number,
    cy: number,
    rx: number,
    ry = rx,
): PathBuilder {
    return new PathBuilder(cx + rx, cy)
        .corner(cx + rx, cy + ry, cx, cy + ry)
        .corner(cx - rx, cy + ry, cx - rx, cy)
        .corner(cx - rx, cy - ry, cx, cy - ry)
        .corner(cx + rx, cy - ry, cx + rx, cy);
}
export function dialCircle(cx: number, cy: number, r: number): PathBuilder {
    return new PathBuilder(cx, cy - r)
        .corner(cx + r, cy - r, cx + r, cy)
        .corner(cx + r, cy + r, cx, cy + r)
        .corner(cx - r, cy + r, cx - r, cy)
        .corner(cx - r, cy - r, cx, cy - r);
}
export function push(ctx: RenderCtx, cmd: DrawCommand): void {
    if (ctx.layer) {
        cmd.layer = ctx.layer;
    }
    ctx.commands.push(cmd);
}
export function polygon(
    ctx: RenderCtx,
    points: Vector[],
    fill: string | Gradient,
): void {
    push(ctx, { kind: 'path', points, fill });
}
/**
 * Covers the screen, or only its overlap with `within` when the rest would
 * be clipped away or carries no colour anyway.
 */
export function screenRect(
    ctx: RenderCtx,
    fill: string | Gradient,
    within?: Bounds | null,
): void {
    const left = Math.max(-4, within?.left ?? -4);
    const top = Math.max(-4, within?.top ?? -4);
    const right = Math.min(ctx.W + 4, within?.right ?? ctx.W + 4);
    const bottom = Math.min(ctx.H + 4, within?.bottom ?? ctx.H + 4);
    if (right <= left || bottom <= top) {
        return;
    }
    polygon(
        ctx,
        [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom],
        ],
        fill,
    );
}
/** Sutherland-Hodgman: the part of a convex polygon inside `box`. */
export function clipPolygon(points: Vector[], box: Bounds): Vector[] {
    const edges: Array<[number, number, number]> = [
        [0, 1, box.left],
        [0, -1, -box.right],
        [1, 1, box.top],
        [1, -1, -box.bottom],
    ];
    let out = points;
    for (const [axis, sign, limit] of edges) {
        const input = out;
        out = [];
        const inside = (p: Vector) => p[axis] * sign >= limit;
        for (let i = 0; i < input.length; i++) {
            const a = input[i];
            const b = input[(i + 1) % input.length];
            if (inside(a)) {
                out.push(a);
            }
            if (inside(a) !== inside(b)) {
                const u = (limit / sign - a[axis]) / (b[axis] - a[axis]);
                out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
            }
        }
    }
    return out;
}
export function linear(
    ctx: RenderCtx,
    from: Vector,
    to: Vector,
    stops: Array<[number, string]>,
    alpha = 1,
): Gradient {
    return {
        from,
        to,
        stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]),
    };
}
export function radial(
    ctx: RenderCtx,
    cx: number,
    cy: number,
    r: number,
    {
        stops,
        alpha = 1,
    }: {
        stops: Array<[number, string]>;
        alpha?: number;
    },
): Gradient {
    return {
        from: [cx, cy],
        to: [cx + r, cy],
        radius: r,
        stops: stops.map(([at, color]) => [at, ctx.rgba(color, alpha)]),
    };
}
export function mix(a: string, b: string, u: number): string {
    const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return (
        '#' +
        ca
            .map((v, i) =>
                Math.round(v + (cb[i] - v) * u)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}
export function rotate(
    [x, y]: Vector,
    [cx, cy]: Vector,
    angle: number,
): Vector {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}
