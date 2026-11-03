# Upstream review — 14 October 2026

The local checkout is based on `a6e73a886dc6252b9df2a9c5d3e8928e07fffa61`
(27 September 2026); both pyproject.toml and ledfx/consts.py report version 2.1.9.
The latest stable release verified on GitHub and PyPI is 2.2.1, released
4 October 2026, commit `e25a9b52f6d6503c2f4ff000414924ce8e110b66`.
`git rev-list --left-right --count HEAD...v2.2.1` returned `0 80`.
The release tags were fetched for comparison. No upstream code has been merged.

Sources:
- https://github.com/LedFx/LedFx/releases/tag/v2.2.1
- https://github.com/LedFx/LedFx/releases/tag/v2.2.0
- https://pypi.org/project/LedFx/2.2.1/

2.2.0 updates include Python/dependency changes, now-playing additions and audio
selection/Sendspin fixes. 2.2.1 adds device output after configuration changes,
E1.31 universe and source-port fixes, render/config/transition repairs, Web Audio
validation, discovery cleanup, integrations and Windows installer fixes.
For this portable fork the installer changes are less relevant than the backend
repairs. Use stable 2.2.1 as the merge target: its release notes explicitly retain
2.2.0's configuration format and v1 API, excluding main's migration/API v2 work.

## Suggested merge procedure

1. Preserve the existing config and running portable distribution. Capture the
   current root changes, untracked custom effects and frontend submodule changes
   into a reviewable fork branch/snapshot before updating. Do not clean/reset this
   checkout or overwrite it with an official release binary.
2. Merge v2.2.1 in an isolated checkout and resolve overlapping changes deliberately.
   Local modifications overlap upstream in audio.py, virtuals.py, api/utils.py,
   devices/__init__.py, ddp.py, packets.py, udp.py, wled.py, hiddenimports.py and
   dependency files. Keep WASAPI loopback, RGBW/independent-white behaviour,
   Beat Scan and wash effects. Review upstream dependency upgrades against the
   project's Python 3.12 runtime and portable caches.
3. Retain the frontend source changes for wash categories and the root PUBLIC_URL /
   routing fix. Rebuild from source; do not replace the customised frontend with
   upstream's bundled assets. Preserve the new public/studio assets and backend.
4. Review API origin-policy/auth-related changes with the existing local browser,
   Home Assistant and other clients before applying them. Keep API v1 compatibility.
5. Run the Studio and custom-effect tests, isolated packaged API tests, then real
   audio/physical controller checks for WLED RGBW, DDP and E1.31. Check gradients,
   transitions, device pixel-count changes, output after reconfiguration, classic
   scenes and Studio theme/preset persistence.
6. Deploy a tested staged distribution with a recoverable previous runtime/config.

The new Studio is deliberately independent of upstream scene storage: a separate
versioned studio.json contains rigs, colour themes, effect/colour arrangements,
paired scene references and current theme assignments. The legacy scene browser
is unchanged. This reduces conflict with the eventual stable merge.
