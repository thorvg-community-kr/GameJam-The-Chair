import assert from 'node:assert/strict';
import test from 'node:test';

import { GOLDEN_SCENARIOS } from './support/golden.mjs';

// Office route updated: copiers cancel pending fire when the player leaves detection range.
// Snapshots now include deterministic unplugged cables and recovering corridor lighting.
const EXPECTED = {
    'office route': '0ddbca0f0841aec1',
    'office crash': '27479557d42744e6',
    'building exit': 'ba4f337b941f83ab',
    'building lift': 'f3d4a45dcf055429',
    'rooftop to sky': '36b8fe7bcf52f001',
    'rooftop duct': '8e590d01adb0d50b',
};

for (const [name, run] of Object.entries(GOLDEN_SCENARIOS)) {
    test(`gameplay fingerprint is unchanged: ${name}`, () =>
        assert.equal(run(), EXPECTED[name]));
}
