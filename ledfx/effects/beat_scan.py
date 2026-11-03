"""Launch overlapping, energy-driven scans on tempo-tracked beats."""

import numpy as np
import voluptuous as vol

from ledfx.color import parse_color, validate_color
from ledfx.effects.audio import AudioReactiveEffect
from ledfx.effects.gradient import GradientEffect


class BeatScanAudioEffect(AudioReactiveEffect, GradientEffect):
    NAME = "Beat Scan"
    CATEGORY = "BPM"
    HIDDEN_KEYS = ["gradient_roll"]

    CONFIG_SCHEMA = vol.Schema(
        {
            vol.Optional(
                "scan_width",
                description="Segment width as a percentage of the strip",
                default=15,
            ): vol.All(vol.Coerce(float), vol.Range(min=1, max=100)),
            vol.Optional(
                "speed",
                description="Base travel speed in strip percent per second",
                default=30,
            ): vol.All(vol.Coerce(float), vol.Range(min=1, max=200)),
            vol.Optional(
                "multiplier", description="Extra speed from audio energy", default=3.0
            ): vol.All(vol.Coerce(float), vol.Range(min=0, max=5)),
            vol.Optional(
                "frequency_range",
                description="Audio energy that controls travel speed",
                default="Lows (beat+bass)",
            ): vol.In(list(AudioReactiveEffect.POWER_FUNCS_MAPPING)),
            vol.Optional(
                "max_segments",
                description="Maximum simultaneous scans; oldest removed when full",
                default=32,
            ): vol.All(vol.Coerce(int), vol.Range(min=1, max=128)),
            vol.Optional(
                "color_scan", description="Segment color", default="#FF0000"
            ): validate_color,
            vol.Optional(
                "use_grad",
                description="Choose a new gradient color on each beat",
                default=False,
            ): bool,
            vol.Optional(
                "color_intensity",
                description="Adjust brightness with current audio energy",
                default=False,
            ): bool,
        }
    )

    def config_updated(self, config):
        self.power_func = self.POWER_FUNCS_MAPPING[config["frequency_range"]]
        self.scan_color = np.array(parse_color(config["color_scan"]), dtype=float)

    def on_activate(self, pixel_count):
        self.segments = []
        self.power = 0.0
        self.color_index = 0.0
        self.last_beat_timestamp = None

    def audio_data_updated(self, data):
        self.power = max(0.0, float(getattr(data, self.power_func)()) * 2)
        # Update the shared tempo tracker, then deduplicate its beat timestamp.
        # Several effects may read the same cached beat event in an audio frame.
        data.bar_oscillator()
        if data.bpm_beat_now() and data.beat_timestamp != self.last_beat_timestamp:
            self.last_beat_timestamp = data.beat_timestamp
            color = (
                self.get_gradient_color(self.color_index)
                if self._config["use_grad"]
                else self.scan_color
            )
            self.segments.append([0.0, np.array(color, dtype=float).copy(), True])
            self.segments = self.segments[-self._config["max_segments"] :]
            self.color_index = (self.color_index + 0.125) % 1.0

    def render(self):
        self.pixels = np.zeros_like(self.pixels)
        width = max(1, int(self.pixel_count * self._config["scan_width"] / 100))
        step = (
            max(0.0, self.passed)
            * self.pixel_count
            * self._config["speed"]
            / 100
            * (1 + self.power * self._config["multiplier"])
        )
        intensity = min(1.0, self.power) if self._config["color_intensity"] else 1.0
        alive = []
        for segment in self.segments[-self._config["max_segments"] :]:
            # Show each newly launched segment at pixel zero for its first frame.
            if segment[2]:
                segment[2] = False
            else:
                segment[0] += step
            start = int(segment[0])
            if start >= self.pixel_count:
                continue
            end = min(self.pixel_count, start + width)
            self.pixels[start:end] = np.maximum(
                self.pixels[start:end], segment[1] * intensity
            )
            alive.append(segment)
        self.segments = alive
