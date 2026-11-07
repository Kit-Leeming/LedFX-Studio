export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const emptyWorkspace = () => ({
  version: 3,
  controllers: [],
  lights: [],
  patches: [],
  placements: [],
  groups: [],
  stage: { width: 8, height: 4.5 },
  globalPalette: "",
  overrides: {},
});
export const channels = {
  RGB: ["R", "G", "B"],
  RGBW: ["R", "G", "B", "W"],
  RGBUV: ["R", "G", "B", "UV"],
};
export const count = (l) =>
  l.kind === "matrix" ? l.columns * l.rows : l.kind === "point" ? 1 : l.pixels;
export function lightError(l) {
  if (!l.name?.trim()) return "Enter a light name.";
  if (
    !["point", "strip", "matrix"].includes(l.kind) ||
    !["standalone", "integrated"].includes(l.connection)
  )
    return "Choose a light type and connection type.";
  if (!channels[l.channelType]) return "Choose a supported channel layout.";
  if (l.connection === "integrated" && !l.virtualId)
    return "A built-in-controller light requires a configured LedFX output.";
  if (!Number.isInteger(count(l)) || count(l) < 1 || count(l) > 100000)
    return "Pixel count must be a whole number between 1 and 100,000.";
  if (
    l.kind === "matrix" &&
    (!Number.isInteger(l.columns) ||
      !Number.isInteger(l.rows) ||
      l.columns < 1 ||
      l.rows < 1)
  )
    return "Enter whole, positive matrix columns and rows.";
  if (
    l.kind === "strip" &&
    (!Number.isFinite(l.length) || l.length <= 0 || l.length > 100)
  )
    return "Strip length must be greater than 0 and no more than 100 metres.";
  if (
    l.kind !== "strip" &&
    ![l.width, l.height].every((n) => Number.isFinite(n) && n > 0 && n <= 100)
  )
    return "Enter physical width and height, between 0 and 100 metres.";
  if (
    l.connection === "standalone" &&
    (!l.protocol?.trim() || ![5, 12, 24].includes(l.voltage))
  )
    return "Standalone lights need a chipset/protocol and a 5, 12 or 24 V rating.";
  return "";
}
export function patchError(w, p) {
  const l = w.lights.find((l) => l.id === p.lightId),
    c = w.controllers.find((c) => c.id === p.controllerId),
    o = c?.outputs.find((o) => o.id === p.outputId);
  if (!l || !o) return "Choose a light, controller and output.";
  if (l.connection !== "standalone")
    return "Built-in-controller lights do not need a patch.";
  if (l.voltage !== o.voltage)
    return `Voltage mismatch: ${l.voltage} V light, ${o.voltage} V output.`;
  if (l.protocol.trim().toLowerCase() !== o.protocol.trim().toLowerCase())
    return "The output and light protocols must match.";
  if (
    channels[l.channelType].some((ch) => !channels[o.channelType]?.includes(ch))
  )
    return "Channel types do not match. UV and white are independent channels.";
  if (
    !Number.isInteger(p.start) ||
    p.start < 0 ||
    p.start + count(l) > o.capacity
  )
    return `This ${count(l)}-pixel light does not fit within the output’s ${o.capacity} pixels.`;
  if (
    w.patches.some((other) => {
      if (
        other.lightId === p.lightId ||
        other.controllerId !== p.controllerId ||
        other.outputId !== p.outputId
      )
        return false;
      const n = count(w.lights.find((l) => l.id === other.lightId));
      return p.start < other.start + n && other.start < p.start + count(l);
    })
  )
    return "This pixel range overlaps another light on that output.";
  return "";
}
export function stripPoints(length, bend = 0) {
  const a = (bend * Math.PI) / 180;
  if (Math.abs(a) < 0.0001) return [0, 0, length, 0];
  const r = length / a;
  return Array.from({ length: 65 }, (_, i) => {
    const t = (a * i) / 64;
    return [r * Math.sin(t), r * (1 - Math.cos(t))];
  }).flat();
}
export function rotated(points, deg) {
  const a = (deg * Math.PI) / 180;
  const out = [];
  for (let i = 0; i < points.length; i += 2)
    out.push(
      points[i] * Math.cos(a) - points[i + 1] * Math.sin(a),
      points[i] * Math.sin(a) + points[i + 1] * Math.cos(a),
    );
  return out;
}
export function footprint(l, p) {
  return l.kind === "strip"
    ? rotated(stripPoints(l.length, p.bend), p.rotation)
    : rotated([0, 0, l.width, 0, l.width, l.height, 0, l.height], p.rotation);
}
export function placementError(w, l, p) {
  if (
    ![p.x, p.y, p.rotation, p.bend].every(Number.isFinite) ||
    Math.abs(p.bend) > 180
  )
    return "Enter valid coordinates, rotation and a bend between −180° and 180°.";
  const a = footprint(l, p);
  for (let i = 0; i < a.length; i += 2)
    if (
      p.x + a[i] < -0.001 ||
      p.y + a[i + 1] < -0.001 ||
      p.x + a[i] > w.stage.width + 0.001 ||
      p.y + a[i + 1] > w.stage.height + 0.001
    )
      return "The light would extend beyond the stage. Adjust its position or increase the stage dimensions.";
  return "";
}
export function initialPlacement(w, l) {
  const base = {
    lightId: l.id,
    x: 0.25,
    y: 0.5,
    rotation: 0,
    bend: 0,
    locked: false,
  };
  const extent = (light, p) => {
    const pts = footprint(light, p),
      xs = pts.filter((_, i) => i % 2 === 0),
      ys = pts.filter((_, i) => i % 2 === 1);
    return {
      left: p.x + Math.min(...xs),
      right: p.x + Math.max(...xs),
      top: p.y + Math.min(...ys),
      bottom: p.y + Math.max(...ys),
    };
  };
  const occupied = w.placements.map((p) =>
    extent(
      w.lights.find((x) => x.id === p.lightId),
      p,
    ),
  );
  const candidates = [
    [0.25, 0.5],
    [0, 0],
    ...occupied.flatMap((b) => [
      [b.right + 0.25, b.top],
      [b.left, b.bottom + 0.25],
    ]),
  ]
    .map(([x, y]) => ({ ...base, x, y }))
    .filter((p) => !placementError(w, l, p));
  return (
    candidates.find((p) => {
      const b = extent(l, p);
      return !occupied.some(
        (o) =>
          b.left < o.right + 0.1 &&
          b.right > o.left - 0.1 &&
          b.top < o.bottom + 0.1 &&
          b.bottom > o.top - 0.1,
      );
    }) ||
    candidates[0] ||
    base
  );
}
export function removeLight(w, id) {
  return {
    ...w,
    lights: w.lights.filter((l) => l.id !== id),
    patches: w.patches.filter((p) => p.lightId !== id),
    placements: w.placements.filter((p) => p.lightId !== id),
    groups: w.groups.map((g) => ({
      ...g,
      lightIds: g.lightIds.filter((x) => x !== id),
    })),
    overrides: Object.fromEntries(
      Object.entries(w.overrides).filter(([k]) => k !== id),
    ),
  };
}
export function validateWorkspace(w) {
  if (
    !w ||
    w.version !== 3 ||
    !["controllers", "lights", "patches", "placements", "groups"].every((k) =>
      Array.isArray(w[k]),
    )
  )
    throw Error(
      "Unsupported Studio workspace. Export a backup before replacing it.",
    );
  if (
    ![w.stage?.width, w.stage?.height].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 100,
    )
  )
    throw Error("Invalid stage dimensions.");
  for (const k of ["controllers", "lights", "groups"]) {
    const ids = w[k].map((x) => x.id);
    if (
      ids.some((id) => typeof id !== "string" || !id) ||
      new Set(ids).size !== ids.length
    )
      throw Error("Missing or duplicate item identity.");
  }
  for (const l of w.lights) {
    const e = lightError(l);
    if (e) throw Error(e);
  }
  for (const c of w.controllers) {
    if (!c.name?.trim() || !Array.isArray(c.outputs) || !c.outputs.length)
      throw Error("A controller needs a name and at least one output.");
    for (const o of c.outputs)
      if (
        !o.name?.trim() ||
        !o.protocol?.trim() ||
        !channels[o.channelType] ||
        ![5, 12, 24].includes(o.voltage) ||
        !Number.isInteger(o.capacity) ||
        o.capacity < 1 ||
        o.capacity > 100000
      )
        throw Error("Invalid controller output.");
  }
  for (const p of w.patches) {
    const e = patchError(w, p);
    if (e) throw Error(e);
  }
  if (
    new Set(w.patches.map((p) => p.lightId)).size !== w.patches.length ||
    new Set(w.placements.map((p) => p.lightId)).size !== w.placements.length
  )
    throw Error("A light can only have one patch and stage placement.");
  for (const p of w.placements) {
    const l = w.lights.find((l) => l.id === p.lightId);
    if (!l) throw Error("A stage placement references a missing light.");
    const e = placementError(w, l, p);
    if (e) throw Error(e);
  }
  return w;
}
