import { ORBIT_ENDING } from './ending-timeline';
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
    /** Index into `figures` of an over-the-shoulder foreground figure. */
    front?: number;
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
/** Cut 2 ends looking back over the shoulder; cut 3 starts there. */
const LOOK_BACK = 60 * DEG;
const SINK = 7;

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
const squash = (p: Point3, c: Point3, s: number): Point3 => [
    c[0] + (p[0] - c[0]) * (1 - s / 2),
    c[1] + (p[1] - c[1]) * (1 + s),
    c[2] + (p[2] - c[2]) * (1 - s / 2),
];
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
            orbit: 0.08,
            focus: [-6, 5, 0],
            distance: 290,
            lift: 35,
            zoom: 1,
        },
        figures: [{ backrest, rider }],
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
            orbit: 0.65,
            focus: [-4, 36, 4],
            distance: 140,
            lift: 12,
            zoom: 1,
        },
        figures: [{ headYaw: LOOK_BACK * smooth((u - 0.25) / 0.55) }],
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
                // Picks up the look-back from cut 2 and snaps forward on the first jolt.
                headYaw: LOOK_BACK * (1 - smooth(u / 0.22)),
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
                sink: SINK * smooth(u / 0.55),
                splay: smooth(u / 0.5),
                tremble: Math.sin(u * 95) * 0.9 * Math.min(1, u / 0.1),
                sweat: sweat <= 1 ? sweat : -1,
            },
        ],
        punch: 0,
    };
}

/** Seconds since the chair flung the rider off; negative while he still sits. */
const sinceFling = (beat: EpilogueBeat) =>
    beat.t + ORBIT_ENDING.tap - ORBIT_ENDING.fling;
const FLING_TIP = 0.45;
const BOUNCE = 14;
/** The chair, from the strained crouch through the fling and its spring back. */
function chairAt(d: number, t: number): EndingPose {
    if (d < 0) {
        const s = d + ORBIT_ENDING.fling - ORBIT_ENDING.drop;
        const tip =
            FLING_TIP * smooth(s / 0.45) +
            0.04 * Math.sin(s * 60) * pulse(s, 0.05, 0.3);
        return {
            parts: 'chair',
            chair: (p) => tipForward(p, FRONT_WHEEL, tip),
            sink: SINK,
            splay: 1,
            tremble: Math.sin(s * 95) * 0.6,
        };
    }
    const spring = Math.exp(-3 * d);
    const tip = FLING_TIP * spring * Math.cos(BOUNCE * d);
    const stretch = 0.12 * spring * Math.sin(BOUNCE * d);
    const bob = floatBob(d, t);
    return {
        parts: 'chair',
        chair: (p) =>
            shift(squash(tipForward(p, FRONT_WHEEL, tip), FLOOR, stretch), [
                0,
                bob,
                0,
            ]),
        sink: SINK * spring * Math.cos(BOUNCE * d),
        splay: Math.exp(-5 * d),
    };
}
const floatBob = (d: number, t: number) =>
    Math.sin(t * 2.2) * 1.2 * smooth(d / 2.5);
const yaw = (p: Point3, a: number): Point3 => [
    p[0] * Math.cos(a) - p[2] * Math.sin(a),
    p[1],
    p[0] * Math.sin(a) + p[2] * Math.cos(a),
];
/**
 * The rider's flight in one continuous motion, so every cut from the fling
 * to the stare picks up the pose the previous cut left: a forward
 * somersault and a half turn that both slow to a stop as he drifts out to
 * ADRIFT, facing back at the chair.
 */
function riderAt(d: number, t: number): Place {
    if (d < 0) {
        const chair = chairAt(d, t).chair!;
        return (p) => chair([p[0], p[1] - SINK, p[2]]);
    }
    const e = 1 - Math.exp(-1.6 * d);
    const somersault = FLING_TIP + (2 * Math.PI - FLING_TIP) * e;
    const seat = tipForward(BODY, FRONT_WHEEL, FLING_TIP);
    const bob = floatBob(d, t);
    const lift = 30 * e * (1 - e);
    const move: Point3 = [
        (seat[0] - BODY[0]) * (1 - e) + ADRIFT[0] * e,
        (seat[1] - BODY[1]) * (1 - e) + ADRIFT[1] * e + lift - bob,
        (seat[2] - BODY[2]) * (1 - e) + ADRIFT[2] * e,
    ];
    return (p) => {
        const seated: Point3 = [p[0], p[1] - SINK * (1 - e), p[2]];
        const spun = yaw(
            roll(tipForward(seated, BODY, somersault), BODY, DRIFT_ROLL * e),
            Math.PI * e,
        );
        return shift(spun, move);
    };
}
function drop(beat: EpilogueBeat): EpilogueStage {
    const d = sinceFling(beat);
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
            chairAt(d, beat.t),
            { parts: 'rider', rider: riderAt(d, beat.t) },
        ],
        punch: 0,
    };
}
function drift(beat: EpilogueBeat): EpilogueStage {
    const d = sinceFling(beat);
    const chair = chairAt(d, beat.t);
    const puff = (d - 0.45) / 0.7;
    return {
        shot: {
            orbit: 0,
            focus: [200, 0, 0],
            distance: 560,
            lift: 45,
            zoom: 1,
        },
        figures: [chair, { parts: 'rider', rider: riderAt(d, beat.t) }],
        punch: 0,
        puff:
            puff > 0 && puff < 1
                ? { at: chair.chair!([32, -22, 0]), k: puff }
                : undefined,
    };
}
function bewildered(beat: EpilogueBeat): EpilogueStage {
    const d = sinceFling(beat);
    return {
        shot: {
            orbit: 0.25,
            focus: [425, 52, -10],
            distance: 175,
            lift: 8,
            zoom: 1,
            offsetX: 0.1,
        },
        figures: [
            chairAt(d, beat.t),
            { parts: 'rider', rider: riderAt(d, beat.t) },
        ],
        punch: 0,
    };
}
function stare(beat: EpilogueBeat): EpilogueStage {
    const d = sinceFling(beat);
    const onChair = beat.cut === 'stare-chair';
    const chair = chairAt(d, beat.t);
    const rider: EndingPose = { parts: 'rider', rider: riderAt(d, beat.t) };
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
        front: onChair ? 0 : 1,
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
            return drop(beat);
        case 'drift':
            return drift(beat);
        case 'bewildered':
            return bewildered(beat);
        case 'stare-chair':
        case 'stare-rider':
            return stare(beat);
    }
}
