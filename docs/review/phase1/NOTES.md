# Phase 1 review

Screenshots in this folder: six destinations x 1200px and 390px x light and dark.

## What changed

Nine tabs became six destinations: Home, Money, Budget, Credit & Debt, Wealth,
Plan. Wealth was kept at your request, so this is six rather than the five in
the brief. Import and Settings moved under the household name, which is now a
real button with a menu.

Home leads with a sentence written from the data, then the insights feed capped
at three, then the numbers. The surplus bar chart is gone: income vs spending
already answered that question.

Money merges Transactions and Recurring into collapsible sections. Only the
first is open; the second shows a one-line summary until asked for, and the
choice is remembered.

The URL is now the state (`#/money/2026-09`), so every screen is a link and the
back button moves between screens instead of leaving the app.

On a phone: one header row, bottom navigation, and transactions as list rows
rather than a six-column table.

## Verified

- 96 render combinations across four data shapes, three months, all eight views
- No console errors, no horizontal scroll at 390px in either theme
- Deep link sets both tab and month; back button walks history correctly
- Sections collapse, persist, and lazy-render their bodies
- Household menu opens, routes, and closes on Escape or outside click

## Known outstanding

Text below 13px: roughly 60 to 150 elements per screen, and about 1,400 on
Money because of the transaction rows. These are the existing 11.5 and 12px
captions. Phase 2 sets the type scale and removes them; they are listed here so
the check is not silently ignored in the meantime.
