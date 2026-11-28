import { drawBubbles } from './bubble';
import { commandBounds, cullInsideIris, drawClock, irisHole } from './clock';
import {
    drawChairMood,
    drawOfficeLight,
    drawRageFlash,
    drawSunbeams,
} from './mood';
import { circle } from './shapes';
import { OPENING_BEATS } from './timeline';
import { drawWorld } from '../office/world';

import type { IrisHole } from './clock';
import type { OpeningFrame } from './timeline';
import type { RenderCtx } from '../../context';
import type { Bounds, DrawCommand, LayerSpec, PathCommand } from '../../types';

export {
    openingFrame,
    openingState,
    openingFocusY,
    OPENING_BEATS,
    OPENING_DURATION,
    type OpeningFrame,
} from './timeline';

/**
 * The clock is drawn first without masks, then the office is composited on
 * top through the circular iris as an alpha mask, instead of cutting every
 * clock layer with an inverted mask. A path clip is not used here: the GL
 * engine re-applies a Scene clip for every child shape.
 */
export function drawOpening(ctx: RenderCtx, frame: OpeningFrame): void {
    ctx.commands = [];
    const clockShown = frame.iris !== null && frame.iris < 1;
    const hole = clockShown ? irisHole(ctx, frame) : null;
    let clock: DrawCommand[] = [];
    if (clockShown) {
        drawClock(ctx, frame);
        clock = hole ? cullInsideIris(ctx.commands, hole) : ctx.commands;
    }
    if (frame.shot === 'office' && (!clockShown || hole)) {
        const box = hole ? irisBox(ctx, hole) : null;
        drawOffice(ctx, frame, box);
        if (hole && box) {
            const mask = circle(hole.x, hole.y, hole.r).command('#ffffff');
            ctx.commands = [...clock, ...throughIris(ctx.commands, mask, box)];
        }
    } else {
        ctx.commands = clock;
    }
    if (frame.shot === 'office') {
        drawBubbles(ctx, frame);
    }
}
/** The on-screen square around the iris; nothing outside it shows. */
function irisBox(ctx: RenderCtx, hole: IrisHole): Bounds {
    const pad = 2;
    return {
        left: Math.max(0, hole.x - hole.r - pad),
        top: Math.max(0, hole.y - hole.r - pad),
        right: Math.min(ctx.W, hole.x + hole.r + pad),
        bottom: Math.min(ctx.H, hole.y + hole.r + pad),
    };
}
const blended = (layer: LayerSpec | undefined): layer is LayerSpec =>
    !!layer && !!layer.blend && layer.blend !== 'normal' && !layer.clip;
const overlaps = (a: Bounds | null, b: Bounds | null) =>
    !a ||
    !b ||
    (a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom);
const coversHeld = (
    cmd: DrawCommand,
    held: Array<{ bounds: Bounds | null }>,
) => {
    if (!held.length) {
        return false;
    }
    const bounds = cmd.kind === 'group' ? null : commandBounds(cmd);
    return held.some((h) => overlaps(h.bounds, bounds));
};
const clippable = (cmd: DrawCommand) =>
    cmd.kind === 'path' && !cmd.layer?.clip && !cmd.layer?.mask;
/** Commands after the last blend layer this few take the iris as a clip. */
const CLIP_TAIL = 24;
/**
 * Plain office commands share one masked group Scene. ThorVG 1.1.3's SW
 * engine drops the blend of a layer inside a masked group or with its own
 * mask, so blend layers stay outside and take the iris as a clip; they hold
 * only a few shapes, so GL's per-shape clip stays cheap.
 *
 * To keep that one group, a blend command moves past later plain commands it
 * does not overlap, which leaves every pixel the same. The few plain commands
 * that must still draw over a blend layer take the iris as a clip too.
 */
function throughIris(
    office: DrawCommand[],
    mask: PathCommand,
    box: Bounds,
): DrawCommand[] {
    const shown = office.filter(
        (cmd) => cmd.kind === 'group' || overlaps(commandBounds(cmd), box),
    );
    const plainAfter: number[] = new Array<number>(shown.length + 1);
    plainAfter[shown.length] = 0;
    for (let i = shown.length - 1; i >= 0; i--) {
        plainAfter[i] = plainAfter[i + 1] + (blended(shown[i].layer) ? 0 : 1);
    }
    const out: DrawCommand[] = [];
    const clipped = new Map<LayerSpec, LayerSpec>();
    const plainClip: LayerSpec = { key: 'opening-iris-clip', clip: mask };
    const clip = (cmd: DrawCommand, layer: LayerSpec | undefined) => {
        if (!layer) {
            return { ...cmd, layer: plainClip };
        }
        let spec = clipped.get(layer);
        if (!spec) {
            spec = { ...layer, clip: mask };
            clipped.set(layer, spec);
        }
        return { ...cmd, layer: spec };
    };
    let held: Array<{ cmd: DrawCommand; bounds: Bounds | null }> = [];
    let open = false;
    let behind = false;
    const flush = () => {
        if (open) {
            out.push({ kind: 'group', points: [], group: null });
            open = false;
        }
        for (const { cmd } of held) {
            out.push(clip(cmd, cmd.layer));
        }
        held = [];
    };
    for (let i = 0; i < shown.length; i++) {
        const cmd = shown[i];
        const layer = cmd.layer;
        if (cmd.kind !== 'group' && blended(layer)) {
            held.push({ cmd, bounds: commandBounds(cmd) });
            continue;
        }
        if (coversHeld(cmd, held)) {
            flush();
            behind = true;
        }
        if (!open && behind && plainAfter[i] <= CLIP_TAIL && clippable(cmd)) {
            out.push(clip(cmd, layer));
            continue;
        }
        if (!open) {
            out.push({
                kind: 'group',
                points: [],
                group: { key: 'opening-iris', mask },
            });
            open = true;
        }
        out.push(cmd);
    }
    flush();
    return out;
}
function drawOffice(ctx: RenderCtx, frame: OpeningFrame, iris: Bounds | null) {
    ctx.chairPose = {
        backrest: frame.chair.backrest,
        riderPop: frame.chair.riderPop,
        shiver: frame.chair.shiver,
    };
    ctx.cutscene = true;
    ctx.windowDusk = frame.dusk;
    drawWorld(ctx);
    ctx.cutscene = false;
    ctx.windowDusk = 1;
    ctx.chairPose = { backrest: 0, riderPop: 0, shiver: 0 };
    drawSunbeams(ctx, frame);
    drawOfficeLight(ctx, frame, iris);
    drawChairMood(ctx, frame);
    drawRageFlash(ctx, frame, OPENING_BEATS.rage);
}
