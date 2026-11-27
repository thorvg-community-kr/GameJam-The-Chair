import { SPLASH_DURATION } from './splash-meta';
import splashData from '../../assets/powred.by.thorvg.1.json?raw';
import { translate } from '../i18n';
import { loadThorvg } from '../render/thorvg';

import type { Locale } from '../i18n';
import type { Animation, Canvas } from '@thorvg/webcanvas';

const WIDTH = 960;
const HEIGHT = 540;

export function createSplashPlayer(element: HTMLCanvasElement): {
    ready: Promise<void>;
    draw: (seconds: number) => void;
    destroy(): void;
} {
    let canvas: Canvas | null = null;
    let animation: Animation | null = null;
    const lifecycle = { disposed: false };
    const ready = (async () => {
        const TVG = await loadThorvg();
        if (lifecycle.disposed) {
            return;
        }
        const nextAnimation = new TVG.Animation();
        try {
            nextAnimation.load(splashData);
            const picture = nextAnimation.picture;
            if (!picture) {
                throw new Error('Splash picture is unavailable.');
            }
            picture.size(WIDTH, HEIGHT);
            const nextCanvas = new TVG.Canvas(element, {
                width: WIDTH,
                height: HEIGHT,
            });
            nextCanvas.add(picture);
            animation = nextAnimation;
            canvas = nextCanvas;
            draw(0);
        } catch (error) {
            nextAnimation.dispose();
            throw error;
        }
    })();

    function draw(seconds: number) {
        if (!animation || !canvas) {
            return;
        }
        animation.seek(
            Math.max(0, Math.min(SPLASH_DURATION - 1 / 30, seconds)),
        );
        canvas.update().render();
    }

    return {
        ready,
        draw,
        destroy() {
            lifecycle.disposed = true;
            canvas?.destroy();
            animation?.dispose();
            canvas = null;
            animation = null;
        },
    };
}

const INERT_KEYS = new Set([
    'Tab',
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'Fn',
]);

// Listens on the whole window so a tap outside the splash or a key pressed
// after focus moved away still skips it.
function bindSkipInput(onPress: () => void): () => void {
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    window.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
            }
            if (INERT_KEYS.has(event.key) || event.repeat) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onPress();
        },
        options,
    );
    window.addEventListener('click', onPress, options);
    // Ending on touchend keeps iOS happy and swallows the ghost click that
    // would otherwise land on the title underneath.
    window.addEventListener(
        'touchend',
        (event) => {
            event.preventDefault();
            onPress();
        },
        { ...options, passive: false },
    );
    return () => listeners.abort();
}

// Plays the ThorVG logo, then goes straight to the title. A click, tap or key
// skips it early; `onFinish` then runs inside that gesture and may start audio.
export function showStartupSplash(
    root: HTMLElement,
    getLocale: () => Locale,
    onFinish: () => void,
): () => void {
    const scene = root.querySelector<HTMLElement>('.scene');
    if (!scene) {
        throw new Error('Game scene is unavailable.');
    }
    const screen = document.createElement('div');
    screen.className = 'startup-splash';
    screen.setAttribute('role', 'button');
    screen.setAttribute('tabindex', '0');
    screen.setAttribute('aria-label', translate('splash.skip', getLocale()));
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    screen.append(canvas);
    scene.append(screen);
    const player = createSplashPlayer(canvas);
    let started: number | null = null;
    let frameId = 0;
    let closed = false;
    const finish = () => {
        if (closed) {
            return;
        }
        closed = true;
        unbind();
        root.classList.remove('splashing');
        cancelAnimationFrame(frameId);
        player.destroy();
        screen.remove();
        root.querySelector<HTMLButtonElement>('[data-start]')?.focus();
        onFinish();
    };
    const unbind = bindSkipInput(finish);
    root.classList.add('splashing');
    screen.focus();
    function tick(ms: number) {
        if (closed) {
            return;
        }
        started ??= ms;
        const elapsed = (ms - started) / 1000;
        if (elapsed >= SPLASH_DURATION) {
            return finish();
        }
        player.draw(elapsed);
        frameId = requestAnimationFrame(tick);
    }
    void player.ready
        .then(() => {
            if (!closed) {
                frameId = requestAnimationFrame(tick);
            }
        })
        .catch((error) => {
            console.error('Splash unavailable', error);
            finish();
        });
    return finish;
}
