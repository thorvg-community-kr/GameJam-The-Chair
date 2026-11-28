import type { DrawCommand, Vector } from '../../types';
export type Point3 = [number, number, number];
export type Axes3 = [Point3, Point3, Point3];
export type Decal =
    | { kind: 'poly'; points: Point3[]; color: string }
    | {
          kind: 'oval';
          center: Point3;
          radii: Point3;
          color: string;
          axes?: Axes3;
      };
export type PolygonOptions = {
    shade?: boolean;
    decals?: Decal[];
};
export type RodOptions = {
    sides?: number;
    capA?: boolean;
    capB?: boolean;
    shade?: boolean;
};
export type BoxBounds = {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    z0: number;
    z1: number;
};
const LOD_PIXELS = 4;
const LIGHT_DIR: Point3 = [0.405, 0.695, 0.594];
const add = (a: Point3, b: Point3): Point3 => [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
];
const sub = (a: Point3, b: Point3): Point3 => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
const mul = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Point3) => mul(a, 1 / Math.max(0.0001, Math.hypot(...a)));
const basis = (radii: Point3): Axes3 => [
    [radii[0], 0, 0],
    [0, radii[1], 0],
    [0, 0, radii[2]],
];
function planeBasis(normal: Point3): [Point3, Point3] {
    const n = norm(normal);
    const ref: Point3 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(ref, n));
    const v = cross(n, u);
    return [u, v];
}
function placeAxes(
    place: (p: Point3) => Point3,
    center: Point3,
    radii: Point3,
    axes?: Axes3,
): Axes3 {
    const c = place(center);
    const src = axes ?? basis(radii);
    return [
        sub(place(add(center, src[0])), c),
        sub(place(add(center, src[1])), c),
        sub(place(add(center, src[2])), c),
    ];
}
function placeDecal(place: (p: Point3) => Point3, decal: Decal): Decal {
    if (decal.kind === 'poly') {
        return { ...decal, points: decal.points.map(place) };
    }
    return {
        ...decal,
        center: place(decal.center),
        axes: placeAxes(place, decal.center, decal.radii, decal.axes),
    };
}
function shadeColor(color: string, factor: number): string {
    return (
        '#' +
        [1, 3, 5]
            .map((i) =>
                Math.max(
                    0,
                    Math.min(
                        255,
                        Math.round(
                            parseInt(color.slice(i, i + 2), 16) * factor,
                        ),
                    ),
                )
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('') +
        color.slice(7)
    );
}
function hazeColor(color: string, depth: number): string {
    const haze = Math.min(0.78, Math.max(0, (depth - 1800) / 18000));
    if (haze <= 0) {
        return color;
    }
    return (
        '#' +
        [147, 181, 199]
            .map((channel, i) => {
                const value = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
                return Math.round(value + (channel - value) * haze)
                    .toString(16)
                    .padStart(2, '0');
            })
            .join('') +
        color.slice(7)
    );
}
export type SkyFraming = {
    zoom?: number;
    centerY?: number;
    offsetX?: number;
    roll?: number;
    level?: boolean;
    eyeY?: number;
    distance?: number;
};
export function createSkyProjection(
    width: number,
    height: number,
    orbit: number,
    framing: SkyFraming = {},
): {
    project: (p: Point3) => Vector;
    depth: (p: Point3) => number;
    polygon: (
        points: Point3[],
        color: string,
        options?: PolygonOptions,
    ) => void;
    profile: (
        outline: Vector[],
        halfWidth: number,
        color: string,
        z?: number,
        options?: {
            widthAt?: (x: number, y: number) => number;
            bevel?: number;
            /** Rounds the sides like a head instead of a flat slab; the side cap shrinks to this scale. */
            round?: number;
            place?: (p: Point3) => Point3;
            shade?: boolean;
        },
    ) => void;
    box: (bounds: BoxBounds, color: string, shade?: boolean) => void;
    oval: (center: Point3, radii: Point3, color: string, axes?: Axes3) => void;
    rod: (
        a: Point3,
        b: Point3,
        r: number,
        color: string,
        options?: RodOptions,
    ) => void;
    /** Draws with sort depth pulled toward the camera by `bias`. */
    biased: (bias: number, draw: () => void) => void;
    /** Tests whether the camera lies on the positive side of the plane. */
    planeSide: (origin: Point3, normal: Point3) => boolean;
    /** Groups BSP leaf parts under a shared sort depth with exact internal order. */
    bsp: (draw: () => void) => void;
    /** Starts a new ordered leaf inside an active `bsp` block. */
    part: (draw: () => void) => void;
    /** Draws the far side of a separating plane before the near side. */
    split: (
        origin: Point3,
        normal: Point3,
        neg: () => void,
        pos: () => void,
    ) => void;
    commands: (split?: {
        depth: number;
        part: 'far' | 'near';
    }) => DrawCommand[];
} {
    return new SkyProjectionRuntime(width, height, orbit, framing).api();
}
export type SkyProjection = ReturnType<typeof createSkyProjection>;
export function placedProjection(
    view: SkyProjection,
    place: (p: Point3) => Point3,
): SkyProjection {
    type ProfileOptions = Parameters<SkyProjection['profile']>[4];
    const planeSide = (origin: Point3, normal: Point3) => {
        const o = place(origin);
        const [u, v] = planeBasis(normal);
        const tu = sub(place(add(origin, u)), o);
        const tv = sub(place(add(origin, v)), o);
        return view.planeSide(o, cross(tu, tv));
    };
    const wrapped: SkyProjection = {
        ...view,
        project: (p) => view.project(place(p)),
        depth: (p) => view.depth(place(p)),
        polygon: (points, color, options) =>
            view.polygon(
                points.map(place),
                color,
                options?.decals
                    ? {
                          ...options,
                          decals: options.decals.map((d) =>
                              placeDecal(place, d),
                          ),
                      }
                    : options,
            ),
        profile: (outline, halfWidth, color, z, options?: ProfileOptions) =>
            view.profile(outline, halfWidth, color, z, {
                ...options,
                place: (p) => place(options?.place ? options.place(p) : p),
            }),
        box: (bounds, color, shade) => drawBox(wrapped, bounds, color, shade),
        oval: (center, radii, color, axes) =>
            view.oval(
                place(center),
                radii,
                color,
                placeAxes(place, center, radii, axes),
            ),
        rod: (a, b, r, color, options) =>
            view.rod(place(a), place(b), r, color, options),
        biased: view.biased,
        planeSide,
        bsp: view.bsp,
        part: view.part,
        split: (origin, normal, neg, pos) => {
            if (planeSide(origin, normal)) {
                neg();
                pos();
            } else {
                pos();
                neg();
            }
        },
    };
    return wrapped;
}
function drawBox(
    view: Pick<SkyProjection, 'polygon'>,
    { x0, x1, y0, y1, z0, z1 }: BoxBounds,
    color: string,
    shade = true,
) {
    const opts = { shade };
    view.polygon(
        [
            [x1, y1, z0],
            [x1, y1, z1],
            [x1, y0, z1],
            [x1, y0, z0],
        ],
        color,
        opts,
    );
    view.polygon(
        [
            [x0, y1, z1],
            [x0, y1, z0],
            [x0, y0, z0],
            [x0, y0, z1],
        ],
        color,
        opts,
    );
    view.polygon(
        [
            [x0, y1, z1],
            [x1, y1, z1],
            [x1, y1, z0],
            [x0, y1, z0],
        ],
        color,
        opts,
    );
    view.polygon(
        [
            [x0, y0, z0],
            [x1, y0, z0],
            [x1, y0, z1],
            [x0, y0, z1],
        ],
        color,
        opts,
    );
    view.polygon(
        [
            [x1, y1, z1],
            [x0, y1, z1],
            [x0, y0, z1],
            [x1, y0, z1],
        ],
        color,
        opts,
    );
    view.polygon(
        [
            [x0, y1, z0],
            [x1, y1, z0],
            [x1, y0, z0],
            [x0, y0, z0],
        ],
        color,
        opts,
    );
}
function buildProfileRings(
    points: Vector[],
    center: Vector,
    halfWidth: number,
    z: number,
    {
        thin,
        round,
        bevel,
        widthAt,
        place,
    }: {
        thin: boolean;
        round: number | undefined;
        bevel: number;
        widthAt?: (x: number, y: number) => number;
        place: (p: Point3) => Point3;
    },
): { turns: number[]; rings: Point3[][] } {
    const [cx, cy] = center;
    const ring = (offset: number, scale: number): Point3[] =>
        points.map(([x, y]) =>
            place([
                cx + (x - cx) * scale,
                cy + (y - cy) * scale,
                z + offset * (widthAt ? widthAt(x, y) / halfWidth : 1),
            ]),
        );
    const turns = thin
        ? [-90, 90]
        : round === undefined
          ? [-90, -50, 50, 90]
          : [-90, -58, -24, 24, 58, 90];
    const rings = turns.map((deg) => {
        const a = (deg * Math.PI) / 180;
        if (thin) {
            return ring(Math.sign(a) * halfWidth, 1);
        }
        if (round === undefined) {
            return Math.abs(deg) === 90
                ? ring(Math.sign(a) * halfWidth, bevel)
                : ring(Math.sign(a) * halfWidth * 0.65, 1);
        }
        return ring(halfWidth * Math.sin(a), round + (1 - round) * Math.cos(a));
    });
    return { turns, rings };
}
function profileBandFactor(
    turns: number[],
    index: number,
    thin: boolean,
    round: number | undefined,
): number {
    if (round !== undefined) {
        const middle =
            ((turns[index] + turns[index + 1]) / 2) * (Math.PI / 180);
        return 0.95 + 0.06 * Math.cos(middle);
    }
    return index === 1 || thin ? 0.96 : 1.02;
}
type StoredFace = {
    kind: 'face';
    points: Point3[];
    color: string;
    depth: number;
    seal: boolean;
    decals?: Decal[];
};
type StoredCurve = {
    kind: 'curve';
    command: DrawCommand;
    depth: number;
};
type StoredItem = StoredFace | StoredCurve;
type BspBucket = { items: StoredItem[] };
type BspGroup = { buckets: BspBucket[] };
class SkyProjectionRuntime {
    private width!: number;
    private height!: number;
    private orbit!: number;
    private framing!: SkyFraming;
    private angle!: number;
    private distance!: number;
    private target!: Point3;
    private eye!: number;
    private camera!: Point3;
    private forward!: Point3;
    private right!: Point3;
    private up!: Point3;
    private focal!: number;
    private loose: StoredItem[] = [];
    private bspGroups: BspGroup[] = [];
    private activeGroup: BspGroup | null = null;
    private activeBucket: BspBucket | null = null;
    /** Faces drawn while set get a hairline of their own colour to hide anti-aliasing seams. */
    private sealing = false;
    private bias = 0;
    private depth = (p: Point3): number =>
        dot(sub(p, this.camera), this.forward);
    private project = (p: Point3): Vector => {
        const relative = sub(p, this.camera);
        const distance = this.depth(p);
        const x = (dot(relative, this.right) * this.focal) / distance;
        const y = (-dot(relative, this.up) * this.focal) / distance;
        const roll = this.framing.roll ?? 0;
        return [
            this.width / 2 +
                (this.framing.offsetX ?? 0) +
                x * Math.cos(roll) -
                y * Math.sin(roll),
            this.height * (this.framing.centerY ?? 0.5) +
                x * Math.sin(roll) +
                y * Math.cos(roll),
        ];
    };
    private pixels = (a: Point3, b: Point3): number => {
        const near = Math.max(30, Math.min(this.depth(a), this.depth(b)));
        return (Math.hypot(...sub(a, b)) * this.focal) / near;
    };
    private emit(item: StoredItem) {
        if (this.activeBucket) {
            this.activeBucket.items.push(item);
        } else {
            this.loose.push(item);
        }
    }
    private planeSide = (origin: Point3, normal: Point3): boolean =>
        dot(sub(this.camera, origin), normal) > 0;
    private bsp = (draw: () => void): void => {
        if (this.activeGroup) {
            draw();
            return;
        }
        const group: BspGroup = { buckets: [] };
        this.bspGroups.push(group);
        this.activeGroup = group;
        this.activeBucket = null;
        try {
            draw();
        } finally {
            this.activeGroup = null;
            this.activeBucket = null;
        }
    };
    private part = (draw: () => void): void => {
        if (!this.activeGroup) {
            draw();
            return;
        }
        const previous = this.activeBucket;
        const bucket: BspBucket = { items: [] };
        this.activeGroup.buckets.push(bucket);
        this.activeBucket = bucket;
        try {
            draw();
        } finally {
            this.activeBucket = previous;
        }
    };
    private split = (
        origin: Point3,
        normal: Point3,
        neg: () => void,
        pos: () => void,
    ): void => {
        if (this.planeSide(origin, normal)) {
            neg();
            pos();
        } else {
            pos();
            neg();
        }
    };
    private polygon = (
        points: Point3[],
        color: string,
        options?: PolygonOptions,
    ): void => {
        if (points.some((p) => this.depth(p) <= 30)) {
            return;
        }
        const normal = points.reduce<Point3>(
            (sum, p, i) => add(sum, cross(p, points[(i + 1) % points.length])),
            [0, 0, 0],
        );
        if (
            color.length === 7 &&
            dot(normal, sub(this.camera, points[0])) <= 0
        ) {
            return;
        }
        const lit = options?.shade
            ? shadeColor(
                  color,
                  0.88 + 0.15 * (dot(norm(normal), LIGHT_DIR) * 0.5 + 0.5),
              )
            : color;
        this.emit({
            kind: 'face',
            points,
            color: lit,
            seal: this.sealing,
            decals: options?.decals,
            depth:
                points.reduce((sum, p) => sum + this.depth(p), 0) /
                    points.length -
                this.bias,
        });
    };
    private profile = (
        outline: Vector[],
        halfWidth: number,
        color: string,
        z = 0,
        options?: {
            widthAt?: (x: number, y: number) => number;
            bevel?: number;
            round?: number;
            place?: (p: Point3) => Point3;
            shade?: boolean;
        },
    ): void => {
        const {
            widthAt,
            bevel = 0.86,
            round,
            place = (p: Point3) => p,
            shade = false,
        } = options ?? {};
        const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length;
        const cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
        const area = outline.reduce((sum, p, i) => {
            const next = outline[(i + 1) % outline.length];
            return sum + p[0] * next[1] - next[0] * p[1];
        }, 0);
        const points = area > 0 ? outline : [...outline].reverse();
        const thin =
            this.pixels(
                place([cx, cy, z - halfWidth]),
                place([cx, cy, z + halfWidth]),
            ) < LOD_PIXELS;
        const { turns, rings } = buildProfileRings(
            points,
            [cx, cy],
            halfWidth,
            z,
            { thin, round, bevel, widthAt, place },
        );
        this.sealing = round !== undefined;
        const polyOpts = shade ? { shade: true } : undefined;
        this.polygon(
            [...rings[0]].reverse(),
            shade ? color : shadeColor(color, 0.94),
            polyOpts,
        );
        this.polygon(rings[rings.length - 1], color, polyOpts);
        for (let r = 0; r < rings.length - 1; r++) {
            const factor = profileBandFactor(turns, r, thin, round);
            const band = shade ? color : shadeColor(color, factor);
            for (let i = 0; i < points.length; i++) {
                const next = (i + 1) % points.length;
                this.polygon(
                    [
                        rings[r][i],
                        rings[r][next],
                        rings[r + 1][next],
                        rings[r + 1][i],
                    ],
                    band,
                    polyOpts,
                );
            }
        }
        this.sealing = false;
    };
    private box = (bounds: BoxBounds, color: string, shade = true): void => {
        drawBox({ polygon: this.polygon }, bounds, color, shade);
    };
    private ovalCommand(
        center: Point3,
        radii: Point3,
        color: string,
        axes?: Axes3,
    ): DrawCommand {
        const c = this.project(center);
        const src = axes ?? basis(radii);
        const projected = src.map((axis) => {
            const p = this.project(add(center, axis));
            return [p[0] - c[0], p[1] - c[1]];
        });
        const a = projected.reduce((sum, p) => sum + p[0] * p[0], 0);
        const b = projected.reduce((sum, p) => sum + p[0] * p[1], 0);
        const d = projected.reduce((sum, p) => sum + p[1] * p[1], 0);
        const delta = Math.hypot(a - d, 2 * b);
        const angle = Math.atan2(2 * b, a - d) / 2;
        const major = Math.sqrt(Math.max(0, (a + d + delta) / 2));
        const minor = Math.sqrt(Math.max(0, (a + d - delta) / 2));
        const u: Vector = [Math.cos(angle) * major, Math.sin(angle) * major];
        const v: Vector = [-Math.sin(angle) * minor, Math.cos(angle) * minor];
        const pt = (x: number, y: number): Vector => [
            c[0] + u[0] * x + v[0] * y,
            c[1] + u[1] * x + v[1] * y,
        ];
        const k = 0.5522847498;
        return {
            kind: 'path',
            points: [pt(1, 0)],
            curves: [
                [...pt(1, k), ...pt(k, 1), ...pt(0, 1)],
                [...pt(-k, 1), ...pt(-1, k), ...pt(-1, 0)],
                [...pt(-1, -k), ...pt(-k, -1), ...pt(0, -1)],
                [...pt(k, -1), ...pt(1, -k), ...pt(1, 0)],
            ],
            fill: color,
        };
    }
    private oval = (
        center: Point3,
        radii: Point3,
        color: string,
        axes?: Axes3,
    ): void => {
        if (this.depth(center) <= 30) {
            return;
        }
        this.emit({
            kind: 'curve',
            depth: this.depth(center) - this.bias,
            command: this.ovalCommand(center, radii, color, axes),
        });
    };
    private rod = (
        a: Point3,
        b: Point3,
        r: number,
        color: string,
        options?: RodOptions,
    ): void => {
        const axis = norm(sub(b, a));
        const axis2 = norm(
            cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]),
        );
        const axis3 = cross(axis, axis2);
        const thin =
            this.pixels(add(a, mul(axis2, r)), sub(a, mul(axis2, r))) <
                LOD_PIXELS &&
            this.pixels(add(b, mul(axis2, r)), sub(b, mul(axis2, r))) <
                LOD_PIXELS;
        const sides = options?.sides ?? (thin ? 6 : 12);
        const shade = options?.shade ?? false;
        const polyOpts = shade ? { shade: true } : undefined;
        const col = shade ? color : shadeColor(color, 0.96);
        const offsets: Point3[] = Array.from({ length: sides }, (_, i) => {
            const ang = (i * 2 * Math.PI) / sides;
            return add(
                mul(axis2, Math.cos(ang) * r),
                mul(axis3, Math.sin(ang) * r),
            );
        });
        for (let i = 0; i < sides; i++) {
            const u = offsets[i];
            const v = offsets[(i + 1) % sides];
            this.polygon(
                [add(a, u), add(a, v), add(b, v), add(b, u)],
                col,
                polyOpts,
            );
        }
        if (options?.capA) {
            this.polygon(
                offsets.map((o) => add(a, o)).reverse(),
                col,
                polyOpts,
            );
        }
        if (options?.capB) {
            this.polygon(
                offsets.map((o) => add(b, o)),
                col,
                polyOpts,
            );
        }
    };
    private biased = (bias: number, draw: () => void): void => {
        const previous = this.bias;
        this.bias = bias;
        try {
            draw();
        } finally {
            this.bias = previous;
        }
    };
    private faceCommands(face: StoredFace): DrawCommand[] {
        const v = face.points.map(this.project);
        if (
            v.every((p) => p[0] < -20) ||
            v.every((p) => p[0] > this.width + 20) ||
            v.every((p) => p[1] < -20) ||
            v.every((p) => p[1] > this.height + 20)
        ) {
            return [];
        }
        const c = hazeColor(face.color, face.depth);
        const out: DrawCommand[] = [
            {
                kind: 'path',
                points: v,
                fill: c,
                ...(face.seal && (c.length === 7 || c.endsWith('ff'))
                    ? { stroke: { width: 1, color: c } }
                    : {}),
            },
        ];
        if (face.decals) {
            for (const decal of face.decals) {
                if (decal.kind === 'poly') {
                    if (decal.points.some((p) => this.depth(p) <= 30)) {
                        continue;
                    }
                    out.push({
                        kind: 'path',
                        points: decal.points.map(this.project),
                        fill: hazeColor(decal.color, face.depth),
                    });
                } else if (this.depth(decal.center) > 30) {
                    out.push(
                        this.ovalCommand(
                            decal.center,
                            decal.radii,
                            hazeColor(decal.color, face.depth),
                            decal.axes,
                        ),
                    );
                }
            }
        }
        return out;
    }
    private itemCommands(item: StoredItem): DrawCommand[] {
        return item.kind === 'face' ? this.faceCommands(item) : [item.command];
    }
    private commands = (split?: {
        depth: number;
        part: 'far' | 'near';
    }): DrawCommand[] => {
        const keep = (depth: number) =>
            !split ||
            (split.part === 'far' ? depth > split.depth : depth <= split.depth);
        const entries: Array<{ depth: number; cmds: DrawCommand[] }> = [];
        for (const item of this.loose) {
            if (keep(item.depth)) {
                const cmds = this.itemCommands(item);
                if (cmds.length) {
                    entries.push({ depth: item.depth, cmds });
                }
            }
        }
        for (const group of this.bspGroups) {
            let sum = 0;
            let count = 0;
            for (const bucket of group.buckets) {
                for (const item of bucket.items) {
                    sum += item.depth;
                    count++;
                }
            }
            if (!count) {
                continue;
            }
            const groupDepth = sum / count;
            if (!keep(groupDepth)) {
                continue;
            }
            const cmds: DrawCommand[] = [];
            for (const bucket of group.buckets) {
                const sorted = [...bucket.items].sort(
                    (a, b) => b.depth - a.depth,
                );
                for (const item of sorted) {
                    cmds.push(...this.itemCommands(item));
                }
            }
            if (cmds.length) {
                entries.push({ depth: groupDepth, cmds });
            }
        }
        return entries
            .sort((a, b) => b.depth - a.depth)
            .flatMap((entry) => entry.cmds);
    };
    constructor(
        width: number,
        height: number,
        orbit: number,
        framing: SkyFraming,
    ) {
        this.width = width;
        this.height = height;
        this.orbit = orbit;
        this.framing = framing;
        this.angle = (this.orbit * Math.PI) / 2;
        this.distance = this.framing.distance ?? 480;
        this.target = [0, 15, 0];
        this.eye = this.framing.eyeY ?? (this.framing.level ? 15 : 45);
        this.camera = [
            -Math.sin(this.angle) * this.distance,
            this.eye,
            Math.cos(this.angle) * this.distance,
        ];
        this.forward = norm(sub(this.target, this.camera));
        this.right = norm(cross(this.forward, [0, 1, 0]));
        this.up = norm(cross(this.right, this.forward));
        this.focal =
            Math.min(this.height * 1.65, this.width * 0.94) *
            (this.framing.zoom ?? 1);
    }
    api(): SkyProjection {
        return {
            project: this.project,
            depth: this.depth,
            polygon: this.polygon,
            profile: this.profile,
            box: this.box,
            oval: this.oval,
            rod: this.rod,
            biased: this.biased,
            planeSide: this.planeSide,
            bsp: this.bsp,
            part: this.part,
            split: this.split,
            commands: this.commands,
        };
    }
}
