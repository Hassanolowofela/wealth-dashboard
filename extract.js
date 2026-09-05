/* ==========================================================================
   Turning statement text into transactions and account fields.

   A PDF statement has no column headers to map, so this works by pattern:
   find the dated lines, find the money on them, and work out the sign. Where a
   running balance column exists it is used to verify the signs arithmetically,
   which is far more reliable than guessing from wording.

   Nothing here writes to the ledger. It produces a proposal that the user
   confirms, because silently editing someone's finances on a guess is not a
   feature.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------- money */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8,
                 sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Every money-looking token on a line, with position and sign markers. */
function findAmounts(line) {
  const out = [];
  const re = /(\()?\s*(?:\$|USD\s*)?(-)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s*(\))?\s*(CR|DR)?/gi;
  let m;
  while ((m = re.exec(line))) {
    const whole = m[3].replace(/,/g, '');
    const cents = m[4];
    // a bare integer with no separators or decimals is usually not money
    if (!cents && !m[3].includes(',') && !m[1] && !m[2] && !/\$/.test(m[0])) continue;
    let v = parseFloat(whole + (cents ? '.' + cents : ''));
    if (!isFinite(v)) continue;
    if (v === 0 && !cents) continue;
    let neg = false;
    if (m[1] && m[5]) neg = true;                 // (123.45)
    if (m[2]) neg = true;                         // -123.45
    if (m[6] && m[6].toUpperCase() === 'DR') neg = true;
    let credit = m[6] && m[6].toUpperCase() === 'CR';
    out.push({ value: v, neg, credit, start: m.index, end: m.index + m[0].length, raw: m[0].trim() });
  }
  return out;
}

/** A date at or near the start of a line, in the shapes statements use. */
function findDate(line) {
  let m;
  if ((m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(line)))
    return { y: +m[1], m: +m[2], d: +m[3], end: m[0].length, hadYear: true };
  if ((m = /^\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/.exec(line)))
    return { a: +m[1], b: +m[2], y: m[3] ? +m[3] : null, end: m[0].length, hadYear: !!m[3] };
  if ((m = /^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/.exec(line))) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return { m: mo, d: +m[2], y: m[3] ? +m[3] : null, end: m[0].length, hadYear: !!m[3] };
  }
  if ((m = /^\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?\b/.exec(line))) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return { m: mo, d: +m[1], y: m[3] ? +m[3] : null, end: m[0].length, hadYear: !!m[3] };
  }
  return null;
}

/** Resolves a parsed date into ISO, filling in a missing year sensibly. */
function resolveDate(d, order, fallbackYear) {
  let mo, day;
  if (d.m !== undefined && d.a === undefined) { mo = d.m; day = d.d; }
  else {
    const a = d.a, b = d.b;
    if (a > 12) { day = a; mo = b; }
    else if (b > 12) { mo = a; day = b; }
    else if (order === 'dmy') { day = a; mo = b; }
    else { mo = a; day = b; }
  }
  let y = d.y;
  if (y == null) y = fallbackYear || new Date().getFullYear();
  else if (y < 100) y += y < 70 ? 2000 : 1900;
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ------------------------------------------------------- statement fields */

const grab = (text, patterns) => {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      for (let i = 1; i < m.length; i++) if (m[i] !== undefined) return m[i];
    }
  }
  return null;
};
const num = v => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : null;
};

/**
 * Pulls the named values a statement states outright: limits, balances,
 * minimum payment, due date, APR. These map straight onto card fields.
 */
function findStatementFields(text) {
  const t = text.replace(/\r/g, '');
  const M = '[^\\n\\d$]{0,40}';                    // label to value gap
  const AMT = '\\$?\\s*([\\d,]+\\.\\d{2})';

  const f = {};
  // the optional parenthetical must not swallow digits, or it eats into the
  // amount itself and "$9,000.00" comes back as "0.00"
  f.creditLimit = num(grab(t, [
    new RegExp('(?:total\\s+)?credit\\s*(?:line|limit)(?:\\s*\\([^)\\n\\d$]{0,20}\\))?' + M + AMT, 'i'),
    new RegExp('credit\\s*line' + M + AMT, 'i'),
    new RegExp('revolving\\s+credit\\s+limit' + M + AMT, 'i')
  ]));
  f.availableCredit = num(grab(t, [
    new RegExp('available\\s*credit(?:\\s*line)?' + M + AMT, 'i')
  ]));
  f.statementBalance = num(grab(t, [
    new RegExp('new\\s+balance(?:\\s+total)?' + M + AMT, 'i'),
    new RegExp('statement\\s+balance' + M + AMT, 'i'),
    new RegExp('(?:^|\\n)\\s*balance\\s+due' + M + AMT, 'i'),
    new RegExp('closing\\s+balance' + M + AMT, 'i'),
    new RegExp('total\\s+amount\\s+due' + M + AMT, 'i')
  ]));
  f.minPayment = num(grab(t, [
    new RegExp('minimum\\s+payment\\s+due' + M + AMT, 'i'),
    new RegExp('minimum\\s+(?:amount\\s+)?due' + M + AMT, 'i'),
    new RegExp('min(?:imum)?\\.?\\s+payment' + M + AMT, 'i')
  ]));
  f.previousBalance = num(grab(t, [
    new RegExp('previous\\s+balance' + M + AMT, 'i'),
    new RegExp('(?:beginning|opening)\\s+balance' + M + AMT, 'i')
  ]));
  f.endingBalance = num(grab(t, [
    new RegExp('(?:ending|closing)\\s+balance' + M + AMT, 'i'),
    new RegExp('balance\\s+(?:as\\s+of|on)[^\\n]{0,30}' + AMT, 'i')
  ]));
  f.apr = num(grab(t, [
    /(?:purchase\s+)?annual\s+percentage\s+rate[^\n%]{0,40}?([\d.]+)\s*%/i,
    /\bAPR\b[^\n%]{0,40}?([\d.]+)\s*%/i,
    /([\d.]+)\s*%[^\n]{0,20}\bAPR\b/i
  ]));
  f.interestCharged = num(grab(t, [
    new RegExp('interest\\s+charge[sd]?' + M + AMT, 'i'),
    new RegExp('finance\\s+charge' + M + AMT, 'i')
  ]));
  f.fees = num(grab(t, [ new RegExp('(?:total\\s+)?fees\\s+charged' + M + AMT, 'i') ]));

  const dateStr = s => {
    if (!s) return null;
    const d = findDate(String(s).trim());
    return d ? resolveDate(d, 'mdy', null) : null;
  };
  const DATE = '([A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s*\\d{0,4}|\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})';
  f.dueDate = dateStr(grab(t, [
    new RegExp('payment\\s+due\\s+date[^\\n\\w]{0,40}' + DATE, 'i'),
    new RegExp('due\\s+date[^\\n\\w]{0,40}' + DATE, 'i'),
    new RegExp('payment\\s+due[^\\n\\w]{0,40}' + DATE, 'i')
  ]));
  f.closingDate = dateStr(grab(t, [
    new RegExp('(?:statement\\s+)?closing\\s+date[^\\n\\w]{0,40}' + DATE, 'i'),
    new RegExp('statement\\s+(?:period\\s+)?(?:ending|closed?)[^\\n\\w]{0,40}' + DATE, 'i')
  ]));

  // statement period, which also gives us the year for dates that omit it
  const per = new RegExp(DATE + '\\s*(?:to|through|-|and)\\s*' + DATE, 'i').exec(t);
  if (per) {
    f.periodStart = dateStr(per[1]);
    f.periodEnd = dateStr(per[2]);
  }
  const acct = /(?:account|card)\s*(?:number|no\.?|#)?[^\n\d]{0,12}(?:[\dXx*]{2,}[\s-]*)?(\d{4})\b/i.exec(t);
  if (acct) f.accountLast4 = acct[1];

  // issuer, used only to suggest a card name
  const issuers = ['Chase', 'American Express', 'Amex', 'Capital One', 'Citi', 'Discover',
    'Bank of America', 'Wells Fargo', 'Barclays', 'Synchrony', 'US Bank', 'PNC', 'TD Bank', 'Apple Card'];
  f.issuer = issuers.find(i => new RegExp('\\b' + i.replace(/ /g, '\\s+') + '\\b', 'i').test(t)) || null;

  return f;
}

/** Is this a credit card statement, a bank statement, or something else? */
function classifyDocument(text, fields) {
  const t = text.toLowerCase();
  let card = 0, bank = 0;
  if (fields.creditLimit != null) card += 3;
  if (fields.minPayment != null) card += 3;
  if (fields.statementBalance != null) card += 1;
  if (/minimum payment|credit limit|available credit|payment due date/.test(t)) card += 2;
  if (/purchases and adjustments|cash advance|late payment warning/.test(t)) card += 2;
  if (/beginning balance|ending balance|deposits and additions|withdrawals/.test(t)) bank += 3;
  if (/checking|savings account|direct deposit|overdraft/.test(t)) bank += 2;
  if (card >= 4 && card >= bank) return 'card';
  if (bank >= 3) return 'bank';
  return 'unknown';
}

/* -------------------------------------------------------------- rows ----- */

const NOISE = /^(page\s*\d|continued|statement|account\s+summary|transaction\s+detail|date\s+description|balance\s+forward|total(s)?\b|previous\s+balance|new\s+balance|minimum\s+payment|payment\s+due|credit\s+limit|available\s+credit|interest\s+charge|annual\s+percentage|customer\s+service|visit\s+us|www\.|p\.?o\.?\s*box|questions\?)/i;

/**
 * Finds candidate transaction rows: a date, some text, and at least one amount.
 * Sign is left undecided here and settled by resolveSigns().
 */
function findTransactionRows(text, order, fallbackYear) {
  const rows = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim().length < 8) continue;
    if (NOISE.test(line.trim())) continue;

    const d = findDate(line);
    if (!d) continue;
    const iso = resolveDate(d, order, fallbackYear);
    if (!iso) continue;

    let rest = line.slice(d.end);
    // a second date (posting date) right after the first is not description
    const d2 = findDate(rest);
    if (d2 && d2.end <= 12) rest = rest.slice(d2.end);

    const amts = findAmounts(rest);
    if (!amts.length) continue;

    const desc = rest.slice(0, amts[0].start).replace(/\s{2,}/g, ' ').trim()
      .replace(/^[-\u2013\u2014\u2022|]\s*/, '').trim();
    if (!desc || desc.length < 2) continue;
    if (/^\d+$/.test(desc)) continue;

    rows.push({ date: iso, desc, amounts: amts, line });
  }
  return rows;
}

/**
 * Works out which column is the transaction amount and which is a running
 * balance, then derives signs from how the balance moves. When the balance
 * arithmetic checks out this is exact rather than a guess.
 */
function resolveSigns(rows, kind, openingBalance) {
  const multi = rows.filter(r => r.amounts.length >= 2);
  let usedBalance = false;

  if (multi.length >= 3) {
    // assume the last amount on each line is the running balance and test it
    let hits = 0, tested = 0;
    for (let i = 1; i < multi.length; i++) {
      const prev = multi[i - 1].amounts[multi[i - 1].amounts.length - 1].value;
      const cur = multi[i].amounts[multi[i].amounts.length - 1].value;
      const amt = multi[i].amounts[0].value;
      tested++;
      if (Math.abs(Math.abs(cur - prev) - amt) < 0.02) hits++;
    }
    if (tested && hits / tested >= 0.6) {
      usedBalance = true;
      for (let i = 0; i < multi.length; i++) {
        const r = multi[i];
        r.balance = r.amounts[r.amounts.length - 1].value;
        const amt = r.amounts[0].value;
        // the first row needs the statement's opening balance to be resolvable;
        // without it, leave the sign to the keyword pass rather than guessing
        const prev = i === 0
          ? (openingBalance != null ? openingBalance : null)
          : multi[i - 1].amounts[multi[i - 1].amounts.length - 1].value;
        if (prev == null) continue;
        const rose = (r.balance - prev) > 0;
        // on a credit card a rising balance means a purchase, so an expense
        const expense = kind === 'card' ? rose : !rose;
        r.value = expense ? -amt : amt;
        r.signKnown = true;
      }
    }
  }

  for (const r of rows) {
    if (r.value !== undefined) continue;
    const a = r.amounts[0];
    let v = a.value;
    let expense = true;
    if (a.credit) expense = false;
    else if (a.neg) expense = kind === 'card' ? false : true;
    else if (/\b(payment|deposit|credit|refund|reversal|interest earned|transfer from|direct dep|payroll|salary|cashback|rebate|thank you)\b/i.test(r.desc)) {
      expense = false;
    }
    // on a card statement a negative or CR amount is money coming off the balance
    r.value = expense ? -Math.abs(v) : Math.abs(v);
    r.signKnown = false;
  }
  return { usedBalance };
}

/* ------------------------------------------------------------ the pipeline */

/**
 * Full analysis of one document's text. Returns proposed transactions and
 * proposed field updates, with enough detail for the review screen to explain
 * where each number came from.
 */
function analyseStatement(text, opts) {
  opts = opts || {};
  const fields = findStatementFields(text);
  const kind = opts.kind || classifyDocument(text, fields);

  // year for dates printed without one
  let fallbackYear = null;
  for (const k of ['periodEnd', 'closingDate', 'periodStart', 'dueDate']) {
    if (fields[k]) { fallbackYear = +fields[k].slice(0, 4); break; }
  }

  // decide day/month order from the whole document before parsing rows
  const probe = [];
  for (const line of text.split('\n')) {
    const d = findDate(line);
    if (d && d.a !== undefined) probe.push(d);
  }
  let order = 'mdy';
  if (probe.some(d => d.a > 12) && !probe.some(d => d.b > 12)) order = 'dmy';
  if (opts.order) order = opts.order;

  let rows = findTransactionRows(text, order, fallbackYear);

  // a statement covering a period should not contain dates far outside it
  if (fields.periodStart && fields.periodEnd) {
    const lo = fields.periodStart, hi = fields.periodEnd;
    rows = rows.map(r => {
      if (r.date >= lo && r.date <= hi) return r;
      // a December row on a January statement belongs to the previous year
      const alt = String(+r.date.slice(0, 4) - 1) + r.date.slice(4);
      if (alt >= lo && alt <= hi) return { ...r, date: alt };
      return r;
    });
  }

  const sign = resolveSigns(rows, kind, fields.previousBalance);

  const txns = rows.map(r => {
    const t = {
      date: r.date,
      desc: r.desc.slice(0, 90),
      amount: Math.round(r.value * 100) / 100,
      signKnown: r.signKnown,
      balance: r.balance
    };
    // A payment landing ON a credit card is money moving between your own
    // accounts, not income. Counting it would inflate income and, if the
    // paying account is also imported, double-count the same money.
    t.transfer = kind === 'card' && t.amount > 0 &&
      /\b(payment|thank ?you|autopay|online payment|electronic payment|payment received|transfer)\b/i.test(t.desc);
    t.cat = t.amount > 0
      ? (autoCat(t.desc) === 'misc' ? 'income' : autoCat(t.desc))
      : autoCat(t.desc);
    if (t.transfer) t.cat = 'debt';
    else if (t.amount > 0 && bucketOf(t.cat) !== 'income' && kind !== 'card') t.cat = 'income';
    t.hash = txHash(t);
    return t;
  }).filter(t => t.amount !== 0);

  // arithmetic check: do the rows account for the balance movement?
  let reconciliation = null;
  if (fields.previousBalance != null && fields.statementBalance != null && txns.length) {
    const net = sum(txns.map(t => -t.amount));       // card balance grows with spend
    const expected = fields.statementBalance - fields.previousBalance;
    reconciliation = {
      expected, actual: net, diff: Math.round((net - expected) * 100) / 100,
      ok: Math.abs(net - expected) < 1.0
    };
  }

  const dates = txns.map(t => t.date).sort();
  return {
    kind, fields, txns, order,
    usedBalanceColumn: sign.usedBalance,
    reconciliation,
    span: dates.length ? [dates[0], dates[dates.length - 1]] : null,
    fallbackYear
  };
}

/** Card fields a statement can fill in, with the value it found for each. */
function proposedCardUpdates(a, card) {
  const f = a.fields;
  const out = [];
  const add = (key, label, value, fmt) => {
    if (value == null || value === '') return;
    const cur = card ? card[key] : null;
    const same = cur != null && String(cur) !== '' && Math.abs((+cur || 0) - (+value || 0)) < 0.005;
    out.push({ key, label, value, current: cur, same, fmt: fmt || (v => money2(v)) });
  };
  add('limit', 'Credit limit', f.creditLimit);
  add('statementBalance', 'Statement balance', f.statementBalance);
  add('balance', 'Balance', f.statementBalance);
  add('minPayment', 'Minimum payment', f.minPayment);
  add('apr', 'APR', f.apr, v => v + '%');
  if (f.dueDate) add('dueDay', 'Payment due day', +f.dueDate.slice(8, 10), v => 'day ' + v);
  if (f.closingDate) add('statementDay', 'Statement closes on day', +f.closingDate.slice(8, 10), v => 'day ' + v);
  return out;
}
