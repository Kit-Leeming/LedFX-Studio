"""Portable Studio presets and transactional edits, independent of legacy scenes."""

import copy
import json
import os
from pathlib import Path

from ledfx.api.utils import convertToJsonSchema
from ledfx.color import validate_color, validate_gradient
from ledfx.config import save_config
from ledfx.effects import DummyEffect

COLLECTIONS = ("rigs", "themes", "effect_presets", "color_presets", "scenes")
ROLES = ("gradient", "primary", "accent", "background")


def empty_library():
    return {
        "version": 1,
        "revision": 0,
        **{k: {} for k in COLLECTIONS},
        "assignments": {},
    }


def color_fields(effect_class):
    props = convertToJsonSchema(effect_class.schema())["properties"]
    return {
        k: (
            "gradient"
            if v.get("gradient")
            else (
                "background"
                if "background" in k
                else (
                    "accent"
                    if any(t in k for t in ("mid", "high", "secondary", "accent"))
                    else "primary"
                )
            )
        )
        for k, v in props.items()
        if v.get("type") == "color"
    }


def theme_config(effect_class, theme):
    mapping = color_fields(effect_class)
    overrides = theme.get("mappings", {}).get(
        effect_class.__module__.rsplit(".", 1)[-1], {}
    )
    for key, role in overrides.items():
        if key not in mapping or role not in ROLES:
            raise ValueError(f"Invalid theme mapping: {key} → {role}")
        mapping[key] = role
    return {key: theme[role] for key, role in mapping.items()}


class Studio:
    def __init__(self, ledfx):
        self.ledfx = ledfx
        self.path = Path(ledfx.config_dir) / "studio.json"
        self.data = (
            json.loads(self.path.read_text(encoding="utf-8"))
            if self.path.exists()
            else empty_library()
        )
        self.validate(self.data)
        self.history = []

    def validate(self, data):
        if not isinstance(data, dict) or data.get("version") != 1:
            raise TypeError("Unsupported Studio library version")
        for key in (*COLLECTIONS, "assignments"):
            if not isinstance(data.get(key), dict):
                raise TypeError(f"Studio {key} must be an object")
        for collection in COLLECTIONS:
            for identifier, item in data[collection].items():
                if (
                    not isinstance(identifier, str)
                    or not isinstance(item, dict)
                    or not isinstance(item.get("name"), str)
                    or not item["name"].strip()
                ):
                    raise ValueError(f"Every {collection} entry needs an ID and name")
        for theme in data["themes"].values():
            validate_gradient(theme["gradient"])
            for role in ROLES[1:]:
                validate_color(theme[role])
            for effect_type, mapping in theme.get("mappings", {}).items():
                cls = self.ledfx.effects.get_class(effect_type)
                fields = color_fields(cls)
                if not isinstance(mapping, dict) or any(
                    k not in fields or v not in ROLES for k, v in mapping.items()
                ):
                    raise ValueError(f"Invalid mapping for {effect_type}")
        for rig in data["rigs"].values():
            if not isinstance(rig.get("virtuals"), list) or not all(
                isinstance(v, str) for v in rig["virtuals"]
            ):
                raise TypeError("Rig virtuals must be a list of IDs")
            if not isinstance(rig.get("groups", {}), dict) or any(
                not isinstance(ids, list) or any(v not in rig["virtuals"] for v in ids)
                for ids in rig.get("groups", {}).values()
            ):
                raise ValueError("Rig groups must contain rig members")
        theme_ids = data["themes"]
        if any(t not in theme_ids for t in data["assignments"].values()):
            raise ValueError("An assigned theme is missing")
        for preset in data["color_presets"].values():
            for key in ("groups", "overrides"):
                if not isinstance(preset.get(key, {}), dict) or any(
                    t not in theme_ids for t in preset.get(key, {}).values()
                ):
                    raise ValueError("A colour arrangement references a missing theme")
        for preset in data["effect_presets"].values():
            if not isinstance(preset.get("virtuals"), dict):
                raise TypeError("Effect arrangements need virtuals")
            for effect in preset["virtuals"].values():
                if effect is not None:
                    cls = self.ledfx.effects.get_class(effect["type"])
                    if not isinstance(effect.get("config"), dict) or set(
                        effect["config"]
                    ) & set(color_fields(cls)):
                        raise ValueError(
                            "Effect arrangements cannot include colour fields"
                        )
                    cls.schema()(effect["config"])
        for scene in data["scenes"].values():
            if (
                scene.get("effect") not in data["effect_presets"]
                or scene.get("color") not in data["color_presets"]
            ):
                raise ValueError("A scene references a missing arrangement")

    def write(self, data):
        self.validate(data)
        data = copy.deepcopy(data)
        data["revision"] = self.data["revision"] + 1
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(".json.tmp")
        temp.write_text(json.dumps(data, indent=2, allow_nan=False), encoding="utf-8")
        os.replace(temp, self.path)
        self.data = data

    def save_library(self, data):
        if data.get("revision") != self.data["revision"]:
            raise ValueError("Studio changed in another window. Refresh before saving.")
        self.write(data)

    def snapshot(self, ids):
        result = {}
        for identifier in ids:
            v = self.ledfx.virtuals.get(identifier)
            if v is None:
                raise ValueError(f"Missing virtual: {identifier}")
            effect = v.active_effect
            result[identifier] = {
                "effect": (
                    {
                        "type": effect.type,
                        "config": copy.deepcopy(effect.config),
                    }
                    if effect and not isinstance(effect, DummyEffect)
                    else None
                ),
                "active": v.active,
                "saved": copy.deepcopy(v.virtual_cfg),
            }
        return result

    def check_overlaps(self, virtuals, exclude):
        # LedFX normally forces overlapping virtuals off. Studio promises to
        # leave other lights untouched, so reject conflicting edits instead.
        outsiders = [
            v for v in self.ledfx.virtuals.values() if v.id not in exclude and v.active
        ]

        def overlaps(a, b):
            return any(
                da == db and not da.startswith("gap-") and max(sa, sb) <= min(ea, eb)
                for da, sa, ea, _ in a.segments
                for db, sb, eb, _ in b.segments
            )

        for i, virtual in enumerate(virtuals):
            for other in outsiders + virtuals[i + 1 :]:
                if overlaps(virtual, other):
                    raise ValueError(
                        f"{virtual.name} overlaps {other.name}. Choose non-overlapping virtuals; their output has been left unchanged."
                    )

    def restore(self, snapshot):
        for identifier in snapshot:
            self.ledfx.virtuals.get(identifier).active = False
        for identifier, item in sorted(
            snapshot.items(), key=lambda pair: pair[1]["active"]
        ):
            v = self.ledfx.virtuals.get(identifier)
            effect = item["effect"]
            if effect:
                v.set_effect(
                    self.ledfx.effects.create(
                        ledfx=self.ledfx,
                        type=effect["type"],
                        config=effect["config"],
                    )
                )
                v.active = item["active"]
            else:
                v.clear_effect()
            v.virtual_cfg.clear()
            v.virtual_cfg.update(copy.deepcopy(item["saved"]))

    def apply(self, changes):
        if not isinstance(changes, list) or not changes:
            raise ValueError("Select at least one light")
        ids = [c["id"] for c in changes]
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate virtual in batch")
        before = self.snapshot(ids)
        old_data = copy.deepcopy(self.data)
        new_data = copy.deepcopy(self.data)
        prepared = []
        for change in changes:
            identifier = change["id"]
            v = self.ledfx.virtuals.get(identifier)
            if v.streaming:
                raise ValueError(f"{v.name} is currently receiving a stream")
            if "theme" in change:
                theme_id = change["theme"]
                if theme_id not in self.data["themes"]:
                    raise ValueError("Unknown colour theme")
                new_data["assignments"][identifier] = theme_id
            if change.get("clear"):
                prepared.append((v, None, False))
                continue
            current = before[identifier]["effect"]
            effect_type = change.get("type", current["type"] if current else None)
            if not effect_type:
                if "theme" in change:
                    continue  # Keep the assignment for the next effect.
                raise ValueError(f"{v.name} has no effect to edit")
            cls = self.ledfx.effects.get_class(effect_type)
            config = copy.deepcopy(
                current["config"]
                if current and current["type"] == effect_type
                else v.get_effects_config(effect_type)
            )
            patch = change.get("config", {})
            if not isinstance(patch, dict):
                raise TypeError("Settings must be an object")
            if set(patch) & set(color_fields(cls)):
                raise ValueError("Use a theme to edit colour fields")
            config.update(patch)
            theme_id = new_data["assignments"].get(identifier)
            if theme_id:
                config.update(theme_config(cls, new_data["themes"][theme_id]))
            # Effect.update_config logs and returns for some invalid values.
            # Validate here so a batch cannot silently accept an invalid config.
            config = cls.schema()(config)
            effect = self.ledfx.effects.create(
                ledfx=self.ledfx, type=effect_type, config=config
            )
            prepared.append(
                (
                    v,
                    effect,
                    (before[identifier]["active"] if "type" not in change else True),
                )
            )
        self.check_overlaps([v for v, effect, active in prepared if effect], ids)
        for v, effect, active in prepared:
            if effect and not v._devices:
                raise ValueError(f"{v.name} has no configured device segments")
        try:
            for v, effect, active in sorted(
                prepared, key=lambda item: item[1] is not None
            ):
                if effect:
                    v.set_effect(effect)
                    v.active = active
                    v.update_effect_config(effect)
                else:
                    v.clear_effect()
                    v.virtual_cfg.pop("effect", None)
            save_config(config=self.ledfx.config, config_dir=self.ledfx.config_dir)
            self.write(new_data)
        except Exception:
            self.restore(before)
            save_config(config=self.ledfx.config, config_dir=self.ledfx.config_dir)
            raise
        self.history.append(
            {
                "before": before,
                "after": self.snapshot(ids),
                "assignments": old_data["assignments"],
                "after_assignments": copy.deepcopy(self.data["assignments"]),
            }
        )
        self.history = self.history[-30:]

    def undo(self):
        if not self.history:
            raise ValueError("Nothing to undo in this server session")
        item = self.history[-1]
        if (
            self.snapshot(item["after"]) != item["after"]
            or self.data["assignments"] != item["after_assignments"]
        ):
            raise ValueError(
                "Lights changed elsewhere. Undo would overwrite those changes."
            )
        data = copy.deepcopy(self.data)
        data["assignments"] = item["assignments"]
        self.validate(data)
        self.check_overlaps(
            [
                self.ledfx.virtuals.get(i)
                for i, s in item["before"].items()
                if s["active"]
            ],
            item["before"],
        )
        try:
            self.restore(item["before"])
            save_config(config=self.ledfx.config, config_dir=self.ledfx.config_dir)
            self.write(data)
        except Exception:
            self.restore(item["after"])
            save_config(config=self.ledfx.config, config_dir=self.ledfx.config_dir)
            raise
        self.history.pop()
