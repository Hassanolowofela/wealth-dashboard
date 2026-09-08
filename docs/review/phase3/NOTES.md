# Phase 3 review: delight and voice

Captured with `python review_shots.py phase3`, plus a set of interaction shots
(`moment-*.png`, `recap-*.png`, `disclosure-open.png`) taken by driving the app
rather than just loading it.

## What changed

### Undo, everywhere it belongs

`undoable()` already existed but only wrapped deletions. It now wraps every
change a person might not have meant:

| Action | Before | Now |
| --- | --- | --- |
| Dismiss an insight | gone for a month, no way back | "Hidden until next month" with Undo |
| Add a categorisation rule | applied silently | names what it will do, with Undo |
| Re-categorise everything | a count in a toast | reversible, and it says how many |
| Change a row's category | a toast telling you to go and find Settings | "Moved to Groceries", with Undo |

The old inline-category toast told the reader to "use Settings, rules", which
is a dead end: it names a place and leaves them to find it. Undo replaces it.

### A live region that actually announces

The toast carried `role="status"`, but Phase 2 made it `visibility: hidden`
when idle, which takes it out of the accessibility tree, and a live region that
appears at the moment its text changes is not announced at all. So
announcements now go to a permanent, never-hidden `#live` region, and every
toast and undo writes to it. Undo announces "Undo is available" so the offer is
not visual-only.

### Motion, once, honoured globally

`--mo-fast`, `--mo` and `--mo-slow` sit with the rest of the scale, and one
global `prefers-reduced-motion` block collapses every duration in the app. New
animation added later cannot quietly ignore the setting, because the rule
matches everything rather than being repeated per component.

Verified with a reduced-motion browser context: `REDUCED_MOTION.matches` is
true, the count-up is skipped entirely and the value is final on first paint,
and computed animation and transition durations are 0.00001s.

### Numbers that count up

560ms, cubic ease-out, and they run **from last month's figure to this one**
rather than from zero. A run from $0 reads as a slot machine; a run from
$3,505 to $2,938 is the comparison, shown rather than stated.

They fire on arrival only, keyed on destination plus month plus member. A
number that restarted every time you typed in the filter box would be a
distraction rather than a flourish.

### Milestones

Goal funded, card cleared, month came in under budget. Each is a crossing, not
a state: keys are recorded the moment they are detected, so a milestone is
acknowledged once and never again. On the very first run every already-true
milestone is recorded silently, so opening the dashboard with three funded
goals does not produce three congratulations for work done before it existed.

Verified: funding a goal produces one strip; looking again produces none.

The strip is a 320ms, 6px entrance in the accent. It can be waved away, and it
is never in the way of anything.

### Close the month

A one-screen recap of the month that just ended: what was left over, what came
in, what went out, what was set aside, then three or four sentences about how
it went, then where most of it went.

It is offered, not imposed. A card appears on Home for the first eight days of
a new month and disappears the moment it is read or waved off. A modal that
appeared by itself every first of the month would be an interruption.

### People, not dots

A member was a coloured dot beside a name. They are now their initials in their
own colour, and it is the same colour they carry on every chart, so the badge
in the ledger and the bar in the chart are recognisably the same person.

### Voice

- **One name.** The product was "the app", "this app", "the dashboard" and
  "this dashboard" in the same interface. It is "this dashboard" throughout;
  "app" survives only in code comments.
- **Second person.** Copy that reported on "a household" or "most households"
  now speaks to the reader. The onboarding, the aggregation explanation, the
  savings-rate definition and the Plan disclaimer were rewritten.
- **No developer instructions.** The sharing dialog told people to find a
  `dist` folder, copy a `finance-dashboard` directory and read `DEPLOY.md`. The
  storage warning told them to serve a folder over `http://localhost` and see
  the README. Both are rewritten in terms a reader can act on: send the
  address, or send the one file. No `<code>` remains anywhere in the interface.
- **Real plurals.** "1 transaction(s)" is gone. A `plural()` helper handles the
  regular cases and the -es/-ies rules; 17 hand-written `? '' : 's'` ternaries
  and 9 `(s)` forms went through it.

### Reasoning, folded away (carried over from Phase 2)

A `disclosure()` helper, built on native `<details>` so it is keyboard-reachable
and announced as expandable without a line of script. Two of the longest
teaching blocks moved behind it: the six principles on Plan, and the
explanation of why the credit score shown is a model rather than a score.

The liability disclaimer on Plan deliberately stayed in plain sight. It was
tightened and put in second person, but hiding it would have been the wrong
call.

## Bugs found and fixed while building this

- A CSS class collision: the new disclosure used `.why`, which was already the
  class on the six health-score explanations, so its rules were styling six
  unrelated paragraphs. Renamed to `.disclosure`.
- A bash heredoc ate a backslash and turned the CSS escape `\203A` into the
  control character 0x83 followed by a literal "A", which rendered as a tofu
  box in the disclosure marker. Replaced with the literal character.
- The build guard refused to ship because my own doc comment used real
  household names as an example of initials. That is exactly what the guard is
  for; the example is now generic.
- The recap's fourth cell read "49 transactions" as a value and wrapped onto
  two lines, breaking the row's baseline. The label carries the noun now.

## Checks

| Check | Result |
| --- | --- |
| Console errors, six destinations, both themes, both widths | none |
| Horizontal scroll at 390px | 0px on all six |
| Text below 13px | none found |
| "How is this calculated" opens | 4 of 4 |
| First run shows setup, and stays silent about milestones | pass |
| Count-up runs on arrival, settles on the exact figure | pass |
| Reduced motion: no count-up, durations collapsed | pass |
| Dismiss records the month, Undo removes it entirely | pass |
| Every destination and both sub-views render | pass |
| Em-dashes in any source file | 0 |
| Build guards (personal data, CSP agreement) | pass |

## Not done in this phase

Phase 4 items remain: focus return on modal close, arrow-key movement on the
tab list, aria-labels on the remaining inline row selects, a real button inside
the import drop zone, the year in ledger dates when viewing a past month, and
sentence-case merchant names in display while keeping the raw text for matching.
