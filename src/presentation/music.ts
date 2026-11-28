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

export function musicTrack(
    state: Pick<GameSnapshot, 'mode' | 'stage' | 'orbit'>,
    prologue: boolean,
): MusicTrack | null {
    if (prologue) {
        return null;
    }
    if (state.mode === 'intro') {
        return 'start';
    }
    if (state.stage === 5 && state.orbit?.phase === 'parked') {
        return 'ending';
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
