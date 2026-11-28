import type { SceneAudio } from './audio-types';
import type { SfxName } from './sfx';
import type { GameSnapshot } from '../game/game';

export type AudioScene = {
    prev: GameSnapshot;
    next: GameSnapshot;
    audio: SceneAudio;
};

export function addSound(
    audio: SceneAudio,
    name: SfxName,
    gain = 1,
    rate = 1,
): void {
    if (gain > 0.01) {
        audio.shots.push({ name, gain, rate });
    }
}

export function distanceGain(
    state: GameSnapshot,
    x: number,
    y = state.player.y,
    range = 650,
): number {
    const distance = Math.hypot(state.player.x - x, state.player.y - y);
    return Math.max(0, 1 - distance / range) ** 2;
}
