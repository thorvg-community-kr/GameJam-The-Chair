import { OPENING_SOUNDS } from './opening-sounds';
import { noise, notes, tone } from './sfx-layers';
import { createSfxGate } from '../presentation/sfx';

import type { Layer, Noise, Tone } from './sfx-layers';
import type { GameSfxName, SfxName } from '../presentation/sfx';

export type { SfxName } from '../presentation/sfx';

export type Sfx = {
    play(name: SfxName, now?: number): void;
    stop(): void;
    unlock(): void;
    setVolume(gain: number): void;
    destroy(): void;
};

const GAME_SOUNDS: Record<GameSfxName, Layer[]> = {
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
    honk: [
        tone(330, 320, 0.22, 'square', { peak: 0.08 }),
        tone(415, 405, 0.22, 'square', { peak: 0.08 }),
    ],
};

export const SOUNDS: Record<SfxName, Layer[]> = {
    ...GAME_SOUNDS,
    ...OPENING_SOUNDS,
};

export function soundLength(name: SfxName): number {
    return Math.max(
        ...SOUNDS[name].map((layer) => (layer.at ?? 0) + layer.seconds),
    );
}

const DEFAULT_PEAK = 0.25;
const SILENT = 0.0001;

function envelope(env: GainNode, start: number, layer: Layer) {
    const attack = Math.min(layer.attack ?? 0.005, layer.seconds * 0.6);
    env.gain.setValueAtTime(SILENT, start);
    env.gain.exponentialRampToValueAtTime(
        layer.peak ?? DEFAULT_PEAK,
        start + attack,
    );
    env.gain.exponentialRampToValueAtTime(SILENT, start + layer.seconds);
}

function trackSource(
    active: Set<AudioScheduledSourceNode>,
    source: AudioScheduledSourceNode,
) {
    active.add(source);
    source.onended = () => {
        active.delete(source);
    };
}

function playTone(
    audio: AudioContext,
    out: AudioNode,
    layer: Tone,
    active: Set<AudioScheduledSourceNode>,
) {
    const start = audio.currentTime + (layer.at ?? 0);
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = layer.wave;
    osc.frequency.setValueAtTime(layer.from, start);
    osc.frequency.exponentialRampToValueAtTime(layer.to, start + layer.seconds);
    if (layer.wobble) {
        const lfo = audio.createOscillator();
        const depth = audio.createGain();
        lfo.frequency.value = layer.wobble;
        depth.gain.value = layer.from * (layer.wobbleDepth ?? 0.04);
        lfo.connect(depth).connect(osc.frequency);
        trackSource(active, lfo);
        lfo.start(start);
        lfo.stop(start + layer.seconds);
    }
    envelope(env, start, layer);
    osc.connect(env).connect(out);
    trackSource(active, osc);
    osc.start(start);
    osc.stop(start + layer.seconds);
}

function playNoise(
    audio: AudioContext,
    out: AudioNode,
    layer: Noise,
    buffer: AudioBuffer,
    active: Set<AudioScheduledSourceNode>,
) {
    const start = audio.currentTime + (layer.at ?? 0);
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const env = audio.createGain();
    src.buffer = buffer;
    filter.type = layer.filter;
    filter.frequency.setValueAtTime(layer.from, start);
    if (layer.q) {
        filter.Q.setValueAtTime(layer.q, start);
    }
    if (layer.to) {
        filter.frequency.exponentialRampToValueAtTime(
            layer.to,
            start + layer.seconds,
        );
    }
    envelope(env, start, layer);
    src.connect(filter).connect(env).connect(out);
    trackSource(active, src);
    src.start(start);
    src.stop(start + layer.seconds);
}

function noiseBuffer(audio: AudioContext): AudioBuffer {
    const buffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

export function createSfx(initialGain: number): Sfx {
    let context: AudioContext | null = null;
    let output: GainNode | null = null;
    let hiss: AudioBuffer | null = null;
    let gain = initialGain;
    const gate = createSfxGate();
    const active = new Set<AudioScheduledSourceNode>();

    const stopActive = () => {
        for (const source of active) {
            try {
                source.stop();
            } catch {}
        }
        active.clear();
        gate.clear();
    };

    const ready = () => {
        if (!context) {
            try {
                context = new AudioContext();
            } catch {
                return null;
            }
            output = context.createGain();
            output.gain.value = gain;
            output.connect(context.destination);
            hiss = noiseBuffer(context);
        }
        if (context.state === 'suspended') {
            void context.resume();
        }
        return context;
    };

    return {
        play(name, now = performance.now() / 1000) {
            if (gain <= 0 || !gate.pass(name, now, soundLength(name))) {
                return;
            }
            const audio = ready();
            if (!audio || !output || !hiss) {
                return;
            }
            for (const layer of SOUNDS[name]) {
                if (layer.kind === 'tone') {
                    playTone(audio, output, layer, active);
                } else {
                    playNoise(audio, output, layer, hiss, active);
                }
            }
        },
        stop() {
            stopActive();
        },
        unlock() {
            ready();
        },
        setVolume(next) {
            gain = next;
            if (output) {
                output.gain.value = next;
            }
        },
        destroy() {
            stopActive();
            void context?.close();
            context = null;
            output = null;
            hiss = null;
        },
    };
}
