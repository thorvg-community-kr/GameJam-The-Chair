import type { PathCommand } from '../types';

export class PaintChanges {
    private values = new WeakMap<object, Map<string, unknown>>();
    private paths = new WeakMap<object, number[]>();

    pathChanged(target: object, path: PathCommand): boolean {
        const previous = this.paths.get(target);
        const numbers = previous ?? [];
        let different = !previous;
        let index = 3;
        const curves = path.curves ?? [];
        const open = path.open ? 1 : 0;
        if (
            numbers[0] !== path.points.length ||
            numbers[1] !== curves.length ||
            numbers[2] !== open
        ) {
            different = true;
        }
        numbers[0] = path.points.length;
        numbers[1] = curves.length;
        numbers[2] = open;
        for (const vectors of [path.points, curves]) {
            for (const vector of vectors) {
                for (const value of vector) {
                    if (numbers[index] !== value) {
                        different = true;
                    }
                    numbers[index++] = value;
                }
            }
        }
        numbers.length = index;
        this.paths.set(target, numbers);
        return different;
    }

    changed(target: object, property: string, value: unknown): boolean {
        let previous = this.values.get(target);
        if (!previous) {
            previous = new Map();
            this.values.set(target, previous);
        }
        if (previous.has(property) && same(previous.get(property), value)) {
            return false;
        }
        previous.set(property, snapshot(value));
        return true;
    }
}

// Structural compare and copy with JSON semantics (undefined object fields are
// absent), so per-frame checks allocate nothing until a value really changes.
function same(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (!isObject(a) || !isObject(b)) {
        return Number.isNaN(a) && Number.isNaN(b);
    }
    const list = Array.isArray(a);
    if (list !== Array.isArray(b)) {
        return false;
    }
    return list
        ? sameList(a as unknown[], b as unknown[])
        : sameRecord(
              a as Record<string, unknown>,
              b as Record<string, unknown>,
          );
}

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function sameList(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (!same(a[i], b[i])) {
            return false;
        }
    }
    return true;
}

function sameRecord(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean {
    for (const key in a) {
        if (!same(a[key], b[key])) {
            return false;
        }
    }
    for (const key in b) {
        if (a[key] === undefined && b[key] !== undefined) {
            return false;
        }
    }
    return true;
}

function snapshot(value: unknown): unknown {
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(snapshot);
    }
    const copy: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
        if (field !== undefined) {
            copy[key] = snapshot(field);
        }
    }
    return copy;
}

export function needsUpdate(
    changes: PaintChanges | null,
    target: object,
    property: string,
    value: unknown,
): boolean {
    return changes?.changed(target, property, value) ?? true;
}
