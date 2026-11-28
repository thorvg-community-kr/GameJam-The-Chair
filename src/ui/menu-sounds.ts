import type { Sfx } from './sfx';

export function bindMenuSounds(root: HTMLElement, sfx: Sfx): () => void {
    const controller = new AbortController();
    const { signal } = controller;
    root.addEventListener(
        'click',
        (event) => {
            if (!(event.target instanceof Element)) {
                return;
            }
            const button = event.target.closest('button, summary');
            if (
                !button ||
                button.closest('.drive-controls') ||
                button.hasAttribute('disabled')
            ) {
                return;
            }
            const confirm = button.matches(
                '[data-start], [data-resume], [data-stage], [data-locale]',
            );
            sfx.unlock();
            sfx.play(confirm ? 'uiConfirm' : 'uiTap', undefined, {
                gain: 0.65,
                channel: 'ui',
            });
        },
        { signal },
    );
    root.addEventListener(
        'change',
        (event) => {
            if (
                event.target instanceof HTMLInputElement &&
                event.target.matches('[data-volume]')
            ) {
                sfx.unlock();
                sfx.play('uiTap', undefined, { gain: 0.5, channel: 'ui' });
            }
        },
        { signal },
    );
    return () => controller.abort();
}
