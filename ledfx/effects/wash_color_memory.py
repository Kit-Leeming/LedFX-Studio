"""Audio hits leave colors that decay instead of resetting fixtures to black."""

import math

import numpy as np
import voluptuous as vol

from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashColorMemory(WashFamilyEffect):
    NAME = "Wash Color Memory"
    HIDDEN_KEYS = WashFamilyEffect.HIDDEN_KEYS + ["audio_gate"]
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + [
        "memory_time",
        "cooldown",
        "blend",
    ]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("selection", default="Alternate"): vol.In(
                ("Alternate", "Random", "All", "Center Out")
            ),
            vol.Optional("color_choice", default="Advance"): vol.In(
                ("Advance", "Random")
            ),
            vol.Optional("color_advance", default=0.21): level,
            vol.Optional("memory_time", default=3.0): positive(0.1, 30),
            vol.Optional("cooldown", default=0.12): positive(0.03, 2),
            vol.Optional("threshold", default=0.12): level,
            vol.Optional("base_level", default=0.1): level,
            vol.Optional("hit_level", default=1.0): level,
            vol.Optional("blend", default=0.18): level,
        }
    )

    def on_activate(self, pixel_count):
        self._memory = np.zeros((pixel_count, 3))
        self._memory_level = np.zeros(pixel_count)
        self._last_update = self.now
        self._last_hit = -1e6
        self._hit_index = 0
        self._rng = np.random.default_rng()

    def render(self):
        config = self._config
        now = self.now
        dt = min(0.5, max(0, now - self._last_update))
        self._last_update = now
        decay = math.exp(-dt / config["memory_time"])
        self._memory_level *= decay
        if (
            self.consume_onsets()
            and self._peak_strength >= config["threshold"]
            and now - self._last_hit >= config["cooldown"]
        ):
            count = self.pixel_count
            mode = config["selection"]
            if mode == "All":
                chosen = np.arange(count)
            elif mode == "Random":
                chosen = np.array([self._rng.integers(count)])
            elif mode == "Center Out":
                order = np.argsort(np.abs(np.arange(count) - (count - 1) / 2))
                chosen = np.array([order[self._hit_index % count]])
            else:
                chosen = np.array([self._hit_index % count])
            point = (
                self._rng.random()
                if config["color_choice"] == "Random"
                else self._hit_index * config["color_advance"]
            )
            color = self.palette([point])[0]
            blend = config["blend"]
            self._memory[chosen] = self._memory[chosen] * blend + color * (1 - blend)
            self._memory_level[chosen] = config["hit_level"] * max(
                self._peak_strength, 0.35
            )
            self._last_hit = now
            self._hit_index += 1
        base = config["base_level"]
        background = self.palette([0])[0] * base
        rgb = np.maximum(background, self._memory * self._memory_level[:, None])
        activity = np.maximum(base, self._memory_level)
        self.output(rgb, activity)
