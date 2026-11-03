# Stable upstream upgrade — 3 November 2026

## Target and result

Merged **v2.2.1**, upstream commit
`e25a9b52f6d6503c2f4ff000414924ce8e110b66`.
GitHub's latest-release API and releases page were checked on 3 November 2026;
this release is neither a draft nor a prerelease. The merge includes the stable
2.2.0 changes and 2.2.1 repairs. Unreleased main/API v2 migrations were excluded.

Sources:
- https://github.com/LedFx/LedFx/releases/tag/v2.2.1
- https://github.com/LedFx/LedFx/releases/tag/v2.2.0

The earlier 14 October review is retained in this file's Git history.

## Retained custom behaviour

- Studio's separate library, rigs, themes, effect/colour arrangements and Undo.
- Vendored frontend source and custom built frontend, including Studio assets,
  wash categories and the portable root route fix.
- Windows WASAPI playback-loopback adapter and its Windows-only dependency.
- Beat Scan and all six wash effects.
- RGBW packet builders, independent white/UV output, RGB-only preview events,
  and channel-aware pixel writes.
- Portable launcher and build scripts.

WLED output keys now include the custom RGBW/independent-white settings, so
changing the fourth-channel mode rebuilds the sender instead of retaining the
old packet type. Stable's scalar RGB write repair is retained for both RGB and
RGBW device buffers. Custom metadata annotations/imports were aligned with
upstream's lint rules; no new product features were added.

## Upstream repairs of particular relevance

- E1.31 senders use ephemeral source ports, avoiding collisions on UDP 5568.
- E1.31 channel/universe boundaries and live output reconfiguration are fixed.
- IP changes invalidate cached destinations before resolving the new address.
- Render failures are contained; config validation and transitions are repaired.
- Stable origin/host policy and resource/security repairs are retained.
- Sendspin uses the stable-compatible aiosendspin 9.1.1 API.

## Dependencies and automation

The Python range is 3.11–3.14. The lock was regenerated from the stable lock plus
SoundCard for the retained Windows loopback adapter; the automatic merge's mixed
NumPy references were not used. Package metadata points to the fork's README.md.

Upstream-specific release/publish workflows are retained as reference under
`.github/upstream-workflows/`, where GitHub does not execute them. The fork's
focused source-check workflow remains active. No official LedFx release,
container registry or installer publishing credentials are assumed.

## Validation

- 14 Studio behaviour tests passed with the stable dependency environment.
- 304 selected custom/upstream regression cases passed, covering custom effects,
  device lifecycle, runtime pixel count, origin policy (including an isolated
  running API), audio selection, typing regressions and Sendspin lifecycle.
- One upstream port-ownership test was deselected locally because the separate
  production app already owns UDP 5568. A dedicated custom test instead created
  two real stable sender sockets simultaneously and verified distinct ephemeral
  source ports, without starting their threads or sending light-control traffic.
- The browser loaded Studio from a clean isolated 2.2.1 API, applied effects and
  a theme to dummy devices, switched effects and performed Undo successfully.
- Retained custom/merged paths passed the stable Ruff checks.

This record concerns repository/source compatibility. Updating this checkout does
not replace a separately running older portable executable. Physical fixture
behaviour requires live verification after any separately authorized deployment.
