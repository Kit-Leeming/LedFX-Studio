# Prototype evaluation and implementation plan

Evaluated 7 November 2026. This is an expert task walkthrough plus automated browser/model tests, **not observed user testing or hardware validation**. The baseline audit and prototype review used both installed UX skills. Evidence is in `studio-next/tests` and `studio-next/e2e`; screenshots show only simulated fixtures and documentation-range IP addresses.

## Workflow results

| Realistic task | Exercised behaviour | Result |
|---|---|---|
| Bring another strip into a modular setup | Discover/register simulated 5 V controller; create RGBW strip; try wrong 12 V port; then correct port | Explicit voltage rejection, no partial patch; successful compatible patch can be undone |
| Use longer replacement fixtures | Edit profile as copy, change pixel count, save reusable profile | Existing fixtures and patch remain unchanged; new fixtures can use the revised definition |
| Lay out a front-facing stage | Move numerically; draw straight, curved and freehand paths; preserve connections | Saved path kind/points change; physical connection data stays identical |
| Change the entire rig's colours with an exception | Local Ember override; global Ocean; bulk Wave effect | Local override survives; effect assignment independent of colours |
| Keep UV independent | Explicitly set wash UV to 30%, change global palette | UV remains 30%; model rejects a port replacing UV with W |
| Controller disappears mid-setup | Simulated disconnect/reconnect, reload | Fixture IDs, coordinates and patch remain; no redistribution |
| Reuse a show with different colours | Save effect/colour presets, pair selected parts into scene, recall, restore rig | References retained; effect and colour recall independent; rig recall preserves current look |
| Recover invalid input | Invalid JSON import; corrupted stored project | Import preserves current project; original corrupt bytes retained for export; demo opens with explanation |
| Review on LAN / narrow window | Disable secure-origin UUID API, create fixture; 1280/768/375px views | Fallback works, no document horizontal overflow; panels reflow |
| Use keyboard and inspect accessibility | Tab/focus, reduced-motion preference, axe Stage/Patch/Library | Visible skip-link focus; no detected WCAG A/AA DOM violations in tested states |

## Findings and changes made during evaluation

| Finding | Principle / priority | Resolution |
|---|---|---|
| Some implicit labels incorporated select contents and made field names unstable | H4 consistency, accessibility; high | Explicit label IDs; all affected setup/bulk editing tests now pass |
| Scene initially paired the last saved presets implicitly | H6 recognition, H5 prevention; high | Explicit effect/colour selectors before saving a scene |
| Unreadable browser state would have been replaced without a recovery copy | H9 recovery; high | Preserve raw data under separate recovery key, display explanation, offer download |
| Native UUID API unavailable over ordinary HTTP on LAN | Offline/local-access requirement; high | Local demo ID fallback, tested without secure-context API |
| Canvas scaled only horizontally when width changed | Real-world match / geometry; medium | Uniform X/Y scale; saved logical geometry unchanged |
| Long inspector pushed the whole stage down the page | Product posture / excise; medium | Desktop inspector and workspace scroll independently; stacked layout on smaller screens |
| Responsive canvas height could toggle the workspace scrollbar and keep controls moving | Visibility/stability, high | Reserve a stable scrollbar gutter; regression waits for initial sizing, then checks frame-to-frame stability |
| Decorative equipment had drag-only placement | WCAG dragging alternative; medium | Added per-equipment X/Y controls |
| Input boundaries were below 3:1 despite readable text | Non-text contrast; medium | Separate stronger control-border token; keep subtle nonessential panel dividers |
| Single initial JavaScript bundle was about 798 kB minified | Performance; medium | Split engine UI vendor, canvas and patch-graph chunks. Further lazy loading deferred |

Five-second scan: the heading and front-elevation canvas identify the workspace; selection is visible in both fixture list and inspector; primary setup action in Patch is Discover controllers. This is an expert inspection result and should be checked with the owner.

Text contrast calculated from sRGB luminance: primary/panel 14.07:1; muted/panel 8.09:1; muted/workspace 8.77:1; primary-button label/accent 11.70:1. The final input/button border token provides more than 3:1 against the input background. These spot checks and automated scanning are not a complete accessibility certification, especially for canvas content.

## Verification record

- 9 domain tests passed: voltage, overlap/count, independent UV, palette scope, missing-controller geometry, rig look preservation, invalid imports/geometry/IDs.
- 11 Playwright workflows passed in headless installed Edge, including accessibility scanning across the three workspaces and resize stability. The full suite also ran against the built preview bundle.
- Vite production build passed; all static dependencies bundled locally. React Flow's upstream `use client` bundler notice is benign for this client-only build.
- Automated requests check found no remote resource requests. LAN identity fallback is simulated; actual access from a second physical LAN device has not been tested.
- Responsive checks: 1600 desktop screenshot and 1280, 768, 375 widths; reduced motion enabled. Desktop is the primary editing target.
- Existing backend tests were not rerun because no backend/installed files changed. Firmware, real discovery, electrical parameters, network output and physical lamp behaviour were not tested or changed.

## Remaining prototype limitations

- A small simulated effect list and three curated palettes demonstrate assignment and scope; there is no audio capture, real effect rendering, arbitrary palette authoring or full effect-schema inspector.
- Only global and per-fixture colour overrides are implemented; reusable group/role colour precedence is proposed, not implemented.
- Profile editing is copy-on-edit, with known channel-safe templates. Arbitrary channel pin maps, protocol variants, supply/current/fuse data and capability verification belong in the next phase.
- Curves use interpolated point tension, not production cubic Bézier handles or calibrated physical dimensions. There is no stage zoom/pan, spatial shader/engine sampler, multi-fixture drag or snapping UI yet. Dragging moves one fixture; bulk effect changes apply to all selected fixtures.
- Prototype patch nodes use automatic fixed positions. Production needs graph filtering and scale testing; it must not allow UI graph layout to alter physical mappings.
- LocalStorage is per browser, with bounded session Undo and a recovery export. It is not shared LAN persistence, server conflict resolution or crash-safe hardware rollback.
- Canvas accessibility is provided through parallel fixture and numeric controls; screen-reader and assistive-device evaluation with users remains necessary. Light theme is not implemented.

## Prioritised production plan

| Order | Deliverable | Exit criteria / tests |
|---|---|---|
| P0 · review gate | Owner walkthrough of Stage/Patch/Library and architecture decisions | Owner can add/patch an RGBW strip, arrange a path and recall a split scene without explanation; resolve rig semantics, UV cues and first supported controllers |
| P0 · foundation | Versioned project service, immutable profile revisions, backup/export and optimistic concurrency | Corrupt/old documents rejected safely; atomic-write recovery; two-client conflict test; old install/library still launchable |
| P0 · read-only bridge | Engine inventory/effect schema adapter and controller capability registry | Match actual fork schemas; unknown capability shown as unknown; loss/reconnect retains identity and geometry; no writes during inventory |
| P0 · safety validator | Typed channel binding, protocol/voltage/count/range, independent UV/W, supply/pin limits | Boundary/property tests; overlapping patches rejected; generic white conversion cannot touch UV; missing electrical facts block relevant applies |
| P1 · hardware apply | Previewed immutable plans, idempotent apply, per-controller outcomes, read-back and recovery journal | Stale plan rejected; timeout after partial success accurately reported; repeat request does not re-provision; restore/retry works in simulator before approved hardware trials |
| P1 · everyday control | Full effect-schema inspector, brightness in effect arrangements, editable palettes, global/group/role/local resolution | Unsupported fields flagged; no colour changes on effect recall; UV changes only explicit; external-edit Undo conflicts handled |
| P1 · spatial engine spike | Path arc-length sampling, exact curve representation, direction mapping, fixed stage domain | Synthetic asymmetric pixel patterns prove index order; absent fixtures preserve sample space; audio/effect engine performance remains acceptable |
| P1 · library/rig engine | Stable fixtures, rig membership/patch bindings, split scene references, missing-reference repair | No redistribution or deleted placeholders; hardware provisioning separate from rig recall; missing presets give repair choices |
| P2 · editor scale | Graph filters, stage zoom/pan, selection tools, snapping, Bézier controls and decorations | 50 controllers/500 fixtures stress test; frame/interaction budgets measured; non-drag equivalents tested |
| P2 · delivery | Offline bundle in separate engine route, launcher selection, controlled validation on physical fixtures | Isolated source/package checks; owner-approved live restart; compare real RGB/RGBW/UV output; verified rollback before switching the default UI |

Do not proceed from this review phase directly to real hardware writes. The architectural decisions in [ARCHITECTURE.md](ARCHITECTURE.md#decisions-to-approve-before-production-backend-work) are the next review gate. Building this demo does not replace or restart the installed app.
