import { ORBIT_ENDING } from './ending-timeline';

export type EpilogueCut =
    | 'tap'
    | 'look'
    | 'shake'
    | 'strain'
    | 'drop'
    | 'drift'
    | 'bewildered'
    | 'stare-chair'
    | 'stare-rider'
    | 'wide';
export type EpilogueBeat = {
    cut: EpilogueCut;
    /** Seconds since this cut started; negative while the first cut fades up. */
    u: number;
    /** Seconds since the epilogue started; frozen at the hold until the wide cut. */
    t: number;
    /** Index of the stare shot, so each one blinks on its own. */
    shot: number;
};
const STARES: Array<[EpilogueCut, number]> = [
    ['stare-chair', 0.8],
    ['stare-rider', 0.8],
    ['stare-chair', 0.4],
    ['stare-rider', 0.4],
];
export function epilogueBeat(ending: number): EpilogueBeat | null {
    const E = ORBIT_ENDING;
    if (ending < E.reveal) {
        return null;
    }
    if (ending >= E.ultraWide) {
        return {
            cut: 'wide',
            u: ending - E.ultraWide,
            t: ending - E.tap,
            shot: 0,
        };
    }
    const time = Math.min(ending, E.hold);
    const t = time - E.tap;
    const cuts: Array<[EpilogueCut, number]> = [
        ['tap', E.tap],
        ['look', E.look],
        ['shake', E.shake],
        ['strain', E.strain],
        ['drop', E.drop],
        ['drift', E.drift],
        ['bewildered', E.bewildered],
    ];
    if (time < E.stare) {
        const [cut, from] =
            cuts.filter(([, at]) => time >= at).at(-1) ?? cuts[0];
        return { cut, u: time - from, t, shot: 0 };
    }
    let from = E.stare;
    for (let shot = 0; shot < STARES.length; shot++) {
        const [cut, length] = STARES[shot];
        if (time < from + length || shot === STARES.length - 1) {
            return { cut, u: time - from, t, shot };
        }
        from += length;
    }
    return null;
}
