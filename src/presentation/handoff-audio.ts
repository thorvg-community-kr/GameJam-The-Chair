import { ORBIT_ENDING, orbitEnding } from '../render/scene/orbit/ending';

import type { SceneAudio, SoundCue } from './audio-types';
import type { GameSnapshot } from '../game/game';

// The bubble pops at stage-five age 0; a short window survives a late first frame.
const ATTENDANCE_WINDOW = 0.25;

function attendance(next: GameSnapshot, audio: SceneAudio) {
    const orbit = next.orbit;
    if (
        next.stage === 5 &&
        next.mode === 'play' &&
        orbit?.phase === 'entry' &&
        orbit.age < ATTENDANCE_WINDOW
    ) {
        audio.shots.push({
            name: 'attendance',
            gain: 1,
            rate: 1,
            key: 'attendance',
        });
    }
}

function networkLost(
    prev: GameSnapshot | null,
    next: GameSnapshot,
    audio: SceneAudio,
) {
    if (
        prev?.stage !== 5 ||
        next.stage !== 5 ||
        prev.orbit?.phase !== 'parked' ||
        next.orbit?.phase !== 'parked'
    ) {
        return;
    }
    const before = orbitEnding(prev.orbit).t;
    const after = orbitEnding(next.orbit).t;
    if (before < ORBIT_ENDING.disconnect && after >= ORBIT_ENDING.disconnect) {
        audio.shots.push({
            name: 'networkLost',
            gain: 1,
            rate: 1,
            key: 'network-lost',
        });
    }
}

const E = ORBIT_ENDING;
const EPILOGUE_SFX: Array<{ at: number; cue: SoundCue }> = [
    { at: E.tap + 0.4, cue: { name: 'thud', gain: 0.9, rate: 0.7 } },
    { at: E.shake + 0.1, cue: { name: 'squeak', gain: 0.8, rate: 0.9 } },
    { at: E.shake + 0.7, cue: { name: 'squeak', gain: 0.7, rate: 0.8 } },
    { at: E.strain + 0.05, cue: { name: 'woodCreak', gain: 0.9, rate: 0.75 } },
    { at: E.fling, cue: { name: 'wind', gain: 0.5, rate: 1.4 } },
    { at: E.drift + 0.05, cue: { name: 'squeak', gain: 0.6, rate: 1.7 } },
];
function epilogue(
    prev: GameSnapshot | null,
    next: GameSnapshot,
    audio: SceneAudio,
) {
    if (
        prev?.orbit?.phase !== 'parked' ||
        next.stage !== 5 ||
        next.orbit?.phase !== 'parked'
    ) {
        return;
    }
    const before = orbitEnding(prev.orbit).t;
    const after = orbitEnding(next.orbit).t;
    EPILOGUE_SFX.forEach(({ at, cue }, i) => {
        if (before < at && after >= at) {
            audio.shots.push({ ...cue, key: `epilogue-${i}` });
        }
    });
}

/** Stage-five story beats that sound through the cutscene silence. */
export function handoffAudio(
    prev: GameSnapshot | null,
    next: GameSnapshot,
    audio: SceneAudio,
): void {
    if (prev && next.time < prev.time) {
        return;
    }
    attendance(next, audio);
    networkLost(prev, next, audio);
    epilogue(prev, next, audio);
}
