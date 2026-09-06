# Sharing this dashboard with other people

This runs on **Windows, Mac, Android, iPhone and iPad**. Everything below produces
a copy someone else can run **independently** on their own computer. Their
figures live on their machine, yours live on yours, and no copy can see another.
There is no server holding anyone's data, no accounts, and nothing to administer.

If you are the person who just received a copy, read
**[RUN-THIS-APP.md](RUN-THIS-APP.md)** instead. It is written for someone who has
never seen this before.

Current version: **1.4.0**

Live at **https://householdfinancemanager.netlify.app/**, served by Netlify.

Netlify serves it from its own subdomain, so its stored data is isolated from
every other site. That was a deliberate move away from GitHub Pages, which puts
all of an account's projects on one domain and therefore one storage area.
[SECURITY.md](SECURITY.md) has the detail.

Netlify also reads the `_headers` file in this folder, which sets the security
headers a meta tag cannot express. GitHub Pages ignores it.

---

## Build the shareable copies

```bash
python build.py
```

That writes two things into `dist/`:

| Output | What it is |
|---|---|
| `wealth-dashboard.html` | The whole app in **one file**, about 320 KB. Email it, message it, put it on a USB stick. Computers only. |
| `web/` | The same app as a folder, plus the guide, licence and sample statements. Host this to reach phones and tablets, and to let anyone install it properly. |

The build refuses to finish if it finds any personal household data in the
output, so you cannot accidentally ship your own family's details.

### What goes into a build

| File | Purpose |
|---|---|
| `index.html` | Markup, design tokens, all styling |
| `app.js` | Data model, storage, migration, categorisation, CSV parsing |
| `charts.js` | The SVG chart engine |
| `advisor.js` | Health score, debt simulation, projections, insights |
| `credit.js` | Utilisation, credit factor model, rewards, card advice |
| `docparse.js` | PDF, DOCX and DOC text extraction |
| `extract.js` | Statement text into transactions and card fields |
| `views.js` | Screens, forms, setup wizard, import flow, event wiring |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installability |
| `_headers`, `netlify.toml` | Security headers and deploy settings for Netlify |
| `README.md`, `RUN-THIS-APP.md`, `SECURITY.md`, `LICENSE` | Documentation for the recipient |
| `samples/` | Example statements for trying the importer |

Adding or renaming a script means updating `SCRIPTS` in `build.py` **and** the
`<script>` tags in `index.html` **and** the `ASSETS` list in `sw.js`. The build
fails loudly if `index.html` and `build.py` disagree.

---

## Option 1: Send one file

Send someone `dist/wealth-dashboard.html`. They save it anywhere and
double-click it. It opens in their browser and works with no internet, no
install, and no folder to keep together.

This is the right choice for anyone on a **computer**. Send
**RUN-THIS-APP.md** with it, since the single file carries no documentation of
its own. For a phone or tablet, host the folder instead and send a link.

**Worth knowing:**

- Updates mean re-sending the file.
- It opens as a browser tab, not as an app with its own icon and window. If they
  want that, use Option 2.
- A few browsers restrict storage for files opened straight from disk. If they
  see a red "not saving your data" banner, they need Option 2.

## Option 2: Send the folder

Copy `dist/web` onto a USB stick or a shared drive. They open `index.html`
inside it. The guide and the sample statements travel with it.

Identical result to Option 1, but the separate files stay separate, which
matters if they ever want to change something. This is also the folder you host
if you want to reach phones and tablets, or let anyone install it properly.

---

## Installing it as a real app

Installed, it gets its own icon and window and keeps working offline. Browsers
only allow installing from an address, never from a file on disk, so a computer
needs one extra step first: run a tiny local web server and open the app through
it. A phone or tablet installs straight from a hosted link.

### On a computer, from the folder

```bash
python -m http.server 8777
```

Then open `http://localhost:8777` in Chrome or Edge and use the install icon in
the address bar, or the app's own **Settings** tab, then **Install as an app**.
Afterwards it lives in the Start menu and the local server is no longer needed.

Full step-by-step wording for a non-technical person is in
**[RUN-THIS-APP.md](RUN-THIS-APP.md)**, Part 5.

### Every platform

| Platform | How to install | Result |
|---|---|---|
| **Windows** (Chrome, Edge) | Install icon in the address bar, the browser menu, or **Settings, Install as an app** | Own window, Start menu entry, pinnable |
| **Mac** (Safari 17+, Chrome) | Share, then **Add to Dock**. Chrome offers **Install** | Dock icon, own window |
| **Android** (Chrome, Edge) | A prompt appears, or the browser menu, then **Install app** | Home screen icon and app drawer entry |
| **iPhone, iPad** (Safari only) | Share button, scroll down, **Add to Home Screen** | Home screen icon, own window |

The app detects the platform and shows the right steps under **Settings, This
app**, so nobody has to be told twice.

**A phone needs the hosted version.** There is no practical way to open a
downloaded HTML file on iOS or Android, so Option 1 is a computer route only.
Host `dist/web` somewhere and send the link. Any static host works: Netlify
Drop, Cloudflare Pages, GitHub Pages.

**Two things specific to iPhone and iPad.** Chrome and Firefox on iOS cannot add
to the home screen, so it has to be Safari, and there is no automatic prompt
because Apple does not support that API. Safari also reclaims storage from sites
that have not been opened in a while, and ignores the request to keep data
permanent, so tell iPhone users that backups are not optional. Windows, Mac and
Android all honour the persistence request, so this is not a concern there.

### What it is not

It is a **progressive web app**, not a native one. It will not be in the
Microsoft Store, the App Store or Google Play, and there is nothing to submit for
review. For a private tool shared among friends that is an advantage: no store
accounts, no review delays, and updates ship the moment you hand over a new copy.

---

## Automatic deploys from GitHub

The site is connected to this repository, so pushing to `main` publishes it.
There is nothing to drag and no folder to remember.

`netlify.toml` pins the settings in the repository rather than leaving them in
a dashboard: publish directory is the repository root, and there is no build
command, because the files at the root ARE the site. Running `build.py` on the
server would achieve nothing, since it only produces the single-file copy and a
duplicate folder for other hosts.

Publishing from the root also means `_headers` is picked up, which is what puts
the real security headers in force.

### Connecting it, if it ever needs redoing

1. Netlify dashboard, open the site
2. **Site configuration**, then **Build & deploy**, then **Continuous deployment**
3. **Link repository**, choose GitHub, authorise, pick `wealth-dashboard`
4. Branch `main`. Leave build command empty and publish directory as `.`,
   or simply let `netlify.toml` supply them
5. **Deploy**

The first deploy takes about a minute. After that every push is automatic.

### Checking a deploy actually landed

```bash
curl -sI https://householdfinancemanager.netlify.app/ | grep -i content-security-policy
```

If that prints a policy, `_headers` is in force. If it prints nothing, the
deploy predates that file and needs redoing.

---

## Shipping an update

1. Edit the source files in this folder
2. Bump `APP_VERSION` in `app.js` **and** `VERSION` in `sw.js` so they match
3. `python build.py`
4. Re-send the file, or the folder

Bumping the version in `sw.js` matters only for people who installed the app in
their browser. Skip it and they keep running the old version from their cache.
Anyone with it open sees an "update is ready" message on their next visit.

**Updates never touch anyone's data.** The ledger lives in browser storage,
which is separate from the app files.

> **If you are developing on it,** the same caching will serve you stale
> JavaScript after an edit. Either keep DevTools open with "Disable cache"
> ticked, or unregister the worker once from the browser console:
> `navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()))`

---

## What each person sees on first open

A three-step setup asking for their household members, their accounts, and how
they want to start. Nothing is pre-filled with your details, and the build check
guarantees it.

Worth telling them, because there is no support desk behind this:

- **It is completely private.** No account, no server, no tracking of any kind.
  Statements are parsed on their own machine and nothing is ever uploaded.
- **Back up.** Import, then *Download full backup*. If they clear their browser
  data without a backup it is gone, and nobody can recover it for them. The app
  reminds them after 30 days.
- **It does not connect to banks.** They download a statement themselves and
  import it. That is deliberate: it is why there are no passwords to hand over.
- **The advice is a model, not advice.** It applies published frameworks to their
  own numbers. The disclaimers on the Plan and Cards tabs say so plainly, and it
  is worth them reading those once.

### What the importer accepts

| Format | Notes |
|---|---|
| **CSV** | Most accurate. Columns are detected, layouts are remembered per bank. |
| **PDF** | Works on any statement with a real text layer. Reads transactions and, on a card statement, the credit limit, statement balance, minimum payment, APR and due dates. |
| **Word** `.docx` | Works, including tables. Older binary `.doc` is best-effort and flagged as such. |

Two behaviours worth passing on, because they surprise people:

- **Nothing is saved until they press Apply.** The importer produces a proposal
  on a review screen, never a silent edit.
- **Card payments are excluded by default.** Paying a credit card moves money
  between the person's own accounts. Counting it would look like income and
  would double-count the spending once the paying account is imported too. The
  review screen says so and lets them include it anyway.

Scanned PDFs have no text to extract and password-protected PDFs cannot be
opened. Both are reported with what to do instead, so a failure is never
silent and never guessed at.

---

## Restoring your own household

`../my-household-starter.json` has your family already set up. On a fresh
install choose **Import**, then **Restore from a backup**, and pick that file.
Do not include it in anything you send to other people.
