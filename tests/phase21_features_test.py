"""Phase 21 (Phase F): edge scrolling, keeper radio chatter (alert feed only,
rate-limited, policy toggle) and the Bloodline Ledger (lineage registry,
family tree UI, pairing outlook, persistence through save/load)."""
import asyncio
import os
from playwright.async_api import async_playwright

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com")

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append(ok)
    print(f"{name}:", "PASS" if ok else f"FAIL {detail}")


async def boot_menu(page):
    await page.goto(URL, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(1200)
    await page.evaluate(
        "localStorage.setItem('aetherion_tutorial_done','1');"
        "localStorage.removeItem('aetherion_scenarios_done');"
        "localStorage.removeItem('aetherion_edge_scroll')"
    )


async def start_bloodline(page):
    await page.click('[data-testid="mode-scenario"]')
    await page.wait_for_timeout(300)
    await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
    await page.wait_for_timeout(200)
    await page.click('[data-testid="start-game-button"]')
    await page.wait_for_timeout(2000)
    await page.click('[data-testid="hud-time-pause-button"]')
    await page.wait_for_timeout(200)


# put the assigned keeper next to a hungry Sovereign with no current task, then step
FEED_SETUP = """(() => { const s = window.__game.state; const st = s.staff[0]; const c = s.creatures[0];
    st.x = Math.floor(c.x) + 1.5; st.y = Math.floor(c.y) + 0.5; st.path = []; st.task = null; st.state = 'idle'; st.workTicks = 0;
    c.needs.hunger = 0.2; c.path = []; c.state = 'idle'; c.actionTicks = 400;
    return { keeper: st.id, creature: c.id, name: c.name }; })()"""


async def select_creature(page, cid):
    await page.evaluate(f"(() => {{ const c = window.__game.state.creatures.find(q => q.id === {cid}); window.__gameRenderer.centerOn(c.x, c.y); }})()")
    await page.wait_for_timeout(300)
    box = await page.locator('[data-testid="game-canvas"]').bounding_box()
    await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2 - 8)
    await page.wait_for_timeout(500)
    sel = await page.evaluate("window.__gameRenderer.selection")
    if not sel or sel.get("id") != cid:
        # fall back to the navigation path used by alerts (deterministic)
        await page.evaluate(f"window.__gameRenderer.selection = {{ kind: 'creature', id: {cid} }}")
    return sel


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        S = lambda expr: page.evaluate(expr)
        await boot_menu(page)

        # ================= EDGE SCROLLING =================
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1800)
        await page.click('[data-testid="hud-time-pause-button"]')
        box = await page.locator('[data-testid="game-canvas"]').bounding_box()
        cam0 = await S("window.__gameRenderer.cam.x")
        await page.mouse.move(box["x"] + box["width"] - 6, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(900)
        st = await S("({ edge: window.__gameInput.edge, ptr: window.__gameInput.pointer, cam: window.__gameRenderer.cam.x })")
        check("EDGE 1 pointer at the right edge glides the camera left", st["edge"]["active"] and st["edge"]["vx"] < 0 and st["cam"] < cam0 - 50, str(st))
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(300)
        camA = await S("window.__gameRenderer.cam.x")
        await page.wait_for_timeout(400)
        st2 = await S("({ edge: window.__gameInput.edge, cam: window.__gameRenderer.cam.x })")
        check("EDGE 2 leaving the band stops the glide", not st2["edge"]["active"] and abs(st2["cam"] - camA) < 0.01, str(st2))
        # top edge is covered by the HUD bar -> pointer target is not the canvas
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 6)
        await page.wait_for_timeout(700)
        st3 = await S("({ edge: window.__gameInput.edge, ptr: window.__gameInput.pointer, cam: window.__gameRenderer.cam.y })")
        check("EDGE 3 hovering the HUD never triggers a glide", not st3["edge"]["active"] and st3["ptr"]["overCanvas"] is False, str(st3))
        # arming delay: a quick pass through the band should not move the camera
        camB = await S("window.__gameRenderer.cam.x")
        await page.mouse.move(box["x"] + 4, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(40)
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(200)
        camC = await S("window.__gameRenderer.cam.x")
        check("EDGE 4 a quick pass through the band does not nudge the camera (arming delay)", abs(camC - camB) < 20, f"({camB} -> {camC})")
        # clamp: never strands the camera off-map
        await S("(() => { const r = window.__gameRenderer; const ext = 72 * 32 * r.cam.zoom; r.cam.x = 200 - ext + 40; })()")
        await page.mouse.move(box["x"] + box["width"] - 4, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(900)
        cl = await S("(() => { const r = window.__gameRenderer; const ext = 72 * 32 * r.cam.zoom; return { cam: r.cam.x, bound: 200 - ext, vx: window.__gameInput.edge.vx }; })()")
        check("EDGE 5 glide clamps at the map bound", abs(cl["cam"] - cl["bound"]) < 0.01 and cl["vx"] == 0, str(cl))
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await S("window.__gameRenderer.centerOn(36, 36)")
        # settings toggle + persistence
        await page.click('[data-testid="hud-audio-button"]')
        await page.wait_for_timeout(300)
        lbl = await page.locator('[data-testid="edge-scroll-toggle"]').inner_text()
        await page.click('[data-testid="edge-scroll-toggle"]')
        await page.wait_for_timeout(200)
        lbl2 = await page.locator('[data-testid="edge-scroll-toggle"]').inner_text()
        ls = await S("localStorage.getItem('aetherion_edge_scroll')")
        await page.click('[data-testid="hud-audio-button"]')
        camD = await S("window.__gameRenderer.cam.x")
        await page.mouse.move(box["x"] + box["width"] - 6, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(700)
        st4 = await S("({ edge: window.__gameInput.edge, cam: window.__gameRenderer.cam.x })")
        check("EDGE 6 toggle off persists + disables the glide", "ON" in lbl and "OFF" in lbl2 and ls == "false" and not st4["edge"]["active"] and abs(st4["cam"] - camD) < 0.01, f"{lbl}/{lbl2}/{ls}/{st4}")
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.click('[data-testid="mode-sandbox"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-audio-button"]')
        await page.wait_for_timeout(300)
        lbl3 = await page.locator('[data-testid="edge-scroll-toggle"]').inner_text()
        check("EDGE 7 preference survives a reload", "OFF" in lbl3, lbl3)
        await page.click('[data-testid="edge-scroll-toggle"]')
        await page.click('[data-testid="hud-audio-button"]')
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(600)

        # ================= KEEPER RADIO CHATTER =================
        await start_bloodline(page)
        ids = await S(FEED_SETUP)
        await S("(() => { window.__audio.log.length = 0; window.__game.stepTicks(100); })()")
        r1 = await S("""(() => { const s = window.__game.state; const st = s.staff[0];
            return { radio: s.alerts.filter(a => a.type === 'radio').map(a => ({ title: a.title, msg: a.msg, target: a.target })), calls: s.stats.radioCalls || 0,
                     report: st.report, quiet: st.radio && st.radio.quietUntil, tick: s.tick }; })()""")
        ok1 = len(r1["radio"]) == 1 and "RADIO" in r1["radio"][0]["title"] and "Pen #" in r1["radio"][0]["msg"] and ids["name"] in r1["radio"][0]["msg"] and r1["radio"][0]["target"]["kind"] == "creature"
        check("RADIO 1 assigned keeper calls in after feeding in its pen", ok1 and r1["calls"] == 1, str(r1))
        toasts = await S("Array.from(document.querySelectorAll('[data-sonner-toast]')).map(t => t.textContent)")
        check("RADIO 2 chatter stays in the feed — no toast", not any("RADIO" in t for t in toasts), str(toasts)[:200])
        await page.click('[data-testid="hud-alerts-button"]')
        await page.wait_for_timeout(400)
        items = await page.locator('[data-testid="alert-item-radio"]').count()
        row_txt = await page.locator('[data-testid="alert-item-radio"]').first.inner_text()
        check("RADIO 3 feed row renders with radio styling + pen message", items == 1 and "RADIO" in row_txt and "Pen #" in row_txt, f"({items}) {row_txt}")
        await page.locator('[data-testid="alert-item-radio"]').first.click()
        await page.wait_for_timeout(400)
        sel = await S("window.__gameRenderer.selection")
        check("RADIO 4 clicking the call locates the creature", sel and sel["kind"] == "creature" and sel["id"] == ids["creature"], str(sel))
        # quiet window: a second feed right away rides the next slot, not a new call
        await S(FEED_SETUP)
        await S("window.__game.stepTicks(100)")
        r2 = await S("({ calls: window.__game.state.stats.radioCalls || 0, feeds: window.__game.state.staff[0].report.feeds, pending: window.__game.state.staff[0].radio.flushAt, quiet: window.__game.state.staff[0].radio.quietUntil, tick: window.__game.state.tick })")
        held = r2["feeds"] >= 2 and r2["calls"] == 1 and r2["pending"] >= r2["quiet"] > r2["tick"]
        check("RADIO 5 second completion inside the quiet window is held (no spam)", held, str(r2))
        await S("(() => { const s = window.__game.state; window.__game.stepTicks(Math.max(1, s.staff[0].radio.flushAt - s.tick + 1)); })()")
        r3 = await S("({ calls: window.__game.state.stats.radioCalls || 0, msgs: window.__game.state.alerts.filter(a => a.type === 'radio').map(a => a.msg) })")
        check("RADIO 6 held chatter transmits once the quiet window lapses", r3["calls"] == 2 and len(r3["msgs"]) == 2, str(r3))
        # unassigned keepers stay silent
        await S("(() => { const st = window.__game.state.staff[0]; st.assignedAnchor = null; st.assignedEnclosureId = null; st.radio = null; })()")
        await S(FEED_SETUP)
        await S("window.__game.stepTicks(400)")
        r4 = await S("({ calls: window.__game.state.stats.radioCalls || 0, feeds: window.__game.state.staff[0].report.feeds })")
        check("RADIO 7 general-duty keepers do not call in", r4["calls"] == 2 and r4["feeds"] >= 3, str(r4))
        # policy toggle in the Staff screen silences chatter
        await S("(() => { const s = window.__game.state; const st = s.staff[0]; const c = s.creatures[0]; st.assignedEnclosureId = c.enclosureId; st.assignedAnchor = { x: Math.floor(c.x), y: Math.floor(c.y) }; })()")
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="staff-radio-toggle"]')
        await page.wait_for_timeout(200)
        pol = await S("window.__game.state.policies.keeperRadio")
        await page.click('[data-testid="staff-close-button"]')
        await S(FEED_SETUP)
        await S("window.__game.stepTicks(400)")
        r5 = await S("({ calls: window.__game.state.stats.radioCalls || 0, feeds: window.__game.state.staff[0].report.feeds, pol: window.__game.state.policies.keeperRadio })")
        check("RADIO 8 'Radio chatter' policy off silences keepers", pol is False and r5["calls"] == 2 and r5["feeds"] >= 4, str(r5))
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(300)
        await page.click('[data-testid="staff-radio-toggle"]')
        await page.click('[data-testid="staff-close-button"]')
        snd = await S("(() => { const a = window.__audio; a.lastStingerAt = 0; a.log.length = 0; a.stinger('radio'); return a.log.map(l => l.kind); })()")
        check("RADIO 9 radio calls carry a soft chirp stinger", "stinger:radio" in snd, str(snd))

        # ================= BLOODLINE LEDGER =================
        bred = await S(
            """(() => { const s = window.__game.state;
                for (let i = 0; i < 40; i++) { for (const c of s.creatures) { c.needs = { hunger: 1, thirst: 1, energy: 1 }; c.stress = 0; c.welfare = 0.9; }
                  window.__game.stepTicks(200); if ((s.stats.birthsBySpecies?.nyxarr || 0) >= 1) break; }
                const baby = s.creatures.find(c => (c.genes.gen || 0) === 1);
                const L = s.lineage;
                return { births: s.stats.birthsBySpecies?.nyxarr || 0, entries: Object.keys(L).length, baby: baby ? { id: baby.id, name: baby.name } : null,
                         entry: baby ? L[baby.id] : null, mId: baby && baby.genes.parents.mId, fId: baby && baby.genes.parents.fId }; })()"""
        )
        check("LEDGER 1 registry tracks founders + offspring with parent ids", bred["baby"] and bred["entries"] == 3 and bred["entry"]["mId"] == bred["mId"] and bred["entry"]["fId"] == bred["fId"], str(bred))
        check("LEDGER 2 offspring entry carries its given name", bred["baby"] and bred["entry"]["name"] == bred["baby"]["name"] and bred["entry"]["gen"] == 1, str(bred["entry"]))
        mother, father, baby = bred["mId"], bred["fId"], bred["baby"]["id"]
        await select_creature(page, mother)
        panel = await page.locator('[data-testid="creature-panel"]').count()
        await page.click('[data-testid="creature-ledger-button"]')
        await page.wait_for_timeout(500)
        opened = await page.locator('[data-testid="bloodline-ledger"]').count()
        title = await page.locator('[data-testid="ledger-title"]').inner_text()
        wild = await page.locator('[data-testid="ledger-wild-origin"]').count()
        desc = await page.locator('[data-testid="ledger-descendants"]').inner_text()
        check("LEDGER 3 founder view: wild origin, offspring listed, descendant count", panel == 1 and opened == 1 and wild == 1 and "1 descendant" in desc and "1 in park" in desc, f"{title} | {desc}")
        off = await page.locator(f'[data-testid="ledger-offspring-{baby}"]').inner_text()
        check("LEDGER 4 offspring node names the mate", bred["baby"]["name"] in off and "IN PARK" in off, off)
        cand_f = page.locator(f'[data-testid="ledger-candidate-{father}"]')
        cand_b = page.locator(f'[data-testid="ledger-candidate-{baby}"]')
        f_txt, b_txt = await cand_f.inner_text(), await cand_b.inner_text()
        f_safe, b_safe = await cand_f.get_attribute("data-safe"), await cand_b.get_attribute("data-safe")
        check("LEDGER 5 pairing outlook: mate SAFE 0%, offspring INBRED 33%", f_safe == "true" and "Unrelated" in f_txt and "0%" in f_txt and b_safe == "false" and "Parent / offspring" in b_txt and "33%" in b_txt, f"{f_txt} || {b_txt}")
        # jump to the offspring from the tree
        await page.click(f'[data-testid="ledger-offspring-{baby}"]')
        await page.wait_for_timeout(500)
        sel = await S("window.__gameRenderer.selection")
        closed = await page.locator('[data-testid="bloodline-ledger"]').count()
        check("LEDGER 6 clicking a living relative closes the ledger and selects it", closed == 0 and sel and sel["id"] == baby, str(sel))
        await page.click('[data-testid="creature-ledger-button"]')
        await page.wait_for_timeout(500)
        m_txt = await page.locator('[data-testid="ledger-mother"]').inner_text()
        f2_txt = await page.locator('[data-testid="ledger-father"]').inner_text()
        gp = await page.locator('[data-testid="ledger-gp-mm"]').inner_text()
        names = await S(f"(() => {{ const L = window.__game.state.lineage; return {{ m: L[{mother}].name, f: L[{father}].name }}; }})()")
        check("LEDGER 7 offspring view: both parents + wild grandparents", names["m"] in m_txt and names["f"] in f2_txt and "wild origin" in gp, f"{m_txt} | {f2_txt} | {gp}".replace("\n", " / "))
        await page.click('[data-testid="ledger-close-button"]')
        await page.wait_for_timeout(200)
        # transfer the sire: history survives, status flips
        await select_creature(page, father)
        await page.click('[data-testid="creature-sell-button"]')
        await page.wait_for_timeout(500)
        tr = await S(f"({{ alive: window.__game.state.creatures.some(c => c.id === {father}), status: window.__game.state.lineage[{father}].status, left: window.__game.state.lineage[{father}].leftDay }})")
        check("LEDGER 8 transferred sire stays in the registry as TRANSFERRED", not tr["alive"] and tr["status"] == "transferred" and tr["left"] is not None, str(tr))
        await select_creature(page, baby)
        await page.click('[data-testid="creature-ledger-button"]')
        await page.wait_for_timeout(500)
        f3_txt = await page.locator('[data-testid="ledger-father"]').inner_text()
        disabled = await page.locator('[data-testid="ledger-father"]').is_disabled()
        rows = await page.locator('[data-testid^="ledger-candidate-"]').count()
        check("LEDGER 9 tree shows the departed sire (not clickable); outlook lists only park residents", "TRANSFERRED" in f3_txt and disabled and rows == 1, f"{f3_txt} rows={rows}")
        await page.click('[data-testid="ledger-close-button"]')
        # persistence through save/load
        await page.click('[data-testid="hud-save-button"]')
        await page.wait_for_timeout(2500)
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid^="save-slot-"]').first.click()
        await page.wait_for_timeout(2500)
        ld = await S(f"(() => {{ const L = window.__game.state.lineage; return {{ n: Object.keys(L).length, father: L[{father}] && L[{father}].status, baby: L[{baby}] && L[{baby}].mId, radio: window.__game.state.policies.keeperRadio }}; }})()")
        check("LEDGER 10 registry + radio policy survive save/load", ld["n"] == 3 and ld["father"] == "transferred" and ld["baby"] == mother and ld["radio"] is True, str(ld))
        # old saves without a registry are backfilled on load
        await S("(() => { const s = window.__game.state; delete s.lineage; })()")
        await page.click('[data-testid="hud-save-button"]')
        await page.wait_for_timeout(2500)
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid^="save-slot-"]').first.click()
        await page.wait_for_timeout(2500)
        bf = await S(f"(() => {{ const L = window.__game.state.lineage || {{}}; return {{ n: Object.keys(L).length, babyParents: L[{baby}] && [L[{baby}].mId, L[{baby}].fId], sireStub: L[{father}] && L[{father}].status }}; }})()")
        check("LEDGER 11 legacy save backfills founders + parent stubs from genes", bf["n"] == 3 and bf["babyParents"] == [mother, father] and bf["sireStub"] == "unknown", str(bf))

        check("NO PAGE ERRORS", not errors, str(errors[:3]))
        await browser.close()
        total = len(RESULTS)
        passed = sum(1 for r in RESULTS if r)
        print(f"\n== {passed}/{total} PASS ==")


asyncio.run(main())
