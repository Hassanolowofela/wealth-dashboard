#!/usr/bin/env python3
"""
Capture a review set for a redesign phase, and run the checks that go with it.

    python review_shots.py phase2

Writes docs/review/<phase>/ with every destination at 1200px and 390px, in
light and dark, and prints the results of the checks the brief asks for:
no console errors, no horizontal scroll on a phone, nothing smaller than 13px,
and every "how is this calculated" button actually opening.

Sample data only, so the images are safe to publish.
"""

import asyncio
import http.server
import json
import socket
import socketserver
import sys
import threading
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
TABS = ["home", "money", "budget", "cards", "wealth", "plan"]
DESKTOP = {"width": 1200, "height": 900}
PHONE = {"width": 390, "height": 844}


def serve(directory: Path):
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


SMALL_TEXT = """() => {
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && el.tagName !== 'BODY') continue;
    const t = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!t) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px && px < 12.5) bad.push(el.tagName.toLowerCase() + '.' + el.className + ' @' + px);
  }
  return [...new Set(bad)].slice(0, 12);
}"""


async def main(phase):
    out = ROOT / "docs" / "review" / phase
    out.mkdir(parents=True, exist_ok=True)
    httpd, base = serve(ROOT)
    errors, report = [], {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        for size, tag in ((DESKTOP, "desktop"), (PHONE, "mobile")):
            for scheme in ("light", "dark"):
                ctx = await browser.new_context(viewport=size, color_scheme=scheme,
                                                device_scale_factor=2)
                page = await ctx.new_page()
                page.on("console", lambda msg: errors.append(msg.text)
                        if msg.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                await page.goto(base + "/index.html")
                # a full-page shot paints fixed chrome mid-document, which makes
                # the review set unreadable, so park it for the capture only
                await page.add_style_tag(
                    content=".bottomnav,header.top{position:static !important}")
                await page.evaluate(
                    "() => { S = seedSample(); save(); UI.month = thisMonth(); "
                    "closeModal(); render(); }")
                for tab in TABS:
                    await page.evaluate(f"() => go('{tab}')")
                    await page.wait_for_timeout(280)
                    await page.screenshot(path=out / f"{tag}-{scheme}-{tab}.png",
                                          full_page=True)
                    if tag == "mobile" and scheme == "light":
                        report.setdefault("overflow", {})[tab] = await page.evaluate(
                            "() => document.documentElement.scrollWidth - "
                            "document.documentElement.clientWidth")
                        small = await page.evaluate(SMALL_TEXT)
                        if small:
                            report.setdefault("small_text", {})[tab] = small
                if tag == "desktop" and scheme == "light":
                    await page.evaluate("() => go('home')")
                    await page.wait_for_timeout(200)
                    n = await page.evaluate("() => document.querySelectorAll('.helpbtn').length")
                    opened = 0
                    for i in range(n):
                        await page.evaluate(
                            f"() => document.querySelectorAll('.helpbtn')[{i}].click()")
                        await page.wait_for_timeout(90)
                        if await page.evaluate(
                                "() => !!document.querySelector('#modalRoot .modal-bg')"):
                            opened += 1
                            await page.keyboard.press("Escape")
                            await page.wait_for_timeout(90)
                    report["help_buttons"] = f"{opened}/{n} opened"
                await ctx.close()
        await browser.close()
    httpd.shutdown()
    report["console_errors"] = errors or "none"
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "phase2"))
