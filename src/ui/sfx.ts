import { SAMPLES } from './audio-samples';
import { GAME_SOUNDS } from './game-sounds';
import { OPENING_SOUNDS } from './opening-sounds';
import { createLoopMixer } from './sfx-loops';
import { WORLD_SOUNDS } from './world-sounds';
import { createSfxGate } from '../presentation/sfx';

import type { AudioName } from './audio-samples';
import type { Layer, Noise, Tone } from './sfx-layers';
import type { LoopRequest, SoundOptions } from '../presentation/audio-types';
import type { SfxName } from '../presentation/sfx';

export type { SfxName } from '../presentation/sfx';

export type Sfx = {
    play(name: SfxName, now?: number, options?: SoundOptions): void;
    syncLoops(requests: readonly LoopRequest[]): void;
    stop(keepUi?: boolean): void;
    unlock(): void;
    setVolume(gain: number): void;
    destroy(): void;
};

export const SOUNDS: Record<SfxName, Layer[]> = {
    ...GAME_SOUNDS,
    ...WORLD_SOUNDS,
    ...OPENING_SOUNDS,
};

export function soundLength(name: SfxName): number {
    const sample = SAMPLES.get(name);
    if (sample) {
        return sample.seconds;
    }
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

function loadSamples(
    audio: AudioContext,
    signal: AbortSignal,
    buffers: Map<AudioName, AudioBuffer>,
) {
    const pending = new Map<string, Promise<AudioBuffer>>();
    for (const [name, sample] of SAMPLES) {
        let decoded = pending.get(sample.url);
        if (!decoded) {
            decoded = fetch(sample.url, { signal })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Sound unavailable');
                    }
                    return response.arrayBuffer();
                })
                .then((data) => audio.decodeAudioData(data));
            pending.set(sample.url, decoded);
        }
        void decoded
            .then((buffer) => {
                if (!signal.aborted) {
                    buffers.set(name, buffer);
                }
            })
            .catch(() => undefined);
    }
}

class SfxRuntime implements Sfx {
    private context: AudioContext | null = null;
    private output: GainNode | null = null;
    private hiss: AudioBuffer | null = null;
    private loading: AbortController | null = null;
    private loops: ReturnType<typeof createLoopMixer> | null = null;
    private readonly gate = createSfxGate();
    private readonly buffers = new Map<AudioName, AudioBuffer>();
    private readonly active = new Set<AudioScheduledSourceNode>();
    private readonly uiActive = new Set<AudioScheduledSourceNode>();

    constructor(private gain: number) {}

    private ready() {
        if (!this.context) {
            try {
                this.context = new AudioContext();
            } catch {
                return null;
            }
            this.output = this.context.createGain();
            this.output.gain.value = this.gain;
            this.output.connect(this.context.destination);
            this.hiss = noiseBuffer(this.context);
            this.loading = new AbortController();
            loadSamples(this.context, this.loading.signal, this.buffers);
            this.loops = createLoopMixer(
                this.context,
                this.output,
                this.buffers,
            );
        }
        if (this.context.state === 'suspended') {
            void this.context.resume();
        }
        return this.context;
    }

    private sample(
        audio: AudioContext,
        output: AudioNode,
        buffer: AudioBuffer,
        options: SoundOptions,
    ) {
        const source = audio.createBufferSource();
        const level = audio.createGain();
        level.gain.value = Math.max(0, Math.min(1, options.gain ?? 1));
        source.buffer = buffer;
        source.playbackRate.value = Math.max(
            0.5,
            Math.min(2, options.rate ?? 1),
        );
        source.connect(level).connect(output);
        const active = options.channel === 'ui' ? this.uiActive : this.active;
        active.add(source);
        source.onended = () => {
            active.delete(source);
            source.disconnect();
            level.disconnect();
        };
        source.start();
    }

    play(
        name: SfxName,
        now = performance.now() / 1000,
        options: SoundOptions = {},
    ) {
        if (this.gain <= 0 || (options.gain ?? 1) <= 0) {
            return;
        }
        const audio = this.ready();
        if (!audio || !this.output || !this.hiss) {
            return;
        }
        if (
            !this.gate.pass(name, now, soundLength(name) / (options.rate ?? 1))
        ) {
            return;
        }
        const buffer = this.buffers.get(name);
        if (buffer) {
            this.sample(audio, this.output, buffer, options);
            return;
        }
        this.synthesize(name, audio, this.output, options);
    }

    private synthesize(
        name: SfxName,
        audio: AudioContext,
        output: AudioNode,
        options: SoundOptions,
    ) {
        if (!this.hiss) {
            return;
        }
        const active = options.channel === 'ui' ? this.uiActive : this.active;
        for (const original of SOUNDS[name]) {
            const layer = {
                ...original,
                peak:
                    (original.peak ?? DEFAULT_PEAK) *
                    Math.min(1, options.gain ?? 1),
            };
            if (layer.kind === 'tone') {
                playTone(audio, output, layer, active);
            } else {
                playNoise(audio, output, layer, this.hiss, active);
            }
        }
    }

    syncLoops(requests: readonly LoopRequest[]) {
        if (this.gain <= 0) {
            this.loops?.stop();
            return;
        }
        this.loops?.sync(requests);
    }

    stop(keepUi = false) {
        for (const source of this.active) {
            try {
                source.stop();
            } catch {}
        }
        this.active.clear();
        if (!keepUi) {
            for (const source of this.uiActive) {
                try {
                    source.stop();
                } catch {}
            }
            this.uiActive.clear();
        }
        this.gate.clear();
        this.loops?.stop();
    }

    unlock() {
        this.ready();
    }

    setVolume(next: number) {
        this.gain = next;
        if (this.output) {
            this.output.gain.value = next;
        }
        if (next <= 0) {
            this.stop();
        }
    }

    destroy() {
        this.loading?.abort();
        this.loading = null;
        this.buffers.clear();
        this.stop();
        this.loops?.destroy();
        this.loops = null;
        void this.context?.close();
        this.context = null;
        this.output = null;
        this.hiss = null;
    }
}

export function createSfx(initialGain: number): Sfx {
    return new SfxRuntime(initialGain);
}
