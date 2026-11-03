# LedFX Studio

Start **LedFX Studio.exe** in the project root. Create a desktop shortcut to this
file (do not move the executable out of the project). It starts the bundled
backend, opens Edge or Chrome in an app-style window, and reuses an already
running portable backend. Closing the window leaves LedFX and your lights running.
If neither browser is installed it uses your default browser.

The browser profile, presets, config, logs, Python runtime and builds remain on the
project drive. Move the whole folder together to keep the setup portable.
The backend can be shut down using the existing LedFX tray menu or Classic UI.

## Editing

1. Select light cards in **All lights**, then save the selection as a rig.
2. Select any subset and choose an effect or change its settings. Changes are live;
   only the edited setting changes. Mixed values are shown as Mixed.
3. In **Colours**, create a theme from a built-in gradient or editable colour stops.
   Primary/accent swatches are suggested from the gradient; the background starts
   black. Edit these swatches or per-effect colour mappings as needed.
4. Apply a theme to the selected lights. Repeat for another subset. Assigned themes
   follow their lights when you change effects. Brightness belongs to effect settings.
5. Under **Presets**, save selected effects and rig colours independently. A named
   scene references one of each, so the same effects can be paired with many colours.

Rigs store membership, named groups/roles, card density and the saved selection.
Loading a rig changes what is displayed, not the outputs of lights outside it.
To change rig membership, select the desired lights in All lights and save a new rig.
Group names are reusable colour roles. A colour arrangement stores a group assignment
when all its members share a theme, and individual overrides for other assignments.
Individual overrides win over groups; for overlapping groups, the last stored group
wins. Reuse the same group names in another rig to reuse the colour arrangement.
Effect arrangements target exact virtual IDs and load only those in the current rig.
Old scenes and device/segment configuration remain available in **Classic LedFX**.

A theme edit saves the theme definition; use Apply to update lights already assigned
to it. Themes only change fields declared as colours/gradients by the effect schema.
They cannot recolour the pixels embedded inside a GIF/image or an effect that generates
its own palette. Fields such as gradient roll, UV power and brightness stay with effects.

## Undo and conflicts

Undo covers the latest 30 successful light edits in the current backend session.
It restores effect settings, active states and theme assignments. Saving/deleting
presets or editing rigs is not part of light Undo. Undo refuses to overwrite effects
changed elsewhere. It restores settings, not the animation's precise playback phase.

Bulk edits validate their settings before applying. If activation fails, Studio tries
to restore the affected virtuals and reports the error. Streaming virtuals and
conflicting pixel ranges are rejected. LedFX normally disables overlapping virtuals;
Studio refuses this so it does not silently switch other lights off. Use non-overlapping
virtuals when a controller contains several independently selected strips.

The library is atomically stored in **portable-data/studio.json**, separately from
legacy scenes in config.json. Saving from an outdated window is rejected; Refresh
loads the latest library. Scene pairs reference arrangements rather than copying them.
An arrangement used by a paired scene cannot be deleted until that scene is deleted.

## Building and testing

Canonical frontend source: `frontend/public/studio/`. Its deployed copy is
`ledfx_frontend/studio/`; the existing frontend build copies public assets as usual.
Backend: `ledfx/studio.py` and `ledfx/api/studio.py`. The Studio page is served at
`/studio/index.html`, with its state, library save and batch edits at `/api/studio`.

Use `Rebuild-LedFX.ps1` for the frontend/backend. It also rebuilds the launcher.
`Build-StudioLauncher.ps1` rebuilds only the launcher with Windows' .NET compiler.
Close the production backend before replacing its files. Use staging directories
and preserve the prior build/config when deploying a new version.

Validation performed on 14 October 2026:
- 14 Studio behavioural tests passed (`python -m unittest tests.test_studio`).
- 31 Beat Scan/wash tests passed (`pytest --noconftest`).
- Browser checks with dummy devices verified three-strip bulk editing, distinct
  themes, theme preservation across effect changes, Undo, independent preset
  saving, scene pairing, named-role reuse across rigs and a 390px mobile layout.
- Packaged backend returned the Studio API and page successfully.

Real controller output still needs visual verification; dummy-device tests do not
prove Bluetooth capture timing, network delivery or physical light behaviour.
