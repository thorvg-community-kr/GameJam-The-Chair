import { capture, recordedScene, stepGame } from './recording';
import { createGame, parseState } from '../game/game';
import { STAGE_TWO } from '../game/stages/building/data';
import { STAGE_FIVE } from '../game/stages/orbit/data';
import { skyPlatforms, skySurface } from '../game/stages/sky/data';
import { createEffects } from '../render/effects';

import type { PreviewScene } from './types';

export function liftArrivalAudio(): PreviewScene {
    const game = createGame();
    game.startStage(2);
    const state = parseState(game.serialize());
    state.p.x = STAGE_TWO.lift - 250;
    state.p.y = 392;
    state.ground = true;
    game.restore(JSON.stringify(state));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 210; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(
        'lift-arrival-audio',
        'Building · Lift motor, bell and doors',
        STAGE_TWO.lift - 120,
        [
            { at: 0.1, label: 'Motor' },
            { at: 1.2, label: 'Arrival bell and doors' },
        ],
        frames,
    );
}

export function orbitPhoto(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const state = parseState(game.serialize());
    const beams = STAGE_FIVE.satelliteLight.beams;
    state.orbit.phase = 'door';
    state.orbit.z = beams[beams.length - 1].from - 70;
    state.orbit.speed = 300;
    state.orbit.age = state.time = 70;
    state.orbit.aims = beams.map((_, index) =>
        index === beams.length - 1 ? { x: 0, y: 0 } : { x: 500, y: 500 },
    );
    Object.assign(state.p, { x: 0, y: 0, vx: 0, vy: 0 });
    game.restore(JSON.stringify(state));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers: Array<{ at: number; label: string }> = [];
    let frozen = false;
    for (let i = 0; i < 180; i++) {
        stepGame(game, effects);
        const frame = capture(game, effects);
        frames.push(frame);
        const freeze = frame.state.orbit?.freeze ?? 0;
        if (freeze > 0 && !frozen) {
            markers.push({
                at: (i + 1) / 60,
                label: 'Photograph · flash and shutter',
            });
            frozen = true;
        }
    }
    return recordedScene(
        'orbit-photo',
        'Orbit · Final photograph and shutter',
        0,
        markers,
        frames,
    );
}

export function skySurfaceAudio(): PreviewScene {
    const game = createGame();
    game.startStage(4);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    return {
        id: 'sky-surface-audio',
        label: 'Sky · Wooden desk and metal sign landings',
        duration: 5,
        focusX: 3900,
        markers: [
            { at: 0.6, label: 'Wooden desk landing' },
            { at: 2.8, label: 'Metal sign landing' },
        ],
        sample(time) {
            const onDesk = time >= 0.6 && time < 2;
            const onSign = time >= 2.8;
            const sky = {
                ...base.sky,
                phase: 'course' as const,
                standing: onDesk ? 'rest' : onSign ? 'wind-sign' : null,
                lift: 1,
            };
            const platform = skyPlatforms(sky, time).find(
                (item) => item.id === (time < 2 ? 'rest' : 'wind-sign'),
            )!;
            const x = platform.x + platform.width / 2;
            const y = skySurface(platform, x) - (onDesk || onSign ? 28 : 100);
            return {
                state: {
                    ...base,
                    time,
                    sky,
                    ground: onDesk || onSign,
                    player: { ...base.player, x, y },
                },
                effects,
            };
        },
    };
}
