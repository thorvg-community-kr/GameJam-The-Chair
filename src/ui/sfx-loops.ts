import type { AudioName } from './audio-samples';
import type { LoopRequest } from '../presentation/audio-types';

type Voice = { source: AudioBufferSourceNode; gain: GainNode; name: AudioName };

export type LoopMixer = {
    sync(requests: readonly LoopRequest[]): void;
    stop(): void;
    destroy(): void;
};

export function createLoopMixer(
    audio: AudioContext,
    output: AudioNode,
    buffers: ReadonlyMap<AudioName, AudioBuffer>,
): LoopMixer {
    const voices = new Map<string, Voice>();
    const retiring = new Set<Voice>();
    const fade = (voice: Voice) => {
        retiring.add(voice);
        voice.gain.gain.cancelScheduledValues(audio.currentTime);
        voice.gain.gain.setTargetAtTime(0, audio.currentTime, 0.018);
        voice.source.stop(audio.currentTime + 0.1);
    };
    const create = (request: LoopRequest): Voice | null => {
        const buffer = buffers.get(request.name);
        if (!buffer) {
            return null;
        }
        const source = audio.createBufferSource();
        const gain = audio.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain).connect(output);
        const voice = { source, gain, name: request.name };
        source.onended = () => {
            source.disconnect();
            gain.disconnect();
            retiring.delete(voice);
        };
        source.start();
        return voice;
    };
    return {
        sync(requests: readonly LoopRequest[]) {
            const wanted = requests
                .filter((request) => request.gain > 0.005)
                .slice(0, 4);
            const ids = new Set(wanted.map((request) => request.id));
            for (const [id, voice] of voices) {
                if (!ids.has(id)) {
                    fade(voice);
                    voices.delete(id);
                }
            }
            for (const request of wanted) {
                let voice = voices.get(request.id);
                if (voice && voice.name !== request.name) {
                    fade(voice);
                    voices.delete(request.id);
                    voice = undefined;
                }
                if (!voice) {
                    const created = create(request);
                    if (!created) {
                        continue;
                    }
                    voice = created;
                    voices.set(request.id, voice);
                }
                voice.gain.gain.setTargetAtTime(
                    Math.min(1, request.gain),
                    audio.currentTime,
                    0.035,
                );
                voice.source.playbackRate.setTargetAtTime(
                    Math.max(0.5, Math.min(2, request.rate)),
                    audio.currentTime,
                    0.05,
                );
            }
        },
        stop() {
            for (const voice of voices.values()) {
                fade(voice);
            }
            voices.clear();
        },
        destroy() {
            for (const voice of [...voices.values(), ...retiring]) {
                try {
                    voice.source.stop();
                } catch {}
            }
            voices.clear();
            retiring.clear();
        },
    };
}
