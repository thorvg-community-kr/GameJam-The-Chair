"""Regenerate edited effects with Python 3 and ffmpeg; keep source recordings intact."""

import array
import json
from pathlib import Path
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'sound'
RATE = 44100

for clip in json.loads((ROOT / 'edits.json').read_text()):
    duration = clip['end'] - clip['start']
    filters = ','.join([
        f"atrim=start={clip['start']}:end={clip['end']}",
        'asetpts=PTS-STARTPTS',
        f"highpass=f={clip['highpass']}",
        f"lowpass=f={clip['lowpass']}",
        'afftdn=nr=8:nf=-45:tn=1:gs=8',
        f"afade=t=in:d={clip['fadeIn']}:curve=hsin",
        f"afade=t=out:st={duration - clip['fadeOut']}:d={clip['fadeOut']}:curve=hsin",
    ])
    result = subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(ROOT / 'source' / (clip['source'] + '.mp3')),
        '-af', filters, '-ar', str(RATE), '-ac', '1', '-f', 'f32le', '-',
    ], check=True, capture_output=True)
    samples = array.array('f', result.stdout)
    peak = max(abs(value) for value in samples)
    gain = min(clip['peak'] / peak, 24)
    pcm = array.array('h', (round(max(-1, min(1, value * gain)) * 32767) for value in samples))
    with wave.open(str(ROOT / (clip['id'] + '.wav')), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())
    print(f"{clip['id']}: {len(samples) / RATE:.3f}s, peak {peak * gain:.3f}")
