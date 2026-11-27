import { addSound, distanceGain } from './audio-scene';
import { STAGE_TWO } from '../game/stages/building/data';
import { dispatchDoorOpening } from '../render/scene/building/meeting-doors';

import type { AudioScene } from './audio-scene';
import type { GameSnapshot } from '../game/game';

function rooms({ prev, next, audio }: AudioScene): void {
    const before = prev.corridor;
    const after = next.corridor;
    for (const [index, office] of after.offices.entries()) {
        if (office.life > (before.offices.at(index)?.life ?? 0)) {
            addSound(
                audio,
                'typing',
                distanceGain(next, office.x, 392, 320) * 0.6,
            );
        }
    }
    if (after.room.kind !== before.room.kind) {
        if (after.room.kind === 'entering' || after.room.kind === 'corridor') {
            addSound(audio, 'doorOpen', 0.65);
        }
        if (after.room.kind === 'meeting') {
            addSound(audio, 'doorClose', 0.7);
        }
    }
}

function lift({ prev, next, audio }: AudioScene): void {
    const before = prev.corridor;
    const after = next.corridor;
    const liftGain = distanceGain(next, STAGE_TWO.lift, 392, 950);
    if (before.lift.kind === 'arriving' && after.lift.kind === 'open') {
        addSound(audio, 'liftArrival', liftGain);
        addSound(audio, 'doorOpen', liftGain * 0.6);
    }
    if (
        after.lift.kind === 'arriving' ||
        after.departure.kind === 'descending'
    ) {
        audio.loops.push({
            id: 'lift',
            name: 'liftMotor',
            gain: liftGain * 0.65,
            rate: 1,
        });
    }
    if (
        before.departure.kind === 'boarding' &&
        after.departure.kind === 'descending'
    ) {
        addSound(audio, 'doorClose', liftGain);
    }
}

function dispatchOpening(state: GameSnapshot) {
    const clear = state.furniture.every(
        (chair) =>
            chair.released &&
            chair.x - chair.width / 2 > STAGE_TWO.dispatch.room + 78,
    );
    return dispatchDoorOpening(
        state.corridor.dispatchAge,
        state.corridor.dispatchStarted,
        clear,
    );
}

export function buildingAudio(scene: AudioScene): void {
    const { prev, next, audio } = scene;
    const before = prev.corridor;
    const after = next.corridor;
    rooms(scene);
    lift(scene);
    if (dispatchOpening(prev) === 0 && dispatchOpening(next) > 0) {
        addSound(
            audio,
            'doorOpen',
            distanceGain(next, STAGE_TWO.dispatch.room),
        );
    }
    if (dispatchOpening(prev) > 0 && dispatchOpening(next) === 0) {
        addSound(
            audio,
            'doorClose',
            distanceGain(next, STAGE_TWO.dispatch.room),
        );
    }
    if (before.pace !== 'express' && after.pace === 'express') {
        addSound(audio, 'honk', 0.7);
    }
    const moving = next.furniture.filter(
        (chair) => chair.released && Math.abs(chair.vx) > 15,
    );
    const nearest = moving
        .sort(
            (a, b) =>
                Math.abs(a.x - next.player.x) - Math.abs(b.x - next.player.x),
        )
        .at(0);
    if (nearest) {
        audio.loops.push({
            id: 'convoy',
            name: 'wheelLoop',
            gain: distanceGain(next, nearest.x, 392, 550) * 0.65,
            rate: 0.8 + Math.min(0.7, Math.abs(nearest.vx) / 400),
        });
    }
}
