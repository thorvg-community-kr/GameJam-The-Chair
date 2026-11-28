import { noise, tone } from './sfx-layers';

import type { Layer } from './sfx-layers';
import type { SceneSfxName } from '../presentation/audio-types';

export const WORLD_SOUNDS: Record<SceneSfxName, Layer[]> = {
    typing: [
        noise('highpass', 1800, 0.08, { peak: 0.08 }),
        noise('highpass', 1800, 0.07, { at: 0.14, peak: 0.06 }),
    ],
    doorOpen: [noise('lowpass', 1400, 0.55, { peak: 0.12, attack: 0.03 })],
    doorClose: [tone(140, 70, 0.18, 'triangle', { peak: 0.2 })],
    liftArrival: [
        tone(880, 880, 0.4, 'sine', { peak: 0.16 }),
        tone(660, 660, 0.5, 'sine', { at: 0.45, peak: 0.12 }),
    ],
    birdCall: [tone(1600, 600, 0.3, 'triangle', { wobble: 30, peak: 0.12 })],
    woodCreak: [tone(280, 580, 0.4, 'triangle', { wobble: 23, peak: 0.1 })],
    metalRattle: [
        tone(1300, 1050, 0.35, 'triangle', { wobble: 19, peak: 0.1 }),
    ],
    launchWindup: [
        tone(70, 430, 0.76, 'sawtooth', { peak: 0.1, attack: 0.08 }),
    ],
    launchKick: [
        tone(180, 48, 0.3, 'sine', { peak: 0.25 }),
        noise('lowpass', 2300, 0.28, { peak: 0.15 }),
    ],
    satelliteAlert: [
        tone(1200, 700, 0.1, 'square', { peak: 0.08 }),
        tone(1200, 700, 0.1, 'square', { at: 0.13, peak: 0.08 }),
    ],
    gearShift: [tone(90, 380, 0.4, 'triangle', { peak: 0.12 })],
    shutter: [
        noise('highpass', 2500, 0.07, { peak: 0.2 }),
        noise('highpass', 1800, 0.08, { at: 0.09, peak: 0.12 }),
    ],
    uiTap: [tone(1100, 700, 0.045, 'sine', { peak: 0.1 })],
    uiConfirm: [
        tone(740, 740, 0.08, 'sine', { peak: 0.1 }),
        tone(1110, 1110, 0.1, 'sine', { at: 0.07, peak: 0.1 }),
    ],
    uiError: [
        tone(196, 196, 0.09, 'square', { peak: 0.08 }),
        tone(147, 147, 0.21, 'square', { at: 0.12, peak: 0.08 }),
    ],
    ventBlow: [noise('lowpass', 2300, 0.8, { peak: 0.15, attack: 0.04 })],
    sprayLever: [tone(900, 300, 0.08, 'triangle', { peak: 0.12 })],
    portraitSlip: [tone(2400, 1900, 0.16, 'sine', { peak: 0.1 })],
    portraitCatch: [
        tone(320, 130, 0.09, 'triangle', { peak: 0.16 }),
        tone(430, 300, 0.55, 'triangle', { at: 0.12, wobble: 9, peak: 0.08 }),
    ],
};
