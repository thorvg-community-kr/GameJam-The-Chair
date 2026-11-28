# Game sound effects

Run `python3 scripts/prepare-sfx.py` from the repository root with Python 3 and FFmpeg installed. This regenerates recorded edits and original synthesized effects as mono 44.1 kHz, 16-bit WAV files.

`edits.json` records full source filenames, extraction ranges, frequency filters, optional denoising, fades, target peaks, and loop crossfades. Digital notification sounds bypass denoising. Peak normalization happens in floating point before PCM conversion. `generated.json` describes deterministic tone and filtered-noise layers; `scripts/sfx_synthesis.py` renders them without external sound libraries. Loop crossfades join the tail to the head rather than inserting silence between repeats.

## Sources

The original seven recordings remain in `source/`. The additional files were supplied in `assets/sound copy`; only unique sources were copied, using English filenames.

| Source file | Supplied source |
|---|---|
| `door-close.mp3` | [SFXMint door close 15](https://sfxmint.com/sounds/door-close-15) |
| `impact.mp3` | [SFXMint impact thud 82](https://sfxmint.com/sounds/impact-thud-82) |
| `access.mp3` | [SFXMint access granted 01](https://sfxmint.com/sounds/access-granted-01) |
| `parrot.mp3` | [SFXMint parrot squawk 04](https://sfxmint.com/sounds/parrot-squawk-04) |
| `ui-error.wav` | [Mildly Useless error buzz](https://mildlyuseless.com/res/ui-error-buzz) |
| `keyboard.mp3`, `ringing.mp3` | User-provided files under local filenames |

The linked public libraries identify these effects as CC0: [SFXMint license](https://sfxmint.com/license), [Mildly Useless license](https://mildlyuseless.com/res/license).

## Playback coverage

| Interaction | Audio |
|---|---|
| Copier, paper impact, spill, landing, slipping, pickup, docking | Existing edited recordings |
| Opening and nearby office typing | Edited keyboard recording |
| Head and bundle impact | Edited thud recording |
| Checkpoint and failure | Edited access and error recordings |
| Rooftop, meeting and dispatch doors | Edited latch and synthesized sliding door |
| Lift arrival and travel | Edited bell and synthesized motor loop |
| Extinguisher | Edited lever click and synthesized gas loop |
| Chair and convoy motion | Crossfaded chair recording; horn at express transition |
| Vent and duct warning, blast | Synthesized motor loop and edited wind |
| Employee-of-the-month portrait drop | Quiet synthesized paper flutter |
| Rooftop takeoff | Synthesized windup, kick and edited wind |
| Sky desks, signs, floating gear | Synthesized wood creak and metal rattle |
| Approaching bird and bird collision | Edited squawk and existing impact recording |
| Satellite tracking, lock and capture | Synthesized scan until the shot, lock warning; dedicated edited shutter |
| Orbit speed steps | Synthesized motor rise |
| Bin fall | Synthesized hollow knocks and paper-like noise |
| Menu buttons and volume confirmation | Synthesized tap and confirmation |

`src/presentation/scene-audio.ts` observes snapshots without changing gameplay. Its stage modules produce one-shot and persistent-loop requests. `src/ui/game-audio.ts` shares routing between the game and motion preview. The Web Audio loop mixer reuses sources, fades changes, limits simultaneous loops, and retires voices when an emitter stops or moves out of range. Pause, restart, replay viewing, seeking and hidden tabs clear playback. The sky release and parked ending remain quiet; the shutter fires as each satellite damage zone opens.

## Verification

Use Play in `/preview.html`; seeking is silent. Relevant scenes include `office-typing`, `rooftop-entrance`, `lift-arrival-audio`, `extinguisher-spray`, `rooftop-shaft-low`, `rooftop-takeoff`, `sky-surface-audio`, `orbit-route`, and `orbit-photo`. The photograph marker identifies its real capture frame; the shutter itself follows the zone opening. Rewinding or looping a scene resets sound history.

`tests/scene-audio.test.mjs` covers transition timing, distance, cancellation, the photograph, preview collision events and gameplay isolation. `tests/sound-assets.test.mjs` checks PCM formats, durations, headroom and sample boundaries. Final timbre and music balance should also be checked by listening in the game.
