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
import type { DrawCommand } from '../../types';

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
 * top inside one circular alpha mask, so the iris costs a single ThorVG mask
 * instead of an inverted mask per clock layer. A path clip is not used here:
 * the GL engine re-applies a Scene clip for every child shape.
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
            ctx.commands = [
                ...clock,
                {
                    kind: 'group',
                    points: [],
                    group: {
                        key: 'opening-iris',
                        mask: circle(hole.x, hole.y, hole.r).command('#ffffff'),
                    },
                },
                ...ctx.commands,
                { kind: 'group', points: [], group: null },
            ];
        }
    } else {
        ctx.commands = clock;
    }
    if (frame.shot === 'office') {
        drawBubbles(ctx, frame);
    }
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
