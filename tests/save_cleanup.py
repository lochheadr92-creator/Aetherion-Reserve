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

Deletes are best-effort. A 404 is reported as a WARNING (not counted as removed): a test that
deletes its own save should call tracker.forget(save_id) so teardown stays quiet.
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
                if "/api/saves" not in resp.url or not resp.ok:
                    return
                if req.method == "POST":
                    data = await resp.json()
                    if isinstance(data, dict) and data.get("id"):
                        self.ids[data["id"]] = req.headers.get("x-player-token")
                elif req.method == "DELETE":
                    # the test removed its own save through the page: nothing left for teardown
                    self.ids.pop(resp.url.rstrip("/").rsplit("/", 1)[-1], None)
            except Exception:
                pass
        page.on("response", on_response)
        return self

    # ---- requests suites ----
    def add(self, save_id, token=None):
        if save_id:
            self.ids[save_id] = token
        return save_id

    def forget(self, save_id):
        """A test that deletes its own save un-tracks it so teardown does not report a 404 warning."""
        self.ids.pop(save_id, None)

    def cleanup(self):
        failed, warned = [], []
        for sid, tok in list(self.ids.items()):
            headers = {"X-Player-Token": tok} if tok else {}
            try:
                r = requests.delete(f"{API}/saves/{sid}", headers=headers, timeout=15)
                if r.status_code == 404:
                    warned.append(sid)  # nothing to remove: not a success, but not a leak either
                elif r.status_code != 200:
                    failed.append((sid, r.status_code))
            except Exception as e:  # pragma: no cover - network hiccup during teardown
                failed.append((sid, str(e)[:80]))
        if self.ids:
            removed = len(self.ids) - len(failed) - len(warned)
            print(f"[cleanup] removed {removed}/{len(self.ids)} test save(s)"
                  + (f", failed: {failed}" if failed else ""))
            for sid in warned:
                print(f"[cleanup] WARNING: save {sid} was already gone (404) — check the test deleted it itself, or the wrong token was recorded")
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
