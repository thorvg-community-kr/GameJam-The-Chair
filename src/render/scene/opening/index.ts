import { drawBubbles } from './bubble';
import { cullInsideIris, drawClock, irisHole } from './clock';
import {
    drawChairMood,
    drawOfficeLight,
    drawRageFlash,
    drawSunbeams,
} from './mood';
import { circle } from './shapes';
import { OPENING_BEATS } from './timeline';
import { drawWorld } from '../office/world';

import type { OpeningFrame } from './timeline';
import type { RenderCtx } from '../../context';
import type { DrawCommand, LayerSpec, PathCommand } from '../../types';

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
        drawOffice(ctx, frame);
        if (hole) {
            const mask = circle(hole.x, hole.y, hole.r).command('#ffffff');
            ctx.commands = [...clock, ...throughIris(ctx.commands, mask)];
        }
    } else {
        ctx.commands = clock;
    }
    if (frame.shot === 'office') {
        drawBubbles(ctx, frame);
    }
}
const blended = (layer: LayerSpec | undefined): layer is LayerSpec =>
    !!layer && !!layer.blend && layer.blend !== 'normal' && !layer.clip;
/**
 * Runs of plain office commands share one masked group Scene. ThorVG 1.1.3's
 * SW engine drops the blend of a layer inside a masked group or with its own
 * mask, so blend layers stay outside and take the iris as a clip; they hold
 * only a few shapes, so GL's per-shape clip stays cheap.
 */
function throughIris(office: DrawCommand[], mask: PathCommand): DrawCommand[] {
    const out: DrawCommand[] = [];
    const clipped = new Map<LayerSpec, LayerSpec>();
    let open = false;
    for (const cmd of office) {
        const layer = cmd.layer;
        if (blended(layer)) {
            if (open) {
                out.push({ kind: 'group', points: [], group: null });
                open = false;
            }
            let spec = clipped.get(layer);
            if (!spec) {
                spec = { ...layer, clip: mask };
                clipped.set(layer, spec);
            }
            out.push({ ...cmd, layer: spec });
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
    if (open) {
        out.push({ kind: 'group', points: [], group: null });
    }
    return out;
}
function drawOffice(ctx: RenderCtx, frame: OpeningFrame) {
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
    drawOfficeLight(ctx, frame);
    drawChairMood(ctx, frame);
    drawRageFlash(ctx, frame, OPENING_BEATS.rage);
}
