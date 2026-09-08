/* ==========================================================================
   Household Wealth Dashboard
   Single-page, offline, zero-dependency. All data lives in this browser's
   localStorage and never leaves the machine.
   ========================================================================== */
'use strict';

const APP_VERSION = '2.0.1';
const KEY = 'hwd.v1';
const THEME_KEY = 'hwd.theme';

/* ---------------------------------------------------------------- constants */

// Buckets drive the 50/30/20 view and the "essential expenses" figure that the
// emergency-fund and FI calculations depend on.
const CATS = [
  { id: 'housing',    name: 'Housing / Rent',    bucket: 'need' },
  { id: 'utilities',  name: 'Utilities',         bucket: 'need' },
  { id: 'groceries',  name: 'Groceries',         bucket: 'need' },
  { id: 'transport',  name: 'Transport / Fuel',  bucket: 'need' },
  { id: 'insurance',  name: 'Insurance',         bucket: 'need' },
  { id: 'health',     name: 'Healthcare',        bucket: 'need' },
  { id: 'childcare',  name: 'Childcare / Kids',  bucket: 'need' },
  { id: 'debt',       name: 'Debt Payments',     bucket: 'need' },
  { id: 'dining',     name: 'Dining Out',        bucket: 'want' },
  { id: 'shopping',   name: 'Shopping',          bucket: 'want' },
  { id: 'fun',        name: 'Entertainment',     bucket: 'want' },
  { id: 'travel',     name: 'Travel',            bucket: 'want' },
  { id: 'subs',       name: 'Subscriptions',     bucket: 'want' },
  { id: 'personal',   name: 'Personal Care',     bucket: 'want' },
  { id: 'gifts',      name: 'Gifts / Giving',    bucket: 'want' },
  { id: 'education',  name: 'Education',         bucket: 'want' },
  { id: 'fees',       name: 'Fees & Charges',    bucket: 'want' },
  { id: 'misc',       name: 'Uncategorized',     bucket: 'want' },
  { id: 'savings',    name: 'Savings Transfer',  bucket: 'save' },
  { id: 'invest',     name: 'Investing',         bucket: 'save' },
  { id: 'income',     name: 'Income',            bucket: 'income' }
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const catName = id => (CAT[id] || CAT.misc).name;
const bucketOf = id => (CAT[id] || CAT.misc).bucket;

// Default merchant -> category rules. Matched as lowercase substrings.
const DEFAULT_RULES = [
  ['rent', 'housing'], ['mortgage', 'housing'], ['landlord', 'housing'], ['hoa', 'housing'],
  ['zillow', 'housing'], ['apartment', 'housing'], ['property mgmt', 'housing'],
  ['electric', 'utilities'], ['power co', 'utilities'], ['pg&e', 'utilities'], ['con ed', 'utilities'],
  ['water', 'utilities'], ['gas co', 'utilities'], ['comcast', 'utilities'], ['xfinity', 'utilities'],
  ['verizon', 'utilities'], ['at&t', 'utilities'], ['t-mobile', 'utilities'], ['spectrum', 'utilities'],
  ['internet', 'utilities'], ['waste mgmt', 'utilities'],
  ['walmart', 'groceries'], ['kroger', 'groceries'], ['safeway', 'groceries'], ['aldi', 'groceries'],
  ['trader joe', 'groceries'], ['whole foods', 'groceries'], ['publix', 'groceries'], ['costco', 'groceries'],
  ['wegmans', 'groceries'], ['h-e-b', 'groceries'], ['heb ', 'groceries'], ['food lion', 'groceries'],
  ['grocery', 'groceries'], ['supermarket', 'groceries'], ['instacart', 'groceries'], ['meijer', 'groceries'],
  ['shell', 'transport'], ['chevron', 'transport'], ['exxon', 'transport'], ['bp ', 'transport'],
  ['gas station', 'transport'], ['fuel', 'transport'], ['uber', 'transport'], ['lyft', 'transport'],
  ['metro', 'transport'], ['transit', 'transport'], ['parking', 'transport'], ['toll', 'transport'],
  ['dmv', 'transport'], ['auto repair', 'transport'], ['jiffy lube', 'transport'], ['car payment', 'transport'],
  ['geico', 'insurance'], ['progressive', 'insurance'], ['state farm', 'insurance'], ['allstate', 'insurance'],
  ['insurance', 'insurance'], ['aflac', 'insurance'], ['policy', 'insurance'],
  ['pharmacy', 'health'], ['cvs', 'health'], ['walgreens', 'health'], ['clinic', 'health'],
  ['dental', 'health'], ['doctor', 'health'], ['medical', 'health'], ['hospital', 'health'],
  ['optometr', 'health'], ['therapy', 'health'],
  ['daycare', 'childcare'], ['childcare', 'childcare'], ['babysit', 'childcare'], ['school lunch', 'childcare'],
  ['kindercare', 'childcare'], ['toys r us', 'childcare'],
  ['loan pmt', 'debt'], ['student loan', 'debt'], ['navient', 'debt'], ['nelnet', 'debt'],
  ['card payment', 'debt'], ['credit card pmt', 'debt'], ['sallie mae', 'debt'],
  ['starbucks', 'dining'], ['mcdonald', 'dining'], ['chipotle', 'dining'], ['doordash', 'dining'],
  ['grubhub', 'dining'], ['ubereats', 'dining'], ['uber eats', 'dining'], ['restaurant', 'dining'],
  ['pizza', 'dining'], ['cafe', 'dining'], ['coffee', 'dining'], ['taco', 'dining'], ['diner', 'dining'],
  ['bar &', 'dining'], ['grill', 'dining'], ['deli', 'dining'], ['panera', 'dining'], ['subway', 'dining'],
  ['amazon', 'shopping'], ['target', 'shopping'], ['best buy', 'shopping'], ['ebay', 'shopping'],
  ['etsy', 'shopping'], ['ikea', 'shopping'], ['home depot', 'shopping'], ['lowes', 'shopping'],
  ['macy', 'shopping'], ['nordstrom', 'shopping'], ['nike', 'shopping'], ['shein', 'shopping'],
  ['temu', 'shopping'], ['wayfair', 'shopping'], ['old navy', 'shopping'],
  ['cinema', 'fun'], ['amc ', 'fun'], ['theater', 'fun'], ['ticketmaster', 'fun'], ['steam games', 'fun'],
  ['playstation', 'fun'], ['xbox', 'fun'], ['nintendo', 'fun'], ['concert', 'fun'], ['bowling', 'fun'],
  ['airbnb', 'travel'], ['delta air', 'travel'], ['united air', 'travel'], ['american air', 'travel'],
  ['southwest', 'travel'], ['expedia', 'travel'], ['booking.com', 'travel'], ['hotel', 'travel'],
  ['marriott', 'travel'], ['hilton', 'travel'], ['rental car', 'travel'], ['hertz', 'travel'],
  ['netflix', 'subs'], ['spotify', 'subs'], ['hulu', 'subs'], ['disney+', 'subs'], ['disney plus', 'subs'],
  ['hbo', 'subs'], ['max.com', 'subs'], ['apple.com/bill', 'subs'], ['icloud', 'subs'], ['google storage', 'subs'],
  ['youtube premium', 'subs'], ['prime video', 'subs'], ['audible', 'subs'], ['peacock', 'subs'],
  ['paramount+', 'subs'], ['adobe', 'subs'], ['microsoft 365', 'subs'], ['dropbox', 'subs'],
  ['chatgpt', 'subs'], ['claude.ai', 'subs'], ['patreon', 'subs'], ['nyt', 'subs'], ['subscription', 'subs'],
  ['gym', 'personal'], ['planet fitness', 'personal'], ['la fitness', 'personal'], ['salon', 'personal'],
  ['barber', 'personal'], ['spa', 'personal'], ['sephora', 'personal'], ['ulta', 'personal'],
  ['church', 'gifts'], ['donation', 'gifts'], ['gofundme', 'gifts'], ['red cross', 'gifts'], ['charity', 'gifts'],
  ['tuition', 'education'], ['coursera', 'education'], ['udemy', 'education'], ['textbook', 'education'],
  ['university', 'education'], ['college', 'education'],
  ['overdraft', 'fees'], ['nsf fee', 'fees'], ['service charge', 'fees'], ['atm fee', 'fees'],
  ['annual fee', 'fees'], ['late fee', 'fees'], ['interest charge', 'fees'], ['foreign trans', 'fees'],
  ['vanguard', 'invest'], ['fidelity', 'invest'], ['schwab', 'invest'], ['robinhood', 'invest'],
  ['betterment', 'invest'], ['wealthfront', 'invest'], ['coinbase', 'invest'], ['401k', 'invest'],
  ['brokerage', 'invest'], ['roth ira', 'invest'], ['e*trade', 'invest'],
  ['to savings', 'savings'], ['savings transfer', 'savings'], ['ally bank', 'savings'],
  ['marcus', 'savings'], ['hysa', 'savings'], ['emergency fund', 'savings'],
  ['payroll', 'income'], ['direct dep', 'income'], ['salary', 'income'], ['paycheck', 'income'],
  ['deposit from', 'income'], ['refund', 'income'], ['tax ref', 'income'], ['irs treas', 'income'],
  ['dividend', 'income'], ['interest earned', 'income'], ['reimburse', 'income']
];

const MEMBER_COLORS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];

/* ------------------------------------------------------------------- helpers */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sum = a => a.reduce((x, y) => x + y, 0);
/** Money is stored to the cent. Float arithmetic otherwise leaks 0.30000000000000004. */
const round2 = n => Math.round((+n || 0) * 100) / 100;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = (n, dp = 0) => {
  const v = Math.abs(Number(n) || 0);
  return (n < 0 ? '-' : '') + '$' + v.toLocaleString('en-US',
    { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
const money2 = n => money(n, 2);
const compact = n => {
  const v = Math.abs(Number(n) || 0), s = n < 0 ? '-' : '';
  if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (v >= 1e4) return s + '$' + (v / 1e3).toFixed(0) + 'K';
  return money(n);
};
const pct = (n, dp = 0) => (Number(n) || 0).toFixed(dp) + '%';

const ym = d => String(d).slice(0, 7);                       // '2026-09-14' -> '2026-09'
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const monthLabel = m => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
const monthShort = m => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleString('en-US', { month: 'short' });
};
const addMonths = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
};
const monthsBack = (from, n) => Array.from({ length: n }, (_, i) => addMonths(from, -(n - 1 - i)));
/** Trailing window that never reaches back past the first month with data. */
const histMonths = (end, n = 12) => {
  const act = activeMonths();
  let ms = monthsBack(end, n);
  if (act.length) ms = ms.filter(m => m >= act[0]);
  return ms.length ? ms : [end];
};
const daysInMonth = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

const median = arr => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/**
 * "1 transaction", "4 transactions". English pluralisation is irregular often
 * enough that "(s)" was appearing in the interface, which reads as a form
 * rather than a sentence.
 */
const IRREGULAR = { is: 'are', has: 'have', was: 'were', this: 'these', it: 'they' };
function plural(n, word, pluralForm) {
  const many = pluralForm || IRREGULAR[word] ||
    (/(s|x|z|ch|sh)$/.test(word) ? word + 'es'
      : /[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ies'
        : word + 's');
  return `${(Number(n) || 0).toLocaleString('en-US')} ${n === 1 ? word : many}`;
}
/** The word alone, with no count in front of it. */
const pluralWord = (n, word, pluralForm) => plural(n, word, pluralForm).replace(/^\S+\s/, '');

/** Whether the reader has asked their system for less movement. */
const REDUCED_MOTION = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

/**
 * Say something out loud to a screen reader.
 *
 * The toast cannot carry this by itself. It is visibility:hidden while idle,
 * which takes it out of the accessibility tree, and a live region that appears
 * at the moment its text changes is not announced. So the announcement goes to
 * a region that is always present and never hidden.
 */
function announce(msg) {
  const live = $('#live');
  if (!live) return;
  // the same message twice in a row is only re-announced if the node changes
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 30);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast on';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2400);
  announce(msg);
}

/**
 * Changes apply and persist straight away, but keep a snapshot of the whole
 * document so one press puts it back.
 *
 * Persisting immediately rather than deferring the commit is deliberate: a
 * pending change that only lands after a timer is lost if the tab closes in
 * between, which is a worse failure than a change the user can reverse.
 *
 * This is not only for deletions. Anything a user might not have meant, or
 * might want a moment to reconsider, belongs here: dismissing an insight,
 * adding a rule that recategorises history, changing a category in a row.
 */
function undoable(message, mutate, seconds = 6) {
  const snapshot = JSON.stringify(S);
  mutate();
  save();
  render();

  const t = $('#toast');
  t.className = 'toast on with-action';
  t.innerHTML = `<span>${esc(message)}</span><button class="btn sm" id="undoBtn">Undo</button>`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), seconds * 1000);
  announce(`${message}. Undo is available.`);

  $('#undoBtn').onclick = () => {
    clearTimeout(toast._t);
    S = migrate(JSON.parse(snapshot));
    save();
    render();
    toast('Put back');
  };
}

/**
 * The app's own confirmation, so a destructive step can name exactly what it
 * is about to remove. A native confirm() cannot show a list, cannot be styled
 * for the theme, and reads as a browser warning rather than part of the app.
 */
function confirmAction(o) {
  openModal(o.title, o.body,
    `<button class="btn" data-close>${esc(o.cancelLabel || 'Cancel')}</button>
     <button class="btn ${o.danger === false ? 'primary' : 'danger'}" id="cfmGo">${esc(o.confirmLabel || 'Delete')}</button>`,
    root => {
      const go = root.querySelector('#cfmGo');
      go.onclick = () => { closeModal(); o.onConfirm(); };
      go.focus();
    });
}

/** Shows a message beside the field itself, where it can be read and re-read. */
function fieldError(el, message, kind = 'error') {
  clearFieldError(el);
  el.classList.add('invalid');
  const note = document.createElement('span');
  note.className = kind === 'warn' ? 'field-warn' : 'field-error';
  note.textContent = message;
  note.setAttribute('role', 'alert');
  (el.closest('label') || el.parentNode).appendChild(note);
  el.focus();
  el.setAttribute('aria-invalid', 'true');
}

function clearFieldError(el) {
  el.classList.remove('invalid');
  el.removeAttribute('aria-invalid');
  const holder = el.closest('label') || el.parentNode;
  holder.querySelectorAll('.field-error, .field-warn').forEach(n => n.remove());
}

/**
 * A sanity check on a typed amount, not a limit. Catches the missing decimal
 * point and the extra zero, which are the mistakes that actually happen.
 */
function amountLooksWrong(amt) {
  const abs = Math.abs(+amt || 0);
  if (abs > 1000000) return 'That is over $1,000,000.';
  const largest = S.txns.length ? Math.max(...S.txns.map(t => Math.abs(+t.amount || 0))) : 0;
  if (largest > 0 && abs > largest * 10) {
    return `That is more than ten times your largest recorded transaction (${money(largest)}).`;
  }
  return null;
}

/* --------------------------------------------------------------------- state */

let S = null;               // the whole household document
let UI = {
  tab: 'home',
  month: thisMonth(),
  member: 'all',            // 'all' | member id
  txFilter: { q: '', cat: 'all', account: 'all', sort: 'date', dir: -1 },
  cutPct: 20                // discretionary-trim simulator
};

function blankState() {
  return {
    v: 1,
    createdAt: todayISO(),
    lastBackup: null,
    household: { name: 'My Household' },
    // Filled in by the first-run setup. Colours are assigned by position, so
    // this order is what fixes each person's colour across every chart.
    members: [],
    accounts: [],
    txns: [],
    rules: [],
    budgets: {},
    recurring: [],
    goals: [],
    debts: [],            // instalment loans only; revolving lines live in `cards`
    cards: [],
    cardPayments: [],
    creditProfile: { inquiries: [], oldestAccount: '', reportedScore: null, reportedScoreDate: '' },
    utilHistory: [],
    assets: [],
    profiles: {},            // saved CSV column mappings, keyed by source name
    settings: {
      employerMatchPct: 4,   // % of salary the employer matches
      matchCaptured: false,
      hdhp: false,           // eligible for an HSA
      retireAge: 65,
      currentAge: 35,
      expectedReturn: 7,
      inflation: 3
    }
  };
}

/** True when this browser will actually persist data for the current origin. */
function storageWorks() {
  try {
    const k = '__hwd_probe__';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    return ok;
  } catch (e) { return false; }
}

let saveFailed = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    saveFailed = false;
  } catch (e) {
    if (!saveFailed) {
      saveFailed = true;
      toast('Could not save - storage is blocked or full. Export a backup now.');
      showStorageWarning();
    }
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.txns)) return null;
    return migrate(d);
  } catch (e) { return null; }
}

/**
 * Fills in structures added after a document was first written, so an older
 * saved dashboard (or an imported backup) keeps working instead of being
 * discarded. Never removes anything.
 */
function migrate(d) {
  const base = blankState();
  for (const k of Object.keys(base)) {
    if (d[k] === undefined) d[k] = base[k];
  }
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.creditProfile = { ...base.creditProfile, ...(d.creditProfile || {}) };
  d.v = 1;
  return d;
}

/** Debts that are really revolving credit lines, offered for one-click conversion. */
function cardLikeDebts() {
  const pat = /visa|master\s?card|amex|american express|discover|\bcards?\b|store card|charge card/i;
  return (S.debts || []).filter(x => pat.test(x.name || '') || (+x.apr || 0) >= 15);
}

/** Moves an instalment-list entry into the card list without losing its numbers. */
function convertDebtToCard(id) {
  const d = (S.debts || []).find(x => x.id === id);
  if (!d) return null;
  const bal = +d.balance || 0;
  const card = {
    id: uid(), name: d.name, issuer: '', member: d.member || '', account: '',
    limit: Math.max(bal * 3, 1000),      // placeholder until the real limit is entered
    balance: bal, statementBalance: bal,
    apr: +d.apr || 0, minPayment: +d.minPayment || 0,
    statementDay: 1, dueDay: 21, openedDate: '', annualFee: 0,
    rewards: [{ cat: '*', rate: 1 }], autopay: 'none', paysInFull: false, active: true
  };
  S.cards.push(card);
  S.debts = S.debts.filter(x => x.id !== id);
  return card;
}

/**
 * Records this month's utilisation once, so a trend builds up over time
 * instead of the chart being permanently empty.
 */
function snapshotUtilisation() {
  if (!S.cards || !S.cards.length) return;
  const m = thisMonth();
  const lim = sum(S.cards.filter(c => c.active !== false).map(c => +c.limit || 0));
  if (!lim) return;
  const bal = sum(S.cards.filter(c => c.active !== false).map(reportedBalance));
  const i = S.utilHistory.findIndex(x => x.month === m);
  const row = { month: m, util: (bal / lim) * 100, balance: bal, limit: lim };
  if (i >= 0) S.utilHistory[i] = row; else S.utilHistory.push(row);
  S.utilHistory.sort((a, b) => a.month.localeCompare(b.month));
  if (S.utilHistory.length > 36) S.utilHistory = S.utilHistory.slice(-36);
}

/* --------------------------------------------------- categorisation & lookup */

function normDesc(s) {
  return String(s || '').toLowerCase()
    .replace(/[0-9]{4,}/g, ' ')          // strip card / reference numbers
    .replace(/[^a-z0-9&+.@ -]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * A merchant name a person would write, from the shouting a bank sends.
 *
 * Statements arrive as "DOORDASH*CHIPOTLE 4471" or "KROGER #418", which is a
 * machine's idea of a name. This is display only: matching, rules and the
 * duplicate fingerprint all keep working on the raw text, because changing
 * what is matched would change which category a transaction lands in.
 *
 * Short all-caps runs are left alone, since they are usually real: ALDI, CVS,
 * BP, AMC, IKEA. Anything already mixed case is left alone too, on the grounds
 * that whoever wrote it meant it.
 */
const KEEP_UPPER = new Set(['ATM', 'POS', 'ACH', 'DD', 'USA', 'US', 'UK', 'LLC', 'INC', 'LTD',
  'CO', 'NYC', 'LA', 'SF', 'DC', 'TV', 'AI', 'IT', 'HR', 'DMV', 'IRS', 'CVS', 'BP', 'AMC',
  'ALDI', 'IKEA', 'H-E-B', 'HEB', 'AT&T', 'NYT', 'HBO', 'PS5', 'XL', 'ID']);

function merchantName(raw) {
  const s = String(raw || '').trim();
  if (!s) return s;
  if (s !== s.toUpperCase()) return s;            // already mixed case: leave it
  // banks join names with slashes and stars, so those separate words too
  return s.split(/(\s+|[/*|])/).map(w => {
    if (/^(\s+|[/*|])$/.test(w)) return w;
    const bare = w.replace(/[^A-Za-z&+.-]/g, '');
    if (KEEP_UPPER.has(w) || KEEP_UPPER.has(bare)) return w;
    if (bare.length <= 1) return w;               // initials and stray letters
    return w.toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (m0, pre, ch) => pre + ch.toUpperCase());
  }).join('');
}

/** User rules win over the built-in list; longest match wins within each. */
function autoCat(desc) {
  const d = ' ' + normDesc(desc) + ' ';
  let best = null, bestLen = 0;
  for (const r of S.rules) {
    if (r.match && d.includes(r.match.toLowerCase()) && r.match.length > bestLen) {
      best = r.cat; bestLen = r.match.length;
    }
  }
  if (best) return best;
  for (const [m, c] of DEFAULT_RULES) {
    if (d.includes(m) && m.length > bestLen) { best = c; bestLen = m.length; }
  }
  return best || 'misc';
}

const memberById = id => S.members.find(m => m.id === id);
const memberName = id => (memberById(id) || {}).name || 'Unassigned';
const memberColor = id => {
  const i = S.members.findIndex(m => m.id === id);
  return cssVar(MEMBER_COLORS[i < 0 ? 0 : i % 8]);
};
const accountName = id => (S.accounts.find(a => a.id === id) || {}).name || '-';

/**
 * A ledger date, as short as it can be without becoming ambiguous.
 *
 * "09-14" is fine while you are looking at September 2026. It is not fine on a
 * filtered list that spans years, or on a month you have navigated back to, so
 * the year comes back the moment the row is not obviously from the month on
 * screen. A date that could be either of two years is worse than a long one.
 */
function ledgerDate(iso) {
  return ym(iso) === thisMonth() ? String(iso).slice(5) : String(iso);
}

/**
 * A person's initials, from however many names they gave.
 * "Sam" is S, "Sam Carter" is SC. A blank name falls back to a dash
 * rather than an empty circle, which would look like a rendering failure.
 */
const initials = name => String(name || '').trim().split(/\s+/)
  .filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '-';

/**
 * A person, shown as who they are rather than as an anonymous coloured dot.
 * The colour is the same one they carry on every chart, so the badge and the
 * bar are recognisably the same person.
 */
function memberBadge(id, withName = true) {
  const nm = memberName(id);
  return `<span class="who"><span class="who-i" style="background:${memberColor(id)}"
    aria-hidden="true">${esc(initials(nm))}</span>${withName ? esc(nm) : ''}</span>`;
}

/** Stable fingerprint used to skip duplicate rows across repeated imports. */
function txHash(t) {
  return [t.date, Math.round(t.amount * 100), normDesc(t.desc).slice(0, 28)].join('|');
}

/* -------------------------------------------------------------- derived data */

/** Transactions for a month, respecting the household-member filter. */
function txForMonth(m, member = UI.member) {
  return S.txns.filter(t => ym(t.date) === m && (member === 'all' || t.member === member));
}

/** Core monthly roll-up. Everything downstream reads these fields. */
function monthStats(m, member = UI.member) {
  const tx = txForMonth(m, member);
  const income = sum(tx.filter(t => t.amount > 0 && bucketOf(t.cat) === 'income').map(t => t.amount));
  const spendTx = tx.filter(t => t.amount < 0 && bucketOf(t.cat) !== 'save');
  const saveTx = tx.filter(t => t.amount < 0 && bucketOf(t.cat) === 'save');
  const spend = sum(spendTx.map(t => -t.amount));
  const saved = sum(saveTx.map(t => -t.amount));
  const needs = sum(tx.filter(t => t.amount < 0 && bucketOf(t.cat) === 'need').map(t => -t.amount));
  const wants = sum(tx.filter(t => t.amount < 0 && bucketOf(t.cat) === 'want').map(t => -t.amount));
  const invested = sum(tx.filter(t => t.amount < 0 && t.cat === 'invest').map(t => -t.amount));

  const byCat = {};
  for (const t of tx) {
    if (t.amount >= 0) continue;
    byCat[t.cat] = (byCat[t.cat] || 0) + (-t.amount);
  }
  const byMember = {};
  for (const t of tx) {
    if (t.amount >= 0) continue;
    if (bucketOf(t.cat) === 'save') continue;
    byMember[t.member || 'none'] = (byMember[t.member || 'none'] || 0) + (-t.amount);
  }
  // Unspent income is treated as saved too - money that stayed in the account.
  const net = income - spend - saved;
  const totalSaved = saved + Math.max(0, net);
  return {
    month: m, income, spend, saved, needs, wants, invested,
    net: income - spend - saved,
    totalSaved,
    rate: income > 0 ? (totalSaved / income) * 100 : 0,
    byCat, byMember, count: tx.length
  };
}

/** Months that actually contain data, oldest first. */
function activeMonths() {
  const set = new Set(S.txns.map(t => ym(t.date)));
  return [...set].sort();
}

/** Average monthly "essential" spend over the trailing n months with data. */
function avgEssentials(n = 3) {
  const ms = activeMonths().slice(-n);
  if (!ms.length) return 0;
  return sum(ms.map(m => monthStats(m, 'all').needs)) / ms.length;
}
function avgSpend(n = 3) {
  const ms = activeMonths().slice(-n);
  if (!ms.length) return 0;
  return sum(ms.map(m => monthStats(m, 'all').spend)) / ms.length;
}
function avgIncome(n = 3) {
  const ms = activeMonths().slice(-n);
  if (!ms.length) return 0;
  return sum(ms.map(m => monthStats(m, 'all').income)) / ms.length;
}

const cashAssets = () => sum(S.assets.filter(a => a.type === 'cash').map(a => +a.value || 0));
const investAssets = () => sum(S.assets.filter(a => a.type !== 'cash').map(a => +a.value || 0));
const totalAssets = () => sum(S.assets.map(a => +a.value || 0));
const loanDebt = () => sum((S.debts || []).map(d => +d.balance || 0));
const cardDebt = () => sum(activeCards().map(c => +c.balance || 0));
const totalDebt = () => loanDebt() + cardDebt();
const netWorth = () => totalAssets() - totalDebt();
const minDebtPayments = () =>
  sum((S.debts || []).map(d => +d.minPayment || 0)) +
  sum(activeCards().map(c => +c.minPayment || 0));

/* ------------------------------------------------------------- seed / sample */

/**
 * Builds ~9 months of believable household activity so the dashboard has
 * something to show before the first real import.
 */
function seedSample() {
  const st = blankState();
  st.household.name = 'The Sample Household';
  const mA = { id: uid(), name: 'Alex', role: 'Adult', annualIncome: 86000 };
  const mB = { id: uid(), name: 'Jordan', role: 'Adult', annualIncome: 58000 };
  const mC = { id: uid(), name: 'Riley', role: 'Teen', annualIncome: 0 };
  st.members = [mA, mB, mC];

  const acc = (name, type, member) => ({ id: uid(), name, type, member });
  const a1 = acc('Chase Checking', 'checking', mA.id);
  const a2 = acc('Amex Everyday', 'credit', mA.id);
  const a3 = acc('Cap One Checking', 'checking', mB.id);
  const a4 = acc('Cash App', 'wallet', mB.id);
  const a5 = acc('Teen Debit', 'checking', mC.id);
  const a6 = acc('Chase Freedom Visa', 'credit', mA.id);
  st.accounts = [a1, a2, a3, a4, a5, a6];

  // instalment loans only - revolving lines live in st.cards
  st.debts = [
    { id: uid(), name: 'Car loan (Civic)', balance: 11800, apr: 6.4, minPayment: 342, member: mB.id },
    { id: uid(), name: 'Student loan', balance: 4900, apr: 5.3, minPayment: 110, member: mA.id }
  ];

  // A deliberately mixed set: one card near its limit, one carried balance,
  // one paid in full, and one annual-fee card that does not earn its keep.
  st.cards = [
    { id: uid(), name: 'Chase Freedom Visa', issuer: 'Chase', member: mA.id, account: a6.id,
      limit: 9000, balance: 3400, statementBalance: 3400, apr: 22.9, minPayment: 245,
      statementDay: 18, dueDay: 12, openedDate: '2018-04', annualFee: 0,
      rewards: [{ cat: 'groceries', rate: 3 }, { cat: 'dining', rate: 3 }, { cat: '*', rate: 1 }],
      autopay: 'min', paysInFull: false, active: true },
    { id: uid(), name: 'Amex Everyday', issuer: 'American Express', member: mA.id, account: a2.id,
      limit: 12000, balance: 1200, statementBalance: 1200, apr: 19.4, minPayment: 45,
      statementDay: 6, dueDay: 2, openedDate: '2021-09', annualFee: 0,
      rewards: [{ cat: 'groceries', rate: 2 }, { cat: '*', rate: 1 }],
      autopay: 'statement', paysInFull: true, active: true },
    { id: uid(), name: 'Northline Store Card', issuer: 'Northline', member: mB.id, account: '',
      limit: 2000, balance: 1450, statementBalance: 1450, apr: 27.4, minPayment: 45,
      statementDay: 24, dueDay: 20, openedDate: '2023-11', annualFee: 0,
      rewards: [{ cat: 'shopping', rate: 5 }, { cat: '*', rate: 0 }],
      autopay: 'none', paysInFull: false, active: true },
    { id: uid(), name: 'Horizon Travel Card', issuer: 'Horizon', member: mB.id, account: '',
      limit: 6000, balance: 0, statementBalance: 0, apr: 21.2, minPayment: 0,
      statementDay: 10, dueDay: 5, openedDate: addMonths(thisMonth(), -3), annualFee: 95,
      rewards: [{ cat: 'travel', rate: 3 }, { cat: 'dining', rate: 2 }, { cat: '*', rate: 1 }],
      autopay: 'full', paysInFull: true, active: true }
  ];

  // a clean recent record with one older miss, so the factor has something to show
  st.cardPayments = [];
  for (let i = 1; i <= 16; i++) {
    const mo = addMonths(thisMonth(), -i);
    for (const c of st.cards.slice(0, 2)) {
      st.cardPayments.push({
        id: uid(), cardId: c.id, date: mo + '-' + String(c.dueDay).padStart(2, '0'),
        amount: c.minPayment || 50, onTime: !(i === 14 && c.name.startsWith('Chase')),
        paidInFull: c.paysInFull !== false
      });
    }
  }
  st.creditProfile = {
    inquiries: [
      { date: addMonths(thisMonth(), -3) + '-14', label: 'Horizon Travel Card application' },
      { date: addMonths(thisMonth(), -8) + '-02', label: 'Auto loan shopping' }
    ],
    oldestAccount: '2018-04', reportedScore: null, reportedScoreDate: ''
  };
  // nine months of utilisation, drifting up as the card balance grew
  st.utilHistory = [];
  for (let i = 8; i >= 0; i--) {
    const mo = addMonths(thisMonth(), -i);
    const lim = 29000 - (i > 2 ? 6000 : 0);         // travel card opened three months ago
    const bal = 4200 + (8 - i) * 240;
    st.utilHistory.push({ month: mo, util: (bal / lim) * 100, balance: bal, limit: lim });
  }
  st.assets = [
    { id: uid(), name: 'Emergency savings (Ally)', type: 'cash', value: 7200 },
    { id: uid(), name: 'Checking buffer', type: 'cash', value: 2400 },
    { id: uid(), name: "Alex 401(k)", type: 'retirement', value: 41000 },
    { id: uid(), name: "Jordan 401(k)", type: 'retirement', value: 12500 },
    { id: uid(), name: 'Roth IRA', type: 'retirement', value: 9800 },
    { id: uid(), name: 'Brokerage', type: 'brokerage', value: 5100 }
  ];
  st.goals = [
    { id: uid(), name: 'Emergency fund (6 months)', target: 27000, saved: 7200, date: '2027-06' },
    { id: uid(), name: 'Family trip', target: 5000, saved: 1150, date: '2027-03' },
    { id: uid(), name: 'Home down payment', target: 60000, saved: 5100, date: '2030-01' }
  ];
  st.budgets = {
    groceries: 900, dining: 380, transport: 420, shopping: 300, fun: 160,
    subs: 90, personal: 120, utilities: 340, travel: 200, health: 150
  };
  st.recurring = [
    { id: uid(), name: 'Rent', amount: 2150, cat: 'housing', day: 1, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Car loan payment', amount: 342, cat: 'debt', day: 5, member: mB.id, account: a3.id, active: true },
    { id: uid(), name: 'Auto + renters insurance', amount: 188, cat: 'insurance', day: 8, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Electric', amount: 132, cat: 'utilities', day: 12, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Internet - Xfinity', amount: 79, cat: 'utilities', day: 14, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Phones - T-Mobile', amount: 130, cat: 'utilities', day: 14, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Netflix', amount: 22.99, cat: 'subs', day: 3, member: mA.id, account: a2.id, active: true },
    { id: uid(), name: 'Spotify Family', amount: 19.99, cat: 'subs', day: 7, member: mC.id, account: a2.id, active: true },
    { id: uid(), name: 'Disney+', amount: 15.99, cat: 'subs', day: 9, member: mB.id, account: a2.id, active: true },
    { id: uid(), name: 'iCloud storage', amount: 9.99, cat: 'subs', day: 11, member: mA.id, account: a2.id, active: true },
    { id: uid(), name: 'Adobe Creative Cloud', amount: 22.99, cat: 'subs', day: 18, member: mA.id, account: a2.id, active: true },
    { id: uid(), name: 'Planet Fitness x2', amount: 49.98, cat: 'personal', day: 17, member: mB.id, account: a3.id, active: true },
    { id: uid(), name: 'Audible', amount: 14.95, cat: 'subs', day: 21, member: mA.id, account: a2.id, active: true },
    { id: uid(), name: '401(k) contribution', amount: 430, cat: 'invest', day: 15, member: mA.id, account: a1.id, active: true },
    { id: uid(), name: 'Savings auto-transfer', amount: 300, cat: 'savings', day: 2, member: mA.id, account: a1.id, active: true }
  ];

  // deterministic pseudo-random so the sample looks the same every time
  let seed = 20260905;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const around = (base, spread) => Math.round((base + (rnd() - 0.5) * spread) * 100) / 100;

  const T = [];
  const push = (date, desc, amount, cat, member, account) =>
    T.push({ id: uid(), date, desc, amount: Math.round(amount * 100) / 100, cat, member, account, note: '' });

  const start = addMonths(thisMonth(), -8);
  for (let i = 0; i < 9; i++) {
    const m = addMonths(start, i);
    const dim = daysInMonth(m);
    const day = d => m + '-' + String(Math.min(d, dim)).padStart(2, '0');

    // income - two paychecks each, with a modest raise partway through
    const raise = i >= 5 ? 1.04 : 1;
    push(day(1),  'PAYROLL DIRECT DEP - NORTHWIND LLC', around(2680 * raise, 60), 'income', mA.id, a1.id);
    push(day(15), 'PAYROLL DIRECT DEP - NORTHWIND LLC', around(2680 * raise, 60), 'income', mA.id, a1.id);
    push(day(5),  'DIRECT DEP - CEDAR HEALTH PAYROLL',  around(1810, 45), 'income', mB.id, a3.id);
    push(day(20), 'DIRECT DEP - CEDAR HEALTH PAYROLL',  around(1810, 45), 'income', mB.id, a3.id);
    if (i === 3) push(day(22), 'IRS TREAS 310 TAX REF', 1840, 'income', mA.id, a1.id);
    if (i === 7) push(day(9), 'INTEREST EARNED - ALLY BANK', 24.6, 'income', mA.id, a1.id);

    // fixed recurring items
    for (const r of st.recurring) {
      push(day(r.day), r.name.toUpperCase(), -r.amount, r.cat, r.member, r.account);
    }

    // groceries - weekly-ish
    const gStores = ['KROGER #418', "TRADER JOE'S 553", 'COSTCO WHSE #1122', 'ALDI 76', 'PUBLIX 0912'];
    for (let w = 0; w < 5; w++) {
      push(day(3 + w * 6), pick(gStores), -around(148 + (i > 5 ? 22 : 0), 70),
        'groceries', pick([mA.id, mB.id]), pick([a6.id, a2.id, a3.id]));
    }
    // fuel + transit
    for (let w = 0; w < 4; w++) {
      push(day(4 + w * 7), pick(['SHELL OIL 5747', 'CHEVRON 0034', 'EXXONMOBIL 4471']),
        -around(52, 26), 'transport', pick([mA.id, mB.id]), pick([a1.id, a3.id]));
    }
    push(day(11), 'UBER TRIP', -around(24, 16), 'transport', mB.id, a4.id);
    // dining - creeps up over time, jumps hard in the latest month
    const dineN = 7 + Math.floor(i * 0.6) + (i === 8 ? 6 : 0);
    for (let d = 0; d < dineN; d++) {
      push(day(2 + Math.floor(rnd() * (dim - 2))),
        pick(['DOORDASH*CHIPOTLE', 'STARBUCKS 08812', 'PANERA BREAD 601', 'UBER EATS', 'MOD PIZZA',
              'LOCAL DINER', 'GRUBHUB*THAI HOUSE', "MCDONALD'S F2231"]),
        -around(28, 26), 'dining', pick([mA.id, mB.id, mC.id]), pick([a2.id, a4.id, a5.id]));
    }
    // shopping
    for (let d = 0; d < 4 + (i === 8 ? 3 : 0); d++) {
      push(day(3 + Math.floor(rnd() * (dim - 3))),
        pick(['AMAZON.COM*RT4G9', 'TARGET 00021994', 'BEST BUY 1180', 'OLD NAVY 6612', 'SHEIN.COM']),
        -around(74, 90), 'shopping', pick([mA.id, mB.id, mC.id]), pick([a2.id, a1.id]));
    }
    // fun / personal / health
    push(day(13), pick(['AMC THEATRES 8', 'STEAM GAMES', 'TICKETMASTER']), -around(46, 34), 'fun', pick([mC.id, mA.id]), a2.id);
    push(day(19), pick(['SUPERCUTS 331', 'ULTA BEAUTY 44', 'THE BARBER CO']), -around(41, 24), 'personal', pick([mA.id, mB.id]), a2.id);
    if (i % 2 === 0) push(day(23), 'CVS/PHARMACY #7712', -around(58, 40), 'health', mB.id, a3.id);
    if (i === 2 || i === 6) push(day(16), 'RIVERSIDE DENTAL GROUP', -around(210, 90), 'health', mA.id, a1.id);
    // fees - the quiet leak
    if (i % 3 === 0) push(day(27), 'INTEREST CHARGE ON PURCHASES', -around(96, 30), 'fees', mA.id, a2.id);
    if (i === 4) push(day(6), 'OVERDRAFT FEE', -35, 'fees', mB.id, a3.id);
    // occasional travel
    if (i === 1) push(day(14), 'DELTA AIR LINES 0062', -640, 'travel', mA.id, a2.id);
    if (i === 5) push(day(8), 'AIRBNB * HMQ2XY', -880, 'travel', mA.id, a2.id);
    // teen allowance-ish spending
    push(day(10), 'CASH APP TRANSFER TO RILEY', -60, 'childcare', mA.id, a1.id);
    push(day(12), pick(['ROBLOX', "MCDONALD'S F0092", 'GAMESTOP 41']), -around(22, 14), 'fun', mC.id, a5.id);
  }

  st.txns = T.map(t => ({ ...t, hash: txHash(t) }));
  st.settings.currentAge = 37;
  return st;
}

/* -------------------------------------------------------------- CSV plumbing */

/** RFC-4180-ish parser: handles quoted fields, embedded commas and newlines. */
function parseCSV(text, delim) {
  text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!delim) {
    const head = text.split('\n')[0] || '';
    const counts = [[',', 0], [';', 0], ['\t', 0], ['|', 0]].map(([d]) =>
      [d, (head.match(new RegExp('\\' + d, 'g')) || []).length]);
    counts.sort((a, b) => b[1] - a[1]);
    delim = counts[0][1] > 0 ? counts[0][0] : ',';
  }
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/**
 * Accepts the date shapes bank exports actually emit.
 * `order` disambiguates the numeric d/m forms: 'mdy' (US default) or 'dmy'.
 */
function parseDate(v, order = 'mdy') {
  const s = String(v || '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)))
    return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/))) {
    let y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900;
    let a = +m[1], b = +m[2];
    // an out-of-range component settles it regardless of the declared order
    let mo, d;
    if (a > 12) { d = a; mo = b; }
    else if (b > 12) { mo = a; d = b; }
    else if (order === 'dmy') { d = a; mo = b; }
    else { mo = a; d = b; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/)) || (m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/))) {
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

/** Handles $, commas, parentheses-negatives, trailing CR/DR markers. */
function parseAmount(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/(^-)|(-$)/.test(s)) { neg = true; }
  if (/\bDR\b|\bDEBIT\b/i.test(s)) neg = true;
  s = s.replace(/[^0-9.]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : (neg ? -n : n);
}

/**
 * Sniffs day/month order from a column of raw date strings. An unambiguous
 * value (a component above 12) decides it; otherwise we fall back to US order.
 */
function detectDateOrder(values) {
  let firstOver12 = 0, secondOver12 = 0, iso = 0;
  for (const v of values) {
    const s = String(v || '').trim();
    if (/^\d{4}[-/]/.test(s)) { iso++; continue; }
    const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/]/);
    if (!m) continue;
    if (+m[1] > 12) firstOver12++;
    if (+m[2] > 12) secondOver12++;
  }
  if (iso && !firstOver12 && !secondOver12) return 'iso';
  if (firstOver12 && !secondOver12) return 'dmy';
  return 'mdy';
}

/** Best-effort column guessing so most exports need zero manual mapping. */
function guessMapping(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim());
  const find = (...pats) => {
    for (const p of pats) { const i = h.findIndex(x => x.includes(p)); if (i >= 0) return i; }
    return -1;
  };
  const g = {
    date: find('post date', 'transaction date', 'date', 'time'),
    desc: find('description', 'memo', 'name', 'payee', 'merchant', 'details', 'narration', 'reference'),
    amount: find('amount', 'value', 'transaction amt'),
    debit: find('debit', 'withdrawal', 'money out', 'paid out'),
    credit: find('credit', 'deposit', 'money in', 'paid in'),
    catHint: find('category', 'type')
  };
  // If separate debit/credit columns exist, prefer them over a single amount column.
  g.mode = (g.debit >= 0 && g.credit >= 0) ? 'split' : 'single';
  g.flip = false;
  g.dateOrder = 'mdy';
  return g;
}
