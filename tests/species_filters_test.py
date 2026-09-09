"""Species Database roster filters: search box + family-class / tier chips (Ops Deck drawer).

Checks (management mode so tiers 2-4 are still locked "SIGNAL DETECTED" rows):
  1 filters render with a 19/19 count; 2 text search narrows by name/family and updates the count;
  3 family chip + tier chip combine (AND); 4 CLEAR restores the full roster; 5 no-match shows the empty
  state whose button clears; 6 locked species never leak: searching a locked name yields nothing, while
  the tier chip still lists the locked rows; 7 selecting a filtered row updates the detail pane;
  8 no page errors.

    python tests/species_filters_test.py
"""
import asyncio
import sys
from playwright.async_api import async_playwright

from config import URL

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


async def count(page):
    return await page.locator('[data-testid="species-roster-count"]').inner_text()


async def rows(page):
    return await page.locator('[data-testid="species-roster"] [data-testid^="species-row-"]').count()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-management"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        await page.click('[data-testid="dock-species-database-open-button"]')
        await page.wait_for_timeout(400)

        c0 = await count(page)
        check("1 filters render inside the drawer roster with the full count",
              await page.locator('[data-testid="species-roster-filters"]').count() == 1 and c0 == "19/19" and await rows(page) == 19, c0)

        await page.fill('[data-testid="species-search-input"]', "strider")
        await page.wait_for_timeout(200)
        names = await page.locator('[data-testid="species-roster"] [data-testid^="species-row-"]').all_inner_texts()
        check("2 search narrows by name / family (Veyra Strider; Sylvarr is a locked 'Territorial Strider' -> hidden)",
              await rows(page) == 1 and "Veyra" in names[0] and await count(page) == "1/19", names)
        await page.click('[data-testid="species-search-clear"]')

        await page.click('[data-testid="species-filter-family-grazers"]')
        await page.click('[data-testid="species-filter-tier-1"]')
        await page.wait_for_timeout(200)
        names = await page.locator('[data-testid="species-roster"] [data-testid^="species-row-"]').all_inner_texts()
        check("3 family chip AND tier chip combine (Grazers x T1 = Veyra + Thornback)",
              await rows(page) == 2 and all(any(n in t for n in ("Veyra", "Thornback")) for t in names)
              and await page.get_attribute('[data-testid="species-filter-family-grazers"]', "aria-pressed") == "true", names)

        await page.click('[data-testid="species-filter-clear"]')
        await page.wait_for_timeout(200)
        check("4 CLEAR restores the full roster", await count(page) == "19/19" and await rows(page) == 19)

        await page.fill('[data-testid="species-search-input"]', "zzzz")
        await page.wait_for_timeout(200)
        empty = await page.locator('[data-testid="species-roster-empty"]').count() == 1
        await page.click('[data-testid="species-roster-empty-clear"]')
        await page.wait_for_timeout(200)
        check("5 no-match empty state with a clear button that restores the roster", empty and await rows(page) == 19)

        await page.fill('[data-testid="species-search-input"]', "karrgan")
        await page.wait_for_timeout(200)
        leak = await rows(page)
        await page.click('[data-testid="species-search-clear"]')
        await page.click('[data-testid="species-filter-tier-3"]')
        await page.wait_for_timeout(200)
        t3 = await page.locator('[data-testid="species-roster"] [data-testid^="species-row-"]').all_inner_texts()
        await page.click('[data-testid="species-filter-clear"]')
        check("6 locked species never leak: name search finds nothing, tier chip lists them as SIGNAL DETECTED",
              leak == 0 and len(t3) >= 4 and all("SIGNAL DETECTED" in t for t in t3), (leak, len(t3)))

        await page.fill('[data-testid="species-search-input"]', "skitter")
        await page.wait_for_timeout(200)
        await page.click('[data-testid="species-row-skitter"]')
        await page.wait_for_timeout(200)
        detail = await page.locator('[data-testid="species-detail"]').inner_text()
        check("7 selecting a filtered row updates the detail pane", "Skitterling" in detail)

        # Esc inside the search box clears the query (drawer stays open); a second Esc only blurs the field
        await page.fill('[data-testid="species-search-input"]', "veyra")
        await page.press('[data-testid="species-search-input"]', "Escape")
        await page.wait_for_timeout(150)
        cleared = await page.input_value('[data-testid="species-search-input"]') == "" and await page.locator('[data-testid="ops-drawer"]').count() == 1
        await page.press('[data-testid="species-search-input"]', "Escape")
        await page.wait_for_timeout(150)
        still_open = await page.locator('[data-testid="ops-drawer"]').count() == 1
        check("8 Esc in the search box clears the query / blurs without closing the drawer", cleared and still_open)

        check("9 no page errors", not errors, errors[:2])
        await browser.close()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
