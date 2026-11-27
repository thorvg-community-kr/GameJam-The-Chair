import { noise, tone } from './sfx-layers';

import type { Layer } from './sfx-layers';
import type { OpeningSfxName } from '../presentation/sfx';

function keystroke(at: number, freq: number, peak = 0.17): Layer[] {
    return [
        noise('bandpass', freq, 0.022, { at, q: 6, peak }),
        tone(freq * 0.24, freq * 0.17, 0.015, 'sine', {
            at,
            peak: peak * 0.35,
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
    const baseFreq = fast ? 2450 : 2100;
    const whirTop = fast ? 430 : 350;
    const ticks = times.map((at, index) =>
        noise('bandpass', baseFreq + (index % 2) * 420, 0.024, {
            at,
            q: 7,
            peak:
                0.11 +
                Math.sin(((index + 1) / (times.length + 1)) * Math.PI) * 0.06,
        }),
    );
    return [
        ...ticks,
        tone(175, whirTop, 0.54, 'triangle', {
            at: 0.04,
            attack: 0.16,
            peak: fast ? 0.065 : 0.055,
        }),
        tone(whirTop, 160, 0.54, 'triangle', {
            at: 0.56,
            attack: 0.05,
            peak: fast ? 0.065 : 0.055,
        }),
    ];
}

const TYPING_PATTERN: ReadonlyArray<readonly [number, number, number]> = [
    [0.0, 3150, 0.17],
    [0.08, 2780, 0.15],
    [0.16, 3480, 0.18],
    [0.26, 2950, 0.16],
    [0.34, 3620, 0.18],
    [0.43, 2840, 0.15],
    [0.51, 3360, 0.17],
    [0.62, 2680, 0.19],
];

const CLOCK_RATTLE_TIMES = [0.14, 0.22, 0.3, 0.39, 0.48, 0.58];

export const OPENING_SOUNDS: Record<OpeningSfxName, Layer[]> = {
    openingClockSix: [
        noise('bandpass', 2400, 0.026, { q: 6, peak: 0.16 }),
        tone(659, 659, 0.3, 'triangle', { at: 0.03, peak: 0.14 }),
        tone(988, 988, 0.55, 'triangle', { at: 0.14, peak: 0.14 }),
        tone(1319, 1319, 0.44, 'sine', { at: 0.14, peak: 0.06 }),
    ],
    openingClockSeven: [
        noise('bandpass', 2000, 0.03, { q: 5, peak: 0.18 }),
        tone(523, 520, 0.24, 'triangle', { at: 0.03, peak: 0.13 }),
        tone(466, 462, 0.42, 'triangle', { at: 0.14, peak: 0.13 }),
    ],
    openingClockEight: [
        noise('bandpass', 1600, 0.035, { q: 4, peak: 0.2 }),
        tone(175, 76, 0.12, 'sine', { peak: 0.2 }),
        tone(392, 388, 0.24, 'triangle', { at: 0.04, peak: 0.14 }),
        tone(370, 362, 0.46, 'triangle', { at: 0.15, peak: 0.14 }),
        tone(370, 360, 0.34, 'sawtooth', { at: 0.15, peak: 0.035 }),
    ],
    openingClockNine: [
        tone(147, 138, 0.68, 'triangle', { peak: 0.22 }),
        tone(208, 202, 0.58, 'sine', { at: 0.02, peak: 0.11 }),
        tone(415, 398, 0.48, 'sine', { at: 0.02, peak: 0.065 }),
        noise('lowpass', 900, 0.12, { to: 260, peak: 0.22 }),
        ...CLOCK_RATTLE_TIMES.map((at, index) =>
            noise('bandpass', 1550 + (index % 2) * 320, 0.026, {
                at,
                q: 5,
                peak: 0.15 - index * 0.018,
            }),
        ),
    ],
    openingClockSpin: clockSpinLayers(false),
    openingClockSpinFast: clockSpinLayers(true),
    openingIrisOpen: [
        noise('bandpass', 420, 0.36, {
            to: 2200,
            q: 2.5,
            attack: 0.12,
            peak: 0.11,
        }),
        tone(240, 720, 0.34, 'sine', { attack: 0.08, peak: 0.1 }),
        tone(620, 880, 0.07, 'triangle', { at: 0.31, peak: 0.09 }),
    ],
    openingIrisQuick: [
        noise('bandpass', 520, 0.24, {
            to: 2000,
            q: 2.5,
            attack: 0.06,
            peak: 0.1,
        }),
        tone(280, 680, 0.24, 'sine', { attack: 0.05, peak: 0.09 }),
    ],
    openingIrisClose: [
        noise('bandpass', 1900, 0.28, {
            to: 360,
            q: 2.5,
            attack: 0.04,
            peak: 0.11,
        }),
        tone(680, 210, 0.28, 'sine', { attack: 0.02, peak: 0.1 }),
        tone(160, 85, 0.07, 'sine', { at: 0.24, peak: 0.12 }),
    ],
    openingRiderSigh: [
        tone(420, 620, 0.05, 'sine', { peak: 0.09 }),
        tone(220, 145, 0.34, 'triangle', {
            at: 0.07,
            attack: 0.06,
            peak: 0.1,
        }),
        noise('bandpass', 950, 0.32, {
            at: 0.08,
            to: 520,
            q: 2,
            attack: 0.08,
            peak: 0.08,
        }),
        ...keystroke(0.48, 2950, 0.11),
        ...keystroke(0.64, 3250, 0.11),
    ],
    openingRiderTalk: [
        tone(440, 660, 0.05, 'sine', { peak: 0.09 }),
        tone(235, 250, 0.1, 'triangle', { at: 0.06, peak: 0.09 }),
        tone(250, 228, 0.1, 'triangle', { at: 0.17, peak: 0.09 }),
        tone(265, 288, 0.13, 'triangle', { at: 0.28, peak: 0.1 }),
        ...keystroke(0.44, 3100, 0.13),
        ...keystroke(0.54, 3450, 0.13),
    ],
    openingPushIn: [
        noise('bandpass', 320, 0.5, {
            to: 980,
            q: 2.2,
            attack: 0.22,
            peak: 0.08,
        }),
        tone(196, 330, 0.48, 'sine', { attack: 0.2, peak: 0.07 }),
    ],
    openingChairHope: [
        tone(260, 560, 0.12, 'triangle', { peak: 0.13 }),
        tone(523, 523, 0.15, 'triangle', { at: 0.1, peak: 0.12 }),
        tone(659, 659, 0.15, 'triangle', { at: 0.26, peak: 0.12 }),
        tone(784, 784, 0.18, 'triangle', { at: 0.42, peak: 0.12 }),
        tone(880, 880, 0.16, 'triangle', { at: 0.62, peak: 0.11 }),
        tone(1047, 1047, 0.42, 'triangle', { at: 0.8, peak: 0.12 }),
        tone(1568, 1568, 0.22, 'sine', { at: 0.44, peak: 0.05 }),
        tone(2093, 2093, 0.34, 'sine', { at: 0.82, peak: 0.055 }),
    ],
    openingChairSparkle: [
        tone(784, 784, 0.14, 'triangle', { at: 0.0, peak: 0.1 }),
        tone(659, 659, 0.14, 'triangle', { at: 0.16, peak: 0.1 }),
        tone(784, 784, 0.16, 'triangle', { at: 0.32, peak: 0.1 }),
        tone(1047, 1047, 0.38, 'triangle', { at: 0.5, peak: 0.11 }),
        tone(1568, 1568, 0.28, 'sine', { at: 0.52, peak: 0.05 }),
    ],
    openingCreakLow: [
        tone(620, 940, 0.13, 'sine', { wobble: 18, peak: 0.1 }),
        tone(940, 700, 0.16, 'sine', { at: 0.12, wobble: 14, peak: 0.09 }),
        noise('bandpass', 1200, 0.22, {
            to: 1600,
            q: 6,
            attack: 0.04,
            peak: 0.06,
        }),
    ],
    openingCreakMid: [
        tone(880, 1480, 0.1, 'triangle', { wobble: 24, peak: 0.13 }),
        tone(1480, 1020, 0.14, 'triangle', {
            at: 0.09,
            wobble: 20,
            peak: 0.12,
        }),
        noise('bandpass', 1800, 0.18, {
            to: 2400,
            q: 7,
            attack: 0.02,
            peak: 0.09,
        }),
    ],
    openingCreakHigh: [
        tone(1250, 2150, 0.08, 'sawtooth', { wobble: 32, peak: 0.085 }),
        tone(1300, 2250, 0.09, 'sine', { wobble: 32, peak: 0.13 }),
        tone(2150, 1450, 0.11, 'triangle', {
            at: 0.08,
            wobble: 26,
            peak: 0.12,
        }),
        noise('bandpass', 2600, 0.14, { to: 3300, q: 7, peak: 0.11 }),
    ],
    openingChairWindup: [
        tone(190, 440, 0.17, 'sawtooth', {
            attack: 0.05,
            wobble: 22,
            peak: 0.075,
        }),
        tone(380, 760, 0.17, 'sine', { attack: 0.05, peak: 0.09 }),
        noise('bandpass', 1000, 0.17, {
            to: 2100,
            q: 5,
            attack: 0.05,
            peak: 0.07,
        }),
    ],
    openingChairKick: [
        tone(175, 52, 0.14, 'sine', { peak: 0.26 }),
        noise('bandpass', 1400, 0.06, { to: 600, q: 2, peak: 0.22 }),
        tone(260, 820, 0.24, 'triangle', {
            at: 0.02,
            wobble: 26,
            wobbleDepth: 0.09,
            peak: 0.18,
        }),
    ],
    openingRiderPlop: [
        tone(165, 52, 0.15, 'sine', { peak: 0.24 }),
        noise('lowpass', 620, 0.1, { to: 220, peak: 0.16 }),
    ],
    openingTyping: TYPING_PATTERN.flatMap(([at, freq, peak]) =>
        keystroke(at, freq, peak),
    ),
    openingRageSnap: [
        noise('highpass', 2600, 0.07, { to: 900, peak: 0.24 }),
        tone(1850, 320, 0.11, 'square', { peak: 0.14 }),
        tone(185, 36, 0.34, 'sine', { at: 0.02, peak: 0.32 }),
        noise('lowpass', 1200, 0.28, { at: 0.02, to: 180, peak: 0.24 }),
        tone(115, 145, 0.78, 'sawtooth', {
            at: 0.08,
            attack: 0.05,
            wobble: 36,
            wobbleDepth: 0.08,
            peak: 0.1,
        }),
        noise('bandpass', 1800, 0.72, {
            at: 0.1,
            to: 2800,
            q: 3,
            attack: 0.08,
            peak: 0.08,
        }),
    ],
    openingHandoff: [
        noise('bandpass', 1400, 0.38, {
            to: 480,
            q: 2,
            attack: 0.08,
            peak: 0.09,
        }),
        tone(392, 392, 0.09, 'triangle', { at: 0.16, peak: 0.11 }),
        tone(523, 523, 0.26, 'triangle', { at: 0.26, peak: 0.13 }),
    ],
};
