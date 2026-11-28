"""Regenerate edited effects with Python 3 and ffmpeg; keep source recordings intact."""

import array
import json
from pathlib import Path
import subprocess
import wave

from sfx_synthesis import generate

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'sound'
RATE = 44100

for clip in json.loads((ROOT / 'edits.json').read_text()):
    duration = clip['end'] - clip['start']
    filters = ','.join([
        f"atrim=start={clip['start']}:end={clip['end']}",
        'asetpts=PTS-STARTPTS',
        f"highpass=f={clip['highpass']}",
        f"lowpass=f={clip['lowpass']}",
        *([f"afftdn=nr={clip['denoise']}:nf=-45:tn=1:gs=8"] if clip['denoise'] else []),
        *([f"acompressor=threshold={clip['compress']}dB:ratio=8:attack=0.2:release=30:makeup=1"] if clip.get('compress') else []),
        f"afade=t=in:d={clip['fadeIn']}:curve=hsin",
        f"afade=t=out:st={duration - clip['fadeOut']}:d={clip['fadeOut']}:curve=hsin",
    ])
    result = subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(ROOT / 'source' / clip['source']),
        '-af', filters, '-ar', str(RATE), '-ac', '1', '-f', 'f32le', '-',
    ], check=True, capture_output=True)
    samples = array.array('f', result.stdout)
    overlap = round(clip.get('loopCrossfade', 0) * RATE)
    if overlap:
        # Overlap the tail with the head; the remaining seam follows adjacent source samples.
        blended = array.array('f', (
            samples[-overlap + i] * (1 - i / overlap) + samples[i] * i / overlap
            for i in range(overlap)
        ))
        samples = blended + samples[overlap:-overlap]
    peak = max(abs(value) for value in samples)
    gain = min(clip['peak'] / peak, 24)
    pcm = array.array('h', (round(max(-1, min(1, value * gain)) * 32767) for value in samples))
    with wave.open(str(ROOT / (clip['id'] + '.wav')), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    print(f"{clip['id']}: {len(samples) / RATE:.3f}s, peak {peak * gain:.3f}")

generate(ROOT, RATE)
