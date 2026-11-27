import type { Canvas, Paint, Scene, Shape } from '@thorvg/webcanvas';

type Thorvg = {
    Scene: new () => Scene;
    Shape: new () => Shape;
};

export const GATE_TAP = 0.9;
export const GATE_IMPATIENT = 4;
const FADE_IN = 0.4;
const LOGO_MOVE = 0.6;
const PRESS_AT = 0.75;
const RIPPLE = 0.6;
const KEY_X = 480;
const KEY_Y = 452;
const CHAIR_X = 300;
const CHAIR_Y = 486;
const CHAIR_SIZE = 1.45;
const INK: [number, number, number] = [178, 186, 196];

export type GatePose = {
    alpha: number;
    logo: number;
    pulse: number;
    press: number;
    cursorLift: number;
    ripple: number;
    impatient: boolean;
    chair: {
        lift: number;
        squashX: number;
        squashY: number;
        swivel: number;
    };
};

const ease = (value: number) => 1 - (1 - value) ** 3;

function chairPose(t: number, impatient: boolean): GatePose['chair'] {
    const hop = Math.floor(t / GATE_TAP);
    const u = t / GATE_TAP - hop;
    const air = 0.7;
    if (u < air) {
        const k = u / air;
        const spins = impatient || hop % 3 === 2;
        return {
            lift: (impatient ? 70 : 34) * Math.sin(Math.PI * k),
            squashX: 0.94,
            squashY: 1.08,
            swivel: spins ? Math.cos(2 * Math.PI * k) : 1,
        };
    }
    const squash = Math.sin((Math.PI * (u - air)) / (1 - air));
    return {
        lift: 0,
        squashX: 1 + 0.16 * squash,
        squashY: 1 - 0.2 * squash,
        swivel: 1,
    };
}

// A giant key keeps getting clicked by a cursor while a chair hops next to
// it; after a few idle seconds everything gets louder and the chair spins.
export function gatePose(seconds: number): GatePose {
    const t = Math.max(0, seconds);
    const impatient = t >= GATE_IMPATIENT;
    const tap = Math.floor(t / GATE_TAP);
    const u = t / GATE_TAP - tap;
    const distance = Math.abs(u - PRESS_AT);
    const press = Math.max(0, 1 - distance / 0.1);
    const age = ((u - PRESS_AT + 1) % 1) * GATE_TAP;
    const pressed = tap > 0 || u >= PRESS_AT;
    const beat = 0.5 + 0.5 * Math.cos(2 * Math.PI * (u - PRESS_AT));
    return {
        alpha: Math.min(1, t / FADE_IN),
        logo: ease(Math.min(1, t / LOGO_MOVE)),
        pulse: 1 + (impatient ? 0.12 : 0.06) * beat * (1 - press),
        press,
        cursorLift: 46 * Math.min(1, distance / 0.25),
        ripple: pressed && age < RIPPLE ? age / RIPPLE : 0,
        impatient,
        chair: chairPose(t + GATE_TAP / 2, impatient),
    };
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

function group(tvg: Thorvg, paints: Paint[]): Scene {
    const scene = new tvg.Scene();
    for (const paint of paints) {
        scene.add(paint);
    }
    return scene;
}

function chairShapes(tvg: Thorvg): Scene {
    return group(tvg, [
        new tvg.Shape()
            .appendRect(-30, -96, 15, 58, { rx: 7, ry: 7 })
            .fill(214, 152, 80),
        new tvg.Shape()
            .appendRect(-30, -40, 60, 13, { rx: 6, ry: 6 })
            .fill(232, 188, 124),
        new tvg.Shape().appendRect(-3, -28, 6, 16).fill(...INK),
        new tvg.Shape()
            .moveTo(-26, -10)
            .lineTo(26, -10)
            .stroke({ width: 5, color: [...INK, 255] }),
        new tvg.Shape()
            .appendCircle(-24, -5, 5)
            .appendCircle(24, -5, 5)
            .appendCircle(0, -5, 5)
            .fill(...INK),
    ]);
}

// Classic arrow pointer with its tip at the origin.
function cursorShape(tvg: Thorvg): Shape {
    return new tvg.Shape()
        .moveTo(0, 0)
        .lineTo(0, 36)
        .lineTo(9, 28)
        .lineTo(16, 43)
        .lineTo(23, 40)
        .lineTo(16, 25)
        .lineTo(28, 25)
        .close()
        .fill(255, 255, 255)
        .stroke({ width: 3, color: [20, 24, 30, 255] });
}

function moveLogo(logo: Paint, progress: number) {
    const scale = 1 - 0.32 * progress;
    const centerY = 275 - 105 * progress;
    logo.transform(
        matrix(scale, scale, 480 - 480 * scale, centerY - 275 * scale),
    );
}

export function createGateCue(
    tvg: Thorvg,
    canvas: Canvas,
    logo: Paint,
): (seconds: number | null) => void {
    const ripple = new tvg.Shape();
    const cap = new tvg.Shape();
    const key = group(tvg, [
        new tvg.Shape()
            .appendRect(-104, -6, 208, 34, { rx: 10, ry: 10 })
            .fill(120, 128, 140),
        cap,
    ]);
    const chair = chairShapes(tvg);
    const cursor = cursorShape(tvg);
    const root = group(tvg, [ripple, key, chair, cursor]);
    root.opacity(0);
    canvas.add(root);
    return (seconds) => {
        if (seconds === null) {
            root.opacity(0);
            moveLogo(logo, 0);
            return;
        }
        const pose = gatePose(seconds);
        moveLogo(logo, pose.logo);
        root.opacity(Math.round(255 * pose.alpha));
        const depth = 14 * pose.press;
        const face = pose.impatient ? [255, 214, 150] : [242, 236, 222];
        cap.reset()
            .appendRect(-92, -44 + depth, 184, 52 - depth, { rx: 12, ry: 12 })
            .fill(face[0], face[1], face[2])
            .stroke({ width: 4, color: [232, 188, 124, 255] });
        key.transform(matrix(pose.pulse, pose.pulse, KEY_X, KEY_Y));
        ripple.reset();
        if (pose.ripple > 0) {
            const radius = 110 + 120 * pose.ripple;
            ripple
                .appendCircle(KEY_X, KEY_Y - 10, radius, radius * 0.35)
                .stroke({
                    width: 5,
                    color: [232, 188, 124, Math.round(255 * (1 - pose.ripple))],
                });
        }
        cursor.transform(
            matrix(1.5, 1.5, KEY_X + 40, KEY_Y - 30 + depth - pose.cursorLift),
        );
        const c = pose.chair;
        chair.transform(
            matrix(
                CHAIR_SIZE * c.squashX * c.swivel,
                CHAIR_SIZE * c.squashY,
                CHAIR_X,
                CHAIR_Y - c.lift,
            ),
        );
    };
}
