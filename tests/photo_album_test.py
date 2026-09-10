"""Photo Album: photo-mode captures persist per player and are browsable / re-downloadable.

  1 backend CRUD + owner scoping (curl-level via requests): create, list (thumb only, no image), get,
    other token sees nothing, bad payload 400, delete
  2 UI: dock button opens the album drawer with an empty state (fresh player token)
  3 capture in photo mode -> "SAVED TO ALBUM" status; "Open album" jumps to the gallery with the new tile
  4 tile opens the detail view: full image, JPEG download link, back
  5 delete (two-step confirm) removes the tile; count updates; empty state returns
  6 a second player token cannot see the first player's photos
  7 no page errors

    python tests/photo_album_test.py
"""
import asyncio
import sys
import uuid
import requests
from playwright.async_api import async_playwright

from config import URL

results = []
IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


def backend():
    api = URL.rstrip('/') + "/api"
    tok = "album-test-" + uuid.uuid4().hex[:12]
    other = "album-other-" + uuid.uuid4().hex[:12]
    h = {"X-Player-Token": tok}
    r = requests.post(f"{api}/photos", json={"park_name": "Test Park", "day": 3, "clock": "14:30", "width": 1280, "height": 720, "image": IMG, "thumb": IMG}, headers=h, timeout=20)
    ok = r.status_code == 200 and "image" not in r.json() and r.json().get("thumb", "").startswith("data:image/jpeg")
    pid = r.json().get("id") if r.status_code == 200 else None
    lst = requests.get(f"{api}/photos", headers=h, timeout=20).json()
    full = requests.get(f"{api}/photos/{pid}", headers=h, timeout=20).json() if pid else {}
    others = requests.get(f"{api}/photos", headers={"X-Player-Token": other}, timeout=20).json()
    foreign = requests.get(f"{api}/photos/{pid}", headers={"X-Player-Token": other}, timeout=20).status_code if pid else 0
    bad = requests.post(f"{api}/photos", json={"image": "javascript:alert(1)", "thumb": "x"}, headers=h, timeout=20).status_code
    dele = requests.delete(f"{api}/photos/{pid}", headers=h, timeout=20).status_code if pid else 0
    gone = requests.get(f"{api}/photos/{pid}", headers=h, timeout=20).status_code if pid else 0
    check("1 backend: create returns meta without image; list has thumb only; get returns image; scoping + validation + delete",
          ok and len(lst) == 1 and "image" not in lst[0] and full.get("image") == IMG and full.get("day") == 3
          and others == [] and foreign == 404 and bad == 400 and dele == 200 and gone == 404,
          (r.status_code, len(lst), foreign, bad, dele, gone))


async def ui():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        token = "album-ui-" + uuid.uuid4().hex[:12]
        await page.evaluate("(t) => { localStorage.setItem('aetherion_tutorial_done','1'); localStorage.setItem('aetherion_player_token', t); }", token)
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)

        await page.click('[data-testid="dock-open-album-button"]')
        await page.wait_for_selector('[data-testid="album-empty"]', timeout=10000)
        check("2 dock button opens the album drawer; a fresh player sees the empty state",
              await page.locator('[data-testid="ops-drawer"] [data-testid="album-modal"]').count() == 1
              and await page.get_attribute('[data-testid="album-modal"]', "data-host") == "drawer"
              and await page.locator('[data-testid="album-count"]').inner_text() == "0 photos")
        await page.click('[data-testid="album-open-photo-button"]')
        await page.wait_for_selector('[data-testid="photo-mode-overlay"]', timeout=5000)
        await page.click('[data-testid="photo-capture-button"]')
        await page.wait_for_selector('[data-testid="photo-preview-dialog"]', timeout=5000)
        await page.wait_for_selector('[data-testid="photo-album-status"][data-status="saved"]', timeout=15000)
        check("3a capture auto-saves to the album (status SAVED TO ALBUM) and still offers the PNG download",
              (await page.get_attribute('[data-testid="photo-download-button"]', "href") or "").startswith("data:image/png"))
        await page.click('[data-testid="photo-open-album-button"]')
        await page.wait_for_selector('[data-testid="album-grid"]', timeout=10000)
        tiles = page.locator('[data-testid^="album-photo-"]')
        check("3b 'Open album' leaves photo mode and shows the new tile",
              await page.locator('[data-testid="photo-mode-overlay"]').count() == 0 and await tiles.count() == 1
              and await page.locator('[data-testid="album-count"]').inner_text() == "1 photo")

        await tiles.first.click()
        await page.wait_for_selector('[data-testid="album-detail-image"]', timeout=15000)
        href = await page.get_attribute('[data-testid="album-download-button"]', "href") or ""
        dl = await page.get_attribute('[data-testid="album-download-button"]', "download") or ""
        check("4 tile opens the detail view with the full JPEG and a download link",
              href.startswith("data:image/jpeg") and dl.endswith(".jpg") and "cycle" in dl
              and "Cycle" in await page.locator('[data-testid="album-detail-title"]').inner_text(), dl)
        await page.click('[data-testid="album-back-button"]')
        check("4b back returns to the grid", await page.locator('[data-testid="album-grid"]').count() == 1)

        await tiles.first.click()
        await page.wait_for_selector('[data-testid="album-delete-button"]', timeout=5000)
        await page.click('[data-testid="album-delete-button"]')
        first = await page.locator('[data-testid="album-delete-button"]').inner_text()
        await page.click('[data-testid="album-delete-button"]')
        await page.wait_for_selector('[data-testid="album-empty"]', timeout=10000)
        check("5 two-step delete removes the photo; the empty state returns and the count is 0",
              "Confirm" in first and await page.locator('[data-testid="album-count"]').inner_text() == "0 photos")

        # a second capture so the scoping check has something to (not) see
        await page.click('[data-testid="album-open-photo-button"]')
        await page.wait_for_selector('[data-testid="photo-mode-overlay"]', timeout=5000)
        await page.click('[data-testid="photo-capture-button"]')
        await page.wait_for_selector('[data-testid="photo-album-status"][data-status="saved"]', timeout=15000)
        await page.click('[data-testid="photo-close-button"]')
        mine = requests.get(URL.rstrip('/') + "/api/photos", headers={"X-Player-Token": token}, timeout=20).json()
        theirs = requests.get(URL.rstrip('/') + "/api/photos", headers={"X-Player-Token": "album-nobody-" + uuid.uuid4().hex[:8]}, timeout=20).json()
        check("6 photos are scoped to the player token", len(mine) == 1 and theirs == [], (len(mine), len(theirs)))
        for p in mine:
            requests.delete(URL.rstrip('/') + f"/api/photos/{p['id']}", headers={"X-Player-Token": token}, timeout=20)
        check("7 no page errors", not errors, errors[:2])
        await browser.close()


async def main():
    backend()
    await ui()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
