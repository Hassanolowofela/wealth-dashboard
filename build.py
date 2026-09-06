#!/usr/bin/env python3
"""
Build the distributable copies of the dashboard.

    python build.py

Produces, in dist/:

  wealth-dashboard.html   the entire app inlined into one file - email it,
                          put it on a USB stick, double-click to run
  web/                    the same app as a folder, ready to upload to any
                          static host (GitHub Pages, Netlify, Cloudflare...)

No dependencies beyond the standard library and Pillow (only for the icons,
which are already committed - the build reuses them if present).
"""

import base64
import hashlib
import mimetypes
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
WEB = DIST / "web"

SCRIPTS = ["app.js", "charts.js", "advisor.js", "credit.js", "docparse.js", "extract.js", "views.js"]
WEB_FILES = SCRIPTS + ["index.html", "manifest.webmanifest", "sw.js",
                       "README.md", "RUN-THIS-APP.md", "SECURITY.md", "LICENSE"]


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def build_single_file() -> Path:
    """Inline every script and icon so the result depends on nothing."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # icons and manifest become data URIs; a lone file has nowhere to fetch from
    for tag_pat, icon in [
        (r'<link rel="icon"[^>]*href="([^"]+)"[^>]*>', "icons/favicon-32.png"),
        (r'<link rel="apple-touch-icon"[^>]*href="([^"]+)"[^>]*>', "icons/icon-180.png"),
    ]:
        p = ROOT / icon
        if p.exists():
            html = re.sub(tag_pat, lambda m, u=data_uri(p): m.group(0).replace(m.group(1), u), html)

    # a manifest and service worker are meaningless in a standalone file
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)

    # replace each <script src> with the file's contents
    for name in SCRIPTS:
        src = (ROOT / name).read_text(encoding="utf-8")
        # </script> inside a string literal would close the tag early
        src = src.replace("</script>", "<\\/script>")
        block = f"<script>\n/* ===== {name} ===== */\n{src}\n</script>"
        pattern = f'<script src="{name}"></script>'
        if pattern not in html:
            raise SystemExit(f"index.html has no <script src=\"{name}\"> tag to replace")
        html = html.replace(pattern, block)

    # A standalone file has no sw.js beside it, and needs none - every asset is
    # already inside it. Registering would just log a 404, so disable it.
    old = "function registerServiceWorker() {"
    if old not in html:
        raise SystemExit("registerServiceWorker() not found - build needs updating")
    html = html.replace(
        old,
        "function registerServiceWorker() {\n"
        "  return;  // single-file build: everything is already inlined, no worker needed",
        1,
    )

    # The scripts are inline now, so `script-src 'self'` would block them all.
    # Use each script's content hash rather than 'unsafe-inline', which would
    # throw away the protection the policy exists to provide.
    hashes = []
    for block in re.findall(r"<script>(.*?)</script>", html, re.S):
        digest = base64.b64encode(hashlib.sha256(block.encode("utf-8")).digest()).decode()
        hashes.append(f"'sha256-{digest}'")
    if not hashes:
        raise SystemExit("no inline scripts found; CSP hashing needs updating")
    html = html.replace("script-src 'self';",
                        "script-src " + " ".join(hashes) + ";", 1)

    DIST.mkdir(exist_ok=True)
    out = DIST / "wealth-dashboard.html"
    out.write_text(html, encoding="utf-8")
    return out


def build_web() -> Path:
    """
    A plain folder ready to upload to a static host.

    Copies over the top rather than deleting first: on Windows a synced folder
    (OneDrive, Dropbox) or an open file handle makes rmtree fail, and losing the
    build to someone else's file lock is a pointless way to fail.
    """
    WEB.mkdir(parents=True, exist_ok=True)
    written = set()
    for name in WEB_FILES:
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, WEB / name)
            written.add(name)
    for folder in ("icons", "samples"):
        if (ROOT / folder).exists():
            shutil.copytree(ROOT / folder, WEB / folder, dirs_exist_ok=True)
            written.update(f"{folder}/{p.name}" for p in (ROOT / folder).iterdir())
    # a .nojekyll file stops GitHub Pages from ignoring files it thinks are drafts
    (WEB / ".nojekyll").write_text("", encoding="utf-8")
    written.add(".nojekyll")

    # drop anything left over from an older build so stale files are never shipped
    for p in sorted(WEB.rglob("*"), reverse=True):
        if p.is_dir():
            continue
        rel = p.relative_to(WEB).as_posix()
        if rel not in written:
            try:
                p.unlink()
            except OSError:
                print(f"  note: could not remove stale {rel} (file in use)")
    return WEB


def private_names() -> list:
    """
    Names that must never appear in a build, read from `.private-names`
    (one per line, gitignored). Keeping the list out of this file matters
    because this file is public: hardcoding the names would leak exactly what
    the check exists to protect.
    """
    f = ROOT / ".private-names"
    if not f.exists():
        return []
    return [ln.strip() for ln in f.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.startswith("#")]


def check_no_personal_data() -> list:
    """A distributable build must not carry anyone's household in it."""
    names = private_names()
    hits = []
    for f in list(DIST.rglob("*.html")) + list(DIST.rglob("*.js")) + list(DIST.rglob("*.json")):
        text = f.read_text(encoding="utf-8", errors="ignore")
        for n in names:
            if n in text:
                hits.append(f"{f.relative_to(DIST)}: {n}")
    return hits


if __name__ == "__main__":
    single = build_single_file()
    web = build_web()
    kb = single.stat().st_size / 1024

    leaks = check_no_personal_data()
    print(f"  dist/wealth-dashboard.html   {kb:.0f} KB  (one file, double-click to run)")
    print(f"  dist/web/                    {len(list(web.rglob('*')))} files (upload to any static host)")
    if leaks:
        print("\n  REFUSING TO SHIP - personal data found in the build:")
        for h in leaks:
            print(f"    {h}")
        raise SystemExit(1)
    if private_names():
        print("\n  checked: no personal household data in the build")
    else:
        print("\n  note: no .private-names file, so that check was skipped")
