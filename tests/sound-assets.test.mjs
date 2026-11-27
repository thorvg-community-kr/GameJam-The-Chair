import assert from 'node:assert/strict';
import test from 'node:test';

import { bundled } from './support/load.mjs';

const { SAMPLES } = await bundled({
    entryPoints: ['src/ui/audio-samples.ts'],
    loader: { '.wav': 'dataurl' },
});
const loopNames = new Set([
    'gasLoop',
    'wheelLoop',
    'liftMotor',
    'ventMotor',
    'satelliteScan',
]);

test('every audio sample is valid PCM with matching duration, headroom and clean boundaries', () => {
    for (const [name, sample] of SAMPLES) {
        const bytes = Buffer.from(sample.url.split(',')[1], 'base64');
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', name);
        assert.equal(bytes.toString('ascii', 8, 12), 'WAVE', name);
        assert.equal(bytes.readUInt16LE(22), 1, `${name} mono`);
        assert.equal(bytes.readUInt16LE(34), 16, `${name} 16-bit`);
        const rate = bytes.readUInt32LE(24);
        assert.equal(rate, 44100, name);
        const length = bytes.readUInt32LE(40) / 2;
        assert.ok(
            Math.abs(length / rate - sample.seconds) < 0.001,
            `${name} duration`,
        );
        const values = Array.from({ length }, (_, i) =>
            bytes.readInt16LE(44 + i * 2),
        );
        const peak = values.reduce(
            (max, value) => Math.max(max, Math.abs(value)),
            0,
        );
        assert.ok(peak > 100 && peak <= 16057, `${name} headroom`);
        if (loopNames.has(name)) {
            assert.ok(
                Math.abs(values[0] - values.at(-1)) < 3500,
                `${name} loop seam`,
            );
        } else {
            assert.ok(Math.abs(values[0]) < 8, `${name} attack boundary`);
            assert.ok(Math.abs(values.at(-1)) < 8, `${name} release boundary`);
        }
    }
});
