import type { PathCommand } from '../types';

export class PaintChanges {
    private values = new WeakMap<object, Map<string, string | undefined>>();
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
        const signature = JSON.stringify(value);
        let previous = this.values.get(target);
        if (!previous) {
            previous = new Map();
            this.values.set(target, previous);
        }
        if (previous.has(property) && previous.get(property) === signature) {
            return false;
        }
        previous.set(property, signature);
        return true;
    }
}

export function needsUpdate(
    changes: PaintChanges | null,
    target: object,
    property: string,
    value: unknown,
): boolean {
    return changes?.changed(target, property, value) ?? true;
}
