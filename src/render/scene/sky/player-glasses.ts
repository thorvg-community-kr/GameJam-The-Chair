import type { Decal, Point3, SkyProjection } from '../shared/projection';

const point = ([x, y, z]: Point3, bob: number): Point3 => [x, -y - 35 + bob, z];
export const GLASSES_FRONT = 14.0;
const TOP = -86.6;
const BOTTOM = -78.8;
const INNER = 1.5;
const OUTER = 9.1;

function rect(
    x: number,
    ys: [number, number],
    zs: [number, number],
    bob: number,
): Point3[] {
    const [top, bottom] = ys;
    const [a, b] = zs[0] < zs[1] ? zs : [zs[1], zs[0]];
    return [
        point([x, top, a], bob),
        point([x, top, b], bob),
        point([x, bottom, b], bob),
        point([x, bottom, a], bob),
    ];
}

function lensFront(view: SkyProjection, bob: number, side: number) {
    const inner = side * INNER;
    const outer = side * OUTER;
    const decals: Decal[] = [
        {
            kind: 'poly',
            points: rect(
                GLASSES_FRONT,
                [TOP + 0.65, BOTTOM - 0.65],
                [side * (OUTER - 2.4), side * (OUTER - 1.2)],
                bob,
            ),
            color: '#bfe6ef',
        },
        {
            kind: 'poly',
            points: rect(
                GLASSES_FRONT,
                [-84.2, -81.6],
                [side * 4.4, side * 5.9],
                bob,
            ),
            color: '#446d82',
        },
    ];
    view.polygon(
        rect(GLASSES_FRONT, [TOP, BOTTOM], [inner, outer], bob),
        '#83c8e4',
        { decals },
    );
    for (const z of [inner, outer]) {
        view.rod(
            point([GLASSES_FRONT, TOP, z], bob),
            point([GLASSES_FRONT, BOTTOM, z], bob),
            0.44,
            '#83c8e4',
            { sides: 6 },
        );
    }
    for (const y of [TOP, BOTTOM]) {
        view.rod(
            point([GLASSES_FRONT, y, inner], bob),
            point([GLASSES_FRONT, y, outer], bob),
            0.42,
            '#50606a',
            { sides: 6 },
        );
    }
}

export function endingGlassesFront(view: SkyProjection, bob: number): void {
    for (const side of [-1, 1]) {
        lensFront(view, bob, side);
    }
    view.rod(
        point([GLASSES_FRONT, -83.8, -INNER], bob),
        point([GLASSES_FRONT, -83.8, INNER], bob),
        0.42,
        '#50606a',
        { sides: 6 },
    );
}

export function endingGlassesTemple(
    view: SkyProjection,
    bob: number,
    side: number,
): void {
    const outer = side * OUTER;
    view.rod(
        point([GLASSES_FRONT, -83.8, outer], bob),
        point([11.4, -83.8, side * 11.4], bob),
        0.42,
        '#3a414b',
        { sides: 6 },
    );
    view.rod(
        point([11.4, -83.8, side * 11.4], bob),
        point([-5.5, -82.4, side * 11.6], bob),
        0.42,
        '#3a414b',
        { sides: 6 },
    );
    view.rod(
        point([-5.5, -82.4, side * 11.6], bob),
        point([-7.6, -80.2, side * 11.5], bob),
        0.36,
        '#3a414b',
        { sides: 6 },
    );
}

export function endingGlasses(view: SkyProjection, bob: number): void {
    endingGlassesFront(view, bob);
    for (const side of [-1, 1]) {
        endingGlassesTemple(view, bob, side);
    }
}
