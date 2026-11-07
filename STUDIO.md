# LedFX Studio

Open **LedFX Studio.exe**, or visit `/studio/index.html` on a running LedFX
server. Studio uses the same backend, configuration directory and effect
engine as classic LedFX. It does not require internet access. On another local
machine, use the host's LAN address and the configured LedFX port.

## Set up the workspace

1. **Devices:** Add a light or a named controller. A standalone light can be
   defined before its controller. Record metres separately from pixel count:
   strip length; matrix width/height and pixel columns/rows; wash or spot size.
   Use an existing LedFX output to prefill the name and pixel count. Enter the
   light's measured physical dimensions. A built-in-controller light requires
   an existing controllable LedFX device output; it skips Patches.
2. **Patches:** Assign a standalone light to a controller output and a starting
   pixel, and record physical direction. The editor checks voltage, chipset,
   channel types, capacity and overlap. Unpatching keeps the light and its stage
   position. These are physical wiring records. Configure network transports
   and engine segments in classic LedFX, then link the matching LedFX virtual
   under Devices. Studio does not write controller firmware or provision pins.
3. **Stage:** Set the stage dimensions in metres, choose a light and place it.
   Move it by drag or coordinates, rotate it, or bend a strip without changing
   its physical length. A matrix retains its measured footprint. Lock placements
   against accidental dragging, or remove them without deleting the light.
   Fit, zoom and pan only change the view.
4. **Effects & palettes:** Select lights from the list or locked stage view.
   Save reusable groups. Set an effect and settings, then Apply. The default
   palette scope is all registered lights; local overrides can be applied to
   selections and reset to the global palette. Independent UV is not driven by
   palette conversion. Unlinked, missing or mismatched outputs block the batch
   and identify the light that needs attention.

No unsupported built-in controller is registered as usable. This fork has a
[Twinkly Squares driver](https://docs.ledfx.app/en/v2.1.9/devices/twinkly_squares.html).
That does not establish support for Twinkly Curtains, so there is no curtain
adapter in this update. A Plush light already configured as a LedFX device can
be registered from its existing output; no firmware change is needed.

## Save, undo and recover

Setup forms commit on Save. Server-side validation and revision checks prevent
invalid records and concurrent edits from silently replacing your work. Your
workspace is stored in the existing `studio.json` alongside the previous
Studio library; legacy rigs, themes, presets and scenes are retained. This
editor intentionally exposes only the core setup, placement and look controls.
Classic LedFX and its scenes remain available.

Backup downloads the current Studio library. Undo supports recent workspace
changes and effect transactions from this window. Palette scope and effect
changes commit together; conflict checks prevent Undo from overwriting newer
state. For a rejected save, the draft remains in the form.

## Layout research

- [xLights model settings](https://manual.xlights.org/xlights/chapters/chapter-four-tabs/models/model-attribute): reusable model, exact placement and locks.
- [xLights PolyLine](https://manual.xlights.org/xlights/chapters/chapter-four-tabs/models/polyline-model): one continuous model can follow a shaped path. Studio implements a controlled arc with fixed physical length.
- [QLC+ fixture browser](https://docs.qlcplus.org/v5/fixtures-and-functions/fixture-browser) and [2D view](https://docs.qlcplus.org/v5/fixtures-and-functions/2d-view): separate fixture setup, patch addressing and position, with real-size fixture geometry.
- [MADRIX patch editor](https://help.madrix.com/m5/html/madrix/hidd_preferences_patch.html): named fixture outputs and precise addressing. Studio uses an output form and range validation for its simpler wiring model.

## Build and test

Run `npm ci` and `npm run build` in `studio-ui/`. The build updates the current
`frontend/public/studio` and `ledfx_frontend/studio` asset folders. There is no
separate prototype route. Run `npm test` and `npm run test:e2e` there for the
layout and workflow tests, and `python -m unittest tests.test_studio
tests.test_studio_workspace` at the repository root for backend checks. Browser
workflow tests isolate the API so they cannot touch actual lighting equipment.
