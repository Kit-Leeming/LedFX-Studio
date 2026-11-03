"""WLED audio-palette inspired, fixture-wide frequency color."""

import math

import numpy as np
import voluptuous as vol

from ledfx.color import parse_color, validate_color
from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashFrequencyColor(WashFamilyEffect):
    NAME = "Wash Frequency Color"
    HIDDEN_KEYS = WashFamilyEffect.HIDDEN_KEYS + ["gradient"]
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + ["color_smoothing", "band_balance"]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("color_lows", default="#ff2850"): validate_color,
            vol.Optional("color_mids", default="#24d5ff"): validate_color,
            vol.Optional("color_highs", default="#b760ff"): validate_color,
            vol.Optional("color_mode", default="Blend"): vol.In(("Blend", "Dominant")),
            vol.Optional("band_balance", default=0.35): level,
            vol.Optional("color_smoothing", default=0.22): positive(0.01, 3),
            vol.Optional("base_level", default=0.12): level,
            vol.Optional("response", default=0.8): level,
            vol.Optional("spatial_spread", default=0.0): level,
        }
    )

    def on_activate(self, pixel_count):
        self._wash_color = np.zeros(3)
        self._color_time = self.now

    def render(self):
        config = self._config
        bands = np.maximum(0, self._bands - config["audio_gate"])
        # Lift quiet bands slightly so bass-heavy tracks do not pin one color.
        weights = bands ** (1 - 0.75 * config["band_balance"])
        palette = np.array(
            [parse_color(config[key]) for key in ("color_lows", "color_mids", "color_highs")],
            dtype=float,
        )
        if np.sum(weights) > 1e-5:
            if config["color_mode"] == "Dominant":
                target = palette[int(np.argmax(weights))]
            else:
                target = np.average(palette, axis=0, weights=weights)
        else:
            target = self._wash_color if np.any(self._wash_color) else palette[0]
        dt = min(0.5, max(0.0, self.now - self._color_time))
        self._color_time = self.now
        self._wash_color += (target - self._wash_color) * (
            1 - math.exp(-dt / config["color_smoothing"])
        )
        power = np.clip(np.max(bands), 0, 1)
        level_now = config["base_level"] + (1 - config["base_level"]) * (
            power ** (1.5 - config["response"])
        )
        offsets = np.linspace(-0.5, 0.5, self.pixel_count)[:, None]
        colors = np.clip(self._wash_color + offsets * config["spatial_spread"] * (palette[2] - palette[0]), 0, 255)
        self.output(colors * level_now, np.full(self.pixel_count, level_now))
