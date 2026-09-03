"""Phase 20 (Phase E): Sovereign Bloodline scenario, keeper assignment markers,
creature idle life (blink frames / footprints / idle motion) and the ambient
audio layer (Web Audio synth, mute/volume persistence, stingers, tool sounds)."""
import asyncio
import os
from playwright.async_api import async_playwright
from phase6_helpers import click_tile

from config import URL
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
        "localStorage.removeItem('aetherion_audio_enabled');"
        "localStorage.removeItem('aetherion_audio_volume')"
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


# advance the deterministic sim to the next scenario evaluation tick (T % 100 === 30)
async def step_to_scenario_tick(page):
    await page.evaluate(
        """(() => { const s = window.__game.state; const n = ((30 - (s.tick % 100)) + 100) % 100 || 100;
            window.__game.stepTicks(n + 1); })()"""
    )
    await page.wait_for_timeout(500)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        S = lambda expr: page.evaluate(expr)
        await boot_menu(page)

        # ================= AUDIO: pre-gesture state =================
        pre = await S("({ has: !!window.__audio, ctx: window.__audio && window.__audio.ctx ? 1 : 0 })")
        check("AUDIO 1 manager installed, context deferred until a gesture", pre["has"] and not pre["ctx"], str(pre))

        # ================= SCENARIO: menu =================
        await page.click('[data-testid="mode-scenario"]')
        await page.wait_for_timeout(300)
        cards = await page.locator('[data-testid^="scenario-card-"]').count()
        check("SCENARIO 1a picker shows 6 missions", cards == 6, f"({cards})")
        txt = await page.locator('[data-testid="scenario-card-sovereign_bloodline"]').inner_text()
        check("SCENARIO 1b bloodline card is BRUTAL with +50,000", "BRUTAL" in txt and "50,000" in txt, txt[:80])
        post = await S("({ ctx: window.__audio.ctx ? window.__audio.ctx.state : null, clicks: window.__audio.log.filter(l => l.kind === 'click').length })")
        check("AUDIO 2 first click unlocks the context + logs a UI click", post["ctx"] == "running" and post["clicks"] >= 1, str(post))

        # ================= SCENARIO: setup template =================
        await page.click('[data-testid="scenario-card-sovereign_bloodline"]')
        await page.wait_for_timeout(200)
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(2000)
        await page.click('[data-testid="hud-time-pause-button"]')
        snap = await S(
            """(() => { const s = window.__game.state; const st = s.staff[0];
                return { sc: s.scenario?.id, status: s.scenario?.status, cash: s.cash,
                    nyx: s.creatures.filter(c => c.speciesId === 'nyxarr').length,
                    contained: s.creatures.every(c => c.enclosureId && !c.escaped),
                    staff: s.staff.length, role: st?.role, assigned: st?.assignedEnclosureId,
                    sameEnc: st && s.creatures[0].enclosureId === st.assignedEnclosureId,
                    social: !!s.knowledge.nyxarr.discovered.social,
                    breeding: s.research.completed.includes('bio_breeding'),
                    tier4: Object.values(s.fences).every(f => f.tier >= 3),
                    damaged: Object.values(s.fences).filter(f => f.hp < 400).length }; })()"""
        )
        check("SCENARIO 2a scenario active with two contained Sovereigns", snap["sc"] == "sovereign_bloodline" and snap["status"] == "active" and snap["nyx"] == 2 and snap["contained"], str(snap))
        check("SCENARIO 2b budget ~45,000 after starter hires", 45000 <= snap["cash"] <= 45300, str(snap["cash"]))
        check("SCENARIO 2c starter xenobiologist hired + assigned to the pen", snap["staff"] == 1 and snap["role"] == "xenobiologist" and snap["assigned"] is not None and snap["sameEnc"], str(snap))
        check("SCENARIO 2d briefing knowledge + breeding research granted", snap["social"] and snap["breeding"], str(snap))
        check("SCENARIO 2e storm-worn tier-3/4 perimeter with damaged segments", snap["tier4"] and snap["damaged"] > 0, str(snap))

        # ================= SCENARIO: tracker + progress chips =================
        tracker = await page.locator('[data-testid="scenario-tracker"]').count()
        chip = await page.locator('[data-testid="scenario-goal-progress-offspring"]').inner_text()
        deadline = await page.locator('[data-testid="scenario-fail-progress-deadline"]').inner_text()
        healthy = await page.locator('[data-testid="scenario-goal-progress-healthy"]').inner_text()
        check("SCENARIO 3a tracker + offspring progress chip 0/3", tracker == 1 and chip.strip() == "0/3", f"({chip})")
        check("SCENARIO 3b deadline chip counts mission cycles", deadline.strip() == "Cycle 1/16", f"({deadline})")
        check("SCENARIO 3c bloodline health chip 2/2 (goal pending until a birth)", healthy.strip() == "2/2", f"({healthy})")
        await S("(() => { window.__game.state.creatures[0].welfare = 0.3; })()")
        await page.wait_for_timeout(600)
        healthy2 = await page.locator('[data-testid="scenario-goal-progress-healthy"]').inner_text()
        check("SCENARIO 3d health chip reacts to a suffering Sovereign 1/2", healthy2.strip() == "1/2", f"({healthy2})")
        await S("(() => { window.__game.state.creatures[0].welfare = 0.7; })()")

        # ================= KEEPER MARKERS =================
        pins = await S("window.__gameRenderer._keeperPins")
        check("MARKERS 1 one pin rendered over the assigned enclosure", len(pins) == 1 and pins[0]["role"] == "xenobiologist" and pins[0]["encId"] == snap["assigned"], str(pins))
        # unassign via the Staff screen -> pin disappears
        sid = await S("window.__game.state.staff[0].id")
        await page.click('[data-testid="open-staff-button"]')
        await page.wait_for_timeout(400)
        await page.click(f'[data-testid="staff-assign-select-{sid}"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="staff-assign-none-{sid}"]')
        await page.wait_for_timeout(300)
        pins0 = await S("window.__gameRenderer._keeperPins.length")
        check("MARKERS 2 pin removed when the keeper returns to general duties", pins0 == 0, f"({pins0})")
        # re-assign + hire a warden on the same pen -> two pins fanned out
        enc = snap["assigned"]
        await page.click(f'[data-testid="staff-assign-select-{sid}"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="staff-assign-enc-{sid}-{enc}"]')
        await page.wait_for_timeout(200)
        await page.click('[data-testid="hire-warden-button"]')
        await page.wait_for_timeout(300)
        sid2 = await S("window.__game.state.staff[1].id")
        await page.click(f'[data-testid="staff-assign-select-{sid2}"]')
        await page.wait_for_timeout(300)
        await page.click(f'[data-testid="staff-assign-enc-{sid2}-{enc}"]')
        await page.wait_for_timeout(300)
        await page.click('[data-testid="staff-close-button"]')
        await page.wait_for_timeout(200)
        pins2 = await S("window.__gameRenderer._keeperPins")
        spread = len(pins2) == 2 and abs(pins2[0]["x"] - pins2[1]["x"]) >= 18 and {p["role"] for p in pins2} == {"xenobiologist", "warden"}
        check("MARKERS 3 two keepers on one pen fan out into two role-tinted pins", spread, str(pins2))

        # ================= IDLE LIFE =================
        life = await S(
            """(() => { const r = window.__gameRenderer; const sh = r.sheetFor('nyxarr');
                const a = sh.idle[0].getContext('2d').getImageData(0,0,sh.w,sh.h).data;
                const b = sh.blink[0].getContext('2d').getImageData(0,0,sh.w,sh.h).data;
                let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) diff++;
                const rest = r.idleLife({ id: 3, state: 'resting' }, false, sh);
                const walk = r.idleLife({ id: 3, state: 'wander' }, true, sh);
                let flick = false, breathe = false;
                for (let f = 0; f < 400; f++) { r.frame = f; const l = r.idleLife({ id: 3, state: 'idle' }, false, sh); if (l.shear) flick = true; if (l.breath !== 1) breathe = true; }
                return { hasBlink: !!sh.blink, diff, restBlink: rest.blink, walkNeutral: !walk.blink && walk.breath === 1 && walk.shear === 0, flick, breathe }; })()"""
        )
        check("IDLE 1 blink frames (exact recorded eye rects)", life["hasBlink"] and 1 <= life["diff"] <= 60, str(life))
        check("IDLE 2 resting creatures keep eyes shut; walkers stay neutral", life["restBlink"] and life["walkNeutral"], str(life))
        check("IDLE 3 breathing pulse + periodic flick over a 400-frame window", life["flick"] and life["breathe"], str(life))
        # footprints: let the Sovereigns roam a while
        await page.click('[data-testid="hud-time-pause-button"]')
        await page.click('[data-testid="hud-speed-3-button"]')
        tracks = 0
        for _ in range(40):
            await page.wait_for_timeout(250)
            tracks = await S("window.__gameRenderer.fx.tracks.length")
            if tracks > 0:
                break
        await page.click('[data-testid="hud-time-pause-button"]')
        check("IDLE 4 walking creatures leave footprint decals", tracks > 0, f"({tracks})")
        await page.wait_for_timeout(300)
        t0 = await S("window.__gameRenderer.fx.tracks.length")
        tracks_after = t0
        for _ in range(30):  # decals age per rendered frame; headless rAF can run well under 60fps
            await page.wait_for_timeout(500)
            tracks_after = await S("window.__gameRenderer.fx.tracks.length")
            if tracks_after == 0:
                break
        check("IDLE 5 footprints fade out once creatures stop", tracks_after == 0, f"({t0} -> {tracks_after})")

        # ================= AUDIO: controls + persistence =================
        await page.click('[data-testid="hud-audio-button"]')
        await page.wait_for_timeout(300)
        pop = await page.locator('[data-testid="audio-popover"]').count()
        await page.click('[data-testid="audio-mute-toggle"]')
        await page.wait_for_timeout(200)
        muted = await S("({ enabled: window.__audio.enabled, ls: localStorage.getItem('aetherion_audio_enabled') })")
        check("AUDIO 3 popover opens; mute persists to localStorage", pop == 1 and muted["enabled"] is False and muted["ls"] == "false", str(muted))
        await page.click('[data-testid="audio-mute-toggle"]')
        await page.wait_for_timeout(150)
        # keyboard-drive the shadcn slider thumb
        thumb = page.locator('[data-testid="audio-volume-slider"] [role="slider"]')
        await thumb.focus()
        await page.keyboard.press("ArrowLeft")
        await page.keyboard.press("ArrowLeft")
        await page.wait_for_timeout(200)
        vol = await S("({ v: window.__audio.volume, ls: localStorage.getItem('aetherion_audio_volume'), label: document.querySelector('[data-testid=\"audio-volume-value\"]').textContent })")
        check("AUDIO 4 volume slider updates manager + persists", abs(vol["v"] - 0.5) < 0.01 and vol["ls"] == "0.50" and vol["label"] == "50%", str(vol))
        await page.click('[data-testid="hud-audio-button"]')
        beds = await S(
            """(() => { const a = window.__audio;
                const storm = a.bedTargets({ weather: { type: 'storm' }, tick: 100, creatures: [] });
                const clear = a.bedTargets({ weather: { type: 'clear' }, tick: 100, creatures: [] });
                const night = a.bedTargets({ weather: { type: 'clear' }, tick: 1400, creatures: [{ speciesId: 'nyxarr' }] });
                const nightNoGlow = a.bedTargets({ weather: { type: 'clear' }, tick: 1400, creatures: [{ speciesId: 'skitter' }] });
                return { storm, clear, night, nightNoGlow, live: a.lastTargets }; })()"""
        )
        check("AUDIO 5a storm raises wind + adds rain; clear day is a soft bed", beds["storm"]["wind"] > beds["clear"]["wind"] and beds["storm"]["rain"] > 0 and beds["clear"]["rain"] == 0, str(beds))
        check("AUDIO 5b night hum only with glowing exhibits", beds["night"]["hum"] > 0 and beds["nightNoGlow"]["hum"] == 0, str(beds))
        check("AUDIO 5c live ambience targets follow the running game", beds["live"] is not None and beds["live"]["wind"] > 0, str(beds["live"]))
        # tool deny sound: try to release a creature outside any enclosure
        await S("(() => { window.__audio.log.length = 0; })()")
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-power"]')
        ent = await S("window.__game.state.entrance")
        await S(f"window.__gameRenderer.centerOn({ent['x']}, {ent['y'] - 2})")
        await click_tile(page, ent["x"], ent["y"] - 2)  # entrance path tile: blocked
        await page.wait_for_timeout(300)
        kinds = await S("window.__audio.log.map(l => l.kind)")
        check("AUDIO 6 rejected placement plays the deny cue", "deny" in kinds, str(kinds))
        await page.click('[data-testid="tool-select"]')

        # ================= SCENARIO: victory path (injected bloodline stats) =================
        await S(
            """(() => { const s = window.__game.state; window.__audio.log.length = 0;
                s.stats.courtships = 1; s.stats.birthsBySpecies = { nyxarr: 3 }; s.stats.maturedBySpecies = { nyxarr: 1 };
                for (const c of s.creatures) { c.welfare = 0.9; c.stress = 0; c.needs = { hunger: 1, thirst: 1, energy: 1 }; } })()"""
        )
        cash0 = await S("window.__game.state.cash")
        await step_to_scenario_tick(page)
        won = await S("({ status: window.__game.state.scenario.status, progress: window.__game.state.scenario.progress, mastery: window.__game.state.scenario.mastery, cash: window.__game.state.cash, log: window.__audio.log.map(l => l.kind) })")
        check("SCENARIO 4a all four goals evaluate true -> victory", won["status"] == "won" and all(won["progress"].values()), str(won))
        check("SCENARIO 4b +50,000 commendation paid", won["cash"] - cash0 >= 50000, f"({cash0} -> {won['cash']})")
        check("SCENARIO 4c mastery graded (swift earned on cycle 1; dynasty not)", won["mastery"] and won["mastery"]["swift"] is True and won["mastery"]["dynasty"] is False, str(won["mastery"]))
        check("AUDIO 7 victory alert fires a success stinger", any(k.startswith("stinger:") for k in won["log"]), str(won["log"]))
        dlg = await page.locator('[data-testid="scenario-victory-dialog"]').count()
        mres = await page.locator('[data-testid="scenario-mastery-results"]').count()
        check("SCENARIO 4d victory dialog with mastery results", dlg == 1 and mres == 1, f"({dlg},{mres})")
        await page.click('[data-testid="scenario-continue-button"]')

        # ================= SCENARIO: deadline + inbreeding fails =================
        await page.click('[data-testid="hud-exit-button"]')
        await page.wait_for_timeout(600)
        await start_bloodline(page)
        await S("(() => { const s = window.__game.state; s.day = (s.scenario.startDay || 1) + 15; })()")
        await step_to_scenario_tick(page)
        lost = await S("({ status: window.__game.state.scenario.status, by: window.__game.state.scenario.failedBy })")
        check("SCENARIO 5a funding window closing fails the mission", lost["status"] == "lost" and lost["by"] == "deadline", str(lost))
        ddlg = await page.locator('[data-testid="scenario-defeat-dialog"]').count()
        check("SCENARIO 5b defeat dialog shown", ddlg == 1, f"({ddlg})")
        await page.click('[data-testid="scenario-exit-button"]')
        await page.wait_for_timeout(600)
        await start_bloodline(page)
        await S("(() => { window.__game.state.stats.inbredBySpecies = { nyxarr: 1 }; })()")
        await step_to_scenario_tick(page)
        lost2 = await S("({ status: window.__game.state.scenario.status, by: window.__game.state.scenario.failedBy })")
        check("SCENARIO 5c an inbred Sovereign birth voids the program", lost2["status"] == "lost" and lost2["by"] == "inbred", str(lost2))
        await page.click('[data-testid="scenario-exit-button"]')
        await page.wait_for_timeout(600)

        # ================= BREEDING RULE: a pair-tolerant apex can actually pair + give birth =================
        await start_bloodline(page)
        paired = False
        for _ in range(14):
            await S(
                """(() => { const s = window.__game.state;
                    for (const c of s.creatures) { c.needs = { hunger: 1, thirst: 1, energy: 1 }; c.stress = 0; c.welfare = 0.9; }
                    window.__game.stepTicks(200); })()"""
            )
            paired = await S("(window.__game.state.stats.courtships || 0) >= 1")
            if paired:
                break
        check("BREEDING 1 two adult Sovereigns (max 2) pair-bond", paired, "(no courtship after 2800 ticks)")
        born = False
        for _ in range(8):
            await S(
                """(() => { const s = window.__game.state;
                    for (const c of s.creatures) { c.needs = { hunger: 1, thirst: 1, energy: 1 }; c.stress = 0; c.welfare = 0.9; }
                    window.__game.stepTicks(200); })()"""
            )
            born = await S("(window.__game.state.stats.birthsBySpecies?.nyxarr || 0) >= 1")
            if born:
                break
        post = await S("({ nyx: window.__game.state.creatures.filter(c => c.speciesId === 'nyxarr').length, juv: window.__game.state.creatures.filter(c => c.juvenile).length, births: window.__game.state.stats.births, prog: window.__game.state.scenario.progress })")
        check("BREEDING 2 juvenile Sovereign born; bloodline stats + goals advance", born and post["nyx"] == 3 and post["juv"] == 1 and post["prog"].get("bond") and post["prog"].get("offspring") is False, str(post))
        chip3 = await page.locator('[data-testid="scenario-goal-progress-offspring"]').inner_text()
        check("BREEDING 3 offspring chip shows 1/3", chip3.strip() == "1/3", f"({chip3})")

        check("NO PAGE ERRORS", not errors, str(errors[:3]))
        await browser.close()
        total = len(RESULTS)
        passed = sum(1 for r in RESULTS if r)
        print(f"\n== {passed}/{total} PASS ==")


asyncio.run(main())
