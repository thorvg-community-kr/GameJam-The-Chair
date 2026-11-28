export type Vector = [number, number];
export type Curve = [number, number, number, number, number, number];
export type Color = [number, number, number, number];
export type Gradient = {
    from: Vector;
    to: Vector;
    stops: Array<[number, Color]>;
    // Radial when set: from is the centre; radius is in screen px.
    radius?: number;
};
export type Blend = 'normal' | 'multiply' | 'screen' | 'add' | 'overlay';
export type Bounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
export type Transform = {
    e11: number;
    e12: number;
    e13: number;
    e21: number;
    e22: number;
    e23: number;
    e31: 0;
    e32: 0;
    e33: 1;
};
export type Stroke = {
    width: number;
    color: string | Gradient;
    cap?: 'butt' | 'round';
    dash?: number[];
    dashOffset?: number;
};
export type LayerSpec = {
    key: string;
    // Gaussian sigma in screen px.
    blur?: number;
    // Screen px; degrees clockwise from +x.
    motionBlur?: { distance: number; angle: number };
    blend?: Blend;
    opacity?: number;
    /** ThorVG Tint: maps the layer's darks and lights onto two colours. */
    tint?: { black: string; white: string; intensity: number };
    /** ThorVG DropShadow; a light colour reads as a rim light. Degrees clockwise from +x. */
    dropShadow?: {
        color: string;
        opacity: number;
        angle: number;
        distance: number;
        sigma: number;
    };
    clip?: PathCommand;
    mask?: PathCommand;
    maskInvert?: boolean;
    // Retained geometry belongs to one canvas; only its Scene transform
    // changes.
    retained?: { geometry: string; transform: Transform; bounds: Bounds };
    effectBudget?: { area: number; minScale?: number };
    /**
     * Draw this layer's text and Lottie commands inside its Scene so its
     * mask, clip and opacity apply to them too. They draw over its paths.
     */
    holdsText?: boolean;
};
export type TextSpec = {
    content: string;
    font: string;
    size: number;
    x: number;
    y: number;
    rotation: number;
    fill: string;
    outline?: { width: number; color: string };
    opacity?: number;
};
export type SceneTalk = {
    reaction: { text: string; life: number } | null;
    speech: { name: string; text: string; x: number; life: number } | null;
};
export type DrawCommand = PathCommand | TextCommand | LottieCommand;

/** A bundled Lottie animation drawn by ThorVG at a given time. */
export type LottieAsset = 'thorvg-logo';
export type LottieSpec = {
    asset: LottieAsset;
    /** Seconds into the animation. */
    time: number;
    /** Top-left corner and size in screen px. */
    x: number;
    y: number;
    width: number;
    height: number;
    opacity?: number;
};
export type LottieCommand = {
    kind: 'lottie';
    points: Vector[];
    lottie: LottieSpec;
    layer?: LayerSpec;
};

export type TextCommand = {
    kind: 'text';
    points: Vector[];
    text: TextSpec;
    layer?: LayerSpec;
};

export type PathCommand = {
    kind: 'path';
    points: Vector[];
    curves?: Curve[];
    fill: string | Gradient | null;
    open?: boolean;
    stroke?: Stroke;
    trim?: [number, number];
    blend?: Blend;
    layer?: LayerSpec;
};
