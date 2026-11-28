import { applyOrbit } from './course/apply';
import { inSatelliteLight } from './course/decide';
import { STAGE_FIVE } from './data';
import { returnToTitle } from '../../state';

import type { StageHooks } from '../types';

const { credits } = STAGE_FIVE;

export const orbitHooks: StageHooks = {
    takeover(s, out, dt) {
        applyOrbit(s, out, dt);
        if (
            s.orbit.phase === 'parked' &&
            s.orbit.settled - 1 >= credits.closing + credits.fade
        ) {
            returnToTitle(s, out);
        }
        return true;
    },
    canJump: () => false,
    canSpray: () => false,
    focusBlocked: (s) => inSatelliteLight(s.orbit, s.p, s.orbit.z),
    closeCredits(s) {
        const t = s.orbit.settled - 1;
        if (
            s.orbit.phase === 'parked' &&
            t >= credits.from &&
            t < credits.closing
        ) {
            s.orbit = { ...s.orbit, settled: 1 + credits.closing };
        }
    },
};
