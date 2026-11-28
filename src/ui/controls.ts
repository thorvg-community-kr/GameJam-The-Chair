import { creditsSkippable } from '../presentation/credits';
import { STAGE_PRESENTATION } from '../presentation/stages';

import type { Game, GameStatus } from '../game/game';
import type { Input } from '../game/types';
export type Action =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'jump'
    | 'spray'
    | 'meeting'
    | 'pause'
    | 'restart';
type Control = {
    keys: readonly string[];
    label: string;
    when?: (status: GameStatus) => boolean;
};
export const CONTROLS: Readonly<Record<Action, Control>> = {
    up: {
        keys: ['ArrowUp', 'w'],
        label: '↑ / W',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.flight,
    },
    down: {
        keys: ['ArrowDown', 's'],
        label: '↓ / S',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.flight,
    },
    left: { keys: ['ArrowLeft'], label: '←' },
    right: { keys: ['ArrowRight'], label: '→' },
    jump: { keys: ['ArrowUp'], label: '↑' },
    spray: {
        keys: [' '],
        label: 'Space',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.spray,
    },
    meeting: {
        keys: ['ArrowDown'],
        label: '↓',
        when: (s) => STAGE_PRESENTATION[s.stage].controls.meeting,
    },
    pause: { keys: ['p', 'Escape'], label: 'P / Esc' },
    restart: { keys: ['r'], label: 'R' },
};
export const SPRAY_KEY = 'Space';
const HELD: Partial<Record<Action, Input>> = {
    up: 'forward',
    down: 'back',
    left: 'left',
    right: 'right',
    spray: 'spray',
};
const normalize = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
export function actionForKey(key: string, state: GameStatus): Action | null {
    const k = normalize(key);
    for (const [action, control] of Object.entries(CONTROLS) as Array<
        [Action, Control]
    >) {
        if (
            control.keys.includes(k) &&
            (!control.when || control.when(state))
        ) {
            return action;
        }
    }
    return null;
}
type ControlHooks = {
    accepting: (e: KeyboardEvent) => boolean;
    togglePause: () => void;
    afterRestart: () => void;
};
export function bindControls(
    root: HTMLElement,
    game: Game,
    hooks: ControlHooks,
    signal: AbortSignal,
): void {
    return new ControlBinding(root, game, hooks, signal).api();
}
class ControlBinding {
    private root!: HTMLElement;
    private game!: Game;
    private hooks!: ControlHooks;
    private signal!: AbortSignal;
    private options!: {
        signal: AbortSignal;
    };
    constructor(
        root: HTMLElement,
        game: Game,
        hooks: ControlHooks,
        signal: AbortSignal,
    ) {
        this.root = root;
        this.game = game;
        this.hooks = hooks;
        this.signal = signal;
        this.options = { signal: this.signal };
        window.addEventListener(
            'keydown',
            (e) => {
                if (!this.hooks.accepting(e)) {
                    return;
                }
                const state = this.game.status();
                const action = actionForKey(e.key, state);
                if (!action) {
                    return;
                }
                // Esc skips the credits once the skip button is up; P still pauses.
                if (
                    e.key === 'Escape' &&
                    !e.repeat &&
                    creditsSkippable(this.game.getSnapshot())
                ) {
                    e.preventDefault();
                    this.game.closeCredits();
                    return;
                }
                if (action === 'pause') {
                    if (
                        !e.repeat &&
                        (state.mode === 'play' || state.mode === 'pause')
                    ) {
                        e.preventDefault();
                        this.hooks.togglePause();
                    }
                    return;
                }
                if (action === 'restart') {
                    if (!e.repeat && state.mode !== 'intro') {
                        e.preventDefault();
                        this.game.restart();
                        this.hooks.afterRestart();
                    }
                    return;
                }
                if (state.mode !== 'play') {
                    return;
                }
                this.applyKeyboardAction(e, action);
            },
            this.options,
        );
        window.addEventListener(
            'keyup',
            (e) => {
                // Release regardless of stage so a key held across a stage change
                // never sticks.
                const k = normalize(e.key);
                for (const [action, input] of Object.entries(HELD) as Array<
                    [Action, Input]
                >) {
                    if (CONTROLS[action].keys.includes(k)) {
                        this.game.release(input);
                    }
                }
            },
            this.options,
        );
        window.addEventListener('blur', this.game.clearInput, this.options);
    }
    private applyKeyboardAction(e: KeyboardEvent, action: Action) {
        e.preventDefault();
        const held = HELD[action];
        if (held) {
            this.game.press(held);
        } else if (!e.repeat && action === 'jump') {
            this.game.jump();
        } else if (!e.repeat && action === 'meeting') {
            this.game.interact();
        }
    }
    api(): void {}
}
