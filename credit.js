/* ==========================================================================
   Credit cards: utilisation, payment timing, scoring factors, rewards.

   The score here is a MODEL of the published FICO factor weights applied to
   the card data you enter. It is not your score and cannot be - the bureaus
   hold data this app never sees. It is useful for the same reason a budget is
   useful: it shows which lever has the most slack. Real scores are free from
   most card issuers and from annualcreditreport.com.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ basics */

const activeCards = () => (S.cards || []).filter(c => c.active !== false);

/** What the issuer reports to the bureaus is the statement balance, not today's. */
function reportedBalance(c) {
  const s = c.statementBalance;
  return (s === null || s === undefined || s === '') ? (+c.balance || 0) : (+s || 0);
}
const cardUtil = c => (+c.limit > 0 ? (reportedBalance(c) / +c.limit) * 100 : 0);
const liveUtil = c => (+c.limit > 0 ? ((+c.balance || 0) / +c.limit) * 100 : 0);

const totalLimit = () => sum(activeCards().map(c => +c.limit || 0));
const totalReported = () => sum(activeCards().map(reportedBalance));
const totalCardBalance = () => sum(activeCards().map(c => +c.balance || 0));
const aggregateUtil = () => (totalLimit() > 0 ? (totalReported() / totalLimit()) * 100 : 0);

/** Every revolving and installment obligation in one shape, for the payoff engine. */
function allDebts() {
  const cards = activeCards()
    .filter(c => (+c.balance || 0) > 0)
    .map(c => ({ name: c.name, balance: +c.balance || 0, apr: +c.apr || 0,
                 minPayment: +c.minPayment || 0, kind: 'card' }));
  const loans = (S.debts || [])
    .filter(d => (+d.balance || 0) > 0)
    .map(d => ({ name: d.name, balance: +d.balance || 0, apr: +d.apr || 0,
                 minPayment: +d.minPayment || 0, kind: 'loan' }));
  return [...cards, ...loans];
}

/* ------------------------------------------------------------------- dates */

function monthsSince(v) {
  if (!v) return null;
  const s = String(v);
  const y = +s.slice(0, 4), mo = +s.slice(5, 7) || 1;
  if (!y) return null;
  const now = new Date();
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
}
const yearsText = mo => mo == null ? '-'
  : mo < 12 ? `${mo} mo` : `${(mo / 12).toFixed(1)} yr`;

/** Next calendar occurrence of a day-of-month, as an ISO date. */
function nextDayOfMonth(day) {
  if (!day) return null;
  const now = new Date();
  const d = Math.min(+day, 28);
  let dt = new Date(now.getFullYear(), now.getMonth(), d);
  if (dt < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    dt = new Date(now.getFullYear(), now.getMonth() + 1, d);
  }
  return dt.toISOString().slice(0, 10);
}
const daysUntil = iso => {
  if (!iso) return null;
  const a = new Date(todayISO() + 'T00:00:00'), b = new Date(iso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
};

/**
 * The single most misunderstood piece of card mechanics: the balance that
 * lands on your credit report is whatever is sitting there when the statement
 * closes, which is roughly three weeks BEFORE the payment is due.
 */
function cardTiming(c) {
  const close = nextDayOfMonth(c.statementDay);
  const due = nextDayOfMonth(c.dueDay);
  return {
    close, due,
    daysToClose: daysUntil(close),
    daysToDue: daysUntil(due)
  };
}

/* --------------------------------------------------------- payment history */

/** On-time run length, plus any lates recent enough to still be scored. */
function paymentRecord() {
  const pays = [...(S.cardPayments || [])].sort((a, b) => b.date.localeCompare(a.date));
  const lates = pays.filter(p => p.onTime === false);
  let streak = 0;
  for (const p of pays) { if (p.onTime === false) break; streak++; }
  const recentLate = lates.filter(p => (monthsSince(p.date) || 99) <= 24);
  const autopayOff = activeCards().filter(c => !c.autopay || c.autopay === 'none');
  return { pays, lates, streak, recentLate, autopayOff, total: pays.length };
}

/* ------------------------------------------------------------ score factors */

/** Utilisation is scored on the aggregate AND on the worst individual card. */
function utilisationScore() {
  const agg = aggregateUtil();
  const cards = activeCards().filter(c => +c.limit > 0);
  const worst = cards.length ? Math.max(...cards.map(cardUtil)) : 0;
  const zeroAll = cards.length > 0 && totalReported() === 0;

  // piecewise, mirroring the published utilisation bands
  let s;
  if (agg <= 1) s = 100;
  else if (agg <= 9) s = 96;
  else if (agg <= 19) s = 88;
  else if (agg <= 29) s = 76;
  else if (agg <= 49) s = 55;
  else if (agg <= 74) s = 32;
  else if (agg <= 94) s = 14;
  else s = 4;

  // a single card sitting high is scored on its own, even with a low aggregate
  let penalty = 0;
  if (worst > 90) penalty = 16;
  else if (worst > 70) penalty = 12;
  else if (worst > 50) penalty = 8;
  else if (worst > 30) penalty = 4;

  // every card reporting zero looks thin rather than excellent
  if (zeroAll) s = 92;

  return { score: clamp(s - penalty, 0, 100), agg, worst, zeroAll, cards: cards.length };
}

function historyScore() {
  const dates = activeCards().map(c => monthsSince(c.openedDate)).filter(x => x != null);
  const manual = monthsSince((S.creditProfile || {}).oldestAccount);
  if (!dates.length && manual == null) return { score: null, avg: null, oldest: null };
  const oldest = Math.max(...(dates.length ? dates : [0]), manual || 0);
  const avg = dates.length ? sum(dates) / dates.length : oldest;
  // oldest account carries more weight than the average
  const sOld = clamp((oldest / 108) * 100, 0, 100);      // 9 years for full marks
  const sAvg = clamp((avg / 84) * 100, 0, 100);          // 7 years for full marks
  return { score: sOld * 0.6 + sAvg * 0.4, avg, oldest };
}

function mixScore() {
  const rev = activeCards().length > 0;
  const inst = (S.debts || []).some(d => (+d.balance || 0) > 0);
  const score = rev && inst ? 100 : (rev || inst) ? 62 : 0;
  return { score, rev, inst };
}

function newCreditScore() {
  const p = S.creditProfile || {};
  const inq = (p.inquiries || []).filter(i => (monthsSince(i.date) || 99) < 12);
  const opened = activeCards().filter(c => (monthsSince(c.openedDate) || 99) < 12);
  let s = 100 - inq.length * 13 - opened.length * 6;
  return { score: clamp(s, 15, 100), inquiries: inq, opened };
}

function paymentScore() {
  const r = paymentRecord();
  if (!r.total && !r.lates.length) return { score: null, ...r };   // nothing logged yet
  let s = 100;
  for (const p of r.lates) {
    const age = monthsSince(p.date) || 99;
    s -= age <= 6 ? 38 : age <= 12 ? 28 : age <= 24 ? 18 : 7;
  }
  if (r.streak >= 24) s = Math.min(100, s + 4);
  return { score: clamp(s, 0, 100), ...r };
}

/**
 * Weighted model of the published FICO factor weights. Unknown factors are
 * dropped and the remaining weights renormalised, and the reported band widens
 * to reflect how much was actually known.
 */
function creditScore() {
  const util = utilisationScore();
  const hist = historyScore();
  const mix = mixScore();
  const nu = newCreditScore();
  const pay = paymentScore();

  const factors = [
    { key: 'payment', name: 'Payment history', weight: 35, score: pay.score, data: pay,
      why: 'Whether you pay on time. The heaviest factor, and the one a single miss damages most.' },
    { key: 'util', name: 'Credit utilisation', weight: 30, score: util.score, data: util,
      why: 'Reported balances against your limits. The fastest factor to move - it resets every month.' },
    { key: 'history', name: 'Length of history', weight: 15, score: hist.score, data: hist,
      why: 'Age of your oldest card and the average across all of them. Only time fixes this, so protect it.' },
    { key: 'mix', name: 'Credit mix', weight: 10, score: mix.score, data: mix,
      why: 'Having both revolving credit (cards) and instalment credit (loans) on file.' },
    { key: 'new', name: 'New credit', weight: 10, score: nu.score, data: nu,
      why: 'Recent hard inquiries and newly opened accounts. Fades after 12 months.' }
  ];

  const known = factors.filter(f => f.score != null);
  const wsum = sum(known.map(f => f.weight));
  const norm = wsum > 0 ? sum(known.map(f => f.score * f.weight)) / wsum : 0;

  // 300-850 is the common consumer range
  const estimate = Math.round(300 + (norm / 100) * 550);

  // confidence: how much of the model's weight rested on real data
  const coverage = wsum / 100;
  const hasLimits = activeCards().every(c => +c.limit > 0);
  const hasDates = activeCards().every(c => c.openedDate);
  let band = 30;
  if (coverage < 1) band += 25;
  if (!hasLimits) band += 20;
  if (!hasDates) band += 15;
  if (!activeCards().length) band += 40;

  const label = estimate >= 800 ? 'Exceptional' : estimate >= 740 ? 'Very good'
    : estimate >= 670 ? 'Good' : estimate >= 580 ? 'Fair' : 'Poor';
  const tone = estimate >= 740 ? 'good' : estimate >= 670 ? 'good'
    : estimate >= 580 ? 'warn' : 'crit';

  return {
    estimate, low: Math.max(300, estimate - band), high: Math.min(850, estimate + band),
    factors, label, tone, coverage, band,
    reported: (S.creditProfile || {}).reportedScore || null
  };
}

/** Points still available in each factor, biggest opportunity first. */
function scoreHeadroom() {
  const cs = creditScore();
  return cs.factors
    .filter(f => f.score != null)
    .map(f => ({ ...f, gap: ((100 - f.score) / 100) * f.weight * 5.5 }))
    .sort((a, b) => b.gap - a.gap);
}

/* ------------------------------------------------------- utilisation moves */

/**
 * What the aggregate becomes if `amount` is paid down before statement close.
 * This is the concrete version of "pay early, not just on time".
 */
function utilAfterPayment(amount, cardId) {
  const lim = totalLimit();
  // no limits recorded means no ratio to report - return zeroes rather than null
  // so callers never have to null-check a shape they use for display
  if (!lim) return { before: 0, after: 0, cardAfter: null, noLimits: true };
  let bal = totalReported();
  bal = Math.max(0, bal - amount);
  const after = (bal / lim) * 100;
  const card = cardId ? activeCards().find(c => c.id === cardId) : null;
  const cardAfter = card && +card.limit > 0
    ? clamp((reportedBalance(card) - amount) / +card.limit * 100, 0, 999) : null;
  return { before: aggregateUtil(), after, cardAfter };
}

/** Amount needed to bring the aggregate down to a target percentage. */
function payToReach(targetPct) {
  const lim = totalLimit();
  if (!lim) return 0;
  return Math.max(0, totalReported() - (targetPct / 100) * lim);
}

/** Effect of closing a card: limit drops, so utilisation on what is left rises. */
function closeImpact(cardId) {
  const c = activeCards().find(x => x.id === cardId);
  if (!c) return null;
  const rest = activeCards().filter(x => x.id !== cardId);
  // Closing an account removes its limit from the calculation but NOT the debt:
  // you still owe whatever is on it. Dropping the balance too would make closing
  // a carried-balance card look like an improvement, which is backwards.
  const lim = sum(rest.map(x => +x.limit || 0));
  const bal = totalReported();
  const age = monthsSince(c.openedDate);
  const ages = activeCards().map(x => monthsSince(x.openedDate)).filter(x => x != null);
  const restAges = rest.map(x => monthsSince(x.openedDate)).filter(x => x != null);
  return {
    card: c,
    utilBefore: aggregateUtil(),
    utilAfter: lim > 0 ? (bal / lim) * 100 : 100,
    limitLost: +c.limit || 0,
    isOldest: age != null && ages.length > 0 && age === Math.max(...ages),
    avgAgeBefore: ages.length ? sum(ages) / ages.length : null,
    avgAgeAfter: restAges.length ? sum(restAges) / restAges.length : null
  };
}

/* ------------------------------------------------------------ interest cost */

/** Monthly interest on cards actually carrying a balance. */
function cardInterestMonthly() {
  return sum(activeCards()
    .filter(c => c.paysInFull === false && (+c.balance || 0) > 0)
    .map(c => (+c.balance || 0) * (+c.apr || 0) / 100 / 12));
}

/** Interest and fees the ledger has actually recorded, annualised. */
function observedInterest() {
  const ms = activeMonths().slice(-6);
  if (!ms.length) return 0;
  return sum(ms.map(m => monthStats(m, 'all').byCat.fees || 0)) / ms.length;
}

/* ----------------------------------------------------------------- rewards */

/** Earn rate for a category, falling back to the card's catch-all rate. */
function rewardRate(card, cat) {
  const rs = card.rewards || [];
  const hit = rs.find(r => r.cat === cat);
  if (hit) return +hit.rate || 0;
  const any = rs.find(r => r.cat === '*');
  return any ? (+any.rate || 0) : 0;
}

/**
 * Categories that can realistically go on a card at face value. Rent, loan
 * payments and insurance are excluded: they are usually ACH-only, or carry a
 * processing fee that swallows any reward. Recommending them would be wrong
 * advice dressed up as a number.
 */
const CARDABLE = new Set(['groceries', 'dining', 'transport', 'travel', 'shopping',
  'fun', 'subs', 'personal', 'health', 'utilities', 'gifts']);

/**
 * Which card should be used where, based on the household's real category
 * spending. Compares what is being earned now against the best available.
 */
function rewardsAnalysis() {
  const cards = activeCards();
  if (!cards.length) return { rows: [], current: 0, best: 0, gain: 0, fees: 0 };

  const ms = activeMonths().slice(-3);
  const annual = {};
  for (const c of CATS) {
    if (!CARDABLE.has(c.id)) continue;
    const avg = ms.length
      ? sum(ms.map(m => monthStats(m, 'all').byCat[c.id] || 0)) / ms.length : 0;
    if (avg > 0) annual[c.id] = avg * 12;
  }

  // where each category's spend currently lands, via the account -> card link
  const cardByAccount = {};
  for (const c of cards) if (c.account) cardByAccount[c.account] = c;

  const payInFull = cards.filter(c => c.paysInFull !== false);
  const carrying = cards.filter(c => c.paysInFull === false);

  const rows = [];
  let current = 0, best = 0;
  for (const [cat, spend] of Object.entries(annual)) {
    // current earn: weight by which account each transaction actually used
    let curEarn = 0, tot = 0;
    for (const m of ms) {
      for (const t of S.txns) {
        if (ym(t.date) !== m || t.cat !== cat || t.amount >= 0) continue;
        const amt = -t.amount; tot += amt;
        const card = cardByAccount[t.account];
        curEarn += amt * (card ? rewardRate(card, cat) : 0) / 100;
      }
    }
    const curRate = tot > 0 ? (curEarn / tot) * 100 : 0;
    // Only ever recommend routing spend to a card that is cleared every month.
    // No reward rate survives an interest charge, so steering spend onto a card
    // carrying a balance would be advice that loses money.
    const rank = list => list.map(c => ({ c, rate: rewardRate(c, cat) })).sort((a, b) => b.rate - a.rate);
    const top = (payInFull.length ? rank(payInFull) : rank(cards))[0];
    const curVal = spend * curRate / 100;
    const bestVal = spend * top.rate / 100;
    current += curVal; best += bestVal;
    rows.push({
      cat, spend, curRate, bestCard: top.c, bestRate: top.rate,
      curVal, bestVal, gain: bestVal - curVal,
      alreadyBest: bestVal - curVal < 1
    });
  }
  rows.sort((a, b) => b.gain - a.gain);
  const fees = sum(cards.map(c => +c.annualFee || 0));
  return {
    rows, current, best, gain: best - current, fees,
    // surfaced in the UI so the exclusion is visible rather than silent
    excluded: carrying, noneClear: payInFull.length === 0
  };
}

/** Annual fee against the rewards that card is actually earning. */
function feeAnalysis() {
  const ra = rewardsAnalysis();
  return activeCards().filter(c => (+c.annualFee || 0) > 0).map(c => {
    const earned = sum(ra.rows.filter(r => r.bestCard.id === c.id).map(r => r.bestVal));
    return { card: c, fee: +c.annualFee, earned, net: earned - (+c.annualFee) };
  });
}

/* ----------------------------------------------------------- due schedule  */

function upcomingPayments(days = 45) {
  return activeCards()
    .map(c => {
      const t = cardTiming(c);
      const due = reportedBalance(c) > 0 ? reportedBalance(c) : (+c.balance || 0);
      return {
        card: c, ...t,
        amountFull: due,
        amountMin: +c.minPayment || 0,
        autopay: c.autopay || 'none'
      };
    })
    // a card with nothing owed has nothing due - showing it as a $0 payment is noise
    .filter(x => x.daysToDue != null && x.daysToDue <= days && (x.amountFull > 0 || x.amountMin > 0))
    .sort((a, b) => a.daysToDue - b.daysToDue);
}

/* ------------------------------------------------------- credit insights   */

/** The actionable list. Ordered by how much it actually moves the needle. */
function creditInsights() {
  const out = [];
  const cs = creditScore();
  const util = utilisationScore();
  const pay = paymentRecord();
  const cards = activeCards();
  if (!cards.length) return out;

  const add = (tone, title, text) => out.push({ tone, title, text });

  // ---- payment history first: it is the heaviest and the most damaging to lose
  if (pay.autopayOff.length) {
    add('crit', `${pay.autopayOff.length} card${pay.autopayOff.length === 1 ? ' has' : 's have'} no autopay set`,
      `A single payment 30 days late can cost a large number of points and stays on the report for seven years. ` +
      `Setting autopay for at least the minimum on ${pay.autopayOff.map(c => c.name).join(', ')} removes that risk entirely; ` +
      `you can still pay more by hand.`);
  }
  if (pay.recentLate.length) {
    add('crit', `${pay.recentLate.length} late payment${pay.recentLate.length === 1 ? '' : 's'} in the last 24 months`,
      `Recent lates weigh more than old ones and their effect fades with time. Consistent on-time payments from here ` +
      `are the only fix; a goodwill adjustment request to the issuer is sometimes granted for an isolated miss.`);
  } else if (pay.streak >= 6) {
    add('good', `${pay.streak} on-time payments logged in a row`,
      `Payment history is 35% of the model - the largest single factor. Keeping this unbroken matters more than any other habit here.`);
  }

  // ---- utilisation: the fastest lever, because it resets every statement
  const over30 = cards.filter(c => cardUtil(c) > 30).sort((a, b) => cardUtil(b) - cardUtil(a));
  if (util.agg > 30) {
    const need = payToReach(29);
    add('crit', `Overall utilisation is ${pct(util.agg, 1)}`,
      `Above the 30% mark that scoring models treat as a threshold. Paying ${money(need)} across your cards before ` +
      `their statements close would report under 29% instead. Under 10% is where the factor stops costing you anything.`);
  } else if (util.agg > 10) {
    const need = payToReach(9);
    add('warn', `Overall utilisation is ${pct(util.agg, 1)}`,
      `Comfortably under 30%, but the top band is under 10%. Paying about ${money(need)} before statement close ` +
      `would get you there. Utilisation carries no memory - it is recalculated from scratch every month.`);
  } else if (util.cards) {
    add('good', `Overall utilisation is ${pct(util.agg, 1)}`,
      `In the strongest band. Utilisation is 30% of the model and the only heavy factor you can change in a single month.`);
  }

  for (const c of over30.slice(0, 3)) {
    if (util.agg <= 30 || cardUtil(c) > 60) {
      const need = reportedBalance(c) - 0.29 * (+c.limit || 0);
      add(cardUtil(c) > 70 ? 'crit' : 'warn',
        `${c.name} is at ${pct(cardUtil(c), 0)} of its limit`,
        `Individual cards are scored on their own as well as in aggregate, so one high card costs points even when ` +
        `your total looks fine. Paying ${money(Math.max(0, need))} on this card before it reports would bring it under 30%.`);
    }
  }

  // ---- the timing lever most people never hear about
  const soon = cards.map(c => ({ c, t: cardTiming(c) }))
    .filter(x => x.t.daysToClose != null && x.t.daysToClose <= 7 && reportedBalance(x.c) > 0)
    .sort((a, b) => a.t.daysToClose - b.t.daysToClose);
  if (soon.length) {
    const x = soon[0];
    add('warn', `${x.c.name} reports its balance in ${x.t.daysToClose} day${x.t.daysToClose === 1 ? '' : 's'}`,
      `The balance sent to the bureaus is whatever sits on the card when the statement closes on the ${x.c.statementDay}${ordinal(x.c.statementDay)} - ` +
      `not what is left after you pay on the ${x.c.dueDay}${ordinal(x.c.dueDay)}. Paying before the close date is what lowers reported utilisation. ` +
      `Paying by the due date only protects your payment history.`);
  }

  // ---- interest: money leaving for nothing
  const carrying = cards.filter(c => c.paysInFull === false && (+c.balance || 0) > 0);
  if (carrying.length) {
    const mo = cardInterestMonthly();
    const worst = [...carrying].sort((a, b) => (+b.apr) - (+a.apr))[0];
    add('crit', `Carrying a balance costs about ${money(mo)} a month in interest`,
      `${money(mo * 12)} a year on ${carrying.length} card${carrying.length === 1 ? '' : 's'}. ` +
      `${worst.name} at ${worst.apr}% is the most expensive. Carrying a balance does not help your score - ` +
      `that is a persistent myth. Paying the statement balance in full each month reports the same activity with zero interest.`);
  }

  // ---- length of history: irreversible, so guard it
  const h = historyScore();
  if (h.oldest != null) {
    const oldestCard = cards.filter(c => monthsSince(c.openedDate) === h.oldest)[0];
    if (h.oldest < 36) {
      add('warn', `Your credit history is ${yearsText(h.oldest)} old`,
        `Length of history is 15% of the model and only time improves it. Keep your oldest card open and use it ` +
        `occasionally - issuers close inactive accounts, and that would reset the clock you have already run.`);
    } else if (oldestCard) {
      add('good', `${oldestCard.name} is your oldest account at ${yearsText(h.oldest)}`,
        `Keep it open. Closing your oldest card eventually shortens your average age and removes its limit from the ` +
        `utilisation calculation - two factors damaged by one action.`);
    }
  }

  // ---- new credit
  const nu = newCreditScore();
  if (nu.inquiries.length >= 2) {
    add('warn', `${nu.inquiries.length} hard inquiries in the last 12 months`,
      `Each typically costs a few points. They stop affecting the score after 12 months and drop off the report at 24. ` +
      `Spacing applications out, and checking for pre-qualification offers that use a soft pull, avoids stacking them.`);
  }

  // ---- limit increases: raises the denominator without spending anything
  if (util.agg > 15 && pay.recentLate.length === 0 && cards.length) {
    const newLimit = totalLimit() * 1.25;
    const after = (totalReported() / newLimit) * 100;
    add('good', 'A credit limit increase would lower utilisation without paying anything',
      `Utilisation is a ratio, so raising the limit works as well as lowering the balance. A 25% increase across your ` +
      `cards would move you from ${pct(util.agg, 1)} to about ${pct(after, 1)}. Ask whether the issuer uses a soft pull first - ` +
      `many do, and a soft pull costs nothing.`);
  }

  // ---- fees vs rewards
  for (const f of feeAnalysis()) {
    if (f.net < 0) {
      add('warn', `${f.card.name}'s ${money(f.fee)} fee exceeds what it earns you`,
        `About ${money(f.earned)} of rewards a year against a ${money(f.fee)} fee - a net ${money(f.net)}. ` +
        `Before closing it, ask the issuer to switch you to a no-fee version of the same account: that keeps the ` +
        `age and the limit on your report, which closing would cost you.`);
    }
  }

  // ---- rewards routing
  const ra = rewardsAnalysis();
  if (ra.gain > 60) {
    const top = ra.rows[0];
    add('good', `About ${money(ra.gain)} a year in rewards is being left on the table`,
      `Your biggest single gap is ${catName(top.cat)}: ${money(top.spend)} a year currently earning ${pct(top.curRate, 1)} ` +
      `when ${top.bestCard.name} pays ${pct(top.bestRate, 1)}. Rewards are worth chasing only once the balance is paid in ` +
      `full every month - no cashback rate beats a 20%+ interest charge.`);
  }

  const order = { crit: 0, warn: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

function ordinal(n) {
  n = +n; if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
