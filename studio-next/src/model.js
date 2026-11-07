// randomUUID is unavailable on plain-HTTP LAN origins. IDs are local demo identities, not secrets.
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const profiles = [
  {
    id: "rgb",
    name: "Addressable RGB strip",
    kind: "strip",
    channels: ["R", "G", "B"],
    voltage: 12,
    pixels: 60,
    protocol: "SM16703",
  },
  {
    id: "rgbw",
    name: "Addressable RGBW strip",
    kind: "strip",
    channels: ["R", "G", "B", "W"],
    voltage: 5,
    pixels: 60,
    protocol: "SK6812",
  },
  {
    id: "wash",
    name: "RGB wash",
    kind: "wash",
    channels: ["R", "G", "B"],
    voltage: 12,
    pixels: 1,
    protocol: "PWM",
  },
  {
    id: "uv",
    name: "RGB + UV wash",
    kind: "wash",
    channels: ["R", "G", "B", "UV"],
    voltage: 12,
    pixels: 1,
    protocol: "PWM",
  },
];
export const palettes = [
  { id: "aurora", name: "Aurora", colors: ["#79f2c0", "#60adff", "#bf91ff"] },
  { id: "ember", name: "Ember", colors: ["#ffb35c", "#ff6875", "#bd65ff"] },
  { id: "ocean", name: "Ocean", colors: ["#5ff5df", "#559bff", "#6964e8"] },
];
export const initial = () => ({
  schemaVersion: 2,
  controllers: [
    {
      id: "c1",
      name: "Stage controller",
      address: "192.0.2.10",
      online: true,
      ports: [
        {
          id: "p1",
          name: "LED 1",
          voltage: 12,
          protocol: "SM16703",
          capacity: 300,
          channels: ["R", "G", "B"],
        },
        {
          id: "p2",
          name: "LED 2",
          voltage: 12,
          protocol: "SM16703",
          capacity: 300,
          channels: ["R", "G", "B"],
        },
      ],
    },
    {
      id: "c2",
      name: "Wash controller",
      address: "192.0.2.20",
      online: false,
      ports: [
        {
          id: "p3",
          name: "PWM A",
          voltage: 12,
          protocol: "PWM",
          capacity: 1,
          channels: ["R", "G", "B", "UV"],
        },
      ],
    },
  ],
  profiles: structuredClone(profiles),
  fixtures: [
    {
      id: "f1",
      name: "Left arch",
      profileId: "rgb",
      effect: "Energy",
      paletteId: null,
      uv: 0,
    },
    {
      id: "f2",
      name: "Right arch",
      profileId: "rgb",
      effect: "Energy",
      paletteId: null,
      uv: 0,
    },
    {
      id: "f3",
      name: "Centre wash",
      profileId: "uv",
      effect: "Solid",
      paletteId: null,
      uv: 0,
    },
  ],
  connections: [
    {
      id: "a",
      controllerId: "c1",
      portId: "p1",
      fixtureId: "f1",
      start: 0,
      count: 60,
      reversed: false,
    },
    {
      id: "b",
      controllerId: "c1",
      portId: "p2",
      fixtureId: "f2",
      start: 0,
      count: 60,
      reversed: true,
    },
    {
      id: "c",
      controllerId: "c2",
      portId: "p3",
      fixtureId: "f3",
      start: 0,
      count: 1,
      reversed: false,
    },
  ],
  geometry: [
    {
      fixtureId: "f1",
      x: 140,
      y: 130,
      kind: "curve",
      points: [0, 220, 0, 70, 110, 0, 210, 70],
    },
    {
      fixtureId: "f2",
      x: 480,
      y: 130,
      kind: "curve",
      points: [0, 70, 110, 0, 210, 70, 210, 220],
    },
    { fixtureId: "f3", x: 410, y: 365, kind: "wash", points: [] },
  ],
  decor: [{ id: "desk", x: 330, y: 410, name: "DJ booth" }],
  groups: [{ id: "strips", name: "LED strips", fixtureIds: ["f1", "f2"] }],
  globalPalette: "aurora",
  rigs: [],
  effectPresets: [],
  colourPresets: [],
  scenes: [],
});
export function validateConnection(state, c) {
  const controller = state.controllers.find((x) => x.id === c.controllerId),
    port = controller?.ports.find((x) => x.id === c.portId),
    fixture = state.fixtures.find((x) => x.id === c.fixtureId),
    profile = state.profiles.find((x) => x.id === fixture?.profileId);
  if (!port || !profile) return "Choose a controller output and a fixture.";
  if (port.voltage !== profile.voltage)
    return `Voltage mismatch: output is ${port.voltage} V; fixture needs ${profile.voltage} V. Choose a compatible output.`;
  if (port.protocol !== profile.protocol)
    return `Protocol mismatch: ${port.protocol} output cannot drive ${profile.protocol}.`;
  if (profile.channels.some((ch) => !port.channels.includes(ch)))
    return "Output does not provide all fixture channels. UV must remain independent.";
  if (
    !Number.isInteger(c.start) ||
    c.start < 0 ||
    !Number.isInteger(c.count) ||
    c.count !== profile.pixels ||
    c.start + c.count > port.capacity
  )
    return `Use ${profile.pixels} pixels within this output’s ${port.capacity}-pixel capacity.`;
  if (
    state.connections.some(
      (x) =>
        x.fixtureId !== c.fixtureId &&
        x.portId === c.portId &&
        x.controllerId === c.controllerId &&
        c.start < x.start + x.count &&
        x.start < c.start + c.count,
    )
  )
    return "Pixel range overlaps another fixture. Choose a free range or another output.";
  return null;
}
export function patch(state, c) {
  const error = validateConnection(state, c);
  if (error) throw Error(error);
  return {
    ...state,
    connections: [
      ...state.connections.filter((x) => x.fixtureId !== c.fixtureId),
      { ...c, id: c.fixtureId },
    ],
  };
}
export function setPalette(state, id, selection = []) {
  return selection.length
    ? {
        ...state,
        fixtures: state.fixtures.map((f) =>
          selection.includes(f.id) ? { ...f, paletteId: id } : f,
        ),
      }
    : { ...state, globalPalette: id };
}
export function snapshotRig(state, name) {
  return {
    id: uid(),
    name,
    fixtures: structuredClone(state.fixtures),
    connections: structuredClone(state.connections),
    geometry: structuredClone(state.geometry),
    groups: structuredClone(state.groups),
    decor: structuredClone(state.decor),
  };
}
export function loadRig(state, rig) {
  const fixtures = rig.fixtures.map((f) => {
    const current = state.fixtures.find((x) => x.id === f.id);
    return {
      ...f,
      effect: current?.effect || "Energy",
      paletteId: current?.paletteId ?? null,
      uv: current?.uv ?? 0,
    };
  });
  return {
    ...state,
    ...structuredClone(
      Object.fromEntries(
        ["fixtures", "connections", "geometry", "groups", "decor"].map((k) => [
          k,
          rig[k],
        ]),
      ),
    ),
    fixtures,
  };
}
export function parseProject(text) {
  const s = JSON.parse(text);
  if (
    s?.schemaVersion !== 2 ||
    ![
      "controllers",
      "profiles",
      "fixtures",
      "connections",
      "geometry",
      "groups",
      "decor",
      "rigs",
      "effectPresets",
      "colourPresets",
      "scenes",
    ].every((k) => Array.isArray(s[k]))
  )
    throw Error(
      "This is not a Studio prototype v2 project. Your current project is unchanged.",
    );
  if (!palettes.some((p) => p.id === s.globalPalette))
    throw Error("Unknown global palette.");
  for (const collection of [
    "controllers",
    "profiles",
    "fixtures",
    "groups",
    "decor",
    "rigs",
    "effectPresets",
    "colourPresets",
    "scenes",
  ]) {
    const ids = s[collection].map((x) => x?.id);
    if (
      ids.some((id) => typeof id !== "string" || !id) ||
      new Set(ids).size !== ids.length
    )
      throw Error("Project contains missing or duplicate IDs.");
  }
  for (const p of s.profiles)
    if (
      !["strip", "wash"].includes(p.kind) ||
      !Array.isArray(p.channels) ||
      !p.channels.length ||
      p.channels.some((c) => !["R", "G", "B", "W", "UV"].includes(c)) ||
      !Number.isInteger(p.pixels) ||
      p.pixels < 1 ||
      p.pixels > 4096 ||
      ![5, 12, 24].includes(p.voltage) ||
      typeof p.protocol !== "string"
    )
      throw Error("Invalid fixture profile.");
  for (const c of s.controllers)
    if (
      !Array.isArray(c.ports) ||
      c.ports.some(
        (p) =>
          !Array.isArray(p.channels) ||
          !Number.isInteger(p.capacity) ||
          p.capacity < 1,
      )
    )
      throw Error("Invalid controller output.");
  for (const f of s.fixtures)
    if (
      !s.profiles.some((p) => p.id === f.profileId) ||
      typeof f.name !== "string" ||
      !Number.isFinite(f.uv) ||
      f.uv < 0 ||
      f.uv > 100
    )
      throw Error("A fixture profile is missing.");
  for (const g of s.geometry)
    if (
      !s.fixtures.some((f) => f.id === g.fixtureId) ||
      !Number.isFinite(g.x) ||
      !Number.isFinite(g.y) ||
      !["wash", "curve", "straight", "freehand"].includes(g.kind) ||
      !Array.isArray(g.points) ||
      g.points.length % 2 ||
      g.points.some((p) => !Number.isFinite(p)) ||
      (g.kind !== "wash" && g.points.length < 4)
    )
      throw Error("Invalid stage geometry. Your current layout is unchanged.");
  for (const rig of s.rigs) {
    if (
      !["fixtures", "geometry", "connections", "groups", "decor"].every((k) =>
        Array.isArray(rig[k]),
      )
    )
      throw Error("Invalid saved rig.");
    parseProject(
      JSON.stringify({
        ...s,
        rigs: [],
        fixtures: rig.fixtures,
        geometry: rig.geometry,
        connections: rig.connections,
        groups: rig.groups,
        decor: rig.decor,
      }),
    );
  }
  for (const p of s.effectPresets)
    if (!Array.isArray(p.assignments)) throw Error("Invalid effect preset.");
  for (const p of s.colourPresets)
    if (
      !Array.isArray(p.overrides) ||
      !palettes.some((x) => x.id === p.globalPalette)
    )
      throw Error("Invalid colour preset.");
  for (const c of s.connections) {
    const err = validateConnection(s, c);
    if (err) throw Error(err);
  }
  return s;
}
