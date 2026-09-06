/* ==========================================================================
   Views, forms and boot.
   ========================================================================== */
'use strict';

const TABS = [
  ['overview',  'Overview'],
  ['spending',  'Spending'],
  ['budget',    'Budget'],
  ['recurring', 'Recurring'],
  ['cards',     'Cards & Credit'],
  ['wealth',    'Wealth'],
  ['plan',      'Plan & Advice'],
  ['import',    'Import'],
  ['settings',  'Settings']
];

/* ------------------------------------------------------------- small parts */

function tile(o) {
  return `<div class="tile">
    <div class="lbl">${esc(o.label)}</div>
    <div class="val${o.hero ? ' hero' : ''}"${o.tone ? ` style="color:${o.tone}"` : ''}>${o.value}</div>
    ${o.delta ? `<div class="delta">${o.delta}</div>` : ''}
    ${o.spark ? `<div class="spark">${o.spark}</div>` : ''}
  </div>`;
}
function deltaBit(cur, prev, goodUp = true, fmt = money) {
  if (prev == null || !isFinite(prev) || prev === 0) return `<span class="flat">no prior month</span>`;
  const d = cur - prev, p = (d / Math.abs(prev)) * 100;
  const good = goodUp ? d >= 0 : d <= 0;
  const cls = Math.abs(p) < 0.5 ? 'flat' : good ? 'up' : 'down';
  const ar = d > 0 ? '▲' : d < 0 ? '▼' : '-';
  return `<span class="${cls}">${ar} <b>${fmt(Math.abs(d))}</b></span> vs last month`;
}
const toneVar = t => ({ good: 'var(--good)', warn: 'var(--warn)', serious: 'var(--serious)', crit: 'var(--crit)' }[t] || 'var(--s1)');
const toneIcon = t => ({ good: '✓', warn: '!', serious: '!', crit: '✕' }[t] || 'i');

function catOptions(sel) {
  return CATS.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
}
function memberOptions(sel, blank) {
  return (blank ? `<option value="">${esc(blank)}</option>` : '') +
    S.members.map(m => `<option value="${m.id}"${m.id === sel ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
}
function accountOptions(sel, blank) {
  return (blank ? `<option value="">${esc(blank)}</option>` : '') +
    S.accounts.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
}
function emptyCard(title, body, btn) {
  return `<div class="card"><div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p>${btn || ''}</div></div>`;
}

/* ============================================================== OVERVIEW === */

function viewOverview() {
  const m = UI.month;
  const st = monthStats(m);
  const prevSt = monthStats(addMonths(m, -1));
  const hist = histMonths(m, 12);
  const histStats = hist.map(x => monthStats(x));

  if (!S.txns.length) {
    return emptyCard('No transactions yet',
      'Import a bank or card statement, or add a transaction by hand, and this dashboard fills in.',
      `<button class="btn primary" data-act="import">Import a statement</button>
       <button class="btn" data-act="add-tx" style="margin-left:8px">Add a transaction</button>
       <button class="btn" data-act="load-sample" style="margin-left:8px">Load sample data</button>
       ${S.members.length ? '' : '<button class="btn" data-act="run-setup" style="margin-left:8px">Set up my household</button>'}`);
  }

  // ---- category ranking, top 8 with the tail folded into "Other"
  const catRows = Object.entries(st.byCat)
    .filter(([c]) => bucketOf(c) !== 'income' && bucketOf(c) !== 'save')
    .sort((a, b) => b[1] - a[1]);
  const top = catRows.slice(0, 8);
  const tail = catRows.slice(8);
  const catItems = top.map(([c, v]) => ({
    label: catName(c), value: v, color: 'var(--s1)',
    sub: st.spend > 0 ? Math.round(v / st.spend * 100) + '%' : '',
    tip: ['Share of spending', st.spend > 0 ? pct(v / st.spend * 100, 1) : '-']
  }));
  if (tail.length) catItems.push({
    label: `Other (${tail.length})`, value: sum(tail.map(t => t[1])), color: 'var(--s1)',
    sub: st.spend > 0 ? Math.round(sum(tail.map(t => t[1])) / st.spend * 100) + '%' : ''
  });

  // ---- per-member: colour follows the person, never their rank
  const memItems = S.members.map(mem => ({
    label: mem.name, value: st.byMember[mem.id] || 0, color: memberColor(mem.id),
    tip: ['Transactions', String(txForMonth(m, mem.id).filter(t => t.amount < 0).length)]
  })).filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  const unassigned = st.byMember['none'] || 0;
  if (unassigned > 0) memItems.push({ label: 'Unassigned', value: unassigned, color: 'var(--muted)' });

  const merchants = topMerchants(m, 7);
  const anoms = categoryAnomalies(m).slice(0, 3);

  return `
  <div class="section-h"><h2>${esc(monthLabel(m))}</h2>
    <span class="sub">${st.count} transaction${st.count === 1 ? '' : 's'}${UI.member !== 'all' ? ' · ' + esc(memberName(UI.member)) : ' · whole household'}</span>
  </div>

  <div class="grid g-kpi">
    ${tile({
      label: 'Left over this month', hero: true,
      value: money(st.net),
      tone: st.net >= 0 ? 'var(--good-ink)' : 'var(--crit-ink)',
      delta: deltaBit(st.net, prevSt.count ? prevSt.net : null, true),
      spark: chart({ type: 'spark', h: 34, values: histStats.map(s => s.net), color: 'var(--s1)' })
    })}
    ${tile({
      label: 'Income', value: money(st.income),
      delta: deltaBit(st.income, prevSt.count ? prevSt.income : null, true),
      spark: chart({ type: 'spark', h: 34, values: histStats.map(s => s.income), color: 'var(--s1)' })
    })}
    ${tile({
      label: 'Spending', value: money(st.spend),
      delta: deltaBit(st.spend, prevSt.count ? prevSt.spend : null, false),
      spark: chart({ type: 'spark', h: 34, values: histStats.map(s => s.spend), color: 'var(--s2)' })
    })}
    ${tile({
      label: 'Savings rate', value: pct(st.rate, 1),
      tone: st.rate >= 20 ? 'var(--good-ink)' : st.rate < 5 ? 'var(--crit-ink)' : '',
      delta: `<span class="${st.rate >= 20 ? 'up' : 'flat'}">${st.rate >= 20 ? 'at or above' : 'below'}</span> the 20% benchmark`,
      spark: chart({ type: 'spark', h: 34, values: histStats.map(s => s.rate), color: 'var(--s3)' })
    })}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Income vs spending</h3><div class="sub">Last 12 months, household total</div>
      ${chart({
        type: 'line', h: 230, direct: true,
        x: hist.map(monthShort),
        tipTitle: i => monthLabel(hist[i]),
        series: [
          { name: 'Income', color: 'var(--s1)', values: histStats.map(s => s.income), endLabel: compact(histStats.at(-1).income) },
          { name: 'Spending', color: 'var(--s2)', values: histStats.map(s => s.spend), endLabel: compact(histStats.at(-1).spend) }
        ],
        aria: 'Monthly income and spending over the last twelve months'
      })}
      ${legend([{ name: 'Income', color: 'var(--s1)' }, { name: 'Spending', color: 'var(--s2)' }], 'swl')}
    </div>

    <div class="card">
      <h3>Needs, wants and savings</h3>
      <div class="sub">The 50/30/20 guideline against your actual split</div>
      ${chart({
        type: 'stack', h: 34,
        segs: [
          { label: 'Needs', value: st.needs, color: 'var(--s1)' },
          { label: 'Wants', value: st.wants, color: 'var(--s2)' },
          { label: 'Saved', value: st.totalSaved, color: 'var(--s3)' }
        ], aria: 'Share of income going to needs, wants and savings'
      })}
      <div style="margin-top:12px">
        ${[['Needs', st.needs, 50, 'var(--s1)'], ['Wants', st.wants, 30, 'var(--s2)'], ['Saved', st.totalSaved, 20, 'var(--s3)']]
          .map(([n, v, target, c]) => {
            const share = st.income > 0 ? (v / st.income) * 100 : 0;
            const ok = n === 'Saved' ? share >= target : share <= target;
            return `<div class="kv"><span><span class="dot" style="background:${c}"></span> ${n}
              <span class="sub"> guideline ${target}%</span></span>
              <b class="${ok ? 'pos' : ''}">${money(v)} · ${pct(share)}</b></div>`;
          }).join('')}
      </div>
      <div class="sub" style="margin-top:10px">Guideline only. High-cost housing markets routinely push needs past 50% - what matters is that the savings share keeps rising.</div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Where the money went</h3><div class="sub">${esc(monthLabel(m))} · ranked by amount</div>
      ${catItems.length ? chart({ type: 'barh', items: catItems, rowH: 30, tipLabel: 'Spent',
        aria: 'Spending by category, ranked' }) : '<div class="sub">No spending recorded.</div>'}
    </div>
    <div class="card">
      <h3>Spending by household member</h3>
      <div class="sub">Each person keeps the same colour everywhere</div>
      ${memItems.length ? chart({ type: 'barh', items: memItems, rowH: 32, tipLabel: 'Spent',
        aria: 'Spending by household member' })
        : `<div class="sub" style="padding:14px 0">No members set up yet. <button class="btn sm" data-act="go-settings">Add household members</button></div>`}
      ${memItems.length > 1 ? legend(memItems.map(i => ({ name: i.label, color: i.color }))) : ''}
    </div>
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Monthly surplus and shortfall</h3>
      <div class="sub">Income minus everything, by month. Above the line is money kept.</div>
      ${chart({
        type: 'barv', h: 200,
        items: hist.map((x, i) => ({ label: monthShort(x), value: histStats[i].net })),
        tipLabel: 'Left over', aria: 'Net surplus or shortfall by month'
      })}
      <div class="legend">
        <span class="li"><span class="sw" style="background:var(--s1)"></span>Surplus</span>
        <span class="li"><span class="sw" style="background:var(--s8)"></span>Shortfall</span>
      </div>
    </div>
    <div class="card">
      <h3>Biggest merchants this month</h3><div class="sub">Grouped by merchant name</div>
      ${merchants.length ? `<table><tbody>${merchants.map(x => `
        <tr><td>${esc(x.name)}<div class="sub">${esc(catName(x.cat))} · ${x.n} charge${x.n === 1 ? '' : 's'}</div></td>
        <td class="num"><b>${money(x.total)}</b></td></tr>`).join('')}</tbody></table>`
        : '<div class="sub">No spending recorded.</div>'}
    </div>
  </div>

  ${anoms.length ? `<div class="card" style="margin-top:14px">
    <h3>Worth a look</h3><div class="sub">Categories that moved against your recent norm</div>
    ${anoms.map(a => `<div class="insight">
      <div class="ic" style="background:${a.delta > 0 ? 'var(--warn)' : 'var(--good)'}">${a.delta > 0 ? '▲' : '▼'}</div>
      <div class="tx"><b>${esc(catName(a.cat))} ${a.delta > 0 ? 'up' : 'down'} ${money(Math.abs(a.delta))}</b>
      <span>${money(a.now)} this month vs a ${money(a.med)} median over the previous months.</span></div></div>`).join('')}
    <div style="margin-top:12px"><button class="btn sm" data-act="go-plan">See the full plan &rarr;</button></div>
  </div>` : ''}
  `;
}

/* ============================================================== SPENDING === */

function viewSpending() {
  const f = UI.txFilter;
  let rows = S.txns.filter(t => ym(t.date) === UI.month);
  if (UI.member !== 'all') rows = rows.filter(t => t.member === UI.member);
  if (f.cat !== 'all') rows = rows.filter(t => t.cat === f.cat);
  if (f.account !== 'all') rows = rows.filter(t => t.account === f.account);
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(t => (t.desc || '').toLowerCase().includes(q) || catName(t.cat).toLowerCase().includes(q));
  }
  rows.sort((a, b) => {
    let r = 0;
    if (f.sort === 'amount') r = Math.abs(a.amount) - Math.abs(b.amount);
    else if (f.sort === 'desc') r = String(a.desc).localeCompare(String(b.desc));
    else r = String(a.date).localeCompare(String(b.date));
    return r * f.dir;
  });
  const outflow = sum(rows.filter(t => t.amount < 0).map(t => -t.amount));
  const inflow = sum(rows.filter(t => t.amount > 0).map(t => t.amount));

  return `
  <div class="section-h"><h2>Transactions</h2>
    <span class="sub">${rows.length} shown · ${money(outflow)} out · ${money(inflow)} in</span></div>

  <div class="card noprint" style="margin-bottom:14px">
    <div class="row">
      <label class="f" style="flex:2 1 220px"><span>Search</span>
        <input type="text" id="fq" placeholder="Merchant or category" value="${esc(f.q)}"></label>
      <label class="f"><span>Category</span>
        <select id="fcat"><option value="all">All categories</option>${catOptions(f.cat)}</select></label>
      <label class="f"><span>Account</span>
        <select id="facc"><option value="all">All accounts</option>${accountOptions(f.account)}</select></label>
      <div style="flex:0 0 auto"><button class="btn" data-act="add-tx">+ Add</button></div>
      <div style="flex:0 0 auto"><button class="btn" data-act="export-csv">Export CSV</button></div>
    </div>
    ${rows.some(t => t.cat === 'misc') ? `<div class="sub" style="margin-top:4px">
      ${rows.filter(t => t.cat === 'misc').length} uncategorised item(s) this month.
      <button class="btn sm" data-act="fix-uncat">Review them</button></div>` : ''}
  </div>

  ${rows.length ? `<div class="tbl-wrap"><table>
    <thead><tr>
      <th data-sort="date" style="cursor:pointer">Date${f.sort === 'date' ? (f.dir < 0 ? ' ↓' : ' ↑') : ''}</th>
      <th data-sort="desc" style="cursor:pointer">Description</th>
      <th>Category</th><th>Who</th><th>Account</th>
      <th class="num" data-sort="amount" style="cursor:pointer">Amount${f.sort === 'amount' ? (f.dir < 0 ? ' ↓' : ' ↑') : ''}</th>
      <th></th>
    </tr></thead><tbody>
    ${rows.map(t => `<tr data-id="${t.id}">
      <td class="mono">${esc(t.date.slice(5))}</td>
      <td>${esc(t.desc)}</td>
      <td><select class="tcat" data-id="${t.id}" style="padding:3px 6px;font-size:12.5px">${catOptions(t.cat)}</select></td>
      <td>${t.member ? `<span class="pill tiny"><span class="dot" style="background:${memberColor(t.member)}"></span>${esc(memberName(t.member))}</span>` : '<span class="sub">-</span>'}</td>
      <td class="sub">${esc(accountName(t.account))}</td>
      <td class="num ${t.amount < 0 ? 'neg' : 'pos'}">${money2(t.amount)}</td>
      <td><button class="btn sm ghost" data-act="edit-tx" data-id="${t.id}">Edit</button></td>
    </tr>`).join('')}
    </tbody></table></div>`
    : emptyCard('Nothing matches', 'Try clearing the filters, or move to a different month.', '')}
  `;
}

/* ================================================================ BUDGET === */

function viewBudget() {
  const m = UI.month;
  const st = monthStats(m, 'all');
  const dim = daysInMonth(m);
  const today = todayISO();
  const dayNow = ym(today) === m ? +today.slice(8, 10) : dim;
  const pace = dayNow / dim;

  const cats = CATS.filter(c => c.bucket !== 'income' && c.bucket !== 'save');
  const rows = cats.map(c => {
    const spent = st.byCat[c.id] || 0;
    const budget = +S.budgets[c.id] || 0;
    return { c, spent, budget };
  }).filter(r => r.budget > 0 || r.spent > 0)
    .sort((a, b) => (b.budget ? b.spent / b.budget : 0) - (a.budget ? a.spent / a.budget : 0) || b.spent - a.spent);

  const totalBudget = sum(rows.map(r => r.budget));
  const totalSpent = sum(rows.map(r => r.spent));
  const over = rows.filter(r => r.budget > 0 && r.spent > r.budget);
  const projected = pace > 0 ? totalSpent / pace : totalSpent;

  return `
  <div class="section-h"><h2>Budget · ${esc(monthLabel(m))}</h2>
    <span class="sub">Day ${dayNow} of ${dim}</span></div>

  <div class="grid g-kpi">
    ${tile({ label: 'Budgeted', value: money(totalBudget) })}
    ${tile({ label: 'Spent so far', value: money(totalSpent),
      tone: totalBudget && totalSpent > totalBudget ? 'var(--crit-ink)' : '',
      delta: totalBudget ? `${pct(totalSpent / totalBudget * 100)} of budget used, ${pct(pace * 100)} of the month gone` : '' })}
    ${tile({ label: 'Projected month end', value: money(projected),
      tone: totalBudget && projected > totalBudget ? 'var(--crit-ink)' : 'var(--good-ink)',
      delta: totalBudget ? (projected > totalBudget
        ? `<span class="down">${money(projected - totalBudget)} over</span> at this pace`
        : `<span class="up">${money(totalBudget - projected)} under</span> at this pace`) : '' })}
    ${tile({ label: 'Categories over', value: String(over.length),
      tone: over.length ? 'var(--crit-ink)' : 'var(--good-ink)',
      delta: over.length ? esc(over.map(o => catName(o.c.id)).join(', ')) : 'all within budget' })}
  </div>

  <div class="card" style="margin-top:14px">
    <h3>Category budgets</h3>
    <div class="sub">The bar fills as you spend. The notch marks where you should be by today.</div>
    ${rows.length ? rows.map(r => {
      const p = r.budget > 0 ? clamp(r.spent / r.budget * 100, 0, 100) : 0;
      const overBudget = r.budget > 0 && r.spent > r.budget;
      const aheadOfPace = r.budget > 0 && !overBudget && (r.spent / r.budget) > pace * 1.15;
      const cls = overBudget ? 'c' : aheadOfPace ? 'w' : 'g';
      return `<div class="budrow">
        <div class="nm">${esc(r.c.name)}
          <span class="pill tiny">${r.c.bucket === 'need' ? 'Need' : 'Want'}</span>
          ${overBudget ? '<span class="tag" style="background:color-mix(in srgb,var(--crit) 16%,transparent);color:var(--crit-ink)">Over</span>' : ''}
          ${aheadOfPace ? '<span class="tag" style="background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn-ink)">Fast</span>' : ''}
        </div>
        <div class="amt">${money(r.spent)}${r.budget ? ` <span class="sub">of ${money(r.budget)}</span>` : ' <span class="sub">no budget</span>'}
          <button class="btn sm ghost" data-act="set-budget" data-cat="${r.c.id}">edit</button></div>
        ${r.budget ? `<div class="meter ${cls}" style="position:relative">
            <i style="width:${p}%"></i>
            <span style="position:absolute;left:${(pace * 100).toFixed(1)}%;top:-2px;width:2px;height:12px;background:var(--ink);opacity:.45"></span>
          </div>` : '<div class="meter"><i style="width:0"></i></div>'}
      </div>`;
    }).join('') : '<div class="sub">No spending or budgets in this month yet.</div>'}
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-act="set-budget" data-cat="">Set a category budget</button>
      <button class="btn" data-act="auto-budget">Suggest budgets from my history</button>
    </div>
  </div>
  `;
}

/* ============================================================= RECURRING === */

function viewRecurring() {
  const audit = subscriptionAudit();
  const inc = avgIncome(3);
  const declared = audit.items.filter(i => i.source === 'declared');
  const detected = audit.items.filter(i => i.source === 'detected');
  const fv = futureValue(audit.monthly * 0.3, 20, S.settings.expectedReturn);

  return `
  <div class="section-h"><h2>Recurring charges</h2>
    <span class="sub">Decisions you make once but pay every month</span></div>

  <div class="grid g-kpi">
    ${tile({ label: 'Recurring per month', value: money(audit.monthly), hero: true })}
    ${tile({ label: 'Per year', value: money(audit.annual),
      delta: inc > 0 ? `${pct(audit.monthly / inc * 100, 1)} of monthly income` : '' })}
    ${tile({ label: 'Active items', value: String(audit.items.length),
      delta: `${declared.length} declared · ${detected.length} auto-detected` })}
    ${tile({ label: 'If you cut 30% and invested it', value: compact(fv),
      tone: 'var(--good-ink)', delta: `over 20 years at ${S.settings.expectedReturn}%` })}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Ranked by annual cost</h3>
      <div class="sub">Small monthly numbers, sorted by what they actually cost per year</div>
      ${audit.items.length ? chart({
        type: 'barh', rowH: 30, fmt: v => money(v),
        items: audit.items.slice(0, 12).map(i => ({
          label: i.name.length > 26 ? i.name.slice(0, 25) + '…' : i.name,
          value: i.amount * 12, color: 'var(--s1)',
          tip: ['Per month', money2(i.amount)]
        })), tipLabel: 'Per year', aria: 'Recurring charges by annual cost'
      }) : '<div class="sub">Nothing recurring found yet.</div>'}
    </div>

    <div class="card">
      <h3>Manage</h3><div class="sub">Declared items also seed future months</div>
      <div class="scroller">
      ${declared.length ? `<table><tbody>${S.recurring.map(r => `<tr>
        <td><b>${esc(r.name)}</b><div class="sub">${esc(catName(r.cat))} · day ${r.day}
          ${r.member ? '· ' + esc(memberName(r.member)) : ''}</div></td>
        <td class="num">${money2(r.amount)}<div class="sub">${money(r.amount * 12)}/yr</div></td>
        <td><button class="btn sm ghost" data-act="edit-rec" data-id="${r.id}">Edit</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="sub">None declared yet.</div>'}
      </div>
      <div style="margin-top:12px"><button class="btn" data-act="edit-rec" data-id="">+ Add recurring item</button></div>
    </div>
  </div>

  ${detected.length ? `<div class="card" style="margin-top:14px">
    <h3>Found in your transactions</h3>
    <div class="sub">Charges that repeat at a steady amount but are not on your declared list</div>
    <table><tbody>${detected.map(d => `<tr>
      <td><b>${esc(d.name)}</b><div class="sub">seen in ${d.n} months · ${esc(catName(d.cat))}</div></td>
      <td class="num">${money2(d.amount)}/mo<div class="sub">${money(d.amount * 12)}/yr</div></td>
      <td><button class="btn sm" data-act="adopt-rec" data-name="${esc(d.name)}" data-amt="${d.amount}" data-cat="${d.cat}">Track it</button></td>
    </tr>`).join('')}</tbody></table>
  </div>` : ''}

  <div class="card" style="margin-top:14px">
    <h3>The subscription question</h3>
    <div class="sub" style="margin-bottom:10px">For each item, one question decides it</div>
    <p style="font-size:13px;color:var(--ink-2);margin:0">
      <b>Would I sign up for this today at this price?</b> If the answer is no, the only thing keeping it is inertia.
      Recurring costs are the highest-leverage cut available because the effort is one-time and the saving repeats forever -
      and unlike a raise, a cancelled subscription is not taxed.
    </p>
  </div>
  `;
}

/* ================================================================= CARDS === */

const AUTOPAY_LABEL = {
  none: 'No autopay', min: 'Autopay minimum',
  statement: 'Autopay statement balance', full: 'Autopay full balance'
};

function utilClass(u) { return u > 30 ? 'c' : u > 10 ? 'w' : 'g'; }
function utilTone(u) { return u > 30 ? 'crit' : u > 10 ? 'warn' : 'good'; }

function viewCards() {
  const cards = activeCards();
  const convertible = cardLikeDebts();

  if (!cards.length) {
    return `
    ${convertible.length ? `<div class="card" style="margin-top:20px">
      <h3>These look like credit cards</h3>
      <div class="sub" style="margin-bottom:10px">They are currently in your loan list, where utilisation and
        statement timing can't be tracked. Convert them and add the credit limit.</div>
      ${convertible.map(d => `<div class="budrow">
        <div class="nm">${esc(d.name)}</div>
        <div class="amt">${money(d.balance)} at ${d.apr}%
          <button class="btn sm" data-act="convert-debt" data-id="${d.id}">Convert to card</button></div>
      </div>`).join('')}
    </div>` : ''}
    ${emptyCard('No credit cards added yet',
      'Add each card with its limit, statement close day and due day. Utilisation, payment timing, the score factors and rewards routing all follow from those four numbers.',
      `<button class="btn primary" data-act="edit-card" data-id="">+ Add a credit card</button>`)}`;
  }

  const cs = creditScore();
  const util = utilisationScore();
  const due = upcomingPayments(45);
  const next = due[0];
  const interestMo = cardInterestMonthly();
  const ins = creditInsights();
  const ra = rewardsAnalysis();
  const hist = (S.utilHistory || []).slice(-12);
  const payAmt = UI.utilPay == null ? Math.round(payToReach(9) / 50) * 50 : UI.utilPay;
  const simulated = utilAfterPayment(payAmt);

  return `
  <div class="section-h"><h2>Cards &amp; credit</h2>
    <span class="sub">${cards.length} card${cards.length === 1 ? '' : 's'} ·
      ${money(totalReported())} reported of ${money(totalLimit())} in limits</span></div>

  ${convertible.length ? `<div class="disclaim" style="border-left-color:var(--s1);margin:0 0 14px">
    <b>${convertible.length} item${convertible.length === 1 ? '' : 's'} in your loan list look like credit cards.</b>
    Converting them lets this tab track utilisation and statement timing.
    ${convertible.map(d => `<button class="btn sm" style="margin:6px 6px 0 0"
      data-act="convert-debt" data-id="${d.id}">Convert &ldquo;${esc(d.name)}&rdquo;</button>`).join('')}
  </div>` : ''}

  <div class="grid g-kpi">
    ${tile({
      label: 'Estimated score', hero: true,
      value: String(cs.estimate),
      tone: toneVar(cs.tone),
      delta: `<span class="${cs.tone === 'good' ? 'up' : cs.tone === 'crit' ? 'down' : 'flat'}">${esc(cs.label)}</span>
              · model range ${cs.low} to ${cs.high}`
    })}
    ${tile({
      label: 'Overall utilisation', value: pct(util.agg, 1),
      tone: utilTone(util.agg) === 'good' ? 'var(--good-ink)' : utilTone(util.agg) === 'crit' ? 'var(--crit-ink)' : '',
      delta: util.agg > 30 ? `<span class="down">above</span> the 30% threshold`
        : util.agg > 10 ? `under 30%, above the 10% ideal` : `<span class="up">in the strongest band</span>`,
      spark: hist.length > 1 ? chart({ type: 'spark', h: 34, values: hist.map(x => x.util), color: 'var(--s2)' }) : ''
    })}
    ${tile({
      label: 'Next payment due',
      value: next ? money(next.autopay === 'min' ? next.amountMin : next.amountFull) : '-',
      delta: next
        ? `${esc(next.card.name)} in <b>${next.daysToDue}</b> day${next.daysToDue === 1 ? '' : 's'}`
        : 'nothing due in the next 45 days'
    })}
    ${tile({
      label: 'Interest on carried balances', value: money(interestMo * 12) + '/yr',
      tone: interestMo > 0 ? 'var(--crit-ink)' : 'var(--good-ink)',
      delta: interestMo > 0 ? `${money(interestMo)} a month, for nothing received`
        : 'nothing - every card paid in full'
    })}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Utilisation by card</h3>
      <div class="sub">Each card is scored on its own as well as in total. Under 30% matters; under 10% is ideal.</div>
      <div style="margin-top:12px">
        ${cards.map(c => {
          const u = cardUtil(c);
          return `<div class="budrow">
            <div class="nm">${esc(c.name)}
              ${u > 30 ? `<span class="tag" style="background:color-mix(in srgb,var(--crit) 16%,transparent);color:var(--crit-ink)">High</span>` : ''}
              ${u > 10 && u <= 30 ? `<span class="tag" style="background:color-mix(in srgb,var(--warn) 22%,transparent);color:var(--warn-ink)">Watch</span>` : ''}
              ${u <= 10 ? `<span class="tag done">Good</span>` : ''}
            </div>
            <div class="amt"><b>${pct(u, 0)}</b> <span class="sub">${money(reportedBalance(c))} of ${money(c.limit)}</span></div>
            <div class="meter ${utilClass(u)}" style="position:relative">
              <i style="width:${clamp(u, 0, 100)}%"></i>
              <span title="30% threshold" style="position:absolute;left:30%;top:-2px;width:2px;height:12px;background:var(--ink);opacity:.45"></span>
            </div>
          </div>`;
        }).join('')}
        <div class="budrow" style="border-top:2px solid var(--border);margin-top:6px;padding-top:12px">
          <div class="nm"><b>All cards together</b></div>
          <div class="amt"><b>${pct(util.agg, 1)}</b> <span class="sub">${money(totalReported())} of ${money(totalLimit())}</span></div>
          <div class="meter ${utilClass(util.agg)}" style="position:relative">
            <i style="width:${clamp(util.agg, 0, 100)}%"></i>
            <span style="position:absolute;left:30%;top:-2px;width:2px;height:12px;background:var(--ink);opacity:.45"></span>
          </div>
        </div>
      </div>
      <div class="sub" style="margin-top:12px">The marker sits at 30%. Utilisation carries no memory. It is
      recalculated from the balances reported each month, so it can be fixed in a single billing cycle.</div>
    </div>

    <div class="card">
      <h3>Credit factor scorecard</h3>
      <div class="sub" style="margin-bottom:12px">Published FICO factor weights applied to the data you entered</div>
      <div class="score-ring">
        <div style="flex:0 0 auto">${chart({
          type: 'gauge', h: 150,
          value: ((cs.estimate - 300) / 550) * 100,
          display: String(cs.estimate), sub: `${cs.low} to ${cs.high}`,
          color: toneVar(cs.tone)
        })}</div>
        <div style="flex:1 1 200px;min-width:180px">
          <div style="font-size:19px;font-weight:640;color:${toneVar(cs.tone)}">${esc(cs.label)}</div>
          <p class="sub" style="margin:6px 0 0">
            ${cs.reported ? `Your last reported score was <b>${cs.reported}</b>. ` : ''}
            This is a model of the factor weights, not your score. Lenders use several scoring versions and
            see data this app never will.
          </p>
        </div>
      </div>
      <div style="margin-top:14px">
        ${cs.factors.map(f => {
          if (f.score == null) return `<div class="comp">
            <div class="cn">${esc(f.name)}</div>
            <div class="cv">${f.weight}% &middot; no data</div>
            <div class="meter"><i style="width:0"></i></div>
            <div class="why">${esc(f.why)} <b>Log payments below to include this factor.</b></div>
          </div>`;
          const p = f.score;
          return `<div class="comp">
            <div class="cn">${esc(f.name)} <span class="pill tiny">${f.weight}% weight</span></div>
            <div class="cv">${Math.round(p)}/100</div>
            <div class="meter ${p >= 75 ? 'g' : p >= 45 ? 'w' : 'c'}"><i style="width:${p}%"></i></div>
            <div class="why">${esc(f.why)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="sub" style="margin-top:12px">Biggest opportunity:
        <b>${esc((scoreHeadroom()[0] || {}).name || '-')}</b>, roughly
        ${Math.round((scoreHeadroom()[0] || {}).gap || 0)} modelled points still available there.</div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Utilisation over time</h3>
      <div class="sub">Recorded automatically each month you open the dashboard</div>
      ${hist.length > 1 ? chart({
        type: 'line', h: 210, direct: true, fmt: v => pct(v, 1),
        x: hist.map(x => monthShort(x.month)),
        tipTitle: i => monthLabel(hist[i].month),
        series: [{ name: 'Utilisation', color: 'var(--s2)', area: true,
          values: hist.map(x => x.util), endLabel: pct(hist[hist.length - 1].util, 0) }],
        aria: 'Credit utilisation percentage by month'
      }) : `<div class="sub" style="padding:20px 0">History starts building from this month.
        Come back next month and a trend appears here.</div>`}
      <div class="sub" style="margin-top:8px">One series, so no legend is needed. The title names it.
      Lower is better; the strongest band is under 10%.</div>
    </div>

    <div class="card">
      <h3>Payments due</h3>
      <div class="sub">Next 45 days. The close date is the one that sets your reported balance.</div>
      ${due.length ? due.map(d => `<div style="padding:11px 0;border-bottom:1px solid var(--grid)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
          <b style="font-size:13px">${esc(d.card.name)}</b>
          <span class="mono" style="font-weight:620">${money(d.amountFull)}</span>
        </div>
        <div class="sub" style="margin-top:3px">
          Due in <b>${d.daysToDue} day${d.daysToDue === 1 ? '' : 's'}</b> (${d.card.dueDay}${ordinal(d.card.dueDay)})
          · statement closes in <b>${d.daysToClose} day${d.daysToClose === 1 ? '' : 's'}</b> (${d.card.statementDay}${ordinal(d.card.statementDay)})
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="pill tiny" ${d.autopay === 'none' ? 'style="color:var(--crit-ink);border-color:var(--crit)"' : ''}>
            ${d.autopay === 'none' ? '⚠ ' : '✓ '}${esc(AUTOPAY_LABEL[d.autopay])}</span>
          <span class="pill tiny">minimum ${money(d.amountMin)}</span>
          <button class="btn sm ghost" data-act="log-payment" data-id="${d.card.id}">Log a payment</button>
        </div>
      </div>`).join('') : '<div class="sub">Nothing due in the next 45 days.</div>'}
      <div style="margin-top:12px"><button class="btn sm" data-act="payment-log">View payment history</button></div>
    </div>
  </div>

  ${totalLimit() <= 0 ? `<div class="card" style="margin-top:14px">
    <h3>Credit limits are missing</h3>
    <div class="sub">Utilisation is a ratio, so none of it can be calculated without each card's limit.
      Add them and this tab fills in.</div>
    <div style="margin-top:12px">${cards.map(c =>
      `<button class="btn sm" style="margin:0 6px 6px 0" data-act="edit-card" data-id="${c.id}">Set limit for ${esc(c.name)}</button>`).join('')}</div>
  </div>` : `
  <div class="card" style="margin-top:14px">
    <h3>Pay-before-close simulator</h3>
    <div class="sub">Utilisation is measured on the statement balance. Paying before the statement closes
      changes what gets reported; paying by the due date only protects your payment history.</div>
    <div class="row" style="margin:14px 0 4px">
      <label class="f" style="flex:1 1 260px">
        <span>Pay down <b>${money(payAmt)}</b> before your statements close</span>
        <input type="range" class="slider" id="utilPay" min="0" step="50"
          max="${Math.max(500, Math.ceil(totalReported() / 50) * 50)}" value="${payAmt}"></label>
    </div>
    <div class="grid g-3">
      <div class="kv"><span>Reported now</span><b style="color:${toneVar(utilTone(simulated.before))}">${pct(simulated.before, 1)}</b></div>
      <div class="kv"><span>Reported after</span><b style="color:${toneVar(utilTone(simulated.after))}">${pct(simulated.after, 1)}</b></div>
      <div class="kv"><span>To reach 9%</span><b>${money(payToReach(9))}</b></div>
    </div>
    <div class="meter ${utilClass(simulated.after)}" style="margin-top:12px;height:10px;position:relative">
      <i style="width:${clamp(simulated.after, 0, 100)}%"></i>
      <span style="position:absolute;left:30%;top:-2px;width:2px;height:14px;background:var(--ink);opacity:.45"></span>
      <span style="position:absolute;left:10%;top:-2px;width:2px;height:14px;background:var(--ink);opacity:.25"></span>
    </div>
    <div class="sub" style="margin-top:8px">Markers at 10% and 30%. This assumes the payment lands before each
      card's close date. A payment made after the statement cuts has no effect on that month's reported figure.</div>
  </div>`}

  <div class="card" style="margin-top:14px">
    <h3>Your cards</h3>
    <div class="sub" style="margin-bottom:10px">Limit, timing and rewards drive everything on this tab</div>
    <div class="tbl-wrap" style="border:0"><table>
      <thead><tr><th>Card</th><th class="num">Limit</th><th class="num">Reported</th><th class="num">Used</th>
        <th class="num">APR</th><th>Closes / due</th><th class="num">Fee</th><th>Age</th><th></th></tr></thead>
      <tbody>${cards.map(c => {
        const u = cardUtil(c);
        return `<tr>
          <td><b>${esc(c.name)}</b><div class="sub">${esc(memberName(c.member))}
            ${c.paysInFull === false ? '· <span style="color:var(--crit-ink)">carrying a balance</span>' : '· paid in full'}</div></td>
          <td class="num">${money(c.limit)}</td>
          <td class="num">${money(reportedBalance(c))}</td>
          <td class="num" style="color:${toneVar(utilTone(u))};font-weight:620">${pct(u, 0)}</td>
          <td class="num">${(+c.apr || 0).toFixed(1)}%</td>
          <td class="mono">${c.statementDay}${ordinal(c.statementDay)} / ${c.dueDay}${ordinal(c.dueDay)}</td>
          <td class="num">${c.annualFee ? money(c.annualFee) : '-'}</td>
          <td class="sub">${esc(yearsText(monthsSince(c.openedDate)))}</td>
          <td><button class="btn sm ghost" data-act="edit-card" data-id="${c.id}">Edit</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-act="edit-card" data-id="">+ Add card</button>
      <button class="btn" data-act="edit-inquiries">Hard inquiries (${((S.creditProfile || {}).inquiries || []).length})</button>
      <button class="btn" data-act="set-reported-score">Record my real score</button>
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <h3>What to do, ordered by impact</h3>
    <div class="sub" style="margin-bottom:4px">Heaviest factors and most urgent items first</div>
    ${ins.length ? ins.map(i => `<div class="insight">
      <div class="ic" style="background:${toneVar(i.tone)}">${toneIcon(i.tone)}</div>
      <div class="tx"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>
    </div>`).join('') : '<div class="sub">Nothing needs attention right now.</div>'}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Rewards routing</h3>
      <div class="sub">Which card to use where, based on what you actually spend</div>
      ${ra.rows.length ? `<div class="tbl-wrap" style="border:0"><table>
        <thead><tr><th>Category</th><th class="num">Yearly spend</th><th>Best card</th>
          <th class="num">Now</th><th class="num">Best</th><th class="num">Gain</th></tr></thead>
        <tbody>${ra.rows.slice(0, 9).map(r => `<tr>
          <td>${esc(catName(r.cat))}</td>
          <td class="num">${money(r.spend)}</td>
          <td>${esc(r.bestCard.name)} <span class="sub">${pct(r.bestRate, 0)}</span></td>
          <td class="num">${pct(r.curRate, 1)}</td>
          <td class="num">${money(r.bestVal)}</td>
          <td class="num ${r.gain > 1 ? 'pos' : ''}">${r.gain > 1 ? '+' + money(r.gain) : '-'}</td>
        </tr>`).join('')}</tbody></table></div>
        <div class="kv" style="margin-top:10px"><span>Earning now</span><b>${money(ra.current)}/yr</b></div>
        <div class="kv"><span>If every category went to its best card</span><b>${money(ra.best)}/yr</b></div>
        <div class="kv"><span>Difference</span><b class="${ra.gain > 0 ? 'pos' : ''}">${money(ra.gain)}/yr</b></div>
        ${ra.fees > 0 ? `<div class="kv"><span>Annual fees paid</span><b class="neg">${money(ra.fees)}/yr</b></div>` : ''}
        ${ra.excluded && ra.excluded.length ? `<div class="disclaim" style="border-left-color:var(--crit)">
          <b>${esc(ra.excluded.map(c => c.name).join(', '))} ${ra.excluded.length === 1 ? 'is' : 'are'} left out of these
          recommendations</b> because ${ra.excluded.length === 1 ? 'it is' : 'they are'} carrying a balance. Earning
          ${Math.max(...ra.excluded.map(c => Math.max(...(c.rewards || []).map(r => +r.rate || 0), 0)))}% back while paying
          ${Math.max(...ra.excluded.map(c => +c.apr || 0)).toFixed(1)}% interest is a loss on every purchase. Clear the
          balance first, then route spending there.</div>`
        : ''}
        ${ra.noneClear ? `<div class="disclaim" style="border-left-color:var(--crit)">
          Every card is carrying a balance, so none of these rates are actually being earned,
          interest is outrunning them. Paying the balances off comes before any rewards decision.</div>` : ''}
        <div class="sub" style="margin-top:10px">Chasing rewards is only worth it once balances are cleared
        every month. A 3% cashback rate loses badly to a ${(Math.max(...cards.map(c => +c.apr || 0))).toFixed(1)}% interest charge.</div>`
        : '<div class="sub">Add reward rates to your cards to see routing suggestions.</div>'}
    </div>

    <div class="card">
      <h3>Before you close a card</h3>
      <div class="sub" style="margin-bottom:10px">Closing removes its limit from the calculation and eventually
        shortens your average account age. That is two factors damaged by one action</div>
      ${cards.map(c => {
        const im = closeImpact(c.id);
        if (!im) return '';
        const worse = im.utilAfter - im.utilBefore;
        return `<div class="budrow">
          <div class="nm">${esc(c.name)} ${im.isOldest ? '<span class="tag next">Oldest</span>' : ''}</div>
          <div class="amt">${money(im.limitLost)} limit lost</div>
          <div class="sub" style="grid-column:1/-1;margin-top:2px">
            Utilisation would go ${pct(im.utilBefore, 1)} &rarr;
            <b style="color:${toneVar(utilTone(im.utilAfter))}">${pct(im.utilAfter, 1)}</b>
            ${worse > 0.5 ? `(${pct(worse, 1)} worse)` : '(little change)'}${reportedBalance(c) > 0
              ? ` · you would still owe the ${money(reportedBalance(c))} on it. Closing removes the limit, not the debt.` : ''}${im.isOldest
              ? ' · this is your oldest account, so closing it also starts a clock you cannot restart.' : ''}
          </div>
        </div>`;
      }).join('')}
      <div class="sub" style="margin-top:12px">If a fee is the problem, ask the issuer to switch you to a
      no-fee version of the same account. That keeps the age and the limit on your report; closing loses both.</div>
    </div>
  </div>

  <div class="disclaim">
    <b>This is a model of the score, not the score.</b> Credit bureaus hold payment records, balances and
    account details this dashboard never sees, lenders use several different scoring versions, and the exact
    formulas are not published. Treat the number as a way to see which factor has the most slack, not as a
    prediction. Your real scores are free from most card issuers and your statutory reports are free at
    annualcreditreport.com. Check those for the actual figures and to dispute anything wrong.
  </div>
  `;
}

/* ================================================================ WEALTH === */

function viewWealth() {
  const nw = netWorth(), assets = totalAssets(), debt = totalDebt();
  const fi = fiSnapshot();
  const extra = +(UI.extraDebt || 0);
  const plans = debtPlans(extra);
  const saveMonths = plans.minimum.months - plans.avalanche.months;
  const saveInt = plans.minimum.interest - plans.avalanche.interest;
  // cards and loans shown as one list, most expensive first
  const debtRows = [
    ...activeCards().filter(c => (+c.balance || 0) > 0).map(c => ({
      id: c.id, kind: 'card', name: c.name, balance: +c.balance || 0,
      apr: +c.apr || 0, minPayment: +c.minPayment || 0, member: c.member })),
    ...(S.debts || []).map(d => ({
      id: d.id, kind: 'loan', name: d.name, balance: +d.balance || 0,
      apr: +d.apr || 0, minPayment: +d.minPayment || 0, member: d.member }))
  ].sort((a, b) => b.apr - a.apr);

  return `
  <div class="section-h"><h2>Net worth &amp; long-term position</h2>
    <span class="sub">What you own minus what you owe</span></div>

  <div class="grid g-kpi">
    ${tile({ label: 'Net worth', value: money(nw), hero: true,
      tone: nw >= 0 ? 'var(--good-ink)' : 'var(--crit-ink)',
      delta: `${money(assets)} assets − ${money(debt)} debts` })}
    ${tile({ label: 'Invested assets', value: money(investAssets()),
      delta: `${money(cashAssets())} of that is cash` })}
    ${tile({ label: 'Total debt', value: money(debt),
      tone: debt > 0 ? 'var(--crit-ink)' : 'var(--good-ink)',
      delta: `${money(minDebtPayments())}/mo in minimum payments` })}
    ${tile({ label: 'Financial independence target', value: compact(fi.target),
      delta: `25 × ${money(fi.annualEss)} of annual essentials` })}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Assets</h3><div class="sub">Cash, retirement and taxable accounts</div>
      ${S.assets.length ? `<table><tbody>${S.assets.map(a => `<tr>
        <td><b>${esc(a.name)}</b><div class="sub">${esc(({cash:'Cash',retirement:'Retirement',brokerage:'Brokerage',property:'Property',other:'Other'})[a.type] || a.type)}</div></td>
        <td class="num">${money(a.value)}</td>
        <td><button class="btn sm ghost" data-act="edit-asset" data-id="${a.id}">Edit</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="sub">No accounts added yet.</div>'}
      <div style="margin-top:12px"><button class="btn" data-act="edit-asset" data-id="">+ Add account</button></div>
    </div>

    <div class="card">
      <h3>Debts</h3><div class="sub">Ordered by interest rate - the most expensive first</div>
      ${debtRows.length ? `<table><tbody>${debtRows.map(d => `<tr>
        <td><b>${esc(d.name)}</b>
          <div class="sub">${(+d.apr || 0).toFixed(1)}% APR · ${money(d.minPayment)}/mo minimum
          ${d.member ? '· ' + esc(memberName(d.member)) : ''}
          ${d.kind === 'card' ? '· <span class="pill tiny">credit card</span>' : ''}</div></td>
        <td class="num ${d.apr >= 8 ? 'neg' : ''}">${money(d.balance)}
          <div class="sub">${money(d.balance * d.apr / 100)}/yr interest</div></td>
        <td><button class="btn sm ghost" data-act="${d.kind === 'card' ? 'edit-card' : 'edit-debt'}"
          data-id="${d.id}">Edit</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="sub">No debts recorded. That is the goal.</div>'}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="edit-debt" data-id="">+ Add loan</button>
        <button class="btn" data-act="edit-card" data-id="">+ Add credit card</button>
      </div>
      ${cardDebt() > 0 ? `<div class="sub" style="margin-top:10px">Credit cards are also tracked on the
        <button class="btn sm ghost" data-act="go-cards" style="padding:0 4px">Cards &amp; Credit tab</button>,
        where utilisation and statement timing matter as much as the balance.</div>` : ''}
    </div>
  </div>

  ${debtRows.length ? `<div class="card" style="margin-top:14px">
    <h3>Payoff strategy</h3>
    <div class="sub">Both methods pay the same minimums; they differ only in where the extra dollar goes.</div>
    <div class="row" style="margin:12px 0">
      <label class="f" style="flex:1 1 240px"><span>Extra payment per month: <b>${money(extra)}</b></span>
        <input type="range" class="slider" id="extraDebt" min="0" max="1500" step="25" value="${extra}"></label>
    </div>
    <div class="grid g-3">
      <div class="card" style="box-shadow:none;background:var(--surface-2)">
        <h4 style="font-size:13px">Avalanche <span class="tag now">lowest cost</span></h4>
        <div class="sub" style="margin:4px 0 8px">Highest APR first</div>
        <div class="kv"><span>Debt-free in</span><b>${plans.avalanche.months} mo</b></div>
        <div class="kv"><span>Total interest</span><b>${money(plans.avalanche.interest)}</b></div>
        <div class="kv"><span>First target</span><b>${esc((plans.avalanche.order[0] || '-').slice(0, 22))}</b></div>
      </div>
      <div class="card" style="box-shadow:none;background:var(--surface-2)">
        <h4 style="font-size:13px">Snowball <span class="tag next">fastest wins</span></h4>
        <div class="sub" style="margin:4px 0 8px">Smallest balance first</div>
        <div class="kv"><span>Debt-free in</span><b>${plans.snowball.months} mo</b></div>
        <div class="kv"><span>Total interest</span><b>${money(plans.snowball.interest)}</b></div>
        <div class="kv"><span>First target</span><b>${esc((plans.snowball.order[0] || '-').slice(0, 22))}</b></div>
      </div>
      <div class="card" style="box-shadow:none;background:var(--surface-2)">
        <h4 style="font-size:13px">Minimums only</h4>
        <div class="sub" style="margin:4px 0 8px">No extra payment</div>
        <div class="kv"><span>Debt-free in</span><b>${plans.minimum.months} mo</b></div>
        <div class="kv"><span>Total interest</span><b>${money(plans.minimum.interest)}</b></div>
        <div class="kv"><span>Extra cost</span><b class="neg">${money(plans.minimum.interest - plans.avalanche.interest)}</b></div>
      </div>
    </div>
    ${extra > 0 ? `<div class="disclaim" style="border-left-color:var(--good)">
      Adding <b>${money(extra)}</b> a month clears the debt <b>${saveMonths} months</b> sooner and avoids
      <b>${money(saveInt)}</b> in interest. Avalanche costs
      ${money(plans.snowball.interest - plans.avalanche.interest)} less than snowball here; snowball retires
      the first balance sooner, which some people find easier to sustain. Both beat minimums by a wide margin.
    </div>` : ''}
  </div>` : ''}

  <div class="card" style="margin-top:14px">
    <h3>Goals</h3><div class="sub">Money with a name attached</div>
    ${S.goals.length ? S.goals.map(g => {
      const p = g.target > 0 ? clamp((g.saved / g.target) * 100, 0, 100) : 0;
      return `<div class="budrow">
        <div class="nm">${esc(g.name)} ${g.date ? `<span class="pill tiny">by ${esc(g.date)}</span>` : ''}</div>
        <div class="amt">${money(g.saved)} <span class="sub">of ${money(g.target)}</span>
          <button class="btn sm ghost" data-act="edit-goal" data-id="${g.id}">edit</button></div>
        <div class="meter ${p >= 100 ? 'g' : ''}"><i style="width:${p}%"></i></div>
        <div class="sub" style="grid-column:1/-1">${pct(p)} funded · ${money(Math.max(0, g.target - g.saved))} remaining</div>
      </div>`;
    }).join('') : '<div class="sub">No goals yet.</div>'}
    <div style="margin-top:12px"><button class="btn" data-act="edit-goal" data-id="">+ Add goal</button></div>
  </div>
  `;
}

/* ================================================================== PLAN === */

function viewPlan() {
  const h = healthScore();
  const rungs = ladder();
  const ins = insights(UI.month);
  const fi = fiSnapshot();
  const sim = trimSim(UI.cutPct);
  const r = S.settings.expectedReturn;
  const yrs = [5, 10, 15, 20, 25, 30];

  if (!S.txns.length) {
    return emptyCard('The plan needs data first',
      'Import a month or two of transactions and this tab fills with a health score, a priority order, and projections built from your own numbers.',
      `<button class="btn primary" data-act="import">Import a statement</button>
       <button class="btn" data-act="load-sample" style="margin-left:8px">Load sample data</button>`);
  }

  return `
  <div class="section-h"><h2>Plan &amp; advice</h2>
    <span class="sub">Built from ${S.txns.length} transactions across ${activeMonths().length} months</span></div>

  <div class="grid g-2">
    <div class="card">
      <h3>Financial health score</h3>
      <div class="sub" style="margin-bottom:12px">Six measures, weighted by how much each one moves long-run outcomes</div>
      <div class="score-ring">
        <div style="flex:0 0 auto">${chart({ type: 'gauge', h: 150, value: h.total, color: toneVar(h.tone) })}</div>
        <div style="flex:1 1 200px;min-width:180px">
          <div style="font-size:19px;font-weight:640;color:${toneVar(h.band[1])}">${esc(h.band[0])}</div>
          <p class="sub" style="margin:6px 0 0">
            ${h.total >= 62 ? 'The foundations are in place. The leverage now is in raising the investing rate and holding it.'
              : h.total >= 45 ? 'Solid habits with a clear gap or two. The lowest-numbered incomplete step below is where to push.'
              : 'The base needs work before growth compounds. Steps 1 to 3 below carry the most weight.'}
          </p>
        </div>
      </div>
      <div style="margin-top:14px">
        ${h.comps.map(c => {
          const p = (c.score / c.max) * 100;
          const cls = p >= 70 ? 'g' : p >= 40 ? 'w' : 'c';
          return `<div class="comp">
            <div class="cn">${esc(c.name)}</div>
            <div class="cv">${(c.v).toFixed(c.dp || 0)}${c.unit} · ${c.score.toFixed(0)}/${c.max}</div>
            <div class="meter ${cls}"><i style="width:${p}%"></i></div>
            <div class="why">${esc(c.why)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <h3>What to do next, in order</h3>
      <div class="sub" style="margin-bottom:6px">Each step is unlocked by the one above it. Your position is marked.</div>
      ${rungs.map((x, i) => `<div class="step ${x.status}">
        <div class="n">${x.status === 'done' ? '✓' : i + 1}</div>
        <div class="b">
          <h4>${esc(x.title)}
            <span class="tag ${x.status}">${x.status === 'done' ? 'Done' : x.status === 'now' ? 'You are here' : 'Later'}</span>
          </h4>
          <p>${esc(x.body)}</p>
          ${x.metric ? `<div class="metric">${esc(x.metric)}${x.action ? ` <span class="sub">${esc(x.action)}</span>` : ''}</div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>

  ${activeCards().length ? (() => {
    const cs = creditScore(), u = utilisationScore(), top = creditInsights()[0];
    return `<div class="card" style="margin-top:14px">
      <h3>Credit standing</h3>
      <div class="sub" style="margin-bottom:12px">Your borrowing cost for the next decade is set here</div>
      <div class="grid g-kpi" style="gap:10px">
        ${tile({ label: 'Modelled score', value: String(cs.estimate), tone: toneVar(cs.tone),
          delta: `${esc(cs.label)} · range ${cs.low} to ${cs.high}` })}
        ${tile({ label: 'Utilisation', value: pct(u.agg, 1),
          tone: toneVar(utilTone(u.agg)),
          delta: u.agg > 30 ? 'above the 30% threshold' : u.agg > 10 ? 'under 30%, above the 10% ideal' : 'strongest band' })}
        ${tile({ label: 'Card interest', value: money(cardInterestMonthly() * 12) + '/yr',
          tone: cardInterestMonthly() > 0 ? 'var(--crit-ink)' : 'var(--good-ink)',
          delta: cardInterestMonthly() > 0 ? 'paid for nothing received' : 'every card paid in full' })}
      </div>
      ${top ? `<div class="insight" style="border-bottom:0;padding-bottom:0">
        <div class="ic" style="background:${toneVar(top.tone)}">${toneIcon(top.tone)}</div>
        <div class="tx"><b>${esc(top.title)}</b><span>${esc(top.text)}</span></div></div>` : ''}
      <div style="margin-top:12px"><button class="btn sm" data-act="go-cards">Open Cards &amp; Credit &rarr;</button></div>
    </div>`;
  })() : ''}

  <div class="card" style="margin-top:14px">
    <h3>Findings from this month</h3>
    <div class="sub" style="margin-bottom:4px">Most urgent first</div>
    ${ins.length ? ins.map(i => `<div class="insight">
      <div class="ic" style="background:${toneVar(i.tone)}">${toneIcon(i.tone)}</div>
      <div class="tx"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>
    </div>`).join('') : '<div class="sub">Nothing stands out this month.</div>'}
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>The cost of the next dollar spent</h3>
      <div class="sub">What a recurring monthly amount becomes if invested instead, at ${r}% a year</div>
      ${chart({
        type: 'line', h: 220, direct: true, fmt: v => compact(v),
        x: yrs.map(y => y + 'y'),
        tipTitle: i => yrs[i] + ' years',
        series: [
          { name: money(100) + '/mo', color: 'var(--seq-250)', values: yrs.map(y => futureValue(100, y, r)), endLabel: compact(futureValue(100, 30, r)) },
          { name: money(500) + '/mo', color: 'var(--seq-400)', values: yrs.map(y => futureValue(500, y, r)), endLabel: compact(futureValue(500, 30, r)) },
          { name: money(1000) + '/mo', color: 'var(--seq-550)', values: yrs.map(y => futureValue(1000, y, r)), endLabel: compact(futureValue(1000, 30, r)) }
        ], aria: 'Growth of monthly investing over time at three contribution levels'
      })}
      ${legend([
        { name: '$100/mo', color: 'var(--seq-250)' },
        { name: '$500/mo', color: 'var(--seq-400)' },
        { name: '$1,000/mo', color: 'var(--seq-550)' }], 'swl')}
      <div class="sub" style="margin-top:8px">Ordered shades, not separate colours - these are the same quantity at three levels.
      A ${money(500)}/mo habit contributes ${compact(500 * 360)} over 30 years and ends near ${compact(futureValue(500, 30, r))}; the gap is compounding.</div>
    </div>

    <div class="card">
      <h3>Trim simulator</h3>
      <div class="sub">Move the slider. Discretionary spending averages ${money(sim.wants)}/mo over your last months.</div>
      <label class="f" style="margin-top:14px"><span>Cut discretionary spending by <b>${UI.cutPct}%</b></span>
        <input type="range" class="slider" id="cutPct" min="0" max="60" step="5" value="${UI.cutPct}"></label>
      <div class="kv"><span>Freed by the cut</span><b>${money(sim.freed)}/mo</b></div>
      <div class="kv"><span>Already unallocated</span><b>${money(sim.surplus)}/mo</b></div>
      <div class="kv"><span>Total investable</span><b style="color:var(--good-ink)">${money(sim.total)}/mo</b></div>
      <div style="margin-top:14px">
        ${chart({
          type: 'barv', h: 176, fmt: v => compact(v),
          items: [['5 yr', sim.y5], ['10 yr', sim.y10], ['20 yr', sim.y20], ['30 yr', sim.y30]]
            .map(([l, v]) => ({ label: l, value: v })),
          tipLabel: 'Projected value', aria: 'Projected value of the freed amount over time'
        })}
      </div>
      <div class="sub">At ${r}% a year. Over 30 years you would contribute ${compact(sim.contributed30)}
      and finish near ${compact(sim.y30)} - the difference is growth on money you would otherwise have spent.</div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Distance to financial independence</h3>
      <div class="sub">The 25× rule: assets worth 25 years of essential spending can historically sustain a 4% annual draw</div>
      <div class="grid g-kpi" style="margin-top:12px;gap:10px">
        ${tile({ label: 'Target', value: compact(fi.target), delta: `${money(fi.annualEss)} essentials a year` })}
        ${tile({ label: 'Invested today', value: compact(fi.start), delta: `${pct(fi.coverage, 1)} of target` })}
        ${tile({ label: 'Years at current pace', value: fi.yrs == null ? '-' : fi.yrs + ' yr',
          tone: fi.yrs != null && fi.yrs < 20 ? 'var(--good-ink)' : '',
          delta: fi.fiAge ? `around age ${fi.fiAge}` : 'add an investing contribution to project' })}
      </div>
      <div class="meter g" style="margin-top:12px;height:10px"><i style="width:${fi.coverage}%"></i></div>
      <div class="sub" style="margin-top:8px">
        Investing ${money(fi.invMonthly)}/mo currently. At today's balance a 4% draw would be
        ${money(fi.safeDraw)}/mo. The target moves with your essential spending, so lowering fixed costs
        pulls the finish line closer as well as speeding you toward it.
      </div>
    </div>

    <div class="card">
      <h3>Principles this plan applies</h3>
      <div class="sub" style="margin-bottom:10px">Frameworks, not picks - no security is ever named here</div>
      ${[
        ['Pay the guaranteed return first', 'Clearing a 20% balance beats an uncertain 7% market return. Debt above roughly 8% outranks investing.'],
        ['Automate before you optimise', 'A transfer that happens on payday beats a better strategy you have to remember. Automation is why savings rate beats stock selection for most households.'],
        ['Cost and diversification are the two levers you control', 'You cannot control returns. You can control fees and how concentrated you are. A 1% annual fee compounds against you exactly the way returns compound for you.'],
        ['Time in the market is the engine', `Of the ${compact(futureValue(500, 30, r))} a ${money(500)}/mo habit reaches in 30 years, only ${compact(500 * 360)} is yours - the rest is time.`],
        ['Match the horizon to the risk', 'Money needed within about five years belongs in cash or short-term instruments; a market drop should never force a sale at the wrong moment.'],
        ['Lower fixed costs twice', 'Cutting a recurring cost raises the surplus and lowers the FI target at the same time. One-off cuts do only the first.']
      ].map(([t, d]) => `<div class="insight">
        <div class="ic" style="background:var(--s7)">•</div>
        <div class="tx"><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}
    </div>
  </div>

  <div class="disclaim">
    <b>Read this as a model, not as advice.</b> This tab applies published, general personal-finance
    frameworks to the numbers you entered. It does not know your tax situation, employment terms,
    health, insurance, dependants or risk tolerance, and it never recommends a specific investment,
    fund or security. Contribution limits and tax rules change every year - verify current figures
    before acting. For decisions that depend on your full circumstances, speak to a licensed financial
    advisor or a CPA; nothing here is a substitute for one.
  </div>
  `;
}

/* ================================================================ IMPORT === */

let IMP = null;   // in-flight import: {rows, headers, map, parsed, account, member, source}

function viewImport() {
  return `
  <div class="section-h"><h2>Import transactions</h2>
    <span class="sub">Bank, card, or wallet exports · nothing is uploaded anywhere</span></div>

  <div class="grid g-2">
    <div class="card">
      <h3>1. Bring in a file</h3>
      <div class="sub" style="margin-bottom:12px">CSV from any bank, card issuer, or transfer app</div>
      <div class="dz" id="dz">
        <div style="font-size:26px;margin-bottom:6px">⤓</div>
        <b>Drop a statement here</b> or click to choose a file
        <div class="sub" style="margin-top:6px">
          <b>CSV</b> exports, and <b>PDF</b> or <b>Word</b> statements. Everything is read on this
          computer, and no file is uploaded anywhere.
        </div>
      </div>
      <input type="file" id="fileIn" accept=".csv,.txt,.pdf,.docx,.doc" class="hide">
      <div style="margin:14px 0 6px" class="sub">Or paste the rows directly:</div>
      <textarea id="pasteIn" rows="5" placeholder="Date,Description,Amount&#10;2026-09-01,KROGER #418,-84.21"></textarea>
      <div style="margin-top:10px"><button class="btn primary" data-act="parse-paste">Read pasted rows</button></div>
    </div>

    <div class="card">
      <h3>How aggregation works here</h3>
      <div class="sub" style="margin-bottom:10px">One ledger, many sources</div>
      ${[
        ['Every source lands in one place', 'Checking, credit cards, cash wallets and transfer apps all become rows in the same ledger, so a category total is the household total rather than one bank’s view.'],
        ['Each row is tagged to a person and an account', 'That is what makes the per-member breakdown and the fairness check possible.'],
        ['Duplicates are skipped automatically', 'Rows are fingerprinted on date, amount and merchant, so re-importing an overlapping statement will not double-count.'],
        ['Column layouts are remembered', 'Save the mapping once per bank and the next import from that source needs no setup.'],
        ['Categories are assigned on arrival', 'A merchant-matching rule set does the first pass; corrections you make can be saved as permanent rules.']
      ].map(([t, d]) => `<div class="insight"><div class="ic" style="background:var(--s1)">✓</div>
        <div class="tx"><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}
    </div>
  </div>

  ${Object.keys(S.profiles).length ? `<div class="card" style="margin-top:14px">
    <h3>Saved source formats</h3>
    <div class="sub">Re-used automatically when a file has matching headers</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${Object.keys(S.profiles).map(p => `<span class="pill">${esc(p)}
        <button class="x" style="font-size:14px;padding:0 3px" data-act="del-profile" data-name="${esc(p)}">×</button></span>`).join('')}
    </div>
  </div>` : ''}

  <div class="card" style="margin-top:14px">
    <h3>Backup &amp; restore</h3>
    <div class="sub" style="margin-bottom:12px">Your data lives only in this browser. Export regularly.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-act="export-json">Download full backup (JSON)</button>
      <button class="btn" data-act="import-json">Restore from a backup</button>
      <button class="btn" data-act="export-csv">Export transactions as CSV</button>
      <input type="file" id="jsonIn" accept=".json,application/json" class="hide">
    </div>
  </div>
  `;
}

/* ============================================================== SETTINGS === */

function viewSettings() {
  const st = S.settings;
  return `
  <div class="section-h"><h2>Settings</h2><span class="sub">Household, accounts and planning assumptions</span></div>

  <div class="grid g-2">
    <div class="card">
      <h3>Household members</h3>
      <div class="sub" style="margin-bottom:10px">Each person gets a fixed colour used across every chart</div>
      ${S.members.length ? S.members.map(m => `<div class="budrow">
        <div class="nm"><span class="dot" style="background:${memberColor(m.id)}"></span>${esc(m.name)}
          <span class="pill tiny">${esc(m.role || 'Member')}</span></div>
        <div class="amt">${m.annualIncome ? money(m.annualIncome) + '/yr' : '<span class="sub">no income set</span>'}
          <button class="btn sm ghost" data-act="edit-member" data-id="${m.id}">edit</button></div>
      </div>`).join('') : '<div class="sub">No members yet.</div>'}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="edit-member" data-id="">+ Add member</button>
        <button class="btn" data-act="run-setup">Run setup again</button>
      </div>
    </div>

    <div class="card">
      <h3>Accounts &amp; sources</h3>
      <div class="sub" style="margin-bottom:10px">Where transactions come from</div>
      ${S.accounts.length ? S.accounts.map(a => `<div class="budrow">
        <div class="nm">${esc(a.name)} <span class="pill tiny">${esc(a.type)}</span></div>
        <div class="amt">${a.member ? esc(memberName(a.member)) : '<span class="sub">shared</span>'}
          <button class="btn sm ghost" data-act="edit-account" data-id="${a.id}">edit</button></div>
      </div>`).join('') : '<div class="sub">No accounts yet.</div>'}
      <div style="margin-top:12px"><button class="btn" data-act="edit-account" data-id="">+ Add account</button></div>
    </div>
  </div>

  <div class="grid g-2" style="margin-top:14px">
    <div class="card">
      <h3>Planning assumptions</h3>
      <div class="sub" style="margin-bottom:12px">These drive every projection on the Plan tab</div>
      <div class="row">
        <label class="f"><span>Household name</span>
          <input type="text" id="setName" value="${esc(S.household.name)}"></label>
        <label class="f"><span>Your age</span>
          <input type="number" id="setAge" value="${st.currentAge}" min="16" max="90"></label>
      </div>
      <div class="row">
        <label class="f"><span>Expected annual return %</span>
          <input type="number" id="setRet" value="${st.expectedReturn}" min="0" max="15" step="0.5"></label>
        <label class="f"><span>Employer match %</span>
          <input type="number" id="setMatch" value="${st.employerMatchPct}" min="0" max="25" step="0.5"></label>
      </div>
      <label class="f"><span style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="setMatchDone" ${st.matchCaptured ? 'checked' : ''} style="width:auto">
        Payroll already contributes enough to capture the full match</span></label>
      <label class="f"><span style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="setHdhp" ${st.hdhp ? 'checked' : ''} style="width:auto">
        We are on a high-deductible health plan (HSA-eligible)</span></label>
      <button class="btn primary" data-act="save-settings">Save assumptions</button>
      <div class="sub" style="margin-top:10px">A 7% expected return is a common long-run nominal assumption for a
      diversified equity-heavy portfolio; it is not a promise, and real returns arrive unevenly.</div>
    </div>

    <div class="card">
      <h3>Categorisation rules</h3>
      <div class="sub" style="margin-bottom:10px">Your rules override the ${DEFAULT_RULES.length} built-in merchant patterns</div>
      ${S.rules.length ? `<div class="scroller"><table><tbody>${S.rules.map((r, i) => `<tr>
        <td>Description contains <b>${esc(r.match)}</b></td>
        <td>&rarr; ${esc(catName(r.cat))}</td>
        <td><button class="btn sm ghost" data-act="del-rule" data-i="${i}">×</button></td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="sub">No custom rules yet. Change a category on the Spending tab and you will be offered one.</div>'}
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="add-rule">+ Add rule</button>
        <button class="btn" data-act="recat-all">Re-apply rules to all transactions</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <h3>Data</h3>
    <div class="sub" style="margin-bottom:12px">
      Everything is stored in this browser only (localStorage). Clearing site data, using a different
      browser, or a different device means a different, empty dashboard.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-act="export-json">Download backup</button>
      <button class="btn" data-act="import-json">Restore backup</button>
      <button class="btn" data-act="load-sample">Load sample household</button>
      <button class="btn danger" data-act="wipe">Clear all data</button>
    </div>
    <div class="sub" style="margin-top:12px">Storing ${S.txns.length} transactions,
      ${S.members.length} members, ${S.accounts.length} accounts,
      ${(S.cards || []).length} cards.</div>
  </div>

  ${(() => {
    const P = platformInfo();
    const state = P.standalone ? 'installed and running as an app'
      : P.fileMode ? 'running from a local file'
      : (navigator.serviceWorker && navigator.serviceWorker.controller) ? 'available offline in this browser'
      : 'running in a browser';
    return `<div class="card" style="margin-top:14px">
    <h3>This app</h3>
    <div class="sub" style="margin-bottom:12px">Version ${APP_VERSION} &middot; ${state}</div>

    ${P.standalone ? `<div class="insight" style="border-bottom:0;padding-top:0">
      <div class="ic" style="background:var(--good)">&#10003;</div>
      <div class="tx"><b>Installed on this computer</b><span>It runs in its own window and works
      without an internet connection. Updates arrive the next time you open it while online.</span></div></div>`
    : P.fileMode ? `<div class="disclaim" style="border-left-color:var(--s1);margin-top:0">
      <b>Opened straight from a file.</b> That works fine and is the simplest way to use it.
      To get an icon and its own window instead, the folder needs to be opened through a
      local address. The RUN-THIS-APP guide has the steps.</div>`
    : P.iOS ? `<div class="disclaim" style="border-left-color:var(--s1);margin-top:0">
      <b>To install on iPhone or iPad:</b> tap the <b>Share</b> button in Safari
      (the square with an arrow pointing up), scroll down, and choose
      <b>Add to Home Screen</b>. Safari has no automatic install prompt, so this is the only
      route, and it has to be Safari rather than Chrome.</div>`
    : `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary hide" id="btnInstall">Install as an app</button>
      </div>
      <div class="sub" id="installHint">${P.canPrompt ? ''
        : P.android
          ? `No install prompt yet. In Chrome you can also use the browser menu, then
             <b>Install app</b> or <b>Add to Home screen</b>.`
          : `No install prompt yet. In Chrome or Edge you can also use the browser menu,
             then <b>Install Household Wealth Dashboard</b>.`}</div>`}

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn" data-act="about-sharing">How to share this with someone</button>
      <button class="btn" data-act="storage-info">Storage &amp; durability</button>
    </div>
    <div class="sub" style="margin-top:12px">
      Each person who installs it gets their own private copy. No data is ever shared between
      installations, and there is no server in between.
    </div>
  </div>`;
  })()}
  `;
}

/* ================================================================ RENDER === */

function render() {
  // header
  $('#hhName').textContent = S.household.name || 'Household Wealth Dashboard';
  const nw = netWorth();
  $('#hhSub').textContent = S.txns.length
    ? `${S.members.length} member${S.members.length === 1 ? '' : 's'} · net worth ${money(nw)}`
    : 'Private · stored on this device only';
  $('#mLabel').textContent = monthLabel(UI.month);

  // tabs
  $('#tabs').innerHTML = TABS.map(([id, name]) =>
    `<button role="tab" data-tab="${id}" aria-selected="${UI.tab === id}">${name}</button>`).join('');

  // member filter
  const showMembers = ['overview', 'spending'].includes(UI.tab) && S.members.length > 0;
  const mb = $('#memberBar');
  mb.style.display = showMembers ? 'flex' : 'none';
  if (showMembers) {
    mb.innerHTML = `<span class="sub" style="margin-right:2px">View:</span>
      <button class="chip" data-member="all" aria-pressed="${UI.member === 'all'}">Everyone</button>` +
      S.members.map(m => `<button class="chip" data-member="${m.id}" aria-pressed="${UI.member === m.id}">
        <span class="dot" style="background:${memberColor(m.id)}"></span>${esc(m.name)}</button>`).join('');
  }

  CHARTS.clear();
  const v = {
    overview: viewOverview, spending: viewSpending, budget: viewBudget,
    recurring: viewRecurring, cards: viewCards, wealth: viewWealth, plan: viewPlan,
    import: viewImport, settings: viewSettings
  }[UI.tab] || viewOverview;

  $('#view').innerHTML = v();
  mountCharts();
  wireView();
}

/* ================================================================ MODALS === */

function openModal(title, body, footer, onMount, wide) {
  $('#modalRoot').innerHTML = `<div class="modal-bg" data-close-bg>
    <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${esc(title)}</h3><button class="x" data-close>&times;</button></div>
      <div class="modal-b">${body}</div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ''}
    </div></div>`;
  const root = $('#modalRoot');
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  root.querySelector('[data-close-bg]').onclick = e => { if (e.target.hasAttribute('data-close-bg')) closeModal(); };
  document.addEventListener('keydown', escClose);
  if (onMount) onMount(root);
  const first = root.querySelector('input,select,textarea');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() { $('#modalRoot').innerHTML = ''; document.removeEventListener('keydown', escClose); }
function escClose(e) { if (e.key === 'Escape') closeModal(); }

/* --------------------------------------------------------- transaction form */

function txForm(id) {
  const t = id ? S.txns.find(x => x.id === id) : null;
  const isNew = !t;
  openModal(isNew ? 'Add transaction' : 'Edit transaction', `
    <div class="row">
      <label class="f"><span>Date</span><input type="date" id="tDate" value="${t ? t.date : todayISO()}"></label>
      <label class="f"><span>Amount</span>
        <input type="number" id="tAmt" step="0.01" value="${t ? Math.abs(t.amount) : ''}" placeholder="0.00"></label>
      <label class="f" style="flex:0 0 150px"><span>Direction</span>
        <select id="tDir">
          <option value="out"${t && t.amount < 0 ? ' selected' : ''}>Money out</option>
          <option value="in"${t && t.amount > 0 ? ' selected' : ''}>Money in</option>
        </select></label>
    </div>
    <label class="f"><span>Description</span>
      <input type="text" id="tDesc" value="${t ? esc(t.desc) : ''}" placeholder="e.g. Kroger, rent, paycheck"></label>
    <div class="row">
      <label class="f"><span>Category</span><select id="tCat">${catOptions(t ? t.cat : 'misc')}</select></label>
      <label class="f"><span>Who</span><select id="tMem">${memberOptions(t ? t.member : (S.members[0] || {}).id, 'Unassigned')}</select></label>
      <label class="f"><span>Account</span><select id="tAcc">${accountOptions(t ? t.account : (S.accounts[0] || {}).id, 'None')}</select></label>
    </div>
    <label class="f"><span>Note (optional)</span><input type="text" id="tNote" value="${t ? esc(t.note || '') : ''}"></label>
  `, `${isNew ? '' : '<button class="btn danger" id="tDel">Delete</button>'}
     <button class="btn" data-close>Cancel</button>
     <button class="btn primary" id="tSave">${isNew ? 'Add' : 'Save'}</button>`,
  root => {
    const desc = root.querySelector('#tDesc');
    // suggest a category as the description is typed, until the user picks one
    let touched = !isNew;
    root.querySelector('#tCat').addEventListener('change', () => touched = true);
    desc.addEventListener('input', () => {
      if (touched) return;
      const g = autoCat(desc.value);
      if (g && g !== 'misc') root.querySelector('#tCat').value = g;
    });
    root.querySelector('#tSave').onclick = () => {
      const amt = parseFloat(root.querySelector('#tAmt').value);
      if (!isFinite(amt) || amt === 0) return toast('Enter an amount.');
      const dir = root.querySelector('#tDir').value;
      const rec = {
        id: t ? t.id : uid(),
        date: root.querySelector('#tDate').value || todayISO(),
        desc: root.querySelector('#tDesc').value.trim() || 'Transaction',
        amount: dir === 'out' ? -Math.abs(amt) : Math.abs(amt),
        cat: root.querySelector('#tCat').value,
        member: root.querySelector('#tMem').value || null,
        account: root.querySelector('#tAcc').value || null,
        note: root.querySelector('#tNote').value.trim()
      };
      rec.hash = txHash(rec);
      if (t) Object.assign(t, rec); else S.txns.push(rec);
      save(); closeModal(); UI.month = ym(rec.date); render();
      toast(t ? 'Transaction updated' : 'Transaction added');
    };
    if (!isNew) root.querySelector('#tDel').onclick = () => {
      S.txns = S.txns.filter(x => x.id !== t.id);
      save(); closeModal(); render(); toast('Deleted');
    };
  });
}

/* ------------------------------------------------------------ record forms */

function recordForm(kind, id) {
  const conf = {
    member: {
      title: 'Household member', list: 'members',
      fields: [['name', 'Name', 'text'], ['role', 'Role', 'text'], ['annualIncome', 'Annual income (gross)', 'number']],
      blank: { name: '', role: 'Adult', annualIncome: 0 }
    },
    account: {
      title: 'Account or source', list: 'accounts',
      fields: [['name', 'Account name', 'text'],
        ['type', 'Type', 'select', [['checking', 'Checking'], ['savings', 'Savings'], ['credit', 'Credit card'],
          ['wallet', 'Wallet / transfer app'], ['cash', 'Cash'], ['other', 'Other']]],
        ['member', 'Belongs to', 'member']],
      blank: { name: '', type: 'checking', member: '' }
    },
    asset: {
      title: 'Asset account', list: 'assets',
      fields: [['name', 'Name', 'text'],
        ['type', 'Type', 'select', [['cash', 'Cash / savings'], ['retirement', 'Retirement (401k, IRA)'],
          ['brokerage', 'Taxable brokerage'], ['property', 'Property'], ['other', 'Other']]],
        ['value', 'Current value', 'number']],
      blank: { name: '', type: 'cash', value: 0 }
    },
    debt: {
      title: 'Debt', list: 'debts',
      fields: [['name', 'Name', 'text'], ['balance', 'Balance owed', 'number'],
        ['apr', 'Interest rate (APR %)', 'number'], ['minPayment', 'Minimum monthly payment', 'number'],
        ['member', 'Belongs to', 'member']],
      blank: { name: '', balance: 0, apr: 0, minPayment: 0, member: '' }
    },
    goal: {
      title: 'Savings goal', list: 'goals',
      fields: [['name', 'Goal', 'text'], ['target', 'Target amount', 'number'],
        ['saved', 'Saved so far', 'number'], ['date', 'Target month (YYYY-MM)', 'text']],
      blank: { name: '', target: 0, saved: 0, date: '' }
    },
    rec: {
      title: 'Recurring charge', list: 'recurring',
      fields: [['name', 'Name', 'text'], ['amount', 'Amount per month', 'number'],
        ['cat', 'Category', 'cat'], ['day', 'Day of month', 'number'], ['member', 'Who', 'member']],
      blank: { name: '', amount: 0, cat: 'subs', day: 1, member: '', active: true }
    }
  }[kind];

  const rec = id ? S[conf.list].find(x => x.id === id) : null;
  const val = rec || conf.blank;
  const body = conf.fields.map(([k, label, type, opts]) => {
    let input;
    if (type === 'select') input = `<select id="f_${k}">${opts.map(([v, n]) =>
      `<option value="${v}"${val[k] === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    else if (type === 'member') input = `<select id="f_${k}">${memberOptions(val[k], 'Shared / none')}</select>`;
    else if (type === 'cat') input = `<select id="f_${k}">${catOptions(val[k])}</select>`;
    else input = `<input type="${type}" id="f_${k}" value="${esc(val[k] == null ? '' : val[k])}"${type === 'number' ? ' step="0.01"' : ''}>`;
    return `<label class="f"><span>${esc(label)}</span>${input}</label>`;
  }).join('');

  openModal((rec ? 'Edit ' : 'Add ') + conf.title.toLowerCase(), body,
    `${rec ? '<button class="btn danger" id="rDel">Delete</button>' : ''}
     <button class="btn" data-close>Cancel</button>
     <button class="btn primary" id="rSave">Save</button>`,
  root => {
    root.querySelector('#rSave').onclick = () => {
      const o = rec || { id: uid(), ...conf.blank };
      for (const [k, , type] of conf.fields) {
        const el = root.querySelector('#f_' + k);
        o[k] = type === 'number' ? (parseFloat(el.value) || 0) : el.value;
      }
      if (!String(o.name).trim()) return toast('Give it a name.');
      if (!rec) S[conf.list].push(o);
      save(); closeModal(); render(); toast('Saved');
    };
    if (rec) root.querySelector('#rDel').onclick = () => {
      S[conf.list] = S[conf.list].filter(x => x.id !== rec.id);
      save(); closeModal(); render(); toast('Deleted');
    };
  });
}

/* ----------------------------------------------------------- card editing */

const REWARD_CATS = ['*', 'groceries', 'dining', 'transport', 'travel', 'shopping',
  'utilities', 'fun', 'health', 'subs'];

function cardForm(id) {
  const c = id ? (S.cards || []).find(x => x.id === id) : null;
  const v = c || {
    name: '', issuer: '', member: (S.members[0] || {}).id || '', account: '',
    limit: '', balance: '', statementBalance: '', apr: '', minPayment: '',
    statementDay: 1, dueDay: 21, openedDate: '', annualFee: 0,
    rewards: [{ cat: '*', rate: 1 }], autopay: 'none', paysInFull: true, active: true
  };
  const rw = v.rewards && v.rewards.length ? v.rewards : [{ cat: '*', rate: 1 }];

  openModal(c ? 'Edit card' : 'Add a credit card', `
    <div class="row">
      <label class="f" style="flex:2 1 200px"><span>Card name</span>
        <input type="text" id="c_name" value="${esc(v.name)}" placeholder="e.g. Chase Freedom Visa"></label>
      <label class="f"><span>Who holds it</span><select id="c_member">${memberOptions(v.member, 'Shared / none')}</select></label>
    </div>
    <div class="row">
      <label class="f"><span>Credit limit</span>
        <input type="number" id="c_limit" step="1" value="${esc(v.limit)}" placeholder="0"></label>
      <label class="f"><span>Balance today</span>
        <input type="number" id="c_balance" step="0.01" value="${esc(v.balance)}" placeholder="0"></label>
      <label class="f"><span>Last statement balance</span>
        <input type="number" id="c_stmt" step="0.01" value="${esc(v.statementBalance)}" placeholder="same as balance"></label>
    </div>
    <div class="sub" style="margin:-4px 0 12px">The statement balance is what the issuer reports to the credit
      bureaus. Leave it blank to use today's balance.</div>
    <div class="row">
      <label class="f"><span>APR %</span><input type="number" id="c_apr" step="0.1" value="${esc(v.apr)}"></label>
      <label class="f"><span>Minimum payment</span><input type="number" id="c_min" step="1" value="${esc(v.minPayment)}"></label>
      <label class="f"><span>Annual fee</span><input type="number" id="c_fee" step="1" value="${esc(v.annualFee)}"></label>
    </div>
    <div class="row">
      <label class="f"><span>Statement closes on day</span>
        <input type="number" id="c_close" min="1" max="28" value="${esc(v.statementDay)}"></label>
      <label class="f"><span>Payment due on day</span>
        <input type="number" id="c_due" min="1" max="28" value="${esc(v.dueDay)}"></label>
      <label class="f"><span>Opened (YYYY-MM)</span>
        <input type="text" id="c_opened" value="${esc(v.openedDate)}" placeholder="2019-06"></label>
    </div>
    <div class="row">
      <label class="f"><span>Autopay</span><select id="c_autopay">
        ${Object.entries(AUTOPAY_LABEL).map(([k, l]) =>
          `<option value="${k}"${(v.autopay || 'none') === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}
      </select></label>
      <label class="f"><span>Linked account (for rewards routing)</span>
        <select id="c_account">${accountOptions(v.account, 'Not linked')}</select></label>
    </div>
    <label class="f"><span style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="c_full" ${v.paysInFull !== false ? 'checked' : ''} style="width:auto">
      Paid in full every month (no interest charged)</span></label>

    <h4 style="font-size:13px;margin:16px 0 6px">Reward rates</h4>
    <div class="sub" style="margin-bottom:8px">Use <b>*</b> for the everything-else rate.</div>
    <div id="c_rewards">
      ${rw.map((r, i) => rewardRow(r, i)).join('')}
    </div>
    <button class="btn sm" id="c_addRw" type="button">+ Add a category rate</button>
  `, `${c ? '<button class="btn danger" id="c_del">Delete</button>' : ''}
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="c_save">Save</button>`,
  root => {
    const box = root.querySelector('#c_rewards');
    root.querySelector('#c_addRw').onclick = () => {
      box.insertAdjacentHTML('beforeend', rewardRow({ cat: 'groceries', rate: 2 }, box.children.length));
      bindRewardRemove(box);
    };
    bindRewardRemove(box);

    root.querySelector('#c_save').onclick = () => {
      const name = root.querySelector('#c_name').value.trim();
      if (!name) return toast('Give the card a name.');
      const limit = parseFloat(root.querySelector('#c_limit').value) || 0;
      if (limit <= 0) return toast('A credit limit is needed - utilisation is meaningless without it.');
      const stmtRaw = root.querySelector('#c_stmt').value.trim();
      const o = c || { id: uid(), active: true };
      Object.assign(o, {
        name, member: root.querySelector('#c_member').value,
        account: root.querySelector('#c_account').value,
        limit,
        balance: parseFloat(root.querySelector('#c_balance').value) || 0,
        statementBalance: stmtRaw === '' ? null : (parseFloat(stmtRaw) || 0),
        apr: parseFloat(root.querySelector('#c_apr').value) || 0,
        minPayment: parseFloat(root.querySelector('#c_min').value) || 0,
        annualFee: parseFloat(root.querySelector('#c_fee').value) || 0,
        statementDay: clamp(parseInt(root.querySelector('#c_close').value, 10) || 1, 1, 28),
        dueDay: clamp(parseInt(root.querySelector('#c_due').value, 10) || 21, 1, 28),
        openedDate: root.querySelector('#c_opened').value.trim(),
        autopay: root.querySelector('#c_autopay').value,
        paysInFull: root.querySelector('#c_full').checked,
        rewards: [...box.querySelectorAll('[data-rw]')].map(r => ({
          cat: r.querySelector('.rwCat').value,
          rate: parseFloat(r.querySelector('.rwRate').value) || 0
        })).filter(r => r.cat)
      });
      if (!c) S.cards.push(o);
      snapshotUtilisation();
      save(); closeModal(); render(); toast('Card saved');
    };
    if (c) root.querySelector('#c_del').onclick = () => {
      if (!confirm(`Remove ${c.name} from the dashboard? This does not close the account with the issuer.`)) return;
      S.cards = S.cards.filter(x => x.id !== c.id);
      save(); closeModal(); render(); toast('Card removed');
    };
  }, true);
}

function rewardRow(r, i) {
  return `<div class="row" data-rw style="margin-bottom:8px;align-items:center">
    <label class="f" style="margin:0"><span${i ? ' class="hide"' : ''}>Category</span>
      <select class="rwCat">${REWARD_CATS.map(k =>
        `<option value="${k}"${k === r.cat ? ' selected' : ''}>${k === '*' ? 'Everything else' : esc(catName(k))}</option>`).join('')}</select></label>
    <label class="f" style="margin:0;flex:0 1 110px"><span${i ? ' class="hide"' : ''}>Rate %</span>
      <input type="number" class="rwRate" step="0.1" value="${esc(r.rate)}"></label>
    <div style="flex:0 0 auto"><button class="btn sm ghost" type="button" data-rwdel>&times;</button></div>
  </div>`;
}
function bindRewardRemove(box) {
  box.querySelectorAll('[data-rwdel]').forEach(b => b.onclick = () => {
    if (box.children.length > 1) b.closest('[data-rw]').remove();
  });
}

/* --------------------------------------------------------- payment logging */

function logPaymentForm(cardId) {
  const cards = activeCards();
  if (!cards.length) return toast('Add a card first.');
  openModal('Log a card payment', `
    <div class="row">
      <label class="f"><span>Card</span><select id="p_card">
        ${cards.map(c => `<option value="${c.id}"${c.id === cardId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select></label>
      <label class="f"><span>Date paid</span><input type="date" id="p_date" value="${todayISO()}"></label>
      <label class="f"><span>Amount</span><input type="number" id="p_amt" step="0.01" placeholder="0.00"></label>
    </div>
    <label class="f"><span style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="p_ontime" checked style="width:auto"> Paid on or before the due date</span></label>
    <label class="f"><span style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="p_full" checked style="width:auto"> Paid the full statement balance</span></label>
    <label class="f"><span style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="p_apply" checked style="width:auto">
      Also reduce the card's current balance by this amount</span></label>
    <div class="sub">Payment history is the heaviest scoring factor. Logging payments is what lets this
      dashboard include it rather than leaving it blank.</div>
  `, `<button class="btn" data-close>Cancel</button><button class="btn primary" id="p_save">Log payment</button>`,
  root => {
    root.querySelector('#p_save').onclick = () => {
      const cid = root.querySelector('#p_card').value;
      const amt = parseFloat(root.querySelector('#p_amt').value) || 0;
      if (amt <= 0) return toast('Enter the amount paid.');
      S.cardPayments.push({
        id: uid(), cardId: cid, date: root.querySelector('#p_date').value || todayISO(),
        amount: amt, onTime: root.querySelector('#p_ontime').checked,
        paidInFull: root.querySelector('#p_full').checked
      });
      if (root.querySelector('#p_apply').checked) {
        const card = S.cards.find(x => x.id === cid);
        if (card) card.balance = Math.max(0, (+card.balance || 0) - amt);
      }
      snapshotUtilisation();
      save(); closeModal(); render(); toast('Payment logged');
    };
  });
}

function paymentLogView() {
  const pays = [...(S.cardPayments || [])].sort((a, b) => b.date.localeCompare(a.date));
  const r = paymentRecord();
  const nameOf = id => ((S.cards || []).find(c => c.id === id) || {}).name || 'Card';
  openModal('Payment history', `
    <div class="grid g-3" style="margin-bottom:14px">
      <div class="kv"><span>On-time streak</span><b>${r.streak}</b></div>
      <div class="kv"><span>Late payments logged</span><b class="${r.lates.length ? 'neg' : ''}">${r.lates.length}</b></div>
      <div class="kv"><span>Total logged</span><b>${r.total}</b></div>
    </div>
    ${pays.length ? `<div class="scroller"><table>
      <thead><tr><th>Date</th><th>Card</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead>
      <tbody>${pays.map(p => `<tr>
        <td class="mono">${esc(p.date)}</td><td>${esc(nameOf(p.cardId))}</td>
        <td class="num">${money2(p.amount)}</td>
        <td>${p.onTime === false
          ? '<span class="tag" style="background:color-mix(in srgb,var(--crit) 16%,transparent);color:var(--crit-ink)">Late</span>'
          : '<span class="tag done">On time</span>'}
          ${p.paidInFull ? '<span class="pill tiny">in full</span>' : ''}</td>
        <td><button class="btn sm ghost" data-act="del-payment" data-id="${p.id}">&times;</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : '<div class="sub">No payments logged yet.</div>'}
  `, `<button class="btn" data-close>Close</button>
      <button class="btn primary" data-act="log-payment" data-id="">+ Log a payment</button>`, null, true);
}

/* ------------------------------------------------------- credit profile UI */

function inquiriesForm() {
  const p = S.creditProfile || (S.creditProfile = { inquiries: [] });
  const list = p.inquiries || [];
  openModal('Hard inquiries', `
    <p class="sub" style="margin-top:0">A hard inquiry is recorded when a lender checks your credit for a new
    application. Each typically costs a few points, stops counting after 12 months, and drops off the report
    at 24. Checking your own score is a soft pull and does not count.</p>
    ${list.length ? `<table><tbody>${list.map((q, i) => `<tr>
      <td class="mono">${esc(q.date)}</td><td>${esc(q.label || 'Inquiry')}</td>
      <td class="sub">${esc(yearsText(monthsSince(q.date)))} ago
        ${(monthsSince(q.date) || 0) >= 12 ? '<span class="pill tiny">no longer scored</span>' : ''}</td>
      <td><button class="btn sm ghost" data-act="del-inquiry" data-i="${i}">&times;</button></td>
    </tr>`).join('')}</tbody></table>` : '<div class="sub">None recorded.</div>'}
    <div class="row" style="margin-top:14px">
      <label class="f"><span>Date</span><input type="date" id="q_date" value="${todayISO()}"></label>
      <label class="f" style="flex:2 1 200px"><span>What for</span>
        <input type="text" id="q_label" placeholder="e.g. car loan application"></label>
    </div>
  `, `<button class="btn" data-close>Close</button><button class="btn primary" id="q_add">Add inquiry</button>`,
  root => {
    root.querySelector('#q_add').onclick = () => {
      p.inquiries = p.inquiries || [];
      p.inquiries.push({ date: root.querySelector('#q_date').value || todayISO(),
                         label: root.querySelector('#q_label').value.trim() || 'Inquiry' });
      p.inquiries.sort((a, b) => b.date.localeCompare(a.date));
      save(); closeModal(); render(); toast('Inquiry recorded');
    };
  });
}

function reportedScoreForm() {
  const p = S.creditProfile || (S.creditProfile = {});
  openModal('Record your real credit score', `
    <p class="sub" style="margin-top:0">Most card issuers show a free FICO or VantageScore in their app, and your
    statutory credit reports are free at annualcreditreport.com. Recording the real figure here lets you see it
    beside the model. It does not change the model.</p>
    <div class="row">
      <label class="f"><span>Score</span>
        <input type="number" id="s_val" min="300" max="850" value="${esc(p.reportedScore || '')}"></label>
      <label class="f"><span>As of</span>
        <input type="date" id="s_date" value="${esc(p.reportedScoreDate || todayISO())}"></label>
    </div>
  `, `<button class="btn danger" id="s_clear">Clear</button>
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="s_save">Save</button>`,
  root => {
    root.querySelector('#s_save').onclick = () => {
      const v = parseInt(root.querySelector('#s_val').value, 10);
      p.reportedScore = (v >= 300 && v <= 850) ? v : null;
      p.reportedScoreDate = root.querySelector('#s_date').value;
      save(); closeModal(); render(); toast('Saved');
    };
    root.querySelector('#s_clear').onclick = () => {
      p.reportedScore = null; p.reportedScoreDate = '';
      save(); closeModal(); render();
    };
  });
}

/* --------------------------------------------------------------- budget UI */

function budgetForm(cat) {
  openModal('Set a category budget', `
    <label class="f"><span>Category</span><select id="bCat">${catOptions(cat || 'groceries')}</select></label>
    <label class="f"><span>Monthly budget</span><input type="number" id="bAmt" step="1" placeholder="0"></label>
    <div class="sub" id="bHint"></div>`,
    `<button class="btn danger" id="bClear">Remove budget</button>
     <button class="btn" data-close>Cancel</button><button class="btn primary" id="bSave">Save</button>`,
  root => {
    const sel = root.querySelector('#bCat'), amt = root.querySelector('#bAmt'), hint = root.querySelector('#bHint');
    const sync = () => {
      const c = sel.value;
      amt.value = S.budgets[c] || '';
      const hist = activeMonths().slice(-6).map(m => monthStats(m, 'all').byCat[c] || 0).filter(x => x > 0);
      hint.textContent = hist.length
        ? `You have averaged ${money(sum(hist) / hist.length)} a month here over ${hist.length} month(s); the median is ${money(median(hist))}.`
        : 'No history in this category yet.';
    };
    sel.onchange = sync; sync();
    root.querySelector('#bSave').onclick = () => {
      const v = parseFloat(amt.value);
      if (!isFinite(v) || v <= 0) delete S.budgets[sel.value]; else S.budgets[sel.value] = v;
      save(); closeModal(); render(); toast('Budget saved');
    };
    root.querySelector('#bClear').onclick = () => {
      delete S.budgets[sel.value]; save(); closeModal(); render(); toast('Budget removed');
    };
  });
}

function autoBudget() {
  const months = activeMonths().slice(-6);
  if (months.length < 2) return toast('Need at least two months of data.');
  const proposals = [];
  for (const c of CATS) {
    if (c.bucket === 'income' || c.bucket === 'save') continue;
    const hist = months.map(m => monthStats(m, 'all').byCat[c.id] || 0).filter(x => x > 0);
    if (hist.length < 2) continue;
    const med = median(hist);
    if (med < 20) continue;
    // needs track the median; wants get a deliberate 10% trim to create a surplus
    proposals.push({ cat: c.id, value: Math.round((c.bucket === 'need' ? med * 1.05 : med * 0.9) / 5) * 5, med, bucket: c.bucket });
  }
  if (!proposals.length) return toast('Not enough category history yet.');
  openModal('Suggested budgets', `
    <p class="sub" style="margin-top:0">Based on your median spend over the last ${months.length} months.
    Essentials are set slightly above the median for headroom; discretionary categories are set 10% below it,
    which is what creates a surplus without requiring a lifestyle change.</p>
    <table><thead><tr><th>Category</th><th class="num">Your median</th><th class="num">Suggested</th></tr></thead>
    <tbody>${proposals.map(p => `<tr><td>${esc(catName(p.cat))}
      <span class="pill tiny">${p.bucket === 'need' ? 'Need' : 'Want'}</span></td>
      <td class="num">${money(p.med)}</td><td class="num"><b>${money(p.value)}</b></td></tr>`).join('')}
    </tbody></table>
    <div class="kv" style="margin-top:12px"><span>Total suggested monthly budget</span>
      <b>${money(sum(proposals.map(p => p.value)))}</b></div>`,
    `<button class="btn" data-close>Cancel</button>
     <button class="btn primary" id="abApply">Apply these budgets</button>`,
  root => {
    root.querySelector('#abApply').onclick = () => {
      for (const p of proposals) S.budgets[p.cat] = p.value;
      save(); closeModal(); render(); toast('Budgets applied');
    };
  }, true);
}

/* ------------------------------------------------------------ uncategorised */

function fixUncategorised() {
  const items = S.txns.filter(t => t.cat === 'misc' && ym(t.date) === UI.month);
  if (!items.length) return toast('Nothing uncategorised this month.');
  openModal('Review uncategorised transactions', `
    <p class="sub" style="margin-top:0">Assign a category to each. Tick "make a rule" to categorise the same
    merchant automatically from now on.</p>
    <div class="scroller"><table><tbody>
    ${items.map(t => `<tr data-uid="${t.id}">
      <td><b>${esc(t.desc)}</b><div class="sub">${esc(t.date)} · ${money2(t.amount)}</div></td>
      <td style="width:190px"><select class="uCat">${catOptions('misc')}</select></td>
      <td style="width:80px"><label class="sub" style="display:flex;gap:5px;align-items:center">
        <input type="checkbox" class="uRule" style="width:auto"> rule</label></td>
    </tr>`).join('')}
    </tbody></table></div>`,
    `<button class="btn" data-close>Cancel</button><button class="btn primary" id="uSave">Apply</button>`,
  root => {
    root.querySelector('#uSave').onclick = () => {
      let n = 0, r = 0;
      root.querySelectorAll('tr[data-uid]').forEach(tr => {
        const t = S.txns.find(x => x.id === tr.dataset.uid);
        const cat = tr.querySelector('.uCat').value;
        if (!t || cat === 'misc') return;
        t.cat = cat; n++;
        if (tr.querySelector('.uRule').checked) {
          const key = normDesc(t.desc).split(' ').slice(0, 2).join(' ');
          if (key && !S.rules.some(x => x.match === key)) { S.rules.push({ match: key, cat }); r++; }
        }
      });
      save(); closeModal(); render();
      toast(`${n} categorised${r ? `, ${r} rule(s) added` : ''}`);
    };
  }, true);
}

/* ================================================================= IMPORT === */

function startImport(text, sourceName) {
  const rows = parseCSV(text);
  if (rows.length < 2) { toast('Could not read any rows from that file.'); return; }
  const headers = rows[0].map(h => String(h).trim());
  const key = headers.join('|').toLowerCase();
  const saved = S.profiles[key];
  const map = saved ? { ...saved } : guessMapping(headers);
  // sniff day/month order from the actual column unless a saved profile fixed it
  if (!saved && map.date >= 0) {
    map.dateOrder = detectDateOrder(rows.slice(1, 200).map(r => r[map.date]));
  }
  IMP = {
    rows: rows.slice(1), headers,
    map,
    source: sourceName || 'Imported file',
    headerKey: key
  };
  importModal();
}

function importPreview() {
  const { rows, map } = IMP;
  const out = [];
  for (const r of rows) {
    const date = parseDate(r[map.date], map.dateOrder || 'mdy');
    if (!date) continue;
    let amt = null;
    if (map.mode === 'split') {
      const d = parseAmount(r[map.debit]), c = parseAmount(r[map.credit]);
      if (d) amt = -Math.abs(d); else if (c) amt = Math.abs(c); else continue;
    } else {
      amt = parseAmount(r[map.amount]);
      if (amt == null) continue;
      if (map.flip) amt = -amt;
    }
    if (!amt) continue;
    const desc = String(r[map.desc] == null ? '' : r[map.desc]).trim() || 'Transaction';
    const t = { date, desc, amount: amt };
    t.cat = amt > 0 ? (autoCat(desc) === 'misc' ? 'income' : autoCat(desc)) : autoCat(desc);
    if (amt > 0 && bucketOf(t.cat) !== 'income') t.cat = 'income';
    t.hash = txHash(t);
    out.push(t);
  }
  const dates = out.map(t => t.date).sort();
  const span = dates.length ? [dates[0], dates[dates.length - 1]] : null;
  const spanMonths = span
    ? (+span[1].slice(0, 4) * 12 + +span[1].slice(5, 7)) - (+span[0].slice(0, 4) * 12 + +span[0].slice(5, 7)) + 1 : 0;
  const existing = new Set(S.txns.map(t => t.hash || txHash(t)));
  const seen = new Set();
  const fresh = [], dupes = [];
  for (const t of out) {
    if (existing.has(t.hash) || seen.has(t.hash)) dupes.push(t);
    else { seen.add(t.hash); fresh.push(t); }
  }
  return { fresh, dupes, total: out.length, span, spanMonths };
}

function importModal() {
  const { headers, map } = IMP;
  const opts = (sel) => headers.map((h, i) =>
    `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(h || 'column ' + (i + 1))}</option>`).join('');
  const p = importPreview();

  openModal('Import transactions', `
    <div class="row">
      <label class="f"><span>Date column</span><select id="mDate">${opts(map.date)}</select></label>
      <label class="f"><span>Description column</span><select id="mDesc">${opts(map.desc)}</select></label>
      <label class="f"><span>Amount layout</span><select id="mMode">
        <option value="single"${map.mode === 'single' ? ' selected' : ''}>One amount column</option>
        <option value="split"${map.mode === 'split' ? ' selected' : ''}>Separate debit / credit columns</option>
      </select></label>
      <label class="f"><span>Date order</span><select id="mOrder">
        <option value="mdy"${(map.dateOrder || 'mdy') === 'mdy' ? ' selected' : ''}>Month first (09/14/2026)</option>
        <option value="dmy"${map.dateOrder === 'dmy' ? ' selected' : ''}>Day first (14/09/2026)</option>
        <option value="iso"${map.dateOrder === 'iso' ? ' selected' : ''}>Year first (2026-09-14)</option>
      </select></label>
    </div>
    <div class="row" id="mAmtRow">
      ${map.mode === 'single'
        ? `<label class="f"><span>Amount column</span><select id="mAmt">${opts(map.amount)}</select></label>
           <label class="f" style="flex:0 0 auto"><span>Sign</span>
             <select id="mFlip"><option value="0"${!map.flip ? ' selected' : ''}>Expenses are negative</option>
             <option value="1"${map.flip ? ' selected' : ''}>Expenses are positive (flip)</option></select></label>`
        : `<label class="f"><span>Debit / money out</span><select id="mDeb">${opts(map.debit)}</select></label>
           <label class="f"><span>Credit / money in</span><select id="mCre">${opts(map.credit)}</select></label>`}
    </div>
    <div class="row">
      <label class="f"><span>Assign to account</span>
        <select id="mAcc">${accountOptions(IMP.account, 'None')}</select></label>
      <label class="f"><span>Assign to person</span>
        <select id="mMem">${memberOptions(IMP.member, 'Unassigned')}</select></label>
      <label class="f"><span>Remember this layout as</span>
        <input type="text" id="mProf" value="${esc(IMP.source)}" placeholder="e.g. Chase checking"></label>
    </div>

    ${p.span ? `<div class="disclaim" style="border-left-color:${p.spanMonths > 3 ? 'var(--warn)' : 'var(--s1)'};margin-top:14px">
      Dates read as <b>${esc(p.span[0])}</b> to <b>${esc(p.span[1])}</b>${p.spanMonths > 3
        ? `. That spans ${p.spanMonths} months. If this file covers a single statement period,
            the date order above is probably wrong; switch it and the preview will update.`
        : '.'}
    </div>` : ''}
    <div class="kv" style="margin-top:6px"><span>Rows read</span><b>${p.total}</b></div>
    <div class="kv"><span>New transactions to add</span><b style="color:var(--good-ink)">${p.fresh.length}</b></div>
    <div class="kv"><span>Duplicates skipped</span><b>${p.dupes.length}</b></div>

    <h4 style="margin:16px 0 8px;font-size:13px">Preview · first 12 rows</h4>
    ${p.fresh.length ? `<div class="tbl-wrap" style="max-height:260px;overflow:auto"><table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr></thead>
      <tbody>${p.fresh.slice(0, 12).map(t => `<tr><td class="mono">${esc(t.date)}</td>
        <td>${esc(t.desc.slice(0, 42))}</td><td class="sub">${esc(catName(t.cat))}</td>
        <td class="num ${t.amount < 0 ? 'neg' : 'pos'}">${money2(t.amount)}</td></tr>`).join('')}
      </tbody></table></div>`
      : `<div class="disclaim">No usable rows with this mapping. Check that the date and amount
         columns are pointing at the right headers.</div>`}
  `, `<button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="impGo"${p.fresh.length ? '' : ' disabled'}>Add ${p.fresh.length} transactions</button>`,
  root => {
    const reread = () => {
      IMP.map.date = +root.querySelector('#mDate').value;
      IMP.map.desc = +root.querySelector('#mDesc').value;
      IMP.map.mode = root.querySelector('#mMode').value;
      IMP.map.dateOrder = root.querySelector('#mOrder').value;
      if (IMP.map.mode === 'single') {
        const a = root.querySelector('#mAmt'), f = root.querySelector('#mFlip');
        if (a) IMP.map.amount = +a.value;
        if (f) IMP.map.flip = f.value === '1';
      } else {
        const d = root.querySelector('#mDeb'), c = root.querySelector('#mCre');
        if (d) IMP.map.debit = +d.value;
        if (c) IMP.map.credit = +c.value;
      }
      IMP.account = root.querySelector('#mAcc').value;
      IMP.member = root.querySelector('#mMem').value;
      IMP.source = root.querySelector('#mProf').value;
      importModal();
    };
    root.querySelectorAll('#mDate,#mDesc,#mMode,#mOrder,#mAmt,#mFlip,#mDeb,#mCre').forEach(el => el.onchange = reread);
    root.querySelector('#mAcc').onchange = e => IMP.account = e.target.value;
    root.querySelector('#mMem').onchange = e => IMP.member = e.target.value;
    root.querySelector('#mProf').oninput = e => IMP.source = e.target.value;

    root.querySelector('#impGo').onclick = () => {
      const pv = importPreview();
      for (const t of pv.fresh) {
        S.txns.push({ id: uid(), ...t, member: IMP.member || null, account: IMP.account || null, note: '' });
      }
      if (IMP.source && IMP.source.trim()) S.profiles[IMP.headerKey] = { ...IMP.map };
      save(); closeModal();
      const months = [...new Set(pv.fresh.map(t => ym(t.date)))].sort();
      if (months.length) UI.month = months[months.length - 1];
      UI.tab = 'overview'; render();
      toast(`${pv.fresh.length} added, ${pv.dupes.length} duplicate(s) skipped`);
    };
  }, true);
}

/* ============================================================== FILE I/O === */

function download(name, text, mime) {
  const b = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 400);
}
function exportJSON() {
  S.lastBackup = todayISO();
  save();
  download(`household-backup-${todayISO()}.json`, JSON.stringify(S, null, 2), 'application/json');
  const w = $('#backupWarn');
  if (w) w.remove();
  toast('Backup downloaded');
}

/**
 * A quiet nudge once there is enough data to be worth losing. Browser storage
 * is the only copy, so this is the difference between an inconvenience and
 * starting over.
 */
function maybeNudgeBackup() {
  if ($('#backupWarn')) return;
  if (S.txns.length < 25) return;
  const days = S.lastBackup
    ? Math.floor((Date.parse(todayISO()) - Date.parse(S.lastBackup)) / 86400000) : null;
  if (days != null && days < 30) return;
  $('#view').insertAdjacentHTML('beforebegin', `<div id="backupWarn" class="disclaim noprint"
    style="margin:16px 0 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="flex:1 1 260px">
      <b>${days == null ? 'You have never backed this up.' : `Last backup was ${days} days ago.`}</b>
      ${S.txns.length} transactions live only in this browser${platformInfo().iOS
        ? ' on this device, and iOS clears website storage from time to time.'
        : ' on this device.'}
    </span>
    <span style="display:flex;gap:8px">
      <button class="btn sm primary" data-act="export-json">Download backup</button>
      <button class="btn sm ghost" data-act="dismiss-backup">Later</button>
    </span>
  </div>`);
}
function exportCSV() {
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['Date', 'Description', 'Amount', 'Category', 'Member', 'Account', 'Note'];
  const rows = [...S.txns].sort((a, b) => a.date.localeCompare(b.date)).map(t =>
    [t.date, t.desc, t.amount, catName(t.cat), memberName(t.member), accountName(t.account), t.note || ''].map(q).join(','));
  download(`transactions-${todayISO()}.csv`, [head.map(q).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  toast('CSV downloaded');
}

/* ================================================================ EVENTS === */

function wireView() {
  const view = $('#view');

  // the browser only offers installation when it decides the app qualifies,
  // so the button stays hidden until that event has fired
  const inst = view.querySelector('#btnInstall');
  if (inst) {
    if (deferredInstall) inst.classList.remove('hide');
    inst.onclick = async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      const { outcome } = await deferredInstall.userChoice;
      if (outcome === 'accepted') toast('Installed - look for it alongside your other apps');
      deferredInstall = null;
      inst.classList.add('hide');
    };
  }

  // inline category change on the Spending tab
  view.querySelectorAll('.tcat').forEach(sel => {
    sel.onchange = () => {
      const t = S.txns.find(x => x.id === sel.dataset.id);
      if (!t) return;
      const old = t.cat;
      t.cat = sel.value; save();
      const key = normDesc(t.desc).split(' ').slice(0, 2).join(' ');
      if (key && old === 'misc' && !S.rules.some(r => r.match === key)) {
        toast(`Categorised. Add a rule for "${key}"? Use Settings → rules.`);
      }
      render();
    };
  });

  // filters
  const fq = view.querySelector('#fq');
  if (fq) {
    let t0;
    fq.oninput = () => { clearTimeout(t0); t0 = setTimeout(() => { UI.txFilter.q = fq.value; render(); $('#fq') && $('#fq').focus(); }, 260); };
  }
  const fcat = view.querySelector('#fcat');
  if (fcat) fcat.onchange = () => { UI.txFilter.cat = fcat.value; render(); };
  const facc = view.querySelector('#facc');
  if (facc) facc.onchange = () => { UI.txFilter.account = facc.value; render(); };
  view.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    if (UI.txFilter.sort === k) UI.txFilter.dir *= -1; else { UI.txFilter.sort = k; UI.txFilter.dir = -1; }
    render();
  });

  // sliders
  const cut = view.querySelector('#cutPct');
  if (cut) cut.oninput = () => { UI.cutPct = +cut.value; render(); const c = $('#cutPct'); if (c) c.focus(); };
  const ed = view.querySelector('#extraDebt');
  if (ed) ed.oninput = () => { UI.extraDebt = +ed.value; render(); const e2 = $('#extraDebt'); if (e2) e2.focus(); };
  const up = view.querySelector('#utilPay');
  if (up) up.oninput = () => { UI.utilPay = +up.value; render(); const u2 = $('#utilPay'); if (u2) u2.focus(); };

  // import drop zone
  const dz = view.querySelector('#dz'), fileIn = view.querySelector('#fileIn');
  if (dz && fileIn) {
    dz.onclick = () => fileIn.click();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => {
      e.preventDefault(); dz.classList.remove('over');
      const f = e.dataTransfer.files[0]; if (f) readFile(f);
    };
    fileIn.onchange = () => { if (fileIn.files[0]) readFile(fileIn.files[0]); };
  }
  const jsonIn = view.querySelector('#jsonIn');
  if (jsonIn) jsonIn.onchange = () => {
    const f = jsonIn.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      // Keep the current data until the restored document has proved it can
      // render. Otherwise a file that passes a shallow check but is corrupt
      // inside replaces good data and then fails to display, losing both.
      const previous = JSON.stringify(S);
      try {
        const d = JSON.parse(r.result);
        if (!d || typeof d !== 'object') throw new Error('not a backup file');
        for (const [k, shouldBeArray] of [['txns', true], ['members', true], ['accounts', true],
          ['cards', true], ['debts', true], ['goals', true], ['assets', true],
          ['recurring', true], ['budgets', false], ['settings', false]]) {
          if (d[k] === undefined) continue;
          const ok = shouldBeArray ? Array.isArray(d[k])
            : (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]));
          if (!ok) throw new Error(`the "${k}" section is damaged`);
        }
        if (!Array.isArray(d.txns)) throw new Error('no transactions in the file');

        S = migrate({ ...blankState(), ...d });
        render();                          // throws here if anything is unusable
        save();
        UI.tab = 'overview';
        render();
        toast(`Backup restored: ${S.txns.length} transactions`);
      } catch (e) {
        S = JSON.parse(previous);          // nothing was saved, so this is intact
        render();
        toast('Not restored: ' + (e && e.message ? e.message : 'unreadable file'));
      }
    };
    r.readAsText(f);
  };
}
/** Routes a dropped file to the CSV mapper or the document reader. */
function readFile(f) {
  const name = (f.name || '').toLowerCase();
  if (/\.(pdf|docx|doc)$/.test(name)) return statementFlow(f);
  const r = new FileReader();
  r.onload = () => {
    const text = String(r.result);
    // a .txt that is really a statement printout has no comma structure
    const looksTabular = /[,;\t|]/.test((text.split('\n')[0] || ''));
    if (looksTabular) startImport(text, f.name.replace(/\.[^.]+$/, ''));
    else statementFlow(f, text);
  };
  r.readAsText(f);
}

/* ============================================== PDF / WORD STATEMENTS ===== */

let STMT = null;   // in-flight document review

/** Reads a PDF or Word statement and opens the review screen. */
async function statementFlow(file, preloadedText) {
  openModal('Reading ' + (file.name || 'document'), `
    <div style="text-align:center;padding:26px 10px">
      <div style="font-size:30px;margin-bottom:10px">&#8987;</div>
      <b>Reading the document</b>
      <div class="sub" style="margin-top:6px">Large PDFs can take a few seconds. This happens entirely
      on your computer.</div>
    </div>`, '');
  await new Promise(r => setTimeout(r, 30));   // let the modal paint first

  let doc;
  try {
    doc = preloadedText != null
      ? { text: preloadedText, kind: 'text', error: null, warnings: [], name: file.name }
      : await extractDocumentText(file);
  } catch (e) {
    doc = { text: '', kind: null, error: 'This file could not be read (' + e.message + ').', warnings: [] };
  }

  if (doc.error && !doc.text) return documentError(doc, file);

  let a;
  try { a = analyseStatement(doc.text, {}); }
  catch (e) {
    return documentError({ ...doc, error: 'The document was read but could not be interpreted (' + e.message + ').' }, file);
  }

  if (!a.txns.length && a.fields.creditLimit == null && a.fields.statementBalance == null) {
    return documentError({
      ...doc,
      error: 'No transactions or account figures could be recognised in this document. ' +
             'It may be a summary page rather than a statement, or laid out in a way this reader ' +
             'cannot follow. A CSV export from the same account will always work.'
    }, file);
  }

  STMT = {
    doc, a, file,
    account: (S.accounts[0] || {}).id || '',
    member: (S.members[0] || {}).id || '',
    cardId: a.kind === 'card' ? guessCard(a) : '',
    applyFields: {},
    flip: false,
    // card payments are internal transfers, so they start excluded
    skip: new Set(a.txns.map((t, i) => t.transfer ? i : -1).filter(i => i >= 0))
  };
  for (const u of proposedCardUpdates(a, S.cards.find(c => c.id === STMT.cardId))) {
    if (!u.same) STMT.applyFields[u.key] = true;
  }
  statementReview();
}

/** Best guess at which stored card a statement belongs to. */
function guessCard(a) {
  const cards = activeCards();
  if (!cards.length) return '';
  const f = a.fields;
  if (f.accountLast4) {
    const byDigits = cards.find(c => (c.name || '').includes(f.accountLast4));
    if (byDigits) return byDigits.id;
  }
  if (f.issuer) {
    const iss = f.issuer.toLowerCase().replace('amex', 'american express');
    const hit = cards.find(c => (c.name + ' ' + (c.issuer || '')).toLowerCase().includes(iss.split(' ')[0]));
    if (hit) return hit.id;
  }
  if (f.creditLimit != null) {
    const hit = cards.find(c => Math.abs((+c.limit || 0) - f.creditLimit) < 1);
    if (hit) return hit.id;
  }
  return '';
}

function documentError(doc, file) {
  const isPdf = (doc.kind === 'pdf') || /\.pdf$/i.test(file.name || '');
  openModal('Could not read ' + (file.name || 'this file'), `
    <div class="disclaim" style="border-left-color:var(--crit);margin-top:0">
      ${esc(doc.error || 'This file could not be read.')}
    </div>
    <h4 style="font-size:13px;margin:18px 0 8px">What usually works instead</h4>
    <ol style="font-size:13px;color:var(--ink-2);padding-left:20px;line-height:1.8;margin:0">
      <li>Sign in to the bank or card website.</li>
      <li>Look for <b>Download</b>, <b>Export</b> or <b>Download transactions</b>.</li>
      <li>Choose <b>CSV</b> as the format.</li>
      <li>Drop that file here instead. CSV always works and is more accurate.</li>
    </ol>
    ${isPdf ? `<p class="sub" style="margin-top:14px">A quick way to tell whether a PDF can be read
      at all: open it and try to select a line of text with your mouse. If nothing highlights, the page
      is a picture and there is no text to extract.</p>` : ''}
    ${doc.text ? `<details style="margin-top:14px"><summary class="sub" style="cursor:pointer">
      Show what was read from the file</summary>
      <pre style="white-space:pre-wrap;font-size:11px;max-height:220px;overflow:auto;
        background:var(--surface-2);padding:10px;border-radius:7px;margin-top:8px">${esc(doc.text.slice(0, 3000))}</pre>
      </details>` : ''}
  `, `<button class="btn primary" data-close>Close</button>`);
}

/** The review screen. Nothing is written until Apply is pressed. */
function statementReview() {
  const { doc, a } = STMT;
  const card = S.cards.find(c => c.id === STMT.cardId);
  const updates = proposedCardUpdates(a, card);
  const rows = a.txns.filter((t, i) => !STMT.skip.has(i));
  const shown = rows.map(t => STMT.flip ? { ...t, amount: -t.amount } : t);
  const existing = new Set(S.txns.map(t => t.hash || txHash(t)));
  const fresh = shown.filter(t => !existing.has(txHash(t)));
  const dupes = shown.length - fresh.length;
  const inflow = sum(shown.filter(t => t.amount > 0).map(t => t.amount));
  const outflow = sum(shown.filter(t => t.amount < 0).map(t => -t.amount));

  const kindLabel = { card: 'Credit card statement', bank: 'Bank statement', unknown: 'Statement' }[a.kind];

  openModal('Review what was found', `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <span class="pill">${esc(doc.name || STMT.file.name)}</span>
      <span class="pill">${esc(kindLabel)}</span>
      ${doc.pages ? `<span class="pill">${doc.pages} page${doc.pages === 1 ? '' : 's'}</span>` : ''}
      ${a.fields.issuer ? `<span class="pill">${esc(a.fields.issuer)}</span>` : ''}
      ${a.fields.accountLast4 ? `<span class="pill">ending ${esc(a.fields.accountLast4)}</span>` : ''}
    </div>

    ${doc.warnings && doc.warnings.includes('legacy-doc') ? `<div class="disclaim">
      <b>Old Word format.</b> Text was pulled out as best it could be, so check the rows below
      carefully. Saving the file as .docx or PDF and importing that gives a cleaner result.</div>` : ''}

    ${a.txns.some(t => t.transfer) ? `<div class="disclaim" style="border-left-color:var(--s1);margin-top:0">
      <b>${a.txns.filter(t => t.transfer).length} payment row(s) to this card have been left out.</b>
      Paying a card moves money between your own accounts, so counting it would look like income and
      would double-count the spending once you import the account that paid it. Include them below if
      you want them anyway.</div>` : ''}

    ${a.txns.length ? `
    <div class="grid g-3" style="gap:10px;margin-bottom:14px">
      <div class="kv"><span>Transactions found</span><b>${a.txns.length}</b></div>
      <div class="kv"><span>Money out</span><b>${money(outflow)}</b></div>
      <div class="kv"><span>Money in</span><b>${money(inflow)}</b></div>
    </div>

    <div class="disclaim" style="border-left-color:${a.usedBalanceColumn ? 'var(--good)' : 'var(--warn)'};margin-top:0">
      ${a.usedBalanceColumn
        ? `<b>Signs verified against the running balance.</b> The document had a balance column and the
           arithmetic checks out, so money in and money out have been worked out rather than guessed.`
        : `<b>Check the direction of these amounts.</b> There was no running balance to verify against,
           so whether each row is money in or money out was inferred from the wording. Use the switch
           below if they are the wrong way round.`}
      ${a.reconciliation ? (a.reconciliation.ok
        ? ` The rows also add up to the change in balance the statement states.`
        : ` Note the rows add up to ${money(a.reconciliation.actual)} but the statement's balance moved
            ${money(a.reconciliation.expected)}, a difference of ${money(Math.abs(a.reconciliation.diff))}.
            Some rows may be missing or duplicated, so compare against the paper statement before applying.`) : ''}
    </div>

    <div class="row" style="margin:14px 0 6px">
      <label class="f"><span>Assign to account</span>
        <select id="stAcc">${accountOptions(STMT.account, 'None')}</select></label>
      <label class="f"><span>Assign to person</span>
        <select id="stMem">${memberOptions(STMT.member, 'Unassigned')}</select></label>
      <div style="flex:0 0 auto">
        <button class="btn" id="stFlip">${STMT.flip ? 'Undo swap' : 'Swap money in / out'}</button>
      </div>
    </div>

    <div class="kv"><span>New transactions to add</span>
      <b style="color:var(--good-ink)">${fresh.length}</b></div>
    <div class="kv"><span>Already in your ledger, will be skipped</span><b>${dupes}</b></div>

    <h4 style="font-size:13px;margin:16px 0 8px">Every row found${a.span
      ? `, ${esc(a.span[0])} to ${esc(a.span[1])}` : ''}</h4>
    <div class="tbl-wrap" style="max-height:300px;overflow:auto">
      <table><thead><tr><th>Date</th><th>Description</th><th>Category</th>
        <th class="num">Amount</th><th></th></tr></thead><tbody>
      ${a.txns.map((t, i) => {
        const amt = STMT.flip ? -t.amount : t.amount;
        const off = STMT.skip.has(i);
        return `<tr style="${off ? 'opacity:.4' : ''}">
          <td class="mono">${esc(t.date)}</td>
          <td>${esc(t.desc.slice(0, 46))}${t.transfer
            ? ' <span class="pill tiny">card payment</span>' : ''}</td>
          <td><select class="stCat" data-i="${i}" style="padding:3px 6px;font-size:12.5px">${catOptions(t.cat)}</select></td>
          <td class="num ${amt < 0 ? 'neg' : 'pos'}">${money2(amt)}</td>
          <td><button class="btn sm ghost" data-stskip="${i}">${off ? 'Include' : 'Drop'}</button></td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>` : `<div class="disclaim" style="margin-top:0">No individual transactions were recognised in
      this document, but the account figures below were. Applying them still updates your card.</div>`}

    ${a.kind === 'card' && updates.length ? `
      <h4 style="font-size:13px;margin:18px 0 8px">Card details found in this statement</h4>
      <label class="f"><span>Apply these to</span>
        <select id="stCard">
          <option value="">Do not update any card</option>
          ${activeCards().map(c => `<option value="${c.id}"${c.id === STMT.cardId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
          <option value="__new">Create a new card from this statement</option>
        </select></label>
      ${STMT.cardId ? `<table><tbody>${updates.map(u => `<tr>
        <td style="width:34px"><input type="checkbox" class="stField" data-k="${u.key}"
          ${STMT.applyFields[u.key] ? 'checked' : ''} ${u.same ? 'disabled' : ''} style="width:auto"></td>
        <td>${esc(u.label)}</td>
        <td class="num">${u.current != null && u.current !== '' && !u.same
          ? `<span class="sub">${esc(String(u.current))}</span> &rarr; ` : ''}<b>${esc(u.fmt(u.value))}</b>
          ${u.same ? '<span class="pill tiny">already set</span>' : ''}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="sub">Pick a card above to see what would change.</div>'}
    ` : ''}

    <details style="margin-top:16px"><summary class="sub" style="cursor:pointer">
      Show the raw text read from the file</summary>
      <pre style="white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto;
        background:var(--surface-2);padding:10px;border-radius:7px;margin-top:8px">${esc((doc.text || '').slice(0, 6000))}</pre>
    </details>
  `, `<button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="stApply">Apply${fresh.length ? ' ' + fresh.length + ' transaction' + (fresh.length === 1 ? '' : 's') : ''}</button>`,
  root => {
    root.querySelector('#stAcc').onchange = e => { STMT.account = e.target.value; };
    root.querySelector('#stMem').onchange = e => { STMT.member = e.target.value; };
    root.querySelector('#stFlip').onclick = () => { STMT.flip = !STMT.flip; statementReview(); };
    root.querySelectorAll('[data-stskip]').forEach(b => b.onclick = () => {
      const i = +b.dataset.stskip;
      if (STMT.skip.has(i)) STMT.skip.delete(i); else STMT.skip.add(i);
      statementReview();
    });
    root.querySelectorAll('.stCat').forEach(sel => sel.onchange = () => {
      STMT.a.txns[+sel.dataset.i].cat = sel.value;
    });
    const cardSel = root.querySelector('#stCard');
    if (cardSel) cardSel.onchange = e => {
      STMT.cardId = e.target.value;
      STMT.applyFields = {};
      if (STMT.cardId && STMT.cardId !== '__new') {
        for (const u of proposedCardUpdates(STMT.a, S.cards.find(c => c.id === STMT.cardId))) {
          if (!u.same) STMT.applyFields[u.key] = true;
        }
      }
      statementReview();
    };
    root.querySelectorAll('.stField').forEach(cb => cb.onchange = () => {
      STMT.applyFields[cb.dataset.k] = cb.checked;
    });
    root.querySelector('#stApply').onclick = applyStatement;
  }, true);
}

/** Commits the reviewed proposal. The only place this flow writes anything. */
function applyStatement() {
  const { a } = STMT;
  const existing = new Set(S.txns.map(t => t.hash || txHash(t)));
  let added = 0, skipped = 0;

  a.txns.forEach((t, i) => {
    if (STMT.skip.has(i)) return;
    const amount = STMT.flip ? -t.amount : t.amount;
    const rec = { date: t.date, desc: t.desc, amount, cat: t.cat };
    rec.hash = txHash(rec);
    if (existing.has(rec.hash)) { skipped++; return; }
    existing.add(rec.hash);
    S.txns.push({ id: uid(), ...rec, member: STMT.member || null,
                  account: STMT.account || null, note: '' });
    added++;
  });

  let cardMsg = '';
  if (a.kind === 'card' && STMT.cardId) {
    const f = a.fields;
    if (STMT.cardId === '__new') {
      const c = {
        id: uid(),
        name: (f.issuer ? f.issuer + ' card' : 'New card') + (f.accountLast4 ? ' ' + f.accountLast4 : ''),
        issuer: f.issuer || '', member: STMT.member || '', account: STMT.account || '',
        limit: f.creditLimit || 0,
        balance: f.statementBalance || 0,
        statementBalance: f.statementBalance != null ? f.statementBalance : null,
        apr: f.apr || 0, minPayment: f.minPayment || 0,
        statementDay: f.closingDate ? +f.closingDate.slice(8, 10) : 1,
        dueDay: f.dueDate ? +f.dueDate.slice(8, 10) : 21,
        openedDate: '', annualFee: 0, rewards: [{ cat: '*', rate: 1 }],
        autopay: 'none', paysInFull: true, active: true
      };
      S.cards.push(c);
      cardMsg = ', card created';
    } else {
      const c = S.cards.find(x => x.id === STMT.cardId);
      if (c) {
        let n = 0;
        for (const u of proposedCardUpdates(a, c)) {
          if (!STMT.applyFields[u.key]) continue;
          c[u.key] = u.value; n++;
        }
        if (n) cardMsg = `, ${n} card field${n === 1 ? '' : 's'} updated`;
      }
    }
    snapshotUtilisation();
  }

  save();
  closeModal();
  const months = [...new Set(a.txns.map(t => ym(t.date)))].sort();
  if (months.length) UI.month = months[months.length - 1];
  UI.tab = added ? 'overview' : 'cards';
  STMT = null;
  render();
  toast(`${added} added${skipped ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}${cardMsg}`);
}

/* --------------------------------------------------------------- delegation */

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { UI.tab = tab.dataset.tab; window.scrollTo(0, 0); render(); return; }

  const mem = e.target.closest('[data-member]');
  if (mem) { UI.member = mem.dataset.member; render(); return; }

  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;

  switch (act) {
    case 'add-tx': txForm(null); break;
    case 'edit-tx': txForm(id); break;
    case 'edit-member': recordForm('member', id); break;
    case 'edit-account': recordForm('account', id); break;
    case 'edit-asset': recordForm('asset', id); break;
    case 'edit-debt': recordForm('debt', id); break;
    case 'edit-goal': recordForm('goal', id); break;
    case 'edit-rec': recordForm('rec', id); break;
    case 'edit-card': cardForm(id); break;
    case 'log-payment': logPaymentForm(id); break;
    case 'payment-log': paymentLogView(); break;
    case 'del-payment':
      S.cardPayments = S.cardPayments.filter(p => p.id !== id);
      save(); paymentLogView(); break;
    case 'edit-inquiries': inquiriesForm(); break;
    case 'del-inquiry':
      S.creditProfile.inquiries.splice(+a.dataset.i, 1);
      save(); inquiriesForm(); break;
    case 'set-reported-score': reportedScoreForm(); break;
    case 'convert-debt': {
      const c = convertDebtToCard(id);
      if (!c) return;
      save(); UI.tab = 'cards'; render();
      toast('Converted - now set the real credit limit');
      cardForm(c.id);
      break;
    }
    case 'go-cards': UI.tab = 'cards'; window.scrollTo(0, 0); render(); break;
    case 'run-setup': WIZ = null; setupWizard(0); break;
    case 'storage-info': storageInfo(); break;
    case 'dismiss-backup': { const w = $('#backupWarn'); if (w) w.remove(); break; }
    case 'about-sharing':
      openModal('Sharing this dashboard', `
        <p style="margin-top:0;font-size:13.5px">Anyone can run their own copy. Nothing is shared between
        copies. Each person's figures stay in their own browser, on their own device.</p>
        <h4 style="font-size:13px;margin:16px 0 6px">Send them the single file</h4>
        <p class="sub" style="margin:0">Email or message them <b>wealth-dashboard.html</b> from the
        <code>dist</code> folder. It is the entire app in one file: they save it anywhere and double-click it.
        No install, no folder, no internet needed.</p>
        <h4 style="font-size:13px">Or give them the folder</h4>
        <p class="sub" style="margin:0">Copy the whole <code>finance-dashboard</code> folder to a shared
        drive or a USB stick. They open <code>index.html</code> inside it. Same result, and it keeps the
        separate files if they ever want to change something.</p>
        <h4 style="font-size:13px;margin:16px 0 6px">For a phone or tablet, send a link</h4>
        <p class="sub" style="margin:0">Phones have no good way to open a downloaded HTML file, so put
        the folder on any static host and send the address. They open it once, add it to their home
        screen, and it works offline from then on. <b>DEPLOY.md</b> has the steps.</p>
        <h4 style="font-size:13px;margin:16px 0 6px">What they will see</h4>
        <p class="sub" style="margin:0">A setup screen asking for their own household members and accounts.
        Your data is never part of what you send. It lives only in your browser's storage, not in the
        files.</p>
        <div class="disclaim" style="margin-top:16px">Remind them to take backups. There is no account to
        recover from, so a cleared browser means starting over.</div>
      `, `<button class="btn primary" data-close>Got it</button>`);
      break;
    case 'set-budget': budgetForm(a.dataset.cat); break;
    case 'auto-budget': autoBudget(); break;
    case 'fix-uncat': fixUncategorised(); break;
    case 'import': UI.tab = 'import'; render(); break;
    case 'go-plan': UI.tab = 'plan'; window.scrollTo(0, 0); render(); break;
    case 'go-settings': UI.tab = 'settings'; render(); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': { UI.tab = 'import'; render(); setTimeout(() => $('#jsonIn') && $('#jsonIn').click(), 60); break; }
    case 'parse-paste': {
      const t = $('#pasteIn');
      if (!t || !t.value.trim()) return toast('Paste some rows first.');
      startImport(t.value, 'Pasted rows'); break;
    }
    case 'del-profile': delete S.profiles[a.dataset.name]; save(); render(); break;
    case 'adopt-rec': {
      S.recurring.push({ id: uid(), name: a.dataset.name, amount: +a.dataset.amt,
        cat: a.dataset.cat, day: 1, member: null, account: null, active: true });
      save(); render(); toast('Now tracked as recurring'); break;
    }
    case 'del-rule': S.rules.splice(+a.dataset.i, 1); save(); render(); break;
    case 'add-rule': {
      openModal('Add a categorisation rule', `
        <label class="f"><span>When the description contains</span>
          <input type="text" id="rMatch" placeholder="e.g. kroger"></label>
        <label class="f"><span>Categorise it as</span><select id="rCat">${catOptions('groceries')}</select></label>
        <div class="sub">Matching is case-insensitive. The longest matching rule wins.</div>`,
        `<button class="btn" data-close>Cancel</button><button class="btn primary" id="rAdd">Add rule</button>`,
      root => root.querySelector('#rAdd').onclick = () => {
        const m = root.querySelector('#rMatch').value.trim().toLowerCase();
        if (!m) return toast('Enter some text to match.');
        S.rules.push({ match: m, cat: root.querySelector('#rCat').value });
        save(); closeModal(); render(); toast('Rule added');
      });
      break;
    }
    case 'recat-all': {
      let n = 0;
      for (const t of S.txns) {
        if (t.amount > 0) continue;
        const g = autoCat(t.desc);
        if (g !== 'misc' && g !== t.cat) { t.cat = g; n++; }
      }
      save(); render(); toast(`${n} transaction(s) re-categorised`); break;
    }
    case 'save-settings': {
      S.household.name = $('#setName').value.trim() || 'My Household';
      S.settings.currentAge = +$('#setAge').value || 35;
      S.settings.expectedReturn = +$('#setRet').value || 7;
      S.settings.employerMatchPct = +$('#setMatch').value || 0;
      S.settings.matchCaptured = $('#setMatchDone').checked;
      S.settings.hdhp = $('#setHdhp').checked;
      save(); render(); toast('Settings saved'); break;
    }
    case 'load-sample': {
      if (S.txns.length && !confirm('This replaces everything currently in the dashboard. Continue?')) return;
      S = seedSample(); save(); UI.month = thisMonth(); UI.tab = 'overview'; render();
      toast('Sample household loaded'); break;
    }
    case 'wipe': {
      if (!confirm('Erase all transactions, cards, budgets and balances from this browser?\n\n'
        + 'Your household members are kept. Download a backup first if you may want any of it back.')) return;
      const keepMembers = S.members, keepAccounts = S.accounts, keepName = S.household.name;
      S = blankState();
      S.members = keepMembers; S.accounts = keepAccounts; S.household.name = keepName;
      save(); UI.tab = 'overview'; render(); toast('Cleared - household members kept'); break;
    }
  }
});

/* ------------------------------------------------------------------- header */

$('#mPrev').onclick = () => { UI.month = addMonths(UI.month, -1); render(); };
$('#mNext').onclick = () => { UI.month = addMonths(UI.month, 1); render(); };
$('#btnAdd').onclick = () => txForm(null);
$('#btnImport').onclick = () => { UI.tab = 'import'; render(); };
$('#btnTheme').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage blocked; theme is session-only */ }
  render();
};

/**
 * Shown only when the browser refuses to persist data. Without this the app
 * would look like it was working while silently losing everything on reload.
 */
function showStorageWarning() {
  if ($('#storageWarn')) return;
  $('#view').insertAdjacentHTML('beforebegin', `<div id="storageWarn" class="disclaim"
    style="border-left-color:var(--crit);margin:16px 0 0">
    <b>This browser is not saving your data.</b> Storage is blocked for this page, so anything you
    enter will disappear when you close the tab. This usually happens when a browser restricts
    local files. Two fixes: open <code>index.html</code> in Chrome, Edge or Firefox instead, or serve
    the folder over <code>http://localhost</code> (see the README). Use <b>Download backup</b> before
    closing this tab.
  </div>`);
}

/* ------------------------------------------------------- storage durability */

/**
 * Plain answers about where the data lives and how likely it is to survive.
 * A budgeting app whose only copy is browser storage owes the user this.
 */
async function storageInfo() {
  const P = platformInfo();
  const days = S.lastBackup ? Math.floor((Date.parse(todayISO()) - Date.parse(S.lastBackup)) / 86400000) : null;
  let persisted = null, est = null;
  try {
    if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
    if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate();
  } catch (e) { /* not supported here */ }

  const used = est && est.usage != null ? (est.usage / 1048576).toFixed(1) + ' MB' : 'unknown';
  const quota = est && est.quota != null ? (est.quota / 1048576).toFixed(0) + ' MB' : 'unknown';
  const size = (() => {
    try { return ((localStorage.getItem(KEY) || '').length / 1024).toFixed(0) + ' KB'; }
    catch (e) { return 'unknown'; }
  })();

  openModal('Storage and durability', `
    <div class="kv"><span>This dashboard's data</span><b>${size}</b></div>
    <div class="kv"><span>Used by this site</span><b>${used}</b></div>
    <div class="kv"><span>Available to this site</span><b>${quota}</b></div>
    <div class="kv"><span>Marked as persistent</span>
      <b>${persisted === true ? 'yes' : persisted === false ? 'no' : 'not supported here'}</b></div>
    <div class="kv"><span>Last backup</span>
      <b class="${days == null || days > 30 ? 'neg' : ''}">${
        days == null ? 'never' : days === 0 ? 'today' : days + ' days ago'}</b></div>

    ${sharedOriginRisk() ? `<div class="disclaim" style="border-left-color:var(--crit)">
      <b>This address shares its storage with other sites.</b> Everything under
      <b>${esc(location.hostname)}</b> uses one storage area, no matter which folder it is in,
      because browsers separate data by domain and not by path. Any other project published on
      this same domain can read what this dashboard has saved. That is a property of the hosting,
      not of this app. For real figures, use a copy on its own address, or the single-file version
      on your own computer.
    </div>` : ''}

    <h4 style="font-size:13px;margin:18px 0 6px">How safe is this?</h4>
    ${P.iOS ? `<div class="disclaim" style="border-left-color:var(--crit)">
      <b>On iPhone and iPad, treat backups as mandatory.</b> Safari reclaims website storage from
      sites you have not opened in a while, and it ignores the standard request to mark storage as
      permanent. Adding this to your Home Screen and opening it regularly makes that much less
      likely, but nothing on iOS makes it impossible. Export a backup whenever you have added a
      month of data.
    </div>`
    : `<div class="disclaim" style="border-left-color:${persisted ? 'var(--good)' : 'var(--warn)'}">
      ${persisted
        ? `Your browser has marked this data as persistent, so it will not be cleared automatically
           to reclaim space. It is still removed if you clear site data by hand, and it does not exist
           on any other device or browser.`
        : `Your browser may clear this data automatically if it needs space. Installing the app makes
           that much less likely. Either way it does not exist on any other device or browser.`}
    </div>`}

    <h4 style="font-size:13px;margin:18px 0 6px">What always loses the data</h4>
    <ul style="font-size:12.5px;color:var(--ink-2);margin:0;padding-left:18px;line-height:1.7">
      <li>Clearing browsing data or site data for this page</li>
      <li>Private or incognito windows, where nothing is kept at all</li>
      <li>Opening it in a different browser, a different device, or another Windows user account</li>
      <li>Uninstalling the app, on some platforms</li>
    </ul>
    <p class="sub" style="margin-top:12px">A backup file restores all of it, anywhere, in one click.
    There is no account behind this and no way for anyone to recover it for you.</p>
  `, `<button class="btn" data-close>Close</button>
      <button class="btn primary" data-act="export-json">Download a backup now</button>`);
}

/* ========================================================= FIRST-RUN SETUP == */

const ROLES = ['Adult', 'Partner', 'Child', 'Teen', 'Parent', 'Housemate', 'Other'];
const ACCT_TYPES = [['checking', 'Checking'], ['savings', 'Savings'], ['credit', 'Credit card'],
  ['wallet', 'Wallet / transfer app'], ['cash', 'Cash'], ['other', 'Other']];

let WIZ = null;

/**
 * Everything a new household needs before the dashboard means anything.
 * Runs once, on a browser with no saved data - which is every friend's first
 * open as well as your own.
 */
function setupWizard(step) {
  if (!WIZ) WIZ = { step: 0, name: '', people: [{ name: '', role: 'Adult' }], accounts: [] };
  if (step != null) WIZ.step = step;

  const dots = [0, 1, 2].map(i =>
    `<span style="width:7px;height:7px;border-radius:99px;display:inline-block;
      background:${i === WIZ.step ? 'var(--s1)' : 'var(--surface-3)'}"></span>`).join(' ');

  const body = [
    // ---------- step 1: who lives here ----------
    () => `
      <p style="margin-top:0;font-size:13.5px">This dashboard tracks what a household spends across every
      account and person, then uses those numbers to model savings, debt payoff, credit and long-term growth.</p>
      <p style="font-size:13.5px"><b>Nothing leaves this device.</b> There is no server, no account and no
      sign-in. Everything is stored in this browser, which is also why backups matter.</p>
      <label class="f"><span>What should we call this household?</span>
        <input type="text" id="wzName" value="${esc(WIZ.name)}" placeholder="e.g. The Smith Household"></label>
      <h4 style="font-size:13px;margin:18px 0 6px">Who lives here?</h4>
      <div class="sub" style="margin-bottom:10px">Each person gets a fixed colour used on every chart, so you can
      see at a glance who spent what. Include children if you want their spending tracked separately.</div>
      <div id="wzPeople">${WIZ.people.map((p, i) => personRow(p, i)).join('')}</div>
      <button class="btn sm" type="button" id="wzAddPerson">+ Add another person</button>`,

    // ---------- step 2: where the money sits ----------
    () => `
      <p style="margin-top:0;font-size:13.5px">Add the accounts you'll import statements from: current
      accounts, credit cards, cash wallets, transfer apps. Every one of them feeds the same ledger, which is
      what makes a category total the <i>household</i> total rather than one bank's view.</p>
      <div class="sub" style="margin-bottom:12px">You can skip this and add them later from Settings.
      Credit cards get their own limits and dates on the Cards tab once you're in.</div>
      <div id="wzAccounts">${WIZ.accounts.map((a, i) => accountRow(a, i)).join('')}</div>
      <button class="btn sm" type="button" id="wzAddAcct">+ Add another account</button>`,

    // ---------- step 3: get some data in ----------
    () => `
      <p style="margin-top:0;font-size:13.5px"><b>${esc(WIZ.name || 'Your household')}</b> is set up with
      ${WIZ.people.filter(p => p.name.trim()).length} member(s)
      and ${WIZ.accounts.filter(a => a.name.trim()).length} account(s).</p>
      <p style="font-size:13.5px">The dashboard needs transactions before it can tell you anything. Pick how
      you'd like to begin:</p>
      <div style="display:grid;gap:10px;margin-top:14px">
        <button class="btn" id="wzImport" style="justify-content:flex-start;padding:14px;height:auto;text-align:left">
          <div><b style="display:block">Import a bank or card statement</b>
          <span class="sub">A CSV export from any bank. Columns are detected for you. This is the fastest route.</span></div>
        </button>
        <button class="btn" id="wzManual" style="justify-content:flex-start;padding:14px;height:auto;text-align:left">
          <div><b style="display:block">Add transactions by hand</b>
          <span class="sub">Good if you mostly spend cash, or just want to try it out.</span></div>
        </button>
        <button class="btn" id="wzSample" style="justify-content:flex-start;padding:14px;height:auto;text-align:left">
          <div><b style="display:block">Explore a sample household first</b>
          <span class="sub">A fictional family with nine months of activity, so every screen has something to show.
          Replaces your setup, and you can clear it from Settings afterwards.</span></div>
        </button>
      </div>
      <div class="disclaim" style="margin-top:16px">
        <b>Back up regularly.</b> Your data lives only in this browser on this device. Import &rarr;
        <b>Download full backup</b> writes everything to a file you can restore anywhere.
      </div>`
  ][WIZ.step]();

  const footer = WIZ.step === 0
    ? `<span style="margin-right:auto;display:flex;gap:5px;align-items:center">${dots}</span>
       <button class="btn primary" id="wzNext">Continue</button>`
    : WIZ.step === 1
    ? `<span style="margin-right:auto;display:flex;gap:5px;align-items:center">${dots}</span>
       <button class="btn" id="wzBack">Back</button>
       <button class="btn primary" id="wzNext">Continue</button>`
    : `<span style="margin-right:auto;display:flex;gap:5px;align-items:center">${dots}</span>
       <button class="btn" id="wzBack">Back</button>`;

  openModal(['Welcome', 'Accounts and cards', 'Ready'][WIZ.step], body, footer, root => {
    // keep edits in WIZ so Back/Continue never loses typing
    const readPeople = () => {
      const n = root.querySelector('#wzName');
      if (n) WIZ.name = n.value;
      const rows = root.querySelectorAll('[data-person]');
      if (rows.length) WIZ.people = [...rows].map(r => ({
        name: r.querySelector('.pName').value, role: r.querySelector('.pRole').value }));
    };
    const readAccounts = () => {
      const rows = root.querySelectorAll('[data-acct]');
      if (rows.length) WIZ.accounts = [...rows].map(r => ({
        name: r.querySelector('.aName').value, type: r.querySelector('.aType').value,
        owner: r.querySelector('.aOwner').value }));
    };

    const addP = root.querySelector('#wzAddPerson');
    if (addP) addP.onclick = () => {
      readPeople(); WIZ.people.push({ name: '', role: 'Adult' }); setupWizard();
      const rows = $$('[data-person]'); const last = rows[rows.length - 1];
      if (last) last.querySelector('.pName').focus();
    };
    const addA = root.querySelector('#wzAddAcct');
    if (addA) addA.onclick = () => {
      readAccounts(); WIZ.accounts.push({ name: '', type: 'checking', owner: '' }); setupWizard();
      const rows = $$('[data-acct]'); const last = rows[rows.length - 1];
      if (last) last.querySelector('.aName').focus();
    };
    root.querySelectorAll('[data-rmrow]').forEach(b => b.onclick = () => {
      const isP = !!b.closest('[data-person]');
      if (isP) { readPeople(); if (WIZ.people.length > 1) WIZ.people.splice(+b.dataset.rmrow, 1); }
      else { readAccounts(); WIZ.accounts.splice(+b.dataset.rmrow, 1); }
      setupWizard();
    });

    const back = root.querySelector('#wzBack');
    if (back) back.onclick = () => {
      if (WIZ.step === 1) readAccounts(); else readPeople();
      setupWizard(WIZ.step - 1);
    };

    const next = root.querySelector('#wzNext');
    if (next) next.onclick = () => {
      if (WIZ.step === 0) {
        readPeople();
        const named = WIZ.people.filter(p => p.name.trim());
        if (!named.length) return toast('Add at least one person.');
        WIZ.people = named;
        // suggest an account for each adult so step 2 is not a blank page
        if (!WIZ.accounts.length) {
          WIZ.accounts = named.filter(p => !/child|teen/i.test(p.role))
            .map(p => ({ name: `${p.name.trim()} - main account`, type: 'checking', owner: p.name.trim() }));
          if (!WIZ.accounts.length) WIZ.accounts = [{ name: 'Main account', type: 'checking', owner: '' }];
        }
        setupWizard(1);
      } else {
        readAccounts();
        commitWizard();
        setupWizard(2);
      }
    };

    const go = (fn) => { commitWizard(); fn(); };
    const imp = root.querySelector('#wzImport');
    if (imp) imp.onclick = () => go(() => { closeModal(); UI.tab = 'import'; render(); });
    const man = root.querySelector('#wzManual');
    if (man) man.onclick = () => go(() => { closeModal(); render(); txForm(null); });
    const smp = root.querySelector('#wzSample');
    if (smp) smp.onclick = () => {
      S = seedSample(); save(); UI.month = thisMonth(); WIZ = null;
      closeModal(); render();
      toast('Sample household loaded - clear it from Settings when you are ready');
    };
  }, WIZ.step === 2);
}

function personRow(p, i) {
  return `<div class="row" data-person style="margin-bottom:8px;align-items:flex-end">
    <label class="f" style="margin:0;flex:2 1 160px"><span${i ? ' class="hide"' : ''}>Name</span>
      <input type="text" class="pName" value="${esc(p.name)}" placeholder="First name"></label>
    <label class="f" style="margin:0;flex:1 1 120px"><span${i ? ' class="hide"' : ''}>Role</span>
      <select class="pRole">${ROLES.map(r =>
        `<option${r === p.role ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
    <div style="flex:0 0 auto"><button class="btn sm ghost" type="button" data-rmrow="${i}">&times;</button></div>
  </div>`;
}
function accountRow(a, i) {
  const names = WIZ.people.map(p => p.name.trim()).filter(Boolean);
  return `<div class="row" data-acct style="margin-bottom:8px;align-items:flex-end">
    <label class="f" style="margin:0;flex:2 1 160px"><span${i ? ' class="hide"' : ''}>Account name</span>
      <input type="text" class="aName" value="${esc(a.name)}" placeholder="e.g. Chase checking"></label>
    <label class="f" style="margin:0;flex:1 1 130px"><span${i ? ' class="hide"' : ''}>Type</span>
      <select class="aType">${ACCT_TYPES.map(([k, l]) =>
        `<option value="${k}"${k === a.type ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f" style="margin:0;flex:1 1 120px"><span${i ? ' class="hide"' : ''}>Owner</span>
      <select class="aOwner"><option value="">Shared</option>${names.map(n =>
        `<option${n === a.owner ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <div style="flex:0 0 auto"><button class="btn sm ghost" type="button" data-rmrow="${i}">&times;</button></div>
  </div>`;
}

/** Writes the wizard's answers into the document. Idempotent. */
function commitWizard() {
  if (!WIZ) return;
  S.household.name = WIZ.name.trim() || 'My Household';
  S.members = WIZ.people.filter(p => p.name.trim())
    .map(p => ({ id: uid(), name: p.name.trim(), role: p.role, annualIncome: 0 }));
  const byName = Object.fromEntries(S.members.map(m => [m.name, m.id]));
  S.accounts = WIZ.accounts.filter(a => a.name.trim())
    .map(a => ({ id: uid(), name: a.name.trim(), type: a.type, member: byName[a.owner] || '' }));
  save();
  render();
}

/* ================================================================== BOOT === */

/**
 * Registers the offline worker when the app is served over http(s). Opened
 * straight from disk there is no worker (file:// forbids it) and none is
 * needed - the files are already local.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // a new version is ready and an old one is already running this page
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('An update is ready - reload to apply it');
        }
      });
    });
  }).catch(() => { /* offline support is optional; the app works without it */ });
}

/**
 * Where and how this copy is running. Installation differs per platform, and
 * Safari never fires `beforeinstallprompt`, so on iOS there is no button to
 * offer: the app has to give written steps instead of hiding a dead button.
 */
function platformInfo() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports as a Mac
  const android = /Android/.test(ua);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
  return {
    iOS, android, standalone,
    mobile: iOS || android,
    touch: window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
    small: window.innerWidth < 700,
    canPrompt: !!deferredInstall,
    fileMode: location.protocol === 'file:',
    swSupported: 'serviceWorker' in navigator
  };
}

/**
 * True on hosts that put many unrelated sites on one domain, where browser
 * storage is therefore shared between them. github.io is the common case: every
 * project page of an account sits on `account.github.io`, so any one of them can
 * read the others' saved data. Path does not isolate storage; only the domain
 * does. Hosts that give each site its own subdomain are unaffected.
 */
function sharedOriginRisk() {
  const h = (location.hostname || '').toLowerCase();
  if (!h) return false;
  const shared = ['github.io', 'gitlab.io', 'sourceforge.io', 'surge.sh', 'neocities.org'];
  // only when served from a sub-path, i.e. a project site rather than the root
  const inSubfolder = (location.pathname || '/').replace(/\/+$/, '').split('/').filter(Boolean).length > 0;
  return shared.some(d => h.endsWith(d)) && inSubfolder;
}

/**
 * Asks the browser not to evict our storage. Chrome and Edge grant this
 * silently once the app is installed. Worth requesting either way, because the
 * only copy of the user's ledger lives in that storage.
 */
async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { return null; }
}

/** Offers the install prompt through a Settings button rather than a popup. */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  const b = $('#btnInstall');
  if (b) b.classList.remove('hide');
});
window.addEventListener('appinstalled', () => { deferredInstall = null; render(); });

(function boot() {
  const canStore = storageWorks();
  registerServiceWorker();
  const t = canStore ? localStorage.getItem(THEME_KEY) : null;
  if (t) document.documentElement.setAttribute('data-theme', t);

  S = load();
  if (!S) {
    S = blankState();
    render();
    if (!canStore) showStorageWarning();
    setupWizard();
    return;
  }

  snapshotUtilisation();
  if (canStore) save();
  // installed apps are usually granted this silently
  requestPersistentStorage();

  const months = activeMonths();
  if (months.length && !months.includes(thisMonth())) UI.month = months[months.length - 1];
  render();
  if (!canStore) showStorageWarning(); else maybeNudgeBackup();
})();
