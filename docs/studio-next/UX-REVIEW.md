# UX review and interface proposal

## Context and evidence

User: an intermediate lighting operator assembling changing combinations of a few controllers and several strips/washes. Setup involves careful physical decisions; performance involves frequent, low-friction group effect/colour changes. This is a sustained desktop workspace, with secondary LAN/tablet access.

Reviewed the current canonical Studio frontend in `frontend/public/studio/{index.html,studio.js,studio.css}`, the Studio service in `ledfx/studio.py`, and output configuration in `ledfx/devices/e131.py`. Baseline checkout: `0673012a` (stable 2.2.1 merge). The installed API on localhost:8888 refused connection during this review, so the baseline audit is **source-based**, not a claim of observing the running app. Existing saved screenshot `docs/images/studio-demo.png` is historical context only.

Applied installed `design-critique` (Nielsen heuristics, excise, posture, IA, Krug checks) and `ui-ux-pro-max` (design-system search plus focused dragging, focus and recovery guidance). The latter's broad search returned a marketing hero pattern; rejected that pattern because a lighting editor is a sovereign workspace. Retained restrained hierarchy, consistent tokens and focus/contrast guidance. Used local system typography to support offline operation. No actual user usability study has occurred.

## Current frontend findings

Severity follows Nielsen 0–4; these ratings concern the requested new workflows, not whether the old app meets its narrower original purpose.

| Severity | Evidence / problem | Principle and consequence | Recommendation |
|---|---|---|---|
| 4 | Studio state is based on LedFX virtuals, rigs, themes and presets; no physical profile/output graph | H2 real-world match: cannot express fixture identity independently of a virtual or demonstrate wiring validity | Separate controller outputs, logical fixtures and patch bindings; show voltage/protocol/channels before patch |
| 4 | The central `#cards` area is a light-card list, with no geometric stage editor | Direct manipulation / mental model: impossible to represent curves, direction and retained spatial sampling | Dedicated front-elevation canvas with stable geometry and input markers |
| 3 | `nameFor()` uses `prompt`; rig/preset deletion uses `confirm` | H3 freedom, H9 recovery: browser dialogs interrupt context and cannot show structured validation | Inline creation and contextual errors; reversible demo edits use Undo |
| 3 | `renderPanel()` switches Effects / Colours / Presets inside one inspector | H6 recognition / navigational excise: library recall and detailed editing compete for the same small area | Separate Library workspace; keep inspector selection persistent |
| 3 | Profile/protocol/capacity/power constraints are not first-class Studio controls | H5 error prevention: users must infer safe output assignments from engine internals | Patch compatibility validation plus a future hardware review/apply step |
| 2 | Bulk cards and search are useful, but geometry and offline spatial positions are absent | H1 status: unavailable fixtures cannot retain a visible stage role | Offline text and reserved stage positions, without automatic redistribution |
| 2 | Global colour direction is not a persistent stage-level control | H7 efficiency: repeated selection needed to express a whole-rig colour intention | Global palette by default, explicit local overrides and reset-to-global |

Keep strengths: selection and groups, shared editing, separate effect/colour presets, paired scenes, Undo, preservation of lights outside selected rigs. Reuse these concepts, not necessarily the old DOM implementation.

## Essential tasks and error conditions

| Task | Essential controls | Errors / recovery |
|---|---|---|
| Register controller | Discover; review capability summary; register; manual address later | Nothing found, duplicate identity, offline host, ambiguous discovery; retry or manual entry |
| Define fixture | Template, name, kind, typed channels, voltage, protocol, count | Unknown chipset, unsupported channels, invalid count; preserve draft and flag field |
| Patch hardware | Port handles + equivalent form, start/end, direction | Voltage/protocol mismatch, UV/W ambiguity, overlap, capacity, unavailable controller; no mutation on validation failure |
| Arrange stage | Select/multi-select, move, straight/curve/freehand, points, input end | No strip selected, too few points, unintended draw; contextual hint, Escape, Undo, numeric alternatives |
| Set look | Selection, effect, palette scope, local overrides, independent UV | Mixed selection, unsupported effect field; production mapping preview and explicit UV policy |
| Recall rig / scene | Library, named rig, effect and colour parts | Missing fixture or preset, unavailable profile revision; retain placeholders and give repair choices |
| Recover work | Autosave status, export/import, Undo | Malformed import, exhausted storage, conflicting edits; preserve current work and recovery bytes |

## Interface structures compared

### A. Guided setup → layout → performance

Five sequential sections: Controllers, Fixtures, Wiring, Stage, Live. Advantages: a novice follows dependency order, forms can be short and contextual validation is easy to teach. Costs: changing a fixture during layout causes several context switches; users must remember which wiring page corresponds to a stage light. A rigid wizard is especially costly during iterative assembly. Good as optional first-run guidance, not daily navigation.

### B. Persistent workspace with Stage / Patch / Library — selected

Three stable workspaces, persistent fixture list and inspector. Stage optimises frequent arranging and looks; Patch makes physical wiring explicit; Library contains reusable definitions and recall. Selection carries between Stage and Patch. Advantages: recognition over recall, direct manipulation, fewer destinations and efficient group work. Costs: a denser first screen, and a patch graph can become cluttered. Mitigate with groups/search, a precise connection form, fit/zoom, progressive inspector sections and a future optional setup checklist.

### C. Everything on one infinite canvas — rejected

Controllers, wires, effects and geometry as nodes. Advantage: one conceptual surface. Costs: wires compete with spatial light paths; users confuse physical position with graph position; keyboard navigation and everyday colour edits become expensive. Keep separate visual grammars for physical patch versus audience-facing geometry.

## Navigation and layouts

Persistent shell: project/status/Undo/export in header; Stage / Patch / Library rail; searchable fixture/group list on left; current workspace centre; selected fixture inspector on right; non-modal status footer. URL hash restores the active workspace and browser Back works. On narrower screens the inspector follows the workspace; phone access is secondary and fixture creation remains available.

- **Stage:** tool row, front-elevation Konva canvas, input-end markers, offline indication, global palette shelf. Inspector: look, geometry/point coordinates, physical summary. Canvas paths never rewrite wiring.
- **Patch:** one node per controller output and per fixture; labelled edges show ranges/direction. Capability labels visible on output nodes. Discovery result requires registration. Inspector contains an equivalent form for non-drag use.
- **Library:** Rigs, Scenes, Effect presets, Colour presets, Profiles. Save named items inline. Scene explicitly picks effect and colour references. Profile changes create revisions/copies before assigning to hardware.

Reusable components: workspace shell; fixture row; group selector; labelled field; section; segmented tool selector; semantic status/error banner; library card; palette swatch; capability badge; output node; selection inspector. Production should extract view modules and domain hooks from the prototype before extending it.

## Visual and interaction system

Muted charcoal surfaces support long sessions and make coloured fixtures legible. Mint identifies action/selection, never success alone. Status has words as well as colour. Semantic CSS tokens provide text, muted text, surface, input, boundary, focus and accent roles; 4/8px spacing rhythm; consistent line icons; visible two-pixel focus ring. Body uses local Segoe UI/system fallback; no font requests. No animated audio mockup that could imply real rendering.

Dark mode is the deliberate Phase 1 theme; a light theme is deferred. Contrast was measured for text pairs in evaluation. Geometry and point editing have numeric alternatives; patching has a form. Decorative equipment also has coordinate controls. Mobile folds panels vertically; desktop remains the primary target.
