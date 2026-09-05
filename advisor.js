/* ==========================================================================
   Planning engine.

   Everything here is deterministic arithmetic over the household's own
   numbers, applied to widely published personal-finance frameworks
   (savings rate, emergency-fund months, the debt-avalanche method, the
   tax-advantaged funding order, the 4% / 25x rule, compound growth).
   It is educational modelling, not individualised investment advice, and
   it never names a security. See the disclaimer rendered on the Plan tab.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------- health score ---- */

/** Linear ramp from `bad` to `good`, returning 0..1 (works in either direction). */
function ramp(v, bad, good) {
  if (good === bad) return v >= good ? 1 : 0;
  return clamp((v - bad) / (good - bad), 0, 1);
}

function healthScore() {
  const months = activeMonths();
  const inc = avgIncome(3), spd = avgSpend(3), ess = avgEssentials(3);

  // 1. Savings rate - share of income that stayed in the household
  const rates = months.slice(-3).map(m => monthStats(m, 'all').rate);
  const sr = rates.length ? sum(rates) / rates.length : 0;

  // 2. Emergency fund - months of essential spending held in cash
  const ef = ess > 0 ? cashAssets() / ess : (cashAssets() > 0 ? 6 : 0);

  // 3. Debt service burden - required non-mortgage payments vs income
  const dsr = inc > 0 ? (minDebtPayments() / inc) * 100 : 0;

  // 4. Investing rate - money actually moved into long-term assets
  const invs = months.slice(-3).map(m => monthStats(m, 'all').invested);
  const invRate = inc > 0 ? ((invs.length ? sum(invs) / invs.length : 0) / inc) * 100 : 0;

  // 5. Budget adherence - share of budgeted categories kept in line last month
  const last = months[months.length - 1];
  let within = 0, budgeted = 0;
  if (last) {
    const st = monthStats(last, 'all');
    for (const [cat, amt] of Object.entries(S.budgets)) {
      if (!amt) continue;
      budgeted++;
      if ((st.byCat[cat] || 0) <= amt) within++;
    }
  }
  const adherence = budgeted ? (within / budgeted) * 100 : 50;

  // 6. Spending stability - lower month-to-month variation is easier to plan around
  const spends = months.slice(-6).map(m => monthStats(m, 'all').spend).filter(x => x > 0);
  let cv = 0;
  if (spends.length >= 3) {
    const mu = sum(spends) / spends.length;
    const sd = Math.sqrt(sum(spends.map(x => (x - mu) ** 2)) / spends.length);
    cv = mu > 0 ? (sd / mu) * 100 : 0;
  }

  const comps = [
    { name: 'Savings rate', max: 25, v: sr, unit: '%', p: ramp(sr, 0, 20),
      why: 'Share of income kept each month. 20%+ is a strong target; every point compounds.' },
    { name: 'Emergency fund', max: 20, v: ef, unit: ' mo', dp: 1, p: ramp(ef, 0, 6),
      why: 'Cash on hand divided by essential monthly spending. 3-6 months is the usual range.' },
    { name: 'Debt burden', max: 15, v: dsr, unit: '%', invert: true, p: 1 - ramp(dsr, 0, 25),
      why: 'Required debt payments as a share of income. Under 15% keeps options open.' },
    { name: 'Investing rate', max: 20, v: invRate, unit: '%', p: ramp(invRate, 0, 15),
      why: 'Income routed into long-term assets. This is the line that builds wealth.' },
    { name: 'Budget adherence', max: 10, v: adherence, unit: '%', p: ramp(adherence, 20, 90),
      why: 'Budgeted categories you stayed inside last month.' },
    { name: 'Spending stability', max: 10, v: cv, unit: '% swing', invert: true, p: 1 - ramp(cv, 8, 45),
      why: 'How much monthly spending swings. Steadier spending makes planning reliable.' }
  ].map(c => ({ ...c, score: c.p * c.max }));

  const total = sum(comps.map(c => c.score));
  const band = total >= 80 ? ['Excellent', 'good'] : total >= 62 ? ['Solid', 'good']
    : total >= 45 ? ['Building', 'warn'] : total >= 28 ? ['Fragile', 'serious'] : ['At risk', 'crit'];

  return { total, comps, band, tone: band[1], ef, sr, dsr, invRate, adherence, cv, inc, spd, ess };
}

/* ------------------------------------------------------------ debt payoff -- */

/**
 * Month-by-month amortisation of every debt under one ordering strategy.
 * `extra` is the additional amount applied to the focus debt each month.
 */
function simulateDebt(order, extra) {
  // revolving card balances are debt too - the payoff order spans both lists
  const debts = allDebts().map(d => ({
    name: d.name, bal: +d.balance || 0, apr: (+d.apr || 0) / 100 / 12, min: +d.minPayment || 0
  })).filter(d => d.bal > 0);
  if (!debts.length) return { months: 0, interest: 0, order: [], payoff: [] };

  const sorted = [...debts].sort(order === 'avalanche'
    ? (a, b) => b.apr - a.apr
    : (a, b) => a.bal - b.bal);

  let month = 0, interest = 0;
  const payoff = [];
  const budget = sum(debts.map(d => d.min)) + extra;

  while (sorted.some(d => d.bal > 0.01) && month < 600) {
    month++;
    let pool = budget;
    // accrue interest, then pay minimums
    for (const d of sorted) {
      if (d.bal <= 0.01) continue;
      const i = d.bal * d.apr;
      interest += i; d.bal += i;
    }
    for (const d of sorted) {
      if (d.bal <= 0.01) continue;
      const pay = Math.min(d.min, d.bal, pool);
      d.bal -= pay; pool -= pay;
    }
    // everything left goes to the focus debt
    for (const d of sorted) {
      if (pool <= 0.01) break;
      if (d.bal <= 0.01) continue;
      const pay = Math.min(pool, d.bal);
      d.bal -= pay; pool -= pay;
    }
    for (const d of sorted) {
      if (d.bal <= 0.01 && !payoff.find(p => p.name === d.name)) {
        payoff.push({ name: d.name, month });
      }
    }
  }
  return { months: month, interest, order: sorted.map(d => d.name), payoff };
}

function debtPlans(extra) {
  return {
    avalanche: simulateDebt('avalanche', extra),
    snowball: simulateDebt('snowball', extra),
    minimum: simulateDebt('avalanche', 0)
  };
}

/* -------------------------------------------------------------- projections */

/** Future value of a monthly contribution plus a starting balance. */
function futureValue(monthly, years, annualPct, start = 0) {
  const r = annualPct / 100 / 12, n = years * 12;
  const fvStart = start * Math.pow(1 + r, n);
  const fvFlow = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
  return fvStart + fvFlow;
}

/** Years until invested assets cover 25x annual essential spending. */
function yearsToFI(monthly, annualPct, start, annualSpend) {
  if (annualSpend <= 0) return null;
  const target = annualSpend * 25;
  if (start >= target) return 0;
  if (monthly <= 0 && start <= 0) return null;
  const r = annualPct / 100 / 12;
  let bal = start;
  for (let m = 1; m <= 720; m++) {
    bal = bal * (1 + r) + monthly;
    if (bal >= target) return Math.round((m / 12) * 10) / 10;
  }
  return null;
}

function fiSnapshot() {
  const ess = avgEssentials(3);
  const annualEss = ess * 12;
  const st = S.settings;
  const months = activeMonths();
  const invMonthly = months.length
    ? sum(months.slice(-3).map(m => monthStats(m, 'all').invested)) / Math.min(3, months.length) : 0;
  const start = investAssets();
  const target = annualEss * 25;
  const yrs = yearsToFI(invMonthly, st.expectedReturn, start, annualEss);
  return {
    annualEss, target, start, invMonthly, yrs,
    age: st.currentAge, fiAge: yrs == null ? null : Math.round(st.currentAge + yrs),
    coverage: target > 0 ? clamp((start / target) * 100, 0, 100) : 0,
    safeDraw: start * 0.04 / 12
  };
}

/* ---------------------------------------------------- investable surplus --- */

/** What is genuinely free to invest each month right now. */
function investableSurplus() {
  const inc = avgIncome(3), spd = avgSpend(3);
  const already = activeMonths().length
    ? sum(activeMonths().slice(-3).map(m => monthStats(m, 'all').invested + monthStats(m, 'all').saved))
      / Math.min(3, activeMonths().length) : 0;
  return { free: Math.max(0, inc - spd - already), inc, spd, already };
}

/* -------------------------------------------------------- priority ladder -- */

/**
 * The standard order-of-operations for allocating spare cash. Each rung is
 * gated on the household's real figures, so the "you are here" marker moves
 * as the data changes.
 */
function ladder() {
  const h = healthScore();
  const st = S.settings;
  const ess = h.ess;
  const surplus = investableSurplus().free;
  const cash = cashAssets();
  const highRate = allDebts().filter(d => (+d.apr || 0) >= 8 && (+d.balance || 0) > 0);
  const highRateBal = sum(highRate.map(d => +d.balance || 0));
  const inc = h.inc;

  const rungs = [];
  const add = (title, done, body, metric, action) =>
    rungs.push({ title, done, body, metric, action });

  add('Know where the money goes',
    S.txns.length >= 40 && activeMonths().length >= 2,
    'A plan built on guessed numbers fails quietly. Two or more months of categorised transactions is the minimum base for everything below.',
    `${S.txns.length} transactions across ${activeMonths().length} month${activeMonths().length === 1 ? '' : 's'} loaded.`,
    'Import another statement on the Import tab.');

  add('Starter cash buffer of $2,000',
    cash >= 2000,
    'A small buffer stops an unexpected car repair from becoming credit-card debt at 20%+. This comes before investing because it protects everything after it.',
    cash >= 2000 ? `Cash on hand ${money(cash)} - buffer covered.`
      : `Cash on hand ${money(cash)}. ${money(2000 - cash)} to go.`,
    cash < 2000 && surplus > 0 ? `At your current ${money(surplus)}/mo surplus that is about ${Math.ceil((2000 - cash) / surplus)} month(s).` : '');

  add('Capture the full employer retirement match',
    st.matchCaptured,
    `An employer match is an immediate, guaranteed return on your own contribution - typically the highest-return item on this list. Contribute at least enough to receive all of it.`,
    st.employerMatchPct > 0 && inc > 0
      ? `A ${st.employerMatchPct}% match on roughly ${money(inc * 12)}/yr household income is about ${money(inc * 12 * st.employerMatchPct / 100)}/yr you leave behind if unclaimed.`
      : 'Set your employer match percentage in Settings.',
    'Mark this done in Settings once payroll is contributing at least to the match.');

  add('Clear debt above ~8% APR',
    highRateBal === 0,
    'Paying down a 22% balance is a guaranteed 22% return. No ordinary investment offers that with certainty, which is why high-rate debt outranks investing here.',
    highRateBal > 0
      ? `${highRate.length} debt(s) above 8%, ${money(highRateBal)} total. Highest: ${highRate.sort((a, b) => b.apr - a.apr)[0].name} at ${highRate[0].apr}%.`
      : 'No debt above 8% APR. ',
    highRateBal > 0 ? 'Use the avalanche order on the Wealth tab - it minimises total interest.' : '');

  add('Emergency fund: 3-6 months of essentials',
    h.ef >= 3,
    'Essentials, not total spending - in a real emergency the discretionary half stops. Two earners with stable jobs can sit near 3 months; a single or variable income argues for 6.',
    ess > 0
      ? `${h.ef.toFixed(1)} months covered. Essentials run ${money(ess)}/mo, so 3 months is ${money(ess * 3)} and 6 months is ${money(ess * 6)}.`
      : 'Add cash accounts under Net Worth to measure this.',
    h.ef < 3 && surplus > 0 ? `About ${Math.ceil((ess * 3 - cash) / surplus)} month(s) at your current surplus.` : '');

  add('Fund tax-advantaged accounts',
    h.invRate >= 10,
    st.hdhp
      ? 'With an HDHP, an HSA is the only account taxed nowhere - deductible going in, growing untaxed, and tax-free for qualified medical costs. Then an IRA, then the rest of the 401(k).'
      : 'After the match, an IRA and then the remainder of the 401(k) shelter growth from tax. Roth trades a deduction now for tax-free withdrawals later; traditional does the reverse.',
    `You are investing about ${pct(h.invRate, 1)} of income. 15% of gross is the common retirement benchmark.`,
    'Contribution limits change annually - check the current IRS figures before setting payroll amounts.');

  add('Invest the surplus in a taxable account',
    h.invRate >= 15 && h.ef >= 3,
    'Once sheltered space is used, a plain brokerage account has no contribution cap. This is also where medium-term goals live - money you may need before retirement age.',
    surplus > 0 ? `About ${money(surplus)}/mo is currently unallocated.`
      : 'No surplus detected yet - the Simulator below shows where one could come from.',
    'Broad diversification and low costs are the two levers you fully control.');

  add('Direct surplus at named goals',
    S.goals.length > 0 && S.goals.some(g => g.saved > 0),
    'Money with a name attached gets spent on purpose. House deposit, education, a sabbatical - each goal gets its own target date and horizon.',
    S.goals.length ? `${S.goals.length} goal(s) tracked, ${money(sum(S.goals.map(g => +g.saved || 0)))} set aside.`
      : 'No goals defined yet.',
    'Add goals on the Wealth tab.');

  // mark the first unfinished rung as the current focus
  const i = rungs.findIndex(r => !r.done);
  rungs.forEach((r, k) => { r.status = r.done ? 'done' : (k === i ? 'now' : 'next'); });
  return rungs;
}

/* -------------------------------------------------------------- insights --- */

/** Category spend this month vs the trailing median, biggest movers first. */
function categoryAnomalies(m) {
  const prior = activeMonths().filter(x => x < m).slice(-3);
  if (prior.length < 2) return [];
  const cur = monthStats(m, 'all').byCat;
  const out = [];
  for (const c of CATS) {
    if (c.bucket === 'income' || c.bucket === 'save') continue;
    const hist = prior.map(p => monthStats(p, 'all').byCat[c.id] || 0);
    const med = median(hist);
    const now = cur[c.id] || 0;
    if (med < 40 && now < 40) continue;
    const delta = now - med;
    const rel = med > 0 ? (delta / med) * 100 : (now > 0 ? 100 : 0);
    if (Math.abs(rel) >= 25 && Math.abs(delta) >= 45) out.push({ cat: c.id, now, med, delta, rel });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Recurring charges plus anything that looks like one in the transaction log. */
function subscriptionAudit() {
  const known = S.recurring.filter(r => r.active !== false).map(r => ({
    name: r.name, amount: +r.amount || 0, cat: r.cat, member: r.member, source: 'declared'
  }));
  // detect repeat charges of a near-identical amount to the same merchant
  const groups = {};
  for (const t of S.txns) {
    if (t.amount >= 0) continue;
    const key = normDesc(t.desc).split(' ').slice(0, 3).join(' ');
    if (!key) continue;
    (groups[key] = groups[key] || []).push(t);
  }
  const detected = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 3) continue;
    const amts = list.map(t => -t.amount);
    const med = median(amts);
    if (med < 3) continue;
    const consistent = amts.filter(a => Math.abs(a - med) / (med || 1) < 0.1).length;
    if (consistent < 3) continue;
    const monthsSeen = new Set(list.map(t => ym(t.date))).size;
    if (monthsSeen < 3) continue;
    if (known.some(k => normDesc(k.name).includes(key) || key.includes(normDesc(k.name).split(' ')[0]))) continue;
    detected.push({ name: list[0].desc, amount: med, cat: list[0].cat, member: list[0].member, source: 'detected', n: monthsSeen });
  }
  const all = [...known, ...detected].sort((a, b) => b.amount - a.amount);
  return { items: all, monthly: sum(all.map(a => a.amount)), annual: sum(all.map(a => a.amount)) * 12 };
}

function topMerchants(m, n = 8) {
  const map = {};
  for (const t of txForMonth(m)) {
    if (t.amount >= 0 || bucketOf(t.cat) === 'save') continue;
    const k = normDesc(t.desc).split(' ').slice(0, 3).join(' ').toUpperCase() || 'OTHER';
    map[k] = map[k] || { name: k, total: 0, n: 0, cat: t.cat };
    map[k].total += -t.amount; map[k].n++;
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, n);
}

/** Everything the Plan tab surfaces as a one-line finding. */
function insights(m) {
  const out = [];
  const h = healthScore();
  const st = monthStats(m, 'all');
  const prior = activeMonths().filter(x => x < m).slice(-3);
  const subs = subscriptionAudit();
  const surplus = investableSurplus().free;

  if (st.income > 0 && st.rate < 0) {
    out.push(['crit', 'You spent more than you earned this month',
      `Outflows exceeded income by ${money(-st.net)}. If this repeats, it drains cash or grows a balance. Start with the largest movers below.`]);
  } else if (st.income > 0 && st.rate < 10) {
    out.push(['warn', `Savings rate is ${pct(st.rate, 1)}`,
      `Below the 10% floor most planning frameworks use. Lifting it to 20% would free about ${money(st.income * 0.2 - st.totalSaved)} more per month.`]);
  } else if (st.rate >= 20) {
    out.push(['good', `Savings rate is ${pct(st.rate, 1)}`,
      `At or above the 20% benchmark. Held for a year that is roughly ${money(st.totalSaved * 12)} added to your household.`]);
  }

  for (const a of categoryAnomalies(m).slice(0, 4)) {
    out.push([a.delta > 0 ? 'warn' : 'good',
      `${catName(a.cat)} ${a.delta > 0 ? 'up' : 'down'} ${pct(Math.abs(a.rel))} vs your recent norm`,
      `${money(a.now)} this month against a ${money(a.med)} median over the last ${prior.length} months - a ${a.delta > 0 ? 'rise' : 'drop'} of ${money(Math.abs(a.delta))}.`]);
  }

  const fees = st.byCat.fees || 0;
  if (fees > 25) {
    out.push(['crit', `${money(fees)} lost to fees and interest charges`,
      `Fees are pure leakage - no goods received. ${money(fees * 12)} a year. Interest charges usually mean a balance is being carried; fees usually mean a rule can be changed.`]);
  }

  if (subs.monthly > 0) {
    const share = st.income > 0 ? (subs.monthly / st.income) * 100 : 0;
    out.push([share > 6 ? 'warn' : 'good', `${subs.items.length} recurring charges totalling ${money(subs.monthly)}/mo`,
      `${money(subs.annual)} a year, ${pct(share, 1)} of income. Recurring charges are the easiest category to cut because the decision is made once.`]);
  }

  if (h.ef < 3 && h.ess > 0) {
    out.push([h.ef < 1 ? 'crit' : 'warn', `Emergency fund covers ${h.ef.toFixed(1)} months`,
      `Essentials are ${money(h.ess)}/mo, so three months is ${money(h.ess * 3)}. You are ${money(Math.max(0, h.ess * 3 - cashAssets()))} short of that floor.`]);
  }

  const worst = allDebts().filter(d => d.balance > 0).sort((a, b) => b.apr - a.apr)[0];
  if (worst && worst.apr >= 8) {
    const annualInterest = worst.balance * worst.apr / 100;
    out.push(['crit', `${worst.name} costs ${money(annualInterest)} a year in interest`,
      `At ${worst.apr}% on ${money(worst.balance)}. Clearing it is a guaranteed ${worst.apr}% return - higher than the ${S.settings.expectedReturn}% you are assuming for investments.`]);
  }

  if (surplus > 50) {
    const fv = futureValue(surplus, 20, S.settings.expectedReturn);
    out.push(['good', `${money(surplus)}/mo is currently unallocated`,
      `Invested consistently at ${S.settings.expectedReturn}% that becomes about ${compact(fv)} in 20 years, of which ${compact(fv - surplus * 240)} is growth rather than contribution.`]);
  }

  // per-member fairness: spending share vs income share
  if (S.members.length > 1) {
    const totalInc = sum(S.members.map(m2 => +m2.annualIncome || 0));
    const spendTotal = sum(Object.values(st.byMember));
    if (totalInc > 0 && spendTotal > 0) {
      for (const mem of S.members) {
        // only compare earners - a dependant spending more than they earn is
        // the normal state of a child, not a finding
        if ((+mem.annualIncome || 0) <= 0) continue;
        const sShare = ((st.byMember[mem.id] || 0) / spendTotal) * 100;
        const iShare = ((+mem.annualIncome || 0) / totalInc) * 100;
        if (sShare - iShare > 22 && (st.byMember[mem.id] || 0) > 400) {
          out.push(['warn', `${mem.name} accounts for ${pct(sShare)} of spending`,
            `Against ${pct(iShare)} of household income. Not automatically a problem - shared bills often sit on one card - but worth confirming the split is intentional.`]);
        }
      }
    }
  }

  const order = { crit: 0, warn: 1, good: 2 };
  return out.map(([tone, title, text]) => ({ tone, title, text }))
    .sort((a, b) => order[a.tone] - order[b.tone]);
}

/* ------------------------------------------------------------- simulator --- */

/**
 * "What if we trimmed discretionary spending by N%?" - the single most
 * actionable lever, expressed as a long-run wealth figure.
 */
function trimSim(pctCut) {
  const months = activeMonths().slice(-3);
  const wants = months.length
    ? sum(months.map(m => monthStats(m, 'all').wants)) / months.length : 0;
  const freed = wants * (pctCut / 100);
  const surplus = investableSurplus().free;
  const total = freed + surplus;
  const r = S.settings.expectedReturn;
  return {
    wants, freed, surplus, total,
    y5: futureValue(total, 5, r), y10: futureValue(total, 10, r),
    y20: futureValue(total, 20, r), y30: futureValue(total, 30, r),
    contributed30: total * 360
  };
}
