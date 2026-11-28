import type { Vector } from '../../types';
import type { Decal, Point3, SkyProjection } from '../shared/projection';

/** Shared hairline plane separating hair (dot >= 0) from face skin (dot <= 0). */
export const HAIRLINE_ORIGIN: Point3 = [-10, 41, 0];
export const HAIRLINE_NORMAL: Point3 = [-13, 22, 0];

const OUTLINE: Vector[] = [
    [-14.5, -86],
    [-5, -99],
    [9, -96.5],
    [13.8, -90.5],
    [12, -89],
    [1, -82.5],
    [-10, -76],
];

type Section = {
    z: number;
    crownDrop: number;
    napeLift: number;
    round: number;
};

const SECTIONS: Section[] = [
    { z: -11.4, crownDrop: 3.2, napeLift: 3.2, round: 1.8 },
    { z: -8.8, crownDrop: 1.0, napeLift: 1.2, round: 0.6 },
    { z: -4.2, crownDrop: 0.0, napeLift: 0.0, round: 0 },
    { z: 4.2, crownDrop: 0.3, napeLift: 0.2, round: 0 },
    { z: 8.8, crownDrop: 1.4, napeLift: 1.4, round: 0.6 },
    { z: 11.4, crownDrop: 4.0, napeLift: 3.4, round: 1.8 },
];

function vertex(section: Section, [x, y]: Vector, bob: number): Point3 {
    const crown = Math.max(0, Math.min(1, (-y - 86) / 13));
    const nape = Math.max(0, Math.min(1, (y + 84) / 8));
    return [
        x + section.round * Math.max(0, -x / 15),
        -y - 35 + bob - section.crownDrop * crown + section.napeLift * nape,
        section.z * (1 - crown * 0.14 - nape * 0.1),
    ];
}

function sweptDecal(
    rings: Point3[][],
    sectionIndex: number,
    bob: number,
): Decal | null {
    if (sectionIndex < 1 || sectionIndex > 3) {
        return null;
    }
    const u = 0.14 + (sectionIndex - 1) * 0.14;
    const at = (s: Section, along: number): Point3 =>
        vertex(s, [-14.5 + along * 9.5, -86 - along * 13], bob);
    return {
        kind: 'poly',
        points: [
            at(SECTIONS[sectionIndex], u),
            at(SECTIONS[sectionIndex + 1], u + 0.13),
            at(SECTIONS[sectionIndex + 1], u + 0.23),
            at(SECTIONS[sectionIndex], u + 0.1),
        ],
        color: '#505968',
    };
}

export function endingHair(view: SkyProjection, bob: number): void {
    const area = OUTLINE.reduce((sum, p, i) => {
        const next = OUTLINE[(i + 1) % OUTLINE.length];
        return sum - p[0] * next[1] + next[0] * p[1];
    }, 0);
    const outline = area > 0 ? OUTLINE : [...OUTLINE].reverse();
    const rings = SECTIONS.map((section) =>
        outline.map((point) => vertex(section, point, bob)),
    );
    view.polygon([...rings[0]].reverse(), '#3c424f');
    view.polygon(rings[rings.length - 1], '#3c424f');
    const rearEdge = outline.findIndex((pt, i) => {
        const next = outline[(i + 1) % outline.length];
        return (pt[0] < -12 && next[1] < -95) || (next[0] < -12 && pt[1] < -95);
    });
    for (let r = 0; r < rings.length - 1; r++) {
        for (let i = 0; i < outline.length; i++) {
            const next = (i + 1) % outline.length;
            const color = r === 1 ? '#434b59' : r === 4 ? '#353c49' : '#3c424f';
            const decal = i === rearEdge ? sweptDecal(rings, r, bob) : null;
            view.polygon(
                [
                    rings[r][i],
                    rings[r][next],
                    rings[r + 1][next],
                    rings[r + 1][i],
                ],
                color,
                decal ? { decals: [decal] } : undefined,
            );
        }
    }
}
