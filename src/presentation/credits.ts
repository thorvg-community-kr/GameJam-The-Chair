import { STAGE_FIVE } from '../game/stages/orbit/data';
import { CREDITS_CLOSE, CREDITS_END } from '../render/scene/orbit/credits';

import type { GameSnapshot } from '../game/game';

const { credits } = STAGE_FIVE;
/** Ending seconds of the credits; the roll's end follows its content. */
export const CREDITS_TIMING = {
    from: credits.from,
    end: CREDITS_END,
    close: CREDITS_CLOSE,
    closing: credits.closing,
};

/** Seconds since the chair parked at the door, or null outside the ending. */
export function endingTime(
    state: Pick<GameSnapshot, 'stage' | 'orbit'>,
): number | null {
    return state.stage === 5 && state.orbit?.phase === 'parked'
        ? Math.max(0, state.orbit.settled - 1)
        : null;
}

/** The skip button shows from the first credit until the closing fade. */
export function creditsSkippable(
    state: Pick<GameSnapshot, 'stage' | 'orbit' | 'mode'>,
): boolean {
    const t = endingTime(state);
    return (
        state.mode === 'play' &&
        t !== null &&
        t >= CREDITS_TIMING.from &&
        t < CREDITS_TIMING.closing
    );
}

/** A beat after the last line has gone, the credits close by themselves. */
export function creditsFinished(
    state: Pick<GameSnapshot, 'stage' | 'orbit' | 'mode'>,
): boolean {
    const t = endingTime(state);
    return creditsSkippable(state) && t !== null && t >= CREDITS_TIMING.close;
}
