import { earthSkyBottom, orbitEarth } from './earth';
import { endingLaptopScreen, endingNebula } from './ending';
import { stageEpilogue } from './epilogue-staging';
import { orbitHeights, orbitHighSky } from './heights';
import { createSkyProjection, placedProjection } from '../shared/projection';
import { endingChair, riderProjection } from '../sky/ending-art';

import type { EarthCamera } from './earth';
import type { OrbitEndingState } from './ending';
import type { EpilogueShot } from './epilogue-staging';
import type { RenderCtx } from '../../context';
import type { Vector } from '../../types';
import type { Point3, SkyFraming, SkyProjection } from '../shared/projection';

// Keeps the earth low in frame so the planet reads as "below" in every cut.
const EARTH_TILT = 0.3;

const hex = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');

function backdrop(
    ctx: RenderCtx,
    travel: number,
    shot: EpilogueShot,
    framing: Required<
        Pick<SkyFraming, 'zoom' | 'roll' | 'centerY' | 'offsetX'>
    >,
) {
    const spin = ((shot.orbit - 1) * Math.PI) / 2;
    const earth: EarthCamera = {
        cx: ctx.W / 2 + framing.offsetX,
        cy: ctx.H * framing.centerY,
        focal: Math.min(ctx.H * 1.65, ctx.W * 0.94) * framing.zoom,
        roll: framing.roll,
        pitch: EARTH_TILT + Math.atan2(shot.lift, shot.distance),
    };
    const bottom = earthSkyBottom(travel, earth, 0, ctx.W, {
        height: ctx.H,
        spin,
    });
    orbitHighSky(ctx, orbitHeights(travel), 0, spin, bottom);
    endingNebula(ctx, 1, spin, bottom);
    orbitEarth(ctx, travel, earth, 0, { strength: 1, night: 0, spin });
}
function impactStar(ctx: RenderCtx, at: Vector, k: number) {
    const r = ctx.H * 0.1 * (0.6 + 0.8 * k);
    const star = (size: number, thin: number): Vector[] =>
        Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4 + 0.3;
            const s = i % 2 === 0 ? size : size * thin;
            return [at[0] + Math.cos(a) * s, at[1] + Math.sin(a) * s];
        });
    const layer = {
        key: 'epilogue-impact',
        blend: 'screen' as const,
        opacity: 1 - k * k,
    };
    ctx.commands.push(
        { kind: 'path', points: star(r, 0.28), fill: '#ffd36b', layer },
        { kind: 'path', points: star(r * 0.55, 0.3), fill: '#ffffff', layer },
    );
}
function puff(view: SkyProjection, at: Point3, k: number) {
    for (let i = 0; i < 3; i++) {
        const spread = 4 + 16 * k;
        const r = 3 + 7 * k + i;
        view.oval(
            [
                at[0] + spread * (0.6 + i * 0.3),
                at[1] + i * 3,
                at[2] + (i - 1) * spread * 0.5,
            ],
            [r, r * 0.8, r],
            '#f2efe8' + hex(0.8 * (1 - k)),
        );
    }
}
/** Cuts 1-6 of the stage-five epilogue, each a fixed camera preset. */
export function drawEpilogue(
    ctx: RenderCtx,
    ending: OrbitEndingState,
    travel: number,
): void {
    if (!ending.epilogue) {
        return;
    }
    const stage = stageEpilogue(ending.epilogue);
    const { shot } = stage;
    const framing = {
        zoom: shot.zoom * (1 + stage.punch),
        roll: shot.roll ?? 0,
        centerY: shot.centerY ?? 0.5,
        offsetX: (shot.offsetX ?? 0) * ctx.W,
    };
    backdrop(ctx, travel, shot, framing);
    const base = createSkyProjection(ctx.W, ctx.H, shot.orbit, {
        ...framing,
        distance: shot.distance,
        eyeY: 15 + shot.lift,
    });
    const [fx, fy, fz] = shot.focus;
    const world = placedProjection(base, ([x, y, z]) => [
        x - fx,
        y - fy + 15,
        z - fz,
    ]);
    for (const pose of stage.figures) {
        const bob = endingChair(world, 0, 0, 0, { rest: 1, pose });
        if (pose.parts !== 'chair') {
            endingLaptopScreen(riderProjection(world, pose), ending, bob);
        }
    }
    if (stage.puff) {
        puff(world, stage.puff.at, stage.puff.k);
    }
    ctx.commands.push(...base.commands());
    if (stage.star) {
        impactStar(ctx, world.project(stage.star.at), stage.star.k);
    }
}
