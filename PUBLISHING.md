# Maintaining this publication

This repository includes the custom backend, vendored frontend, Studio source,
launcher source and focused tests. Runtime dependencies, executable builds,
controller settings, caches and backups stay outside version control.

The first publication was prepared in an isolated checkout so the existing
portable installation could keep running. That original installation does not
automatically sync its uncommitted changes here. For future coding, use this
repository checkout, or deliberately copy and review changes from the original
workspace before committing them.

- `origin`: https://github.com/Kit-Leeming/LedFX-Studio.git
- `upstream`: https://github.com/LedFx/LedFx.git
- Main branch: `main`
- Frontend upstream provenance and license: THIRD_PARTY_NOTICES.md

For future changes, create a branch, run the focused tests in README.md, review
`git diff` and `git status`, then commit and push. Generated backend executables
belong in a separately reviewed GitHub Release if a binary release is wanted;
they are not included in this source publication.

The upstream comparison in UPSTREAM_REVIEW.md is dated. Review current upstream
changes before merging rather than assuming this fork has the latest fixes.
