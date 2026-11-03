"""Transient-triggered expanding waves inspired by WLED Ripple Peak."""

import numpy as np
import voluptuous as vol

from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashPeakRipple(WashFamilyEffect):
    NAME = "Wash Peak Ripple"
    HIDDEN_KEYS = WashFamilyEffect.HIDDEN_KEYS + ["audio_gate"]
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + ["width", "fade_time", "cooldown"]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("origin", default="Alternate Edges"): vol.In(
                ("Center", "Left", "Right", "Alternate Edges", "Random")
            ),
            vol.Optional("speed", default=3.0): positive(0.2, 30),
            vol.Optional("width", default=0.8): positive(0.2, 6),
            vol.Optional("fade_time", default=1.2): positive(0.1, 5),
            vol.Optional("threshold", default=0.14): level,
            vol.Optional("cooldown", default=0.13): positive(0.03, 2),
            vol.Optional("base_level", default=0.04): level,
            vol.Optional("color_advance", default=0.17): level,
        }
    )

    def on_activate(self, pixel_count):
        self._waves = []
        self._wave_index = 0
        self._last_wave = -1e6
        self._rng = np.random.default_rng()

    def render(self):
        config = self._config
        now = self.now
        hits = self.consume_onsets()
        if (
            hits
            and self._peak_strength >= config["threshold"]
            and now - self._last_wave >= config["cooldown"]
        ):
            count = self.pixel_count
            origin = config["origin"]
            if origin == "Center":
                location = (count - 1) / 2
            elif origin == "Right" or (
                origin == "Alternate Edges" and self._wave_index % 2
            ):
                location = count - 1
            elif origin == "Random":
                location = int(self._rng.integers(count))
            else:
                location = 0
            color = self.palette([self._wave_index * config["color_advance"]])[0]
            self._waves.append((now, location, color, self._peak_strength))
            self._waves = self._waves[-24:]
            self._last_wave = now
            self._wave_index += 1
        positions = np.arange(self.pixel_count)
        base = config["base_level"]
        rgb = np.tile(self.palette([0])[0] * base, (self.pixel_count, 1))
        activity = np.full(self.pixel_count, base)
        retained = []
        for started, origin, color, strength in self._waves:
            age = max(0, now - started)
            if age > config["fade_time"] * 4:
                continue
            retained.append((started, origin, color, strength))
            radius = age * config["speed"]
            distance = np.abs(positions - origin)
            envelope = np.exp(-0.5 * ((distance - radius) / config["width"]) ** 2)
            envelope *= np.exp(-age / config["fade_time"]) * strength
            rgb = np.maximum(rgb, envelope[:, None] * color)
            activity = np.maximum(activity, envelope)
        self._waves = retained
        self.output(rgb, activity)
