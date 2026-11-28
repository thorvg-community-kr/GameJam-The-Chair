import type { Message } from '../../../i18n';

/**
 * A translated role or source label, the names under it as written, and an
 * optional licence line shown below the names.
 */
export type CreditEntry = {
    label: Message;
    names: readonly string[];
    licence?: string;
};

/** The end credits, top to bottom. */
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
 * Fill in the `names` to complete the credits; the roll lengthens and the
 * credits end later on their own. Labels and thanks are i18n messages;
 * names stay as written.
 */
export const CREDITS: Credits = {
    title: ['THE CHAIR'],
    roles: [
        { label: 'credits.role.design', names: [] },
        { label: 'credits.role.code', names: [] },
        { label: 'credits.role.art', names: [] },
        { label: 'credits.role.sound', names: [] },
    ],
    assets: [
        { label: 'credits.music', names: [] },
        { label: 'credits.sfx', names: [], licence: 'CC0' },
        { label: 'credits.fonts', names: [], licence: 'SIL OFL 1.1' },
    ],
    engine: true,
    thanks: ['credits.thanks'],
};
