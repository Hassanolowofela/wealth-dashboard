# Phase 4 review: accessibility and the last details

Captured with `python review_shots.py phase4`, plus detail shots and four
scripted audits: labelling, accessible names, keyboard reachability and colour
contrast. The audits are what found most of what follows; the brief's list was
the starting point, not the finding.

## Dialogs

Every dialog already declared `role="dialog"` and `aria-modal="true"`. Three
things were missing behind that declaration:

- **Focus return.** Closing a dialog dropped focus onto `<body>`, so a keyboard
  user restarted from the top of the page every time. Focus now goes back to
  whatever opened the dialog, if it is still on the page.
- **A focus trap.** `aria-modal="true"` tells assistive technology the rest of
  the page is inert. Tab did not behave that way, so it walked out of the
  dialog and into the page behind it. Tab and Shift+Tab now cycle inside.
- **A name.** The dialog had a visible heading but no `aria-labelledby`, and the
  close button was a bare multiplication sign. Both fixed; the close button now
  reads "Close Add transaction".

A dialog with no field to fill also now receives focus itself, rather than
leaving focus outside a dialog that claims the page is inert.

Verified by driving the keyboard: opening from a specific button, checking
focus lands inside, pressing Escape, and confirming focus returns to that same
button by its accessible name.

## Colour contrast, measured rather than assumed

This is the largest finding of the phase, and none of it was on the brief's
list. Computing every visible text colour against its actual painted
background, across eight destinations and both themes:

| Problem | Was | Now |
| --- | --- | --- |
| `--muted`, light theme | 3.41:1 | 5.28:1 |
| `--muted`, dark theme on the darkest surface | 4.00:1 | 4.85:1 |
| Amber used as text (utilisation figures) | 1.79:1 | 6.48:1 |
| Green used as text | 3.27:1 | 7.35:1 |
| Orange used as text | 2.57:1 | 7.42:1 |
| White on the accent, dark theme | 2.63:1 | 8.10:1 |
| The "now" tag | 4.41:1 | passes |

`--muted` alone carries most of the secondary text in the app: every `.sub`,
every table header, every delta line, the account column. It was failing AA
everywhere.

The status colours were the second half. They are built for fills, bars and
borders, where a block of colour carries the meaning; as text they are far too
light. There is now a `toneInk()` beside `toneVar()`, and anything that says a
status in words or figures uses it. A `--serious-ink` was added to complete the
set.

The third was mine, from Phase 2: I made the dark accent a light blue and left
white text on it, which fails at 2.63:1. Everything sitting on the accent now
uses `--on-accent`, which flips with the theme: the primary button, the
selected chip, the skip link, the logo, the wizard step marker, the milestone
tick.

**Result: zero contrast failures across eight destinations, nine dialogs and
both themes.**

## Keyboard

- The bottom bar on a phone declared `role="tab"` but had no roving tabindex
  and no arrow keys, so it was a tab list that did not behave like one. It now
  shares the handler with the desktop strip. Only one of the two is visible at
  a time, so only one is ever focusable.
- The import drop zone was a clickable `<div>`: reachable with a mouse, not
  with a keyboard. There is now a real button inside it. The box stays
  clickable for the mouse, and the button owns the keyboard.
- Walking the tab order on every destination: every stop has a visible focus
  mark, and focus is never lost.

## Labelling

One unlabelled control in the whole app, the paste box on Import, now inside a
real label. One unnamed button, the dialog close, now named. Everything else
was already labelled from earlier phases.

## Detail

- **Dates.** The ledger showed `09-14`, which is fine while you are looking at
  the month you are in and ambiguous the moment you are not. Rows outside the
  current month now show the full `2026-06-28`.
- **Merchant names.** Statements arrive shouting: `PANERA BREAD 601`,
  `CVS/PHARMACY #7712`. They are now displayed as names. This is display only:
  categorisation, rules and the duplicate fingerprint all still work on the raw
  text, because changing what is matched would change which category a
  transaction lands in. Short all-caps runs that are really acronyms are left
  alone, and anything already mixed case is left alone on the grounds that
  whoever wrote it meant it.
- **Form alignment.** Fields side by side aligned on the bottom only, so labels
  were staggered by a few pixels whenever one control was taller than its
  neighbour. Measured before: label tops at 297, 299, 301. Now the label starts
  at the top of the row and the control is pushed to the bottom, so both edges
  line up: tops all 297, bottoms all 366.

## Checks

| Check | Result |
| --- | --- |
| Contrast, 8 destinations x 2 themes | 0 failures |
| Contrast inside 9 dialogs x 2 themes | 0 failures |
| Unlabelled form controls | 0 |
| Buttons, links and summaries with no accessible name | 0 |
| Focus visible on every tab stop, 7 destinations | pass |
| Focus returns to the opener on dialog close | pass |
| Tab and Shift+Tab stay inside a dialog | pass |
| Arrow keys on both tab lists, roving tabindex correct | pass |
| Console errors | none |
| Horizontal scroll at 390px | 0px |
| Text below 13px | none |
| Em-dashes in any source file | 0 |
| Build guards | pass |

## Where the redesign stands

All four phases of the brief are done. Phase 0 fixed the numbers that were
wrong, Phase 1 the structure, Phase 2 the visual system, Phase 3 the voice and
the moments, Phase 4 the accessibility and the details.

Two things a future pass could still take further: the merchant formatter has
no dictionary, so "MCDONALD'S" becomes "Mcdonald's" rather than "McDonald's";
and the long recommendation lists on Credit & Debt are still a flat sequence of
equally weighted items, which is a structure question rather than a styling one.
