# Changelog

## 0.1.0 — 2026-08-23

### Minor

- First published release. `@bdelanghe/brand` has existed as a git dependency since the beginning — consumed by `robertdelanghe.dev` at a pinned commit, with no tag and no registry presence — so this is the version that turns it into a package: the design tokens (`tokens.css`, `tokens.json`, and their a11y/pairing/contrast contracts), the CSS layers, the content strings and their schema, and the mark and lockup assets.
- `tools/` is no longer part of the published package. The analysis scripts (`coverage.mjs`, `content.mjs`, `a11y.mjs`, `meta.mjs`) are CI-internal tooling rather than a distributable asset, and they move to `@bdelanghe/brand-tools` — which depends on this package rather than living inside it.
