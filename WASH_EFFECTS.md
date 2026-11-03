# Wash Lights

Six audio-reactive effects are available in the **Wash Lights** category. The older Wash Light sequencer, Ambient, Bump, Chase, and Flicker effects are archived at `deprecated_archive/wash_effects_2026-09-27/`. Their source and the portable configuration snapshot are retained for recovery.

| Effect | Look | Main controls |
| --- | --- | --- |
| Wash Frequency Color | Bass, mids and highs mix or choose the wash color | Three colors, Blend/Dominant, color smoothing, response, spatial spread |
| Wash Band Conversation | Different frequency bands answer on opposite sides | Left/right bands and colors, split/alternate/mirror, cross-talk |
| Wash Peak Ripple | Onsets launch expanding waves across fixture order | Origin, speed, width, fade, threshold, cooldown |
| Wash Color Memory | Each onset colors a fixture or the whole array, then fades slowly | Selection, color advance/random, memory, blend, hit level |
| Wash Sonic Stream | Audio emits color particles that travel across the array | Flow, speed, emission, frequency band, color modulation |
| Wash Twinklecat | Irregular glints over a steady background, with density and speed driven by audio | Density, speed, cooling, audio modulation, base level |

Two built-in starting presets are included for each effect. User presets and scenes use normal LedFX saving. The virtual's pixel order is the left-to-right fixture order. Spatial effects become more distinct when the array grows from two to six washes.

Each effect retains independent **UV Mode**: Off, Background, or Follow RGB. It is sent only on the fourth channel when the WLED device uses RGBW output with Independent White enabled in LedFX. WLED Auto-calculate white should be **None** for a UV fixture.

## Design references

- [WLED audio reactive palettes](https://kno.wled.ge/advanced/audio-reactive/#audio-reactive-palettes): frequency-based color for Wash Frequency Color.
- [WLED effects catalog](https://kno.wled.ge/features/effects/): Ripple Peak, Sonic Stream, Sonic Boom, and Twinklecat concepts.
- [xLights VU Meter](https://manual.xlights.org/xlights/effects/off/vu-meter): frequency color, note range pulses, and timed sweep ideas.
- [LedFX Twinklefox/Twinklecat pull request](https://github.com/LedFx/LedFx/pull/514): unmerged prototype; our fixture-oriented implementation has independent controls.
- [FastLED TwinkleFOX](https://gist.github.com/kriegsman/756ea6dcae8e30845b5a): irregular glint timing inspiration.

These are adaptations for realtime, single-pixel wash fixtures, not verbatim ports.
