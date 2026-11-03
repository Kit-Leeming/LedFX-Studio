"""Exercise six fixture-array looks and their audio-driven state."""

import numpy as np
import pytest

from ledfx.effects.wash_band_conversation import WashBandConversation
from ledfx.effects.wash_color_memory import WashColorMemory
from ledfx.effects.wash_family import WashFamilyEffect
from ledfx.effects.wash_frequency_color import WashFrequencyColor
from ledfx.effects.wash_peak_ripple import WashPeakRipple
from ledfx.effects.wash_sonic_stream import WashSonicStream
from ledfx.effects.wash_twinklecat import WashTwinklecat


EFFECTS = (
    WashFrequencyColor,
    WashBandConversation,
    WashPeakRipple,
    WashColorMemory,
    WashSonicStream,
    WashTwinklecat,
)


def make_effect(effect_type, count, **config):
    effect = effect_type(None, config)
    effect.pixels = np.zeros((count, 3))
    WashFamilyEffect.on_activate(effect, count)
    effect_type.on_activate(effect, count)
    effect.palette = lambda points: np.tile([180.0, 60.0, 220.0], (len(points), 1))
    effect.get_gradient_color_vectorized1d = effect.palette
    return effect


@pytest.mark.parametrize("effect_type", EFFECTS)
@pytest.mark.parametrize("count", (1, 2, 6, 24))
def test_effects_render_for_fixture_counts(effect_type, count):
    effect = make_effect(effect_type, count, uv_mode="Background", uv_background=0.2)
    effect._bands[:] = (0.8, 0.5, 0.2)
    effect._onsets = 1
    effect._peak_strength = 0.8
    for frame in range(10):
        effect.now += 0.1
        effect.render()
        output = effect.get_pixels()
        assert output.shape == (count, 4)
        assert np.isfinite(output).all()
        assert np.allclose(output[:, 3], 51)


def test_band_conversation_assigns_different_sides():
    effect = make_effect(WashBandConversation, 2, left_color="#ff0000", right_color="#0000ff")
    effect._bands[:] = (1, 0, 0)
    effect.now += 0.3
    effect.render()
    assert effect.pixels[0, 0] > effect.pixels[1, 0]


@pytest.mark.parametrize("effect_type,attribute", ((WashPeakRipple, "_waves"), (WashColorMemory, "_hit_index")))
def test_transient_effects_trigger_on_onset(effect_type, attribute):
    effect = make_effect(effect_type, 6)
    effect._bands[:] = (0.8, 0.3, 0.1)
    effect._onsets = 1
    effect._peak_strength = 0.8
    effect.now += 0.1
    effect.render()
    assert getattr(effect, attribute)
