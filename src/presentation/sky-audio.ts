import { addSound, distanceGain } from './audio-scene';
import { skyHazards, skyPlatforms } from '../game/stages/sky/data';

import type { AudioScene } from './audio-scene';

export function skyAudio({ prev, next, audio }: AudioScene): void {
    if (next.sky.phase !== 'course') {
        return;
    }
    if (next.sky.standing && next.sky.standing !== prev.sky.standing) {
        const platform = skyPlatforms(next.sky, next.time).find(
            (item) => item.id === next.sky.standing,
        );
        if (platform?.kind === 'desk' || platform?.kind === 'small-desk') {
            addSound(audio, 'woodCreak', 0.7);
        }
        if (platform?.kind === 'sign') {
            addSound(audio, 'metalRattle', 0.65);
        }
    }
    if (prev.sky.drawer < 0.75 && next.sky.drawer >= 0.75) {
        addSound(audio, 'woodCreak', 0.5);
    }
    if (next.sky.knockKind === 'gear' && next.sky.knock > prev.sky.knock) {
        addSound(audio, 'metalRattle', 0.8);
    }
    birds({ prev, next, audio });
}

function birds({ prev, next, audio }: AudioScene): void {
    const before = skyHazards(prev.time);
    for (const bird of skyHazards(next.time).filter(
        (item) => item.kind === 'bird' && !item.robot,
    )) {
        const old = before.find((item) => item.id === bird.id);
        if (!old || old.focusId !== bird.focusId) {
            continue;
        }
        const distance = Math.hypot(
            bird.x - next.player.x,
            bird.y - next.player.y,
        );
        const previous = Math.hypot(
            old.x - prev.player.x,
            old.y - prev.player.y,
        );
        if (previous >= 230 && distance < 230) {
            audio.shots.push({
                name: 'birdCall',
                gain: distanceGain(next, bird.x, bird.y, 550) * 0.8,
                rate: 1,
                key: `${bird.id}-${bird.focusId}`,
            });
        }
    }
}
