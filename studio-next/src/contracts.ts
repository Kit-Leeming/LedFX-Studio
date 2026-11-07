/** Proposed production contracts, not a claim that a backend implements them.
 * IDs stable across rigs/reconnects; transport DTOs must validate on the server.
 */
export type Id = string;
export type Channel = "R" | "G" | "B" | "W" | "UV";
export type Controller = {
  id: Id;
  name: string;
  hardwareIdentity?: string;
  endpoint: {
    host: string;
    transport: "DDP" | "E131" | "ArtNet" | "WLED" | "ESPHome";
  };
  capabilities: {
    source: "reported" | "manual";
    verifiedAt?: string;
    outputs: Output[];
  };
};
export type Output = {
  id: Id;
  label: string;
  protocols: string[];
  pixelCapacity: number;
  channels: Channel[];
  voltageV: number | null;
  maxCurrentA: number | null;
  pinAssignment?: number[];
  electricalVerified: boolean;
};
export type ControllerRuntime = {
  controllerId: Id;
  status: "online" | "offline" | "unknown";
  lastSeen?: string;
  error?: string;
};
export type FixtureProfile = {
  id: Id;
  revision: number;
  name: string;
  kind: "strip" | "wash";
  pixelCount: number;
  voltageV: number;
  chipset: string;
  channelOrder: Channel[];
  independentChannels: ("UV" | "W")[];
  whitePolicy: "none" | "independent" | "explicit-extraction";
  currentAtFullA: number | null; // unknown is a validation issue, never a guessed safe value
};
export type Fixture = {
  id: Id;
  name: string;
  profile: { id: Id; revision: number };
  roleIds: Id[];
};
export type Connection = {
  id: Id;
  fixtureId: Id;
  controllerId: Id;
  outputId: Id;
  physicalStartPixel: number;
  pixelCount: number;
  reversed: boolean;
  channelBindings: { logical: Channel; physicalSlot: number }[];
  power: {
    supplyId?: Id;
    voltageV: number;
    fuseA?: number;
    wireRatingA?: number;
    verified: boolean;
  };
};
export type Point = { x: number; y: number };
export type Geometry = {
  fixtureId: Id;
  coordinateSpace: "stage-front";
  path:
    | { kind: "line"; points: [Point, Point] }
    | {
        kind: "bezier";
        segments: { from: Point; c1: Point; c2: Point; to: Point }[];
      }
    | { kind: "polyline"; points: Point[] }
    | { kind: "wash"; position: Point; rotationDeg: number; beamDeg: number };
  // Logical sampling uses the full saved stage bounds, including absent fixtures.
  sampling: { space: "stage" | "fixture"; start: number; end: number };
};
export type Stage = {
  id: Id;
  bounds: { width: number; height: number };
  geometry: Geometry[];
  equipment: {
    id: Id;
    kind: "speaker" | "booth" | "truss";
    position: Point;
    size: Point;
  }[];
};
export type FixtureGroup = { id: Id; name: string; fixtureIds: Id[] };
export type Palette = {
  id: Id;
  name: string;
  stops: { position: number; color: string }[];
  primary: string;
  accent: string;
  background: string;
  effectMappings: Record<
    string,
    Record<string, "gradient" | "primary" | "accent" | "background">
  >;
};
export type EffectArrangement = {
  id: Id;
  name: string;
  assignments: {
    target: { kind: "fixture" | "group" | "role"; id: Id };
    effectType: string;
    settings: Record<string, unknown>;
  }[];
}; // settings includes brightness; excludes palette and UV
export type ColourArrangement = {
  id: Id;
  name: string;
  globalPaletteId: Id;
  rolePalettes: Record<Id, Id>;
  groupPalettes: Record<Id, Id>;
  fixtureOverrides: Record<Id, Id>;
};
export type Rig = {
  id: Id;
  name: string;
  fixtureIds: Id[];
  connectionIds: Id[];
  stageId: Id;
  groups: FixtureGroup[];
};
export type Scene = {
  id: Id;
  name: string;
  effectArrangementId: Id;
  colourArrangementId: Id;
  rigId?: Id;
  independentOutputs?: { fixtureId: Id; channel: "UV" | "W"; level: number }[];
};
export type StudioProject = {
  schemaVersion: 2;
  revision: number;
  controllers: Controller[];
  profiles: FixtureProfile[];
  fixtures: Fixture[];
  connections: Connection[];
  stages: Stage[];
  groups: FixtureGroup[];
  palettes: Palette[];
  rigs: Rig[];
  effects: EffectArrangement[];
  colours: ColourArrangement[];
  scenes: Scene[];
};
export type ValidationIssue = {
  code: string;
  entityId: Id;
  field: string;
  severity: "error" | "warning";
  message: string;
  remedy: string;
};
export type ApplyPlan = {
  id: Id;
  baseRevision: number;
  capabilityHash: string;
  issues: ValidationIssue[];
  operations: {
    controllerId: Id;
    operation: string;
    before: unknown;
    after: unknown;
  }[];
  expiresAt: string;
};
