# Beat Scan

Select **Beat Scan** in the **BPM** effects category.

Each tempo-tracked main beat launches a segment at the beginning of the strip.
Earlier segments keep moving, so several can be visible at once. Segments leave
the strip at its end; they do not wrap or bounce. Flip reverses the direction.

- **Scan width**: segment length as a percentage of the strip (default 15%).
- **Speed**: base travel speed in strip percent per second (default 30).
- **Multiplier**: extra speed from current audio energy (default 3).
- **Frequency range**: which audio band controls speed, not beat triggering.
- **Max segments**: simultaneous segment limit (default 32); removes the oldest
  when full. Lower speed usually means more segments on the strip.
- **Color scan** / **Use grad**: fixed color or a different gradient color per beat.
- **Color intensity**: optional audio-driven brightness; disabled by default so
  the new segment remains visible even when energy is low.

Travel speed is `speed * (1 + 2 * band_power * multiplier)`. All active segments
respond to current energy. Overlapping colors use the brightest value per channel
to avoid adding brightness indefinitely. Width changes affect active segments.

Beat timing depends on LedFX's existing tempo detector, including its acquisition
time and audio/output latency. Physical alignment to music requires listening and
watching the strip; deterministic tests do not verify that alignment.

Focused tests: `.venv\Scripts\python.exe -m pytest --noconftest tests/test_beat_scan.py -q`
