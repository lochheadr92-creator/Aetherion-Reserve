"""Creature Vocals: each species gets short positioned calls when idle, alarmed or feeding.

  A (classic renderer, default headless launch)
    IDLE     a calm on-screen animal raises an ambient `voice:<kind>:idle` cue on its personal timer
    POS      the call is 3D-positioned: centred animal -> pan ~0 and an open low-pass; camera moved so
             the animal sits right / left of centre -> pan > 0 / < 0, further away -> lower cutoff
    FEED     the start of an eating bout raises `voice:<kind>:feed`
    ALARM    an alarm (threat display) cuts through the same animal's recent idle call (400 ms, not 2.6 s)
    SPECIES  voiceProfile(sheet, speciesId) carries a stable per-species signature (detune / syllables /
             rasp) on top of the body-plan family; species differ
    SIM      the simulation is untouched (paused tick + cash constant); no page errors
  B (forced 3D renderer, SwiftShader)
    3D       the scheduler runs in the WebGL branch too: an idle cue fires while the 3D world renders

    python tests/creature_vocals_test.py
"""
import asyncio
import sys
from playwright.async_api import async_playwright

from config import URL

GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


STATS = "({ v: JSON.parse(JSON.stringify(window.__audio.voices)), log: window.__audio.log.map(l => l.kind).filter(k => k.startsWith('voice:')), sp: window.__audio.lastSpatial || null, st: JSON.parse(JSON.stringify(window.__vocals.stats)) })"
RESET = "(() => { window.__audio.log.length = 0; const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; v.byEvent = {}; window.__audio._voiceAt.clear(); window.__audio._voiceTimes.length = 0; window.__audio._lastVoiceAt = 0; window.__audio.lastSpatial = null; })()"
# make creature i calm + idle, centre the camera on it (optionally offset), and arm its idle timer
CALM = """([i, dx, dy]) => { const s = window.__game.state, r = window.__gameRenderer; const c = s.creatures[i];
  c.escaped = false; c.stress = 0; c.path = []; c.state = 'idle'; c.cloaked = false;
  r.cam.zoom = 1.6; r.centerOn(c.x + dx, c.y + dy);
  const m = window.__vocals.mem.get(c.id); if (m) { m.nextIdle = 0; m.display = m.lunging = m.feeding = false; }
  return c.id; }"""


async def wait_for(page, expr, tries=20, ms=150):
    for _ in range(tries):
        if await page.evaluate(expr):
            return True
        await page.wait_for_timeout(ms)
    return False


async def part_a():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done'); localStorage.setItem('aetherion_audio_enabled','true')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-scenario"]')
        await page.click('[data-testid="scenario-card-skitter_bloom"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')
        base = await page.evaluate("({ tick: window.__game.state.tick, cash: window.__game.state.cash, n: window.__game.state.creatures.length, ctx: window.__audio.ctx && window.__audio.ctx.state })")
        check("SETUP creatures present, audio context running, vocal scheduler installed", base["n"] >= 4 and base["ctx"] == "running" and await page.evaluate("!!window.__vocals"), str(base))

        # ---- idle call, centred ----
        await page.evaluate(RESET)
        await page.evaluate(CALM, [0, 0, 0])
        ok = await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        st = await page.evaluate(STATS)
        idle_logs = [k for k in st["log"] if k.endswith(":idle")]
        check("IDLE 1 a calm on-screen animal raises an ambient idle call on its timer", ok and idle_logs and st["v"]["played"] >= 1 and st["st"]["idle"] >= 1, str(st["log"]) + str(st["v"]))
        centre = st["sp"]
        check("POS 1 centred animal: pan ~0, near, open low-pass", centre and abs(centre["pan"]) < 0.15 and centre["proximity"] > 0.85 and centre["lp"] > 6500, str(centre))

        # ---- positioned: animal right of centre, then left ----
        await page.evaluate(RESET)
        await page.evaluate(CALM, [0, -5, 5])  # camera target moved down-left in iso -> animal appears to the right
        await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        right = (await page.evaluate(STATS))["sp"]
        await page.evaluate(RESET)
        await page.evaluate(CALM, [0, 5, -5])
        await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        left = (await page.evaluate(STATS))["sp"]
        check("POS 2 animal right of centre pans right; left of centre pans left", right and left and right["pan"] > 0.3 and left["pan"] < -0.3, f"right={right} left={left}")
        check("POS 3 further from the viewport centre -> lower proximity and a duller low-pass than centred",
              right and right["proximity"] < centre["proximity"] - 0.15 and right["lp"] < centre["lp"] - 800, f"centre={centre} right={right}")

        # ---- feeding ----
        await page.evaluate(RESET)
        await page.evaluate("""(() => { const s = window.__game.state, r = window.__gameRenderer; const c = s.creatures[0];
            c.escaped = false; c.stress = 0; c.path = []; c.state = 'idle'; c.cloaked = false; r.cam.zoom = 1.6; r.centerOn(c.x, c.y);
            const m = window.__vocals.mem.get(c.id); if (m) { m.nextIdle = Infinity; m.display = m.lunging = m.feeding = false; } })()""")
        await page.wait_for_timeout(200)
        await page.evaluate("(() => { const c = window.__game.state.creatures[0]; c.state = 'eating'; c.path = []; })()")
        ok = await wait_for(page, "(window.__audio.voices.byEvent.feed || 0) >= 1")
        st = await page.evaluate(STATS)
        check("FEED 1 the start of an eating bout raises a feed call", ok and any(k.endswith(":feed") for k in st["log"]) and st["st"]["feed"] >= 1, str(st["log"]))
        # staying in the bout does not re-trigger
        await page.wait_for_timeout(700)
        st2 = await page.evaluate(STATS)
        check("FEED 2 a continuing bout is a single cue (rising edge only)", (st2["v"]["byEvent"].get("feed") or 0) == 1, str(st2["v"]["byEvent"]))

        # ---- alarm cuts through a recent idle call ----
        await page.evaluate(RESET)
        await page.evaluate(CALM, [0, 0, 0])
        await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        t_idle = await page.evaluate("Date.now()")
        await page.evaluate("(() => { const c = window.__game.state.creatures[0]; c.speciesId = 'karrgan'; c.escaped = true; c.stress = 0.95; c.path = []; c.state = 'idle'; })()")
        # either alarm cue counts: a fresh display edge raises 'threat', unless the lunge frame-cycle window is
        # already open, in which case the scheduler (correctly) voices the 'lunge' burst first. Both are alarms
        # and both use the 400 ms cut-through window (audio.creatureVoice: alarm = threat || lunge).
        ok = await wait_for(page, "((window.__audio.voices.byEvent.threat || 0) + (window.__audio.voices.byEvent.lunge || 0)) >= 1", tries=16, ms=100)
        dt = await page.evaluate("Date.now()") - t_idle
        st = await page.evaluate(STATS)
        alarmed = any(k in ("voice:snarl:threat", "voice:snarl:lunge") for k in st["log"])
        check("ALARM 1 an alarm (threat display / lunge) cuts through the same animal's idle call within ~1 s (not the 2.6 s spacing)", ok and dt < 1600 and alarmed, f"dt={dt}ms log={st['log']}")

        # ---- per-species signature ----
        prof = await page.evaluate("""(() => { const a = window.__audio, r = window.__gameRenderer; const out = {};
            for (const id of ['karrgan', 'nyxarr', 'vantha', 'lumen', 'silttitan', 'aurox', 'skitter', 'veyra']) out[id] = a.voiceProfileFor(r.sheetFor(id), id);
            return out; })()""")
        sigs = {k: (round(v["detune"], 3), v["syllables"]) for k, v in prof.items()}
        check("SPECIES 1 profiles carry detune (0.9..1.1), syllables (1..3) and rasp (0..1)",
              all(0.9 <= v["detune"] <= 1.1 and 1 <= v["syllables"] <= 3 and 0 <= v["rasp"] <= 1 for v in prof.values()), str(sigs))
        check("SPECIES 2 signatures differ across species (same call family, different voice)", len(set(sigs.values())) >= 5, str(sigs))
        again = await page.evaluate("window.__audio.voiceProfileFor(window.__gameRenderer.sheetFor('skitter'), 'skitter')")
        check("SPECIES 3 signature is stable (deterministic hash of the species id)", again["detune"] == prof["skitter"]["detune"] and again["syllables"] == prof["skitter"]["syllables"])

        after = await page.evaluate("({ tick: window.__game.state.tick, cash: window.__game.state.cash })")
        check("SIM 1 vocals never touch the simulation (paused tick + cash unchanged)", after["tick"] == base["tick"] and after["cash"] == base["cash"], f"{base} -> {after}")

        # ---- subtitles: caption next to the caller, fades, toggle persists ----
        await page.evaluate("(() => { const c = window.__game.state.creatures[0]; c.speciesId = 'skitter'; c.escaped = false; c.stress = 0; window.__audio.setSubtitles(true); })()")
        await page.evaluate(RESET)
        await page.evaluate(CALM, [0, 0, 0])
        await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        caps = await page.evaluate("window.__vocals.liveCaptions().map(k => ({ id: k.id, text: k.text, event: k.event, speciesId: k.speciesId }))")
        cid = await page.evaluate("window.__game.state.creatures[0].id")
        check("SUB 1 an idle call raises a subtitle next to the caller ('<Species> chirps')",
              caps and caps[0]["id"] == cid and caps[0]["event"] == "idle" and caps[0]["text"].endswith(" chirps") and "Skitter" in caps[0]["text"], str(caps))
        check("SUB 1b the caption carries the caller's species (drives the per-species tint + swatch)", caps and caps[0].get("speciesId") == "skitter", str(caps))
        await page.wait_for_timeout(1800)
        check("SUB 2 the subtitle expires after ~1.6 s", await page.evaluate("window.__vocals.liveCaptions().length") == 0)
        # alarmed captions carry the alarm verb; muted players still get captions
        await page.evaluate("window.__audio.setEnabled(false)")
        await page.evaluate(RESET)
        await page.evaluate("(() => { const c = window.__game.state.creatures[0]; c.speciesId = 'karrgan'; c.escaped = true; c.stress = 0.95; c.path = []; c.state = 'idle'; const m = window.__vocals.mem.get(c.id); m.display = m.lunging = false; })()")
        # other animals may raise their own idle captions meanwhile: wait for + check the karrgan's caption specifically
        await wait_for(page, "window.__vocals.liveCaptions().some(k => k.text.includes('Karrgan'))")
        caps = await page.evaluate("window.__vocals.liveCaptions().map(k => k.text)")
        karr = [t for t in caps if "Karrgan" in t]
        check("SUB 3 alarm cue -> alarm verb; captions still appear while audio is muted", karr and ("snarls" in karr[0] or "lunges" in karr[0]), str(caps))
        await page.evaluate("window.__audio.setEnabled(true)")
        # HUD toggle off -> no captions for new cues, persisted
        await page.click('[data-testid="hud-audio-button"]')
        await page.wait_for_selector('[data-testid="subtitles-toggle"]', timeout=5000)
        on_txt = await page.locator('[data-testid="subtitles-toggle"]').inner_text()
        await page.click('[data-testid="subtitles-toggle"]')
        off_txt = await page.locator('[data-testid="subtitles-toggle"]').inner_text()
        stored = await page.evaluate("localStorage.getItem('aetherion_subtitles')")
        await page.click('[data-testid="hud-audio-button"]')
        await page.evaluate("window.__vocals.captions.length = 0")
        await page.evaluate(RESET)
        await page.evaluate("(() => { const c = window.__game.state.creatures[0]; c.speciesId = 'skitter'; c.escaped = false; c.stress = 0; })()")
        await page.evaluate(CALM, [0, 0, 0])
        await wait_for(page, "(window.__audio.voices.byEvent.idle || 0) >= 1")
        check("SUB 4 HUD toggle turns subtitles off (persisted) and new cues raise no caption",
              "ON" in on_txt and "OFF" in off_txt and stored == "false" and await page.evaluate("window.__vocals.liveCaptions().length") == 0, (on_txt, off_txt, stored))
        await page.evaluate("window.__audio.setSubtitles(true)")
        # species caption colours: accent lifted toward white, memoised, distinct per species, safe default
        tints = await page.evaluate("({ k: window.__vocals.captionTint('karrgan'), s: window.__vocals.captionTint('skitter'), s2: window.__vocals.captionTint('skitter'), sw: window.__vocals.captionSwatch('skitter'), unknown: window.__vocals.captionTint('no-such-species') })")
        hex6 = lambda v: isinstance(v, str) and len(v) == 7 and v.startswith('#') and all(ch in '0123456789abcdefABCDEF' for ch in v[1:])
        def lum(v): return sum(int(v[i:i+2], 16) for i in (1, 3, 5)) / 3
        check("SUB 5 species caption tints: valid hex, distinct per species, lighter than the raw swatch, default for unknown ids",
              all(hex6(v) for v in (tints["k"], tints["s"], tints["sw"])) and tints["k"] != tints["s"] and tints["s"] == tints["s2"]
              and lum(tints["s"]) > lum(tints["sw"]) and tints["unknown"] == "#E6EDF5", str(tints))
        check("A no page errors", not errors, errors[:2])
        await browser.close()


async def part_b():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=GL_ARGS)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:200]))
        await page.goto(URL + "?gfx=low&render3d=1", wait_until="networkidle", timeout=90000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done'); localStorage.setItem('aetherion_audio_enabled','true')")
        await page.reload(wait_until="networkidle")
        await page.click('[data-testid="mode-scenario"]', force=True)
        await page.click('[data-testid="scenario-card-skitter_bloom"]', force=True)
        await page.click('[data-testid="start-game-button"]', force=True)
        await page.wait_for_timeout(1500)
        await asyncio.wait_for(page.evaluate("window.__game.setPaused(true)"), 60)
        mode = None
        for _ in range(4):
            await page.wait_for_timeout(2500)
            try:
                mode = await asyncio.wait_for(page.evaluate("window.__renderMode"), 60)
                if mode == "3d":
                    break
            except Exception:
                mode = "timeout"
        if mode != "3d":
            check("3D 0 forced 3D renderer attached (SwiftShader)", False, str(mode))
            await browser.close()
            return
        await asyncio.wait_for(page.evaluate(RESET), 60)
        await asyncio.wait_for(page.evaluate("window.__vocals.last = null"), 60)
        await asyncio.wait_for(page.evaluate(CALM, [0, 0, 0]), 60)
        # SwiftShader frames can take seconds each (shader compiles), so poll rendered frames rather than
        # wall-clock: the scheduler runs once per frame and needs a few frames after CALM to place the cue
        f0 = await asyncio.wait_for(page.evaluate("window.__gameRenderer.frame"), 60)
        fired = False
        frames = 0
        for _ in range(40):
            await page.wait_for_timeout(1500)
            try:
                if await asyncio.wait_for(page.evaluate("(window.__audio.voices.byEvent.idle || 0) >= 1 && !!window.__vocals.last"), 60):
                    fired = True
                    break
                frames = await asyncio.wait_for(page.evaluate("window.__gameRenderer.frame"), 60) - f0
                if frames >= 8:
                    break  # plenty of frames rendered and still no cue: a real failure, stop waiting
            except Exception:
                pass
        st = await asyncio.wait_for(page.evaluate("({ log: window.__audio.log.map(l => l.kind).filter(k => k.startsWith('voice:')), last: window.__vocals.last, mode: window.__renderMode })"), 60)
        st["framesAfterCalm"] = frames
        check("3D 1 the vocal scheduler runs under the WebGL renderer: idle cue fires with a spatial placement",
              fired and st["last"] and st["last"]["event"] == "idle" and abs(st["last"]["pan"]) < 0.15 and st["mode"] == "3d", f"{st}")
        check("B no page errors", not errors, errors[:2])
        await browser.close()


async def main():
    await part_a()
    await part_b()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
