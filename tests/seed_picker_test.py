"""Seed Picker (Phase L2) acceptance in a real browser.

  menu   WORLD SEED field: blank -> RANDOM hint; numeric / phrase -> CODE hint (parseSeed); Random
         button fills a 9-digit code; Copy button writes the clipboard (permission granted).
  replay the same typed seed produces identical terrain (heights/materials/water/veg hash) and the
         same state.seed twice in a row; a different seed differs; a phrase seed is deterministic and
         hashes to the same code both times; blank seeds differ between two starts.
  hud    hud-seed chip shows the typed code (label), click copies it; the chip is absent for
         legacy saves without a seed label / seed.
  save   seed + seedLabel survive save -> load (save deleted afterwards).

Usage: AETHERION_URL=... python tests/seed_picker_test.py   (preview URL by default)
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


WORLD_HASH = """(() => { const s = window.__game.state; let h = 2166136261;
  const mix = (v) => { h ^= (v | 0) & 255; h = Math.imul(h, 16777619) >>> 0; };
  for (const arr of [s.heights, s.materials, s.water, s.veg]) for (let i = 0; i < arr.length; i++) mix(arr[i] || 0);
  return { hash: h, seed: s.seed, label: s.seedLabel, entrance: s.entrance }; })()"""


async def menu(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
    await page.wait_for_timeout(500)


async def start(page, seed_text, mode="sandbox"):
    await page.fill('[data-testid="seed-input"]', seed_text)
    await page.click(f'[data-testid="mode-{mode}"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1200)
    await page.click('[data-testid="hud-time-pause-button"]')
    return await page.evaluate(WORLD_HASH)


async def back_to_menu(page):
    await page.click('[data-testid="hud-exit-button"]')
    await page.wait_for_timeout(600)


async def main():
    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1600, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
        page = await ctx.new_page()
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)

        # ---- menu field ----
        await menu(page)
        hint0 = await page.locator('[data-testid="seed-hint"]').text_content()
        check("MENU 1 blank seed shows the RANDOM hint and Copy is disabled", hint0.startswith("RANDOM") and await page.locator('[data-testid="seed-copy-button"]').is_disabled())
        await page.fill('[data-testid="seed-input"]', "mossy vale")
        hint1 = await page.locator('[data-testid="seed-hint"]').text_content()
        check("MENU 2 a phrase seed shows a numeric CODE", hint1.startswith("CODE ") and hint1.split()[1].isdigit(), hint1)
        await page.click('[data-testid="seed-random-button"]')
        rnd = await page.input_value('[data-testid="seed-input"]')
        check("MENU 3 Random fills a 9-digit seed code", rnd.isdigit() and len(rnd) == 9, rnd)
        await page.click('[data-testid="seed-copy-button"]')
        await page.wait_for_timeout(300)
        clip = await page.evaluate("navigator.clipboard.readText().catch(() => null)")
        check("MENU 4 Copy writes the seed to the clipboard", clip == rnd, f"{clip!r} vs {rnd!r}")

        # ---- replay determinism ----
        a = await start(page, "424242")
        await back_to_menu(page)
        b = await start(page, "424242")
        check("SEED 1 the same numeric seed replays identical terrain + state.seed", a["hash"] == b["hash"] and a["seed"] == b["seed"] == 424242 and a["label"] == "424242", f"{a['hash']} {b['hash']}")
        await back_to_menu(page)
        c = await start(page, "424243")
        check("SEED 2 a different seed produces a different world", c["hash"] != a["hash"] and c["seed"] == 424243)
        await back_to_menu(page)
        p1 = await start(page, "Mossy Vale")
        await back_to_menu(page)
        p2 = await start(page, "mossy vale")
        check("SEED 3 phrase seeds hash deterministically (case-insensitive) and replay", p1["hash"] == p2["hash"] and p1["seed"] == p2["seed"] and p1["seed"] != 424242 and p2["label"] == "mossy vale", f"{p1['seed']} {p2['seed']}")
        await back_to_menu(page)
        r1 = await start(page, "")
        await back_to_menu(page)
        await page.wait_for_timeout(30)
        r2 = await start(page, "")
        check("SEED 4 blank seeds give fresh worlds (label null, seeds differ)", r1["label"] is None and r2["label"] is None and r1["seed"] != r2["seed"], f"{r1['seed']} {r2['seed']}")

        # ---- HUD chip ----
        await back_to_menu(page)
        await start(page, "share-me-77")
        chip = await page.locator('[data-testid="hud-seed"]').text_content()
        check("HUD 1 seed chip shows the typed seed label", chip.strip() == "share-me-77", chip)
        await page.click('[data-testid="hud-seed"]')
        await page.wait_for_timeout(300)
        clip = await page.evaluate("navigator.clipboard.readText().catch(() => null)")
        check("HUD 2 clicking the chip copies the seed", clip == "share-me-77", repr(clip))

        # ---- save / load keeps the seed ----
        save_id = await page.evaluate("(async () => { const r = await window.__game.saveGame('seed-picker-test'); return r.id; })()")
        tracker.add(save_id, await page.evaluate("window.__gameDebug.playerToken()"))
        before = await page.evaluate(WORLD_HASH)
        await back_to_menu(page)
        await start(page, "")  # a different world in between
        await page.evaluate("(async () => { await window.__game.loadGame('%s'); window.__game.setPaused(true); })()" % save_id)
        await page.wait_for_timeout(600)
        after = await page.evaluate(WORLD_HASH)
        chip = await page.locator('[data-testid="hud-seed"]').text_content()
        check("SAVE 1 seed + label + terrain survive save -> load; chip restored", after["seed"] == before["seed"] and after["label"] == "share-me-77" and after["hash"] == before["hash"] and chip.strip() == "share-me-77")

        # ---- legacy save without a seed: chip hidden ----
        await page.evaluate("(() => { const s = window.__game.state; s.seed = null; s.seedLabel = null; })()")
        await page.wait_for_timeout(500)
        check("HUD 3 no seed chip for saves that predate seeds", await page.locator('[data-testid="hud-seed"]').count() == 0)

        check("NO console / page errors", not errors, str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
