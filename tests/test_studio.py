import copy
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ledfx.effects.singleColor import SingleColorEffect
from ledfx.effects.scroll import ScrollAudioEffect
from ledfx.effects.gradient import GradientEffect
from ledfx.studio import Studio, color_fields, theme_config

THEME = {
    "name": "Rose",
    "gradient": "linear-gradient(90deg, #ff0044 0%, #4411ff 100%)",
    "primary": "#ff0044",
    "accent": "#4411ff",
    "background": "#000000",
    "mappings": {},
}


class Effects:
    classes = {
        "singleColor": SingleColorEffect,
        "scroll": ScrollAudioEffect,
        "gradient": GradientEffect,
    }

    def get_class(self, kind):
        return self.classes[kind]

    def create(self, ledfx, type, config):
        return SimpleNamespace(
            type=type, config=self.get_class(type).schema()(config)
        )


class Virtual:
    def __init__(self, identifier, segment):
        self.id = self.name = identifier
        self.active = True
        self.streaming = False
        self.segments = [segment]
        self._devices = [True]
        self.virtual_cfg = {}
        self.active_effect = SimpleNamespace(
            type="singleColor",
            config=SingleColorEffect.schema()(
                {"color": "#ffffff", "brightness": 0.4}
            ),
        )
        self.update_effect_config(self.active_effect)
        self.fail = False

    def set_effect(self, effect):
        if self.fail:
            self.fail = False
            raise RuntimeError("activation failed")
        self.active_effect = effect
        self.active = True

    def clear_effect(self):
        self.active_effect = None
        self.active = False

    def update_effect_config(self, effect):
        self.virtual_cfg["effect"] = {
            "type": effect.type,
            "config": copy.deepcopy(effect.config),
        }

    def get_effects_config(self, kind):
        return {}


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.a = Virtual("a", ("controller", 0, 9, False))
        self.b = Virtual("b", ("controller", 10, 19, False))
        self.ledfx = SimpleNamespace(
            config_dir=self.temp.name,
            config={},
            effects=Effects(),
            virtuals={"a": self.a, "b": self.b},
        )
        self.studio = Studio(self.ledfx)
        data = copy.deepcopy(self.studio.data)
        data["themes"]["rose"] = copy.deepcopy(THEME)
        self.studio.save_library(data)
        self.patch = patch("ledfx.studio.save_config")
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_theme_fields_exclude_brightness_and_gradient_roll(self):
        self.assertNotIn("brightness", color_fields(SingleColorEffect))
        self.assertEqual(
            color_fields(GradientEffect),
            {"background_color": "background", "gradient": "gradient"},
        )

    def test_apply_theme_preserves_settings_and_other_lights(self):
        old_b = self.studio.snapshot(["b"])
        self.studio.apply([{"id": "a", "theme": "rose"}])
        self.assertEqual(self.a.active_effect.config["brightness"], 0.4)
        self.assertEqual(self.a.active_effect.config["color"], "#ff0044")
        self.assertEqual(self.studio.snapshot(["b"]), old_b)

    def test_theme_survives_effect_change_and_undo(self):
        self.studio.apply([{"id": "a", "theme": "rose"}])
        original = self.studio.snapshot(["a"])
        self.studio.apply([{"id": "a", "type": "gradient"}])
        self.assertEqual(
            self.a.active_effect.config["gradient"], THEME["gradient"]
        )
        self.studio.undo()
        self.assertEqual(self.studio.snapshot(["a"]), original)

    def test_invalid_batch_changes_nothing(self):
        before = self.studio.snapshot(["a", "b"])
        with self.assertRaises(Exception):
            self.studio.apply(
                [
                    {"id": "a", "config": {"brightness": 0.7}},
                    {"id": "b", "config": {"brightness": 99}},
                ]
            )
        self.assertEqual(self.studio.snapshot(["a", "b"]), before)
        self.assertEqual(len(self.studio.history), 0)

    def test_batch_validates_even_if_factory_does_not(self):
        self.ledfx.effects.create = (
            lambda ledfx, type, config: SimpleNamespace(
                type=type, config=config
            )
        )
        before = self.studio.snapshot(["a", "b"])
        with self.assertRaises(Exception):
            self.studio.apply(
                [
                    {"id": "a", "config": {"brightness": 0.7}},
                    {"id": "b", "config": {"brightness": 99}},
                ]
            )
        self.assertEqual(self.studio.snapshot(["a", "b"]), before)

    def test_runtime_failure_rolls_back_all_targets(self):
        before = self.studio.snapshot(["a", "b"])
        self.b.fail = True
        with self.assertRaises(RuntimeError):
            self.studio.apply(
                [
                    {"id": "a", "config": {"brightness": 0.7}},
                    {"id": "b", "config": {"brightness": 0.7}},
                ]
            )
        self.assertEqual(self.studio.snapshot(["a", "b"]), before)

    def test_overlap_is_rejected_before_edits(self):
        self.b.segments = self.a.segments
        before = self.studio.snapshot(["a", "b"])
        with self.assertRaisesRegex(ValueError, "overlaps"):
            self.studio.apply([{"id": "a", "type": "gradient"}])
        self.assertEqual(self.studio.snapshot(["a", "b"]), before)

    def test_missing_device_preflight(self):
        self.b._devices = []
        before = self.studio.snapshot(["a", "b"])
        with self.assertRaisesRegex(ValueError, "no configured"):
            self.studio.apply(
                [
                    {"id": "a", "type": "gradient"},
                    {"id": "b", "type": "gradient"},
                ]
            )
        self.assertEqual(self.studio.snapshot(["a", "b"]), before)

    def test_undo_rejects_external_changes(self):
        self.studio.apply([{"id": "a", "config": {"brightness": 0.7}}])
        self.a.active_effect.config["brightness"] = 0.2
        with self.assertRaisesRegex(ValueError, "changed elsewhere"):
            self.studio.undo()
        self.assertEqual(self.a.active_effect.config["brightness"], 0.2)

    def test_undo_rejects_new_outside_overlap(self):
        self.studio.apply([{"id": "a", "clear": True}])
        self.b.segments = self.a.segments
        with self.assertRaisesRegex(ValueError, "overlaps"):
            self.studio.undo()
        self.assertIsNone(self.a.active_effect)

    def test_library_persists_and_has_revision_conflicts(self):
        old = copy.deepcopy(self.studio.data)
        self.studio.save_library(copy.deepcopy(old))
        with self.assertRaisesRegex(ValueError, "another window"):
            self.studio.save_library(old)
        restored = Studio(self.ledfx)
        self.assertEqual(restored.data, self.studio.data)

    def test_effect_preset_cannot_save_color(self):
        data = copy.deepcopy(self.studio.data)
        data["effect_presets"]["x"] = {
            "name": "x",
            "virtuals": {
                "a": {"type": "singleColor", "config": {"color": "#ff0000"}}
            },
        }
        with self.assertRaisesRegex(ValueError, "colour fields"):
            self.studio.save_library(data)

    def test_theme_assignment_without_effect_is_retained(self):
        self.a.clear_effect()
        self.studio.apply([{"id": "a", "theme": "rose"}])
        self.assertIsNone(self.a.active_effect)
        self.studio.apply([{"id": "a", "type": "singleColor"}])
        self.assertEqual(
            self.a.active_effect.config["color"], THEME["primary"]
        )

    def test_colour_mapping_overrides(self):
        theme = copy.deepcopy(THEME)
        theme["mappings"] = {"singleColor": {"color": "accent"}}
        config = theme_config(SingleColorEffect, theme)
        self.assertEqual(config["color"], THEME["accent"])
        self.assertNotIn("brightness", config)


if __name__ == "__main__":
    unittest.main()
