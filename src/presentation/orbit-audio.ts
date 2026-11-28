import { addSound } from './audio-scene';
import {
    satelliteLightArrival,
    satelliteLightLocked,
    satelliteLightOn,
    gearAt,
} from '../game/stages/orbit/course/decide';
import { STAGE_FIVE } from '../game/stages/orbit/data';

import type { AudioScene } from './audio-scene';

export function orbitAudio({ prev, next, audio }: AudioScene): void {
    const before = prev.orbit;
    const after = next.orbit;
    if (!before || !after || after.phase === 'parked') {
        return;
    }
    if (gearAt(after.z).index > gearAt(before.z).index) {
        addSound(audio, 'gearShift', 0.75);
    }
    if (after.freeze > 0 || satelliteLightOn(after, next.player, after.z)) {
        return;
    }
    const beam = STAGE_FIVE.satelliteLight.beams.find(
        (item) =>
            after.z < item.from &&
            satelliteLightArrival(item, after.z, after.speed) <
                STAGE_FIVE.satelliteLight.warn,
    );
    if (beam) {
        audio.loops.push({
            id: 'scan',
            name: 'satelliteScan',
            gain: 0.65,
            rate: satelliteLightLocked(beam, after.z, after.speed) ? 1.3 : 1,
        });
        if (
            !satelliteLightLocked(beam, before.z, before.speed) &&
            satelliteLightLocked(beam, after.z, after.speed)
        ) {
            addSound(audio, 'satelliteAlert', 0.65);
        }
    }
}
