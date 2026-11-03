# Portable LedFX wash build

Run `Start-LedFX.cmd` from this folder. If the portable copy is already running,
the starter opens its existing web interface instead of launching another
server on the same port. The Windows application is in
`dist\LedFx`, and all LedFX settings and user presets are kept in
`portable-data` beside it. Move this entire folder together when changing
the SSD's drive letter. The executable does not need the local Python or
Node installation used to build it.

For independent UV on a WLED device, configure the fixture as RGBW in WLED,
use the WLED device in LedFX with DDP or UDP sync, and enable **Independent
White** on that LedFX device. Set WLED's **Auto-calculate white** mode to
**None** so RGB does not light the UV channel. The Wash Lights effects' UV
controls then drive the fourth W wire; WLED's RGBW output must be wired with
that channel as UV. This option defaults to off.

The **Wash Lights** category contains Frequency Color, Band Conversation, Peak
Ripple, Color Memory, Sonic Stream, and Twinklecat. Each has focused controls
and two built-in presets. See `WASH_EFFECTS.md` for details. Prior custom wash
effects and a configuration snapshot are in `deprecated_archive`.

The source is the official LedFx `main` branch with the frontend submodule.
Python 3.12, Node, uv, dependencies and download caches are on this SSD.
On another 64-bit Windows PC, run `Rebuild-LedFX.ps1` to recreate the build
from the local caches after a drive-letter change. Close LedFX before rebuilding.
The executable and bundled
frontend are the runtime deliverable. Real audio and WLED hardware behavior
should be checked with the fixtures before a show.

On Windows, the audio source list also includes **Windows WASAPI Loopback**
entries for playback devices. Choose **Headphones (JBL Tune Beam 2)** there to
make the lights react to audio played through those Bluetooth headphones. The
similarly named **Headset** entry is the Bluetooth microphone, not the music
playback stream. The current audio source is kept until you select a new one.
