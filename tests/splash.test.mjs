import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled, load } from './support/load.mjs';

const { gatePose, GATE_TAP, GATE_IMPATIENT } = await load(
    'src/ui/splash-gate.ts',
);
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

test('the splash waits for a press instead of reaching the title silently', async () => {
    const { scene, screen, classes, finished, runUntil } = await openSplash();
    assert.ok(classes.has('splashing'), 'touch controls are hidden');
    runUntil(SPLASH_DURATION - 0.5);
    assert.equal('waiting' in screen.dataset, false);
    runUntil(SPLASH_DURATION + 5);
    assert.equal('waiting' in screen.dataset, true);
    assert.equal(screen.getAttribute('aria-label'), 'Press any key to start');
    assert.deepEqual(finished, [], 'no gesture, no title');

    fakeWindow.fire('click');
    assert.deepEqual(finished, [true]);
    assert.equal(scene.children.length, 0);
    assert.equal(classes.has('splashing'), false);
    assert.equal(fakeWindow.listeners.length, 0, 'window listeners removed');
    fakeWindow.fire('click');
    assert.deepEqual(finished, [true], 'finishes once');
});

test('skipping the splash early finishes inside the same gesture', async () => {
    const { finished, runUntil } = await openSplash();
    runUntil(1);
    const event = fakeWindow.fire('keydown', { key: 'Enter' });
    assert.equal(event.prevented, true);
    assert.deepEqual(finished, [true]);
});

test('a key pressed while focus is elsewhere still continues', async () => {
    const { finished, runUntil } = await openSplash();
    runUntil(SPLASH_DURATION + 1);
    fakeWindow.fire('keydown', { key: 'a', target: { tagName: 'BODY' } });
    assert.deepEqual(finished, [true]);
});

test('a tap anywhere continues and swallows the ghost click', async () => {
    const { finished, runUntil } = await openSplash();
    runUntil(SPLASH_DURATION + 1);
    const event = fakeWindow.fire('touchend');
    assert.equal(event.prevented, true);
    assert.deepEqual(finished, [true]);
});

test('escape and modifiers cannot unlock audio, so they only reach the gate', async () => {
    const { screen, finished, runUntil } = await openSplash('ko');
    runUntil(2);
    fakeWindow.fire('keydown', { key: 'Escape' });
    fakeWindow.fire('keydown', { key: 'Shift' });
    fakeWindow.fire('keydown', { key: 'Tab' });
    assert.deepEqual(finished, []);
    assert.equal('waiting' in screen.dataset, true);
    assert.equal(screen.getAttribute('aria-label'), '아무 키나 눌러 시작');

    fakeWindow.fire('keydown', { key: 'a', repeat: true });
    assert.deepEqual(finished, [], 'held keys do not count');
    fakeWindow.fire('keydown', { key: 'a' });
    assert.deepEqual(finished, [true]);
});

test('the gate cursor keeps clicking a pulsing key and grows impatient', () => {
    const start = gatePose(0);
    assert.equal(start.alpha, 0);
    assert.equal(start.logo, 0);
    assert.equal(gatePose(1).logo, 1, 'the logo steps aside for the key');

    const press = gatePose(GATE_TAP * 0.75);
    assert.equal(press.press, 1);
    assert.equal(press.cursorLift, 0, 'the cursor touches the key');
    const hover = gatePose(GATE_TAP * 0.3);
    assert.equal(hover.press, 0);
    assert.ok(hover.cursorLift > 40);
    assert.equal(hover.ripple, 0, 'no ripple before the first click');
    assert.ok(gatePose(GATE_TAP * 1.1).ripple > 0, 'each click ripples');

    const pulse = (from) =>
        Math.max(
            ...Array.from(
                { length: 20 },
                (_, i) => gatePose(from + (GATE_TAP * i) / 20).pulse,
            ),
        );
    assert.ok(pulse(GATE_TAP) > 1.04);
    assert.ok(pulse(GATE_IMPATIENT + GATE_TAP) > pulse(GATE_TAP) + 0.04);

    const spins = (from) =>
        Array.from(
            { length: 20 },
            (_, i) => gatePose(from + (GATE_TAP * i) / 20).chair.swivel,
        ).some((value) => value < -0.9);
    assert.equal(gatePose(1).impatient, false);
    assert.equal(spins(0), false, 'calm hops do not spin');
    assert.equal(gatePose(GATE_IMPATIENT).impatient, true);
    assert.ok(spins(GATE_IMPATIENT), 'an impatient chair spins');
});
