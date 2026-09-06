# How to run the Household Wealth Dashboard

A step by step guide. No technical knowledge needed.

The app lives at **https://householdfinancemanager.netlify.app/**

It runs on a **Windows PC, a Mac, an Android phone or tablet, and an iPhone or
iPad**. Start at Part 1 if you are on a computer, or Part 1B if you are on a
phone.

---

## Part 1: Open it for the first time

**Step 1.** Find the folder called `finance-dashboard` on your computer.

**Step 2.** Look inside it for the file named **`index.html`**.

> Can't see the `.html` part? That is normal. Windows hides file endings by
> default. Look for the file called **index** with a web browser icon next to
> it (a blue "e" for Edge, or a coloured circle for Chrome).

**Step 3.** Double-click **`index.html`**.

**Step 4.** The dashboard opens in your web browser. That is it. It is now
running.

You do not need the internet. You do not need to install anything. You do not
need to create an account or a password.

## Part 1B: Open it on a phone or tablet

A phone cannot open a downloaded file the way a computer can, so on a phone you
open a **web link** instead: https://householdfinancemanager.netlify.app/

**Step 1.** Tap the link. The dashboard opens in your browser.

**Step 2.** Add it to your home screen so it behaves like a normal app and works
without internet:

**On iPhone or iPad**, you must use **Safari** (Chrome will not work for this):

1. Tap the **Share** button, the square with an arrow pointing up
2. Scroll down the list
3. Tap **Add to Home Screen**
4. Tap **Add**

**On Android**, using **Chrome**:

1. A banner may appear offering to install. Tap it, and you are done
2. If not, tap the **three dots** menu
3. Tap **Install app** or **Add to Home screen**

**Step 3.** Close the browser and open the app from your home screen icon. It now
has its own window and works offline.

> **iPhone and iPad: please back up regularly.** Apple's browser clears stored
> website data for apps you have not opened in a while. Adding it to your home
> screen and opening it now and then makes this unlikely, but it can still
> happen. Part 4 shows how to back up. It takes five seconds.

---

### If it opens in the wrong program

If double-clicking opens a text editor full of code instead of the dashboard:

1. Right-click the `index.html` file
2. Choose **Open with**
3. Choose **Google Chrome** or **Microsoft Edge**
4. Tick **Always use this app** so it remembers next time

---

## Part 2: Set up your household

The first time you open it, a welcome screen appears and asks you three short
questions. This takes about a minute.

**Step 1: Who lives here?**

Type a name for your household, for example "The Smith Household".

Then add each person. Type their first name and pick their role from the list
(Adult, Partner, Child, and so on). Click **+ Add another person** for each
extra family member.

> Every person gets their own colour, used on every chart in the app. That is
> how you see at a glance who spent what.

Click **Continue**.

**Step 2: Your accounts**

The app suggests one account for each adult. You can change the names to match
your real accounts, for example "Chase checking" or "Amex card".

Click **+ Add another account** for each extra one: current accounts, savings,
credit cards, cash apps.

Don't worry about getting this perfect. You can change it later in Settings.

Click **Continue**.

**Step 3: How to begin**

Pick one of three options:

| Option | What happens |
|---|---|
| **Import a bank or card statement** | Best choice. Takes you to the import screen. |
| **Add transactions by hand** | Opens a form to type in one purchase at a time. |
| **Explore a sample household first** | Fills the app with a made-up family so you can look around before using your own money. |

> **New to the app?** Choose **Explore a sample household first**. Click through
> every tab to see what it does. When you are ready, go to **Settings** and click
> **Clear all data**. That removes the pretend numbers but keeps your household
> members.

---

## Part 3: Get your spending into it

The app does not connect to your bank. You give it a file from your bank
instead. This is deliberate: you never hand over your banking password to
anything.

It reads three kinds of file:

| File type | How well it works |
|---|---|
| **CSV** (spreadsheet export) | Best. Always accurate. Use this when your bank offers it. |
| **PDF statement** | Very good, as long as the PDF has real text in it. |
| **Word document** (.docx) | Good. Older .doc files work less well. |

### Getting the file from your bank

**Step 1.** Sign in to your bank or credit card website in the normal way.

**Step 2.** Find the option to download your transactions or statement. Banks
word this differently. Look for:

- Download transactions
- Export
- Download activity
- Statements, then Download

**Step 3.** If it offers a choice of format, pick **CSV**. If it only offers
**PDF**, that is fine too.

**Step 4.** Save the file somewhere you can find it, such as your Downloads
folder.

### Bringing it into the app

**Step 5.** In the dashboard, click the **Import** tab at the top.

**Step 6.** Drag your file onto the dotted box, or click the box and pick it.

**Step 7.** Wait a moment. A PDF takes a few seconds to read.

**Step 8.** A review screen appears showing everything the app found. Nothing
has been saved yet. Check it:

- **The list of transactions.** Each row shows a date, a description, a category
  and an amount. Change any category using the dropdown. Click **Drop** on any
  row you do not want.
- **Money in and money out.** If a green message says the signs were verified
  against the running balance, the amounts are correct. If an amber message says
  they were inferred, glance down the list. If money in and money out are
  reversed, click **Swap money in / out**.
- **Which account and which person** these belong to. Set both before applying.
- **Card details** (credit card statements only). If the statement stated a
  credit limit, statement balance, minimum payment, APR or due date, they appear
  with a tick box each. Untick anything you do not want copied across.

**Step 9.** Click the blue **Apply** button.

Repeat for each account. Importing the same file twice is safe: the app
recognises rows it already has and skips them, so nothing is counted twice.

### Two things the app does on purpose

**Card payments are left out.** On a credit card statement, the line that says
something like "PAYMENT THANK YOU" is you moving your own money from your
current account onto the card. It is not income. Counting it would make your
income look bigger than it is, and if you also import the account that paid it,
the same money would be counted twice. Those rows are unticked for you, with a
note. You can include them if you disagree.

**Nothing is saved until you press Apply.** The app never edits your figures
based on a guess.

### If a PDF will not read

Some PDFs are pictures rather than text, usually because the statement was
scanned or photographed. There is no text in them to extract, and the app will
tell you so.

A quick test: open the PDF and try to select a line of text with your mouse. If
nothing highlights, it is a picture. Download the statement again from your bank
and choose CSV.

Password-protected PDFs also cannot be read. Open it in your PDF reader, print
it to a new PDF without the password, and import that instead.

---

## Part 4: Back up your data (please do not skip this)

Everything you enter is stored inside your web browser on this one computer.
There is no online account and no copy anywhere else. If you clear your browser
history, or the computer breaks, the data is gone and nobody can get it back
for you.

Backing up takes five seconds:

**Step 1.** Click the **Import** tab.

**Step 2.** Click **Download full backup (JSON)**.

**Step 3.** Save the file somewhere safe, such as OneDrive, Google Drive, or a
Documents folder.

Do this once a month. The app will remind you if 30 days pass without one.

### To restore a backup

Click **Import**, then **Restore from a backup**, then choose your saved file.
Everything comes back exactly as it was. This also works on a different
computer.

---

## Part 5: Make it feel like a proper app on a computer (optional)

If you want it in your Start menu with its own window and its own icon, instead
of a browser tab, you can install it. This needs one extra step because
browsers only allow installing from an address, not from a file.

On a phone you do not need any of this. Part 1B covers it in two taps.

**On Windows:**

**Step 1.** Open the `finance-dashboard` folder.

**Step 2.** Click once in the address bar at the top of the window (where the
folder path is shown), type `cmd`, and press Enter. A black window opens.

**Step 3.** Type this and press Enter:

```bash
python -m http.server 8777
```

> If it says Python is not recognised, install it free from
> <https://python.org/downloads> (tick **Add Python to PATH** during setup),
> then try again.

**Step 4.** Open Chrome or Edge and go to:

```bash
http://localhost:8777
```

**Step 5.** Look at the right-hand side of the address bar for a small install
icon (a screen with a downward arrow). Click it, then click **Install**.

Alternatively, open the dashboard's **Settings** tab and click
**Install as an app**.

**Step 6.** The dashboard now appears in your Start menu like any other program.
You can pin it to the taskbar. It works offline from now on, and you can close
the black window.

**On a Mac:** the steps are the same, but use the Terminal app and type
`python3 -m http.server 8777` instead.

> **Do you need to do this?** No. Double-clicking `index.html` works perfectly
> well and is what most people should do. Installing is only about convenience.

---

## Part 6: Everyday use

| What you want to do | Where to go |
|---|---|
| See this month at a glance | **Overview** |
| Look through individual purchases | **Spending** |
| Set spending limits per category | **Budget** |
| Find subscriptions you forgot about | **Recurring** |
| Track credit cards and your credit score | **Cards & Credit** |
| See net worth, debts and savings goals | **Wealth** |
| Get advice on what to do next | **Plan & Advice** |
| Add another statement, or back up | **Import** |
| Add people, accounts and preferences | **Settings** |

Use the arrows either side of the month name at the top to move between months.

Use the coloured name buttons under the tabs to see one person's spending on
its own.

Everything saves by itself. There is no Save button and there does not need to
be one.

---

## Common questions

**Is my financial information sent anywhere?**
No. There is no server involved. Nothing you type ever leaves your computer.
You can disconnect from the internet entirely and the app still works.

**Do I need to pay for it?**
No.

**Does it need my bank password?**
No, and it never will. You download a file from your bank yourself and give the
file to the app. The file is read on your own computer and never uploaded.

**What file types can I import?**
CSV, PDF and Word (.docx). CSV is the most accurate, so use it when your bank
offers it. A PDF works as long as it contains real text rather than being a
scan.

**Can my family use it on their own computers?**
Yes. Copy the folder to them, or send them the single file version. Each copy is
completely separate, with its own data. Nobody can see anyone else's numbers.

**I closed the tab. Did I lose everything?**
No. Open `index.html` again and it is all still there.

**Can I use it on my phone?**
Yes. Open https://householdfinancemanager.netlify.app/ and add it to your home screen, as in Part 1B.
Buttons grow to a comfortable size, pop-up screens fill the display, and the
layout becomes a single column. Importing statements works too, though picking
files out of a bank app is fiddlier on a phone than on a computer.

**Will my phone and my computer share the same figures?**
No. Each device keeps its own separate copy. To move your figures across, back
up on one device (Part 4) and restore that file on the other.

**Nothing shows up on the charts.**
The app needs transactions before it can show anything. Go to **Import** and add
a statement, or load the sample data from **Settings** to see how it looks.

**Can I trust the advice?**
Treat it as a well-informed calculator, not a financial advisor. It applies
widely published planning rules to the numbers you gave it. It does not know
your tax situation, your job security, or your family circumstances, and it
never recommends a specific investment. The credit score it shows is an estimate
built from your own entries, not your real score from a credit bureau. For
decisions that matter, talk to a licensed advisor.
