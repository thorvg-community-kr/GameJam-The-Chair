import { STAGE_FIVE } from '../../../game/stages/orbit/data';

const { credits } = STAGE_FIVE;

/** Seconds of ending time for each stage-five ending beat. */
export const ORBIT_ENDING = {
    calm: 5,
    release: 1.2,
    focusFrom: 1.5,
    focus: 5,
    signal: 5,
    signalStep: 1.4,
    disconnect: 9.6,
    handsStop: 10.2,
    idle: 13.4,
    wideFrom: 13.4,
    wide: 17,
    spinFrom: 17,
    spin: 31,
    /** The sun comes up over the limb while the camera circles. */
    dawnFrom: 19,
    dawn: 29,
    lightsOut: 33,
    dark: 37,
    end: 39,
    titleOut: 38.6,
    /** THE END has gone; the epilogue fades up from black until the tap. */
    reveal: 39.1,
    tap: 40,
    look: 41,
    shake: 42.2,
    strain: 43.6,
    drop: 44.3,
    fling: 44.85,
    drift: 45.1,
    bewildered: 46.7,
    stare: 47.9,
    hold: 50.3,
    /** The last stare cuts to the two of them as dots above the earth. */
    ultraWide: 50.3,
    /** The core owns these so closing the credits and the title return replay. */
    credits: credits.from,
    /** Closing (a skip, or the roll ending) jumps here and fades to black. */
    closing: credits.closing,
    toTitle: credits.closing + credits.fade,
};
