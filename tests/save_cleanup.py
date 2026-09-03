"""Save-record cleanup for the test suites.

Every test that creates a save (HUD save button, window.__game.saveGame, or a raw POST to
/api/saves) must remove it again so the database never accumulates test records.

Browser suites:

    async with async_playwright() as pw, SaveCleanup() as tracker:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        tracker.attach(page)          # records every successful POST /api/saves (+ the player token)
        ...                           # test body; cleanup runs on exit, exceptions included

Backend (requests) suites:

    with SaveCleanup() as tracker:
        ...; tracker.add(save_id)     # or tracker.add(save_id, token)

Deletes are best-effort: a 404 (already deleted by the test itself) is fine.
"""
import requests

from config import API


class SaveCleanup:
    def __init__(self):
        self.ids = {}  # save id -> player token (None for legacy/unscoped saves)

    # ---- browser suites ----
    def attach(self, page):
        async def on_response(resp):
            try:
                req = resp.request
                if req.method != "POST" or "/api/saves" not in resp.url or not resp.ok:
                    return
                data = await resp.json()
                if isinstance(data, dict) and data.get("id"):
                    self.ids[data["id"]] = req.headers.get("x-player-token")
            except Exception:
                pass
        page.on("response", on_response)
        return self

    # ---- requests suites ----
    def add(self, save_id, token=None):
        if save_id:
            self.ids[save_id] = token
        return save_id

    def cleanup(self):
        failed = []
        for sid, tok in list(self.ids.items()):
            headers = {"X-Player-Token": tok} if tok else {}
            try:
                r = requests.delete(f"{API}/saves/{sid}", headers=headers, timeout=15)
                if r.status_code not in (200, 404):
                    failed.append((sid, r.status_code))
            except Exception as e:  # pragma: no cover - network hiccup during teardown
                failed.append((sid, str(e)[:80]))
        if self.ids:
            print(f"[cleanup] removed {len(self.ids) - len(failed)}/{len(self.ids)} test save(s)" + (f", failed: {failed}" if failed else ""))
        self.ids.clear()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.cleanup()
        return False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        self.cleanup()
        return False
