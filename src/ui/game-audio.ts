import { sceneAudio } from '../presentation/scene-audio';
import { frameSounds, silentFrame } from '../presentation/sfx';

import type { Sfx } from './sfx';
import type { GameSnapshot } from '../game/game';
import type { GameEvent } from '../game/types';
import type { SceneAudio } from '../presentation/audio-types';
import type { SfxName } from '../presentation/sfx';

const FRAME_GAINS: Partial<Record<SfxName, number>> = { land: 0.45 };

export type GameAudio = {
    update(next: GameSnapshot | null, events?: readonly GameEvent[]): void;
};

function discontinuity(
    before: GameSnapshot,
    after: GameSnapshot,
    events: readonly GameEvent[],
) {
    return (
        before.stage !== after.stage ||
        after.time < before.time ||
        events.some((event) => event.type === 'reset')
    );
}

function beganSpray(before: GameSnapshot, after: GameSnapshot) {
    return (
        before.spray.burst <= 0 &&
        after.spray.burst > 0 &&
        after.mode === 'play' &&
        !silentFrame(after)
    );
}

class GameAudioPlayer implements GameAudio {
    private previous: GameSnapshot | null = null;
    private readonly heard = new Set<string>();
    constructor(private readonly sfx: Sfx) {}

    private reset() {
        if (this.previous) {
            this.sfx.stop(true);
        }
        this.previous = null;
        this.heard.clear();
        this.sfx.syncLoops([]);
    }

    private shots(audio: SceneAudio) {
        for (const shot of audio.shots) {
            if (shot.key && this.heard.has(shot.key)) {
                continue;
            }
            if (shot.key) {
                this.heard.add(shot.key);
            }
            this.sfx.play(shot.name, undefined, shot);
        }
    }

    update(next: GameSnapshot | null, events: readonly GameEvent[] = []) {
        if (!next) {
            this.reset();
            return;
        }
        if (next === this.previous) {
            return;
        }
        const before = this.previous;
        if (before) {
            if (discontinuity(before, next, events)) {
                this.sfx.stop(true);
                this.heard.clear();
            } else if (
                before.mode !== next.mode ||
                silentFrame(before) !== silentFrame(next)
            ) {
                this.sfx.stop(true);
            }
            if (beganSpray(before, next)) {
                this.sfx.play('sprayLever', undefined, { gain: 0.3 });
            }
        }
        const audio = sceneAudio(before, next, events);
        for (const name of frameSounds(before, next, events)) {
            if (name !== 'spray') {
                this.sfx.play(name, undefined, { gain: FRAME_GAINS[name] });
            }
        }
        this.shots(audio);
        this.sfx.syncLoops(audio.loops);
        this.previous = next;
    }
}

export function createGameAudio(sfx: Sfx): GameAudio {
    return new GameAudioPlayer(sfx);
}
