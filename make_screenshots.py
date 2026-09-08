#!/usr/bin/env python3
"""
Capture the screenshots used by INSTALL.md.

    python make_screenshots.py

Serves this folder on a spare port, drives a real Chromium through the app, and
writes PNGs into docs/img/. Re-run it after any visual change so the guide never
shows a version of the app that no longer exists.

Every shot uses sample data, never a real household, so the images are safe to
publish.
"""

import asyncio
import http.server
import socket
import socketserver
import threading
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "docs" / "img"
DESKTOP = {"width": 1280, "height": 860}
PHONE = {"width": 390, "height": 844}


def serve(directory: Path):
    """Background static server on a free port."""
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(directory), **kw)

        def log_message(self, *a):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{port}"


async def shot(page, name, clip_selector=None, full=False):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    await page.wait_for_timeout(320)
    if clip_selector:
        el = await page.query_selector(clip_selector)
        if el:
            await el.screenshot(path=str(path))
            print(f"  {path.relative_to(ROOT)}")
            return
    await page.screenshot(path=str(path), full_page=full)
    print(f"  {path.relative_to(ROOT)}")


async def fresh(ctx, base, viewport=None):
    """A page with no saved data, so the first-run wizard always appears."""
    page = await ctx.new_page()
    if viewport:
        await page.set_viewport_size(viewport)
    await page.goto(base + "/index.html")
    await page.evaluate("localStorage.clear()")
    await page.reload()
    await page.wait_for_function("typeof render === 'function'")
    await page.wait_for_timeout(400)
    return page


async def main():
    httpd, base = serve(ROOT)
    print(f"serving on {base}")
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            ctx = await browser.new_context(viewport=DESKTOP, device_scale_factor=2)

            # ---------------- 01: the welcome screen ----------------
            page = await fresh(ctx, base)
            await shot(page, "01-welcome")

            # ---------------- 02: household members ----------------
            await page.fill("#wzName", "The Smith Household")
            await page.fill("[data-person] .pName", "Alex")
            await page.click("#wzAddPerson")
            await page.wait_for_timeout(150)
            await page.fill("[data-person]:nth-of-type(2) .pName", "Jordan")
            await page.select_option("[data-person]:nth-of-type(2) .pRole", "Partner")
            await page.click("#wzAddPerson")
            await page.wait_for_timeout(150)
            await page.fill("[data-person]:nth-of-type(3) .pName", "Sam")
            await page.select_option("[data-person]:nth-of-type(3) .pRole", "Child")
            await shot(page, "02-household")

            # ---------------- 03: accounts ----------------
            await page.click("#wzNext")
            await page.wait_for_timeout(300)
            await shot(page, "03-accounts")

            # ---------------- 04: how to start ----------------
            await page.click("#wzNext")
            await page.wait_for_timeout(300)
            await shot(page, "04-how-to-start")

            # ---------------- 05: the import screen ----------------
            await page.evaluate("S=seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); closeModal(); go('import');")
            await shot(page, "05-import-tab")

            # ---------------- 06: statement review ----------------
            await page.evaluate("""async () => {
                const f = new File([await fetch('samples/sample_card_statement.pdf')
                    .then(r => r.blob())], 'sample_card_statement.pdf');
                await statementFlow(f);
            }""")
            await page.wait_for_timeout(1200)
            await shot(page, "06-review")

            # ---------------- 07: overview ----------------
            await page.evaluate("closeModal(); S=seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); UI.month=thisMonth(); go('home'); window.scrollTo(0,0);")
            await shot(page, "07-overview")

            # ---------------- 08: cards and credit ----------------
            await page.evaluate("go('cards'); window.scrollTo(0,0);")
            await shot(page, "08-cards")

            # ---------------- 09: plan and advice ----------------
            await page.evaluate("go('plan'); window.scrollTo(0,0);")
            await shot(page, "09-plan")

            # ---------------- 10: backup ----------------
            await page.evaluate("go('import'); window.scrollTo(0, document.body.scrollHeight);")
            await shot(page, "10-backup")

            # ---------------- 11: settings, install ----------------
            await page.evaluate("go('settings'); window.scrollTo(0, document.body.scrollHeight);")
            await shot(page, "11-settings-install")
            await page.close()

            # ---------------- phone shots ----------------
            pctx = await browser.new_context(
                viewport=PHONE, device_scale_factor=3, is_mobile=True, has_touch=True,
                user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
                            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
                            "Mobile/15E148 Safari/604.1"))
            p2 = await fresh(pctx, base)
            await p2.evaluate("S=seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); closeModal(); UI.month=thisMonth(); go('home'); window.scrollTo(0,0);")
            await shot(p2, "13-phone-overview")
            await p2.evaluate("go('cards'); window.scrollTo(0,0);")
            await shot(p2, "14-phone-cards")
            await p2.evaluate("go('settings'); window.scrollTo(0, document.body.scrollHeight);")
            await shot(p2, "15-phone-install")
            await p2.close()

            # ---------------- README visuals ----------------
            # These are framed for a repository front page rather than a manual:
            # tight crops with no empty page below, and a dark variant.
            rctx = await browser.new_context(viewport={"width": 1360, "height": 900},
                                             device_scale_factor=2)
            r = await fresh(rctx, base)
            await r.evaluate("S=seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); closeModal(); UI.month=thisMonth();")

            async def framed(name, setup, until, theme=None, cap=1000, pad=26):
                """
                Crop to the bottom of a named landmark rather than to a guessed
                height, so the image never ends halfway through a chart or a
                row of figures. A fixed height looks broken the moment the
                layout changes, which is exactly what happened to these shots
                when the panels replaced the card grid.
                """
                if theme:
                    await r.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
                else:
                    await r.evaluate("document.documentElement.removeAttribute('data-theme')")
                await r.evaluate(setup)
                await r.wait_for_timeout(600)
                height = await r.evaluate("""([sel, pad]) => {
                    const el = document.querySelector(sel);
                    if (!el) return 760;
                    return Math.round(el.getBoundingClientRect().bottom + pad);
                }""", [until, pad])
                height = min(height, cap)
                OUT.mkdir(parents=True, exist_ok=True)
                path = OUT / f"{name}.png"
                await r.screenshot(path=str(path),
                                   clip={"x": 0, "y": 0, "width": 1360, "height": height})
                print(f"  {path.relative_to(ROOT)}  ({height}px tall)")

            # the headline, what needs attention, and the four figures with their trends
            await framed("readme-overview", "go('home'); window.scrollTo(0,0);",
                         until="#view > .g-kpi")
            await framed("readme-dark", "go('home'); window.scrollTo(0,0);",
                         until="#view > .g-kpi", theme="dark")
            # the ledger: every row tagged to a person and an account
            await framed("readme-money", "go('money'); window.scrollTo(0,0);",
                         until=".txtable tbody tr:nth-child(9)", cap=1100, pad=0)
            # utilisation per card, which is the thing that moves a credit score
            # grid columns stretch to the tallest in the row, so the landmark is the last
            # thing inside the panel rather than the panel itself
            await framed("readme-cards", "go('cards'); window.scrollTo(0,0);",
                         until="#view > .grid > .panel:nth-child(1) > :last-child", cap=1100)
            await framed("readme-plan", "go('plan'); window.scrollTo(0,0);",
                         until="#view > .grid > .panel:nth-child(1) > :last-child", cap=1100)

            # the statement importer, which is the least obvious feature
            await r.evaluate("document.documentElement.removeAttribute('data-theme')")
            await r.evaluate("""async () => {
                S = seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); go('import');
                const f = new File([await fetch('samples/sample_card_statement.pdf')
                    .then(x => x.blob())], 'sample_card_statement.pdf');
                await statementFlow(f);
            }""")
            await r.wait_for_timeout(1500)
            await shot(r, "readme-import")

            # phone shots sized for the README, where they render small
            p3 = await browser.new_context(
                viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True)
            p3page = await fresh(p3, base)
            await p3page.evaluate("S=seedSample(); S.settings.recapSeen=addMonths(thisMonth(),-1); save(); closeModal(); UI.month=thisMonth(); go('home'); window.scrollTo(0,0);")
            await shot(p3page, "readme-phone-overview")
            await p3page.evaluate("go('cards'); window.scrollTo(0,0);")
            await shot(p3page, "readme-phone-cards")
            await p3page.close()

            await r.close()
            await browser.close()

    finally:
        httpd.shutdown()

    shrink_readme_images()
    print("done")


def shrink_readme_images():
    """
    Captured at 2x for sharpness, but GitHub renders a README at roughly 900px
    wide, so shipping 2720px files makes the landing page needlessly heavy.
    Downscale to twice the display width, which stays crisp on high-density
    screens and costs a fraction of the bytes.
    """
    try:
        from PIL import Image
    except ImportError:
        print("  (Pillow not installed, skipping image downscale)")
        return
    targets = {"readme-overview": 1600, "readme-cards": 1600, "readme-plan": 1600,
               "readme-dark": 1600, "readme-import": 1600, "readme-money": 1600,
               "readme-phone-overview": 540, "readme-phone-cards": 540}
    before_total = after_total = 0
    for name, width in targets.items():
        p = OUT / f"{name}.png"
        if not p.exists():
            continue
        before = p.stat().st_size
        before_total += before
        im = Image.open(p).convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

        # A screenshot of flat UI uses very few distinct colours, so a 256-entry
        # palette is visually indistinguishable and a fraction of the bytes.
        # Re-encoding as truecolour PNG actually comes out LARGER than the
        # browser's own output, which is why this step exists at all.
        quantised = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)

        candidate = p.with_suffix(".tmp.png")
        quantised.save(candidate, optimize=True)
        if candidate.stat().st_size < before:
            candidate.replace(p)
        else:
            candidate.unlink()          # keep whichever is genuinely smaller
        after_total += p.stat().st_size

    pct = 100 * (before_total - after_total) / before_total if before_total else 0
    print(f"  README images: {before_total/1024:.0f} KB -> {after_total/1024:.0f} KB ({pct:.0f}% smaller)")
if __name__ == "__main__":
    asyncio.run(main())
