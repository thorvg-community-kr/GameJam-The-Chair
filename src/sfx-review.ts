import bird from '../assets/sound/bird.wav?url';
import land from '../assets/sound/chair-land.wav?url';
import squeak from '../assets/sound/chair-squeak.wav?url';
import click from '../assets/sound/click.wav?url';
import copier from '../assets/sound/copier.wav?url';
import edits from '../assets/sound/edits.json';
import paper from '../assets/sound/paper.wav?url';
import birdSource from '../assets/sound/source/bird.mp3?url';
import chairSource from '../assets/sound/source/chair.mp3?url';
import clickSource from '../assets/sound/source/click.mp3?url';
import copierSource from '../assets/sound/source/copier.mp3?url';
import paperSource from '../assets/sound/source/paper.mp3?url';
import waterSource from '../assets/sound/source/water.mp3?url';
import windSource from '../assets/sound/source/wind.mp3?url';
import splash from '../assets/sound/splash.wav?url';
import wind from '../assets/sound/wind.wav?url';

const sources: Record<string, string> = {
    bird: birdSource,
    chair: chairSource,
    click: clickSource,
    copier: copierSource,
    paper: paperSource,
    water: waterSource,
    wind: windSource,
};
const effects: Record<string, { url: string; label: string }> = {
    bird: { url: bird, label: 'Bird collision / 새 충돌' },
    'chair-land': { url: land, label: 'Chair landing / 의자 착지' },
    'chair-squeak': { url: squeak, label: 'Chair slip / 의자 미끄러짐' },
    click: { url: click, label: 'Pickup · docking / 획득 · 도킹' },
    copier: { url: copier, label: 'Copier / 복사기' },
    paper: { url: paper, label: 'Paper impact / 종이 피격' },
    splash: { url: splash, label: 'Spilled water / 물 쏟기' },
    wind: { url: wind, label: 'Sky gust / 하늘 돌풍' },
};
let context: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let current: HTMLAudioElement | null = null;
let request = 0;
const buffers = new Map<string, AudioBuffer>();
const status = document.querySelector('#status');
const table = document.querySelector('#clips');

for (const clip of edits) {
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = effects[clip.id].label;
    const raw = document.createElement('td');
    const button = document.createElement('button');
    button.textContent = `${clip.start.toFixed(2)}–${clip.end.toFixed(2)}s ▶`;
    button.addEventListener('click', () => {
        void playOriginal().catch(() => {
            if (status) {
                status.textContent = 'Playback failed / 재생 실패';
            }
        });
    });
    async function playOriginal() {
        const id = ++request;
        current?.pause();
        playing?.stop();
        playing = null;
        context ??= new AudioContext();
        await context.resume();
        const url = sources[clip.source];
        let buffer = buffers.get(url);
        if (!buffer) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Source unavailable');
            }
            buffer = await context.decodeAudioData(
                await response.arrayBuffer(),
            );
            buffers.set(url, buffer);
        }
        if (id !== request) {
            return;
        }
        const voice = context.createBufferSource();
        voice.buffer = buffer;
        voice.connect(context.destination);
        voice.onended = () => {
            voice.disconnect();
            if (playing === voice) {
                playing = null;
            }
        };
        playing = voice;
        voice.start(0, clip.start, clip.end - clip.start);
        if (status) {
            status.textContent = `${effects[clip.id].label} · Original / 原音`;
        }
    }
    raw.append(button);
    const edited = document.createElement('td');
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = effects[clip.id].url;
    audio.setAttribute('aria-label', effects[clip.id].label);
    audio.addEventListener('play', () => {
        request++;
        playing?.stop();
        playing = null;
        if (current !== audio) {
            current?.pause();
        }
        current = audio;
        if (status) {
            status.textContent = `${effects[clip.id].label} · Edited / 편집본`;
        }
    });
    edited.append(audio);
    row.append(label, raw, edited);
    table?.append(row);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        request++;
        playing?.stop();
        playing = null;
        current?.pause();
    }
});
