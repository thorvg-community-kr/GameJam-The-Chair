"""Deterministic original Foley substitutes, rendered without external sound libraries."""

import array
import json
import math
import random
import wave


def layer(spec, count, rate, rng):
    values = array.array('f', [0]) * count
    phase = 0
    low = 0
    start = round(spec.get('at', 0) * rate)
    length = round(spec['seconds'] * rate)
    cutoff = spec.get('cutoff', 1800)
    alpha = 1 - math.exp(-2 * math.pi * cutoff / rate)
    for j in range(min(length, count - start)):
        t = j / rate
        k = j / max(1, length - 1)
        if spec['kind'] == 'noise':
            white = rng.uniform(-1, 1)
            low += alpha * (white - low)
            value = white - low if spec.get('highpass') else low
        else:
            freq = spec['from'] + (spec.get('to', spec['from']) - spec['from']) * k
            phase += 2 * math.pi * freq / rate
            value = math.sin(phase)
            if spec.get('harmonic'):
                value += .25 * math.sin(phase * 2.01)
        pulse = spec.get('pulse', 0)
        amplitude = .7 + .3 * math.cos(2 * math.pi * pulse * t) if pulse else 1
        attack = min(1, t / spec.get('attack', .006))
        release = min(1, (length - 1 - j) / rate / spec.get('release', .08))
        envelope = math.sin(max(0, attack) * math.pi / 2) ** 2
        envelope *= math.sin(max(0, release) * math.pi / 2) ** 2
        if spec.get('decay'):
            envelope *= math.exp(-spec['decay'] * k)
        values[start + j] = value * amplitude * envelope * spec.get('gain', 1)
    return values


def generate(root, rate):
    recipes = json.loads((root / 'generated.json').read_text())
    for index, clip in enumerate(recipes):
        count = round(clip['seconds'] * rate)
        samples = array.array('f', [0]) * count
        rng = random.Random(4100 + index)
        for spec in clip['layers']:
            values = layer(spec, count, rate, rng)
            for i, value in enumerate(values):
                samples[i] += value
        if clip.get('loop'):
            overlap = round(.08 * rate)
            blended = array.array('f', (
                samples[-overlap + i] * (1 - i / overlap) + samples[i] * i / overlap
                for i in range(overlap)
            ))
            samples = blended + samples[overlap:-overlap]
        peak = max(abs(value) for value in samples)
        gain = clip['peak'] / max(peak, .0001)
        pcm = array.array('h', (round(value * gain * 32767) for value in samples))
        with wave.open(str(root / (clip['id'] + '.wav')), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(rate)
            output.writeframes(pcm.tobytes())
        print(f"{clip['id']}: {len(samples) / rate:.3f}s, synthesized")
