"""Real determinism checks (stabilisation item 6/7).

A  two fresh page loads, same seed, stepped to tick 900 -> identical state hashes
B  continue vs. save/load: run to 300, save, run to 900 (hash A); load the save, run to 900 (hash B); A == B
C  two new games with the same seed in one page hash identically at tick 0

The hash is FNV-1a over JSON.stringify(state) with top-level '_'-prefixed (derived) keys removed.
Every save this suite creates is deleted in a finally block.

Usage: AETHERION_URL=http://localhost:3000 python tests/determinism_test.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


HASH = """(() => { const st = window.__game.state;
  const clean = Object.fromEntries(Object.entries(st).filter(([k]) => !k.startsWith('_')));
  const s = JSON.stringify(clean);
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return { hash: h, len: s.length, tick: st.tick, seed: st.seed, rngState: window.__gameDebug.getRngState() }; })()"""


async def boot(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(800)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")


async def new_game_to(page, seed, tick):
    # newGame starts the 100 ms loop; pausing in the same synchronous evaluate keeps stepTicks the only source of ticks
    return await page.evaluate(
        "(() => { const g = window.__game; g.newGame({ mode: 'sandbox', seed: %d }); g.setPaused(true);"
        " g.stepTicks(%d - g.state.tick); return %s; })()" % (seed, tick, HASH))


async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()

        # ---- Test A: two fresh page loads ----
        hashes = []
        for i in range(2):
            page = await browser.new_page(viewport={"width": 1400, "height": 800})
            tracker.attach(page)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)[:200]))
            await boot(page)
            h = await new_game_to(page, 4242, 900)
            hashes.append(h)
            check(f"A{i + 1} page load {i + 1}: seed 4242 reaches tick 900 without errors", h["tick"] == 900 and h["seed"] == 4242 and not errors, str(errors))
            await page.close()
        check("A  two fresh page loads with seed 4242 hash identically at tick 900",
              hashes[0]["hash"] == hashes[1]["hash"] and hashes[0]["len"] == hashes[1]["len"],
              f"{hashes[0]['hash']} vs {hashes[1]['hash']} (len {hashes[0]['len']}/{hashes[1]['len']})")

        # ---- Test B: continue vs save/load ----
        page = await browser.new_page(viewport={"width": 1400, "height": 800})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await boot(page)
        save_id = None
        try:
            await new_game_to(page, 777, 300)
            save_id = await page.evaluate("(async () => { const r = await window.__game.saveGame('determinism-b'); return r.id; })()")
            tracker.add(save_id, await page.evaluate("window.__gameDebug.playerToken()"))
            ha = await page.evaluate("(() => { window.__game.stepTicks(600); return %s; })()" % HASH)
            hb = await page.evaluate(
                "(async () => { const g = window.__game; await g.loadGame('%s'); g.setPaused(true);"
                " const at = g.state.tick; g.stepTicks(600); return { ...(%s), loadedAt: at }; })()" % (save_id, HASH))
            check("B1 save written at tick 300 and reloaded there", hb["loadedAt"] == 300 and ha["tick"] == hb["tick"] == 900, f"loadedAt={hb['loadedAt']} ticks {ha['tick']}/{hb['tick']}")
            check("B  continue-to-900 == load-then-run-to-900 (rngState restored from the save)",
                  ha["hash"] == hb["hash"] and ha["rngState"] == hb["rngState"],
                  f"{ha['hash']} vs {hb['hash']} rng {ha['rngState']}/{hb['rngState']}")
            check("B2 no page errors", not errors, str(errors))
        finally:
            if save_id:
                await page.evaluate("(async () => { try { await window.__game.deleteSave('%s'); } catch (e) {} })()" % save_id)

        # ---- Test C: same seed twice in one page, tick 0 ----
        c1 = await new_game_to(page, 4242, 0)
        c2 = await new_game_to(page, 4242, 0)
        check("C  two new games with seed 4242 in one page hash identically at tick 0", c1["hash"] == c2["hash"] and c1["tick"] == c2["tick"] == 0, f"{c1['hash']} vs {c2['hash']}")
        c3 = await new_game_to(page, 4243, 0)
        check("C2 a different seed produces a different world", c3["hash"] != c1["hash"], "")
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
