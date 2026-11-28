import type { Message } from '../../../i18n';

/** A translated role or source label and the names under it, as written. */
export type CreditEntry = { label: Message; names: readonly string[] };

/** The end credits, top to bottom. Empty sections are left out of the roll. */
export type Credits = {
    /** Title lines, such as the game's name. */
    title: readonly string[];
    /** The people who made the game. */
    roles: readonly CreditEntry[];
    /** Music, sound effects and fonts, with their licences. */
    assets: readonly CreditEntry[];
    /** The game engine: the ThorVG logo animation. */
    engine: boolean;
    /** Closing lines. */
    thanks: readonly Message[];
};

/**
 * Fill these in to add credits; the roll lengthens and the credits end later
 * on their own. Labels and thanks are i18n messages; names stay as written.
 */
export const CREDITS: Credits = {
    title: [],
    roles: [],
    assets: [],
    engine: true,
    thanks: [],
};
