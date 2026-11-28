import binRattleUrl from '../../assets/sound/bin-rattle.wav?url';
import birdCallUrl from '../../assets/sound/bird-call.wav?url';
import birdUrl from '../../assets/sound/bird.wav?url';
import chairLandUrl from '../../assets/sound/chair-land.wav?url';
import chairSqueakUrl from '../../assets/sound/chair-squeak.wav?url';
import checkpointUrl from '../../assets/sound/checkpoint.wav?url';
import clickUrl from '../../assets/sound/click.wav?url';
import copierUrl from '../../assets/sound/copier.wav?url';
import doorCloseUrl from '../../assets/sound/door-close.wav?url';
import doorSlideUrl from '../../assets/sound/door-slide.wav?url';
import gasLoopUrl from '../../assets/sound/gas-loop.wav?url';
import gearShiftUrl from '../../assets/sound/gear-shift.wav?url';
import impactUrl from '../../assets/sound/impact.wav?url';
import launchKickUrl from '../../assets/sound/launch-kick.wav?url';
import launchWindupUrl from '../../assets/sound/launch-windup.wav?url';
import liftArriveUrl from '../../assets/sound/lift-arrive.wav?url';
import liftLoopUrl from '../../assets/sound/lift-loop.wav?url';
import metalRattleUrl from '../../assets/sound/metal-rattle.wav?url';
import paperUrl from '../../assets/sound/paper.wav?url';
import satelliteAlertUrl from '../../assets/sound/satellite-alert.wav?url';
import scanLoopUrl from '../../assets/sound/scan-loop.wav?url';
import shutterUrl from '../../assets/sound/shutter.wav?url';
import splashUrl from '../../assets/sound/splash.wav?url';
import typingShortUrl from '../../assets/sound/typing-short.wav?url';
import typingUrl from '../../assets/sound/typing.wav?url';
import uiConfirmUrl from '../../assets/sound/ui-confirm.wav?url';
import uiErrorUrl from '../../assets/sound/ui-error.wav?url';
import uiTapUrl from '../../assets/sound/ui-tap.wav?url';
import ventLoopUrl from '../../assets/sound/vent-loop.wav?url';
import wheelLoopUrl from '../../assets/sound/wheel-loop.wav?url';
import windUrl from '../../assets/sound/wind.wav?url';
import woodCreakUrl from '../../assets/sound/wood-creak.wav?url';

import type { LoopName } from '../presentation/audio-types';
import type { SfxName } from '../presentation/sfx';

export type AudioName = SfxName | LoopName;
export const SAMPLES = new Map<AudioName, { url: string; seconds: number }>([
    ['copier', { url: copierUrl, seconds: 0.7 }],
    ['paper', { url: paperUrl, seconds: 0.35 }],
    ['splash', { url: splashUrl, seconds: 0.6 }],
    ['land', { url: chairLandUrl, seconds: 0.45 }],
    ['squeak', { url: chairSqueakUrl, seconds: 0.7 }],
    ['click', { url: clickUrl, seconds: 0.32 }],
    ['wind', { url: windUrl, seconds: 1.25 }],
    ['bird', { url: birdUrl, seconds: 0.85 }],
    ['typing', { url: typingUrl, seconds: 1.4 }],
    ['openingTyping', { url: typingShortUrl, seconds: 0.65 }],
    ['doorClose', { url: doorCloseUrl, seconds: 0.6 }],
    ['doorOpen', { url: doorSlideUrl, seconds: 0.6 }],
    ['bonk', { url: impactUrl, seconds: 0.28 }],
    ['thud', { url: impactUrl, seconds: 0.28 }],
    ['checkpoint', { url: checkpointUrl, seconds: 0.298 }],
    ['fail', { url: uiErrorUrl, seconds: 0.33 }],
    ['uiError', { url: uiErrorUrl, seconds: 0.33 }],
    ['liftArrival', { url: liftArriveUrl, seconds: 1.3 }],
    ['birdCall', { url: birdCallUrl, seconds: 0.43 }],
    ['shutter', { url: shutterUrl, seconds: 0.24 }],
    ['sprayLever', { url: clickUrl, seconds: 0.32 }],
    ['spray', { url: clickUrl, seconds: 0.32 }],
    ['woodCreak', { url: woodCreakUrl, seconds: 0.5 }],
    ['metalRattle', { url: metalRattleUrl, seconds: 0.45 }],
    ['launchWindup', { url: launchWindupUrl, seconds: 0.8 }],
    ['launchKick', { url: launchKickUrl, seconds: 0.35 }],
    ['satelliteAlert', { url: satelliteAlertUrl, seconds: 0.27 }],
    ['gearShift', { url: gearShiftUrl, seconds: 0.45 }],
    ['uiTap', { url: uiTapUrl, seconds: 0.06 }],
    ['uiConfirm', { url: uiConfirmUrl, seconds: 0.18 }],
    ['ventBlow', { url: windUrl, seconds: 1.25 }],
    ['crash', { url: binRattleUrl, seconds: 0.65 }],
    ['gasLoop', { url: gasLoopUrl, seconds: 0.92 }],
    ['ventMotor', { url: ventLoopUrl, seconds: 0.92 }],
    ['liftMotor', { url: liftLoopUrl, seconds: 0.92 }],
    ['satelliteScan', { url: scanLoopUrl, seconds: 0.92 }],
    ['wheelLoop', { url: wheelLoopUrl, seconds: 1.5 }],
]);
