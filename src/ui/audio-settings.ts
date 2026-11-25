export type AudioChannel = 'master' | 'bgm' | 'sfx';
export type AudioSettings = Record<AudioChannel, number>;

export const AUDIO_CHANNELS: readonly AudioChannel[] = ['master', 'bgm', 'sfx'];
export const AUDIO_SETTINGS_KEY = 'the-chair-audio';
export const DEFAULT_AUDIO: Readonly<AudioSettings> = Object.freeze({
    master: 1,
    bgm: 1,
    sfx: 1,
});

const level = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : fallback;

export function parseAudioSettings(raw: string | null): AudioSettings {
    let saved: unknown = null;
    try {
        saved = JSON.parse(raw ?? 'null');
    } catch {}
    const values =
        saved && typeof saved === 'object'
            ? (saved as Record<string, unknown>)
            : {};
    return {
        master: level(values.master, DEFAULT_AUDIO.master),
        bgm: level(values.bgm, DEFAULT_AUDIO.bgm),
        sfx: level(values.sfx, DEFAULT_AUDIO.sfx),
    };
}

export function loadAudioSettings(): AudioSettings {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    } catch {}
    return parseAudioSettings(raw);
}

export function saveAudioSettings(settings: AudioSettings): void {
    try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
}

export const bgmGain = (settings: AudioSettings): number =>
    settings.master * settings.bgm;

export const sfxGain = (settings: AudioSettings): number =>
    settings.master * settings.sfx;
