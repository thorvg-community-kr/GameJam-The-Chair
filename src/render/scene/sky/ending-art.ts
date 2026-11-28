import { riderHeadBsp, riderNeckPart } from './player-head';
import {
    LAPTOP_BASE_TOP,
    SCREEN_BACK_NORMAL,
    drawRetroLaptopBase,
    drawRetroLaptopScreen,
    laptopScreenOrigin,
    laptopScreenPoint,
} from './retro-laptop';
import { ART } from '../../art';
import { placedProjection } from '../shared/projection';

import type { Decal, Point3, SkyProjection } from '../shared/projection';

export { laptopScreenPoint };

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

type ScreenDraw = (view: SkyProjection, bob: number) => void;
type FramePose = Pick<EndingPose, 'sink' | 'splay' | 'tremble' | 'sweat'>;

const NECK: Point3 = [-2, 33, 0];
const BACKREST_PIVOT: Point3 = [-24, -25, 0];
const ARM_SPLIT_X = 9.0;
const SEAT_TOP_Y2D = -14.6;
const HIP_TOP_Y2D = -25.3;
const SHOULDER_TOP_Y2D = -62.5;
const NECK_TOP_Y2D = -67.0;

const LEGS = [
    { z: -9.2, kneeX: 30.5, ankleX: 35.0, ankleY: 6.5 },
    { z: 9.2, kneeX: 28.5, ankleX: 30.5, ankleY: 8.0 },
] as const;

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
    const keepDecals = (
        decals: NonNullable<Parameters<SkyProjection['polygon']>[2]>['decals'],
    ) => decals?.map((item) => ({ ...item, color: keep(item.color) }));
    return {
        ...view,
        polygon: (points, color, options) =>
            view.polygon(
                points,
                keep(color),
                options?.decals
                    ? { ...options, decals: keepDecals(options.decals) }
                    : options,
            ),
        profile: (outline, halfWidth, color, z, options) =>
            view.profile(outline, halfWidth, keep(color), z, options),
        box: (bounds, color, shade) => view.box(bounds, keep(color), shade),
        oval: (center, radii, color, axes) =>
            view.oval(center, radii, keep(color), axes),
        rod: (a, b, r, color, options) =>
            view.rod(a, b, r, keep(color), options),
    };
}

const placed = (view: SkyProjection, place?: Place) =>
    place ? placedProjection(view, place) : view;
const tinted = (view: SkyProjection, tint?: (color: string) => string) =>
    tint ? tintedProjection(view, tint) : view;

const p3 = (x: number, y: number, z: number, bob: number): Point3 => [
    x,
    -y - 35 + bob,
    z,
];

const lerp3 = (a: Point3, b: Point3, t: number): Point3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
];

const hex = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');

function drawChairLower(
    chairView: SkyProjection,
    upperView: SkyProjection,
    bob: number,
    frame: FramePose = {},
) {
    const palette = ART.palette;
    const { sink = 0, splay = 0, tremble = 0, sweat = -1 } = frame;
    const hub = 13 + sink * 0.4;
    const spread = 1 + 0.28 * splay;
    const drawBase = () =>
        chairView.part(() => {
            chairView.rod(
                p3(tremble, -4 + sink, 0, bob),
                p3(0, 16, 0, bob),
                3,
                palette.steel,
                { shade: true },
            );
            for (const [x, z] of [
                [-27, 22],
                [27, 22],
                [-27, -22],
                [27, -22],
                [0, -30],
            ]) {
                chairView.rod(
                    p3(0, hub, 0, bob),
                    p3(x * spread, 21, z * spread, bob),
                    2.5,
                    palette.steel,
                    { shade: true },
                );
                chairView.oval(
                    p3(x * spread, 23, z * spread, bob),
                    [7, 8, 5],
                    '#3f4650',
                );
                chairView.oval(
                    p3(x * spread, 23, z * spread + 4.7, bob),
                    [2.5, 2.5, 0.5],
                    '#9197a2',
                );
            }
            if (sweat >= 0 && sweat <= 1) {
                const y = -2 + sink + 16 * sweat;
                chairView.oval(
                    p3(3.6 + tremble, y, 2.2, bob),
                    [1.9, 2.8, 1.9],
                    '#9fd8ff',
                );
                chairView.oval(
                    p3(3.9 + tremble, y - 0.6, 2.2, bob),
                    [0.4, 0.6, 0.4],
                    '#ffffff',
                );
            }
        });
    const drawSeat = () =>
        upperView.part(() => {
            upperView.rod(
                p3(-24, -10, 0, bob),
                p3(-25.5, SEAT_TOP_Y2D, 0, bob),
                3.2,
                '#515665',
                { sides: 8, shade: true },
            );
            upperView.profile(
                [
                    [-28, -(-14.2) - 35 + bob],
                    [26, -(-14.2) - 35 + bob],
                    [26, -(-3.5) - 35 + bob],
                    [-28, -(-3.5) - 35 + bob],
                ],
                25,
                '#6f7687',
                0,
                { bevel: 0.9, shade: true },
            );
        });
    chairView.split(p3(0, -3.5, 0, bob), [0, 1, 0], drawBase, drawSeat);
}

function drawBackrest(backView: SkyProjection, bob: number) {
    backView.part(() => {
        backView.rod(
            p3(-25.5, SEAT_TOP_Y2D, 0, bob),
            p3(-31, -58, 0, bob),
            3.2,
            '#515665',
            { sides: 8, shade: true },
        );
        backView.profile(
            [
                [-36.5, -(-66) - 35 + bob],
                [-24.0, -(-66) - 35 + bob],
                [-24.0, -(-19) - 35 + bob],
                [-35.0, -(-19) - 35 + bob],
            ],
            23,
            '#666d80',
            0,
            { bevel: 0.9, shade: true },
        );
    });
}

function calfSplitX(leg: (typeof LEGS)[number]) {
    const t = (SEAT_TOP_Y2D - -19.2) / (leg.ankleY - -19.2);
    return leg.kneeX + (leg.ankleX - leg.kneeX) * t;
}

function drawCalfLower(
    view: SkyProjection,
    leg: (typeof LEGS)[number],
    bob: number,
) {
    view.part(() => {
        const splitX = calfSplitX(leg);
        view.rod(
            p3(splitX, SEAT_TOP_Y2D, leg.z, bob),
            p3(leg.ankleX, leg.ankleY, leg.z, bob),
            4.2,
            '#56667c',
            { sides: 10, capA: true, capB: true, shade: true },
        );
        view.box(
            {
                x0: leg.ankleX - 4.2,
                x1: leg.ankleX + 10.2,
                y0: -(leg.ankleY + 5.5) - 35 + bob,
                y1: -(leg.ankleY + 0.3) - 35 + bob,
                z0: leg.z - 4.3,
                z1: leg.z + 4.3,
            },
            '#353c4a',
            true,
        );
    });
}

function drawThighAndKnee(
    view: SkyProjection,
    leg: (typeof LEGS)[number],
    bob: number,
) {
    view.part(() => {
        const splitX = calfSplitX(leg);
        view.rod(
            p3(6.5, -20.0, leg.z, bob),
            p3(leg.kneeX - 1.2, -20.0, leg.z, bob),
            4.6,
            '#56667c',
            { sides: 10, shade: true },
        );
        view.oval(
            p3(leg.kneeX - 0.4, -19.8, leg.z, bob),
            [4.6, 4.6, 4.5],
            '#56667c',
        );
        view.rod(
            p3(leg.kneeX, -19.2, leg.z, bob),
            p3(splitX, SEAT_TOP_Y2D, leg.z, bob),
            4.2,
            '#56667c',
            { sides: 10, capB: true, shade: true },
        );
    });
}

function drawTorso(view: SkyProjection, bob: number) {
    view.part(() => {
        view.profile(
            [
                [-16.2, -(-62.2) - 35 + bob],
                [-5.0, -(-63.0) - 35 + bob],
                [5.8, -(-60.2) - 35 + bob],
                [8.4, -(-25.5) - 35 + bob],
                [-16.2, -(-25.5) - 35 + bob],
            ],
            14.6,
            ART.palette.shirt,
            0,
            { bevel: 0.9, shade: true },
        );
        const chestX = (y: number) => 5.8 + ((y + 60.2) * 2.6) / 34.7;
        const on = (y: number, z: number, lift = 0.25) =>
            p3(chestX(y) + lift, y, z, bob);
        const chestDecals: Decal[] = [
            {
                kind: 'poly',
                points: [on(-61.2, -1.2), on(-60.2, -6.8), on(-54.8, -3.0)],
                color: '#fff6de',
            },
            {
                kind: 'poly',
                points: [on(-61.2, 1.2), on(-60.2, 6.8), on(-54.8, 3.0)],
                color: '#fff6de',
            },
            {
                kind: 'poly',
                points: [
                    on(-60.2, -1.9, 0.35),
                    on(-60.2, 1.9, 0.35),
                    on(-56.2, 1.3, 0.35),
                    on(-56.2, -1.3, 0.35),
                ],
                color: '#93503a',
            },
            {
                kind: 'poly',
                points: [
                    on(-56.2, -1.2, 0.3),
                    on(-56.2, 1.2, 0.3),
                    on(-36.5, 2.4, 0.3),
                    on(-33.5, 0, 0.3),
                    on(-36.5, -2.4, 0.3),
                ],
                color: '#a65e44',
            },
        ];
        view.biased(0.6, () => {
            view.polygon(
                [
                    on(-60.2, -7.2, 0.15),
                    on(-60.2, 7.2, 0.15),
                    on(-32.0, 7.2, 0.15),
                    on(-32.0, -7.2, 0.15),
                ],
                ART.palette.shirt,
                { shade: false, decals: chestDecals },
            );
        });
    });
}

function armGeometry(side: number, bob: number, elapsed: number, rest: number) {
    const lift = -4 * rest;
    const tap =
        Math.sin(elapsed * 24 + (side > 0 ? 0 : Math.PI)) * 1.1 * (1 - rest) +
        lift;
    const handY = LAPTOP_BASE_TOP - 2.3 + tap;
    const sh = p3(-5.5, -57.5, side * 18.4, bob);
    const elb = p3(-4.5, -34.8, side * 18.6, bob);
    const wrist = p3(22.0, handY + 0.9, side * 11.4, bob);
    const t = (ARM_SPLIT_X - elb[0]) / (wrist[0] - elb[0]);
    const mid = lerp3(elb, wrist, t);
    const palm = p3(30.5, handY - 0.3, side * 9.5, bob);
    return { sh, elb, mid, wrist, palm, handY };
}

function drawUpperArm(
    view: SkyProjection,
    side: number,
    { bob, elapsed, rest }: { bob: number; elapsed: number; rest: number },
) {
    const { sh, elb, mid } = armGeometry(side, bob, elapsed, rest);
    view.part(() => {
        view.rod(sh, elb, 3.6, '#e6e0cc', {
            sides: 10,
            capA: true,
            capB: true,
            shade: true,
        });
        view.oval(sh, [3.8, 4.0, 3.6], '#ebe6d4');
        view.rod(
            p3(-5.1, -39.5, side * 18.7, bob),
            p3(-5.0, -34.8, side * 18.8, bob),
            3.9,
            '#fff6de',
            { sides: 10, capA: true, capB: true, shade: true },
        );
        view.oval(elb, [3.0, 3.0, 3.0], ART.palette.skin);
        view.rod(elb, mid, 2.8, ART.palette.skin, { sides: 10, shade: true });
    });
}

function drawForearmAndHand(
    view: SkyProjection,
    side: number,
    { bob, elapsed, rest }: { bob: number; elapsed: number; rest: number },
) {
    const { mid, wrist, palm, handY } = armGeometry(side, bob, elapsed, rest);
    view.part(() => {
        view.rod(mid, wrist, 2.8, ART.palette.skin, {
            sides: 10,
            capB: true,
            shade: true,
        });
        view.rod(wrist, palm, 2.3, ART.palette.skin, {
            sides: 8,
            capB: true,
            shade: true,
        });
        for (const offset of [-1.2, 0, 1.2]) {
            view.rod(
                p3(30.0, handY - 0.2, side * 9.5 + offset, bob),
                p3(35.0, handY + 1.0, side * 8.8 + offset * 0.9, bob),
                0.8,
                '#dfb98f',
                { sides: 6, capB: true, shade: true },
            );
        }
    });
}

type AssemblySpec = {
    root: SkyProjection;
    chairView?: SkyProjection;
    upperView?: SkyProjection;
    backView?: SkyProjection;
    riderView?: SkyProjection;
    neckView?: SkyProjection;
    headView?: SkyProjection;
    frame?: FramePose;
    bob: number;
    elapsed: number;
    rest: number;
    screen?: ScreenDraw;
    attachedExtinguisher?: { spray: number; rocket: number };
};

function drawHipAndThighsBsp(riderView: SkyProjection, bob: number) {
    const pelvis = () =>
        riderView.part(() => {
            riderView.box(
                {
                    x0: -15,
                    x1: 6.5,
                    y0: -(-15.0) - 35 + bob,
                    y1: -(-25.1) - 35 + bob,
                    z0: -14.2,
                    z1: 14.2,
                },
                '#4f5e73',
                true,
            );
        });
    const thighs = () =>
        riderView.split(
            p3(18, -20, 0, bob),
            [0, 0, 1],
            () => drawThighAndKnee(riderView, LEGS[0], bob),
            () => drawThighAndKnee(riderView, LEGS[1], bob),
        );
    riderView.split(p3(6.5, -20, 0, bob), [1, 0, 0], pelvis, thighs);
}

function drawMidAndLaptopBsp(
    riderView: SkyProjection,
    spec: Pick<AssemblySpec, 'bob' | 'elapsed' | 'rest' | 'screen'>,
) {
    const { bob, screen } = spec;
    const armState = { bob, elapsed: spec.elapsed, rest: spec.rest };
    const torsoAndUpperArms = () => {
        if (riderView.planeSide(p3(-5, -45, 0, bob), [0, 0, 1])) {
            drawUpperArm(riderView, -1, armState);
            drawTorso(riderView, bob);
            drawUpperArm(riderView, 1, armState);
        } else {
            drawUpperArm(riderView, 1, armState);
            drawTorso(riderView, bob);
            drawUpperArm(riderView, -1, armState);
        }
    };
    const baseAndHands = () =>
        riderView.split(
            p3(30, LAPTOP_BASE_TOP - 0.15, 0, bob),
            [0, 1, 0],
            () => drawRetroLaptopBase(riderView, bob),
            () =>
                riderView.split(
                    p3(25, LAPTOP_BASE_TOP - 2, 0, bob),
                    [0, 0, 1],
                    () => drawForearmAndHand(riderView, -1, armState),
                    () => drawForearmAndHand(riderView, 1, armState),
                ),
        );
    const laptopAndHands = () =>
        riderView.split(
            laptopScreenOrigin(bob),
            SCREEN_BACK_NORMAL,
            baseAndHands,
            () => drawRetroLaptopScreen(riderView, bob, screen),
        );
    riderView.split(
        p3(ARM_SPLIT_X, -42, 0, bob),
        [1, 0, 0],
        torsoAndUpperArms,
        laptopAndHands,
    );
}

function drawAssemblyBsp(spec: AssemblySpec) {
    const { root, chairView, upperView, backView, riderView, bob } = spec;
    const ref = riderView ?? chairView ?? root;

    const drawLowerZone = () => {
        const chair = () => {
            if (chairView && upperView) {
                drawChairLower(chairView, upperView, bob, spec.frame);
            }
        };
        const calves = () => {
            if (!riderView) {
                return;
            }
            riderView.split(
                p3(30, 0, 0, bob),
                [0, 0, 1],
                () => drawCalfLower(riderView, LEGS[0], bob),
                () => drawCalfLower(riderView, LEGS[1], bob),
            );
        };
        ref.split(p3(26.8, -5, 0, bob), [1, 0, 0], chair, calves);
    };

    const drawHeadAndNeck = () => {
        if (!riderView) {
            return;
        }
        const neckView = spec.neckView ?? riderView;
        const headView = spec.headView ?? riderView;
        riderView.split(
            p3(0, NECK_TOP_Y2D, 0, bob),
            [0, 1, 0],
            () => riderNeckPart(neckView, bob),
            () => riderHeadBsp(headView, ART.palette.skin, bob),
        );
    };

    const drawBackAndTank = () => {
        if (!backView) {
            return;
        }
        const tank = spec.attachedExtinguisher;
        if (!tank) {
            drawBackrest(backView, bob);
            return;
        }
        backView.split(
            p3(-36.5, -35, 0, bob),
            [1, 0, 0],
            () =>
                backView.part(() =>
                    extinguisher(
                        backView,
                        bob,
                        spec.elapsed,
                        tank.spray,
                        tank.rocket,
                    ),
                ),
            () => drawBackrest(backView, bob),
        );
    };

    const drawRiderUpper = () => {
        if (!riderView) {
            return;
        }
        const upperBody = () =>
            riderView.split(
                p3(0, SHOULDER_TOP_Y2D, 0, bob),
                [0, 1, 0],
                () => drawMidAndLaptopBsp(riderView, spec),
                drawHeadAndNeck,
            );
        riderView.split(
            p3(0, HIP_TOP_Y2D, 0, bob),
            [0, 1, 0],
            () => drawHipAndThighsBsp(riderView, bob),
            upperBody,
        );
    };

    root.bsp(() => {
        ref.split(p3(0, SEAT_TOP_Y2D, 0, bob), [0, 1, 0], drawLowerZone, () =>
            ref.split(
                p3(-21.5, -40, 0, bob),
                [1, 0, 0],
                drawBackAndTank,
                drawRiderUpper,
            ),
        );
    });
}

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
        screen,
    }: {
        loose?: number;
        rest?: number;
        rocket?: number;
        pose?: EndingPose;
        screen?: ScreenDraw;
    } = {},
): number {
    const bob =
        Math.sin(elapsed * 1.6) * 1.5 + Math.sin(elapsed * 25) * 3 * arrival;
    if (pose) {
        return posedChair(view, bob, elapsed, { rest, pose, screen });
    }
    drawAssemblyBsp({
        root: view,
        chairView: view,
        upperView: view,
        backView: view,
        riderView: view,
        bob,
        elapsed,
        rest,
        screen,
        attachedExtinguisher: loose < 0 ? { spray, rocket } : undefined,
    });
    if (loose >= 0) {
        drawLooseExtinguisher(
            view,
            elapsed,
            loose,
            spray * Math.exp(-loose * 0.6),
            rocket,
        );
    }
    return bob;
}

function posedChair(
    view: SkyProjection,
    bob: number,
    elapsed: number,
    {
        rest,
        pose,
        screen,
    }: { rest: number; pose: EndingPose; screen?: ScreenDraw },
): number {
    const { parts = 'all', sink = 0, headYaw = 0 } = pose;
    const chairView = tinted(placed(view, pose.chair), pose.tint?.chair);
    const upperView = placedProjection(chairView, (p) => [
        p[0],
        p[1] - sink,
        p[2],
    ]);
    const backView = placedProjection(chairView, (p) =>
        tipForward(
            [p[0], p[1] - sink, p[2]],
            BACKREST_PIVOT,
            pose.backrest ?? 0,
        ),
    );
    const sitting: Place = (p) =>
        (pose.chair ?? ((q: Point3) => q))([p[0], p[1] - sink, p[2]]);
    const riderView = tinted(
        placed(view, pose.rider ?? sitting),
        pose.tint?.rider,
    );
    const neckView = placedProjection(riderView, (p) =>
        rotateY(p, NECK, headYaw / 2),
    );
    const headView = placedProjection(riderView, (p) =>
        rotateY(p, NECK, headYaw),
    );
    drawAssemblyBsp({
        root: view,
        chairView: parts !== 'rider' ? chairView : undefined,
        upperView: parts !== 'rider' ? upperView : undefined,
        backView: parts !== 'rider' ? backView : undefined,
        riderView: parts !== 'chair' ? riderView : undefined,
        neckView: parts !== 'chair' ? neckView : undefined,
        headView: parts !== 'chair' ? headView : undefined,
        frame: pose,
        bob,
        elapsed,
        rest,
        screen,
    });
    return bob;
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

function drawLooseExtinguisher(
    view: SkyProjection,
    elapsed: number,
    loose: number,
    spray: number,
    rocket: number,
) {
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
        return [
            v[0] * cos +
                c[0] * sin +
                axis[0] * d * (1 - cos) +
                centre[0] +
                shift[0],
            v[1] * cos +
                c[1] * sin +
                axis[1] * d * (1 - cos) +
                centre[1] +
                shift[1],
            v[2] * cos +
                c[2] * sin +
                axis[2] * d * (1 - cos) +
                centre[2] +
                shift[2],
        ];
    };
    const looseView = placedProjection(view, move);
    extinguisher(looseView, 0, elapsed, spray, rocket);
}

function extinguisher(
    view: SkyProjection,
    bob: number,
    elapsed: number,
    spray: number,
    rocket: number,
) {
    const pt = (x: number, y: number, z = 0) => p3(x, y, z, bob);
    view.rod(pt(-39, -49), pt(-45, -13), 2, '#394657');
    view.rod(pt(-46, -48), pt(-46, -9), 8, '#b75f4a');
    view.oval(pt(-46, -48), [8, 5, 8], '#c7765c');
    view.oval(pt(-46, -9), [8, 3, 8], '#b75f4a');
    view.rod(pt(-46, -37), pt(-46, -26), 8.2, '#eee5cd');
    view.rod(pt(-46, -52), pt(-46, -59), 2, '#394657');
    view.rod(pt(-49, -59), pt(-35, -59), 1.5, '#394657');
    for (let i = 0; rocket < 1 && spray > 0 && i < 5; i++) {
        const age = (elapsed * 1.5 + i * 0.19) % 1;
        view.oval(
            pt(-46 - age * 4, -7 + age * 50 * spray),
            [3 + age * 7, 4 + age * 9, 3 + age * 6],
            '#f6e6df' + hex((100 / 255) * (1 - age) * (1 - rocket)),
        );
    }
    if (rocket <= 0) {
        return;
    }
    view.rod(pt(-46, -9), pt(-46, -4), 5.5, '#2f3540');
    if (spray > 0) {
        rocketExhaust(view, bob, elapsed, spray * rocket);
    }
}

function rocketExhaust(
    view: SkyProjection,
    bob: number,
    elapsed: number,
    spray: number,
) {
    const pt = (x: number, y: number, z = 0) => p3(x, y, z, bob);
    const power = Math.min(1.8, spray);
    const flicker =
        1 + Math.sin(elapsed * 47) * 0.08 + Math.sin(elapsed * 83) * 0.05;
    const reach = (120 + 230 * power) * flicker;
    view.oval(
        pt(-46, -3.5),
        [6.5, 1.2, 6.5],
        '#ffe9b0' + hex(Math.min(1, power * 2)),
    );
    const puffs = Math.round(14 + 18 * Math.min(1, power));
    for (let i = 0; i < puffs; i++) {
        const age = (elapsed * 2.6 + i / puffs) % 1;
        const swirl = i * 2.39 + elapsed * 3;
        const spread = age * age * 50 * power;
        const size = 7 + age * 55 * (0.6 + 0.4 * power);
        const tone = age < 0.25 ? '#fff4d6' : age < 0.6 ? '#f6efe4' : '#dcdcd8';
        view.oval(
            pt(
                -46 - age * reach * 0.55 + Math.cos(swirl) * spread,
                -2 + age * reach,
                Math.sin(swirl) * spread,
            ),
            [size, size * (1.1 + 0.5 * (1 - age)), size],
            tone +
                hex(
                    Math.min(1, age / 0.18) *
                        (1 - age) *
                        (1 - age) *
                        0.9 *
                        Math.min(1, power + 0.3),
                ),
        );
    }
    const core = (40 + 50 * power) * flicker;
    view.oval(
        pt(-54, 6),
        [16 * power, 18 * power, 16 * power],
        '#fff1c4' + hex(0.35 * Math.min(1, power)),
    );
    for (let k = 0; k < 6; k++) {
        const along = ((k + 0.5) / 6) * core;
        const r = 8 * (1 - k / 8);
        view.oval(
            pt(-46 - along * 0.55, -2 + along),
            [r, r * 1.5, r],
            (k < 2 ? '#ffe28a' : '#ffb347') + hex(0.85 * (1 - k / 7)),
        );
    }
    for (let k = 1; k <= 3; k++) {
        const along = core * k * 0.26;
        const r = 5.5 - k * 0.9;
        view.oval(
            pt(-46 - along * 0.55, -2 + along),
            [r, r * 1.6, r],
            '#ffffff' + hex(0.95 - k * 0.2),
        );
    }
}
