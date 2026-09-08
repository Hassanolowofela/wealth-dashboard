/* ==========================================================================
   The moments layer.

   Numbers that count up, milestones that get acknowledged once, and the
   end-of-month recap. None of it changes a figure; all of it is about the
   difference between a report and something that notices you.

   Everything here is skipped outright when the reader has asked their system
   for less motion, and nothing here ever blocks an action.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------- count-up */

/**
 * Run a value up to its final figure.
 *
 * The point is to draw the eye to the number, not to make anyone wait for it,
 * so it is short and it starts near the answer rather than at zero: a run from
 * $0 to $2,938 reads as a slot machine, while a run from the previous month's
 * figure reads as a change. With no previous figure it starts at 82% of the
 * target, which is enough movement to notice and not enough to misinform.
 */
function countUp(el, to, fmt, from = null, ms = 560) {
  const start = from == null ? to * 0.82 : from;
  if (!isFinite(start) || !isFinite(to) || start === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const ease = p => 1 - Math.pow(1 - p, 3);     // fast out of the gate, settles
  function frame(now) {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(start + (to - start) * ease(p));
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = fmt(to);              // never leave a rounded figure
  }
  requestAnimationFrame(frame);
}

const COUNT_FMT = {
  money: v => money(v),
  money2: v => money2(v),
  compact: v => compact(v),
  pct: v => pct(v, 1),
  pct0: v => pct(v, 0),
  int: v => String(Math.round(v))
};

/**
 * Animate the headline figures in a freshly rendered view.
 *
 * Only called when the destination or the month actually changed. Re-rendering
 * in place, which happens on every filter keystroke and every category change,
 * must not restart the animation: a number that keeps rolling while you type
 * is a distraction, not a flourish.
 */
function animateValues(scope) {
  if (REDUCED_MOTION.matches) return;
  for (const el of scope.querySelectorAll('[data-count]')) {
    const to = Number(el.dataset.count);
    const fmt = COUNT_FMT[el.dataset.fmt || 'money'];
    if (!isFinite(to) || !fmt) continue;
    const from = el.dataset.from === undefined ? null : Number(el.dataset.from);
    countUp(el, to, fmt, isFinite(from) ? from : null);
  }
}

/* ------------------------------------------------------------ milestones */

/**
 * Things worth acknowledging, each identified by a key so it is acknowledged
 * exactly once and never again.
 *
 * A milestone is a crossing, not a state. On the very first run every current
 * milestone is recorded silently, so opening the app for the first time with
 * three funded goals does not produce three congratulations for work that was
 * done before the app existed.
 */
function currentMilestones() {
  const out = [];

  for (const g of S.goals || []) {
    if (+g.target > 0 && +g.saved >= +g.target) {
      out.push({
        key: `goal:${g.id}`,
        title: `${g.name} is fully funded`,
        text: `${money(g.target)} set aside. You can mark it done, or point the money at the next thing.`
      });
    }
  }

  for (const c of S.cards || []) {
    if (c.active === false) continue;
    if (+c.limit > 0 && reportedBalance(c) === 0) {
      out.push({
        key: `card:${c.id}:clear`,
        title: `${c.name} is clear`,
        text: 'Nothing reported to the bureaus on this card. Keeping it open and unused is what helps ' +
              'your utilisation, so leave it be.'
      });
    }
  }

  // Only the month that has just ended, and only once it is genuinely over.
  const last = addMonths(thisMonth(), -1);
  const b = budgetSummary(last);
  if (b.anyBudgets && b.usedPct != null && b.usedPct <= 100 && monthStats(last, 'all').count > 0) {
    out.push({
      key: `budget:${last}`,
      title: `${monthLabel(last)} came in under budget`,
      text: `${money(b.budgetedSpend)} against ${money(b.totalBudget)} budgeted, ` +
            `which is ${money(b.totalBudget - b.budgetedSpend)} you did not have to spend.`
    });
  }

  return out;
}

/**
 * What has newly crossed since last time. Records as it reports, so a moment
 * is shown once and stays shown for the rest of that session only.
 */
function newMilestones() {
  const seen = (S.settings.milestones = S.settings.milestones || null);
  const now = currentMilestones();
  const keys = now.map(m => m.key);

  if (seen === null) {
    // first run: everything already true is history, not news
    S.settings.milestones = keys;
    save();
    return [];
  }
  const fresh = now.filter(m => !seen.includes(m.key));
  if (fresh.length) {
    // keys that are no longer true are dropped, so a goal that is emptied and
    // refunded is worth acknowledging again
    S.settings.milestones = keys;
    save();
  } else if (seen.length !== keys.length) {
    S.settings.milestones = keys;
    save();
  }
  return fresh;
}

/**
 * Milestones waiting to be shown on this screen.
 *
 * Session-scoped on purpose. A milestone is acknowledged in storage the moment
 * it is detected, so it can never be shown twice; this list is only what is
 * still on screen right now, and it empties as the reader dismisses items or
 * reloads the page.
 */
let MOMENTS_QUEUE = [];

/** Called once after the state is loaded, before the first render. */
function loadMoments() {
  try { MOMENTS_QUEUE = newMilestones(); }
  catch (e) { MOMENTS_QUEUE = []; }   // a flourish must never block the app
}

/** Markup for the moments waiting to be shown, or nothing at all. */
function momentsStrip() {
  const list = MOMENTS_QUEUE;
  if (!list.length) return '';
  return list.map(mo => `<div class="moment" data-moment="${esc(mo.key)}">
    <span class="moment-mark" aria-hidden="true">&#10003;</span>
    <div class="moment-b"><b>${esc(mo.title)}</b><span>${esc(mo.text)}</span></div>
    <button class="btn sm ghost moment-x" data-act="clear-moment" data-key="${esc(mo.key)}"
      aria-label="Dismiss: ${esc(mo.title)}">&times;</button>
  </div>`).join('');
}

/* --------------------------------------------------------- month recap */

/**
 * The month just ended, in one screen.
 *
 * Offered rather than imposed: it appears as a card on Home during the first
 * week of a new month and goes away once read or dismissed. A modal that
 * appeared on its own every first of the month would be an interruption.
 */
function recapAvailable() {
  const last = addMonths(thisMonth(), -1);
  if (+todayISO().slice(8, 10) > 8) return null;         // the moment has passed
  if ((S.settings.recapSeen || '') === last) return null;
  if (monthStats(last, 'all').count === 0) return null;  // nothing to recap
  return last;
}

function monthRecap(m) {
  const K = monthKpis(m, 'all');
  const b = budgetSummary(m);
  const prev = monthStats(addMonths(m, -1), 'all');
  const st = K.st;
  const cats = Object.entries(st.byCat)
    .filter(([id, v]) => v > 0 && bucketOf(id) !== 'income' && bucketOf(id) !== 'save')
    .sort((a, b2) => b2[1] - a[1]).slice(0, 3);

  const lines = [];
  if (K.savingsRate != null) {
    lines.push(K.savingsRate >= 20
      ? `You kept ${pct(K.savingsRate, 1)} of what came in, which is at or above the 20% benchmark.`
      : `You kept ${pct(K.savingsRate, 1)} of what came in. The benchmark most people aim at is 20%.`);
  }
  if (prev.count > 0) {
    const d = st.spend - prev.spend;
    lines.push(Math.abs(d) < 25
      ? 'You spent almost exactly what you spent the month before.'
      : `You spent ${money(Math.abs(d))} ${d < 0 ? 'less' : 'more'} than the month before.`);
  }
  if (b.anyBudgets && b.usedPct != null) {
    lines.push(b.usedPct <= 100
      ? `Your budgeted categories came in at ${pct(b.usedPct)} of plan.`
      : `Your budgeted categories ran to ${pct(b.usedPct)} of plan, with ${plural(b.over.length, 'category')} over.`);
  }
  if (st.invested > 0) lines.push(`${money(st.invested)} went into investments.`);

  openModal(`${monthLabel(m)}, closed`, `
    <div class="recap-hero">
      <div class="recap-n">${money(st.net)}</div>
      <div class="sub">left over after everything you spent and everything you set aside</div>
    </div>
    <div class="recap-grid">
      <div><span class="sub">Came in</span><b>${money(st.income)}</b></div>
      <div><span class="sub">Went out</span><b>${money(st.spend)}</b></div>
      <div><span class="sub">Set aside</span><b>${money(st.totalSaved)}</b></div>
      <div><span class="sub">Transactions</span><b>${st.count.toLocaleString('en-US')}</b></div>
    </div>
    ${lines.length ? `<ul class="recap-lines">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${cats.length ? `<div class="sub" style="margin-top:16px">Where most of it went:
      ${cats.map(([id, v]) => `<b>${esc(catName(id))}</b> ${money(v)}`).join(' &middot; ')}</div>` : ''}
  `, `<button class="btn" data-act="go-month" data-m="${m}" data-close>Look at the month</button>
      <button class="btn primary" id="recapDone">Close the month</button>`,
    root => root.querySelector('#recapDone').onclick = () => {
      S.settings.recapSeen = m;
      save(); closeModal(); render();
      toast(`${monthLabel(m)} closed`);
    });
}
