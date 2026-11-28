import { tipForward } from '../sky/ending-art';

import type { EpilogueBeat } from './epilogue-beats';
import type { Point3 } from '../shared/projection';
import type { EndingPose } from '../sky/ending-art';

/** A hard-cut camera preset; `focus` lands on the screen centre. */
export type EpilogueShot = {
    orbit: number;
    focus: Point3;
    distance: number;
    /** Camera height above the focus; negative looks up. */
    lift: number;
    zoom: number;
    roll?: number;
    centerY?: number;
    /** Fraction of the screen width. */
    offsetX?: number;
};
export type EpilogueStage = {
    shot: EpilogueShot;
    figures: EndingPose[];
    punch: number;
    star?: { at: Point3; k: number };
    puff?: { at: Point3; k: number };
};
type Place = (p: Point3) => Point3;

const DEG = Math.PI / 180;
const FLOOR: Point3 = [0, -58, 0];
const HIP: Point3 = [0, -25, 0];
const FRONT_WHEEL: Point3 = [27, -58, 0];
const BODY: Point3 = [0, 10, 0];
/** Where the drifting rider floats in front of the empty chair. */
const ADRIFT: Point3 = [430, 15, 0];
const DRIFT_ROLL = 0.38;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
    const t = clamp01(v);
    return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 over `length` seconds starting at `at`. */
const pulse = (u: number, at: number, length: number) => {
    const k = (u - at) / length;
    return k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * k);
};
const shift = (p: Point3, d: Point3): Point3 => [
    p[0] + d[0],
    p[1] + d[1],
    p[2] + d[2],
];
/** Sideways roll in the y-z plane; positive leans toward +z. */
const roll = (p: Point3, c: Point3, a: number): Point3 => {
    const y = p[1] - c[1];
    const z = p[2] - c[2];
    return [
        p[0],
        c[1] + y * Math.cos(a) - z * Math.sin(a),
        c[2] + y * Math.sin(a) + z * Math.cos(a),
    ];
};
const turnAround = (p: Point3): Point3 => [-p[0], p[1], -p[2]];
const squash = (p: Point3, c: Point3, s: number): Point3 => [
    c[0] + (p[0] - c[0]) * (1 - s / 2),
    c[1] + (p[1] - c[1]) * (1 + s),
    c[2] + (p[2] - c[2]) * (1 - s / 2),
];
const darken =
    (factor: number) =>
    (color: string): string =>
        '#' +
        [1, 3, 5]
            .map((i) =>
                Math.round(parseInt(color.slice(i, i + 2), 16) * factor)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('');
const face = (look = 0, blink = 0, mouth = 0) => ({ look, blink, mouth });

function tap(u: number): EpilogueStage {
    const hit = 0.4;
    const backrest =
        16 *
        DEG *
        (u < hit ? smooth((u - 0.25) / 0.15) : 1 - smooth((u - hit) / 0.35));
    const k = (u - hit - 0.05) / 0.3;
    const jolt = k > 0 && k < 1 ? Math.sin(Math.PI * Math.sqrt(k)) : 0;
    const rider: Place = (p) =>
        shift(tipForward(p, HIP, 0.12 * jolt), [7 * jolt, 1.5 * jolt, 0]);
    return {
        shot: {
            orbit: 0.55,
            focus: [-4, 0, 0],
            distance: 300,
            lift: 30,
            zoom: 1,
        },
        figures: [{ backrest, rider, face: face() }],
        punch: u >= hit ? 0.04 * (1 - smooth((u - hit) / 0.35)) : 0,
        star:
            u >= hit && u < hit + 0.25
                ? { at: [-20, 8, 6], k: (u - hit) / 0.25 }
                : undefined,
    };
}
function look(u: number): EpilogueStage {
    return {
        shot: {
            orbit: -0.2,
            focus: [4, 40, 0],
            distance: 150,
            lift: 6,
            zoom: 1,
        },
        figures: [
            {
                headYaw: 35 * DEG * smooth((u - 0.3) / 0.5),
                face: face(smooth((u - 0.15) / 0.15), pulse(u, 0.32, 0.14)),
            },
        ],
        punch: 0,
    };
}
const wiggle = (v: number) =>
    v <= 0 || v >= 1.2
        ? 0
        : 7 *
          DEG *
          Math.sin(2 * Math.PI * 3 * v) *
          Math.min(1, v / 0.08) *
          Math.min(1, (1.2 - v) / 0.15);
function shake(u: number): EpilogueStage {
    const late = 0.09;
    return {
        shot: {
            orbit: -0.85,
            focus: [8, 5, 0],
            distance: 320,
            lift: 30,
            zoom: 1,
            roll: 9 * DEG,
        },
        figures: [
            {
                chair: (p) => roll(p, FLOOR, wiggle(u - 0.1)),
                rider: (p) => roll(p, FLOOR, 1.15 * wiggle(u - 0.1 - late)),
                face: face(0, 0, smooth((u - 0.25) / 0.12)),
            },
        ],
        punch: 0,
    };
}
function strain(u: number): EpilogueStage {
    const sweat = u / 0.65;
    return {
        shot: {
            orbit: 0.3,
            focus: [0, -40, 0],
            distance: 130,
            lift: -32,
            zoom: 1,
        },
        figures: [
            {
                sink: 7 * smooth(u / 0.55),
                splay: smooth(u / 0.5),
                tremble: Math.sin(u * 95) * 0.9 * Math.min(1, u / 0.1),
                sweat: sweat <= 1 ? sweat : -1,
                face: face(0, 0, 1),
            },
        ],
        punch: 0,
    };
}
const RELEASE = 0.3;
const tipAt = (u: number) =>
    0.4 * smooth(u / 0.22) + 0.05 * Math.sin(u * 60) * pulse(u, 0.06, 0.24);
function drop(u: number): EpilogueStage {
    const d = Math.max(0, u - RELEASE);
    const spring = Math.exp(-5 * d);
    const tip =
        u < RELEASE ? tipAt(u) : tipAt(RELEASE) * spring * Math.cos(12 * d);
    const stretch = u < RELEASE ? 0 : 0.12 * spring * Math.sin(12 * d);
    const chair: Place = (p) =>
        squash(tipForward(p, FRONT_WHEEL, tip), FLOOR, stretch);
    const thrown: Place = (p) => {
        const seated = tipForward(p, FRONT_WHEEL, tipAt(RELEASE));
        const tumbled = tipForward(seated, BODY, 1.3 * d);
        return shift(tumbled, [
            -90 * d,
            70 * d + 18 * (1 - Math.exp(-4 * d)),
            -170 * d,
        ]);
    };
    const puff = (u - 0.7) / 0.5;
    return {
        shot: {
            orbit: -0.55,
            focus: [0, -5, 0],
            distance: 400,
            lift: -120,
            zoom: 0.85,
            centerY: 0.56,
        },
        figures: [
            {
                chair,
                rider:
                    u < RELEASE
                        ? (p) => tipForward(p, FRONT_WHEEL, tip)
                        : thrown,
                face: face(0, 0, 0.6),
            },
        ],
        punch: 0,
        puff:
            puff > 0 && puff < 1
                ? { at: chair([32, -22, 0]), k: puff }
                : undefined,
    };
}
function bewildered(u: number, t: number): EpilogueStage {
    const lean = 0.08 + (DRIFT_ROLL - 0.08) * smooth(u / 1.4);
    const bob = Math.sin(t * 1.7) * 1.2;
    return {
        shot: { orbit: -1, focus: [6, 40, 0], distance: 165, lift: 4, zoom: 1 },
        figures: [
            {
                parts: 'chair',
                chair: (p) => shift(p, [-900, -70, 160]),
            },
            {
                rider: (p) => shift(roll(p, BODY, lean), [0, bob, 0]),
                face: face(
                    0,
                    pulse(u, 0.45, 0.14) + pulse(u, 0.78, 0.14),
                    0.25,
                ),
            },
        ],
        punch: 0,
    };
}
function stare(beat: EpilogueBeat): EpilogueStage {
    const bob = Math.sin(beat.t * 2.2) * 1.2;
    const length = beat.shot < 2 ? 0.8 : 0.4;
    const onChair = beat.cut === 'stare-chair';
    const chair: EndingPose = {
        parts: 'chair',
        chair: (p) => shift(p, [0, bob, 0]),
        tint: onChair ? { chair: darken(0.28) } : undefined,
    };
    const rider: EndingPose = {
        rider: (p) =>
            shift(turnAround(roll(p, BODY, DRIFT_ROLL)), [
                ADRIFT[0],
                ADRIFT[1] - bob,
                ADRIFT[2],
            ]),
        face: face(0, onChair ? pulse(beat.u, length * 0.45, 0.14) : 0, 0.25),
        tint: onChair ? undefined : { rider: darken(0.32) },
    };
    return {
        shot: onChair
            ? {
                  orbit: 0.93,
                  focus: [ADRIFT[0], 40, 0],
                  distance: 630,
                  lift: -5,
                  zoom: 1,
                  offsetX: 0.05,
              }
            : {
                  orbit: -0.925,
                  focus: [0, 0, 0],
                  distance: 680,
                  lift: 62,
                  zoom: 1,
                  offsetX: -0.04,
              },
        figures: [chair, rider],
        punch: 0,
    };
}
export function stageEpilogue(beat: EpilogueBeat): EpilogueStage {
    switch (beat.cut) {
        case 'tap':
            return tap(beat.u);
        case 'look':
            return look(beat.u);
        case 'shake':
            return shake(beat.u);
        case 'strain':
            return strain(beat.u);
        case 'drop':
            return drop(beat.u);
        case 'bewildered':
            return bewildered(beat.u, beat.t);
        case 'stare-chair':
        case 'stare-rider':
            return stare(beat);
    }
}
