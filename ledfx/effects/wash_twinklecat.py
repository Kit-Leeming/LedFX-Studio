"""FastLED TwinkleFOX inspired glints with audio-controlled density."""

import math

import numpy as np
import voluptuous as vol

from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashTwinklecat(WashFamilyEffect):
    NAME = "Wash Twinklecat"
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + ["density", "speed", "cooling"]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("density", default=0.45): level,
            vol.Optional("speed", default=1.4): positive(0.1, 8),
            vol.Optional("cooling", default=0.9): positive(0.1, 4),
            vol.Optional("audio_density", default=0.8): level,
            vol.Optional("audio_speed", default=0.45): level,
            vol.Optional("base_level", default=0.13): level,
            vol.Optional("glint_level", default=0.85): level,
            vol.Optional("color_variation", default=0.75): level,
        }
    )

    def on_activate(self, pixel_count):
        rng = np.random.default_rng()
        self._phases = rng.random(pixel_count)
        self._rates = rng.uniform(0.72, 1.3, pixel_count)
        self._cycle = np.full(pixel_count, -1, dtype=int)
        self._enabled = np.zeros(pixel_count, dtype=bool)
        self._color_points = rng.random(pixel_count)
        self._clock = 0.0
        self._last_update = self.now
        self._rng = rng

    def render(self):
        config = self._config
        dt = min(0.25, max(0, self.now - self._last_update))
        self._last_update = self.now
        power = np.clip(np.max(self._bands) - config["audio_gate"], 0, 1)
        self._clock += dt * config["speed"] * (1 + config["audio_speed"] * 2 * power)
        phase = self._clock * self._rates + self._phases
        cycles = np.floor(phase).astype(int)
        changed = cycles != self._cycle
        if np.any(changed):
            probability = np.clip(config["density"] * (1 - config["audio_density"] + 1.8 * config["audio_density"] * power), 0, 1)
            count = int(np.sum(changed))
            self._enabled[changed] = self._rng.random(count) < probability
            self._color_points[changed] = self._rng.random(count)
            self._cycle[changed] = cycles[changed]
        within = phase - cycles
        rise = np.minimum(1, within / 0.15)
        fall = np.exp(-np.maximum(0, within - 0.15) * 3 / config["cooling"])
        glint = self._enabled * rise * fall * config["glint_level"]
        points = self._color_points * config["color_variation"]
        colors = self.palette(points)
        background = self.palette([0])[0] * config["base_level"]
        rgb = np.maximum(background, colors * glint[:, None])
        self.output(rgb, np.maximum(config["base_level"], glint))
