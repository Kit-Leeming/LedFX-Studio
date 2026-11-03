"""Shared audio, gradient and independent UV output for focused wash effects."""

import math
import timeit
from typing import ClassVar

import numpy as np
import voluptuous as vol

from ledfx.effects import Effect
from ledfx.effects.audio import AudioReactiveEffect
from ledfx.effects.gradient import GradientEffect

level = vol.All(vol.Coerce(float), vol.Range(min=0, max=1))


def positive(minimum, maximum):
    return vol.All(vol.Coerce(float), vol.Range(min=minimum, max=maximum))


@Effect.no_registration
class WashFamilyEffect(AudioReactiveEffect, GradientEffect):
    """Keep RGBW handling local to wash effects and opt-in WLED devices."""

    CATEGORY = "Wash Lights"
    HIDDEN_KEYS: ClassVar[list[str]] = [
        "blur",
        "mirror",
        "flip",
        "background_color",
        "background_brightness",
        "gradient_roll",
        "audio_band",
        "audio_influence",
        "audio_attack",
        "audio_release",
    ]
    ADVANCED_KEYS = AudioReactiveEffect.ADVANCED_KEYS + [
        "audio_gate",
        "audio_attack",
        "audio_release",
        "uv_background",
        "uv_pulse",
    ]

    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("audio_band", default="Bass"): vol.In(
                tuple(AudioReactiveEffect.POWER_FUNCS_MAPPING)
            ),
            vol.Optional("audio_influence", default=0.7): level,
            vol.Optional("audio_gate", default=0.02): level,
            vol.Optional("audio_attack", default=0.04): positive(0.001, 2),
            vol.Optional("audio_release", default=0.18): positive(0.001, 3),
            vol.Optional("uv_mode", default="Off"): vol.In(
                ("Off", "Background", "Follow RGB")
            ),
            vol.Optional("uv_background", default=0.0): level,
            vol.Optional("uv_pulse", default=0.7): level,
        }
    )

    def config_updated(self, config):
        GradientEffect.config_updated(self, config)

    def on_activate(self, pixel_count):
        self.uv_pixels = np.zeros(pixel_count)
        self._energy = 0.0
        self._onsets = 0
        self._beat_position = 0.0
        self._beat_period = 0.5
        self._last_bar = None
        self._audio_timestamp = timeit.default_timer()
        self._previous_audio_time = self._audio_timestamp
        self._bands = np.zeros(3)
        self._peak_strength = 0.0

    def audio_data_updated(self, data):
        now = timeit.default_timer()
        bar = data.bar_oscillator()
        if self._last_bar is not None:
            delta = (bar - self._last_bar) % 4
            if delta < 1.5:
                self._beat_position += delta
        self._last_bar = bar
        self._beat_period = max(0.2, min(2.0, data.beat_period))
        elapsed = max(0.001, now - self._previous_audio_time)
        self._previous_audio_time = now
        self._audio_timestamp = now
        source = AudioReactiveEffect.POWER_FUNCS_MAPPING[self._config["audio_band"]]
        target = float(np.max(getattr(data, source)()))
        target = float(np.clip(target, 0, 1))
        self._bands[:] = np.clip(
            [data.lows_power(), data.mids_power(), data.high_power()], 0, 1
        )
        tau = self._config["audio_attack" if target > self._energy else "audio_release"]
        self._energy += (target - self._energy) * (1 - math.exp(-elapsed / tau))
        if data.onset():
            self._onsets += 1
            self._peak_strength = max(target, float(np.max(self._bands)))

    def consume_onsets(self):
        count = self._onsets
        self._onsets = 0
        return count

    def palette(self, points):
        return self.get_gradient_color_vectorized1d(np.asarray(points) % 1)

    def beat_position(self):
        return (
            self._beat_position
            + max(0.0, self.now - self._audio_timestamp) / self._beat_period
        )

    def musical_strength(self):
        energy = self._energy
        if energy < self._config["audio_gate"]:
            return 0.0
        influence = self._config["audio_influence"]
        return (1 - influence) + influence * energy

    def output(self, rgb, activity=None):
        self.pixels[:] = np.clip(rgb, 0, 255)
        mode = self._config["uv_mode"]
        if mode == "Off":
            self.uv_pixels.fill(0)
        elif mode == "Background":
            self.uv_pixels.fill(255 * self._config["uv_background"])
        else:
            if activity is None:
                activity = np.max(self.pixels, axis=1) / 255
            self.uv_pixels[:] = 255 * self._config["uv_pulse"] * np.clip(activity, 0, 1)

    def get_pixels(self):
        rgb = super().get_pixels()
        if rgb is None:
            return None
        uv = self.uv_pixels.copy()
        if self.flip:
            uv = np.flipud(uv)
        if self.mirror:
            mirrored = np.concatenate((uv[::-1], uv))
            uv = np.maximum(mirrored[::2], mirrored[1::2])
        uv *= self.brightness
        return np.column_stack((rgb, uv))
