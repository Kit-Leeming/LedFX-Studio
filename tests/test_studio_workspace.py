import copy
import unittest

from ledfx.studio_workspace import validate_workspace
from tests import test_studio as fixtures

THEME = fixtures.THEME


def workspace():
    return {
        "version": 3,
        "lights": [
            {
                "id": "l",
                "name": "Strip",
                "kind": "strip",
                "connection": "standalone",
                "channelType": "RGB",
                "pixels": 10,
                "length": 2,
                "voltage": 12,
                "protocol": "SM16703",
                "virtualId": "a",
            }
        ],
        "controllers": [
            {
                "id": "c",
                "name": "Controller",
                "outputs": [
                    {
                        "id": "o",
                        "name": "Output",
                        "voltage": 12,
                        "protocol": "SM16703",
                        "channelType": "RGB",
                        "capacity": 60,
                    }
                ],
            }
        ],
        "patches": [],
        "placements": [],
        "groups": [],
        "stage": {"width": 8, "height": 4.5},
        "overrides": {},
        "globalPalette": "",
    }


class WorkspaceValidation(unittest.TestCase):
    def test_physical_dimensions_and_bounds(self):
        w = workspace()
        w["placements"] = [{"lightId": "l", "x": 1, "y": 1, "rotation": 0, "bend": 180}]
        validate_workspace(w)
        w["placements"][0]["x"] = 8
        with self.assertRaisesRegex(ValueError, "beyond"):
            validate_workspace(w)

    def test_integrated_requires_real_output_and_no_patch(self):
        w = workspace()
        w["lights"][0]["connection"] = "integrated"
        w["lights"][0]["virtualId"] = ""
        with self.assertRaisesRegex(ValueError, "configured"):
            validate_workspace(w)
        w["lights"][0]["virtualId"] = "a"
        w["patches"] = [
            {"lightId": "l", "controllerId": "c", "outputId": "o", "start": 0}
        ]
        with self.assertRaisesRegex(ValueError, "patch"):
            validate_workspace(w)

    def test_uv_and_overlap_validation(self):
        w = workspace()
        w["patches"] = [
            {"lightId": "l", "controllerId": "c", "outputId": "o", "start": 0}
        ]
        validate_workspace(w)
        w["lights"][0]["channelType"] = "RGBUV"
        with self.assertRaisesRegex(ValueError, "independent"):
            validate_workspace(w)
        w["lights"][0]["channelType"] = "RGB"
        other = {**w["lights"][0], "id": "other", "virtualId": "b"}
        w["lights"].append(other)
        w["patches"].append({**w["patches"][0], "lightId": "other"})
        with self.assertRaisesRegex(ValueError, "overlap"):
            validate_workspace(w)


class WorkspaceTransactions(unittest.TestCase):
    setUp = fixtures.StudioTests.setUp
    tearDown = fixtures.StudioTests.tearDown

    def test_unavailable_builtin_output_cannot_be_saved(self):
        data = copy.deepcopy(self.studio.data)
        data["workspace"] = workspace()
        data["workspace"]["lights"][0].update(
            connection="integrated", virtualId="missing"
        )
        with self.assertRaisesRegex(ValueError, "existing LedFX device output"):
            self.studio.save_library(data)

    def test_undo_checks_identity_before_restoring_another_windows_effect(self):
        self.studio.apply([{"id": "a", "type": "scroll"}])
        first = self.studio.history[-1]["id"]
        self.studio.apply([{"id": "a", "type": "singleColor"}])
        with self.assertRaisesRegex(ValueError, "Another window"):
            self.studio.undo(expected_id=first)
        self.assertEqual(self.a.active_effect.type, "singleColor")

    def test_workspace_and_palette_effect_apply_are_undone_together(self):
        data = copy.deepcopy(self.studio.data)
        data["workspace"] = workspace()
        data["themes"]["t"] = copy.deepcopy(THEME)
        self.studio.save_library(data)
        next_w = copy.deepcopy(data["workspace"])
        next_w["globalPalette"] = "t"
        self.studio.apply([{"id": "a", "theme": "t"}], workspace=next_w)
        self.assertEqual(self.studio.data["workspace"]["globalPalette"], "t")
        self.studio.undo()
        self.assertEqual(self.studio.data["workspace"]["globalPalette"], "")

    def test_invalid_workspace_does_not_change_output(self):
        before = copy.deepcopy(self.a.active_effect.config)
        bad = workspace()
        bad["lights"][0]["length"] = -1
        with self.assertRaises(ValueError):
            self.studio.apply([{"id": "a", "type": "scroll"}], workspace=bad)
        self.assertEqual(self.a.active_effect.config, before)
