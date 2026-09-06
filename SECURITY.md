# Security

This app holds household financial records, so it is worth being precise about
what protects them and what does not.

Version 1.4.0.

---

## The short version

- **Nothing is ever sent anywhere.** There is no server, no account, no
  telemetry. The only network request the app makes is the offline cache
  fetching its own files.
- **No third-party code.** Zero dependencies, so there is no supply chain to
  compromise.
- **Your data lives in one browser on one device**, unencrypted, in that
  browser's local storage.
- **The one real caveat is hosting.** See below. It matters.

---

## Where your data actually lives

In browser local storage, under the key `hwd.v1`, as plain JSON.

That means:

| Who can read it | Yes or no |
|---|---|
| The author of this app | No. It never leaves your device. |
| Your internet provider, or anyone on your network | No. It is never transmitted. |
| Anyone with physical access to your unlocked device | **Yes** |
| Any script running on the **same web address** | **Yes** |
| Browser extensions with page access | **Yes** |

Local storage is not encrypted. A passphrase could be added, but in a static
app the key has to live somewhere the app can reach, so it would raise the bar
against casual reading rather than provide real cryptographic protection. It is
not currently implemented, and the honest framing is: treat this like a
spreadsheet on your desktop, not like a bank vault.

---

## The hosting caveat, which is the important one

**Browsers separate stored data by domain, not by folder.**

GitHub Pages puts every project of an account on one domain. So
`yourname.github.io/wealth-dashboard/` and `yourname.github.io/anything-else/`
are the same domain as far as the browser is concerned, and share one storage
area.

Any other project you publish there can read everything this dashboard has
saved. This was verified, not assumed: from an unrelated project site on the
same account, the entire ledger was readable, including every transaction,
account name, and card balance.

This is a property of the hosting, not a flaw in the app. The app detects it and
shows a warning under **Settings, Storage and durability**.

### What to do about it

| Option | Isolation |
|---|---|
| **Netlify or Cloudflare Pages** | Each site gets its own subdomain, so storage is fully isolated. Free. |
| **A custom domain**, e.g. `wealth.yourdomain.com` | Fully isolated. |
| **The single file, run locally** | Fully isolated, and never touches a server. |
| GitHub Pages project site | **Shared** with every other project on that account |

If you keep it on GitHub Pages, use it as a demo and a download point, and enter
real figures only in a copy on its own address or the local single-file build.

---

## What was tested

**Injection from imported statements.** Statement descriptions are attacker
controlled: anyone who sends you a CSV or PDF chooses that text. Six payload
shapes (`<img onerror>`, `<svg onload>`, script tags, quote and tag breakouts)
were pushed through the real import pipeline and planted in household names,
account names, card names, debts, goals and recurring items, then rendered
across all nine tabs and sixteen dialogs. **None executed.** The payload text
appears as inert visible text, which confirms the test reached the rendering
code rather than being filtered earlier.

**Prototype pollution.** A crafted backup containing `__proto__` and
`constructor.prototype` left `Object.prototype` untouched.

**Malicious documents.** The PDF and Word readers accept untrusted binary, so
they enforce limits: files over 25 MB are refused before parsing, decompressed
output is capped at 80 MB, and any parse exceeding 20 seconds is stopped. A
299 KB payload that expands to 300 MB is refused in about half a second.

**Corrupt backups.** Restore validates the shape of every section, renders the
result before committing it, and rolls back to your existing data if anything
fails. A damaged file cannot destroy good data.

---

## Content Security Policy

The app ships a strict policy:

```
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
manifest-src 'self'; worker-src 'self'; media-src 'self';
base-uri 'none'; form-action 'none'; object-src 'none'
```

Escaping is what actually stops injection. This is the second line: even if a
gap appeared, injected markup could not load a script, contact any server, or
embed anything.

`'unsafe-inline'` appears **only** for styles, because the interface uses inline
style attributes. Scripts get no such allowance. The single-file build inlines
its scripts, so the build computes a SHA-256 hash for each one and lists those
instead, rather than weakening the policy.

`frame-ancestors` is deliberately absent: browsers ignore it in a meta tag, and
claiming it would be false comfort. Set it as a real header if your host allows.

---

## Known limitations

- **Local storage is not encrypted.** Anyone at your unlocked device, or any
  browser extension with page access, can read it.
- **On iPhone and iPad, storage is fragile.** Safari clears data for sites not
  opened in a while and ignores the request to keep it permanent. Back up.
- **No integrity checking on backups.** A backup file is plain JSON and can be
  edited by anyone who has it. Restore validates structure, not authenticity.
- **The single-file build cannot be updated automatically.** Security fixes
  require sending a new file.

---

## Reporting something

Open an issue on the repository. Since there is no server and no user accounts,
there is nothing to take offline in a hurry, but do say if you find a way to
make imported content execute.
