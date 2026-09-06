"""Creature Voices (Phase L4) acceptance in a real browser.

  cue     an escaped, stressed predator centred on screen produces a `voice:snarl:threat` entry on
          the rising edge of its threat display and a `voice:snarl:lunge` entry when its lunge
          burst starts; with the AudioContext running (first click unlocks it) voices.played grows.
  limit   four agitated animals at once: the rolling cap (3 voices / 2s, 320ms global gap, 2.6s per
          animal) keeps the played count bounded and records limited attempts.
  mute    with audio muted the cues are still logged but voices.played stays flat and voices.muted
          grows; unmuting resumes playback.
  offscr  an agitated animal far outside the viewport attempts no voice at all.
  profile voiceProfile(): predators -> snarl, floaters -> keen, heavy bodies -> bellow, small -> chirp;
          bigger silhouettes get a lower pitch.
  sim     the simulation state is untouched by voices (paused tick + cash constant).

Usage: AETHERION_URL=... python tests/creature_voices_test.py   (preview URL by default)
"""
import asyncio, sys
from playwright.async_api import async_playwright

from config import URL

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


AGITATE = """([i, species]) => { const s = window.__game.state, r = window.__gameRenderer; const c = s.creatures[i];
  c.speciesId = species; c.escaped = true; c.stress = 0.95; c.path = []; c.state = 'idle'; c.cloaked = false;
  return c.id; }"""

CENTER = """(i) => { const s = window.__game.state, r = window.__gameRenderer; const c = s.creatures[i]; r.cam.zoom = 2; r.centerOn(c.x, c.y); }"""

STATS = "({ v: { ...window.__audio.voices }, log: window.__audio.log.map(l => l.kind).filter(k => k.startsWith('voice:')), ctx: window.__audio.ctx ? window.__audio.ctx.state : null, enabled: window.__audio.enabled })"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:160]))
        page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)

        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1'); localStorage.removeItem('aetherion_scenarios_done'); localStorage.setItem('aetherion_audio_enabled','true')")
        await page.wait_for_timeout(500)
        await page.click('[data-testid="mode-scenario"]')
        await page.click('[data-testid="scenario-card-skitter_bloom"]')
        await page.click('[data-testid="start-game-button"]')
        await page.wait_for_timeout(1500)
        await page.click('[data-testid="hud-time-pause-button"]')  # paused: the sim never moves during the test
        base = await page.evaluate("({ tick: window.__game.state.tick, cash: window.__game.state.cash, n: window.__game.state.creatures.length })")
        check("SETUP scenario has creatures + audio context running after the first click", base["n"] >= 4 and (await page.evaluate(STATS))["ctx"] == "running", str(base))

        # ---- profiles ----
        prof = await page.evaluate("""(() => { const a = window.__audio, r = window.__gameRenderer; const out = {};
            for (const id of ['karrgan', 'nyxarr', 'vantha', 'lumen', 'silttitan', 'aurox', 'skitter', 'veyra']) out[id] = a.voiceProfileFor(r.sheetFor(id));
            return out; })()""")
        check("PROFILE 1 predators snarl, floaters keen, colossi bellow, small animals chirp",
              prof["karrgan"]["kind"] == "snarl" and prof["nyxarr"]["kind"] == "snarl" and prof["vantha"]["kind"] == "snarl"
              and prof["lumen"]["kind"] == "keen" and prof["silttitan"]["kind"] == "bellow" and prof["aurox"]["kind"] == "bellow" and prof["skitter"]["kind"] == "chirp",
              str({k: v["kind"] for k, v in prof.items()}))
        check("PROFILE 2 bigger silhouettes get a lower pitch", prof["aurox"]["pitch"] < prof["skitter"]["pitch"] and prof["karrgan"]["pitch"] < prof["skitter"]["pitch"], str({k: round(v["pitch"], 2) for k, v in prof.items()}))

        # ---- single agitated predator on screen ----
        await page.evaluate("(() => { window.__audio.log.length = 0; const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; })()")
        await page.evaluate(AGITATE, [0, "karrgan"])
        await page.evaluate(CENTER, 0)
        await page.wait_for_timeout(900)
        st = await page.evaluate(STATS)
        check("CUE 1 threat display rising edge logs voice:snarl:threat and plays it", "voice:snarl:threat" in st["log"] and st["v"]["played"] >= 1, str(st))
        # lunge bursts recur every 96 RENDER frames (headless rAF can be slow): wait on frames, not ms
        f0 = await page.evaluate("window.__gameRenderer.frame")
        seen = False
        for _ in range(60):
            await page.wait_for_timeout(300)
            st = await page.evaluate(STATS)
            if "voice:snarl:lunge" in st["log"]:
                seen = True
                break
            if await page.evaluate("window.__gameRenderer.frame") - f0 > 260:
                break
        check("CUE 2 a lunge burst logs voice:snarl:lunge within ~2.5 lunge cycles", seen, str(st["log"]))

        # ---- rate limiting with four agitated animals ----
        await page.evaluate("(() => { window.__audio.log.length = 0; const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; })()")
        for i, sp in ((1, "vantha"), (2, "nyxarr"), (3, "silttitan")):
            await page.evaluate(AGITATE, [i, sp])
        await page.wait_for_timeout(3200)
        st = await page.evaluate(STATS)
        check("LIMIT 1 four agitated animals: <= 6 voices played in 3.2s, some attempts rate-limited", 1 <= st["v"]["played"] <= 6 and st["v"]["limited"] >= 1, str(st["v"]))
        kinds = {k.split(":")[1] for k in st["log"]}
        check("LIMIT 2 different species use different voice profiles", "snarl" in kinds and ("bellow" in kinds or len(kinds) >= 2), str(kinds))

        # ---- mute ----
        await page.evaluate("(() => { window.__audio.setEnabled(false); const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; })()")
        await page.wait_for_timeout(3000)
        st = await page.evaluate(STATS)
        check("MUTE 1 muted: cues still attempted, nothing played, muted counter grows", st["v"]["attempted"] >= 1 and st["v"]["played"] == 0 and st["v"]["muted"] >= 1, str(st["v"]))
        await page.evaluate("(() => { window.__audio.setEnabled(true); const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; })()")
        await page.wait_for_timeout(3000)
        st = await page.evaluate(STATS)
        check("MUTE 2 unmuted: playback resumes", st["v"]["played"] >= 1, str(st["v"]))

        # ---- off-screen animals stay quiet ----
        await page.evaluate("(() => { const r = window.__gameRenderer; r.centerOn(2, 2); const v = window.__audio.voices; v.attempted = v.played = v.limited = v.muted = 0; })()")
        await page.wait_for_timeout(2500)
        st = await page.evaluate(STATS)
        check("OFFSCREEN 1 agitated animals outside the viewport attempt no voices", st["v"]["attempted"] == 0, str(st["v"]))

        after = await page.evaluate("({ tick: window.__game.state.tick, cash: window.__game.state.cash })")
        check("SIM 1 voices never touch the simulation (paused tick + cash unchanged)", after["tick"] == base["tick"] and after["cash"] == base["cash"], f"{base} -> {after}")
        check("NO console / page errors", not errors, str(errors)[:300])
        await browser.close()

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
