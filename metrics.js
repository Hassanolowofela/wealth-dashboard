/* ==========================================================================
   One definition per number.

   Every view reads its KPIs from here, so a figure cannot mean one thing on
   Overview and another on Plan. Each metric also carries whether it is
   available at all: a savings rate with no income, or a projection on the
   third of the month, are not small numbers but absent ones, and showing a
   confident 0.0% in their place is worse than showing nothing.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------- availability */

const hasMonthData = m => monthStats(m, 'all').count > 0;

/**
 * The month's headline figures, each with an explicit availability flag.
 * `null` means "cannot be computed", which callers must render as absent
 * rather than as zero.
 */
function monthKpis(m, member = UI.member) {
  const st = monthStats(m, member);
  const prevMonth = addMonths(m, -1);
  const prev = monthStats(prevMonth, member);

  const hasData = st.count > 0;
  const hasPrev = prev.count > 0;
  // a delta is only meaningful when both months actually contain something
  const canCompare = hasData && hasPrev;

  return {
    month: m, st, prev, hasData, hasPrev, canCompare,
    hasIncome: st.income > 0,

    leftOver: hasData ? st.net : null,
    income: hasData ? st.income : null,
    spending: hasData ? st.spend : null,
    saved: hasData ? st.totalSaved : null,
    // a savings rate needs income to be a rate of something
    savingsRate: st.income > 0 ? st.rate : null,
    investingRate: st.income > 0 ? (st.invested / st.income) * 100 : null,
    essentials: hasData ? st.needs : null,

    delta: key => {
      if (!canCompare) return null;
      const now = { leftOver: st.net, income: st.income, spending: st.spend,
                    saved: st.totalSaved }[key];
      const was = { leftOver: prev.net, income: prev.income, spending: prev.spend,
                    saved: prev.totalSaved }[key];
      if (now == null || was == null) return null;
      return now - was;
    }
  };
}

/* --------------------------------------------------------------- budgeting */

/**
 * Budgeted spending is compared against budgets. Spending in categories with
 * no budget is reported separately rather than folded into the same ratio,
 * which previously made a household look 181% over when it was at 91%.
 */
function budgetSummary(m) {
  const st = monthStats(m, 'all');
  const rows = CATS
    .filter(c => c.bucket !== 'income' && c.bucket !== 'save')
    .map(c => ({ c, spent: st.byCat[c.id] || 0, budget: +S.budgets[c.id] || 0 }))
    .filter(r => r.budget > 0 || r.spent > 0);

  const budgeted = rows.filter(r => r.budget > 0);
  const unbudgeted = rows.filter(r => r.budget <= 0 && r.spent > 0);
  const totalBudget = sum(budgeted.map(r => r.budget));
  const budgetedSpend = sum(budgeted.map(r => r.spent));

  return {
    rows, budgeted, unbudgeted,
    totalBudget,
    budgetedSpend,
    unbudgetedSpend: sum(unbudgeted.map(r => r.spent)),
    totalSpend: st.spend,
    over: budgeted.filter(r => r.spent > r.budget),
    usedPct: totalBudget > 0 ? (budgetedSpend / totalBudget) * 100 : null,
    anyBudgets: budgeted.length > 0
  };
}

/* -------------------------------------------------------------- projection */

/**
 * Month-end spending, projected honestly.
 *
 * The naive version extrapolates everything by how much of the month has
 * passed. That is badly wrong, because rent and the other declared bills are
 * paid in full early and are not a "pace". On the third of a month it produced
 * $55,369 against a real month of about $5,500.
 *
 * So: declared recurring items count at their known amounts exactly once, and
 * only the remaining variable spending is extrapolated. The result is a range,
 * because the honest answer is a range: the low end assumes nothing more is
 * spent, the expected end assumes the current variable pace continues.
 */
function monthProjection(m) {
  const dim = daysInMonth(m);
  const isCurrent = ym(todayISO()) === m;
  const dayNow = isCurrent ? +todayISO().slice(8, 10) : dim;
  const st = monthStats(m, 'all');

  const rec = (S.recurring || []).filter(r => r.active !== false);
  const declaredTotal = sum(rec.map(r => +r.amount || 0));
  const declaredDue = sum(rec.filter(r => (+r.day || 1) <= dayNow).map(r => +r.amount || 0));

  // Only spending that has actually happened can inform a pace. A ledger may
  // hold entries dated later in the month, and extrapolating those would count
  // them twice: once as recorded, once as predicted.
  const elapsedSpend = sum(
    txForMonth(m, 'all')
      .filter(t => t.amount < 0 && bucketOf(t.cat) !== 'save' && (+t.date.slice(8, 10)) <= dayNow)
      .map(t => -t.amount));

  // whatever has been spent beyond the bills already due is the variable part
  const variableSoFar = Math.max(0, elapsedSpend - declaredDue);
  const pace = dim > 0 ? dayNow / dim : 1;
  const variableProjected = pace > 0 ? variableSoFar / pace : variableSoFar;

  const low = declaredTotal + variableSoFar;
  const expected = declaredTotal + variableProjected;

  return {
    // too little of the month has passed for a pace to mean anything
    available: isCurrent && dayNow >= 10,
    reason: !isCurrent ? 'past' : dayNow < 10 ? 'early' : null,
    dayNow, dim, pace,
    declaredTotal, declaredDue, variableSoFar,
    low, expected,
    spentSoFar: elapsedSpend,
    monthTotalRecorded: st.spend,
    actual: isCurrent ? null : st.spend
  };
}

/* ------------------------------------------------------------ explanations */

/**
 * The "why" layer. Kept next to the maths so an explanation cannot drift away
 * from the calculation it describes.
 */
const METRIC_HELP = {
  leftOver: ['Left over this month',
    'Income minus everything spent, minus anything moved to savings or investments. ' +
    'It is what is still sitting in your accounts from this month, not a running balance.'],
  income: ['Income',
    'Every transaction categorised as Income, for the month shown. Refunds and ' +
    'reimbursements count here too, which is why it can differ from your salary.'],
  spending: ['Spending',
    'Everything that left your accounts except transfers into savings or investments, ' +
    'which are counted as money kept rather than money spent.'],
  savingsRate: ['Savings rate',
    'Money kept divided by income. Money kept is what you moved into savings and ' +
    'investments, plus anything you simply did not spend, because that stayed with you too. ' +
    'With no income for the month there is nothing to divide by, so no rate is shown.'],
  investingRate: ['Investing rate',
    'Transfers into the Investing category, divided by income. This is the line that ' +
    'builds long-term wealth, as distinct from cash savings.'],
  essentials: ['Essential spending',
    'Spending in the categories marked as needs: housing, utilities, groceries, transport, ' +
    'insurance, healthcare, childcare and debt payments. The emergency fund and ' +
    'financial independence targets are both multiples of this figure.'],
  projection: ['Projected month end',
    'Your declared recurring bills at their known amounts, counted once, plus the rest ' +
    'of your spending extrapolated from the pace so far. It is shown as a range because ' +
    'the low end assumes you spend nothing more and the upper end assumes the current ' +
    'pace continues. It appears from the tenth of the month, before which a pace is ' +
    'too noisy to mean anything.'],
  budgetUsed: ['Budget used',
    'Spending in categories that have a budget, divided by the total of those budgets. ' +
    'Categories with no budget are excluded from this ratio and reported separately, ' +
    'so an unbudgeted category cannot make you appear over budget.'],
  utilisation: ['Credit utilisation',
    'The balance reported to the credit bureaus divided by your credit limit, for each ' +
    'card and across all of them. The reported balance is the one on your statement, ' +
    'not the one showing today.'],
  healthScore: ['Financial health score',
    'Six weighted components: savings rate, emergency fund, debt burden, investing rate, ' +
    'budget adherence and spending stability. Each is scored against a published ' +
    'benchmark and the weights are shown beside them.']
};

/** Markup for the small "how is this calculated" affordance beside a KPI. */
function helpButton(key) {
  if (!METRIC_HELP[key]) return '';
  return `<button class="helpbtn" data-act="explain" data-key="${key}"
    aria-label="How is ${esc(METRIC_HELP[key][0])} calculated?" title="How is this calculated?">?</button>`;
}
