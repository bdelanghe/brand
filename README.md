# brand — Robert DeLanghe

My **personal brand**: the token set (colors, type, space, the marks) that themes my
surfaces — robertdelanghe.dev first.

It's a **pinning of [`bounded-systems/baobab`](https://github.com/bounded-systems/baobab)**:
baobab is the design-system *structure* (no defaults); this repo supplies the *values*.
One structure, many pinnings — the Bounded Systems org has its own
([`bounded-systems/brand`](https://github.com/bounded-systems/brand)); this is mine.

```
bounded-systems/baobab    structure, no defaults
  └─ bdelanghe/brand        this pinning — the token set
lone                        per-component a11y spec engine (jsr:@bounded-systems/lone)
```

## What's here

- `tokens/tokens.json` — source of truth (W3C design tokens: primitive → semantic → recipe).
  Semantic roles are purpose-named (`accent`, `status-negative`, `accent-ink`, …), never
  hue-named — a recolor should never force a rename.
- `tokens/tokens.css` — the emitted `--bs-*` custom properties (regenerate via
  `tokens/build-tokens.mjs`).
- `tokens/contrast.contract.json` — this pinning's own pairs for
  [`bounded-systems/baobab`](https://github.com/bounded-systems/baobab)'s `checkContrast` /
  reusable `check-contrast.yml` workflow.
- `tokens/palette.pairings.json` + `tokens/token-a11y.json` — the stricter WCAG+CVD+APCA
  palette gate (`vendor/conformance-kit/gates/palette-gate.mjs`, consumed by a downstream
  site's `token-a11y.mjs`). **Known-failing, disclosed, not silently faked**: 11 pairings
  currently fail CVD/APCA/non-text checks (e.g. `accent` on `paper` drops under 4.5:1 under
  simulated deuteranopia; several decorative divider/border pairings are well under the 3:1
  UI floor). Fixing these needs real palette-value changes, not a rename — tracked as
  follow-up work, not done in the initial brick recolor.
- `css/base.css`, `css/fonts.css` + `css/fonts/*.woff2` — resets and self-hosted fonts
  (OFL: Space Grotesk, IBM Plex Mono — same choice as `bounded-systems/brand`).
- `mark/`, `lockup/`, `favicon-32.png` — the personal "r+d, door ajar" monogram, recolored
  to the brick accent.
- `content/strings.json` + `tools/{coverage,content,meta,a11y}.mjs` — content-token catalog
  and the design-system coverage/meta/a11y checks a downstream site's CI calls directly.

Seeded from `bounded-systems/brand`'s token set as a starting point; it diverges from here
as the personal pinning.
