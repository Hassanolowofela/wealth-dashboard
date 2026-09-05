# Household Wealth Dashboard Reference

The detailed material behind the [README](README.md): how importing works, how every number is calculated, where it runs, how to share it, and how to customise it.

---

## Setup details

The three-step setup asks who lives in your household, what accounts you have, and how you'd like to start. Each person you add gets a fixed colour used on every chart, so you can see at a glance who spent what. You can re-run it any time from **Settings → Run setup again**, and add or edit people there too.

**Explore a sample household** loads a fictional family with 9 months of activity, so every screen has something to show. Clear it later from **Settings → Clear all data**, which empties the ledger but keeps your own household members.

### If the dashboard says it can't save

Some browsers restrict storage for files opened directly from disk. If you see a red "not saving your data" banner, serve the folder over localhost instead. From this folder, run:

```bash
python -m http.server 8777
```

Then open <http://localhost:8777>. Chrome, Edge and Firefox normally work fine with a plain double-click; this is only a fallback.

---

## Importing statements

The **Import** tab reads **CSV**, **PDF** and **Word** statements from any bank, credit card, wallet or transfer app. Drop the file in, or paste rows directly. Everything is parsed on your own machine; no file is ever uploaded.

### CSV exports

- **Columns are detected automatically.** Date, description and amount are found by header name. Separate debit/credit columns work as well as a single signed amount column.
- **Check the date order.** The importer works out whether dates are month-first or day-first and tells you the range it read. If a one-month statement appears to span six months, flip the *Date order* dropdown.
- **Layouts are remembered.** Save the mapping once per bank and the next file from that source needs no setup.

### PDF and Word statements

There are no column headers to map in a PDF, so the reader works by pattern: it finds the dated lines, finds the money on them, and works out the direction.

- **Signs are verified arithmetically where possible.** If the statement has a running balance column, the reader checks that each row's amount matches the movement in that balance, and derives money in versus money out from it rather than guessing. The review screen says which method was used.
- **Card fields are read from the statement.** Credit limit, statement balance, minimum payment, APR, payment due date and statement closing date are pulled from the summary and offered as tick-box updates to the matching card.
- **The rows are reconciled.** Where the statement states a previous and a new balance, the extracted rows are added up and compared. A mismatch is reported rather than hidden.
- **Card payments are excluded by default.** A payment landing on a card is an internal transfer, not income, and counting it would double-count the spending once the paying account is imported too.
- **Nothing is written until you press Apply.**

Scanned PDFs have no text to extract and password-protected PDFs cannot be opened. Both are reported with what to do instead. Old binary `.doc` files are read on a best-effort basis and flagged as such; re-saving as `.docx` or PDF gives a clean result.

### Everything else

Duplicates are fingerprinted on date, amount and merchant, so re-importing an overlapping statement never double-counts. Categories are assigned on arrival by a merchant-matching rule set, and correcting one on the Spending tab can be promoted to a permanent rule.

You can also add transactions by hand (**+ Transaction**) and declare recurring bills once on the **Recurring** tab.

### Sample files

`samples/` contains a credit card statement PDF, a bank statement PDF, a Word statement using day-first dates, and two CSVs in different shapes. Import them to see each path work.

---

## The tabs

| Tab | What it's for |
|---|---|
| **Overview** | The month at a glance: income, spending, what's left, savings rate, 12-month trend, where the money went, and a per-person split. |
| **Spending** | Every transaction, filterable and searchable. Change a category inline. |
| **Budget** | Per-category budgets with a pace marker showing where you *should* be today, plus a projected month-end total. "Suggest budgets from my history" builds a starting set from your own medians. |
| **Recurring** | Subscriptions and bills ranked by **annual** cost, including repeat charges detected in your transactions that you never declared. |
| **Cards & Credit** | Every card's utilisation, payment timing, a credit-factor scorecard, a pay-before-close simulator, rewards routing, and the cost of closing a card. |
| **Wealth** | Net worth, assets, debts, savings goals, and a debt-payoff simulator comparing avalanche vs snowball vs minimum payments. |
| **Plan & Advice** | The health score, the priority ladder, findings from this month, and long-run projections. |
| **Import** | Bring data in; take backups out. |
| **Settings** | Household members, accounts, categorisation rules, and the assumptions behind every projection. |

Use the **member chips** under the header on Overview and Spending to filter the whole view to one person. Each member keeps the same colour on every chart.

---

## How the numbers are worked out

So you can check them rather than trust them.

**Savings rate** = (money moved to savings/investments + money left unspent) ÷ income. Unspent income counts, because it stayed in the household.

**Essential spending**, the basis of the emergency fund and FI targets, is everything in the *need* categories (housing, utilities, groceries, transport, insurance, healthcare, childcare, debt payments). Categories are classified as need / want / save in `app.js`; change the `bucket` field if your situation differs.

**Health score (0-100)** is six weighted components:

| Component | Weight | Full marks at |
|---|---|---|
| Savings rate | 25 | 20% of income |
| Emergency fund | 20 | 6 months of essentials |
| Debt burden | 15 | 0% of income in required payments |
| Investing rate | 20 | 15% of income |
| Budget adherence | 10 | 90% of budgeted categories held |
| Spending stability | 10 | month-to-month swing under 8% |

**Debt payoff** is a real month-by-month amortisation: interest accrues, minimums are paid, then everything left goes to the focus debt: highest APR first (avalanche) or smallest balance first (snowball). Credit-card balances and instalment loans are ordered together, since a 27% store card should be cleared before a 5% student loan.

### Credit cards

Add each card with four numbers and everything else follows: **credit limit**, **balance**, **statement close day**, **payment due day**.

**Utilisation** = reported balance ÷ limit, tracked per card *and* in aggregate, because both are scored. The reported balance is the **statement balance**, not today's. That is why the statement close day matters more than the due date:

> Paying before the statement closes lowers what gets reported.
> Paying by the due date only protects your payment history.
> They are usually about three weeks apart, and most people only know about the second one.

The **pay-before-close simulator** shows exactly what a given payment does to the reported figure, and what it would take to reach 9%.

**The score shown is a model, not your score.** It applies the published FICO factor weights (payment history 35%, utilisation 30%, length of history 15%, credit mix 10%, new credit 10%) to the data you entered, then maps the weighted result onto the 300-850 range. Factors with no data are dropped and the rest renormalised, and the range shown widens when the model had less to work with. The bureaus hold records this app never sees and lenders use several scoring versions, so treat the number as a way to find which factor has the most slack. Record your real score alongside it with **Record my real score**; free scores are available from most card issuers and your statutory reports from annualcreditreport.com.

**Rewards routing** compares each card's category rates against what you actually spend. It only ever recommends cards you mark as paid in full, because steering spending onto a card carrying a balance loses money on every purchase, no matter the cashback rate. Rent, loan payments, insurance and fees are excluded, since they generally can't go on a card at face value.

**Closing a card** removes its limit from the utilisation calculation but not the debt you still owe the balance. The panel shows the exact utilisation cost per card, and flags your oldest account, whose age you can never rebuild.

**Projections** use standard future-value compounding at the rate set in Settings (7% default). The FI target is 25× annual essential spending, the usual companion to the 4% withdrawal rule.

---

## What this is not

The Plan tab applies **published, general personal-finance frameworks** to your own figures. It does not know your tax situation, employment terms, health, insurance, dependants, or risk tolerance, and **it never recommends a specific investment, fund, or security**. Contribution limits and tax rules change every year, so verify current figures before acting on anything here.

The credit score is a model of published factor weights, not a score any lender will use, and it cannot predict an approval decision.

For decisions that turn on your full circumstances, talk to a licensed financial advisor or a CPA. This tool is a calculator and a prompt for better questions, not a substitute for advice.

---

## Backups

Your data lives in one browser on one machine. It is gone if you clear site data, switch browsers, or the drive fails.

**Import → Download full backup (JSON)** writes everything to a file. Do it monthly. **Restore from a backup** puts it back, on this machine or any other.

---

## Where it runs

One codebase that installs like a native app on every platform below. It is not in any app store and does not need to be.

| Platform | Runs | Installs as an app | Works offline |
|---|:---:|:---:|:---:|
| **Windows** (Chrome, Edge, Firefox) | yes | yes | yes |
| **Mac** (Chrome, Edge, Safari 17+) | yes | yes | yes |
| **Android** (Chrome, Edge, Samsung) | yes | yes | yes |
| **iPhone and iPad** (Safari) | yes | yes | yes |

On a computer you can also just double-click `index.html` with no install and no server. On a phone that route does not exist, because phones have no good way to open a downloaded HTML file, so a phone needs the hosted version. See [DEPLOY.md](DEPLOY.md).

Touch devices get larger controls automatically, dialogs go full screen below 700px, and the layout collapses to one column. **Settings, This app** shows the right install steps for whatever you are on.

**Two things specific to iPhone and iPad.** Installing is done by hand through Safari's Share menu, because Apple does not support the automatic install prompt, and it must be Safari rather than Chrome. Safari also reclaims storage from sites you have not opened in a while and ignores the standard request to keep data permanent, so on iOS a backup is not optional. Adding the app to the Home Screen and opening it regularly makes eviction unlikely but not impossible. Windows, Mac and Android all honour the persistence request.

---

## Sharing it with other people

Anyone can run their own independent copy on their own computer. Their figures stay on their machine, yours stay on yours, and no copy can see another. There is no server holding anyone's data.

```bash
python build.py
```

That produces `dist/wealth-dashboard.html`, the entire app in one file. Email it or copy it to a USB stick. They save it anywhere and double-click it.

You can also just copy the whole `finance-dashboard` folder across.

The build refuses to finish if it finds personal household data in the output, so you cannot accidentally share your own family's details.

Full instructions are in **[DEPLOY.md](DEPLOY.md)**. The plain-language guide for whoever receives it is **[RUN-THIS-APP.md](RUN-THIS-APP.md)**.

---

## Files

```
index.html            markup, design tokens, all styling
app.js                data model, storage, migration, categorisation, CSV parsing
charts.js             dependency-free SVG chart engine
advisor.js            health score, debt simulation, projections, insights
credit.js             utilisation, credit factor model, rewards, card advice
docparse.js           PDF, DOCX and DOC text extraction, no libraries
extract.js            statement text to transactions and card fields
views.js              screens, forms, setup wizard, import flow, event wiring
sw.js                 service worker - offline support and installability
manifest.webmanifest  app name, icons and display mode for installation
build.py              produces the shareable single file and web folder
icons/                app icons
samples/              example bank exports for testing the importer
```

No build step needed to *run* it, no dependencies, no network. Edit a file, refresh the page. `build.py` is only for producing copies to give away.

### Customising

- **Categories** live in the `CATS` array at the top of `app.js`. Each entry's `bucket` (`need` / `want` / `save` / `income`) drives the 50/30/20 view and every essentials-based calculation.
- **Merchant rules**. `DEFAULT_RULES` in `app.js` for the built-in list; per-household rules are added through Settings and always win.
- **Planning assumptions** (expected return, employer match, age, and HSA eligibility) are all in Settings.
- **Colours**: the palette is defined once as CSS custom properties at the top of `index.html` and is colour-vision-deficiency checked in both light and dark modes.
