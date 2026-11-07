import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkspace,
  lightError,
  count,
  stripPoints,
  patchError,
  placementError,
  validateWorkspace,
  removeLight,
} from "../src/domain.js";
const light = (id = "strip") => ({
  id,
  name: id,
  kind: "strip",
  connection: "standalone",
  channelType: "RGB",
  pixels: 60,
  length: 2,
  width: 1,
  height: 1,
  protocol: "SM16703",
  voltage: 12,
  virtualId: "",
});
const setup = () => ({
  ...emptyWorkspace(),
  lights: [light()],
  controllers: [
    {
      id: "c",
      name: "Controller",
      outputs: [
        {
          id: "o",
          name: "Output",
          voltage: 12,
          protocol: "SM16703",
          channelType: "RGB",
          capacity: 120,
        },
      ],
    },
  ],
});
test("standalone light can exist without a controller; matrix count is separate from physical size", () => {
  assert.equal(lightError(light()), "");
  const m = {
    ...light(),
    kind: "matrix",
    columns: 10,
    rows: 20,
    width: 2,
    height: 1,
  };
  assert.equal(count(m), 200);
  assert.equal(lightError(m), "");
  assert.equal(
    validateWorkspace({ ...emptyWorkspace(), lights: [light()] }).controllers
      .length,
    0,
  );
});
test("strip bending preserves its physical arc length", () => {
  for (const bend of [-180, -90, 0, 90, 180]) {
    const p = stripPoints(3, bend);
    let total = 0;
    for (let i = 2; i < p.length; i += 2)
      total += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    assert.ok(Math.abs(total - 3) < 0.0004);
  }
});
test("patch rejects voltage, protocol, UV conversion, overlap and capacity mismatch", () => {
  const w = setup(),
    p = {
      lightId: "strip",
      controllerId: "c",
      outputId: "o",
      start: 0,
      reversed: false,
    };
  assert.equal(patchError(w, p), "");
  w.controllers[0].outputs[0].voltage = 5;
  assert.match(patchError(w, p), /Voltage/);
  w.controllers[0].outputs[0].voltage = 12;
  w.lights[0].protocol = "Other";
  assert.match(patchError(w, p), /protocol/);
  w.lights[0].protocol = "SM16703";
  w.lights[0].channelType = "RGBUV";
  assert.match(patchError(w, p), /UV/);
  w.lights[0].channelType = "RGB";
  assert.match(patchError(w, { ...p, start: 100 }), /does not fit/);
  w.lights.push(light("second"));
  w.patches = [p];
  assert.match(patchError(w, { ...p, lightId: "second" }), /overlaps/);
});
test("integrated lights bypass patching", () => {
  const w = setup();
  w.lights[0].connection = "integrated";
  assert.match(
    patchError(w, {
      lightId: "strip",
      controllerId: "c",
      outputId: "o",
      start: 0,
    }),
    /Built-in/,
  );
});
test("stage enforces bounds without resizing or redistributing lights", () => {
  const w = setup(),
    l = w.lights[0],
    p = { lightId: l.id, x: 1, y: 1, rotation: 0, bend: 0, locked: false };
  assert.equal(placementError(w, l, p), "");
  assert.match(placementError(w, l, { ...p, x: 7 }), /beyond/);
  assert.equal(l.length, 2);
  w.placements = [p];
  w.stage.width = 2;
  assert.throws(() => validateWorkspace(w), /beyond/);
});
test("deleting a light clears its patch, placement, override and group membership only", () => {
  const w = setup();
  w.lights.push(light("keep"));
  w.patches = [{ lightId: "strip" }];
  w.placements = [{ lightId: "strip" }];
  w.overrides = { strip: "theme", keep: "theme" };
  w.groups = [{ id: "g", name: "Test", lightIds: ["strip", "keep"] }];
  const n = removeLight(w, "strip");
  assert.equal(n.lights[0].id, "keep");
  assert.equal(n.patches.length, 0);
  assert.equal(n.placements.length, 0);
  assert.deepEqual(n.groups[0].lightIds, ["keep"]);
  assert.deepEqual(n.overrides, { keep: "theme" });
  assert.equal(w.lights.length, 2);
});
