import type { Canvas, Scene, Shape } from '@thorvg/webcanvas';

type Thorvg = {
    Scene: new () => Scene;
    Shape: new () => Shape;
};

export const GATE_HOP = 0.9;
const AIR = 0.7;
const HOP_HEIGHT = 46;
const KEY_X = 830;
const KEY_Y = 488;
const FADE_IN = 0.4;
const RIPPLE = 0.6;
const SIZE = 1.3;

export type GatePose = {
    alpha: number;
    lift: number;
    squashX: number;
    squashY: number;
    swivel: number;
    press: number;
    ripple: number;
};

// The chair keeps hopping on a key cap, every third hop with an impatient spin.
export function gatePose(seconds: number): GatePose {
    const t = Math.max(0, seconds);
    const hop = Math.floor(t / GATE_HOP);
    const u = (t - hop * GATE_HOP) / GATE_HOP;
    const alpha = Math.min(1, t / FADE_IN);
    const sinceLanding = (u >= AIR ? u - AIR : u + 1 - AIR) * GATE_HOP;
    const rippleAge = hop === 0 && u < AIR ? 1 : sinceLanding / RIPPLE;
    const ripple = rippleAge < 1 ? rippleAge : 0;
    if (u < AIR) {
        const air = u / AIR;
        return {
            alpha,
            lift: HOP_HEIGHT * Math.sin(Math.PI * air),
            squashX: 0.94,
            squashY: 1.08,
            swivel: hop % 3 === 2 ? Math.cos(2 * Math.PI * air) : 1,
            press: 0,
            ripple,
        };
    }
    const squash = Math.sin((Math.PI * (u - AIR)) / (1 - AIR));
    return {
        alpha,
        lift: 0,
        squashX: 1 + 0.16 * squash,
        squashY: 1 - 0.2 * squash,
        swivel: 1,
        press: 7 * squash,
        ripple,
    };
}

function chairShapes(tvg: Thorvg): Scene {
    const chair = new tvg.Scene();
    const ink: [number, number, number] = [178, 186, 196];
    const seat = new tvg.Shape()
        .appendRect(-30, -40, 60, 13, { rx: 6, ry: 6 })
        .fill(232, 188, 124);
    const back = new tvg.Shape()
        .appendRect(-30, -96, 15, 58, { rx: 7, ry: 7 })
        .fill(214, 152, 80);
    const pole = new tvg.Shape().appendRect(-3, -28, 6, 16).fill(...ink);
    const base = new tvg.Shape()
        .moveTo(-26, -10)
        .lineTo(26, -10)
        .stroke({ width: 5, color: [...ink, 255] });
    const wheels = new tvg.Shape()
        .appendCircle(-24, -5, 5)
        .appendCircle(24, -5, 5)
        .appendCircle(0, -5, 5)
        .fill(...ink);
    for (const paint of [back, seat, pole, base, wheels]) {
        chair.add(paint);
    }
    return chair;
}

function matrix(scaleX: number, scaleY: number, x: number, y: number) {
    return {
        e11: scaleX,
        e12: 0,
        e13: x,
        e21: 0,
        e22: scaleY,
        e23: y,
        e31: 0,
        e32: 0,
        e33: 1,
    };
}

export function createGateCue(
    tvg: Thorvg,
    canvas: Canvas,
): (seconds: number | null) => void {
    const root = new tvg.Scene();
    const ripple = new tvg.Shape();
    const base = new tvg.Shape()
        .appendRect(KEY_X - 48, KEY_Y - 8, 96, 16, { rx: 5, ry: 5 })
        .fill(120, 128, 140);
    const key = new tvg.Shape();
    const chair = chairShapes(tvg);
    root.add(ripple);
    root.add(base);
    root.add(key);
    root.add(chair);
    root.opacity(0);
    canvas.add(root);
    return (seconds) => {
        if (seconds === null) {
            root.opacity(0);
            return;
        }
        const pose = gatePose(seconds);
        root.opacity(Math.round(255 * pose.alpha));
        const top = KEY_Y - 22 + pose.press;
        key.reset()
            .appendRect(KEY_X - 40, top, 80, 22 - pose.press, { rx: 6, ry: 6 })
            .fill(242, 236, 222);
        ripple.reset();
        if (pose.ripple > 0) {
            const radius = 30 + 70 * pose.ripple;
            ripple.appendCircle(KEY_X, top + 6, radius, radius * 0.32).stroke({
                width: 4,
                color: [232, 188, 124, Math.round(255 * (1 - pose.ripple))],
            });
        }
        chair.transform(
            matrix(
                SIZE * pose.squashX * pose.swivel,
                SIZE * pose.squashY,
                KEY_X,
                top - pose.lift,
            ),
        );
    };
}
