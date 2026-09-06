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
- **It is served from its own subdomain**, so its stored data is isolated from
  every other site. That matters, and the Hosting section explains why.

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

## Hosting, and why the address matters

**Browsers separate stored data by domain, not by folder.** Every site on one
domain shares one storage area, whatever folder it sits in.

This app is served from **householdfinancemanager.netlify.app**, its own
subdomain, so its data is isolated from every other site.

That was a deliberate move. It was previously on GitHub Pages, which puts every
project of an account on one domain. In that arrangement any other project
published by the same account could read this one's data. That was verified
rather than assumed: from an unrelated project site on the same account, the
entire ledger was readable, including every transaction, account name and card
balance. After the move, the same test from the same site returns nothing.

The app still detects the risky arrangement and warns under **Settings, Storage
and durability**, in case a copy is ever hosted somewhere that shares a domain.

| Host | Isolation |
|---|---|
| **Netlify, Cloudflare Pages** | Own subdomain per site. Isolated. |
| **A custom domain** | Isolated. |
| **The single file, run locally** | Isolated, and never touches a server. |
| A GitHub Pages project site | **Shared** with every other project on that account |

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

A meta tag cannot express `frame-ancestors`, so the policy above omits it rather
than claiming protection it does not have. The `_headers` file supplies it as a
real HTTP header on hosts that support them, along with `X-Frame-Options`,
`nosniff`, `no-referrer`, cross-origin isolation, and a `Permissions-Policy`
switching off camera, microphone, geolocation and the rest, none of which this
app uses. GitHub Pages cannot set headers and ignores the file.

Where both a meta policy and a header policy are present, a browser enforces the
stricter of the two, so a directive in one but not the other silently breaks the
app. The build compares them and refuses to ship on a mismatch.

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
