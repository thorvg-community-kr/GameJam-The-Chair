import { skyGust } from '../game/stages/sky/data';

import type { GameSnapshot } from '../game/game';
import type { CueId, GameEvent } from '../game/types';

export type GameSfxName =
    | 'jump'
    | 'land'
    | 'bonk'
    | 'paper'
    | 'thud'
    | 'copier'
    | 'splash'
    | 'crash'
    | 'dizzy'
    | 'squeak'
    | 'zap'
    | 'spray'
    | 'pickup'
    | 'checkpoint'
    | 'clear'
    | 'fail'
    | 'fall'
    | 'honk'
    | 'click'
    | 'wind'
    | 'bird';

export type OpeningSfxName =
    | 'openingClockSix'
    | 'openingClockSeven'
    | 'openingClockEight'
    | 'openingClockNine'
    | 'openingClockSpin'
    | 'openingClockSpinFast'
    | 'openingIrisOpen'
    | 'openingIrisQuick'
    | 'openingIrisClose'
    | 'openingRiderSigh'
    | 'openingRiderTalk'
    | 'openingPushIn'
    | 'openingChairHope'
    | 'openingChairSparkle'
    | 'openingCreakLow'
    | 'openingCreakMid'
    | 'openingCreakHigh'
    | 'openingChairWindup'
    | 'openingChairKick'
    | 'openingRiderPlop'
    | 'openingTyping'
    | 'openingRageSnap'
    | 'openingHandoff';

export type SfxName = GameSfxName | OpeningSfxName;

export type SfxFrame = Pick<
    GameSnapshot,
    'mode' | 'stage' | 'ground' | 'deaths' | 'player' | 'sky' | 'orbit' | 'time'
>;

// Speech-bubble and hint cues stay silent on purpose.
const CUE_SOUNDS: Record<CueId, SfxName | null> = {
    'lift-game-over': 'fail',
    'practice-cleared': 'pickup',
    checkpoint: 'checkpoint',
    'head-hit': 'bonk',
    'head-comment': null,
    'head-game-over': 'fail',
    'first-volley': 'copier',
    'paper-hit': 'paper',
    'water-spilled': 'splash',
    'water-comment': null,
    'water-followup': null,
    'bin-fall': 'crash',
    'bin-comment': null,
    'bin-game-over': 'fail',
    'focus-lost': 'dizzy',
    'focus-game-over': 'fail',
    slipping: 'squeak',
    rolling: null,
    'reverse-comment': null,
    'person-comment': null,
    'stage-clear': 'clear',
    'light-hit': 'zap',
    'light-comment': null,
    spray: 'spray',
    'extinguisher-pickup': 'click',
    'urgent-volley': 'copier',
    'bundle-hit': 'thud',
    'convoy-bump': 'honk',
};

const DEATH_CUES = new Set<CueId>([
    'head-hit',
    'bin-fall',
    'focus-lost',
    'lift-game-over',
]);
const JUMP_SPEED = 150;
const LAND_SPEED = 260;
const LAND_KEEP = 0.4;
const FALL_SPEED = 200;

export function cueSound(id: CueId): SfxName | null {
    return CUE_SOUNDS[id];
}

/** True while a cutscene owns the screen and the scene is meant to be quiet. */
export function silentFrame(state: SfxFrame): boolean {
    if (state.mode === 'intro' || state.mode === 'pause') {
        return true;
    }
    if (state.stage === 4) {
        return state.sky.phase === 'reveal' || state.sky.phase === 'depth';
    }
    if (state.stage === 5) {
        return (
            state.orbit?.phase === 'entry' || state.orbit?.phase === 'parked'
        );
    }
    return false;
}

function motionSound(prev: SfxFrame, next: SfxFrame): SfxName | null {
    if (prev.mode !== 'play' || next.mode !== 'play') {
        return null;
    }
    const before = prev.player.vy;
    const after = next.player.vy;
    if (prev.ground && after < -JUMP_SPEED && before > -JUMP_SPEED / 2) {
        return 'jump';
    }
    // The ground flag can flicker inside one frame; a sudden stop is reliable.
    if (before > LAND_SPEED && after < before * LAND_KEEP) {
        return 'land';
    }
    return null;
}

function fellOff(
    prev: SfxFrame,
    next: SfxFrame,
    events: readonly GameEvent[],
): boolean {
    return (
        next.deaths > prev.deaths &&
        prev.mode === 'play' &&
        prev.player.vy > FALL_SPEED &&
        !events.some((e) => e.type === 'cue' && DEATH_CUES.has(e.id))
    );
}

function eventSound(event: GameEvent): SfxName | null {
    if (event.type === 'cue') {
        return cueSound(event.id);
    }
    return event.type === 'volley' ? 'copier' : null;
}

function docked(prev: SfxFrame, next: SfxFrame): boolean {
    return (
        prev.mode === 'play' &&
        next.mode === 'play' &&
        next.stage === 5 &&
        prev.orbit?.phase === 'door' &&
        next.orbit?.phase === 'parked'
    );
}

function skySounds(
    prev: SfxFrame,
    next: SfxFrame,
    events: readonly GameEvent[],
): SfxName[] {
    const sounds: SfxName[] = [];
    if (
        prev.mode === 'play' &&
        next.mode === 'play' &&
        !events.some((event) => event.type === 'reset')
    ) {
        if (next.stage === 4 && next.sky.phase === 'course') {
            if (
                skyGust(prev.time).strength < 0.05 &&
                skyGust(next.time).strength >= 0.05
            ) {
                sounds.push('wind');
            }
            if (
                next.sky.knockKind === 'bird' &&
                next.sky.knock > prev.sky.knock
            ) {
                sounds.push('bird');
            }
        }
    }
    return sounds;
}

export function frameSounds(
    prev: SfxFrame | null,
    next: SfxFrame,
    events: readonly GameEvent[],
): SfxName[] {
    if (!prev || prev.stage !== next.stage) {
        return [];
    }
    if (docked(prev, next)) {
        return ['click'];
    }
    if (silentFrame(prev) || silentFrame(next)) {
        return [];
    }
    const sounds: SfxName[] = [];
    for (const event of events) {
        const sound = eventSound(event);
        if (sound && !sounds.includes(sound)) {
            sounds.push(sound);
        }
    }
    sounds.push(...skySounds(prev, next, events));
    if (fellOff(prev, next, events)) {
        return [...sounds, 'fall'];
    }
    const reset = events.some((e) => e.type === 'reset');
    const motion = reset ? null : motionSound(prev, next);
    if (motion && !sounds.includes(motion) && !sounds.includes('spray')) {
        sounds.push(motion);
    }
    return sounds;
}

export type SfxGate = {
    pass(name: SfxName, now: number, length: number): boolean;
    clear(): void;
};

export type SfxLimits = {
    voices: number;
    gap: number;
    gaps: Partial<Record<SfxName, number>>;
};

export const SFX_LIMITS: SfxLimits = {
    voices: 5,
    gap: 0.07,
    gaps: { spray: 0.14, land: 0.12, paper: 0.09, copier: 0.25 },
};

/** Drops a sound that repeats too fast or would exceed the voice cap. */
export function createSfxGate(limits: SfxLimits = SFX_LIMITS): SfxGate {
    const last = new Map<SfxName, number>();
    let ends: number[] = [];
    return {
        pass(name, now, length) {
            const gap = limits.gaps[name] ?? limits.gap;
            const previous = last.get(name);
            if (previous !== undefined && now - previous < gap) {
                return false;
            }
            ends = ends.filter((end) => end > now);
            if (ends.length >= limits.voices) {
                return false;
            }
            last.set(name, now);
            ends.push(now + length);
            return true;
        },
        clear() {
            last.clear();
            ends = [];
        },
    };
}
