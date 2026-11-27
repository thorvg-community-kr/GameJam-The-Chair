import { OPENING_BEATS } from '../render/scene/opening/timeline';

import type { OpeningSfxName } from './sfx';

export type OpeningSoundCue = {
    readonly at: number;
    readonly sound: OpeningSfxName;
};

const B = OPENING_BEATS;

function creakBeatTime(beat: number): number {
    const span = B.creakClose - B.creak;
    const rate = 1 / 0.9;
    const accel = (1 / 0.35 - rate) / (2 * span);
    const age =
        (-rate + Math.sqrt(rate * rate + 4 * accel * beat)) / (2 * accel);
    return B.creak + age;
}

function kickCues(at: number): OpeningSoundCue[] {
    return [
        { at, sound: 'openingChairWindup' },
        { at: at + 0.24, sound: 'openingChairKick' },
        { at: at + 0.7, sound: 'openingRiderPlop' },
    ];
}

export const OPENING_SOUND_CUES: readonly OpeningSoundCue[] = [
    { at: B.sixPm + 0.35, sound: 'openingClockSix' },
    { at: B.irisOpen + 0.05, sound: 'openingIrisOpen' },
    { at: B.riderOvertime, sound: 'openingRiderSigh' },
    { at: B.riderSales, sound: 'openingRiderTalk' },
    { at: B.pushIn + 0.05, sound: 'openingPushIn' },
    { at: B.chairHope, sound: 'openingChairHope' },
    { at: B.chairHope + 1.55, sound: 'openingChairSparkle' },
    { at: B.irisClose, sound: 'openingIrisClose' },
    { at: B.sevenPm, sound: 'openingClockSeven' },
    { at: B.creakOpen, sound: 'openingIrisQuick' },
    { at: creakBeatTime(0), sound: 'openingCreakLow' },
    { at: creakBeatTime(1), sound: 'openingCreakLow' },
    { at: creakBeatTime(2), sound: 'openingCreakMid' },
    { at: creakBeatTime(3), sound: 'openingCreakMid' },
    { at: creakBeatTime(4), sound: 'openingCreakHigh' },
    { at: creakBeatTime(5), sound: 'openingCreakHigh' },
    { at: B.creakClose, sound: 'openingIrisClose' },
    { at: B.spinToEight, sound: 'openingClockSpin' },
    { at: B.eightPm, sound: 'openingClockEight' },
    { at: B.kickOpen, sound: 'openingIrisQuick' },
    ...kickCues(B.kick),
    ...kickCues(B.kick + 1.15),
    { at: B.kick + 1.92, sound: 'openingTyping' },
    { at: B.kickClose, sound: 'openingIrisClose' },
    { at: B.spinToNine, sound: 'openingClockSpinFast' },
    { at: B.ninePm, sound: 'openingClockNine' },
    { at: B.rage, sound: 'openingRageSnap' },
    { at: B.riderTyping + 0.05, sound: 'openingTyping' },
    { at: B.riderTyping + 1.0, sound: 'openingTyping' },
    { at: B.handoff + 0.05, sound: 'openingHandoff' },
];

export function openingSounds(
    prevTime: number | null,
    nextTime: number,
): OpeningSfxName[] {
    if (prevTime === null || nextTime <= prevTime) {
        return [];
    }
    const sounds: OpeningSfxName[] = [];
    for (const cue of OPENING_SOUND_CUES) {
        if (cue.at > prevTime && cue.at <= nextTime) {
            sounds.push(cue.sound);
        }
    }
    return sounds;
}
