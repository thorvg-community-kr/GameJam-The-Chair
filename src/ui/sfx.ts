export type SfxName = 'boop';

export type Sfx = {
    play(name: SfxName): void;
    setVolume(gain: number): void;
    destroy(): void;
};

type Tone = { from: number; to: number; seconds: number; wave: OscillatorType };

const TONES: Record<SfxName, Tone> = {
    boop: { from: 720, to: 260, seconds: 0.12, wave: 'square' },
};
const PEAK = 0.25;

export function createSfx(initialGain: number): Sfx {
    let context: AudioContext | null = null;
    let output: GainNode | null = null;
    let gain = initialGain;

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
        }
        if (context.state === 'suspended') {
            void context.resume();
        }
        return context;
    };

    return {
        play(name) {
            if (gain <= 0) {
                return;
            }
            const audio = ready();
            if (!audio || !output) {
                return;
            }
            const tone = TONES[name];
            const now = audio.currentTime;
            const osc = audio.createOscillator();
            const env = audio.createGain();
            osc.type = tone.wave;
            osc.frequency.setValueAtTime(tone.from, now);
            osc.frequency.exponentialRampToValueAtTime(
                tone.to,
                now + tone.seconds,
            );
            env.gain.setValueAtTime(PEAK, now);
            env.gain.exponentialRampToValueAtTime(0.001, now + tone.seconds);
            osc.connect(env).connect(output);
            osc.start(now);
            osc.stop(now + tone.seconds);
        },
        setVolume(next) {
            gain = next;
            if (output) {
                output.gain.value = next;
            }
        },
        destroy() {
            void context?.close();
            context = null;
            output = null;
        },
    };
}
