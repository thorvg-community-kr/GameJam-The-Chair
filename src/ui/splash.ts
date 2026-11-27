import { createGateCue } from './splash-gate';
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
    draw: (seconds: number, gate?: number | null) => void;
    destroy(): void;
} {
    let canvas: Canvas | null = null;
    let animation: Animation | null = null;
    let cue: ((seconds: number | null) => void) | null = null;
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
            cue = createGateCue(TVG, nextCanvas, picture);
            animation = nextAnimation;
            canvas = nextCanvas;
            draw(0);
        } catch (error) {
            nextAnimation.dispose();
            throw error;
        }
    })();

    function draw(seconds: number, gate: number | null = null) {
        if (!animation || !canvas) {
            return;
        }
        animation.seek(
            Math.max(0, Math.min(SPLASH_DURATION - 1 / 30, seconds)),
        );
        cue?.(gate);
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
            cue = null;
        },
    };
}

// Keys that do not count as a user activation for autoplay, or are modifiers.
const INERT_KEYS = new Set([
    'Escape',
    'Tab',
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'Fn',
]);

// Listens on the whole window so a tap outside the splash or a key pressed
// after focus moved away still continues.
function bindGateInput(onPress: () => void, onEscape: () => void): () => void {
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    window.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Tab' || event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
            if (event.key === 'Escape') {
                onEscape();
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

// Any click, tap or key ends the splash inside that gesture, so `onFinish`
// may start audio. Left alone, the splash waits on a clicking-key cue instead
// of reaching the title silently.
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
    let elapsed = 0;
    let gateAt: number | null = null;
    let frameId = 0;
    let closed = false;
    const openGate = () => {
        if (gateAt !== null) {
            return;
        }
        gateAt = Math.min(elapsed, SPLASH_DURATION);
        screen.dataset.waiting = '';
        screen.setAttribute(
            'aria-label',
            translate('splash.gate', getLocale()),
        );
    };
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
    const unbind = bindGateInput(finish, openGate);
    root.classList.add('splashing');
    screen.focus();
    function tick(ms: number) {
        if (closed) {
            return;
        }
        started ??= ms;
        elapsed = (ms - started) / 1000;
        if (elapsed >= SPLASH_DURATION) {
            openGate();
        }
        player.draw(
            gateAt === null ? elapsed : SPLASH_DURATION,
            gateAt === null ? null : elapsed - gateAt,
        );
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
