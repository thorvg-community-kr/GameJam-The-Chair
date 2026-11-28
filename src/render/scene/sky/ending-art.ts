import { endingGlasses } from './player-glasses';
import { endingHair } from './player-hair';
import { ART } from '../../art';
import { PLAYER_OUTLINES } from '../player/art';
import { placedProjection } from '../shared/projection';

import type { Vector } from '../../types';
import type { Point3, SkyProjection } from '../shared/projection';

type Place = (p: Point3) => Point3;
/** Epilogue pose: the chair and the rider move independently. */
export type EndingPose = {
    chair?: Place;
    /** World placement of the rider; defaults to sitting on the chair. */
    rider?: Place;
    parts?: 'all' | 'chair' | 'rider';
    /** Forward tilt of the backrest in radians. */
    backrest?: number;
    /** Seat drop into the gas cylinder in model units. */
    sink?: number;
    /** 0..1 legs spreading out under load. */
    splay?: number;
    tremble?: number;
    /** -1 hides the sweat drop, 0..1 runs it down the cylinder. */
    sweat?: number;
    /** Head yaw toward the rider's left (+z) in radians. */
    headYaw?: number;
    tint?: {
        chair?: (color: string) => string;
        rider?: (color: string) => string;
    };
};
const NECK: Point3 = [-2, 33, 0];
const GLASSES_BIAS = 8;
/** Side-cap scale of the head; below 1 it rounds into the cheeks and temples. */
const HEAD_ROUND = 0.62;
const BACKREST_PIVOT: Point3 = [-24, -25, 0];
const rotateY = (p: Point3, c: Point3, a: number): Point3 => {
    const x = p[0] - c[0];
    const z = p[2] - c[2];
    return [
        c[0] + x * Math.cos(a) - z * Math.sin(a),
        p[1],
        c[2] + x * Math.sin(a) + z * Math.cos(a),
    ];
};
/** Positive angles tip the top of the part toward +x. */
export const tipForward = (p: Point3, c: Point3, a: number): Point3 => {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return [
        c[0] + x * Math.cos(a) + y * Math.sin(a),
        c[1] - x * Math.sin(a) + y * Math.cos(a),
        p[2],
    ];
};
export function tintedProjection(
    view: SkyProjection,
    tint: (color: string) => string,
): SkyProjection {
    const keep = (color: string) => tint(color.slice(0, 7)) + color.slice(7);
    return {
        ...view,
        polygon: (points, color) => view.polygon(points, keep(color)),
        profile: (outline, halfWidth, color, z, options) =>
            view.profile(outline, halfWidth, keep(color), z, options),
        oval: (center, radii, color) => view.oval(center, radii, keep(color)),
        rod: (a, b, r, color) => view.rod(a, b, r, keep(color)),
    };
}
const placed = (view: SkyProjection, place?: Place) =>
    place ? placedProjection(view, place) : view;
const tinted = (view: SkyProjection, tint?: (color: string) => string) =>
    tint ? tintedProjection(view, tint) : view;
export function endingChair(
    view: SkyProjection,
    elapsed: number,
    spray = 1,
    arrival = 0,
    {
        loose = -1,
        rest = 0,
        rocket = 0,
        pose,
    }: {
        loose?: number;
        rest?: number;
        rocket?: number;
        pose?: EndingPose;
    } = {},
): number {
    const draw = chairDrawing(view, elapsed, arrival);
    if (pose) {
        return posedChair(view, draw, rest, pose);
    }
    chairFrame(draw);
    riderBody(draw);
    riderHead(view, draw);
    riderArms(view, draw, rest);
    if (loose < 0) {
        extinguisher(draw, spray, rocket);
    } else {
        extinguisher(
            looseDrawing(view, draw, loose),
            spray * Math.exp(-loose * 0.6),
            rocket,
        );
    }
    return draw.bob;
}
function posedChair(
    view: SkyProjection,
    draw: ChairDrawing,
    rest: number,
    pose: EndingPose,
): number {
    const { parts = 'all', sink = 0, headYaw = 0 } = pose;
    const redraw = (target: SkyProjection) =>
        chairDrawing(target, draw.elapsed, 0, draw.bob);
    const chairView = tinted(placed(view, pose.chair), pose.tint?.chair);
    if (parts !== 'rider') {
        chairFrame(redraw(chairView), {
            ...pose,
            upper: redraw(
                placedProjection(chairView, (p) => [p[0], p[1] - sink, p[2]]),
            ),
            back: redraw(
                placedProjection(chairView, (p) =>
                    tipForward(
                        [p[0], p[1] - sink, p[2]],
                        BACKREST_PIVOT,
                        pose.backrest ?? 0,
                    ),
                ),
            ),
        });
    }
    if (parts === 'chair') {
        return draw.bob;
    }
    const sitting: Place = (p) =>
        (pose.chair ?? ((q: Point3) => q))([p[0], p[1] - sink, p[2]]);
    const riderView = tinted(
        placed(view, pose.rider ?? sitting),
        pose.tint?.rider,
    );
    const body = redraw(riderView);
    riderBody(body, 'front');
    // The neck carries half of the turn, like a real neck under a turning head.
    riderNeck(
        redraw(
            placedProjection(riderView, (p) => rotateY(p, NECK, headYaw / 2)),
        ),
        POSED_NECK,
        5,
    );
    frontTie(riderView, body);
    const headView = placedProjection(riderView, (p) =>
        rotateY(p, NECK, headYaw),
    );
    riderHead(headView, redraw(headView));
    riderArms(riderView, body, rest);
    return draw.bob;
}
/** Rider-local view for parts drawn outside endingChair, such as the laptop screen. */
export function riderProjection(
    view: SkyProjection,
    pose: EndingPose,
): SkyProjection {
    const sink = pose.sink ?? 0;
    const sitting: Place = (p) =>
        (pose.chair ?? ((q: Point3) => q))([p[0], p[1] - sink, p[2]]);
    return tinted(placed(view, pose.rider ?? sitting), pose.tint?.rider);
}
function looseDrawing(
    view: SkyProjection,
    draw: ChairDrawing,
    loose: number,
): ChairDrawing {
    const centre: Point3 = [-46, -5, 0];
    const axis: Point3 = [0.3, 0.5, 0.81];
    const angle = loose * 0.9;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const shift: Point3 = [
        -10 * loose,
        9 * loose,
        -38 * loose - 10 * (1 - Math.exp(-3 * loose)),
    ];
    const move = (p: Point3): Point3 => {
        const v: Point3 = [
            p[0] - centre[0],
            p[1] - centre[1],
            p[2] - centre[2],
        ];
        const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
        const c: Point3 = [
            axis[1] * v[2] - axis[2] * v[1],
            axis[2] * v[0] - axis[0] * v[2],
            axis[0] * v[1] - axis[1] * v[0],
        ];
        return [0, 1, 2].map(
            (i) =>
                v[i] * cos +
                c[i] * sin +
                axis[i] * d * (1 - cos) +
                centre[i] +
                shift[i],
        ) as Point3;
    };
    const point = (x: number, y: number, z = 0): Point3 =>
        move([x, -y - 35, z]);
    return {
        ...draw,
        bob: 0,
        point,
        rod: (a, b, radius, color) =>
            view.rod(point(...a), point(...b), radius, color),
        oval: (
            x,
            y,
            z,
            rx,
            {
                ry,
                rz,
                color,
            }: {
                ry: number;
                rz: number;
                color: string;
            },
        ) => view.oval(point(x, y, z), [rx, ry, rz], color),
    };
}
function chairDrawing(
    view: SkyProjection,
    elapsed: number,
    arrival: number,
    fixedBob?: number,
) {
    const C = ART.palette;
    const bob =
        fixedBob ??
        Math.sin(elapsed * 1.6) * 1.5 + Math.sin(elapsed * 25) * 3 * arrival;
    const point = (x: number, y: number, z = 0): Point3 => [
        x,
        -y - 35 + bob,
        z,
    ];
    const profile = (points: Vector[], width: number, color: string, z = 0) =>
        view.profile(
            points.map(([x, y]) => [x, -y - 35 + bob]),
            width,
            color,
            z,
        );
    const oval = (
        x: number,
        y: number,
        z: number,
        rx: number,
        {
            ry,
            rz,
            color,
        }: {
            ry: number;
            rz: number;
            color: string;
        },
    ) => view.oval(point(x, y, z), [rx, ry, rz], color);
    const rod = (a: Point3, b: Point3, radius: number, color: string) =>
        view.rod(point(...a), point(...b), radius, color);
    return { C, bob, point, profile, oval, rod, elapsed };
}
type ChairDrawing = ReturnType<typeof chairDrawing>;
export function laptopScreenPoint(
    u: number,
    v: number,
    bob: number,
    lift = 0,
): Point3 {
    return [
        47 + 6.6 * v - 0.96 * lift,
        1 + 24 * v + bob + 0.26 * lift,
        -20 + 40 * u,
    ];
}
type FramePose = Pick<EndingPose, 'sink' | 'splay' | 'tremble' | 'sweat'> & {
    upper?: ChairDrawing;
    back?: ChairDrawing;
};
function chairFrame(draw: ChairDrawing, frame: FramePose = {}) {
    const { C: palette, rod, oval } = draw;
    const { sink = 0, splay = 0, tremble = 0, sweat = -1 } = frame;
    const upper = frame.upper ?? draw;
    const back = frame.back ?? upper;
    const hub = 13 + sink * 0.4;
    rod([tremble, -4 + sink, 0], [0, 16, 0], 3, palette.steel);
    const spread = 1 + 0.28 * splay;
    for (const [x, z] of [
        [-27, 22],
        [27, 22],
        [-27, -22],
        [27, -22],
        [0, -30],
    ]) {
        rod([0, hub, 0], [x * spread, 21, z * spread], 2.5, palette.steel);
        oval(x * spread, 23, z * spread, 7, {
            ry: 8,
            rz: 5,
            color: '#3f4650',
        });
        oval(x * spread, 23, z * spread + 4.7, 2.5, {
            ry: 2.5,
            rz: 0.5,
            color: '#9197a2',
        });
    }
    if (sweat >= 0 && sweat <= 1) {
        const y = -2 + sink + 16 * sweat;
        oval(3.6 + tremble, y, 2.2, 1.9, {
            ry: 2.8,
            rz: 1.9,
            color: '#9fd8ff',
        });
        oval(3.9 + tremble, y - 0.6, 2.2, 0.4, {
            ry: 0.6,
            rz: 0.4,
            color: '#ffffff',
        });
    }
    back.rod([-24, -10, 0], [-31, -61, 0], 3.5, '#515665');
    back.profile(PLAYER_OUTLINES.backrest, 24, '#666d80');
    upper.profile(
        [
            [-30, -15],
            [32, -15],
            [32, -3],
            [-30, -3],
        ],
        27,
        '#6f7687',
    );
}
function riderBody(draw: ChairDrawing, style: 'side' | 'front' = 'side') {
    const { C: palette, profile } = draw;
    profile(PLAYER_OUTLINES.farLeg, 5, '#4e5b70', -12);
    profile(
        [
            [35, 3],
            [42, 3],
            [50, 6],
            [55, 9],
            [52, 10],
            [35, 7],
        ],
        7,
        '#383f4e',
        -12,
    );
    profile(PLAYER_OUTLINES.nearLeg, 5, '#5b6b80', 12);
    profile(
        [
            [-11, -25],
            [20, -24],
            [26, -21],
            [7, -20],
            [-10, -21],
        ],
        0.6,
        '#6d7b8e',
        17.5,
    );
    profile(
        [
            [26, 11],
            [33, 10],
            [35, 15],
            [26, 16],
        ],
        7,
        '#383f4e',
        12,
    );
    profile(PLAYER_OUTLINES.shirt, 16, palette.shirt);
    profile(
        [
            [-17, -62],
            [-11, -61],
            [-11, -24],
            [-17, -23],
        ],
        0.6,
        '#d9d6c5',
        16.5,
    );
    if (style === 'side') {
        riderNeck(draw, SIDE_NECK, 4.2);
        sideTie(draw);
    }
}
const SIDE_NECK: Vector[] = [
    [-5, -69],
    [2, -68],
    [3, -61],
    [1, -58],
    [-4, -62],
];
// Reaches up into the jaw so a turned head never shows a gap.
const POSED_NECK: Vector[] = [
    [-6, -73],
    [3, -72],
    [4, -61],
    [1, -57],
    [-5, -61],
];
function riderNeck(
    { profile }: ChairDrawing,
    outline: Vector[],
    width: number,
) {
    profile(outline, width, '#d5b18b');
}
/** Side-view collar and tie, painted on the near flank for the flight camera. */
function sideTie({ profile }: ChairDrawing) {
    profile(
        [
            [-9, -65],
            [0, -60],
            [6, -60],
            [4, -55],
            [0, -52],
            [-6, -57],
        ],
        0.8,
        '#fff6de',
        17,
    );
    profile(
        [
            [1, -58],
            [5, -57],
            [5, -54],
            [8, -36],
            [6, -33],
            [1, -34],
            [2, -54],
        ],
        0.5,
        '#a65e44',
        17.8,
    );
}
/** Collar and tie on the chest front, for cameras that see him face on. */
function frontTie(view: SkyProjection, { point }: ChairDrawing) {
    const chest = (y: number) => 5.7 + ((y + 60) * 4) / 35;
    const on = (y: number, z: number, lift = 0) => point(chest(y) + lift, y, z);
    const facing = view.depth(on(-45, 0)) < view.depth([-17, 0, 0]) ? 2 : 0;
    view.biased(facing, () => {
        for (const side of [-1, 1]) {
            view.polygon(
                [on(-62, side * 1), on(-61.5, side * 7), on(-55, side * 2.8)],
                '#fff6deff',
            );
        }
        view.polygon(
            [
                on(-60.5, -1.9, 0.4),
                on(-60.5, 1.9, 0.4),
                on(-56.5, 1.3, 0.4),
                on(-56.5, -1.3, 0.4),
            ],
            '#93503aff',
        );
        view.polygon(
            [
                on(-56.5, -1.2, 0.3),
                on(-56.5, 1.2, 0.3),
                on(-37, 2.6, 0.3),
                on(-34, 0, 0.3),
                on(-37, -2.6, 0.3),
            ],
            '#a65e44ff',
        );
    });
}
function riderHead(
    view: SkyProjection,
    { C: palette, bob, oval }: ChairDrawing,
) {
    const face: Vector[] = [
        [-10, -77],
        [-3, -83],
        [3, -89],
        [10, -92],
        ...PLAYER_OUTLINES.head.slice(3),
    ];
    view.profile(
        face.map(([x, y]) => [x, -y - 35 + bob]),
        12,
        palette.skin,
        0,
        {
            widthAt: (_x, y) => {
                const fullness = Math.max(0, Math.min(1, (y - 31 - bob) / 20));
                return 5 + fullness * 7;
            },
            round: HEAD_ROUND,
        },
    );
    endingHair(view, bob);
    for (const side of [-1, 1]) {
        oval(-7, -81, side * 13, 2.7, {
            ry: 3.4,
            rz: 1.5,
            color: palette.skin,
        });
    }
    // Flat lenses lose the average-depth sort to the cheeks once the head
    // turns, so pull them forward while they face the camera.
    const facing =
        view.depth([15, 49, 0]) < view.depth([-10, 49, 0]) ? GLASSES_BIAS : 0;
    view.biased(facing, () => endingGlasses(view, bob));
}
function laptop(view: SkyProjection, { profile, point, bob }: ChairDrawing) {
    const top = laptopDetails(view, point, profile);
    const keyStart = view.project(point(35, -34.45, -19));
    const keyEnd = view.project(point(35, -34.45, -14));
    const keyWidth = Math.hypot(
        keyEnd[0] - keyStart[0],
        keyEnd[1] - keyStart[1],
    );
    if (keyWidth >= 2) {
        for (let row = 0; row < 3; row++) {
            for (let key = 0; key < 8; key++) {
                const z = -17.5 + key * 4.45;
                top(33 + row * 4.1, z, 36.1 + row * 4.1, z + 3.5, {
                    y: -34.48,
                    color: row === 0 ? '#78899a' : '#647586',
                });
            }
        }
    }
    const corner = (u: number, v: number, back = 0) =>
        laptopScreenPoint(u, v, bob, -back);
    const face = (
        u0: number,
        v0: number,
        u1: number,
        v1: number,
        {
            color,
            lift = 0,
        }: {
            color: string;
            lift?: number;
        },
    ) =>
        view.polygon(
            [
                laptopScreenPoint(u0, v0, bob, lift),
                laptopScreenPoint(u1, v0, bob, lift),
                laptopScreenPoint(u1, v1, bob, lift),
                laptopScreenPoint(u0, v1, bob, lift),
            ],
            color,
        );
    laptopDetails2(face, view, corner);
    face(0.02, 0.045, 0.045, 0.955, {
        color: '#9caaba',
        lift: 0.1,
    });
    face(0.955, 0.045, 0.98, 0.955, {
        color: '#9caaba',
        lift: 0.1,
    });
    face(0.49, 0.965, 0.51, 0.975, {
        color: '#283644',
        lift: 0.15,
    });
}
function laptopDetails2(
    face: (
        u0: number,
        v0: number,
        u1: number,
        v1: number,
        {
            color,
            lift,
        }: {
            color: string;
            lift?: number;
        },
    ) => void,
    view: SkyProjection,
    corner: (u: number, v: number, back?: number) => Point3,
) {
    face(0, 0, 1, 1, {
        color: '#243140',
    });
    view.polygon(
        [
            corner(0, 1, 1.2),
            corner(1, 1, 1.2),
            corner(1, 0, 1.2),
            corner(0, 0, 1.2),
        ],
        '#566275',
    );
    for (const [a, b] of [
        [
            [0, 0],
            [1, 0],
        ],
        [
            [1, 0],
            [1, 1],
        ],
        [
            [1, 1],
            [0, 1],
        ],
        [
            [0, 1],
            [0, 0],
        ],
    ]) {
        view.polygon(
            [
                corner(a[0], a[1]),
                corner(b[0], b[1]),
                corner(b[0], b[1], 1.2),
                corner(a[0], a[1], 1.2),
            ],
            '#657184ff',
        );
    }
    face(0.02, 0.02, 0.98, 0.045, {
        color: '#9caaba',
        lift: 0.1,
    });
    face(0.02, 0.955, 0.98, 0.98, {
        color: '#9caaba',
        lift: 0.1,
    });
}
function laptopDetails(
    view: SkyProjection,
    point: (x: number, y: number, z?: number) => Point3,
    profile: (
        points: Vector[],
        width: number,
        color: string,
        z?: number,
    ) => void,
) {
    const top = (
        x0: number,
        z0: number,
        x1: number,
        z1: number,
        {
            y,
            color,
        }: {
            y: number;
            color: string;
        },
    ) =>
        view.polygon(
            [
                point(x0, y, z0),
                point(x1, y, z0),
                point(x1, y, z1),
                point(x0, y, z1),
            ],
            color + 'ff',
        );
    profile(
        [
            [16, -31],
            [50, -31],
            [50, -34],
            [16, -34],
        ],
        22,
        '#667284',
    );
    top(18, -20, 48, 20, {
        y: -34.2,
        color: '#343e4c',
    });
    top(19, -18, 31, 18, {
        y: -34.35,
        color: '#758396',
    });
    top(19.5, -17.5, 30.5, 17.5, {
        y: -34.4,
        color: '#465362',
    });
    top(32, -19, 46, 19, {
        y: -34.35,
        color: '#222c39',
    });
    return top;
}
function riderArms(view: SkyProjection, draw: ChairDrawing, rest = 0) {
    const { C, elapsed, profile } = draw;
    laptop(view, draw);
    for (const z of [-19, 19]) {
        profile(
            [
                [-17, -58],
                [-13, -60],
                [-9, -57],
                [-8, -35],
                [-18, -34],
            ],
            4,
            '#e6e0cc',
            z,
        );
        profile(
            [
                [-19, -39],
                [-8, -39],
                [-8, -34],
                [-19, -33],
            ],
            4.5,
            '#fff6de',
            z,
        );
        const lift = -5 * rest;
        profile(
            [
                [-16, -34],
                [-9, -35],
                [23, -36 + lift],
                [25, -32 + lift],
                [-15, -27],
            ],
            3,
            C.skin,
            z,
        );
        const tap = Math.sin(elapsed * 24) * 1.2 * (1 - rest) + lift;
        profile(
            [
                [21, -36 + tap],
                [25, -39 + tap],
                [30, -38 + tap],
                [35, -35 + tap],
                [36, -33 + tap],
                [29, -35 + tap],
                [23, -33 + tap],
            ],
            2,
            C.skin,
            z,
        );
    }
}
function extinguisher(
    { elapsed, rod, oval }: ChairDrawing,
    spray: number,
    rocket: number,
) {
    rod([-39, -49, 0], [-45, -13, 0], 2, '#394657');
    rod([-46, -48, 0], [-46, -9, 0], 8, '#b75f4a');
    oval(-46, -48, 0, 8, {
        ry: 5,
        rz: 8,
        color: '#c7765c',
    });
    oval(-46, -9, 0, 8, {
        ry: 3,
        rz: 8,
        color: '#b75f4a',
    });
    rod([-46, -37, 0], [-46, -26, 0], 8.2, '#eee5cd');
    rod([-46, -52, 0], [-46, -59, 0], 2, '#394657');
    rod([-49, -59, 0], [-35, -59, 0], 1.5, '#394657');
    for (let i = 0; rocket < 1 && spray > 0 && i < 5; i++) {
        const age = (elapsed * 1.5 + i * 0.19) % 1;
        oval(-46 - age * 4, -7 + age * 50 * spray, 0, 3 + age * 7, {
            ry: 4 + age * 9,
            rz: 3 + age * 6,
            color: '#f6e6df' + hex((100 / 255) * (1 - age) * (1 - rocket)),
        });
    }
    if (rocket <= 0) {
        return;
    }
    rod([-46, -9, 0], [-46, -4, 0], 5.5, '#2f3540');
    if (spray > 0) {
        rocketExhaust(oval, elapsed, spray * rocket);
    }
}
const hex = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');
function rocketExhaust(
    oval: ChairDrawing['oval'],
    elapsed: number,
    spray: number,
) {
    const power = Math.min(1.8, spray);
    const flicker =
        1 + Math.sin(elapsed * 47) * 0.08 + Math.sin(elapsed * 83) * 0.05;
    const reach = (120 + 230 * power) * flicker;
    oval(-46, -3.5, 0, 6.5, {
        ry: 1.2,
        rz: 6.5,
        color: '#ffe9b0' + hex(Math.min(1, power * 2)),
    });
    const puffs = Math.round(14 + 18 * Math.min(1, power));
    for (let i = 0; i < puffs; i++) {
        const age = (elapsed * 2.6 + i / puffs) % 1;
        const swirl = i * 2.39 + elapsed * 3;
        const spread = age * age * 50 * power;
        const size = 7 + age * 55 * (0.6 + 0.4 * power);
        const tone = age < 0.25 ? '#fff4d6' : age < 0.6 ? '#f6efe4' : '#dcdcd8';
        oval(
            -46 - age * reach * 0.55 + Math.cos(swirl) * spread,
            -2 + age * reach,
            Math.sin(swirl) * spread,
            size,
            {
                ry: size * (1.1 + 0.5 * (1 - age)),
                rz: size,
                color:
                    tone +
                    hex(
                        Math.min(1, age / 0.18) *
                            (1 - age) *
                            (1 - age) *
                            0.9 *
                            Math.min(1, power + 0.3),
                    ),
            },
        );
    }
    const core = (40 + 50 * power) * flicker;
    oval(-46 - 8, 6, 0, 16 * power, {
        ry: 18 * power,
        rz: 16 * power,
        color: '#fff1c4' + hex(0.35 * Math.min(1, power)),
    });
    for (let k = 0; k < 6; k++) {
        const along = ((k + 0.5) / 6) * core;
        const r = 8 * (1 - k / 8);
        oval(-46 - along * 0.55, -2 + along, 0, r, {
            ry: r * 1.5,
            rz: r,
            color: (k < 2 ? '#ffe28a' : '#ffb347') + hex(0.85 * (1 - k / 7)),
        });
    }
    for (let k = 1; k <= 3; k++) {
        const along = core * k * 0.26;
        const r = 5.5 - k * 0.9;
        oval(-46 - along * 0.55, -2 + along, 0, r, {
            ry: r * 1.6,
            rz: r,
            color: '#ffffff' + hex(0.95 - k * 0.2),
        });
    }
}
