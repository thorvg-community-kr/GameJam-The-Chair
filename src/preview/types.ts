import type { GameSnapshot } from '../game/game';
import type { GameEvent } from '../game/types';
import type { Locale } from '../i18n';
import type { EffectsState } from '../render/effects';
import type { OpeningFrame } from '../render/scene/opening/timeline';
import type { SceneTalk } from '../render/types';

export type PreviewScene = {
    id: string;
    label: string;
    duration: number;
    focusX: number;
    follow?: boolean;
    markers: ReadonlyArray<{ at: number; label: string }>;
    sample(time: number): PreviewFrame;
    opening?(time: number): OpeningFrame;
    talk?(time: number, locale: Locale): SceneTalk;
    title?: boolean;
};

export type PreviewFrame = {
    state: GameSnapshot;
    effects: EffectsState;
    events?: readonly GameEvent[];
};
