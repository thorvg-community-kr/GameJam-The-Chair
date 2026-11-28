import endingUrl from '../../assets/bgm/ending.m4a?url';
import stage12Url from '../../assets/bgm/stage1-2.m4a?url';
import stage3Url from '../../assets/bgm/stage3.m4a?url';
import stage4Url from '../../assets/bgm/stage4.m4a?url';
import stage5Url from '../../assets/bgm/stage5.m4a?url';
import startUrl from '../../assets/bgm/start.m4a?url';
import { MUSIC_FADE } from '../presentation/music';

import type { MusicDuck, MusicTrack } from '../presentation/music';

const TRACK_URLS: Record<MusicTrack, string> = {
    start: startUrl,
    'stage1-2': stage12Url,
    stage3: stage3Url,
    stage4: stage4Url,
    stage5: stage5Url,
    ending: endingUrl,
};
const VOLUME = 0.55;
const DUCK_LEVELS: Record<MusicDuck, number> = {
    none: VOLUME,
    pause: 0.18,
    death: 0.08,
};
const FADE_SECONDS = MUSIC_FADE;
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export type Music = {
    play(track: MusicTrack | null, duck?: MusicDuck): void;
    advance(dt: number): void;
    setVolume(gain: number): void;
    destroy(): void;
};

function createVoice(track: MusicTrack): HTMLAudioElement {
    const audio = new Audio(TRACK_URLS[track]);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    return audio;
}

export function createMusic(initialGain = 1): Music {
    const voices = new Map<MusicTrack, HTMLAudioElement>();
    const levels = new Map<MusicTrack, number>();
    let gain = initialGain;
    let current: MusicTrack | null = null;
    let target = VOLUME;
    let unlocked = false;

    const voice = (track: MusicTrack) => {
        let audio = voices.get(track);
        if (!audio) {
            audio = createVoice(track);
            voices.set(track, audio);
            levels.set(track, 0);
        }
        return audio;
    };
    const start = (audio: HTMLAudioElement) => {
        if (document.hidden || !audio.paused) {
            return;
        }
        audio.play().then(
            () => {
                unlocked = true;
            },
            () => {},
        );
    };
    const unlock = () => {
        if (current) {
            start(voice(current));
        }
        if (unlocked) {
            for (const name of UNLOCK_EVENTS) {
                window.removeEventListener(name, unlock, true);
            }
        }
    };
    const onVisibility = () => {
        for (const audio of voices.values()) {
            if (document.hidden) {
                audio.pause();
            }
        }
        if (!document.hidden && current) {
            start(voice(current));
        }
    };
    for (const name of UNLOCK_EVENTS) {
        window.addEventListener(name, unlock, true);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return {
        play(track, duck = 'none') {
            target = DUCK_LEVELS[duck];
            if (track === current) {
                return;
            }
            current = track;
            if (!track) {
                return;
            }
            const audio = voice(track);
            audio.currentTime = 0;
            start(audio);
        },
        advance(dt) {
            const step = (VOLUME * Math.min(dt, 0.1)) / FADE_SECONDS;
            for (const [track, audio] of voices) {
                // A track the browser has not let start yet stays at zero so
                // it fades in once the first input unlocks it.
                const goal = track === current && !audio.paused ? target : 0;
                const previous = levels.get(track) ?? 0;
                const delta = Math.max(-step, Math.min(step, goal - previous));
                const next = Math.max(0, Math.min(1, previous + delta));
                levels.set(track, next);
                audio.volume = Math.min(1, next * gain);
                if (goal === 0 && next === 0 && !audio.paused) {
                    audio.pause();
                }
            }
        },
        setVolume(next) {
            gain = Math.max(0, Math.min(1, next));
            for (const [track, audio] of voices) {
                audio.volume = Math.min(1, (levels.get(track) ?? 0) * gain);
            }
        },
        destroy() {
            for (const name of UNLOCK_EVENTS) {
                window.removeEventListener(name, unlock, true);
            }
            document.removeEventListener('visibilitychange', onVisibility);
            for (const audio of voices.values()) {
                audio.pause();
                audio.removeAttribute('src');
            }
            voices.clear();
            levels.clear();
        },
    };
}
