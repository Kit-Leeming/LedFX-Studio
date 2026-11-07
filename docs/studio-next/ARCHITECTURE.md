# Architecture proposal

Status: proposed production architecture, demonstrated selectively by the simulated client. Phase 1 makes **no real controller, LedFX API or firmware writes**. Review the decisions at the end before production backend implementation.

## Boundaries

```text
React workspace
  Stage / Patch / Library / Inspector
             |
  typed project commands + selection + undo
             |
  Studio project service (new, versioned, draft/revision aware)
             |
  capability registry → validation → reviewed apply plan
             |
  LedFX adapter → existing virtuals, effects, audio, output senders
             |
  existing controller firmware / network protocols
```

The prototype uses pure local state and localStorage in place of the project service. `src/model.js` is executable demo logic; `src/contracts.ts` is the **richer proposed production contract**, not an implemented endpoint or a lossless converter for the demo JSON. Avoid promoting localStorage directly into the authoritative production database.

Retain the Python engine's audio capture, effect classes/schemas, device lifecycle and network senders. Introduce an adapter/compiler between stable logical fixture IDs and LedFX device/virtual IDs. Do not teach canvas components about packet formats or reuse virtual IDs as physical identity. No reason to replace NumPy rendering or existing transports in this phase.

## Three independent models

1. **Physical:** controller identity, capabilities, output pins/ports and patch ranges. Describes what is electrically wired. Changing stage coordinates cannot modify it.
2. **Logical:** versioned fixture profiles, fixture identity, roles/groups, effect and colour assignment. A fixture survives controller absence, endpoint change and stage repositioning.
3. **Spatial:** front-facing stage coordinates, curves/paths, wash beam orientation and decorative equipment. A missing fixture retains geometry and sampling interval. Patch-graph node positions are presentation preferences, never stage coordinates.

Direction is deliberately explicit: geometry points progress from logical pixel zero; connection reversal maps logical order onto the physical strip's input direction. Reversal does not reverse or rewrite the saved path. UI shows the physical input end. Production must test asymmetric patterns to prevent accidental double reversal.

## Entity definitions and invariants

| Entity | Stored responsibility | Key invariants |
|---|---|---|
| Controller | Stable hardware identity, named endpoint, reported/manual capability snapshot | IP is not identity; rediscovery cannot silently substitute a different device |
| Output | Physical port ID, channel slots, voltage, protocol, capacity, power limits | Unknown electrical values remain unknown and block affected apply operations |
| ControllerRuntime | Online/unknown/offline, last-seen and errors | Separate from saved project; absence never deletes fixtures |
| FixtureProfile | Immutable ID+revision, strip/wash kind, pixels, ordered typed channels, chipset, voltage/current requirements | `UV` and `W` are distinct; edits produce revisions; dependent fixtures choose when to adopt |
| Fixture | Name and profile reference, roles | Stable UUID independent of controller, port, virtual or stage path |
| Connection | Fixture↔output range, channel bindings, reversal, power verification | No unsupported protocol, overlap, excess capacity, voltage mismatch, missing required channel or ambiguous mapping |
| Stage/Geometry | Fixed bounds, fixture paths/beams, decorative objects | Coordinates and sampling intervals persist while hardware is absent |
| Group/role | Named memberships / reusable semantic target | Deterministic precedence, not list-index-based assignment |
| Palette | Gradient stops and primary/accent/background swatches, per-effect field mapping | Only mapped colour/gradient fields change; brightness and independent outputs remain untouched |
| Effect arrangement | Target→effect type and non-colour settings, including brightness | Contains no palette or independent UV settings |
| Colour arrangement | Global palette, role/group bindings and fixture overrides | Global default; local overrides explicit; missing targets preserved |
| Rig | Stable fixture membership, patch binding references, stage and groups | Loading selects a saved setup; does not automatically activate or rewrite hardware |
| Scene | References effect and colour arrangements; optional rig and explicit independent-channel cues | Missing references block relevant recall with a repair path; no silent substitution |

Proposed palette precedence: explicit fixture override → most specific group override → role override → global. A fixture belonging to two groups with different overrides requires a visible conflict resolution; never rely on array order. Prototype demonstrates global + fixture overrides; role/group palette precedence remains production work.

Geometry production representation: exact lines, cubic Bézier segments and sampled freehand polylines. Arc-length sample a path into the profile's pixel count; reverse only in the patch compiler. Front-elevation coordinates have a fixed origin at stage top-left; positive X right, positive Y down; bounds saved independently of connected fixtures. Stage-wide effects sample the complete saved coordinate domain, including absent placeholders. Runtime geometry sampling for audio effects needs an engine adapter spike; it is **not implemented** by drawing a curve on the prototype canvas.

The prototype's curves use Konva tension over editable points; production Bézier control handles and smoothing tolerance must be specified before treating that geometry as exportable physical measurements. Logical units are deliberately not labelled metres.

## Engine and capability integration

- Start with read-only engine inventory and existing schema endpoints. Build an explicit adapter for current fork extensions (RGBW, independent white and RGB-UV washes) before supporting arbitrary fixtures.
- Capabilities must distinguish transport (DDP/E1.31/Art-Net), LED chipset and the physical port being configured. An E1.31 destination can receive channel data without exposing physical pins; discovery must not invent a physical port map.
- Controllers unable to report hardware layout require a reviewed manual profile. DHCP/IP changes update endpoints after identity verification, not fixture identities.
- Preserve existing RGB-only preview behaviour where the engine expects RGB. Do not truncate independent channels in actual output. For RGB-UV, validate explicit slot binding; generic RGB-to-white extraction must never drive UV.
- Discovery runs on the local backend, not in browsers. Browser sandbox cannot scan arbitrary UDP/mDNS directly. Report discovered candidates and uncertainty; registration is an explicit action.
- Hardware provisioning, firmware changes and electrical verification are separate from applying a look. UI labels must say whether a change edits project data, sends lighting data or reconfigures a controller.

## Proposed service contracts

Use a separate versioned project API, e.g. `/api/studio/v2`, alongside existing Studio. Endpoint naming below is a proposal.

| Operation | Purpose |
|---|---|
| GET project + runtime / events | Saved revision plus transient controller state and live operation status |
| PATCH project with baseRevision | Validated draft commands; reject stale edits with 409 and retain client draft |
| POST discovery / GET job | Bounded local discovery with candidate identity/capability evidence |
| POST validate | Return issues with entity, field, code and actionable remedy; no side effects |
| POST plan | Build immutable before/after operations, capability hash, revision and expiry |
| POST apply(planId, idempotencyKey) | Recheck revision/capabilities, execute only approved plan, persist result journal |
| POST recall(sceneId, revision) | Compile supported effect/colour changes; explicit missing-fixture report |
| GET/export + POST/import preview | Backed-up project transfer with schema validation before replacement |

An apply is successful only after controller/engine read-back where available. Distinguish project saved, engine accepted, controller acknowledged and physical light observed; the last cannot be inferred from packets. Use per-controller outcomes. Rollback is best effort for hardware and cannot be described as atomic across network devices. On failure keep the previous project snapshot, record completed operations, mark uncertain controllers and offer retry of an idempotent plan or restore. Never blindly replay electrical provisioning.

Undo for live look edits captures before-values, revision and current-engine checksum; if another client changed the same fixture, show conflict instead of overwriting it. Hardware apply uses journalled restore plans rather than pretending ordinary UI Undo is sufficient.

## Persistence, offline and deployment

Production: versioned `studio-v2.json` (or transactional SQLite if operation history warrants it), atomic writes and revision checks; runtime status in memory. Preserve `studio.json`, legacy scenes and all install files. Copy a timestamped backup before the first production write and retain it through acceptance. No migration required. Validate schema and references server-side, even if client controls already validate.

Keep the new frontend separately built under `studio-next/`; install later under a distinct `/studio-next/` route behind the existing local engine. Vite uses a relative asset base. Bundle fonts/icons/dependencies. Existing `/studio/`, classic UI, launcher and runtime remain the fallback. Bind LAN access explicitly at deployment with an origin policy and reviewed authentication requirements; never expose a hardware apply API through a public tunnel by default.

No cloud account or external API is required. Internet is needed once to fetch development dependencies; built assets and engine operate on the LAN thereafter. PWA caching is optional and must not cache stale hardware apply plans.

## Library choices

**React Konva: selected for stage rendering.** React-managed shapes and drag events fit stage paths/control points, wash beams and decorations. DOM fixture list and numeric controls remain essential because canvas alone lacks semantic accessibility. See [official React integration](https://konvajs.org/docs/react/index.html).

**React Flow: provisionally selected for patch editing.** The working prototype demonstrates output/fixture nodes, edge range labels, fit/zoom, handles and validation. Its [connection validator](https://reactflow.dev/examples/interaction/validation) prevents invalid edges; the same domain validator powers the form. Custom nodes can expose a handle per output. Keep its attribution. Costs: bundle weight, graph density, and default node semantics are not a complete accessible editor. Production adoption depends on a 50-controller/500-fixture stress test, filtered graph views and keyboard testing. An output table with fixture assignments remains the fallback. Do not reuse this graph to draw the stage.

## Decisions to approve before production backend work

1. Adopt a new versioned project store with immutable profile revisions and stable fixture IDs; keep old library/install as rollback.
2. Keep physical patch, logical fixture and spatial geometry separate. Confirm fixed-stage sampling while fixtures are absent; no auto-redistribution.
3. Use global palette inheritance, explicit local overrides and typed independent W/UV. Confirm proposed group/role conflict handling and whether UV cues may be saved explicitly in scenes.
4. Use read-only inventory first, then validation/plan/apply with reviewed capability and electrical metadata. Confirm supported first controller families and who verifies manual electrical values.
5. Keep the existing rendering engine behind adapters. Approve a limited spatial-sampling integration spike before promising that every effect follows arbitrary paths.
6. Provisionally use React Flow for patching and React Konva for the stage, subject to scale/accessibility checks; retain non-canvas forms.

These are review decisions, not actions performed in Phase 1. Full hardware implementation stops at this boundary.
