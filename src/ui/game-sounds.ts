import { noise, notes, tone } from './sfx-layers';

import type { Layer } from './sfx-layers';
import type { SceneSfxName } from '../presentation/audio-types';
import type { GameSfxName } from '../presentation/sfx';

export const GAME_SOUNDS: Record<
    Exclude<GameSfxName, SceneSfxName>,
    Layer[]
> = {
    jump: [tone(240, 760, 0.13, 'triangle', { peak: 0.2 })],
    land: [
        tone(150, 50, 0.12, 'sine', { peak: 0.35 }),
        noise('lowpass', 500, 0.06, { peak: 0.2 }),
    ],
    bonk: [
        tone(620, 150, 0.22, 'square', { peak: 0.18 }),
        tone(1900, 1700, 0.3, 'sine', { peak: 0.1 }),
        noise('bandpass', 900, 0.05, { peak: 0.3 }),
    ],
    paper: [noise('bandpass', 3200, 0.1, { to: 1400, peak: 0.28 })],
    thud: [
        tone(110, 40, 0.25, 'sine', { peak: 0.4 }),
        noise('lowpass', 700, 0.14, { peak: 0.3 }),
    ],
    copier: [tone(110, 118, 0.22, 'sawtooth', { peak: 0.1, wobble: 40 })],
    splash: [noise('bandpass', 2400, 0.4, { to: 500, peak: 0.35 })],
    crash: [
        noise('highpass', 2500, 0.45, { peak: 0.3 }),
        tone(420, 90, 0.3, 'square', { peak: 0.1 }),
        tone(980, 940, 0.5, 'triangle', { at: 0.04, peak: 0.08 }),
    ],
    dizzy: [tone(900, 300, 0.6, 'sine', { peak: 0.16, wobble: 14 })],
    squeak: [
        tone(1300, 2300, 0.07, 'sine', { peak: 0.14 }),
        tone(2300, 1500, 0.09, 'sine', { at: 0.07, peak: 0.14 }),
    ],
    zap: [tone(2200, 140, 0.16, 'sawtooth', { peak: 0.12 })],
    spray: [noise('highpass', 3500, 0.2, { to: 1800, peak: 0.22 })],
    pickup: notes([660, 880, 1320], 0.06, 'square', 0.1),
    checkpoint: notes([988, 1319], 0.08, 'triangle', 0.2),
    clear: notes([523, 659, 784, 1047, 784, 1047], 0.09, 'square', 0.1),
    fail: [
        tone(392, 370, 0.3, 'sawtooth', { peak: 0.12 }),
        tone(370, 349, 0.3, 'sawtooth', { at: 0.32, peak: 0.12 }),
        tone(349, 330, 0.3, 'sawtooth', { at: 0.64, peak: 0.12 }),
        tone(330, 250, 0.9, 'sawtooth', { at: 0.96, peak: 0.12, wobble: 7 }),
    ],
    fall: [tone(1800, 180, 0.75, 'sine', { peak: 0.16 })],
    click: [tone(900, 300, 0.08, 'triangle')],
    wind: [noise('lowpass', 2000, 1.25, { peak: 0.1 })],
    bird: [tone(1400, 700, 0.2, 'triangle', { peak: 0.15 })],
    honk: [
        tone(330, 320, 0.22, 'square', { peak: 0.08 }),
        tone(415, 405, 0.22, 'square', { peak: 0.08 }),
    ],
};
