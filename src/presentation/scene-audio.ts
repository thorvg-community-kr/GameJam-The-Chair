import { addSound } from './audio-scene';
import { buildingAudio } from './building-audio';
import { orbitAudio } from './orbit-audio';
import { rooftopAudio } from './rooftop-audio';
import { silentFrame } from './sfx';
import { skyAudio } from './sky-audio';

import type { AudioScene } from './audio-scene';
import type { SceneAudio } from './audio-types';
import type { GameSnapshot } from '../game/game';
import type { GameEvent } from '../game/types';

function playerLoops(state: GameSnapshot, audio: SceneAudio) {
    if (state.spray.burst > 0) {
        audio.loops.unshift({ id: 'gas', name: 'gasLoop', gain: 0.3, rate: 1 });
    }
    const speed = Math.abs(state.player.vx);
    if (state.stage < 4 && state.ground && speed > 18) {
        audio.loops.push({
            id: 'wheels',
            name: 'wheelLoop',
            gain: Math.min(0.8, speed / 420),
            rate: 0.7 + Math.min(0.9, speed / 450),
        });
    }
}

function photograph(prev: GameSnapshot, next: GameSnapshot, audio: SceneAudio) {
    if (
        next.stage === 5 &&
        next.mode !== 'pause' &&
        next.orbit &&
        prev.orbit &&
        next.orbit.freeze > prev.orbit.freeze
    ) {
        addSound(audio, 'shutter', 1);
    }
}

function stageAudio(scene: AudioScene) {
    const { next } = scene;
    if (next.stage === 2) {
        buildingAudio(scene);
    }
    if (next.stage === 3) {
        rooftopAudio(scene);
    }
    if (next.stage === 4) {
        skyAudio(scene);
    }
    if (next.stage === 5) {
        orbitAudio(scene);
    }
}

function entranceSound(
    next: GameSnapshot,
    audio: SceneAudio,
    maxAge = Infinity,
) {
    if (
        next.stage !== 3 ||
        next.mode !== 'play' ||
        next.rooftopEntrance.kind !== 'opening'
    ) {
        return;
    }
    if (next.rooftopEntrance.age < maxAge) {
        addSound(audio, 'doorOpen', 0.7);
    }
}

export function sceneAudio(
    prev: GameSnapshot | null,
    next: GameSnapshot,
    events: readonly GameEvent[] = [],
): SceneAudio {
    const audio: SceneAudio = { shots: [], loops: [] };
    if (!prev) {
        entranceSound(next, audio, 0.08);
        return audio;
    }
    if (
        next.time < prev.time ||
        events.some((event) => event.type === 'reset')
    ) {
        return audio;
    }
    if (prev.stage !== next.stage) {
        entranceSound(next, audio);
        return audio;
    }
    if (prev.mode !== 'play') {
        return audio;
    }
    photograph(prev, next, audio);
    if (next.mode !== 'play' || silentFrame(next) || silentFrame(prev)) {
        return audio;
    }
    const scene = { prev, next, audio };
    stageAudio(scene);
    playerLoops(next, audio);
    return audio;
}
