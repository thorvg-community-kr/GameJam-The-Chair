import type { Decal, Point3, SkyProjection } from '../shared/projection';

export const LAPTOP_BASE_BOTTOM = -25.4;
export const LAPTOP_BASE_TOP = -27.8;
const HINGE_X = 48.0;
const LID_SLOPE_X = 6.4;
const LID_HEIGHT_Y = 24.8;
const LID_HALF_W = 20.6;
const LID_THICKNESS = 1.05;

export const SCREEN_BACK_NORMAL: Point3 = [LID_HEIGHT_Y, -LID_SLOPE_X, 0];

const p3 = (x: number, y: number, z: number, bob: number): Point3 => [
    x,
    -y - 35 + bob,
    z,
];

const deckQuad = (
    xs: [number, number],
    zs: [number, number],
    y: number,
    bob: number,
): Point3[] => [
    p3(xs[0], y, zs[0], bob),
    p3(xs[0], y, zs[1], bob),
    p3(xs[1], y, zs[1], bob),
    p3(xs[1], y, zs[0], bob),
];

export function laptopScreenPoint(
    u: number,
    v: number,
    bob: number,
    lift = 0,
): Point3 {
    return [
        HINGE_X + LID_SLOPE_X * v - 0.96 * lift,
        -LAPTOP_BASE_TOP - 35 + LID_HEIGHT_Y * v + bob + 0.26 * lift,
        -LID_HALF_W + LID_HALF_W * 2 * u,
    ];
}

export function laptopScreenOrigin(bob: number): Point3 {
    return laptopScreenPoint(0.5, 0, bob, 0);
}

function keyDecals(view: SkyProjection, yD: number, bob: number): Decal[] {
    const start = view.project(p3(32, yD, -17.5, bob));
    const end = view.project(p3(32, yD, -14.0, bob));
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 2) {
        return [];
    }
    const keys: Decal[] = [];
    for (let row = 0; row < 4; row++) {
        const x0 = 28.4 + row * 4.0;
        for (let col = 0; col < 10; col++) {
            const z = -17.5 + col * 3.55;
            keys.push({
                kind: 'poly',
                points: deckQuad([x0, x0 + 3.2], [z, z + 2.9], yD, bob),
                color: '#4c5769',
            });
        }
    }
    return keys;
}

export function drawRetroLaptopBase(view: SkyProjection, bob: number): void {
    view.part(() => {
        view.box(
            {
                x0: 16.5,
                x1: 48.5,
                y0: -LAPTOP_BASE_BOTTOM - 35 + bob,
                y1: -LAPTOP_BASE_TOP - 35 + bob,
                z0: -20.8,
                z1: 20.8,
            },
            '#444c59',
            true,
        );
        const yD = LAPTOP_BASE_TOP - 0.08;
        const addRect = (
            x0: number,
            z0: number,
            x1: number,
            z1: number,
            color: string,
        ): Decal => ({
            kind: 'poly',
            points: deckQuad([x0, x1], [z0, z1], yD, bob),
            color,
        });
        const decals: Decal[] = [
            // Power and activity LEDs near the hinge
            addRect(45.5, 13.5, 46.8, 15.2, '#5de08a'),
            addRect(45.5, 16.0, 46.8, 17.5, '#e8b954'),
            // Small corporate trackpad and physical left/right click buttons
            addRect(20.6, -5.0, 26.2, 5.0, '#465362'),
            addRect(21.0, -4.6, 25.8, 4.6, '#2a303b'),
            addRect(18.0, -5.0, 20.1, -0.3, '#576274'),
            addRect(18.0, 0.3, 20.1, 5.0, '#576274'),
            // Recessed keyboard tray
            addRect(27.6, -18.4, 44.8, 18.4, '#222c39'),
            ...keyDecals(view, yD, bob),
            // Red pointing stick nub in the center of the keyboard
            {
                kind: 'oval',
                center: p3(35.6, yD - 0.25, 0, bob),
                radii: [1.15, 0.5, 1.15],
                color: '#e6493c',
            },
        ];
        view.biased(0.5, () => {
            view.polygon(
                deckQuad([16.8, 48.2], [-20.4, 20.4], yD, bob),
                '#38404d',
                { shade: false, decals },
            );
        });
        // Dual exposed metallic barrel hinges
        for (const [za, zb] of [
            [-16.5, -11.0],
            [11.0, 16.5],
        ]) {
            view.rod(
                p3(47.8, LAPTOP_BASE_TOP - 0.3, za, bob),
                p3(47.8, LAPTOP_BASE_TOP - 0.3, zb, bob),
                1.0,
                '#7c8696',
                { sides: 8, capA: true, capB: true, shade: true },
            );
        }
    });
}

function drawLidFront(view: SkyProjection, bob: number) {
    const sp = (u: number, v: number) => laptopScreenPoint(u, v, bob, 0);
    const sq = (u0: number, v0: number, u1: number, v1: number): Point3[] => [
        sp(u0, v0),
        sp(u1, v0),
        sp(u1, v1),
        sp(u0, v1),
    ];
    const screenDecals: Decal[] = [
        { kind: 'poly', points: sq(0.03, 0.05, 0.97, 0.95), color: '#9caaba' },
        { kind: 'poly', points: sq(0.05, 0.08, 0.95, 0.92), color: '#a8b9c3' },
        { kind: 'poly', points: sq(0.05, 0.84, 0.95, 0.92), color: '#4a6894' },
        { kind: 'poly', points: sq(0.49, 0.96, 0.51, 0.98), color: '#1b2029' },
    ];
    for (let i = 0; i < 4; i++) {
        const v = 0.72 - i * 0.14;
        screenDecals.push({
            kind: 'poly',
            points: sq(0.11, v - 0.022, 0.78 - i * 0.08, v + 0.022),
            color: '#7d95aa',
        });
    }
    view.polygon(sq(0, 0, 1, 1), '#262d38', {
        shade: false,
        decals: screenDecals,
    });
}

function drawLidBackAndEdges(view: SkyProjection, bob: number) {
    const sp = (u: number, v: number, back = 0) =>
        laptopScreenPoint(u, v, bob, -back);
    const backDecals: Decal[] = [
        {
            kind: 'poly',
            points: [
                sp(0.7, 0.22, LID_THICKNESS),
                sp(0.9, 0.22, LID_THICKNESS),
                sp(0.9, 0.12, LID_THICKNESS),
                sp(0.7, 0.12, LID_THICKNESS),
            ],
            color: '#8b95a5',
        },
        {
            kind: 'poly',
            points: [
                sp(0.1, 0.86, LID_THICKNESS),
                sp(0.24, 0.86, LID_THICKNESS),
                sp(0.24, 0.78, LID_THICKNESS),
                sp(0.1, 0.78, LID_THICKNESS),
            ],
            color: '#d9483b',
        },
    ];
    view.polygon(
        [
            sp(0, 1, LID_THICKNESS),
            sp(1, 1, LID_THICKNESS),
            sp(1, 0, LID_THICKNESS),
            sp(0, 0, LID_THICKNESS),
        ],
        '#3d4552',
        { shade: true, decals: backDecals },
    );
    const edges: Array<[number, number, number, number]> = [
        [0, 0, 1, 0],
        [1, 0, 1, 1],
        [1, 1, 0, 1],
        [0, 1, 0, 0],
    ];
    for (const [u0, v0, u1, v1] of edges) {
        view.polygon(
            [
                sp(u0, v0),
                sp(u1, v1),
                sp(u1, v1, LID_THICKNESS),
                sp(u0, v0, LID_THICKNESS),
            ],
            '#323945ff',
            { shade: true },
        );
    }
}

export function drawRetroLaptopScreen(
    view: SkyProjection,
    bob: number,
    screen?: (view: SkyProjection, bob: number) => void,
): void {
    view.part(() => {
        drawLidFront(view, bob);
        drawLidBackAndEdges(view, bob);
    });
    if (screen) {
        view.part(() => screen(view, bob));
    }
}
