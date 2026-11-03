"""Two-sided frequency call and response for ordered wash fixtures."""

import math

import numpy as np
import voluptuous as vol

from ledfx.color import parse_color, validate_color
from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashBandConversation(WashFamilyEffect):
    NAME = "Wash Band Conversation"
    HIDDEN_KEYS = [
        key for key in WashFamilyEffect.HIDDEN_KEYS if key != "audio_attack"
    ] + ["gradient"]
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + ["release_time", "cross_talk"]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("left_band", default="Bass"): vol.In(("Bass", "Mids", "High")),
            vol.Optional("right_band", default="Mids"): vol.In(
                ("Bass", "Mids", "High")
            ),
            vol.Optional("left_color", default="#ff3768"): validate_color,
            vol.Optional("right_color", default="#39bfff"): validate_color,
            vol.Optional("layout", default="Split"): vol.In(
                ("Split", "Alternate", "Mirror")
            ),
            vol.Optional("response", default=0.75): level,
            vol.Optional("release_time", default=0.3): positive(0.02, 3),
            vol.Optional("cross_talk", default=0.08): level,
            vol.Optional("base_level", default=0.04): level,
        }
    )

    def on_activate(self, pixel_count):
        self._side_levels = np.zeros(2)
        self._level_time = self.now

    def render(self):
        config = self._config
        band_index = {"Bass": 0, "Mids": 1, "High": 2}
        targets = np.array(
            [
                self._bands[band_index[config["left_band"]]],
                self._bands[band_index[config["right_band"]]],
            ]
        )
        targets = np.clip(
            (targets - config["audio_gate"]) / max(0.01, 1 - config["audio_gate"]), 0, 1
        )
        targets **= 1.5 - config["response"]
        dt = min(0.5, max(0, self.now - self._level_time))
        self._level_time = self.now
        for side in range(2):
            tau = (
                config["audio_attack"]
                if targets[side] > self._side_levels[side]
                else config["release_time"]
            )
            self._side_levels[side] += (targets[side] - self._side_levels[side]) * (
                1 - math.exp(-dt / tau)
            )
        indices = np.arange(self.pixel_count)
        if config["layout"] == "Alternate":
            mix = (indices % 2).astype(float)
        elif config["layout"] == "Mirror":
            mix = np.abs(np.linspace(-1, 1, self.pixel_count))
        else:
            mix = (indices >= self.pixel_count / 2).astype(float)
        if self.pixel_count == 1:
            mix[:] = 0.5
        left, right = (
            np.array(parse_color(config[key]), dtype=float)
            for key in ("left_color", "right_color")
        )
        left_power = config["base_level"] + self._side_levels[0] * (
            1 - config["base_level"]
        )
        right_power = config["base_level"] + self._side_levels[1] * (
            1 - config["base_level"]
        )
        left_power = max(left_power, self._side_levels[1] * config["cross_talk"])
        right_power = max(right_power, self._side_levels[0] * config["cross_talk"])
        rgb = (1 - mix[:, None]) * left * left_power + mix[
            :, None
        ] * right * right_power
        activity = (1 - mix) * left_power + mix * right_power
        self.output(rgb, activity)
