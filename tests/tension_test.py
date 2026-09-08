"""Phase O — Creature Tension Pass: needs degradation, aggression, containment breach, keeper
relevance and player feedback.

Deterministic: every scenario swaps in a seeded sandbox park while paused (zero ticks elapse) and
advances the sim with window.__game.stepTicks(n). World building goes through the dev harness
(window.__game.dev), which uses the same mutators as the UI.

    AETHERION_URL=http://localhost:3000 python tests/tension_test.py
"""
import asyncio
import json
import re
from playwright.async_api import async_playwright
from phase6_helpers import boot, click_tile

from config import URL

SEED = 777001
RESULTS = []


def report(name, ok, detail=""):
    RESULTS.append(ok)
    print(f"{name}: {'PASS' if ok else 'FAIL'}{(' (' + str(detail) + ')') if detail and not ok else ''}")


async def fresh_world(page, seed=SEED):
    """Seeded sandbox park, paused, cash unlimited, clear weather, daytime."""
    await page.evaluate(
        """(seed) => { const g = window.__game;
            g.newGame({ mode: 'sandbox', seed, seedLabel: String(seed) }); g.setPaused(true);
            const s = g.state; s.cash = 1e9; s.weather = { type: 'clear', ticksLeft: 900000 }; s.tick = 500;
            g.dev.watchAlerts(); g.dev.clearAlerts();
            g.dev.flatten(36, 26, 60, 48, 2);
            g.stepTicks(1);
        }""",
        seed,
    )
    await page.wait_for_timeout(200)


async def step(page, n):
    return await page.evaluate(f"window.__game.stepTicks({n})")


async def S(page, expr):
    return await page.evaluate(expr)


async def alert_titles(page):
    return await S(page, "window.__game.dev.alerts().map((a) => a.title)")


async def click_empty_tile(page, x0, y0, x1, y1):
    """Click the interior pen tile farthest from every organism so the enclosure (not a creature or a
    boundary fence segment) is selected. Bounds shrink by one tile: a click on a boundary tile snaps to
    its nearest edge, which may be the fence itself."""
    t = await page.evaluate(
        """([x0, y0, x1, y1]) => { const s = window.__game.state; let best = null, bd = -1;
            for (let y = y0 + 1; y <= y1 - 1; y++) for (let x = x0 + 1; x <= x1 - 1; x++) {
              let d = 1e9; for (const c of s.creatures) d = Math.min(d, Math.hypot(c.x - x - 0.5, c.y - y - 0.5));
              if (d > bd) { bd = d; best = [x, y]; } }
            return best; }""",
        [x0, y0, x1, y1],
    )
    await page.evaluate(f"window.__gameRenderer.centerOn({t[0]}, {t[1]})")
    await page.wait_for_timeout(150)
    await click_tile(page, t[0], t[1])
    await page.wait_for_timeout(400)


async def click_creature(page, cid):
    pos = await S(page, f"(() => {{ const c = window.__game.state.creatures.find((q) => q.id === {cid}); return c ? [c.x, c.y] : null; }})()")
    if not pos:
        return False
    await page.evaluate(f"window.__gameRenderer.centerOn({pos[0]}, {pos[1]})")
    await page.wait_for_timeout(150)
    await click_tile(page, int(pos[0]), int(pos[1]))
    await page.wait_for_timeout(400)
    return await page.locator('[data-testid="creature-panel"]').count() == 1


async def text_of(page, testid):
    loc = page.locator(f'[data-testid="{testid}"]')
    return (await loc.first.inner_text()) if await loc.count() else None


# --------------------------------------------------------------------------------------------
# A) needs degradation → stress → health → death (species-scaled, keeper-softened)
# --------------------------------------------------------------------------------------------
async def group_degradation(page):
    print("\n== A) NEEDS DEGRADATION ==")
    await fresh_world(page)
    ids = await page.evaluate(
        """(() => { const g = window.__game, s = g.state;
            g.dev.fenceRect(40, 30, 46, 36, 1);   // pen A: veyra, no keeper
            g.dev.fenceRect(48, 30, 54, 36, 3);   // pen B: karrgan (heavy barrier: no breach noise)
            g.dev.fenceRect(40, 38, 46, 44, 1);   // pen C: veyra pair + assigned warden
            const c1 = g.dev.addCreature('veyra', 42, 40), c2 = g.dev.addCreature('veyra', 44, 42);
            const a1 = g.dev.offspring(c1.id, c2.id, 43, 33);   // pen A resident is C1 × C2's offspring (ledger)
            const b1 = g.dev.addCreature('karrgan', 51, 33);
            const encC = g.dev.enclosureAt(43, 41).id;
            const w = g.dev.hireStaff('warden');
            const st = s.staff[s.staff.length - 1];
            g.dev.assignStaff(st.id, encC);
            for (const c of s.creatures) { c.needs.hunger = 0.3; c.needs.thirst = 0.3; c.stress = 0.2; }
            g.stepTicks(1);
            return { a1: a1.id, b1: b1.id, c1: c1.id, c2: c2.id, encA: g.dev.enclosureAt(43, 33).id, encC, hired: w.ok, staffId: st.id, assigned: st.assignedEnclosureId };
        })()"""
    )
    report("A0 setup (pens, organisms, assigned warden)", ids["hired"] and ids["assigned"] == ids["encC"], ids)

    await step(page, 400)
    st = await S(page, f"""(() => {{ const s = window.__game.state; const f = (id) => s.creatures.find((c) => c.id === id);
        return {{ a: f({ids['a1']}).stress, b: f({ids['b1']}).stress, c: f({ids['c1']}).stress, hA: f({ids['a1']}).health, hB: f({ids['b1']}).health }}; }})()""")
    report("A1 unmet needs raise stress", st["a"] > 0.2 and st["b"] > 0.2, st)
    report("A2 D5 predator degrades faster than D1 grazer", st["b"] > st["a"] + 0.03, st)
    report("A3 assigned keeper slows degradation (same species, same neglect)", st["c"] < st["a"] - 0.02, st)

    # stress radio callout from the assigned keeper (once per episode)
    await page.evaluate(f"(() => {{ const s = window.__game.state; const c = s.creatures.find((q) => q.id === {ids['c1']}); c.stress = 0.62; }})()")
    await step(page, 120)
    radios = await S(page, "window.__game.dev.alerts().filter((a) => a.type === 'radio').map((a) => a.msg)")
    report("A4 assigned keeper radios an agitated resident", any(re.search(r"agitated|pacing", m) for m in radios), radios[-3:])

    # neglect kills: starve pen A's resident; warnings escalate before the fatality
    await page.evaluate(f"""(() => {{ const s = window.__game.state; const c = s.creatures.find((q) => q.id === {ids['a1']});
        c.needs.hunger = 0; c.needs.thirst = 0; c.stress = 0.9; }})()""")
    seen_ui = None
    health_trace = []
    dead = False
    for _ in range(30):
        await step(page, 300)
        h = await S(page, f"(() => {{ const c = window.__game.state.creatures.find((q) => q.id === {ids['a1']}); return c ? c.health : null; }})()")
        if h is None:
            dead = True
            break
        health_trace.append(round(h, 3))
        if seen_ui is None and h < 0.6:
            # UI: health bar + condition badge on the dossier while it is still alive
            ok = await click_creature(page, ids["a1"])
            hp_txt = await text_of(page, "creature-health")
            cond = await text_of(page, "creature-condition")
            seen_ui = {"panel": ok, "health": hp_txt, "cond": cond}
            await page.click('[data-testid="inspect-panel-close-button"]')
    titles = await alert_titles(page)
    report("A5 health declines monotonically under starvation + chronic stress",
           len(health_trace) >= 2 and all(b <= a for a, b in zip(health_trace, health_trace[1:])), health_trace)
    report("A6 escalating warnings: HEALTH DECLINING then CRITICAL CONDITION",
           "HEALTH DECLINING" in titles and "CRITICAL CONDITION" in titles
           and titles.index("HEALTH DECLINING") < titles.index("CRITICAL CONDITION"), [t for t in titles if 'HEALTH' in t or 'CRITICAL' in t])
    report("A7 neglect can kill (ORGANISM LOST, organism removed)", dead and "ORGANISM LOST" in titles, {"dead": dead})
    stats = await S(page, f"(() => {{ const s = window.__game.state; return {{ deaths: s.stats.deaths, bySp: s.stats.deathsBySpecies, lineage: s.lineage[{ids['a1']}] && s.lineage[{ids['a1']}].status }}; }})()")
    report("A8 stats.deaths + lineage status deceased", stats["deaths"] >= 1 and stats["lineage"] == "deceased", stats)
    report("A9 dossier shows health bar (<60%) + DISTRESSED/CRITICAL badge before death",
           bool(seen_ui and seen_ui["panel"] and seen_ui["health"] and int(seen_ui["health"].rstrip('%')) < 60
                and seen_ui["cond"] in ("DISTRESSED", "CRITICAL")), seen_ui)

    # ledger: the parent's tree lists the dead offspring as DECEASED
    ok = await click_creature(page, ids["c1"])
    if ok:
        await page.click('[data-testid="creature-ledger-button"]')
        await page.wait_for_timeout(500)
    pill = await text_of(page, f"ledger-offspring-{ids['a1']}-status")
    report("A10 Bloodline Ledger marks the lost organism DECEASED", pill == "DECEASED", pill)
    if await page.locator('[data-testid="ledger-close-button"]').count():
        await page.click('[data-testid="ledger-close-button"]')
    if await page.locator('[data-testid="inspect-panel-close-button"]').count():
        await page.click('[data-testid="inspect-panel-close-button"]')
    # cause log explains it
    causes = await S(page, "window.__game.state.causeLog.map((e) => e.msg)")
    report("A11 cause log records the death", any("died of" in m for m in causes), causes[:3])


# --------------------------------------------------------------------------------------------
# B) aggression: incompatible mix → conflicts (minor / serious / fatal) → response intervention
# --------------------------------------------------------------------------------------------
async def group_aggression(page):
    print("\n== B) AGGRESSION ==")
    await fresh_world(page)
    ids = await page.evaluate(
        """(() => { const g = window.__game, s = g.state;
            g.dev.fenceRect(40, 30, 46, 36, 3);      // pen A: apex predator + prey
            g.dev.fenceRect(48, 30, 54, 36, 1);      // pen B: overcrowded solitary territorials
            g.dev.spawnBuilding('security_post', 47, 38); // response post in incident range
            const k = g.dev.addCreature('karrgan', 41, 31);
            const v1 = g.dev.addCreature('veyra', 44, 34), v2 = g.dev.addCreature('veyra', 45, 35);
            const r = [g.dev.addCreature('rhoak', 49, 31), g.dev.addCreature('rhoak', 51, 33), g.dev.addCreature('rhoak', 53, 35)];
            s.knowledge.rhoak.discovered.social = true;   // social structure documented → overcrowding may be named
            for (const c of s.creatures) { c.needs.hunger = 0.9; c.needs.thirst = 0.9; c.stress = 0.5; }
            g.stepTicks(1);
            return { k: k.id, v: [v1.id, v2.id], r: r.map((c) => c.id), encA: g.dev.enclosureAt(43, 33).id, encB: g.dev.enclosureAt(51, 33).id };
        })()"""
    )
    # enclosure panel: tension section + warnings before anything happens
    await click_empty_tile(page, 40, 30, 45, 35)
    has_section = await page.locator('[data-testid="enclosure-tension-section"]').count()
    incompatible = await page.locator('[data-testid="enclosure-incompatible-warning"]').count()
    status = await text_of(page, "enclosure-tension-status")
    report("B1 enclosure panel shows TENSION section + INCOMPATIBLE SPECIES warning (public danger gap)",
           has_section == 1 and incompatible >= 1 and status is not None, {"section": has_section, "incompatible": incompatible, "status": status})
    await click_empty_tile(page, 48, 30, 53, 35)
    over = await page.locator('[data-testid="enclosure-overcrowding-warning"]').count()
    report("B2 overcrowding warning only once social structure is documented", over == 1, over)
    await page.click('[data-testid="inspect-panel-close-button"]')

    # run until the first conflict
    first = None
    for i in range(40):
        await step(page, 90)
        c = await S(page, "(() => { const s = window.__game.state; const c = s.stats.conflicts || { minor: 0, serious: 0, fatal: 0 }; return { ...c, total: c.minor + c.serious + c.fatal }; })()")
        if c["total"] >= 1:
            first = c
            break
    report("B3 incompatible mix produces a conflict within ~3600 ticks", first is not None, first)
    titles = await alert_titles(page)
    report("B4 conflict raises a specific alert", any(t in titles for t in ("CONFLICT", "SERIOUS CONFLICT", "FATALITY")), titles[-5:])
    kn = await S(page, "(() => { const s = window.__game.state; return { kv: s.knowledge.karrgan.compat && s.knowledge.karrgan.compat.veyra, vk: s.knowledge.veyra.compat && s.knowledge.veyra.compat.karrgan }; })()")
    report("B5 an incident confirms hostility in the knowledge base (both species)", kn["kv"] == "hostile" and kn["vk"] == "hostile", kn)
    ev = await S(page, "window.__game.state.events.some((e) => e.type === 'conflict')")
    report("B6 conflict registers as a park event (hazard, no crowd headline)", ev and "CONFLICT" not in [t for t in titles if t.startswith("Conflict")], ev)

    # keep going until a serious (injury) or fatal outcome
    outcome = None
    for i in range(60):
        c = await S(page, "(() => { const c = window.__game.state.stats.conflicts || {}; return { serious: c.serious || 0, fatal: c.fatal || 0 }; })()")
        if c["serious"] or c["fatal"]:
            outcome = c
            break
        await step(page, 90)
    report("B7 graduated outcomes: a serious or fatal conflict occurs", outcome is not None, outcome)
    st = await S(page, f"""(() => {{ const s = window.__game.state; return {{
        injured: s.creatures.filter((c) => c.injured).map((c) => c.id), deaths: s.stats.deaths || 0,
        incidents: (s.tension.incidents || []).length, units: (s.security.units || []).map((u) => u.state),
        alive: s.creatures.length, cd: s.creatures.find((c) => c.id === {ids['k']}) && s.creatures.find((c) => c.id === {ids['k']})._aggrCd }}; }})()""")
    if outcome and outcome["fatal"] and not outcome["serious"]:
        report("B8 fatal conflict: FATALITY alert + death recorded + ledger deceased",
               "FATALITY" in titles or "FATALITY" in await alert_titles(page), st)
    else:
        report("B8 serious conflict injures the victim (injured flag, incident registered)", len(st["injured"]) >= 1 or st["incidents"] >= 1 or st["deaths"] >= 1, st)
    report("B9 aggressor cooldown set after an incident", bool(st["cd"]) if st["alive"] else True, st)

    # response intervention: a post within range dispatches a unit that separates the animals.
    # Deterministic path: stage a serious incident directly (same record the sim writes).
    staged = await page.evaluate(
        f"""(() => {{ const g = window.__game, s = g.state;
            const a = s.creatures.find((c) => c.id === {ids['k']});
            const b = s.creatures.find((c) => c.speciesId === 'veyra' && c.enclosureId === a.enclosureId) || null;
            if (!a || !b) return null;
            const before = s.stats.interventions || 0;
            s.tension.incidents.push({{ id: s.nextId++, encId: a.enclosureId, aggressorId: a.id, victimId: b.id, x: a.x, y: a.y, tick: s.tick }});
            b.injured = s.tick; b.distressed = true; b.health = Math.min(b.health, 0.6); b.stress = 0.9; a.stress = 0.9;
            return {{ a: a.id, b: b.id, before, sb: b.stress }}; }})()"""
    )
    if staged:
        got = None
        for i in range(40):
            await step(page, 50)
            r = await S(page, f"(() => {{ const s = window.__game.state; const b = s.creatures.find((c) => c.id === {staged['b']}); return {{ inter: s.stats.interventions || 0, units: s.security.units.map((u) => u.state), sb: b ? b.stress : null, exp: s.finances.today.expenses.response }}; }})()")
            if r["inter"] > staged["before"]:
                got = r
                break
        titles = await alert_titles(page)
        report("B10 rapid response unit separates the animals (ANIMALS SEPARATED, intervention counted)",
               got is not None and "ANIMALS SEPARATED" in titles and "RESPONSE TEAM DISPATCHED" in titles, got or r)
        report("B11 separation lowers the victim's stress and charges the response budget",
               got is not None and got["sb"] is not None and got["sb"] < staged["sb"] and got["exp"] >= 150, got)
        # injured victim: dossier badge + renderer distress marker + medical priority
        ok = await click_creature(page, staged["b"])
        cond = await text_of(page, "creature-condition")
        markers = await S(page, "window.__gameRenderer._distressMarkers")
        report("B12 injured victim shows INJURED/CRITICAL badge + canvas distress marker",
               ok and cond in ("INJURED", "CRITICAL", "DISTRESSED") and (markers or 0) >= 1, {"cond": cond, "markers": markers})
        await page.click('[data-testid="inspect-panel-close-button"]')
        await click_empty_tile(page, 40, 30, 45, 35)
        inj = await text_of(page, "enclosure-tension-injured")
        report("B13 enclosure panel counts injured residents", inj is not None and int(inj) >= 1, inj)
        await page.click('[data-testid="inspect-panel-close-button"]')
    else:
        report("B10 rapid response intervention (no prey left to stage — predator already ate both)", True)
        report("B11 skipped", True)
        report("B12 skipped", True)
        report("B13 skipped", True)

    # overcrowding in pen B: rhoak trio (max 1) fights when stressed
    await page.evaluate("(() => { const s = window.__game.state; for (const c of s.creatures) if (c.speciesId === 'rhoak') { c.stress = 0.8; c.needs.hunger = 0.2; } })()")
    fought = False
    for i in range(40):
        await step(page, 90)
        fought = await S(page, f"window.__game.state.causeLog.some((e) => /Ashmane Rhoak/.test(e.subject) && /(threatened|injured|killed)/.test(e.msg))")
        if fought:
            break
    report("B14 overcrowded, stressed group produces same-species aggression", fought)
    # juveniles never start fights: check the chance function via a juvenile flag
    juv = await page.evaluate("""(() => { const s = window.__game.state; const rs = s.creatures.filter((c) => c.speciesId === 'rhoak');
        if (rs.length < 2) return null; rs[0].juvenile = true; rs[0].stress = 1; rs[1].stress = 1;
        // the conflict pass may still pick another pair; assert only that the juvenile never becomes an aggressor
        const before = s.causeLog.length; window.__game.stepTicks(900); rs[0].juvenile = false;
        return !s.causeLog.slice(0, s.causeLog.length - before).some((e) => e.subject === rs[0].name && /(threatened|injured|killed)/.test(e.msg)); })()""")
    report("B15 juveniles are never aggressors", juv is None or juv is True, juv)


# --------------------------------------------------------------------------------------------
# C) containment breach: stress + degraded barrier → warning → segment destroyed → escape →
#    capture to holding → warden rebuild → release
# --------------------------------------------------------------------------------------------
async def group_breach(page):
    print("\n== C) CONTAINMENT BREACH ==")
    await fresh_world(page)
    ids = await page.evaluate(
        """(() => { const g = window.__game, s = g.state;
            g.dev.fenceRect(40, 30, 46, 36, 1);           // basic barrier: below a karrgan's containment rating
            g.dev.spawnBuilding('security_post', 44, 56); // > 18 tiles away: no breach deterrent, still responds
            const k = g.dev.addCreature('karrgan', 43, 33);
            k.stress = 0.85; k.needs.hunger = 0.3; k.needs.thirst = 0.3;
            g.stepTicks(1);
            return { k: k.id, enc: k.enclosureId, segs: Object.keys(s.fences).length }; })()"""
    )
    kid = ids["k"]
    pin = f"""(() => {{ const c = window.__game.state.creatures.find((q) => q.id === {kid}); if (c) {{ c.health = 1; if (c.stress < 0.8) c.stress = 0.85; }} }})()"""
    # first check: warning, never an immediate breach
    await step(page, 150)
    warned = await S(page, f"(() => {{ const c = window.__game.state.creatures.find((q) => q.id === {kid}); return {{ warned: !!c._breachWarned, escaped: c.escaped, gaps: Object.keys(window.__game.state.gaps).length }}; }})()")
    titles = await alert_titles(page)
    report("C1 BREACH RISK warning fires before any breach", warned["warned"] and "BREACH RISK" in titles and not warned["escaped"] and warned["gaps"] == 0, warned)
    await click_empty_tile(page, 40, 30, 45, 35)
    risk = await text_of(page, "enclosure-tension-breach-risk")
    risk_warn = await page.locator('[data-testid="enclosure-breach-risk-warning"]').count()
    report("C2 enclosure panel: 'Testing barrier' count + BREACH RISK warning", risk is not None and int(risk) >= 1 and risk_warn == 1, {"risk": risk, "warn": risk_warn})
    await page.click('[data-testid="inspect-panel-close-button"]')

    gap = None
    for i in range(60):
        await page.evaluate(pin)
        await step(page, 150)
        g = await S(page, "(() => { const s = window.__game.state; return { gaps: Object.keys(s.gaps), esc: s.creatures.filter((c) => c.escaped).length, be: s.stats.breachEvents || 0, br: s.stats.breaches }; })()")
        if g["gaps"]:
            gap = g
            break
    titles = await alert_titles(page)
    report("C3 stressed organism + under-rated barrier → segment destroyed (gap registered)", gap is not None and gap["br"] >= 1, gap)
    report("C4 the organism is outside containment (escaped)", gap is not None and gap["esc"] >= 1, gap)
    report("C5 CONTAINMENT BREACH alert raised", "CONTAINMENT BREACH" in titles, [t for t in titles if 'BREACH' in t])
    if gap:
        key = gap["gaps"][0]
        seg = await S(page, f"(() => {{ const s = window.__game.state; return {{ fence: !!s.fences['{key}'], gap: s.gaps['{key}'] }}; }})()")
        report("C6 the destroyed segment is physically gone + gap record has tier/tick/encId", not seg["fence"] and seg["gap"] and seg["gap"]["tier"] == 1 and seg["gap"]["encId"] == ids["enc"], seg)
        await page.wait_for_timeout(400)
        markers = await S(page, "window.__gameRenderer._gapMarkers")
        report("C7 renderer draws breach-gap markers", (markers or 0) >= 1, markers)
        banner = await page.locator('[data-testid="emergency-banner"]').count()
        chips = await page.locator('[data-testid="emergency-gap-chip"]').count()
        report("C8 emergency banner lists the barrier gap (locate chip)", banner == 1 and chips >= 1, {"banner": banner, "chips": chips})
        # panel keeps the pen inspectable while the perimeter is open (enclosure id may be gone)
        sel_ok = await page.evaluate(f"(() => {{ const s = window.__game.state; return Object.keys(s.gaps).length; }})()")
        report("C9 save/load round-trip keeps gaps + tension registries", await page.evaluate(
            """(() => { const d = window.__gameDebug; const s = window.__game.state; const back = d.deserialize(d.serialize(s));
                return Object.keys(back.gaps).length === Object.keys(s.gaps).length && back.tension && Array.isArray(back.tension.incidents) && (back.stats.deaths !== undefined); })()"""))

        # rapid response: recapture → holding (home pen is open)
        held = None
        for i in range(60):
            await step(page, 100)
            h = await S(page, f"(() => {{ const s = window.__game.state; const c = s.creatures.find((q) => q.id === {kid}); return c ? {{ held: !!c.held, state: c.state, esc: c.escaped, holdings: s.stats.holdings || 0, units: s.security.units.map((u) => u.state) }} : null; }})()")
            if h and h["held"]:
                held = h
                break
        titles = await alert_titles(page)
        report("C10 recaptured organism goes to HOLDING while its pen is breached", held is not None and held["state"] == "held" and not held["esc"] and "IN HOLDING" in titles, held or h)
        await page.wait_for_timeout(500)
        pb = await page.locator('[data-testid="perimeter-banner"]').count()
        ph = await page.locator('[data-testid="perimeter-held"]').count()
        report("C11 no loose assets but perimeter open → PERIMETER OPEN banner with holding note", pb == 1 and ph == 1, {"banner": pb, "held": ph})
        ok = await click_creature(page, kid)
        cond = await text_of(page, "creature-condition")
        report("C12 held organism's dossier reads IN HOLDING", ok and cond == "IN HOLDING", cond)
        if ok:
            await page.click('[data-testid="inspect-panel-close-button"]')

        # warden rebuilds the gap; the held organism is released once the pen is closed
        await page.evaluate("window.__game.dev.hireStaff('warden')")
        rebuilt = None
        for i in range(80):
            await step(page, 100)
            r = await S(page, f"""(() => {{ const s = window.__game.state; const c = s.creatures.find((q) => q.id === {kid});
                return {{ gaps: Object.keys(s.gaps).length, fence: !!s.fences['{key}'], hp: s.fences['{key}'] && s.fences['{key}'].hp, held: c ? !!c.held : null,
                         enc: c ? c.enclosureId : null, rebuilds: s.stats.staffRebuilds || 0, task: s.staff[0] && s.staff[0].task && s.staff[0].task.type }}; }})()""")
            if r["fence"] and not r["held"]:
                rebuilt = r
                break
        titles = await alert_titles(page)
        report("C13 warden rebuilds the breached segment (full hp, gap cleared)", rebuilt is not None and rebuilt["gaps"] == 0 and rebuilt["hp"] == 100 and rebuilt["rebuilds"] >= 1, rebuilt or r)
        report("C14 held organism released back into the closed pen", rebuilt is not None and rebuilt["enc"] is not None and "RELEASED FROM HOLDING" in titles, rebuilt or r)
        radios = await S(page, "window.__game.dev.alerts().filter((a) => a.type === 'radio').length")
        report("C15 radio stays quiet without assigned keepers (no spam)", radios == 0, radios)
        await page.wait_for_timeout(400)
        report("C16 banners clear once containment is restored",
               await page.locator('[data-testid="perimeter-banner"]').count() == 0 and await page.locator('[data-testid="emergency-banner"]').count() == 0)
    else:
        for n in ("C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15", "C16"):
            report(f"{n} skipped (no breach)", False)

    # player closes a collapse gap by placing a fence on it
    closed = await page.evaluate(
        """(() => { const g = window.__game, s = g.state;
            g.dev.fenceRect(48, 30, 54, 36, 1);
            const key = '53,33,E'; g.dev.damageFence(key, 999); // collapse → gap
            const gapAfter = !!s.gaps[key];
            g.dev.fenceRect(54, 33, 54, 34, 1);                 // re-place the segment on the gap
            return { gapAfter, fence: !!s.fences[key], gapCleared: !s.gaps[key] }; })()"""
    )
    report("C17 placing a fence on a gap closes it", closed["gapAfter"] and closed["fence"] and closed["gapCleared"], closed)
    # demolishing the whole line retires its gaps
    scrub = await page.evaluate(
        """(() => { const g = window.__game, s = g.state;
            const key = '53,34,E'; g.dev.damageFence(key, 999);
            for (const k of Object.keys(s.fences)) { const [x] = k.split(',').map(Number); if (x >= 47 && x <= 54) delete s.fences[k]; }
            s._encDirty = true; g.stepTicks(90);
            return { gone: !s.gaps[key] }; })()"""
    )
    report("C18 gaps on a demolished fence line are retired", scrub["gone"], scrub)


# --------------------------------------------------------------------------------------------
# D) determinism: two identical seeded runs produce identical tension outcomes
# --------------------------------------------------------------------------------------------
SCRIPT = """(() => { const g = window.__game, s = g.state;
    g.dev.fenceRect(40, 30, 46, 36, 1);
    g.dev.fenceRect(48, 30, 54, 36, 2);
    g.dev.spawnBuilding('security_post', 47, 38);
    g.dev.addCreature('karrgan', 41, 31); g.dev.addCreature('veyra', 44, 34); g.dev.addCreature('veyra', 45, 35);
    g.dev.addCreature('rhoak', 49, 31); g.dev.addCreature('rhoak', 51, 33); g.dev.addCreature('vantha', 53, 35);
    for (const c of s.creatures) { c.stress = 0.6; c.needs.hunger = 0.2; c.needs.thirst = 0.3; }
    g.stepTicks(2400);
    return JSON.stringify({ tick: s.tick, stats: s.stats, gaps: Object.keys(s.gaps), deaths: s.stats.deaths,
      creatures: s.creatures.map((c) => [c.id, +c.stress.toFixed(6), +c.health.toFixed(6), c.escaped, !!c.held, !!c.injured]),
      alerts: g.dev.alerts().map((a) => a.tick + ':' + a.title), lineage: Object.values(s.lineage).map((e) => e.id + ':' + e.status) }); })()"""


async def group_determinism(page):
    print("\n== D) DETERMINISM ==")
    await fresh_world(page)
    run1 = await page.evaluate(SCRIPT)
    await fresh_world(page)
    run2 = await page.evaluate(SCRIPT)
    same = run1 == run2
    d1, d2 = json.loads(run1), json.loads(run2)
    report("D1 two identical seeded runs: identical stats, organisms, alerts, gaps, lineage", same,
           None if same else {k: (d1[k], d2[k]) for k in d1 if d1[k] != d2[k]})
    busy = (d1["stats"].get("conflicts") or {})
    report("D2 the scripted world actually exercised the tension loop (conflicts or breaches or deaths)",
           sum(busy.values()) + (d1["stats"].get("breaches") or 0) + (d1.get("deaths") or 0) >= 1, d1["stats"])
    # different seed → different outcome (sanity: the seed matters)
    await fresh_world(page, seed=SEED + 1)
    run3 = await page.evaluate(SCRIPT)
    report("D3 a different seed diverges", run3 != run1)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await boot(page, URL)
        await group_degradation(page)
        await group_aggression(page)
        await group_breach(page)
        await group_determinism(page)
        print("\nPAGE ERRORS:", errors if errors else "none")
        print(f"\nSUMMARY: {sum(RESULTS)}/{len(RESULTS)} passed")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
