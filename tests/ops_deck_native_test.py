"""Ops Deck Step 2 — management screens are NATIVE drawer panels (no CSS chrome-neutralising).

  PANEL  every dock drawer (fieldops / staff / db / research / finances): the hosted screen root
         carries data-host="drawer", renders exactly ONE header (drawer title + the screen's own
         close button) — no nested modal chrome, no `.ops-drawer-host` — and nothing inside the
         drawer overflows horizontally (every descendant scrollWidth <= clientWidth).
  DB     Species Database in the drawer: roster strip + detail pane are both visible; the roster is
         the direct scroll container of the rows and takes <= 40% of the panel; selecting a row
         swaps the detail; opening the database from an organism dossier lands on that species with
         its row scrolled into view.
  LEDGER Bloodline Ledger opens as a contextual drawer (data-drawer=ledger, no dock button lit,
         left overlays shift to 376px); one header / one close; the pairing outlook renders as
         cards (no <table>); clicking a candidate closes the drawer and selects that organism; Esc
         and ledger-close-button both close it.
  RETIRED `?legacyHud=1` is ignored: screens stay drawer panels with data-host="drawer"; the ledger is a
         contextual drawer (never a body portal modal).
  shots  artifacts/ops_deck_native_species.png, artifacts/ops_deck_native_ledger.png

Usage: AETHERION_URL=... python tests/ops_deck_native_test.py   (preview URL by default)
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

from config import URL

results = []

DOCK = {
    "fieldops": "dock-open-fieldops-button",
    "staff": "dock-open-staff-button",
    "db": "dock-species-database-open-button",
    "research": "dock-open-research-button",
    "finances": "dock-open-finances-button",
}
ROOTS = {"fieldops": "fieldops-modal", "staff": "staff-modal", "db": "species-database-modal", "research": "research-modal", "finances": "finances-modal"}

# horizontal overflow probe: any descendant wider than its box that is not itself a scroller/clipper
OVERFLOW = """(tid) => { const d = document.querySelector('[data-testid="' + tid + '"]'); if (!d) return null;
  const bad = []; for (const e of d.querySelectorAll('*')) { const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(cs.overflowX)) bad.push(e.tagName + '.' + String(e.className).slice(0, 48)); }
  return bad; }"""


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


async def boot(page, url, scenario=None):
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion.opsDeck'); localStorage.removeItem('aetherion_scenarios_done')")
    await page.reload(wait_until="networkidle")
    await page.wait_for_timeout(900)
    if scenario:
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="scenario-card-{scenario}"]')
        await page.wait_for_timeout(200)
    else:
        await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1800)
    await page.click('[data-testid="hud-time-pause-button"]')


async def drawer_id(page):
    loc = page.locator('[data-testid="ops-drawer"]')
    return await loc.get_attribute("data-drawer") if await loc.count() else None


async def select_creature(page, cid):
    await page.evaluate(f"(() => {{ const c = window.__game.state.creatures.find(q => q.id === {cid}); window.__gameRenderer.centerOn(c.x, c.y); }})()")
    await page.wait_for_timeout(300)
    box = await page.locator('[data-testid="game-canvas"]').bounding_box()
    await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2 - 8)
    await page.wait_for_timeout(500)
    return await page.evaluate("window.__gameRenderer.selection")


async def panels(page):
    await boot(page, URL, scenario="sovereign_bloodline")  # starts with a keeper on roster + two organisms
    ok_host, ok_chrome, ok_overflow = True, True, True
    for did, tid in DOCK.items():
        await page.click(f'[data-testid="{tid}"]')
        await page.wait_for_timeout(300)
        root = page.locator(f'[data-testid="ops-drawer"] [data-testid="{ROOTS[did]}"]')
        if await root.count() != 1 or await root.get_attribute("data-host") != "drawer":
            ok_host = False
            print("   host mismatch", did, await root.count())
        headers = await page.locator('[data-testid="ops-drawer"] .nl-panel-header').count()
        closes = await page.locator('[data-testid="ops-drawer"] [data-testid$="-close-button"]').count()
        hacks = await page.locator('.ops-drawer-host, [data-testid="ops-drawer"] .nl-panel .nl-panel').count()
        title = (await page.locator('[data-testid="ops-drawer"] header [data-testid="drawer-title"]').text_content() or "").strip()
        if headers != 1 or closes != 1 or hacks != 0 or not title:
            ok_chrome = False
            print("   chrome mismatch", did, headers, closes, hacks, title)
        bad = await page.evaluate(OVERFLOW, ROOTS[did])
        if bad:
            ok_overflow = False
            print("   overflow", did, bad[:4])
        if did == "fieldops":  # the other two tabs reflow too
            for tab in ("expeditions", "contracts"):
                await page.click(f'[data-testid="fieldops-tab-{tab}"]')
                await page.wait_for_timeout(200)
                bad = await page.evaluate(OVERFLOW, ROOTS[did])
                if bad:
                    ok_overflow = False
                    print("   overflow", did, tab, bad[:4])
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(150)
    check("PANEL 1 every hosted screen root is data-host=drawer inside the drawer", ok_host)
    check("PANEL 2 one header + one close control per drawer; no nested modal chrome / .ops-drawer-host", ok_chrome)
    check("PANEL 3 no horizontal overflow in any drawer screen (all Field Ops tabs included)", ok_overflow)

    # staff roster card: assignment select spans the card in the drawer
    await page.click(f'[data-testid="{DOCK["staff"]}"]')
    await page.wait_for_timeout(300)
    sel = page.locator('[data-testid^="staff-assign-select-"]').first
    row = page.locator('[data-testid^="staff-row-"]').first
    sb, rb = await sel.bounding_box(), await row.bounding_box()
    check("PANEL 4 staff roster card stacks: the assignment select spans the card width", sb and rb and sb["width"] >= rb["width"] - 32 and rb["width"] <= 300, f"{sb} {rb}")
    await page.keyboard.press("Escape")

    # ---- Species Database native layout ----
    await page.click(f'[data-testid="{DOCK["db"]}"]')
    await page.wait_for_timeout(400)
    geo = await page.evaluate("""() => { const row = document.querySelector('[data-testid="species-row-veyra"]'); const roster = row.parentElement; const detail = document.querySelector('[data-testid="species-detail"]'); const root = document.querySelector('[data-testid="species-database-modal"]');
      const r = (e) => e.getBoundingClientRect(); return { rosterScrolls: getComputedStyle(roster).overflowY === 'auto' && roster.scrollHeight > roster.clientHeight, rosterH: r(roster).height, rootH: r(root).height, detailTop: r(detail).top, rosterBottom: r(roster).bottom, detailH: r(detail).height, rows: roster.querySelectorAll('[data-testid^="species-row-"]').length }; }""")
    check("DB 1 roster strip (scrollable, <= 40% of the panel) stacks above a visible detail pane",
          geo["rosterScrolls"] and geo["rosterH"] <= geo["rootH"] * 0.4 + 1 and geo["detailTop"] >= geo["rosterBottom"] - 1 and geo["detailH"] > 200 and geo["rows"] >= 18, str(geo))
    check("DB 2 detail shows the first species by default (portrait + knowledge chip)",
          await page.locator('[data-testid="species-detail"] [data-testid="portrait-veyra"]').count() == 1 and await page.locator('[data-testid="knowledge-level"]').count() == 1)
    await page.click('[data-testid="species-row-skitter"]')
    await page.wait_for_timeout(200)
    check("DB 3 selecting a roster row swaps the detail pane",
          await page.locator('[data-testid="species-detail"] [data-testid="portrait-skitter"]').count() == 1
          and await page.locator('[data-testid="species-row-skitter"]').get_attribute("data-selected") == "true")
    os.makedirs("/app/artifacts", exist_ok=True)
    await page.screenshot(path="/app/artifacts/ops_deck_native_species.png")
    await page.keyboard.press("Escape")

    # opened from a dossier: lands on the organism's species, row scrolled into the strip
    cid = await page.evaluate("window.__game.state.creatures[0].id")
    sid = await page.evaluate("window.__game.state.creatures[0].speciesId")
    sel = await select_creature(page, cid)
    if not (sel and sel.get("id") == cid):
        print("   (canvas click did not select; using navigation path)")
        await page.evaluate("window.__game.state.alerts.unshift({ id: 'native-test', type: 'breakthrough', title: 'T', msg: 'r', target: { kind: 'creature', id: %d }, read: false })" % cid)
        await page.click('[data-testid="hud-alerts-button"]')
        await page.locator('[data-testid="alert-item-breakthrough"]').first.click()
        await page.wait_for_timeout(300)
    await page.click('[data-testid="creature-species-button"]')
    await page.wait_for_timeout(400)
    in_view = await page.evaluate("""(sid) => { const row = document.querySelector('[data-testid="species-row-' + sid + '"]'); const strip = row.parentElement.getBoundingClientRect(); const r = row.getBoundingClientRect(); return r.top >= strip.top - 1 && r.bottom <= strip.bottom + 1; }""", sid)
    check("DB 4 'Species' from a dossier opens the drawer on that species with its row in view",
          await drawer_id(page) == "db" and await page.locator(f'[data-testid="species-detail"] [data-testid="portrait-{sid}"]').count() == 1 and in_view, f"{sid} in_view={in_view}")
    check("DB 5 a species the park holds is catalogued even before its acquisition tier is researched (scenario Sovereigns)",
          await page.locator(f'[data-testid="species-row-{sid}"]').inner_text() != "" and "SIGNAL DETECTED" not in await page.locator(f'[data-testid="species-row-{sid}"]').inner_text()
          and await page.locator('[data-testid="knowledge-level"]').count() == 1)
    # the screen's close keeps the dossier open (Escape is the global "cancel everything" hotkey)
    await page.click('[data-testid="species-db-close-button"]')
    await page.wait_for_timeout(150)

    # ---- Bloodline Ledger as a contextual drawer ----
    await page.click('[data-testid="creature-ledger-button"]')
    await page.wait_for_timeout(400)
    lit = await page.locator('[data-testid="ops-dock"] button[aria-pressed="true"]').count()
    shift = await page.locator('[data-testid="ops-left-shift"]').bounding_box()
    check("LEDGER 1 the ledger opens as data-drawer=ledger with no dock button lit; left overlays shift to 376px",
          await drawer_id(page) == "ledger" and lit == 0 and shift and round(shift["x"]) == 376, f"lit={lit} shift={shift}")
    title = (await page.locator('[data-testid="ops-drawer"] header [data-testid="drawer-title"]').text_content() or "").strip()
    check("LEDGER 2 native ledger panel: one header titled BLOODLINE LEDGER, one close control, no overflow, cards not a table",
          title == "BLOODLINE LEDGER"
          and await page.locator('[data-testid="ops-drawer"] .nl-panel-header').count() == 1
          and await page.locator('[data-testid="ops-drawer"] [data-testid="ledger-close-button"]').count() == 1
          and await page.locator('[data-testid="bloodline-ledger"] table').count() == 0
          and await page.locator('[data-testid^="ledger-candidate-"]').count() >= 1
          and not await page.evaluate(OVERFLOW, "bloodline-ledger"), title)
    await page.screenshot(path="/app/artifacts/ops_deck_native_ledger.png")
    other = await page.locator('[data-testid^="ledger-candidate-"]').first.get_attribute("data-testid")
    other_id = int(other.split("-")[-1])
    await page.locator(f'[data-testid="{other}"] button').first.click()
    await page.wait_for_timeout(400)
    sel = await page.evaluate("window.__gameRenderer.selection")
    check("LEDGER 3 clicking a pairing candidate closes the drawer and selects that organism",
          await drawer_id(page) is None and sel and sel.get("id") == other_id, str(sel))
    await page.click('[data-testid="creature-ledger-button"]')
    await page.wait_for_timeout(300)
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(200)
    esc_ok = await drawer_id(page) is None
    # Escape is the global cancel (drawer + selection); re-open the dossier for the close-button path
    sel = await select_creature(page, other_id)
    if not (sel and sel.get("id") == other_id):
        await page.evaluate("window.__game.state.alerts.unshift({ id: 'native-test-3', type: 'breakthrough', title: 'T', msg: 'r', target: { kind: 'creature', id: %d }, read: false })" % other_id)
        await page.click('[data-testid="hud-alerts-button"]')
        await page.locator('[data-testid="alert-item-breakthrough"]').first.click()
        await page.wait_for_timeout(300)
    await page.click('[data-testid="creature-ledger-button"]')
    await page.wait_for_timeout(300)
    await page.click('[data-testid="ledger-close-button"]')
    await page.wait_for_timeout(200)
    check("LEDGER 4 Esc and ledger-close-button both close the ledger drawer; close keeps the dossier open",
          esc_ok and await drawer_id(page) is None and await page.locator('[data-testid="creature-panel"]').count() == 1)


async def legacy(page):
    # the legacy HUD is retired: `?legacyHud=1` is ignored and every screen is a drawer panel
    await boot(page, URL + "/?legacyHud=1", scenario="sovereign_bloodline")
    await page.click('[data-testid="species-database-open-button"]')
    await page.wait_for_timeout(300)
    root = page.locator('[data-testid="species-database-modal"]')
    box = await root.bounding_box()
    check("RETIRED 1 ?legacyHud=1 still hosts the species screen in the drawer (data-host=drawer, <= 320px)",
          await root.get_attribute("data-host") == "drawer" and box and box["width"] <= 320
          and await page.locator('[data-testid="ops-drawer"] [data-testid="species-database-modal"]').count() == 1, str(box))
    await page.click('[data-testid="species-db-close-button"]')
    cid = await page.evaluate("window.__game.state.creatures[0].id")
    sel = await select_creature(page, cid)
    if not (sel and sel.get("id") == cid):
        await page.evaluate("window.__game.state.alerts.unshift({ id: 'native-test-2', type: 'breakthrough', title: 'T', msg: 'r', target: { kind: 'creature', id: %d }, read: false })" % cid)
        await page.click('[data-testid="hud-alerts-button"]')
        await page.locator('[data-testid="alert-item-breakthrough"]').first.click()
        await page.wait_for_timeout(300)
    await page.click('[data-testid="creature-ledger-button"]')
    await page.wait_for_timeout(400)
    led = page.locator('[data-testid="bloodline-ledger"]')
    in_drawer = await page.locator('[data-testid="ops-drawer"] [data-testid="bloodline-ledger"]').count() == 1
    on_body = await page.evaluate("(() => { const e = document.querySelector('[data-testid=\"bloodline-ledger\"]'); return !!e && e.parentElement === document.body; })()")
    check("RETIRED 2 the ledger is a contextual drawer (never a body portal modal) and keeps its outlook",
          await led.count() == 1 and in_drawer and not on_body and await page.locator('[data-testid="bloodline-ledger"] table').count() == 0)
    await page.click('[data-testid="ledger-close-button"]')
    await page.wait_for_timeout(200)
    check("RETIRED 3 ledger-close-button closes the ledger drawer", await led.count() == 0)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)
        await panels(page)
        await legacy(page)
        check("NO console / page errors", not errors, str(errors)[:300])
        await browser.close()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
