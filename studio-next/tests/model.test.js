import test from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  patch,
  setPalette,
  snapshotRig,
  loadRig,
  parseProject,
} from "../src/model.js";
test("patch rejects wrong voltage and leaves the input untouched", () => {
  const s = initial(),
    before = structuredClone(s);
  s.controllers[0].ports[0].voltage = 5;
  assert.throws(
    () =>
      patch(s, {
        controllerId: "c1",
        portId: "p1",
        fixtureId: "f1",
        start: 0,
        count: 60,
      }),
    /Voltage/,
  );
  assert.equal(s.connections.length, before.connections.length);
});
test("overlapping ranges and pixel count errors cannot be patched", () => {
  const s = initial();
  assert.throws(
    () =>
      patch(s, {
        controllerId: "c1",
        portId: "p1",
        fixtureId: "f2",
        start: 30,
        count: 60,
      }),
    /overlaps/,
  );
  assert.throws(
    () =>
      patch(s, {
        controllerId: "c1",
        portId: "p1",
        fixtureId: "f1",
        start: 0,
        count: 61,
      }),
    /60 pixels/,
  );
});
test("UV cannot be silently mapped to RGBW", () => {
  const s = initial();
  s.controllers[1].ports[0].channels = ["R", "G", "B", "W"];
  assert.throws(() => patch(s, s.connections[2]), /UV must remain independent/);
});
test("global colour preserves local override, effects and UV", () => {
  const s = initial();
  s.fixtures[0].paletteId = "ember";
  s.fixtures[2].uv = 23;
  const next = setPalette(s, "ocean");
  assert.equal(next.globalPalette, "ocean");
  assert.equal(next.fixtures[0].paletteId, "ember");
  assert.equal(next.fixtures[2].uv, 23);
  assert.deepEqual(next.fixtures, s.fixtures);
});
test("local colour affects only selected fixtures", () => {
  const s = initial(),
    next = setPalette(s, "ember", ["f2"]);
  assert.equal(next.fixtures[0].paletteId, null);
  assert.equal(next.fixtures[1].paletteId, "ember");
  assert.equal(next.globalPalette, "aurora");
});
test("rig retains geometry and fixture identities through absence and reconnect", () => {
  const s = initial(),
    rig = snapshotRig(s, "Test");
  s.controllers[0].online = false;
  s.geometry[0].x = 999;
  const next = loadRig(s, rig);
  assert.equal(next.controllers[0].online, false);
  assert.equal(next.geometry[0].x, 140);
  assert.equal(next.fixtures[0].id, "f1");
});
test("reject malformed or incompatible imports without replacing a project", () => {
  assert.throws(() => parseProject("{}"), /v2/);
  const s = initial();
  s.connections[0].count = 100;
  assert.throws(() => parseProject(JSON.stringify(s)), /60 pixels/);
  assert.deepEqual(parseProject(JSON.stringify(initial())), initial());
});
test("rig recall restores membership and geometry while preserving current look", () => {
  const s = initial(),
    rig = snapshotRig(s, "Geometry only");
  s.fixtures[0].effect = "Wave";
  s.fixtures[0].paletteId = "ember";
  s.fixtures[0].uv = 15;
  const restored = loadRig(s, rig);
  assert.equal(restored.fixtures[0].effect, "Wave");
  assert.equal(restored.fixtures[0].paletteId, "ember");
  assert.equal(restored.fixtures[0].uv, 15);
});
test("invalid geometry and duplicate identities are rejected before import", () => {
  const s = initial();
  s.geometry[0].points = [0, "bad"];
  assert.throws(() => parseProject(JSON.stringify(s)), /geometry/);
  const other = initial();
  other.fixtures[1].id = "f1";
  assert.throws(() => parseProject(JSON.stringify(other)), /duplicate/);
});
