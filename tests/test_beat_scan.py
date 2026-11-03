from types import SimpleNamespace

import numpy as np

from ledfx.effects.beat_scan import BeatScanAudioEffect


def make_effect(count=100, **config):
    effect = BeatScanAudioEffect(None, config)
    effect.pixels = np.zeros((count, 3))
    effect.on_activate(count)
    effect.passed = 0.1
    return effect


def beat(effect, timestamp, energy=0.5, detected=True):
    effect.audio_data_updated(
        SimpleNamespace(
            lows_power=lambda: energy,
            bar_oscillator=lambda: 0,
            bpm_beat_now=lambda: detected,
            beat_timestamp=timestamp,
        )
    )


def test_new_segment_starts_at_zero_while_old_one_moves():
    effect = make_effect(scan_width=10, speed=50, multiplier=0)
    beat(effect, 1)
    effect.render()
    assert np.all(effect.pixels[:10, 0] == 255)
    effect.render()
    beat(effect, 2)
    effect.render()
    assert [s[0] for s in effect.segments] == [10, 0]
    assert np.all(effect.pixels[:20, 0] == 255)


def test_energy_increases_speed_without_launching_extra_segments():
    effect = make_effect(speed=50, multiplier=3)
    beat(effect, 1, energy=0)
    effect.render()
    effect.render()
    assert effect.segments[0][0] == 5
    beat(effect, 1, energy=0.5)
    effect.render()
    assert len(effect.segments) == 1
    assert effect.segments[0][0] == 25


def test_cap_and_off_strip_cleanup():
    effect = make_effect(max_segments=2)
    for timestamp in range(4):
        beat(effect, timestamp)
    assert len(effect.segments) == 2
    effect.render()
    effect.passed = 100
    effect.render()
    assert not effect.segments
    assert not effect.pixels.any()


def test_silence_does_not_launch_and_single_pixel_strip_renders():
    effect = make_effect(count=1, scan_width=1)
    beat(effect, 1, detected=False)
    effect.render()
    assert not effect.segments
    beat(effect, 2)
    effect.render()
    assert effect.pixels[0, 0] == 255
