"""OPS_DECK (Spec 02) acceptance in a real browser.

  on   (default) the dock renders five `dock-*` buttons and no drawer; clicking a dock button opens
       the matching drawer (title, data-drawer, aria-pressed), clicking it again closes it; only one
       drawer exists at a time; Esc / drawer-close / the hosted screen's own close button all close
       it; HudBar buttons and alert navigation route into the drawer; GameModals is not mounted
       (no *-modal element while closed, exactly one — inside the drawer, <= 320px wide — while
       open); dock + drawer cover <= 376px; the canvas is hit-testable and usable at x=400 with a
       drawer open; the left overlays (directives, build toolbar) sit right of the shell; the sim
       keeps ticking with a drawer open.
  off  `?legacyHud=1` and localStorage['aetherion.opsDeck']='off' both render the legacy HUD:
       no dock / drawer, and the [data-testid] DOM (closed + Species modal open) equals
       tests/ops_deck_dom_baseline.json recorded on main.
  shots artifacts/ops_deck_on_species.png, artifacts/ops_deck_off_species.png

Usage: AETHERION_URL=... python tests/ops_deck_test.py   (preview URL by default)
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

from config import URL

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = json.load(open(os.path.join(HERE, "ops_deck_dom_baseline.json")))
results = []

DOCK = {
    "fieldops": "dock-open-fieldops-button",
    "staff": "dock-open-staff-button",
    "db": "dock-species-database-open-button",
    "research": "dock-open-research-button",
    "finances": "dock-open-finances-button",
}
TITLES = {"fieldops": "FIELD OPS", "staff": "STAFF", "db": "SPECIES DATABASE", "research": "RESEARCH", "finances": "FINANCES"}
MODALS = ["fieldops-modal", "staff-modal", "species-database-modal", "research-modal", "finances-modal"]
HUD = {"research": "open-research-button", "finances": "open-finances-button"}

DOM_IDS = "Array.from(document.querySelectorAll('[data-testid]')).map(e => e.tagName.toLowerCase() + '#' + e.dataset.testid)"


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


async def boot(page, url, ops_deck=None):
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion.opsDeck')")
    if ops_deck is not None:
        await page.evaluate("localStorage.setItem('aetherion.opsDeck', '%s')" % ops_deck)
    await page.reload(wait_until="networkidle")  # flags are read once at module load
    await page.wait_for_timeout(900)
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1500)
    await page.click('[data-testid="hud-time-pause-button"]')


async def drawer_id(page):
    loc = page.locator('[data-testid="ops-drawer"]')
    if await loc.count() == 0:
        return None
    return await loc.get_attribute("data-drawer")


async def modal_count(page):
    return sum([await page.locator(f'[data-testid="{m}"]').count() for m in MODALS])


async def deck_on(page):
    await boot(page, URL)
    check("ON 1 dock present with five dock-* buttons, no drawer",
          await page.locator('[data-testid="ops-dock"]').count() == 1
          and all([await page.locator(f'[data-testid="{t}"]').count() == 1 for t in DOCK.values()])
          and await drawer_id(page) is None)
    check("ON 2 GameModals absent while no drawer is open", await modal_count(page) == 0)
    dock_box = await page.locator('[data-testid="ops-dock"]').bounding_box()
    check("ON 3 dock is 56px wide at the left edge under the HudBar", dock_box and dock_box["x"] == 0 and round(dock_box["width"]) == 56 and round(dock_box["y"]) == 56, str(dock_box))

    # ---- open / toggle each dock button ----
    ok_open, ok_toggle, ok_modal = True, True, True
    for did, tid in DOCK.items():
        await page.click(f'[data-testid="{tid}"]')
        await page.wait_for_timeout(250)
        title = (await page.locator('[data-testid="drawer-title"]').text_content() or "").strip()
        pressed = await page.locator(f'[data-testid="{tid}"]').get_attribute("aria-pressed")
        if await drawer_id(page) != did or title != TITLES[did] or pressed != "true":
            ok_open = False
            print("   open mismatch", did, await drawer_id(page), title, pressed)
        inside = await page.locator('[data-testid="ops-drawer"] [data-testid$="-modal"]').count()
        box = await page.locator('[data-testid="ops-drawer"] [data-testid$="-modal"]').first.bounding_box()
        if await modal_count(page) != 1 or inside != 1 or not box or box["width"] > 320 or box["x"] < 56:
            ok_modal = False
            print("   hosted screen mismatch", did, inside, box)
        await page.click(f'[data-testid="{tid}"]')
        await page.wait_for_timeout(200)
        if await drawer_id(page) is not None or await page.locator(f'[data-testid="{tid}"]').get_attribute("aria-pressed") != "false":
            ok_toggle = False
    check("ON 4 every dock button opens its drawer (data-drawer, title, aria-pressed)", ok_open)
    check("ON 5 hosted screen mounts inside the drawer (exactly one *-modal, <= 320px wide, right of the dock)", ok_modal)
    check("ON 6 clicking the active dock button toggles the drawer closed", ok_toggle)

    # ---- single-drawer invariant + geometry ----
    await page.click(f'[data-testid="{DOCK["db"]}"]')
    await page.wait_for_timeout(200)
    await page.click(f'[data-testid="{DOCK["research"]}"]')
    await page.wait_for_timeout(250)
    check("ON 7 opening another drawer replaces the current one (single drawer)",
          await page.locator('[data-testid="ops-drawer"]').count() == 1 and await drawer_id(page) == "research"
          and await page.locator(f'[data-testid="{DOCK["db"]}"]').get_attribute("aria-pressed") == "false")
    dbox = await page.locator('[data-testid="ops-drawer"]').bounding_box()
    check("ON 8 dock + drawer cover <= 376px of the left edge", dbox and round(dbox["x"]) == 56 and round(dbox["x"] + dbox["width"]) <= 376, str(dbox))
    tb = await page.locator('[data-testid="build-toolbar"]').bounding_box()
    ob = await page.locator('[data-testid="objectives-panel"]').bounding_box()
    check("ON 9 build toolbar + directives sit right of the open drawer", tb and ob and tb["x"] >= 376 and ob["x"] >= 376, f"{tb} {ob}")

    # ---- canvas stays interactive with a drawer open ----
    hit = await page.evaluate("(() => { const e = document.elementFromPoint(400, 400); return e && e.dataset ? e.dataset.testid || e.tagName : String(e); })()")
    hit_drawer = await page.evaluate("(() => { const e = document.elementFromPoint(200, 400); return !!(e && e.closest('[data-testid=\"ops-drawer\"]')); })()")
    check("ON 10 elementFromPoint(400,400) is the game canvas; (200,400) is the drawer", hit == "game-canvas" and hit_drawer, str(hit))
    await page.click('[data-testid="cat-terrain"]')
    await page.click('[data-testid="tool-raise"]')
    cash0 = await page.evaluate("window.__game.state.cash")
    await page.mouse.click(900, 420)
    await page.wait_for_timeout(200)
    cash1 = await page.evaluate("window.__game.state.cash")
    check("ON 11 a terrain tool click on the canvas applies while the drawer is open", cash1 < cash0 and await drawer_id(page) == "research", f"{cash0}->{cash1}")
    await page.click('[data-testid="tool-select"]')

    # ---- sim keeps ticking with the drawer open ----
    await page.click('[data-testid="hud-time-pause-button"]')
    t0 = await page.evaluate("window.__game.state.tick")
    await page.wait_for_timeout(700)
    t1 = await page.evaluate("window.__game.state.tick")
    await page.click('[data-testid="hud-time-pause-button"]')
    check("ON 12 simulation ticks with a drawer open", t1 > t0, f"{t0}->{t1}")

    # ---- close paths ----
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(200)
    check("ON 13 Esc closes the drawer", await drawer_id(page) is None and await modal_count(page) == 0)
    await page.click(f'[data-testid="{DOCK["staff"]}"]')
    await page.wait_for_timeout(200)
    await page.click('[data-testid="drawer-close"]')
    await page.wait_for_timeout(200)
    check("ON 14 drawer-close closes the drawer", await drawer_id(page) is None)
    await page.click(f'[data-testid="{DOCK["finances"]}"]')
    await page.wait_for_timeout(200)
    await page.click('[data-testid="finances-close-button"]')
    await page.wait_for_timeout(200)
    check("ON 15 the hosted screen's own close button closes the drawer", await drawer_id(page) is None)

    # ---- legacy writers route into the deck ----
    ok = True
    for did, tid in HUD.items():
        await page.click(f'[data-testid="{tid}"]')
        await page.wait_for_timeout(200)
        ok = ok and await drawer_id(page) == did
    check("ON 16 HudBar management buttons open the drawer", ok)
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(150)
    await page.evaluate("window.__game.state.alerts.unshift({ id: 'ops-deck-test', type: 'breakthrough', title: 'TEST', msg: 'route', target: { kind: 'research' }, read: false })")
    await page.click('[data-testid="hud-alerts-button"]')
    await page.wait_for_timeout(200)
    await page.locator('[data-testid="alert-item-breakthrough"]').first.click()
    await page.wait_for_timeout(300)
    check("ON 17 alert navigation (setModal path) opens the drawer", await drawer_id(page) == "research")
    await page.keyboard.press("Escape")

    # ---- screenshot ----
    await page.click(f'[data-testid="{DOCK["db"]}"]')
    await page.wait_for_timeout(300)
    os.makedirs("/app/artifacts", exist_ok=True)
    await page.screenshot(path="/app/artifacts/ops_deck_on_species.png")


async def deck_off(page, label, url, ops_deck=None):
    await boot(page, url, ops_deck)
    check(f"OFF {label} 1 no dock / drawer in legacy mode",
          await page.locator('[data-testid="ops-dock"]').count() == 0 and await page.locator('[data-testid="ops-drawer"]').count() == 0)
    closed = await page.evaluate(DOM_IDS)
    check(f"OFF {label} 2 [data-testid] DOM equals main baseline (closed)", closed == BASE["closed"],
          str([x for x in closed if x not in BASE["closed"]] + [x for x in BASE["closed"] if x not in closed])[:300])
    await page.click('[data-testid="species-database-open-button"]')
    await page.wait_for_timeout(300)
    opened = await page.evaluate(DOM_IDS)
    check(f"OFF {label} 3 [data-testid] DOM equals main baseline (Species modal open)", opened == BASE["species_open"],
          str([x for x in opened if x not in BASE["species_open"]] + [x for x in BASE["species_open"] if x not in opened])[:300])
    box = await page.locator('[data-testid="species-database-modal"]').bounding_box()
    check(f"OFF {label} 4 Species screen is the full-screen modal", box and box["x"] == 0 and box["width"] >= 1500, str(box))
    if label == "url":
        await page.screenshot(path="/app/artifacts/ops_deck_off_species.png")
    await page.click('[data-testid="species-db-close-button"]')


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)

        await deck_on(page)
        await deck_off(page, "url", URL + "/?legacyHud=1")
        await deck_off(page, "storage", URL, ops_deck="off")
        check("TOGGLE no console errors across on / off loads", not errors, str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
