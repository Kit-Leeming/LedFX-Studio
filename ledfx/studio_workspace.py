"""Physical Studio definitions; validation never provisions controller hardware."""

import math

CHANNELS = {
    "RGB": {"R", "G", "B"},
    "RGBW": {"R", "G", "B", "W"},
    "RGBUV": {"R", "G", "B", "UV"},
}


def number(value, low, high):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and low <= value <= high
    )


def pixel_count(light):
    return (
        light.get("columns", 0) * light.get("rows", 0)
        if light.get("kind") == "matrix"
        else 1
        if light.get("kind") == "point"
        else light.get("pixels", 0)
    )


def validate_workspace(w):
    if not isinstance(w, dict) or w.get("version") != 3:
        raise ValueError("Unsupported Studio workspace")
    for key in ("controllers", "lights", "patches", "placements", "groups"):
        if not isinstance(w.get(key), list) or any(
            not isinstance(item, dict) for item in w[key]
        ):
            raise TypeError(f"Studio {key} must be a list")
    for key in ("controllers", "lights", "groups"):
        ids = [item.get("id") for item in w[key] if isinstance(item, dict)]
        if (
            len(ids) != len(w[key])
            or any(not isinstance(i, str) or not i for i in ids)
            or len(set(ids)) != len(ids)
        ):
            raise ValueError("Missing or duplicate Studio identity")
    stage = w.get("stage", {})
    if not isinstance(stage, dict) or not all(
        number(stage.get(k), 0.01, 100) for k in ("width", "height")
    ):
        raise ValueError("Invalid stage dimensions")
    lights = {l["id"]: l for l in w["lights"]}
    for l in lights.values():
        if (
            not isinstance(l.get("name"), str)
            or not l["name"].strip()
            or l.get("kind") not in ("point", "strip", "matrix")
            or l.get("connection") not in ("standalone", "integrated")
            or l.get("channelType") not in CHANNELS
        ):
            raise ValueError("Invalid light definition")
        if l["kind"] == "matrix" and any(
            not number(l.get(k), 1, 100000) or int(l[k]) != l[k]
            for k in ("columns", "rows")
        ):
            raise ValueError("Invalid matrix pixel dimensions")
        n = pixel_count(l)
        if not number(n, 1, 100000) or int(n) != n:
            raise ValueError("Invalid pixel count")
        if l["kind"] == "strip":
            if not number(l.get("length"), 0.00001, 100):
                raise ValueError("Invalid physical strip length")
        elif not all(number(l.get(k), 0.00001, 100) for k in ("width", "height")):
            raise ValueError("Invalid physical light dimensions")
        if l["connection"] == "integrated" and not l.get("virtualId"):
            raise ValueError(
                "Built-in-controller lights require a configured LedFX output"
            )
    outputs = {}
    for c in w["controllers"]:
        if (
            not isinstance(c.get("name"), str)
            or not c["name"].strip()
            or not isinstance(c.get("outputs"), list)
            or not c["outputs"]
        ):
            raise ValueError("Controller needs a name and outputs")
        for o in c["outputs"]:
            if (
                not isinstance(o, dict)
                or not o.get("id")
                or (c["id"], o["id"]) in outputs
                or not o.get("name", "").strip()
                or not o.get("protocol", "").strip()
                or o.get("channelType") not in CHANNELS
                or o.get("voltage") not in (5, 12, 24)
                or not number(o.get("capacity"), 1, 100000)
                or int(o["capacity"]) != o["capacity"]
            ):
                raise ValueError("Invalid controller output")
            outputs[c["id"], o["id"]] = o
    patches = {}
    for p in w["patches"]:
        l = lights.get(p.get("lightId"))
        o = outputs.get((p.get("controllerId"), p.get("outputId")))
        if not l or not o or l["connection"] != "standalone" or l["id"] in patches:
            raise ValueError("Invalid or duplicate physical patch")
        if (
            l.get("voltage") != o["voltage"]
            or l.get("protocol", "").strip().lower() != o["protocol"].strip().lower()
            or not CHANNELS[l["channelType"]] <= CHANNELS[o["channelType"]]
        ):
            raise ValueError(
                "Patch voltage, protocol or channel mismatch; UV is independent"
            )
        if (
            not number(p.get("start"), 0, o["capacity"])
            or int(p["start"]) != p["start"]
            or p["start"] + pixel_count(l) > o["capacity"]
        ):
            raise ValueError("Patch exceeds output pixel capacity")
        for other in patches.values():
            if (
                (other["controllerId"], other["outputId"])
                == (p["controllerId"], p["outputId"])
                and p["start"] < other["start"] + pixel_count(lights[other["lightId"]])
                and other["start"] < p["start"] + pixel_count(l)
            ):
                raise ValueError("Physical patch ranges overlap")
        patches[l["id"]] = p
    placed = set()
    for p in w["placements"]:
        l = lights.get(p.get("lightId"))
        if (
            not l
            or l["id"] in placed
            or not all(
                number(p.get(k), -100000, 100000) for k in ("x", "y", "rotation")
            )
            or not number(p.get("bend"), -180, 180)
        ):
            raise ValueError("Invalid stage placement")
        placed.add(l["id"])
        points = [
            (0, 0),
            (l.get("width", 0), 0),
            (l.get("width", 0), l.get("height", 0)),
            (0, l.get("height", 0)),
        ]
        if l["kind"] == "strip":
            angle = math.radians(p["bend"])
            points = (
                [(0, 0), (l["length"], 0)]
                if abs(angle) < 0.0001
                else [
                    (
                        l["length"] / angle * math.sin(angle * i / 64),
                        l["length"] / angle * (1 - math.cos(angle * i / 64)),
                    )
                    for i in range(65)
                ]
            )
        a = math.radians(p["rotation"])
        for x, y in points:
            xx, yy = (
                p["x"] + x * math.cos(a) - y * math.sin(a),
                p["y"] + x * math.sin(a) + y * math.cos(a),
            )
            if (
                not -0.001 <= xx <= stage["width"] + 0.001
                or not -0.001 <= yy <= stage["height"] + 0.001
            ):
                raise ValueError("A light extends beyond the stage")
    bound = [l["virtualId"] for l in lights.values() if l.get("virtualId")]
    if len(bound) != len(set(bound)):
        raise ValueError("Each light needs its own LedFX output")
    for group in w["groups"]:
        if (
            not group.get("name", "").strip()
            or not isinstance(group.get("lightIds"), list)
            or any(i not in lights for i in group["lightIds"])
        ):
            raise ValueError("Invalid light group")
    if not isinstance(w.get("overrides"), dict) or any(
        i not in lights for i in w["overrides"]
    ):
        raise ValueError("Invalid palette overrides")
