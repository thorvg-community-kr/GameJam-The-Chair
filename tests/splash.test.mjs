import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled, load } from './support/load.mjs';

const { gatePose, GATE_HOP } = await load('src/ui/splash-gate.ts');
const { SPLASH_DURATION } = await load('src/ui/splash-meta.ts');

// Every ThorVG call is chainable and recorded nowhere: the gate logic is
// what is under test, not the drawing.
function chainable() {
    const target = { picture: null };
    const proxy = new Proxy(target, {
        get(object, key) {
            if (key === 'then') {
                return undefined;
            }
            if (key in object) {
                return object[key];
            }
            return () => proxy;
        },
    });
    target.picture = proxy;
    return proxy;
}
const fakeTvg = new Proxy(
    {},
    {
        get(_, key) {
            if (key === 'then') {
                return undefined;
            }
            return function Fake() {
                return chainable();
            };
        },
    },
);
const stubs = {
    name: 'splash-stubs',
    setup(build) {
        build.onResolve({ filter: /render\/thorvg$/ }, () => ({
            path: 'thorvg',
            namespace: 'stub',
        }));
        build.onResolve({ filter: /\?raw$/ }, () => ({
            path: 'raw',
            namespace: 'stub',
        }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
            contents:
                args.path === 'thorvg'
                    ? 'export const loadThorvg = async () => globalThis.__fakeTvg;'
                    : 'export default "{}";',
            loader: 'js',
        }));
    },
};
const { showStartupSplash } = await bundled({
    entryPoints: ['src/ui/splash.ts'],
    plugins: [stubs],
});

class FakeElement {
    constructor() {
        this.attributes = new Map();
        this.dataset = {};
        this.children = [];
        this.listeners = new Map();
        this.parent = null;
    }
    setAttribute(name, value) {
        this.attributes.set(name, value);
    }
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }
    append(child) {
        child.parent = this;
        this.children.push(child);
    }
    remove() {
        if (this.parent) {
            this.parent.children = this.parent.children.filter(
                (child) => child !== this,
            );
            this.parent = null;
        }
    }
    addEventListener(name, listener) {
        this.listeners.set(name, listener);
    }
    dispatch(name, init = {}) {
        const event = {
            repeat: false,
            ...init,
            prevented: false,
            preventDefault() {
                this.prevented = true;
            },
            stopPropagation() {},
        };
        this.listeners.get(name)?.(event);
        return event;
    }
    focus() {}
}

let frames = [];
for (const [key, value] of Object.entries({
    __fakeTvg: fakeTvg,
    document: { createElement: () => new FakeElement() },
    requestAnimationFrame: (callback) => frames.push(callback),
    cancelAnimationFrame: () => {},
})) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
}

async function openSplash(locale = 'en') {
    frames = [];
    const scene = new FakeElement();
    const root = {
        querySelector: (selector) => (selector === '.scene' ? scene : null),
    };
    const finished = [];
    showStartupSplash(
        root,
        () => locale,
        () => finished.push(true),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(frames.length, 1, 'the splash animation started');
    const [screen] = scene.children;
    const runUntil = (seconds) => {
        for (let ms = 0; ms <= seconds * 1000; ms += 100) {
            const pending = frames;
            frames = [];
            for (const callback of pending) {
                callback(ms);
            }
        }
    };
    return { scene, screen, finished, runUntil };
}

test('the splash waits for a press instead of reaching the title silently', async () => {
    const { scene, screen, finished, runUntil } = await openSplash();
    runUntil(SPLASH_DURATION - 0.5);
    assert.equal('waiting' in screen.dataset, false);
    runUntil(SPLASH_DURATION + 5);
    assert.equal('waiting' in screen.dataset, true);
    assert.equal(screen.getAttribute('aria-label'), 'Press any key to start');
    assert.deepEqual(finished, [], 'no gesture, no title');

    screen.dispatch('click');
    assert.deepEqual(finished, [true]);
    assert.equal(scene.children.length, 0);
    screen.dispatch('click');
    assert.deepEqual(finished, [true], 'finishes once');
});

test('skipping the splash early finishes inside the same gesture', async () => {
    const { screen, finished, runUntil } = await openSplash();
    runUntil(1);
    const event = screen.dispatch('keydown', { key: 'Enter' });
    assert.equal(event.prevented, true);
    assert.deepEqual(finished, [true]);
});

test('escape and modifiers cannot unlock audio, so they only reach the gate', async () => {
    const { screen, finished, runUntil } = await openSplash('ko');
    runUntil(2);
    screen.dispatch('keydown', { key: 'Escape' });
    screen.dispatch('keydown', { key: 'Shift' });
    screen.dispatch('keydown', { key: 'Tab' });
    assert.deepEqual(finished, []);
    assert.equal('waiting' in screen.dataset, true);
    assert.equal(screen.getAttribute('aria-label'), '아무 키나 눌러 시작');

    screen.dispatch('keydown', { key: 'a', repeat: true });
    assert.deepEqual(finished, [], 'held keys do not count');
    screen.dispatch('keydown', { key: 'a' });
    assert.deepEqual(finished, [true]);
});

test('the waiting chair hops, presses the key and spins every third hop', () => {
    assert.equal(gatePose(0).alpha, 0);
    assert.equal(gatePose(1).alpha, 1);
    const air = gatePose(GATE_HOP * 0.35);
    assert.ok(air.lift > 30 && air.press === 0);
    assert.equal(air.ripple, 0, 'no ripple before the first landing');
    const landing = gatePose(GATE_HOP * 0.85);
    assert.equal(landing.lift, 0);
    assert.ok(landing.press > 5 && landing.squashY < 1);
    assert.ok(landing.ripple > 0 && landing.ripple < 1);

    const swivels = (hop) =>
        Array.from({ length: 20 }, (_, i) =>
            gatePose(GATE_HOP * (hop + i / 20)),
        ).map((pose) => pose.swivel);
    assert.ok(swivels(0).every((value) => value === 1));
    assert.ok(swivels(1).every((value) => value === 1));
    assert.ok(Math.min(...swivels(2)) < -0.9, 'the third hop spins');
});
