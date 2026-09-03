"""Old-save compatibility (stabilisation item 1): a save missing a species' knowledge slot must
load with the slot backfilled and keep ticking. The save is deleted in a finally block.

Usage: AETHERION_URL=http://localhost:3000 python tests/save_compat_test.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 800})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(800)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1000)
        await page.click('[data-testid="hud-time-pause-button"]')
        save_id = None
        try:
            before = await page.evaluate("(() => { const s = window.__game.state; delete s.knowledge['skitter']; return Object.keys(s.knowledge).length; })()")
            check("1 knowledge slot removed in memory (simulating a pre-species save)", before == 18, f"({before} slots)")
            save_id = await page.evaluate("(async () => { const r = await window.__game.saveGame('compat-test'); return r.id; })()")
            tracker.add(save_id, await page.evaluate("window.__gameDebug.playerToken()"))
            raw = await page.evaluate("(async () => { const r = await fetch('%s/api/saves/%s', { headers: { 'X-Player-Token': window.__gameDebug.playerToken() } }); const d = await r.json(); return Object.keys(d.state.knowledge).length; })()" % (URL, save_id))
            check("2 stored save really lacks the slot", raw == 18, f"({raw} slots in DB)")
            after = await page.evaluate(
                "(async () => { const g = window.__game; await g.loadGame('%s'); g.setPaused(true);"
                " const k = g.state.knowledge.skitter; g.stepTicks(300);"
                " return { has: !!k, shape: k ? Object.keys(k).sort() : null, slots: Object.keys(g.state.knowledge).length, tick: g.state.tick }; })()" % save_id)
            check("3 loaded save has knowledge.skitter backfilled", after["has"] and after["shape"] == ["discovered", "evidence", "hypothesized"], str(after))
            check("4 all 19 species have a knowledge slot after load", after["slots"] == 19, f"({after['slots']})")
            check("5 stepTicks(300) after load does not throw", after["tick"] >= 300 and not errors, str(errors))
        finally:
            if save_id:
                await page.evaluate("(async () => { try { await window.__game.deleteSave('%s'); } catch (e) {} })()" % save_id)
        gone = await page.evaluate("(async () => { const r = await fetch('%s/api/saves/%s', { headers: { 'X-Player-Token': window.__gameDebug.playerToken() } }); return r.status; })()" % (URL, save_id))
        check("6 test save removed from the database", gone == 404, f"(status {gone})")
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
