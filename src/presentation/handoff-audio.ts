import { ORBIT_ENDING, orbitEnding } from '../render/scene/orbit/ending';

import type { SceneAudio } from './audio-types';
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
}
