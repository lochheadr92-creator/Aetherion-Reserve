"""Phase H — assessment fixes verification (H1 / H2 / H3 / M3 / H4 / H5).

H1  newborn placement never crosses a fence edge (adjacentOpenTile honours fenceBetween)
H2  deserialize backfills knowledge for species added after a save was written and drops
    unknown research ids / building types / species so an old save loads and keeps ticking
H3  a render-phase exception shows the ErrorBoundary panel (with a way back to the menu)
M3  a failed save load shows a toast and returns to the menu instead of a blank screen
H4  RNG cursor lives in the state: same seed => same world; a loaded save replays identically
H5  backend save scoping via X-Player-Token (legacy saves stay visible), pagination limits

Usage: AETHERION_URL=http://localhost:3000 python tests/assessment_fixes_test.py
"""
import asyncio, os, sys, uuid
import requests
from playwright.async_api import async_playwright

from config import URL
from save_cleanup import SaveCleanup
API = URL.rstrip("/") + "/api"

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


HASH = """(() => { const d = window.__gameDebug; const s = JSON.stringify(d.serialize(window.__game.state));
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return { hash: h, len: s.length, tick: window.__game.state.tick, rng: d.getRngCursor() }; })()"""


async def boot(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(900)
    await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")


async def start_sandbox(page):
    await page.click('[data-testid="mode-sandbox"]')
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(1200)
    await page.click('[data-testid="hud-time-pause-button"]')
    await page.wait_for_timeout(150)


def backend_checks():
    tok_a, tok_b = f"test-{uuid.uuid4()}", f"test-{uuid.uuid4()}"
    ha, hb = {"X-Player-Token": tok_a}, {"X-Player-Token": tok_b}
    body = {"name": "H5 scoped", "state": {"tick": 1}}
    a = requests.post(f"{API}/saves", json=body, headers=ha, timeout=15).json()
    legacy = requests.post(f"{API}/saves", json={"name": "H5 legacy", "state": {"tick": 2}}, timeout=15).json()
    try:
        ids_a = [s["id"] for s in requests.get(f"{API}/saves?limit=200", headers=ha, timeout=15).json()]
        ids_b = [s["id"] for s in requests.get(f"{API}/saves?limit=200", headers=hb, timeout=15).json()]
        check("H5.1 owner sees own save; other player does not", a["id"] in ids_a and a["id"] not in ids_b)
        check("H5.2 legacy (ownerless) save visible to every player", legacy["id"] in ids_a and legacy["id"] in ids_b)
        check("H5.3 foreign GET / PUT / DELETE are 404",
              requests.get(f"{API}/saves/{a['id']}", headers=hb, timeout=15).status_code == 404
              and requests.put(f"{API}/saves/{a['id']}", json=body, headers=hb, timeout=15).status_code == 404
              and requests.delete(f"{API}/saves/{a['id']}", headers=hb, timeout=15).status_code == 404)
        check("H5.4 owner GET / PUT are 200",
              requests.get(f"{API}/saves/{a['id']}", headers=ha, timeout=15).status_code == 200
              and requests.put(f"{API}/saves/{a['id']}", json=body, headers=ha, timeout=15).status_code == 200)
        # legacy save adopted by the first player who writes to it
        requests.put(f"{API}/saves/{legacy['id']}", json={"name": "H5 legacy", "state": {"tick": 3}}, headers=ha, timeout=15)
        ids_b2 = [s["id"] for s in requests.get(f"{API}/saves?limit=200", headers=hb, timeout=15).json()]
        check("H5.5 legacy save adopted by first writer (no longer visible to others)", legacy["id"] not in ids_b2)
        check("H5.6 list pagination validates limit (422 on 999) and honours skip",
              requests.get(f"{API}/saves?limit=999", timeout=15).status_code == 422
              and requests.get(f"{API}/saves?limit=1&skip=1", headers=ha, timeout=15).status_code == 200
              and len(requests.get(f"{API}/saves?limit=1", headers=ha, timeout=15).json()) == 1)
        # response shape unchanged (no owner leak in the list projection is fine either way, but no 500s)
        one = requests.get(f"{API}/saves?limit=1", headers=ha, timeout=15).json()[0]
        check("H5.7 list rows carry the SaveMeta fields", all(k in one for k in ("id", "name", "updated_at", "day", "cash")))
    finally:
        requests.delete(f"{API}/saves/{a['id']}", headers=ha, timeout=15)
        requests.delete(f"{API}/saves/{legacy['id']}", headers=ha, timeout=15)


async def main():
    backend_checks()
    async with async_playwright() as pw, SaveCleanup() as tracker:  # deletes every save this run creates
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1500, "height": 900})
        tracker.attach(page)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await boot(page)
        await start_sandbox(page)

        # ---- H1: newborn placement respects fences ----
        h1 = await page.evaluate("""(() => { const s = window.__game.state, f = window.__gameDebug.adjacentOpenTile;
            const x = 20, y = 20; const saved = { ...s.fences };
            // pen the mother in: E, S, W, N edges around (20,20)
            s.fences[`${x},${y},E`] = { type: 'basic', hp: 1 }; s.fences[`${x},${y},S`] = { type: 'basic', hp: 1 };
            s.fences[`${x-1},${y},E`] = { type: 'basic', hp: 1 }; s.fences[`${x},${y-1},S`] = { type: 'basic', hp: 1 };
            const penned = f(s, x, y, false);
            delete s.fences[`${x},${y-1},S`];               // open the north side only
            const north = f(s, x, y, false);
            // a boundary tile: fence only on the east; newborn must go anywhere but east
            s.fences = { ...saved }; s.fences[`${x},${y},E`] = { type: 'basic', hp: 1 };
            const notEast = f(s, x, y, false);
            s.fences = saved; s._encDirty = true;
            return { penned, north, notEast }; })()""")
        check("H1.1 fully fenced tile keeps the newborn on the mother's tile (never across a fence)", h1["penned"] == {"x": 20, "y": 20}, str(h1))
        check("H1.2 with the north edge open the newborn goes north", h1["north"] == {"x": 20, "y": 19}, str(h1))
        check("H1.3 boundary tile: east fence is skipped", h1["notEast"] is not None and h1["notEast"] != {"x": 21, "y": 20}, str(h1))

        # ---- H4: seeded determinism ----
        a = await page.evaluate("(() => { window.__game.newGame({ mode: 'sandbox', seed: 4242 }); window.__game.setPaused(true); window.__game.stepTicks(250); return " + HASH + "; })()")
        b = await page.evaluate("(() => { window.__game.newGame({ mode: 'sandbox', seed: 4242 }); window.__game.setPaused(true); window.__game.stepTicks(250); return " + HASH + "; })()")
        c = await page.evaluate("(() => { window.__game.newGame({ mode: 'sandbox', seed: 4243 }); window.__game.setPaused(true); window.__game.stepTicks(250); return " + HASH + "; })()")
        check("H4.1 same seed + same ticks => identical serialized state", a["hash"] == b["hash"] and a["tick"] == b["tick"] == 250, f"{a['hash']} vs {b['hash']}")
        check("H4.2 different seed => different world", a["hash"] != c["hash"], "")
        seed_saved = await page.evaluate("({ seed: window.__game.state.seed, rng: window.__game.state.rng })")
        check("H4.3 seed stored in state", seed_saved["seed"] == 4243, str(seed_saved))
        # save, then load twice and replay — the RNG cursor must be restored from the save
        sid = await page.evaluate("(async () => { const r = await window.__game.saveGame('H4 determinism'); return r.id; })()")
        snap = await page.evaluate("(() => { const st = window.__gameDebug.serialize(window.__game.state); return { rng: st.rngState, cursor: window.__gameDebug.getRngState() }; })()")
        check("H4.4 serialize snapshots the live RNG cursor as rngState", snap["rng"] == snap["cursor"] and isinstance(snap["rng"], int), str(snap))
        r1 = await page.evaluate("(async () => { await window.__game.loadGame('" + sid + "'); window.__game.setPaused(true); const c0 = window.__gameDebug.getRngCursor(); window.__game.stepTicks(400); return { ...(" + HASH + "), c0 }; })()")
        # perturb the RNG between loads (as a second session would) to prove the load restores it
        await page.evaluate("(() => { window.__game.newGame({ mode: 'sandbox', seed: 99 }); window.__game.stepTicks(37); })()")
        r2 = await page.evaluate("(async () => { await window.__game.loadGame('" + sid + "'); window.__game.setPaused(true); const c0 = window.__gameDebug.getRngCursor(); window.__game.stepTicks(400); return { ...(" + HASH + "), c0 }; })()")
        check("H4.5 load restores the RNG cursor from the save", r1["c0"] == r2["c0"] == snap["rng"], f"{r1['c0']} / {r2['c0']} / {snap['rng']}")
        check("H4.6 two loads of one save replay to identical state after 400 ticks", r1["hash"] == r2["hash"] and r1["tick"] == r2["tick"], f"{r1['hash']} vs {r2['hash']}")
        await page.evaluate("window.__game.deleteSave('" + sid + "')")

        # ---- H2: old-build save loads with backfills ----
        corrupt_id = await page.evaluate("""(async () => { const d = window.__gameDebug;
            window.__game.newGame({ mode: 'management', seed: 7 });
            const st = d.serialize(window.__game.state);
            delete st.knowledge.nyxarr; delete st.knowledge.aurox; delete st.knowledge.sylvarr; delete st.knowledge.zephyrmaw;
            st.research.completed.push('bogus_project_x'); st.research.active = { id: 'ghost_research', progress: 1, total: 10 };
            st.buildings.push({ id: 90001, type: 'ghost_building', x: 10, y: 10, w: 1, h: 1, rot: 0 });
            st.creatures.push({ id: 90002, speciesId: 'not_a_species', name: 'Nope', x: 12.5, y: 12.5, path: [], state: 'idle', needs: {}, welfare: 1, stress: 0, health: 1, factors: [], dir: 1 });
            delete st.rng; delete st.rngState; delete st.seed;  // pre-seed save
            const res = await fetch('""" + API + """/saves', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'H2 old build', state: st }) });
            return (await res.json()).id; })()""")
        h2 = await page.evaluate("""(async () => { const before = console.warn; const warns = [];
            console.warn = (...a) => { warns.push(a.join(' ')); };
            try {
              await window.__game.loadGame('""" + corrupt_id + """'); window.__game.setPaused(true);
              const s = window.__game.state; window.__game.stepTicks(120);
              return { warns, hasKnowledge: ['nyxarr','aurox','sylvarr','zephyrmaw'].every(id => s.knowledge[id] && s.knowledge[id].discovered),
                       bogusGone: !s.research.completed.includes('bogus_project_x'), activeCleared: s.research.active === null,
                       ghostGone: !s.buildings.some(b => b.type === 'ghost_building'), speciesGone: !s.creatures.some(c => c.speciesId === 'not_a_species'),
                       seed: s.seed, tick: s.tick };
            } finally { console.warn = before; } })()""")
        check("H2.1 knowledge backfilled for species missing from the save", h2["hasKnowledge"], str(h2.get("warns")))
        check("H2.2 unknown research ids dropped / unknown active research cleared", h2["bogusGone"] and h2["activeCleared"])
        check("H2.3 unknown building type and unknown species dropped (with load warnings)", h2["ghostGone"] and h2["speciesGone"] and len(h2["warns"]) >= 3, str(h2["warns"]))
        check("H2.4 pre-seed save loads with seed = null and keeps ticking", h2["seed"] is None and h2["tick"] >= 120, str({k: h2[k] for k in ('seed', 'tick')}))
        await page.evaluate("window.__game.deleteSave('" + corrupt_id + "')")
        # header token is attached by the frontend client
        tok = await page.evaluate("window.__gameDebug.playerToken()")
        check("H5.8 frontend mints a per-browser player token", isinstance(tok, str) and len(tok) >= 16, str(tok)[:12])

        # ---- H3: ErrorBoundary catches a render-phase crash ----
        await page.evaluate("(() => { window.__game.state.guests = null; })()")  # HUD render reads guests.length
        await page.wait_for_timeout(900)
        eb = await page.locator('[data-testid="error-boundary"]').count()
        check("H3.1 render crash shows the ErrorBoundary panel instead of a blank page", eb == 1)
        if eb:
            # CRA's dev-server error overlay (dev builds only) sits above the page; remove it before clicking
            await page.evaluate("document.getElementById('webpack-dev-server-client-overlay')?.remove()")
            await page.click('[data-testid="error-boundary-home"]', force=True)
            await page.wait_for_timeout(600)
        menu = await page.locator('[data-testid="mode-sandbox"]').count()
        check("H3.2 'Back to menu' returns to the main menu", menu == 1)

        # ---- M3: failed load => toast + stay on menu ----
        mid = await page.evaluate("""(async () => { const res = await fetch('""" + API + """/saves', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'M3 doomed', state: { tick: 0 } }) }); return (await res.json()).id; })()""")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(900)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.route(f"**/api/saves/{mid}", lambda route: route.abort())
        slot = page.locator(f'[data-testid="save-slot-{mid}"]')
        present = await slot.count()
        if present:
            await slot.first.click()
            await page.wait_for_timeout(1200)
        toast_txt = await page.locator("text=Could not load save").count()
        still_menu = await page.locator('[data-testid="mode-sandbox"]').count()
        check("M3.1 failed load shows an error toast and stays on the menu", present == 1 and toast_txt >= 1 and still_menu == 1, f"(slot={present}, toast={toast_txt}, menu={still_menu})")
        await page.unroute(f"**/api/saves/{mid}")
        requests.delete(f"{API}/saves/{mid}", timeout=15)

        check("NO PAGE ERRORS (other than the deliberate H3 crash)", all("guests" in e or "null" in e for e in errors), str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
