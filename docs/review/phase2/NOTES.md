# Phase 2 review: the visual system

Captured with `python review_shots.py phase2`. Six destinations at 1200px and
390px, light and dark, on sample data.

## What changed

### Typeface

Space Grotesk is self-hosted as a single variable file, `fonts/space-grotesk-var.woff2`
(21.8 KB, latin subset). A Google Fonts link was rejected: the app's own CSP
allows `font-src 'self'`, a CDN request would break offline use, and it would
contradict the promise that nothing leaves the device. `font-display: swap`
means text is readable in the fallback stack from the first paint.

The display face carries section titles, hero numbers and the headline
sentence. Everything else stays on the system stack, which is what the reader's
own operating system has already optimised.

### Type scale

One scale, six steps: 13, 14, 16, 20, 28, 44. Body base moved from 14px to
16px. Every size in the app was snapped onto that scale, from a previous range
of fifteen distinct values in CSS and eight more inline. Nothing renders below
13px anywhere, at any width, which the capture checks on every destination.

Numbers that sit in a column use `tabular-nums`; hero figures use proportional
figures and tight tracking, because they are read as a shape rather than
compared digit by digit.

### Colour

One accent, declared once as `--accent` and redefined per theme. It was
darkened from `#2a78d6` to `#2470ce` so that white text on it reaches 4.9:1
rather than 4.4:1; that single token also carries primary buttons, the selected
tab, chips, links, focus rings and the skip link, so all of them improved.

Red, amber and green now appear only as state: over budget, high utilisation,
a factor score. They no longer appear as series colours.

A single series is not an identity, so single-series charts are drawn in
`--chart-ink` with the accent spent on the endpoint, which is the only point
that is news. The sparklines on Home, the utilisation trend and the ranked bar
charts all moved. Income against spending keeps two colours because it is a
real comparison, and it is accent against ink rather than two competing hues.
The projection chart keeps the ordered `--seq-*` ramp, which is a legitimate
sequential scale.

The eight-hue palette survives for the one job it is good at: giving each
person in the household a fixed colour in per-person comparisons.

Text laid on a filled chart segment now follows the fill through
`--on-ink`, `--on-ink-2` and `--on-accent`, because the fills invert between
themes and white-on-light was unreadable in dark.

### Surfaces

A card is now an object you can act on: a transaction, a credit card, a goal,
a choice between payoff strategies, a prompt with a button. Reporting is not an
object, so 45 containers that were cards became panels: no fill, no shadow, no
border, one rule and enough space to be their own thing. The KPI tiles were
flattened for the same reason, since a measurement is not something you can
click.

### Density

The 8px scale is now the only source of spacing: 121 values in the stylesheet
and 99 inline values were snapped onto it, leaving 0, 2, 4, 8, 12, 16, 24 and a
handful of structural offsets. Panels carry a 24px section rhythm. Prose is
capped at 72 characters wherever it appears; tables, numbers and charts are
exempt because they need the width they need.

## Bugs found and fixed while auditing

- An empty toast pill was painting in the middle of full-page captures, black
  in light and white in dark. It was parked off-screen by transform alone,
  which does not stop it being painted. It is now `visibility: hidden` until
  shown, which also keeps an empty pill out of the accessibility tree.
- Ranked bar charts reserved a flat 200px before mounting regardless of row
  count, so a three-row chart sat in a pool of blank space. The reservation is
  now computed from the row count, and released once the chart is drawn.
- The KPI band drew a bottom rule directly above the top rule of the panels
  below it, producing a doubled line. The band no longer draws its own.

## Checks

| Check | Result |
| --- | --- |
| Console errors across all six destinations, both themes, both widths | none |
| Horizontal scroll at 390px | 0px on all six |
| Text below 13px | none found |
| "How is this calculated" opens | 4 of 4 on Home |
| Em-dashes in any source file | 0 |
| Build guards (personal data, CSP agreement) | pass |

## Not done in this phase

Copy still mixes teaching with reporting in places, and the long explanatory
paragraphs on Credit & Debt and Plan are still inline rather than behind the
"why" layer. Moving them is Phase 3 work, alongside the second-person rewrite.
