import {
    GLASSES_FRONT,
    endingGlassesFront,
    endingGlassesTemple,
} from './player-glasses';
import { HAIRLINE_NORMAL, HAIRLINE_ORIGIN, endingHair } from './player-hair';

import type { Vector } from '../../types';
import type { Point3, SkyProjection } from '../shared/projection';

const HEAD_ROUND = 0.65;

const FACE_OUTLINE: Vector[] = [
    [-10, -76],
    [12, -89],
    [12.4, -84],
    [12.4, -74],
    [10.2, -67],
    [-6.5, -67],
    [-10.2, -73],
];

const NOSE_OUTLINE: Vector[] = [
    [12.4, -79.4],
    [15.8, -75.2],
    [12.4, -74.0],
];

const p3 = (x: number, y: number, z: number, bob: number): Point3 => [
    x,
    -y - 35 + bob,
    z,
];

function drawFaceFeatures(view: SkyProjection, bob: number) {
    // Brows and mouth sit flush on the front face silhouette and cull from behind.
    view.biased(0.8, () => {
        view.polygon(
            [
                p3(12.25, -87.4, -6.8, bob),
                p3(12.25, -87.8, -2.4, bob),
                p3(12.25, -86.9, -2.4, bob),
                p3(12.25, -86.6, -6.8, bob),
            ],
            '#3c424f',
        );
        view.polygon(
            [
                p3(12.25, -87.8, 2.4, bob),
                p3(12.25, -87.4, 6.8, bob),
                p3(12.25, -86.6, 6.8, bob),
                p3(12.25, -86.9, 2.4, bob),
            ],
            '#3c424f',
        );
        view.polygon(
            [
                p3(11.45, -71.1, -2.3, bob),
                p3(11.45, -71.1, 2.3, bob),
                p3(11.45, -70.3, 2.3, bob),
                p3(11.45, -70.3, -2.3, bob),
            ],
            '#9c775f',
        );
    });
}

function drawFace(view: SkyProjection, skin: string, bob: number) {
    view.part(() => {
        view.profile(
            FACE_OUTLINE.map(([x, y]) => [x, -y - 35 + bob]),
            11.0,
            skin,
            0,
            {
                widthAt: (_x, y) => {
                    const fullness = Math.max(
                        0,
                        Math.min(1, (y - 32 - bob) / 18),
                    );
                    return 7.6 + fullness * 3.4;
                },
                round: HEAD_ROUND,
                shade: true,
            },
        );
        drawFaceFeatures(view, bob);
    });
}

function drawNose(view: SkyProjection, bob: number) {
    view.part(() => {
        view.profile(
            NOSE_OUTLINE.map(([x, y]) => [x, -y - 35 + bob]),
            1.4,
            '#ddb990',
            0,
            { bevel: 0.72, shade: true },
        );
    });
}

function drawEarAndTemple(
    view: SkyProjection,
    skin: string,
    bob: number,
    side: number,
) {
    view.part(() => {
        view.oval(p3(-5.5, -80.5, side * 11.3, bob), [2.3, 3.0, 1.3], skin);
        endingGlassesTemple(view, bob, side);
    });
}

export function riderNeckPart(view: SkyProjection, bob: number): void {
    view.part(() => {
        view.rod(
            p3(-1.5, -67.6, 0, bob),
            p3(-1.5, -61.8, 0, bob),
            4.5,
            '#d5b18b',
            { sides: 10, capA: true, capB: true, shade: true },
        );
    });
}

export function riderHeadBsp(
    view: SkyProjection,
    skin: string,
    bob: number,
): void {
    const drawFaceAndFront = () => {
        const drawNoseAndGlasses = () => {
            view.split(
                p3(GLASSES_FRONT - 0.15, -82, 0, bob),
                [1, 0, 0],
                () => drawNose(view, bob),
                () => view.part(() => endingGlassesFront(view, bob)),
            );
        };
        view.split(
            p3(12.4, -80, 0, bob),
            [1, 0, 0],
            () => drawFace(view, skin, bob),
            drawNoseAndGlasses,
        );
    };
    const drawCore = () => {
        // Exact hairline plane: hair sits strictly on +normal, face on -normal.
        view.split(
            [HAIRLINE_ORIGIN[0], HAIRLINE_ORIGIN[1] + bob, HAIRLINE_ORIGIN[2]],
            HAIRLINE_NORMAL,
            drawFaceAndFront,
            () => view.part(() => endingHair(view, bob)),
        );
    };
    // Separate left and right ears/temples outside head width (z = ±11.1).
    if (view.planeSide(p3(0, -80, 0, bob), [0, 0, 1])) {
        drawEarAndTemple(view, skin, bob, -1);
        drawCore();
        drawEarAndTemple(view, skin, bob, 1);
    } else {
        drawEarAndTemple(view, skin, bob, 1);
        drawCore();
        drawEarAndTemple(view, skin, bob, -1);
    }
}
