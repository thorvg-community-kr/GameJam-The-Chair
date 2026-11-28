import { drawCredits } from './credits';
import { earthHorizonDip, earthSkyBottom, orbitEarth } from './earth';
import { endingLaptopScreen, endingNebula } from './ending';
import { ORBIT_ENDING } from './ending-timeline';
import { stageEpilogue } from './epilogue-staging';
import { orbitHeights, orbitHighSky } from './heights';
import { createSkyProjection, placedProjection } from '../shared/projection';
import { endingChair } from '../sky/ending-art';

import type { EarthCamera } from './earth';
import type { OrbitEndingState } from './ending';
import type { EpilogueShot } from './epilogue-staging';
import type { RenderCtx } from '../../context';
import type { LayerSpec, Vector } from '../../types';
import type { Point3, SkyFraming, SkyProjection } from '../shared/projection';

// Keeps the earth low in frame so the planet reads as "below" in every cut.
const EARTH_TILT = 0.3;
/**
 * The over-the-shoulder figure sits in its own ThorVG Scene: Tint pulls it
 * into a cool half-shade and a pale DropShadow lifts its edge like earthlight.
 */
const OVER_SHOULDER: LayerSpec = {
    key: 'epilogue-over-shoulder',
    tint: { black: '#0a0f1e', white: '#7086a8', intensity: 78 },
    dropShadow: {
        color: '#9fd0ff',
        opacity: 0.85,
        angle: 90,
        distance: 3,
        sigma: 5,
    },
};
/** Screen heights the horizon is held between, so no cut loses the earth. */
const HORIZON = { top: 0.22, bottom: 0.68 };

const smooth = (value: number) => {
    const k = Math.max(0, Math.min(1, value));
    return k * k * (3 - 2 * k);
};
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
    // The master angle (orbit 0) looks the way the ending's last shot did,
    // so the ground below carries over the cut to black.
    const spin = (shot.orbit * Math.PI) / 2;
    const cy = ctx.H * framing.centerY;
    const focal = Math.min(ctx.H * 1.65, ctx.W * 0.94) * framing.zoom;
    const dip = earthHorizonDip(travel);
    const pitchFor = (y: number) => dip - Math.atan((y * ctx.H - cy) / focal);
    const earth: EarthCamera = {
        cx: ctx.W / 2 + framing.offsetX,
        cy,
        focal,
        roll: framing.roll,
        pitch:
            shot.horizon !== undefined
                ? pitchFor(shot.horizon)
                : Math.max(
                      pitchFor(HORIZON.bottom),
                      Math.min(
                          pitchFor(HORIZON.top),
                          EARTH_TILT + Math.atan2(shot.lift, shot.distance),
                      ),
                  ),
    };
    const bottom = earthSkyBottom(travel, earth, 0, ctx.W, {
        height: ctx.H,
        spin,
    });
    orbitHighSky(ctx, orbitHeights(travel), 0, spin, bottom);
    endingNebula(ctx, shot.nebula ?? 1, spin, bottom);
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
/** Three quick strokes behind his head as he flinches away. */
function flinchLines(ctx: RenderCtx, at: Vector, k: number) {
    const size = ctx.clamp(ctx.H * 0.03, 8, 22);
    const out = smooth(k);
    const layer = { key: 'epilogue-flinch', opacity: 1 - out };
    for (const [dy, length] of [
        [-0.7, 0.8],
        [0, 1],
        [0.7, 0.8],
    ]) {
        const y = at[1] + dy * size;
        const x0 = at[0] - size * (0.4 + out * 0.4);
        ctx.commands.push({
            kind: 'path',
            points: [
                [x0, y],
                [x0 - size * length, y + dy * size * 0.35],
            ],
            open: true,
            fill: null,
            stroke: { width: size * 0.16, color: '#ffb347', cap: 'round' },
            layer,
        });
    }
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
    const toFocus = ([x, y, z]: Point3): Point3 => [
        x - fx,
        y - fy + 15,
        z - fz,
    ];
    const world = placedProjection(base, toFocus);
    const near = createSkyProjection(ctx.W, ctx.H, shot.orbit, {
        ...framing,
        distance: shot.distance,
        eyeY: 15 + shot.lift,
    });
    stage.figures.forEach((pose, i) => {
        const view =
            i === stage.front ? placedProjection(near, toFocus) : world;
        endingChair(view, 0, 0, 0, {
            rest: 1,
            pose,
            screen:
                pose.parts !== 'chair'
                    ? (riderView, bob) =>
                          endingLaptopScreen(riderView, ending, bob)
                    : undefined,
        });
    });
    if (stage.puff) {
        puff(world, stage.puff.at, stage.puff.k);
    }
    ctx.commands.push(...base.commands());
    if (stage.front !== undefined) {
        for (const command of near.commands()) {
            ctx.commands.push({
                ...command,
                layer: command.layer ?? OVER_SHOULDER,
            });
        }
    }
    if (stage.star) {
        impactStar(ctx, world.project(stage.star.at), stage.star.k);
    }
    if (stage.flinch) {
        flinchLines(ctx, world.project(stage.flinch.at), stage.flinch.k);
    }
    if (ending.epilogue.cut === 'wide') {
        drawCredits(ctx, ending.t);
        fadeToTitle(ctx, ending.t);
        return;
    }
    fadeUp(ctx, ending.t);
}
function blackOut(ctx: RenderCtx, black: number) {
    if (black <= 0) {
        return;
    }
    ctx.commands.push({
        kind: 'path',
        points: [
            [0, 0],
            [ctx.W, 0],
            [ctx.W, ctx.H],
            [0, ctx.H],
        ],
        fill: '#000000' + hex(black),
        layer: { key: 'orbit-ending-black' },
    });
}
/** Once the credits close the whole frame fades to black before the title. */
function fadeToTitle(ctx: RenderCtx, t: number) {
    const E = ORBIT_ENDING;
    blackOut(ctx, smooth((t - E.closing) / (E.toTitle - E.closing)));
}
function fadeUp(ctx: RenderCtx, t: number) {
    const E = ORBIT_ENDING;
    blackOut(ctx, 1 - smooth((t - E.reveal) / (E.tap - E.reveal)));
}
