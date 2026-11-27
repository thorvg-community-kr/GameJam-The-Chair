export type Tone = {
    kind: 'tone';
    at?: number;
    from: number;
    to: number;
    seconds: number;
    wave: OscillatorType;
    peak?: number;
    attack?: number;
    wobble?: number;
    wobbleDepth?: number;
};

export type Noise = {
    kind: 'noise';
    at?: number;
    seconds: number;
    filter: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
    peak?: number;
    attack?: number;
};

export type Layer = Tone | Noise;

export const tone = (
    from: number,
    to: number,
    seconds: number,
    wave: OscillatorType,
    extra: Partial<Tone> = {},
): Tone => ({ kind: 'tone', from, to, seconds, wave, ...extra });

export const noise = (
    filter: BiquadFilterType,
    from: number,
    seconds: number,
    extra: Partial<Noise> = {},
): Noise => ({ kind: 'noise', filter, from, seconds, ...extra });

export const notes = (
    freqs: number[],
    step: number,
    wave: OscillatorType,
    peak = 0.16,
): Tone[] =>
    freqs.map((f, i) =>
        tone(f, f, i === freqs.length - 1 ? step * 3 : step, wave, {
            at: i * step,
            peak,
        }),
    );
