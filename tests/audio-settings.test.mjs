import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from './support/load.mjs';

const { parseAudioSettings, bgmGain, sfxGain, DEFAULT_AUDIO } = await load(
    'src/ui/audio-settings.ts',
);

test('missing or broken saved audio falls back to full volume', () => {
    assert.deepEqual(parseAudioSettings(null), { ...DEFAULT_AUDIO });
    assert.deepEqual(parseAudioSettings('{oops'), { ...DEFAULT_AUDIO });
    assert.deepEqual(parseAudioSettings('42'), { ...DEFAULT_AUDIO });
});

test('saved audio levels are kept and clamped per channel', () => {
    assert.deepEqual(
        parseAudioSettings(JSON.stringify({ master: 0.5, bgm: 3, sfx: -1 })),
        { master: 0.5, bgm: 1, sfx: 0 },
    );
    assert.deepEqual(
        parseAudioSettings(JSON.stringify({ master: 'loud', sfx: 0.25 })),
        { master: 1, bgm: 1, sfx: 0.25 },
    );
});

test('master volume scales both music and sound effects', () => {
    const audio = { master: 0.5, bgm: 0.8, sfx: 0.4 };
    assert.equal(bgmGain(audio), 0.4);
    assert.equal(sfxGain(audio), 0.2);
    assert.equal(bgmGain({ ...audio, master: 0 }), 0);
});
