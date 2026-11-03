# Attribution and source provenance

This repository is a modified LedFx distribution, not a claim of authorship over
upstream code. Existing copyright notices, AUTHORS.rst and license texts are retained.

## Backend and project history

- Upstream: https://github.com/LedFx/LedFx
- Base commit: a6e73a886dc6252b9df2a9c5d3e8928e07fffa61
- License: GNU General Public License v3; see LICENSE.txt and upstream file notices.
- Upstream Git history is retained as the parent history of this fork.

## Vendored frontend

- Upstream: https://github.com/YeonV/LedFx-Frontend-v2
- Base commit: 431f1d866bf3c928391f9206ccfc0d9db73584e6
- License: GNU Affero General Public License v3; see frontend/LICENSE.
- Local frontend changes include wash-effect category integration, portable root
  routing, build configuration, and the public/studio interface.

The original project represents frontend/ as a submodule. This publication vendors
its source so a single clone includes the customised frontend. Its internal Git
metadata and node_modules are not included. This does not change its license.
Bundled frontend assets under ledfx_frontend/ derive from that frontend and retain
their accompanying license notices.

## Other references

The wash-effect design references and the distinction between independent
adaptations and verbatim ports are documented in WASH_EFFECTS.md. Third-party
libraries retain their own licenses. Custom changes are distributed under the
applicable licenses of the components they modify.
