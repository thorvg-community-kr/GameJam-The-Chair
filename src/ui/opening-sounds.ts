import { noise, tone } from './sfx-layers';

import type { Layer } from './sfx-layers';
import type { OpeningSfxName } from '../presentation/sfx';

function keystroke(at: number, freq: number, peak = 0.17): Layer[] {
    return [
        noise('bandpass', freq, 0.024, { at, q: 2.6, peak }),
        tone(freq * 0.28, freq * 0.16, 0.018, 'sine', {
            at,
            peak: peak * 0.5,
        }),
    ];
}

function clockSpinLayers(fast: boolean): Layer[] {
    const times = fast
        ? [
              0.02, 0.12, 0.21, 0.29, 0.36, 0.43, 0.5, 0.57, 0.65, 0.73, 0.82,
              0.92, 1.03,
          ]
        : [0.02, 0.14, 0.24, 0.33, 0.41, 0.49, 0.57, 0.66, 0.76, 0.88, 1.01];
    const baseFreq = fast ? 1280 : 1080;
    const whirTop = fast ? 310 : 255;
    const ticks = times.map((at, index) =>
        noise('bandpass', baseFreq + (index % 2) * 220, 0.026, {
            at,
            q: 3.2,
            peak:
                0.11 +
                Math.sin(((index + 1) / (times.length + 1)) * Math.PI) * 0.055,
        }),
    );
    return [
        ...ticks,
        tone(135, whirTop, 0.54, 'triangle', {
            at: 0.04,
            attack: 0.16,
            peak: fast ? 0.07 : 0.06,
        }),
        tone(whirTop, 125, 0.54, 'triangle', {
            at: 0.56,
            attack: 0.05,
            peak: fast ? 0.07 : 0.06,
        }),
    ];
}

const TYPING_PATTERN: ReadonlyArray<readonly [number, number, number]> = [
    [0.0, 1420, 0.17],
    [0.08, 1240, 0.15],
    [0.16, 1620, 0.18],
    [0.26, 1340, 0.16],
    [0.34, 1720, 0.18],
    [0.43, 1280, 0.15],
    [0.51, 1540, 0.17],
    [0.62, 1180, 0.19],
];

const CLOCK_RATTLE_TIMES = [0.14, 0.22, 0.3, 0.39, 0.48, 0.58];

export const OPENING_SOUNDS: Record<OpeningSfxName, Layer[]> = {
    openingClockSix: [
        noise('bandpass', 1200, 0.024, { q: 3, peak: 0.14 }),
        tone(440, 440, 0.3, 'triangle', { at: 0.03, peak: 0.15 }),
        tone(659, 659, 0.55, 'triangle', { at: 0.14, peak: 0.15 }),
        tone(880, 880, 0.42, 'sine', { at: 0.14, peak: 0.045 }),
    ],
    openingClockSeven: [
        noise('bandpass', 1000, 0.028, { q: 2.8, peak: 0.15 }),
        tone(392, 389, 0.24, 'triangle', { at: 0.03, peak: 0.14 }),
        tone(349, 345, 0.42, 'triangle', { at: 0.14, peak: 0.14 }),
    ],
    openingClockEight: [
        noise('bandpass', 850, 0.032, { q: 2.5, peak: 0.16 }),
        tone(135, 62, 0.12, 'sine', { peak: 0.22 }),
        tone(330, 326, 0.24, 'triangle', { at: 0.04, peak: 0.14 }),
        tone(311, 304, 0.46, 'triangle', { at: 0.15, peak: 0.14 }),
        tone(165, 155, 0.34, 'triangle', { at: 0.15, peak: 0.06 }),
    ],
    openingClockNine: [
        tone(110, 103, 0.7, 'triangle', { peak: 0.24 }),
        tone(156, 150, 0.6, 'sine', { at: 0.02, peak: 0.12 }),
        tone(311, 298, 0.46, 'sine', { at: 0.02, peak: 0.055 }),
        noise('lowpass', 620, 0.12, { to: 180, peak: 0.2 }),
        ...CLOCK_RATTLE_TIMES.map((at, index) =>
            noise('bandpass', 920 + (index % 2) * 180, 0.026, {
                at,
                q: 3,
                peak: 0.13 - index * 0.015,
            }),
        ),
    ],
    openingClockSpin: clockSpinLayers(false),
    openingClockSpinFast: clockSpinLayers(true),
    openingIrisOpen: [
        noise('bandpass', 260, 0.36, {
            to: 1150,
            q: 1.8,
            attack: 0.12,
            peak: 0.1,
        }),
        tone(180, 460, 0.34, 'sine', { attack: 0.08, peak: 0.095 }),
        tone(420, 560, 0.07, 'triangle', { at: 0.31, peak: 0.085 }),
    ],
    openingIrisQuick: [
        noise('bandpass', 300, 0.24, {
            to: 1100,
            q: 1.8,
            attack: 0.06,
            peak: 0.09,
        }),
        tone(200, 440, 0.24, 'sine', { attack: 0.05, peak: 0.085 }),
    ],
    openingIrisClose: [
        noise('bandpass', 1050, 0.28, {
            to: 240,
            q: 1.8,
            attack: 0.04,
            peak: 0.1,
        }),
        tone(440, 155, 0.28, 'sine', { attack: 0.02, peak: 0.095 }),
        tone(130, 72, 0.07, 'sine', { at: 0.24, peak: 0.12 }),
    ],
    openingRiderSigh: [
        tone(310, 440, 0.05, 'sine', { peak: 0.08 }),
        tone(175, 118, 0.34, 'triangle', {
            at: 0.07,
            attack: 0.06,
            peak: 0.11,
        }),
        noise('bandpass', 620, 0.32, {
            at: 0.08,
            to: 340,
            q: 1.6,
            attack: 0.08,
            peak: 0.075,
        }),
        ...keystroke(0.48, 1350, 0.11),
        ...keystroke(0.64, 1520, 0.11),
    ],
    openingRiderTalk: [
        tone(320, 460, 0.05, 'sine', { peak: 0.08 }),
        tone(185, 198, 0.1, 'triangle', { at: 0.06, peak: 0.1 }),
        tone(198, 180, 0.1, 'triangle', { at: 0.17, peak: 0.1 }),
        tone(205, 220, 0.13, 'triangle', { at: 0.28, peak: 0.11 }),
        ...keystroke(0.44, 1420, 0.13),
        ...keystroke(0.54, 1640, 0.13),
    ],
    openingPushIn: [
        noise('bandpass', 220, 0.5, {
            to: 640,
            q: 1.8,
            attack: 0.22,
            peak: 0.075,
        }),
        tone(147, 247, 0.48, 'sine', { attack: 0.2, peak: 0.065 }),
    ],
    openingChairHope: [
        tone(185, 370, 0.12, 'triangle', { peak: 0.13 }),
        tone(262, 262, 0.15, 'triangle', { at: 0.1, peak: 0.13 }),
        tone(330, 330, 0.15, 'triangle', { at: 0.26, peak: 0.13 }),
        tone(392, 392, 0.18, 'triangle', { at: 0.42, peak: 0.13 }),
        tone(440, 440, 0.16, 'triangle', { at: 0.62, peak: 0.12 }),
        tone(523, 523, 0.42, 'triangle', { at: 0.8, peak: 0.13 }),
        tone(784, 784, 0.22, 'sine', { at: 0.44, peak: 0.045 }),
        tone(1047, 1047, 0.34, 'sine', { at: 0.82, peak: 0.045 }),
    ],
    openingChairSparkle: [
        tone(392, 392, 0.14, 'triangle', { at: 0.0, peak: 0.11 }),
        tone(330, 330, 0.14, 'triangle', { at: 0.16, peak: 0.11 }),
        tone(392, 392, 0.16, 'triangle', { at: 0.32, peak: 0.11 }),
        tone(523, 523, 0.38, 'triangle', { at: 0.5, peak: 0.12 }),
        tone(784, 784, 0.28, 'sine', { at: 0.52, peak: 0.045 }),
    ],
    openingCreakLow: [
        tone(310, 470, 0.13, 'sine', { wobble: 15, peak: 0.12 }),
        tone(470, 340, 0.16, 'sine', { at: 0.12, wobble: 12, peak: 0.11 }),
        noise('bandpass', 650, 0.22, {
            to: 850,
            q: 3.2,
            attack: 0.04,
            peak: 0.06,
        }),
    ],
    openingCreakMid: [
        tone(420, 720, 0.1, 'triangle', { wobble: 20, peak: 0.13 }),
        tone(720, 490, 0.14, 'triangle', {
            at: 0.09,
            wobble: 16,
            peak: 0.12,
        }),
        noise('bandpass', 880, 0.18, {
            to: 1150,
            q: 3.5,
            attack: 0.02,
            peak: 0.085,
        }),
    ],
    openingCreakHigh: [
        tone(560, 980, 0.08, 'triangle', { wobble: 26, peak: 0.12 }),
        tone(620, 1080, 0.09, 'sine', { wobble: 26, peak: 0.11 }),
        tone(980, 640, 0.11, 'triangle', {
            at: 0.08,
            wobble: 22,
            peak: 0.11,
        }),
        noise('bandpass', 1150, 0.14, { to: 1480, q: 3.8, peak: 0.1 }),
    ],
    openingChairWindup: [
        tone(145, 320, 0.17, 'triangle', {
            attack: 0.05,
            wobble: 18,
            peak: 0.095,
        }),
        tone(260, 510, 0.17, 'sine', { attack: 0.05, peak: 0.08 }),
        noise('bandpass', 620, 0.17, {
            to: 1150,
            q: 3.2,
            attack: 0.05,
            peak: 0.065,
        }),
    ],
    openingChairKick: [
        tone(155, 46, 0.15, 'sine', { peak: 0.27 }),
        noise('bandpass', 880, 0.065, { to: 380, q: 1.8, peak: 0.21 }),
        tone(195, 560, 0.24, 'triangle', {
            at: 0.02,
            wobble: 22,
            wobbleDepth: 0.09,
            peak: 0.17,
        }),
    ],
    openingRiderPlop: [
        tone(145, 48, 0.16, 'sine', { peak: 0.24 }),
        noise('lowpass', 480, 0.11, { to: 180, peak: 0.15 }),
    ],
    openingTyping: TYPING_PATTERN.flatMap(([at, freq, peak]) =>
        keystroke(at, freq, peak),
    ),
    openingRageSnap: [
        noise('bandpass', 1250, 0.075, { to: 520, q: 2.2, peak: 0.22 }),
        tone(920, 210, 0.11, 'triangle', { peak: 0.16 }),
        tone(680, 170, 0.09, 'square', { peak: 0.07 }),
        tone(155, 34, 0.36, 'sine', { at: 0.02, peak: 0.34 }),
        noise('lowpass', 780, 0.3, { at: 0.02, to: 140, peak: 0.24 }),
        tone(92, 118, 0.78, 'triangle', {
            at: 0.08,
            attack: 0.05,
            wobble: 32,
            wobbleDepth: 0.08,
            peak: 0.14,
        }),
        tone(92, 118, 0.72, 'sawtooth', {
            at: 0.08,
            attack: 0.06,
            wobble: 32,
            peak: 0.045,
        }),
        noise('bandpass', 760, 0.7, {
            at: 0.1,
            to: 1180,
            q: 2.2,
            attack: 0.08,
            peak: 0.08,
        }),
    ],
    openingHandoff: [
        noise('bandpass', 880, 0.38, {
            to: 320,
            q: 1.8,
            attack: 0.08,
            peak: 0.09,
        }),
        tone(294, 294, 0.09, 'triangle', { at: 0.16, peak: 0.11 }),
        tone(392, 392, 0.28, 'triangle', { at: 0.26, peak: 0.13 }),
    ],
};
