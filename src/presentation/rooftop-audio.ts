import { addSound, distanceGain } from './audio-scene';
import {
    ductTimings,
    STAGE_THREE,
    ventPhase,
} from '../game/stages/rooftop/data';

import type { AudioScene } from './audio-scene';

function vents({ prev, next, audio }: AudioScene): void {
    const nearest = STAGE_THREE.vents
        .map((vent, index) => ({
            vent,
            index,
            gain: distanceGain(next, vent.x, vent.y, 580),
        }))
        .sort((a, b) => b.gain - a.gain);
    for (const { vent, index, gain } of nearest) {
        const before = ventPhase(vent, prev.time);
        const after = ventPhase(vent, next.time);
        if (after.kind === 'warn') {
            audio.loops.push({
                id: `vent-${index}`,
                name: 'ventMotor',
                gain: gain * (0.3 + (after.age / vent.warn) * 0.4),
                rate: 0.8 + (after.age / vent.warn) * 0.5,
            });
        }
        if (before.kind !== 'blow' && after.kind === 'blow') {
            addSound(audio, 'ventBlow', gain * 0.9, 1.25 / vent.blow);
        }
    }
}

function duct({ prev, next, audio }: AudioScene): void {
    const before = prev.ductReaction;
    const after = next.ductReaction;
    if (after.kind !== 'reacting') {
        return;
    }
    const gain = distanceGain(
        next,
        STAGE_THREE.duct.x,
        STAGE_THREE.duct.y,
        650,
    );
    for (const burst of after.bursts) {
        const timing = ductTimings(burst.kind);
        const from = timing.inhale + timing.twitch;
        const elapsed = Math.max(0, next.time - prev.time);
        if (burst.age < from) {
            audio.loops.push({
                id: 'duct',
                name: 'ventMotor',
                gain: gain * 0.6,
                rate: 0.8 + burst.age,
            });
        }
        if (burst.age >= from && burst.age - elapsed < from) {
            addSound(audio, 'ventBlow', gain, 1.25 / timing.sneeze);
        }
    }
    if (before.kind === 'idle') {
        addSound(audio, 'metalRattle', gain * 0.4);
    }
}

export function rooftopAudio(scene: AudioScene): void {
    const { prev, next, audio } = scene;
    const before = prev.rooftopEntrance;
    const after = next.rooftopEntrance;
    if (before.kind === 'opening' && after.kind === 'ready') {
        addSound(audio, 'doorClose', 0.65);
    }
    if (
        prev.firstFlight.kind === 'course' &&
        next.firstFlight.kind === 'ride'
    ) {
        addSound(audio, 'launchWindup', 0.8);
    }
    if (
        prev.firstFlight.kind === 'ride' &&
        next.firstFlight.kind === 'flight'
    ) {
        addSound(audio, 'launchKick', 0.85);
        addSound(audio, 'ventBlow', 0.8);
    }
    vents(scene);
    duct(scene);
}
