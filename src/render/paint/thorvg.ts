import { PaintChanges, needsUpdate } from './changes';
import { effectScaleForArea } from '../perf';
import { canvasBox } from './commands';
import { lottieSource } from '../lottie';

import type { RenderStats } from '../perf';
import type { Item } from './commands';
import type { RenderCtx } from '../context';
import type { FontName } from '../fonts';
import type {
    Blend,
    PathCommand,
    Gradient,
    LayerSpec,
    LottieSpec,
    TextSpec,
} from '../types';
import type {
    Animation,
    Canvas,
    LinearGradient,
    RadialGradient,
    Scene,
    Shape,
    Text,
    ThorVGNamespace,
} from '@thorvg/webcanvas';
type LayerSlot = {
    scene: Scene;
    shapes: Shape[];
    clip: Shape | null;
    mask: Shape | null;
    maskInvert: boolean;
    retainedGeometry: string | null;
    texts: TextSlot[];
    lotties: LottieSlot[];
};
type TextSlot = { back: Text; front: Text; font: string; content: string };
type LottieSlot = { asset: string; animation: Animation | null };
type AppliedStyle = { stroked: boolean; trimmed: boolean; blended: boolean };
// A run of top-level shapes between layers or texts lives in its own Scene so
// that its size can change without rebuilding the canvas child list.
type TopBucket = { scene: Scene; shapes: Shape[]; used: number };
const PX_TO_PT = 72 / 96;
export type PaintPool = {
    top: TopBucket[];
    texts: TextSlot[];
    layers: Map<string, LayerSlot>;
    styled: Map<Shape, AppliedStyle>;
    signature: string;
    changes: PaintChanges | null;
};
export function createPaintPool(): PaintPool {
    return {
        top: [],
        texts: [],
        layers: new Map(),
        styled: new Map(),
        signature: '',
        changes: null,
    };
}
function staleSlot(slot: LayerSlot, spec: LayerSpec) {
    if (slot.clip && !spec.clip) {
        return true;
    }
    if (slot.mask && (!spec.mask || slot.maskInvert !== !!spec.maskInvert)) {
        return true;
    }
    return false;
}
export function thorvgTextWidth(tvg: ThorVGNamespace) {
    const probe = new tvg.Text();
    const cache = new Map<string, number>();
    return (content: string, font: FontName): number => {
        const key = `${font}\n${content}`;
        let width = cache.get(key);
        if (width === undefined) {
            probe
                .font(font)
                .fontSize(100 * PX_TO_PT)
                .text(content);
            width = content ? probe.bounds().width / 100 : 0;
            cache.set(key, width);
        }
        return width;
    };
}
function blendOf(tvg: ThorVGNamespace, blend: Blend | undefined) {
    switch (blend) {
        case 'multiply':
            return tvg.BlendMethod.Multiply;
        case 'screen':
            return tvg.BlendMethod.Screen;
        case 'add':
            return tvg.BlendMethod.Add;
        case 'overlay':
            return tvg.BlendMethod.Overlay;
        case 'normal':
        case undefined:
            return tvg.BlendMethod.Normal;
    }
}
function fillOf(
    tvg: ThorVGNamespace,
    g: Gradient,
): LinearGradient | RadialGradient {
    const fill =
        g.radius === undefined
            ? new tvg.LinearGradient(...g.from, ...g.to)
            : new tvg.RadialGradient(...g.from, g.radius);
    fill.setStops(...g.stops);
    return fill;
}
function tracePath(s: Shape, cmd: PathCommand) {
    s.reset();
    s.moveTo(...cmd.points[0]);
    for (let j = 1; j < cmd.points.length; j++) {
        s.lineTo(...cmd.points[j]);
    }
    for (const c of cmd.curves || []) {
        s.cubicTo(...c);
    }
    if (!cmd.open) {
        s.close();
    }
}
function applyShape(
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    pool: PaintPool,
    s: Shape,
    cmd: PathCommand,
) {
    const geometryChanged = pool.changes?.pathChanged(s, cmd) ?? true;
    const paintChanged = needsUpdate(pool.changes, s, 'paint', [
        cmd.fill,
        cmd.stroke,
        cmd.trim,
        cmd.blend,
    ]);
    if (geometryChanged) {
        tracePath(s, cmd);
    }
    if (paintChanged) {
        const style = applyShapeStroke(cmd, s, ctx, tvg, pool.styled);
        if (style.stroked || style.trimmed || style.blended) {
            pool.styled.set(s, style);
        } else {
            pool.styled.delete(s);
        }
    }
    setVisible(pool, s, true);
}

function setVisible(
    pool: PaintPool,
    target: Shape | Scene | Text,
    visible: boolean,
) {
    if (needsUpdate(pool.changes, target, 'visible', visible)) {
        target.visible(visible);
    }
}

function applyShapeStroke(
    cmd: PathCommand,
    s: Shape,
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    styled: Map<Shape, AppliedStyle>,
) {
    const style = applyShapePaint(cmd, s, ctx, tvg, styled);
    if (cmd.trim) {
        s.trimPath(cmd.trim[0], cmd.trim[1], true);
        style.trimmed = true;
    } else if (style.trimmed) {
        s.trimPath(0, 1, true);
        style.trimmed = false;
    }
    if (cmd.blend && cmd.blend !== 'normal') {
        s.blend(blendOf(tvg, cmd.blend));
        style.blended = true;
    } else if (style.blended) {
        s.blend(tvg.BlendMethod.Normal);
        style.blended = false;
    }
    return style;
}
function applyShapePaint(
    cmd: PathCommand,
    s: Shape,
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    styled: Map<Shape, AppliedStyle>,
) {
    if (cmd.fill === null) {
        s.fill(0, 0, 0, 0);
    } else if (typeof cmd.fill === 'string') {
        s.fill(...ctx.rgba(cmd.fill));
    } else {
        const g = fillOf(tvg, cmd.fill);
        s.fill(g);
        g.dispose();
    }
    const style = styled.get(s) ?? {
        stroked: false,
        trimmed: false,
        blended: false,
    };
    if (cmd.stroke) {
        const k = cmd.stroke;
        const gradient =
            typeof k.color === 'string' ? null : fillOf(tvg, k.color);
        s.stroke({
            width: k.width,
            ...(gradient
                ? { gradient }
                : { color: ctx.rgba(k.color as string) }),
            cap: k.cap === 'round' ? tvg.StrokeCap.Round : tvg.StrokeCap.Butt,
            join: tvg.StrokeJoin.Round,
            dash: k.dash ?? [],
            dashOffset: k.dashOffset ?? 0,
        });
        gradient?.dispose();
        style.stroked = true;
    } else if (style.stroked) {
        s.stroke({ width: 0, dash: [] });
        style.stroked = false;
    }
    return style;
}
function applyText(
    ctx: Pick<RenderCtx, 'rgba'>,
    slot: TextSlot,
    spec: TextSpec,
    changes: PaintChanges | null,
) {
    if (changes && !changes.changed(slot, 'text', spec)) {
        return;
    }
    if (slot.font !== spec.font) {
        slot.back.font(spec.font);
        slot.front.font(spec.font);
        slot.font = spec.font;
    }
    if (slot.content !== spec.content) {
        slot.back.text(spec.content);
        slot.front.text(spec.content);
        slot.content = spec.content;
    }
    const c = Math.cos(spec.rotation);
    const s = Math.sin(spec.rotation);
    const matrix = {
        e11: c,
        e12: -s,
        e13: spec.x,
        e21: s,
        e22: c,
        e23: spec.y,
        e31: 0,
        e32: 0,
        e33: 1,
    };
    // ThorVG 1.1.3 Text sizes are points (96/72 px each); TextSpec sizes
    // are CSS px like Canvas2D.
    const size = spec.size * PX_TO_PT;
    const [r, g, b, a] = ctx.rgba(spec.fill);
    const fade = spec.opacity ?? 1;
    slot.front
        .fontSize(size)
        .fill(r, g, b)
        .opacity(Math.round(a * fade))
        .transform(matrix)
        .visible(true);
    if (spec.outline) {
        const [or, og, ob, oa] = ctx.rgba(spec.outline.color);
        slot.back
            .fontSize(size)
            .fill(or, og, ob)
            .outline(spec.outline.width, or, og, ob)
            .opacity(Math.round(oa * fade))
            .transform(matrix)
            .visible(true);
    } else {
        slot.back.visible(false);
    }
}
type LayerMetrics = {
    shapeCount: number;
    activeCount: number;
    area: number;
    effectScale: number;
};
function recordLayerStats(
    stats: RenderStats,
    spec: LayerSpec,
    { shapeCount, activeCount, area, effectScale }: LayerMetrics,
) {
    const effects: string[] = measureLayerEffects(
        spec,
        stats,
        shapeCount,
        activeCount,
        {
            effectScale,
            area,
        },
    );
    stats.layerList.push({ key: spec.key, shapes: activeCount, area, effects });
}

function measureLayerEffects(
    spec: LayerSpec,
    stats: RenderStats,
    shapeCount: number,
    activeCount: number,
    {
        effectScale,
        area,
    }: {
        effectScale: number;
        area: number;
    },
) {
    const blurred =
        !!spec.blur || (!!spec.motionBlur && spec.motionBlur.distance > 0.5);
    const effects: string[] = countLayerShapes(
        stats,
        shapeCount,
        activeCount,
        spec,
        {
            effectScale,
            blurred,
            area,
        },
    );
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        effects.push('motion');
    }
    if (effectScale < 1) {
        effects.push(`budget${Math.round(effectScale * 100)}%`);
    }
    if (spec.clip) {
        effects.push('clip');
    }
    if (spec.mask) {
        effects.push(spec.maskInvert ? 'invmask' : 'mask');
    }
    return effects;
}
function countLayerShapes(
    stats: RenderStats,
    shapeCount: number,
    activeCount: number,
    spec: LayerSpec,
    {
        effectScale,
        blurred,
        area,
    }: {
        effectScale: number;
        blurred: boolean;
        area: number;
    },
) {
    stats.layers++;
    stats.layerShapes += shapeCount;
    stats.parkedShapes += shapeCount - activeCount;
    if (spec.clip) {
        stats.clips++;
    }
    if (spec.mask) {
        stats.masks++;
    }
    if (spec.blur) {
        stats.gaussianBlurs++;
        stats.blurAmount += spec.blur * effectScale;
    }
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        stats.motionBlurs++;
        stats.blurAmount += spec.motionBlur.distance * effectScale;
    }
    if (blurred) {
        stats.blurArea += area;
    }
    const effects: string[] = [];
    if (spec.opacity !== undefined && spec.opacity < 1) {
        effects.push(`α${spec.opacity.toFixed(2)}`);
    }
    if (spec.blend && spec.blend !== 'normal') {
        effects.push(spec.blend);
    }
    if (spec.blur) {
        effects.push(`blur${spec.blur}`);
    }
    if (spec.tint) {
        effects.push('tint');
    }
    if (spec.dropShadow) {
        effects.push('shadow');
    }
    return effects;
}
function applyFilters(
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    scene: Scene,
    spec: LayerSpec,
    effectScale: number,
) {
    scene.resetEffects();
    const quality = Math.max(20, Math.round(45 * effectScale));
    if (spec.blur) {
        scene.gaussianBlur(spec.blur * effectScale, 0, 0, quality);
    }
    if (spec.motionBlur && spec.motionBlur.distance > 0.5) {
        scene.motionBlur(
            spec.motionBlur.distance * effectScale,
            spec.motionBlur.angle,
            quality,
        );
    }
    if (spec.tint) {
        const [br, bg, bb] = ctx.rgba(spec.tint.black);
        const [wr, wg, wb] = ctx.rgba(spec.tint.white);
        scene.tint(br, bg, bb, wr, wg, wb, spec.tint.intensity);
    }
    if (spec.dropShadow) {
        const { color, opacity, angle, distance, sigma } = spec.dropShadow;
        const [r, g, b, a] = ctx.rgba(color, opacity);
        scene.dropShadow(
            r,
            g,
            b,
            a,
            angle,
            distance * effectScale,
            Math.max(0.1, sigma * effectScale),
            quality,
        );
    }
}
function applyLayerEffects(
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    slot: LayerSlot,
    spec: LayerSpec,
    {
        effectScale,
        changes,
    }: { effectScale: number; changes: PaintChanges | null },
) {
    const { scene } = slot;
    if (
        needsUpdate(changes, scene, 'effects', [
            spec.blur,
            spec.motionBlur,
            spec.tint,
            spec.dropShadow,
            effectScale,
        ])
    ) {
        applyFilters(ctx, tvg, scene, spec, effectScale);
    }
    if (needsUpdate(changes, scene, 'blend', spec.blend)) {
        scene.blend(blendOf(tvg, spec.blend));
    }
    if (needsUpdate(changes, scene, 'opacity', spec.opacity)) {
        scene.opacity(
            Math.round(Math.max(0, Math.min(1, spec.opacity ?? 1)) * 255),
        );
    }
    if (spec.clip && needsUpdate(changes, scene, 'clip', spec.clip)) {
        if (!slot.clip) {
            slot.clip = new tvg.Shape();
            scene.clip(slot.clip);
        }
        tracePath(slot.clip, spec.clip);
        slot.clip.fill(255, 255, 255, 255);
    }
    if (spec.mask && needsUpdate(changes, scene, 'mask', spec.mask)) {
        if (!slot.mask) {
            slot.mask = new tvg.Shape();
            slot.maskInvert = !!spec.maskInvert;
            scene.mask(
                slot.mask,
                slot.maskInvert
                    ? tvg.MaskMethod.InvAlpha
                    : tvg.MaskMethod.Alpha,
            );
        }
        const fill = spec.mask.fill;
        tracePath(slot.mask, spec.mask);
        if (fill === null) {
            slot.mask.fill(255, 255, 255, 255);
        } else if (typeof fill === 'string') {
            slot.mask.fill(...ctx.rgba(fill));
        } else {
            const g = fillOf(tvg, fill);
            slot.mask.fill(g);
            g.dispose();
        }
    }
}
function syncLayer(
    ctx: Pick<RenderCtx, 'rgba' | 'W' | 'H'>,
    tvg: ThorVGNamespace,
    pool: PaintPool,
    item: Extract<
        Item,
        {
            layer: LayerSpec;
        }
    >,
    stats?: RenderStats,
) {
    let slot = pool.layers.get(item.key);
    if (!slot) {
        slot = {
            scene: new tvg.Scene(),
            shapes: [],
            clip: null,
            mask: null,
            maskInvert: false,
            retainedGeometry: null,
            texts: [],
            lotties: [],
        };
        pool.layers.set(item.key, slot);
    }
    const { scene, shapes } = slot;
    const preparedFields1 = prepareLayerShapes(item, stats, ctx, slot, {
        shapes,
        tvg,
        scene,
        pool,
    });
    const anchor: [number, number] | null = preparedFields1.anchor;
    const extent: number[] | undefined = preparedFields1.extent;
    const spec: LayerSpec = preparedFields1.spec;
    let i: number = preparedFields1.i;
    // Re-adding shapes leaks ThorVG references; park unused shapes inside
    // the drawn area.
    const [px, py] = anchor ?? [0, 0];
    const area =
        extent && extent[2] > extent[0] && extent[3] > extent[1]
            ? (extent[2] - extent[0]) * (extent[3] - extent[1])
            : 0;
    const effectScale = spec.effectBudget
        ? effectScaleForArea(
              area,
              spec.effectBudget.area,
              spec.effectBudget.minScale,
          )
        : 1;
    if (stats) {
        recordLayerStats(stats, spec, {
            shapeCount: shapes.length,
            activeCount: i,
            area,
            effectScale,
        });
    }
    for (; i < shapes.length; i++) {
        applyShape(ctx, tvg, pool, shapes[i], {
            kind: 'path',
            points: [
                [px, py],
                [px + 1, py],
                [px + 1, py + 1],
                [px, py + 1],
            ],
            fill: '#00000001',
        });
    }
    syncLayerTexts(ctx, tvg, slot, item.texts, pool.changes);
    syncLayerLotties(tvg, slot, item.lotties, pool.changes);
    applyLayerEffects(ctx, tvg, slot, spec, {
        effectScale,
        changes: pool.changes,
    });
    setVisible(pool, scene, true);
    return scene;
}
function syncLayerTexts(
    ctx: Pick<RenderCtx, 'rgba'>,
    tvg: ThorVGNamespace,
    slot: LayerSlot,
    texts: readonly TextSpec[],
    changes: PaintChanges | null,
) {
    while (slot.texts.length < texts.length) {
        const make = () => new tvg.Text().align(0.5, 0.5);
        const text = { back: make(), front: make(), font: '', content: '' };
        slot.texts.push(text);
        slot.scene.add(text.back).add(text.front);
    }
    texts.forEach((spec, i) => applyText(ctx, slot.texts[i], spec, changes));
    for (let i = texts.length; i < slot.texts.length; i++) {
        changes?.changed(slot.texts[i], 'text', null);
        slot.texts[i].back.visible(false);
        slot.texts[i].front.visible(false);
    }
}
function syncLayerLotties(
    tvg: ThorVGNamespace,
    slot: LayerSlot,
    lotties: readonly LottieSpec[],
    changes: PaintChanges | null,
) {
    lotties.forEach((spec, i) => {
        let entry = slot.lotties.at(i);
        if (!entry || entry.asset !== spec.asset) {
            entry?.animation?.picture?.visible(false);
            entry = { asset: spec.asset, animation: null };
            slot.lotties[i] = entry;
        }
        if (!entry.animation) {
            const source = lottieSource(spec.asset);
            if (!source) {
                return;
            }
            const animation = new tvg.Animation();
            animation.load(source);
            if (!animation.picture) {
                animation.dispose();
                return;
            }
            entry.animation = animation;
            slot.scene.add(animation.picture);
        }
        updateLottie(entry.animation, spec, changes);
    });
    for (let i = lotties.length; i < slot.lotties.length; i++) {
        const picture = slot.lotties[i].animation?.picture;
        if (picture && needsUpdate(changes, picture, 'visible', false)) {
            picture.visible(false);
        }
    }
}
function updateLottie(
    animation: Animation,
    spec: LottieSpec,
    changes: PaintChanges | null,
) {
    const picture = animation.picture!;
    const duration = animation.info()?.duration ?? 0;

    const time = Math.max(0, Math.min(duration - 1 / 60, spec.time));
    if (needsUpdate(changes, animation, 'time', time)) {
        animation.seek(time);
    }
    if (needsUpdate(changes, picture, 'size', [spec.width, spec.height])) {
        picture.size(spec.width, spec.height);
    }
    if (needsUpdate(changes, picture, 'position', [spec.x, spec.y])) {
        picture.translate(spec.x, spec.y);
    }
    if (needsUpdate(changes, picture, 'opacity', spec.opacity)) {
        picture.opacity(
            Math.round(255 * Math.max(0, Math.min(1, spec.opacity ?? 1))),
        );
    }
    if (needsUpdate(changes, picture, 'visible', true)) {
        picture.visible(true);
    }
}
function prepareLayerShapes(
    item: {
        layer: LayerSpec;
        key: string;
        cmds: PathCommand[];
    },
    stats: RenderStats | undefined,
    ctx: Pick<RenderCtx, 'rgba' | 'W' | 'H'>,
    slot: LayerSlot,
    {
        shapes,
        tvg,
        scene,
        pool,
    }: {
        shapes: Shape[];
        tvg: ThorVGNamespace;
        scene: Scene;
        pool: PaintPool;
    },
) {
    const spec = item.layer;
    const extent =
        stats || spec.effectBudget
            ? [Infinity, Infinity, -Infinity, -Infinity]
            : undefined;
    if (spec.retained && extent) {
        const bounds = spec.retained.bounds;
        extent[0] = Math.max(0, bounds.left);
        extent[1] = Math.max(0, bounds.top);
        extent[2] = Math.min(ctx.W, bounds.right);
        extent[3] = Math.min(ctx.H, bounds.bottom);
    }
    const retainedReady =
        !!spec.retained && slot.retainedGeometry === spec.retained.geometry;
    let i = 0;
    let anchor: [number, number] | null = null;
    for (const cmd of item.cmds) {
        const box: [number, number] | null = spec.retained
            ? [
                  Math.max(0, spec.retained.bounds.left),
                  Math.max(0, spec.retained.bounds.top),
              ]
            : canvasBox(cmd, ctx.W, ctx.H, extent);
        if (!box) {
            continue;
        }
        anchor ??= box;
        let s = shapes.at(i);
        if (!s) {
            s = new tvg.Shape();
            shapes.push(s);
            scene.add(s);
        }
        if (!retainedReady) {
            applyShape(ctx, tvg, pool, s, cmd);
        }
        i++;
    }
    if (spec.retained) {
        if (
            needsUpdate(
                pool.changes,
                scene,
                'transform',
                spec.retained.transform,
            )
        ) {
            scene.transform(spec.retained.transform);
        }
        slot.retainedGeometry = spec.retained.geometry;
    }
    return { anchor, extent, spec, i };
}
export function paintThorvg(
    ctx: RenderCtx,
    tvg: ThorVGNamespace,
    canvas: Canvas,
    pool: PaintPool,
    {
        items,
        stats,
        incremental = false,
    }: {
        items: Item[];
        incremental?: boolean;
        stats?: RenderStats;
    },
): void {
    pool.changes = incremental ? (pool.changes ?? new PaintChanges()) : null;
    const syncStart = stats ? performance.now() : 0;
    const layout = paintOrder(items);
    let signature = layout.signature;
    while (pool.top.length < layout.bucketCount) {
        pool.top.push({ scene: new tvg.Scene(), shapes: [], used: 0 });
    }
    while (pool.texts.length < layout.textCount) {
        const make = () => new tvg.Text().align(0.5, 0.5);
        pool.texts.push({ back: make(), front: make(), font: '', content: '' });
    }

    const preparedPool = synchronizePaintOrder(signature, pool, items, canvas, {
        ctx,
        tvg,
        stats,
    });
    const { reorder, order, bucketIndex, textIndex } = preparedPool;
    signature = preparedPool.signature;
    if (reorder) {
        for (const paint of order) {
            canvas.add(paint);
        }
        for (let i = bucketIndex; i < pool.top.length; i++) {
            canvas.add(pool.top[i].scene);
        }
        for (let i = textIndex; i < pool.texts.length; i++) {
            canvas.add(pool.texts[i].back).add(pool.texts[i].front);
        }
        // Commit the signature only after success so a failed rebuild is
        // retried.
        pool.signature = signature;
    }
    if (stats) {
        countTopShapes(pool, stats);
        stats.layerSlots = pool.layers.size;
        stats.reorder = reorder;
        const renderStart = performance.now();
        stats.syncMs = renderStart - syncStart;
        canvas.update().render();
        stats.renderMs = performance.now() - renderStart;
        return;
    }
    canvas.update().render();
}
function synchronizePaintOrder(
    signature: string,
    pool: PaintPool,
    items: Item[],
    canvas: Canvas,
    {
        ctx,
        tvg,
        stats,
    }: {
        ctx: RenderCtx;
        tvg: ThorVGNamespace;
        stats: RenderStats | undefined;
    },
) {
    signature += `${pool.top.length}/${pool.texts.length}`;
    // ThorVG cannot detach clips or masks; replace the scene to avoid GL
    // smearing.
    for (const item of items) {
        if (!('layer' in item)) {
            continue;
        }
        const slot = pool.layers.get(item.key);
        if (slot && staleSlot(slot, item.layer)) {
            pool.layers.delete(item.key);
            pool.signature = '';
        }
    }
    // Empty the canvas before adding children: ThorVG 1.1.3 crashes if such a
    // scene is then removed.
    const reorder = signature !== pool.signature;
    if (reorder) {
        pool.signature = '';
        canvas.remove();
    }
    let bucketIndex = 0;
    let textIndex = 0;
    let bucket: TopBucket | null = null;
    const order: Array<Shape | Scene | Text> = [];
    for (const item of items) {
        if ('cmd' in item) {
            if (!bucket) {
                bucket = pool.top[bucketIndex++];
                bucket.used = 0;
                setVisible(pool, bucket.scene, true);
                order.push(bucket.scene);
            }
            syncTopShape(ctx, tvg, pool, bucket, item.cmd);
            continue;
        }
        if (bucket) {
            hideUnused(pool, bucket);
            bucket = null;
        }
        if ('text' in item) {
            const slot = pool.texts[textIndex++];
            applyText(ctx, slot, item.text, pool.changes);
            order.push(slot.back, slot.front);
            if (stats) {
                stats.texts++;
            }
            continue;
        }
        order.push(syncLayer(ctx, tvg, pool, item, stats));
    }
    if (bucket) {
        hideUnused(pool, bucket);
    }
    hideSpare(pool, bucketIndex, textIndex);
    return { reorder, order, bucketIndex, textIndex, signature };
}
function paintOrder(items: Item[]) {
    let bucketCount = 0;
    let textCount = 0;
    let signature = '';
    let inRun = false;
    for (const item of items) {
        if ('cmd' in item) {
            if (!inRun) {
                signature += `#${bucketCount++};`;
                inRun = true;
            }
            continue;
        }
        inRun = false;
        signature += 'text' in item ? `text${textCount++};` : `${item.key};`;
    }
    return { bucketCount, textCount, signature };
}
function syncTopShape(
    ctx: RenderCtx,
    tvg: ThorVGNamespace,
    pool: PaintPool,
    bucket: TopBucket,
    cmd: PathCommand,
) {
    if (!canvasBox(cmd, ctx.W, ctx.H)) {
        return;
    }
    let s = bucket.shapes.at(bucket.used);
    if (!s) {
        s = new tvg.Shape();
        bucket.shapes.push(s);
        bucket.scene.add(s);
    }
    bucket.used++;
    applyShape(ctx, tvg, pool, s, cmd);
}
function countTopShapes(pool: PaintPool, stats: RenderStats) {
    stats.topShapes = stats.poolTop = 0;
    for (const bucket of pool.top) {
        stats.topShapes += bucket.used;
        stats.poolTop += bucket.shapes.length;
    }
}
function hideSpare(pool: PaintPool, bucketIndex: number, textIndex: number) {
    for (let i = bucketIndex; i < pool.top.length; i++) {
        pool.top[i].used = 0;
        setVisible(pool, pool.top[i].scene, false);
    }
    for (let i = textIndex; i < pool.texts.length; i++) {
        pool.changes?.changed(pool.texts[i], 'text', null);
        pool.texts[i].back.visible(false);
        pool.texts[i].front.visible(false);
    }
}
function hideUnused(pool: PaintPool, bucket: TopBucket) {
    for (let i = bucket.used; i < bucket.shapes.length; i++) {
        setVisible(pool, bucket.shapes[i], false);
    }
}
