# Studio architecture and source map

## Main flow

1. The browser loads frontend/public/studio/ (deployed under ledfx_frontend/studio/).
2. The Studio endpoint exposes the library, virtual state and schema-derived colour fields.
3. Studio validates a bulk edit, prepares new effects, checks segment conflicts,
   and applies changes through existing LedFx virtual/effect APIs.
4. The normal LedFx render/device pipeline sends output to controllers.
5. Studio saves its independent library atomically to the chosen config directory's
   studio.json; existing effects/configuration continue using LedFx config.json.

## Data model

- Rig: virtual membership, groups/roles, saved selection and layout density.
- Theme: gradient, primary/accent/background swatches and per-effect mappings.
- Effect arrangement: per-virtual effect type and non-colour settings.
- Colour arrangement: named-role assignments plus per-light overrides.
- Scene: references to one effect arrangement and one colour arrangement.
- Assignment: currently assigned theme per virtual.

Brightness and gradient motion stay with effect settings. Theme mappings use
colour/gradient types from the effect schema rather than guessing from field names.
The suggested roles within those colour fields can be overridden per effect.

## Files to inspect

| Concern | Path |
| --- | --- |
| Validation, persistence, theme mapping, batch apply, rollback, Undo | ledfx/studio.py |
| REST handlers | ledfx/api/studio.py |
| Studio static route | ledfx/http_manager.py |
| User interface | frontend/public/studio/studio.js |
| UI structure and styles | frontend/public/studio/index.html, studio.css |
| Desktop startup and duplicate backend handling | launcher/StudioLauncher.cs |
| Launcher compilation | Build-StudioLauncher.ps1 |
| Focused behaviour tests | tests/test_studio.py, tests/test_beat_scan.py, tests/test_wash_inspired.py |

Undo retains up to 30 light edits in memory and refuses to overwrite newer external
changes. Preset writes carry a revision to reject stale-window saves. Failure
recovery restores settings and assignments, not the exact animation playback phase.
Details and known limits are in STUDIO.md. Device hardware is not emulated by the
unit tests; dummy-device browser checks verify UI behaviour separately.
