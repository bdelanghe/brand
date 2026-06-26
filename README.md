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
- `tokens/tokens.css` — the emitted `--bs-*` custom properties (regenerate via
  `tokens/build-tokens.mjs`).

Seeded from `bounded-systems/brand`'s token set as a starting point; it diverges from here
as the personal pinning.
