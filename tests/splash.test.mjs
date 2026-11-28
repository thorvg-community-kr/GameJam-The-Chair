import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled, load } from './support/load.mjs';

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

const makeEvent = (init) => ({
    repeat: false,
    ...init,
    prevented: false,
    preventDefault() {
        this.prevented = true;
    },
    stopPropagation() {},
});

class FakeElement {
    constructor() {
        this.attributes = new Map();
        this.dataset = {};
        this.children = [];
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
    focus() {}
}

// The splash listens on the window, so focus never has to stay on it.
const fakeWindow = {
    listeners: [],
    addEventListener(name, listener, options = {}) {
        const entry = { name, listener };
        this.listeners.push(entry);
        options.signal?.addEventListener('abort', () => {
            this.listeners = this.listeners.filter((item) => item !== entry);
        });
    },
    fire(name, init = {}) {
        const event = makeEvent(init);
        for (const entry of this.listeners.filter(
            (item) => item.name === name,
        )) {
            entry.listener(event);
        }
        return event;
    },
};

let frames = [];
for (const [key, value] of Object.entries({
    __fakeTvg: fakeTvg,
    window: fakeWindow,
    document: { createElement: () => new FakeElement() },
    requestAnimationFrame: (callback) => frames.push(callback),
    cancelAnimationFrame: () => {},
})) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
}

async function openSplash(locale = 'en') {
    frames = [];
    const scene = new FakeElement();
    const classes = new Set();
    const root = {
        classList: {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
        },
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
    return { scene, screen, classes, finished, runUntil };
}

test('the splash goes straight to the title when the logo ends', async () => {
    const { scene, finished, runUntil } = await openSplash();
    runUntil(SPLASH_DURATION - 0.5);
    assert.deepEqual(finished, []);
    runUntil(SPLASH_DURATION + 0.5);
    assert.deepEqual(finished, [true]);
    assert.equal(scene.children.length, 0);
    assert.equal(fakeWindow.listeners.length, 0, 'window listeners removed');
    fakeWindow.fire('click');
    assert.deepEqual(finished, [true], 'finishes once');
});

test('a click anywhere skips the splash inside that gesture', async () => {
    const { screen, finished, runUntil } = await openSplash();
    assert.equal(screen.getAttribute('aria-label'), 'Skip ThorVG splash');
    runUntil(1);
    fakeWindow.fire('click');
    assert.deepEqual(finished, [true]);
});

test('a key pressed while focus is elsewhere still skips', async () => {
    const { finished, runUntil } = await openSplash();
    runUntil(1);
    const event = fakeWindow.fire('keydown', {
        key: 'a',
        target: { tagName: 'BODY' },
    });
    assert.equal(event.prevented, true);
    assert.deepEqual(finished, [true]);
});

test('modifiers, tab and held keys do not skip, escape does', async () => {
    const { screen, finished, runUntil } = await openSplash('ko');
    assert.equal(
        screen.getAttribute('aria-label'),
        'ThorVG 시작 화면 건너뛰기',
    );
    runUntil(1);
    fakeWindow.fire('keydown', { key: 'Shift' });
    fakeWindow.fire('keydown', { key: 'Tab' });
    fakeWindow.fire('keydown', { key: 'a', repeat: true });
    assert.deepEqual(finished, []);
    fakeWindow.fire('keydown', { key: 'Escape' });
    assert.deepEqual(finished, [true]);
});
