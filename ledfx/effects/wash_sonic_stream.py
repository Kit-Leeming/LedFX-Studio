"""WLED Sonic Stream inspired frequency-driven flowing particles."""

import math

import numpy as np
import voluptuous as vol

from ledfx.effects.wash_family import WashFamilyEffect, level, positive


class WashSonicStream(WashFamilyEffect):
    NAME = "Wash Sonic Stream"
    HIDDEN_KEYS = WashFamilyEffect.HIDDEN_KEYS + ["audio_gate"]
    ADVANCED_KEYS = WashFamilyEffect.ADVANCED_KEYS + ["particle_width", "flow_rate", "fade_time"]
    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional("flow", default="Left to Right"): vol.In(("Left to Right", "Right to Left", "Center Out")),
            vol.Optional("flow_rate", default=2.2): positive(0.1, 20),
            vol.Optional("emission", default=5.0): positive(0.1, 30),
            vol.Optional("particle_width", default=0.75): positive(0.2, 5),
            vol.Optional("fade_time", default=1.5): positive(0.1, 6),
            vol.Optional("frequency_band", default="Bass"): vol.In(("Bass", "Mids", "High")),
            vol.Optional("color_modulation", default=0.65): level,
            vol.Optional("base_level", default=0.04): level,
            vol.Optional("threshold", default=0.06): level,
        }
    )

    def on_activate(self, pixel_count):
        self._particles = []
        self._emit_balance = 0.0
        self._last_update = self.now
        self._emitted = 0

    def render(self):
        config = self._config
        now = self.now
        dt = min(0.25, max(0, now - self._last_update))
        self._last_update = now
        band = {"Bass": 0, "Mids": 1, "High": 2}[config["frequency_band"]]
        power = max(0, self._bands[band] - config["threshold"])
        self._emit_balance += dt * config["emission"] * power
        hits = self.consume_onsets()
        if hits and power > 0:
            self._emit_balance += min(2, hits) * power
        emissions = min(8, int(self._emit_balance))
        self._emit_balance -= emissions
        for _ in range(emissions):
            point = (self._emitted * 0.11 + self._bands[1] * config["color_modulation"]) % 1
            self._particles.append((now, self.palette([point])[0], min(1, 0.35 + power)))
            self._emitted += 1
        self._particles = self._particles[-96:]
        count = self.pixel_count
        positions = np.arange(count)
        base = config["base_level"]
        rgb = np.tile(self.palette([0])[0] * base, (count, 1))
        activity = np.full(count, base)
        retained = []
        for started, color, strength in self._particles:
            age = now - started
            if age > config["fade_time"] * 4 + count / config["flow_rate"]:
                continue
            retained.append((started, color, strength))
            traveled = age * config["flow_rate"]
            if config["flow"] == "Right to Left":
                center = count - 1 - traveled
                distance = np.abs(positions - center)
            elif config["flow"] == "Center Out":
                distance = np.abs(np.abs(positions - (count - 1) / 2) - traveled)
            else:
                distance = np.abs(positions - traveled)
            envelope = np.exp(-0.5 * (distance / config["particle_width"]) ** 2)
            envelope *= math.exp(-age / config["fade_time"]) * strength
            rgb = np.maximum(rgb, envelope[:, None] * color)
            activity = np.maximum(activity, envelope)
        self._particles = retained
        self.output(rgb, activity)
