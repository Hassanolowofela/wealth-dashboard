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
            await page.evaluate("S=seedSample(); save(); closeModal(); UI.tab='import'; render();")
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
            await page.evaluate("closeModal(); S=seedSample(); save(); UI.month=thisMonth(); UI.tab='overview'; render(); window.scrollTo(0,0);")
            await shot(page, "07-overview")

            # ---------------- 08: cards and credit ----------------
            await page.evaluate("UI.tab='cards'; render(); window.scrollTo(0,0);")
            await shot(page, "08-cards")

            # ---------------- 09: plan and advice ----------------
            await page.evaluate("UI.tab='plan'; render(); window.scrollTo(0,0);")
            await shot(page, "09-plan")

            # ---------------- 10: backup ----------------
            await page.evaluate("UI.tab='import'; render(); window.scrollTo(0, document.body.scrollHeight);")
            await shot(page, "10-backup")

            # ---------------- 11: settings, install ----------------
            await page.evaluate("UI.tab='settings'; render(); window.scrollTo(0, document.body.scrollHeight);")
            await shot(page, "11-settings-install")
            await page.close()

            # ---------------- phone shots ----------------
            pctx = await browser.new_context(
                viewport=PHONE, device_scale_factor=3, is_mobile=True, has_touch=True,
                user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
                            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
                            "Mobile/15E148 Safari/604.1"))
            p2 = await fresh(pctx, base)
            await p2.evaluate("S=seedSample(); save(); closeModal(); UI.month=thisMonth(); UI.tab='overview'; render(); window.scrollTo(0,0);")
            await shot(p2, "13-phone-overview")
            await p2.evaluate("UI.tab='cards'; render(); window.scrollTo(0,0);")
            await shot(p2, "14-phone-cards")
            await p2.evaluate("UI.tab='settings'; render(); window.scrollTo(0, document.body.scrollHeight);")
            await shot(p2, "15-phone-install")
            await p2.close()
            await browser.close()
    finally:
        httpd.shutdown()
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
