import { AUDIO_CHANNELS, saveAudioSettings } from './audio-settings';

import type { AudioChannel, AudioSettings } from './audio-settings';

export type SettingsPanel = {
    readonly open: boolean;
    close(): void;
    destroy(): void;
};

type SettingsOptions = {
    audio: AudioSettings;
    onAudio(settings: AudioSettings, changed: AudioChannel): void;
    onOpen(): void;
    onClose(): void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

function bindSliders(
    root: HTMLElement,
    audio: AudioSettings,
    onAudio: SettingsOptions['onAudio'],
    signal: AbortSignal,
) {
    const sliders = AUDIO_CHANNELS.map((channel) => ({
        channel,
        input: root.querySelector<HTMLInputElement>(
            `[data-volume="${channel}"]`,
        ),
        output: root.querySelector<HTMLOutputElement>(
            `[data-volume-value="${channel}"]`,
        ),
    }));
    const render = () => {
        for (const { channel, input, output } of sliders) {
            if (input) {
                input.value = String(Math.round(audio[channel] * 100));
                input.style.setProperty('--fill', percent(audio[channel]));
            }
            if (output) {
                output.value = percent(audio[channel]);
            }
        }
    };
    for (const { channel, input } of sliders) {
        input?.addEventListener(
            'input',
            () => {
                audio[channel] = Number(input.value) / 100;
                render();
                onAudio({ ...audio }, channel);
            },
            { signal },
        );
        input?.addEventListener(
            'change',
            () => saveAudioSettings({ ...audio }),
            { signal },
        );
    }
    render();
}

function trapFocus(panel: HTMLElement, event: KeyboardEvent) {
    const targets = [
        ...panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled])',
        ),
    ].filter((el) => el.getClientRects().length > 0);
    const first = targets.at(0);
    const last = targets.at(-1);
    const inside = panel.contains(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last?.focus();
    } else if (
        !event.shiftKey &&
        (document.activeElement === last || !inside)
    ) {
        event.preventDefault();
        first?.focus();
    }
}

export function createSettings(
    root: HTMLElement,
    options: SettingsOptions,
): SettingsPanel {
    const button = root.querySelector<HTMLButtonElement>('[data-settings]');
    const panel = root.querySelector<HTMLElement>('[data-settings-panel]');
    const controller = new AbortController();
    const listen = { signal: controller.signal };
    let isOpen = false;

    const open = () => {
        if (isOpen || !panel) {
            return;
        }
        isOpen = true;
        options.onOpen();
        panel.hidden = false;
        button?.setAttribute('aria-expanded', 'true');
        panel.querySelector<HTMLInputElement>('[data-volume]')?.focus();
    };
    const close = () => {
        if (!isOpen || !panel) {
            return;
        }
        isOpen = false;
        panel.hidden = true;
        button?.setAttribute('aria-expanded', 'false');
        options.onClose();
        if (panel.contains(document.activeElement) || !document.activeElement) {
            button?.focus();
        }
    };

    bindSliders(
        root,
        { ...options.audio },
        (next, changed) => options.onAudio(next, changed),
        controller.signal,
    );
    button?.addEventListener(
        'click',
        () => (isOpen ? close() : open()),
        listen,
    );
    root.querySelector('[data-settings-close]')?.addEventListener(
        'click',
        close,
        listen,
    );
    panel?.addEventListener(
        'click',
        (event) => {
            if (event.target === panel) {
                close();
            }
        },
        listen,
    );
    window.addEventListener(
        'keydown',
        (event) => {
            if (!isOpen || !panel) {
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                close();
            } else if (event.key === 'Tab') {
                trapFocus(panel, event);
            }
        },
        { capture: true, signal: controller.signal },
    );

    return {
        get open() {
            return isOpen;
        },
        close,
        destroy() {
            controller.abort();
        },
    };
}
