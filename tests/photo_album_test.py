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
    # captions: PATCH is owner-scoped, single-line, control chars stripped, capped at 140
    cap = requests.patch(f"{api}/photos/{pid}", json={"caption": "  Dawn over\nthe   paddock\u0007 " + "x" * 200}, headers=h, timeout=20)
    cap_ok = cap.status_code == 200 and cap.json().get("caption", "").startswith("Dawn over the paddock x") and len(cap.json().get("caption", "")) == 140 and "image" not in cap.json()
    cap_foreign = requests.patch(f"{api}/photos/{pid}", json={"caption": "hijack"}, headers={"X-Player-Token": other}, timeout=20).status_code
    cap_persisted = requests.get(f"{api}/photos/{pid}", headers=h, timeout=20).json().get("caption", "")
    check("1b backend: PATCH caption sanitises (single line, no control chars, <=140) and is owner-scoped",
          cap_ok and cap_foreign == 404 and cap_persisted.startswith("Dawn over the paddock") and "hijack" not in cap_persisted,
          (cap.status_code, cap_foreign, cap_persisted[:30]))
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
        await page.wait_for_selector('[data-testid="album-download-button"][data-stamped="true"]', timeout=15000)
        href = await page.get_attribute('[data-testid="album-download-button"]', "href") or ""
        dl = await page.get_attribute('[data-testid="album-download-button"]', "download") or ""
        raw_h = await page.evaluate("(() => { const i = document.querySelector('[data-testid=\"album-detail-image\"]'); return i.naturalHeight; })()")
        stamped_h = await page.evaluate("(src) => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalHeight); i.onerror = () => r(-1); i.src = src; })", href)
        check("4 tile opens the detail view with the full JPEG and a download link",
              href.startswith("data:image/jpeg") and dl.endswith(".jpg") and "cycle" in dl
              and "Cycle" in await page.locator('[data-testid="album-detail-title"]').inner_text(), dl)
        check("4c the download is stamped: a caption bar is added under the frame (taller than the stored image)",
              raw_h > 0 and stamped_h >= raw_h + 44, (raw_h, stamped_h))

        # ---- captions: inline editor, Enter saves, persists, re-stamps the download ----
        check("8a empty caption shows the 'Add a caption' affordance",
              "Add a caption" in await page.locator('[data-testid="album-caption-text"]').inner_text())
        await page.click('[data-testid="album-caption-edit"]')
        await page.wait_for_selector('[data-testid="album-caption-input"]', timeout=5000)
        await page.fill('[data-testid="album-caption-input"]', "  Dawn   patrol by the north fence  ")
        await page.keyboard.press("Enter")
        await page.wait_for_selector('[data-testid="album-caption-text"]', timeout=8000)
        await page.wait_for_timeout(300)
        shown = await page.locator('[data-testid="album-caption-text"]').inner_text()
        server = requests.get(URL.rstrip('/') + "/api/photos", headers={"X-Player-Token": token}, timeout=20).json()
        check("8b Enter saves the caption (whitespace collapsed) and it persists server-side",
              shown == "Dawn patrol by the north fence" and server and server[0]["caption"] == "Dawn patrol by the north fence", (shown, server[0]["caption"] if server else None))
        await page.wait_for_selector('[data-testid="album-download-button"][data-stamped="true"]', timeout=15000)
        href2 = await page.get_attribute('[data-testid="album-download-button"]', "href") or ""
        check("8c the stamped download re-renders with the caption (different JPEG bytes, same bar height)",
              href2.startswith("data:image/jpeg") and href2 != href
              and await page.evaluate("(src) => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalHeight); i.src = src; })", href2) == stamped_h)
        # Esc cancels an edit without saving
        await page.click('[data-testid="album-caption-edit"]')
        await page.fill('[data-testid="album-caption-input"]', "discarded text")
        await page.keyboard.press("Escape")
        await page.wait_for_selector('[data-testid="album-caption-text"]', timeout=5000)
        check("8d Esc cancels the edit and keeps the saved caption; the drawer stays open",
              await page.locator('[data-testid="album-caption-text"]').inner_text() == "Dawn patrol by the north fence"
              and await page.locator('[data-testid="album-modal"]').count() == 1)
        await page.click('[data-testid="album-back-button"]')
        check("4b back returns to the grid; the tile shows the caption",
              await page.locator('[data-testid="album-grid"]').count() == 1
              and await page.locator('[data-testid="album-tile-caption"]').inner_text() == "Dawn patrol by the north fence")

        # ---- contact sheet: the whole album as one tall 3-column JPEG (caption + cycle under each frame) ----
        # seed two more frames straight into the service so the sheet has a second row
        api = URL.rstrip('/') + "/api"
        h = {"X-Player-Token": token}
        seeded = []
        for i, cap in enumerate(["Seeded frame A", ""]):
            r = requests.post(f"{api}/photos", json={"park_name": "Aetherion Reserve", "day": 7 + i, "clock": f"0{i}:30", "width": 1280, "height": 720, "image": IMG, "thumb": IMG, "caption": cap}, headers=h, timeout=20)
            seeded.append(r.json()["id"])
        await page.click('[data-testid="album-close-button"]')
        await page.click('[data-testid="dock-open-album-button"]')
        await page.wait_for_selector('[data-testid="album-grid"]', timeout=10000)
        n_photos = await page.locator('[data-testid^="album-photo-"]').count()
        async with page.expect_download(timeout=20000) as dl:
            await page.click('[data-testid="album-contact-sheet-button"]')
        download = await dl.value
        await page.wait_for_selector('[data-testid="album-contact-sheet-button"][data-status="done"]', timeout=10000)
        sheet = await page.evaluate("(() => new Promise(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight, n: window.__albumDebug.sheetCount }); i.onerror = () => r(null); i.src = window.__albumDebug.lastSheet; }))()")
        rows = -(-n_photos // 3)
        expected_h = 132 + rows * (203 + 46) + (rows - 1) * 40 + 56 + 40   # sheetLayout(): header + rows*cell + gutters + footer
        check("9a the contact sheet downloads as a JPEG named after the park",
              download.suggested_filename.endswith("-contact-sheet.jpg") and "aetherion" in download.suggested_filename, download.suggested_filename)
        check("9b one tall sheet: 1240px wide, 3 columns, height follows the photo count",
              sheet and sheet["w"] == 1240 and sheet["h"] == expected_h and sheet["n"] == n_photos and n_photos >= 3, (sheet, n_photos, expected_h))
        check("9c the sheet is a real JPEG data URL", await page.evaluate("window.__albumDebug.lastSheet.startsWith('data:image/jpeg')"))
        for pid in seeded:
            requests.delete(f"{api}/photos/{pid}", headers=h, timeout=10)
        await page.click('[data-testid="album-close-button"]')
        await page.click('[data-testid="dock-open-album-button"]')
        await page.wait_for_selector('[data-testid="album-grid"]', timeout=10000)
        tiles = page.locator('[data-testid^="album-photo-"]')

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
