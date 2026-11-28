import { CREDITS_TIMING, endingTime } from './credits';

import type { GameSnapshot } from '../game/game';

export type MusicTrack =
    'start' | 'stage1-2' | 'stage3' | 'stage4' | 'stage5' | 'ending';

const STAGE_TRACKS = {
    1: 'stage1-2',
    2: 'stage1-2',
    3: 'stage3',
    4: 'stage4',
    5: 'stage5',
} as const satisfies Record<GameSnapshot['stage'], MusicTrack>;

// The stage four to five camera turn plays in silence; stage five restarts the music.
function silentHandoff(state: Pick<GameSnapshot, 'stage' | 'sky'>) {
    return (
        state.stage === 4 &&
        (state.sky.phase === 'reveal' || state.sky.phase === 'depth')
    );
}

/** Seconds the music player takes to fade a track in or out. */
export const MUSIC_FADE = 1.2;

export function musicTrack(
    state: Pick<GameSnapshot, 'mode' | 'stage' | 'orbit' | 'sky'>,
    prologue: boolean,
): MusicTrack | null {
    if (prologue || silentHandoff(state)) {
        return null;
    }
    if (state.mode === 'intro') {
        return 'start';
    }
    const ending = endingTime(state);
    if (ending !== null) {
        // Fade out so the music is gone as the last credit leaves.
        return ending < CREDITS_TIMING.end - MUSIC_FADE ? 'ending' : null;
    }
    return STAGE_TRACKS[state.stage];
}

// How far the music steps back. Kept separate from the user's volume so a
// duck never touches the stored master/bgm settings.
export type MusicDuck = 'none' | 'pause' | 'death';

export function musicDuck(state: Pick<GameSnapshot, 'mode'>): MusicDuck {
    switch (state.mode) {
        case 'pause':
            return 'pause';
        case 'impact':
        case 'focuslost':
        case 'dead':
            return 'death';
        case 'intro':
        case 'play':
        case 'won':
            return 'none';
    }
}
