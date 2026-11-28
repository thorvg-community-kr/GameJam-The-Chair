import { CREDITS } from './credits-data';
import { ORBIT_ENDING } from './ending-timeline';
import { translate } from '../../../i18n';
import { LABEL_FONT, SIGN_FONT } from '../../fonts';
import { lottieSource } from '../../lottie';

import type { CreditEntry, Credits } from './credits-data';
import type { Locale } from '../../../i18n';
import type { RenderCtx } from '../../context';
import type { FontName } from '../../fonts';
import type { LayerSpec } from '../../types';

/** Heights and type sizes as fractions of the screen height. */
const GAP = 0.13;
const TITLE = { size: 0.095, height: 0.12 };
const LABEL = { size: 0.034, height: 0.052 };
const NAME = { size: 0.048, height: 0.06 };
/** `formed` is when the splash animation has finished drawing the logo. */
const LOGO = { height: 0.42, aspect: 16 / 9, formed: 6.6 };
const THANKS = { size: 0.068, height: 0.09 };
/** How fast the roll rises, in screen heights per second. */
const SPEED = 0.16;
/** Rows fade into space this far from the top and bottom of the screen. */
const FEATHER = 0.2;
/** Drawn instead of the Lottie logo when it could not be loaded. */
const POWERED_BY = 'Powered by ThorVG';

export type CreditRow =
    | {
          kind: 'text';
          /** Centre, in screen heights from the top of the roll. */
          y: number;
          text: string;
          font: FontName;
          size: number;
          color: string;
      }
    | { kind: 'logo'; y: number; height: number };
type Block = (top: number) => { rows: CreditRow[]; height: number };

const text = (
    y: number,
    value: string,
    font: FontName,
    size: number,
    color: string,
): CreditRow => ({ kind: 'text', y, text: value, font, size, color });

const line =
    (value: string, font: FontName, type: typeof TITLE, color: string): Block =>
    (top) => ({
        rows: [text(top + type.height / 2, value, font, type.size, color)],
        height: type.height,
    });

const entryBlock =
    (entry: CreditEntry, locale: Locale): Block =>
    (top) => ({
        rows: [
            text(
                top + LABEL.height / 2,
                translate(entry.label, locale),
                LABEL_FONT,
                LABEL.size,
                '#9aa6bf',
            ),
            ...entry.names.map((name, i) =>
                text(
                    top + LABEL.height + NAME.height * (i + 0.5),
                    name,
                    LABEL_FONT,
                    NAME.size,
                    '#f4ead5',
                ),
            ),
        ],
        height: LABEL.height + NAME.height * entry.names.length,
    });

const logoBlock: Block = (top) => ({
    rows: [{ kind: 'logo', y: top + LOGO.height / 2, height: LOGO.height }],
    height: LOGO.height,
});

/** Only sections with content become blocks, so an empty one leaves no gap. */
function creditBlocks(credits: Credits, locale: Locale): Block[] {
    return [
        ...credits.title.map((title) =>
            line(title, SIGN_FONT, TITLE, '#ffb347'),
        ),
        ...[...credits.roles, ...credits.assets].map((entry) =>
            entryBlock(entry, locale),
        ),
        ...(credits.engine ? [logoBlock] : []),
        ...credits.thanks.map((message) =>
            line(translate(message, locale), LABEL_FONT, THANKS, '#ffd27a'),
        ),
    ];
}

/**
 * The whole roll laid out in screen heights. Its length never depends on the
 * locale, so the roll lasts as long in every language and on every screen.
 */
export function creditRows(
    locale: Locale,
    credits: Credits = CREDITS,
): { rows: CreditRow[]; length: number } {
    const rows: CreditRow[] = [];
    let top = 0;
    creditBlocks(credits, locale).forEach((block, i) => {
        const laid = block(top + (i > 0 ? GAP : 0));
        rows.push(...laid.rows);
        top += laid.height + (i > 0 ? GAP : 0);
    });
    return { rows, length: top };
}

/** Ending seconds when the last line of the roll has left the top. */
export function creditsEnd(credits: Credits = CREDITS): number {
    const { length } = creditRows('en', credits);
    return ORBIT_ENDING.credits + (length + 1) / SPEED;
}
/** The roll's end; a beat later the presentation closes the credits. */
export const CREDITS_END = creditsEnd();
export const CREDITS_CLOSE = CREDITS_END + 1;

/**
 * Top of the roll, in screen heights from the top of the screen, as a pure
 * function of ending time: it enters from below as the credits start and
 * rises at a steady speed until its last line has left the top.
 */
export function creditsScroll(t: number, length: number): number {
    const elapsed = Math.max(0, t - ORBIT_ENDING.credits);
    return 1 - Math.min(length + 1, elapsed * SPEED);
}

/** The column the credits roll in, clear of the two specks on the left. */
export function creditsColumn(
    width: number,
    height: number,
): { left: number; right: number; centre: number; width: number } {
    const left = width * (width / height < 1.5 ? 0.5 : 0.55);
    const right = width - Math.max(12, width * 0.03);
    return { left, right, centre: (left + right) / 2, width: right - left };
}

/** The splash's ThorVG Lottie logo, screened so its black backdrop drops out. */
function drawLogo(
    ctx: RenderCtx,
    {
        layer,
        column,
        y,
        time,
    }: {
        layer: LayerSpec;
        column: ReturnType<typeof creditsColumn>;
        y: number;
        /** Seconds since the logo rose into view. */
        time: number;
    },
) {
    if (!lottieSource('thorvg-logo')) {
        const size = Math.min(
            NAME.size * ctx.H,
            (column.width * 0.94) / ctx.measureText(POWERED_BY, 1, LABEL_FONT),
        );
        ctx.withLayer(layer, () =>
            ctx.screenText(POWERED_BY, column.centre, y, size, {
                fill: '#f4ead5',
                opts: { font: LABEL_FONT },
            }),
        );
        return;
    }
    const width = Math.min(
        column.width * 0.95,
        LOGO.height * ctx.H * LOGO.aspect,
    );
    const height = width / LOGO.aspect;
    ctx.commands.push({
        kind: 'lottie',
        points: [
            [column.centre - width / 2, y - height / 2],
            [column.centre + width / 2, y + height / 2],
        ],
        lottie: {
            asset: 'thorvg-logo',
            time: Math.max(0, time),
            x: column.centre - width / 2,
            y: y - height / 2,
            width,
            height,
        },
        layer: { ...layer, key: 'orbit-credits-logo', blend: 'screen' },
    });
}

/** A gradient alpha mask over the column melts each line into space. */
function columnMask(
    ctx: RenderCtx,
    column: ReturnType<typeof creditsColumn>,
): LayerSpec {
    const opaque = (alpha: number) => ctx.rgba('#ffffff', alpha);
    return {
        key: 'orbit-credits',
        holdsText: true,
        mask: {
            kind: 'path',
            points: [
                [column.left - ctx.W * 0.02, 0],
                [ctx.W, 0],
                [ctx.W, ctx.H],
                [column.left - ctx.W * 0.02, ctx.H],
            ],
            fill: {
                from: [column.centre, 0],
                to: [column.centre, ctx.H],
                stops: [
                    [0, opaque(0)],
                    [FEATHER, opaque(1)],
                    [1 - FEATHER, opaque(1)],
                    [1, opaque(0)],
                ],
            },
        },
    };
}

export function drawCredits(
    ctx: RenderCtx,
    t: number,
    credits: Credits = CREDITS,
): void {
    if (t < ORBIT_ENDING.credits || t >= creditsEnd(credits)) {
        return;
    }
    const { rows, length } = creditRows(ctx.locale, credits);
    const top = creditsScroll(t, length);
    const column = creditsColumn(ctx.W, ctx.H);
    const layer = columnMask(ctx, column);
    for (const row of rows) {
        const y = (top + row.y) * ctx.H;
        const half = (row.kind === 'logo' ? row.height : 0.1) * ctx.H;
        if (y + half < 0 || y - half > ctx.H) {
            continue;
        }
        if (row.kind === 'logo') {
            // The animation starts as the logo rises into view and has
            // drawn the whole logo by the time it reaches the middle.
            const risen =
                ORBIT_ENDING.credits + (row.y - row.height / 2) / SPEED;
            const middle = (0.5 + row.height / 2) / SPEED;
            drawLogo(ctx, {
                layer,
                column,
                y,
                time: ((t - risen) * LOGO.formed) / middle,
            });
            continue;
        }
        const fit =
            (column.width * 0.94) / ctx.measureText(row.text, 1, row.font);
        const size = Math.max(8, Math.min(row.size * ctx.H, fit));
        ctx.withLayer(layer, () =>
            ctx.screenText(row.text, column.centre, y, size, {
                fill: row.color,
                opts: { font: row.font },
            }),
        );
    }
}
