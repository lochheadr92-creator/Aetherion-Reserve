"""Scenario test: management mode — discovery loop, guests, economy."""
import asyncio
import os
from playwright.async_api import async_playwright

from config import URL
async def center(page, x, y):
    await page.evaluate("([x,y]) => window.__gameRenderer.centerOn(x, y)", [x, y])
    await page.wait_for_timeout(80)


async def tile_screen(page, x, y):
    return await page.evaluate(
        """([x, y]) => {
            const r = window.__gameRenderer; const s = window.__game.state;
            const h = s.heights[y * s.size + x] || 0;
            const wx = (x + 0.5 - y - 0.5) * 32, wy = (x + 0.5 + y + 0.5) * 16 - h * 10;
            return { sx: wx * r.cam.zoom + r.cam.x, sy: wy * r.cam.zoom + r.cam.y, zoom: r.cam.zoom };
        }""",
        [x, y],
    )


async def click_tile(page, x, y):
    p = await tile_screen(page, x, y)
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(45)


async def place_edge(page, x, y, d):
    p = await page.evaluate(
        """([x,y,d]) => {
            const s = window.__game.state, r = window.__gameRenderer;
            const h1 = s.heights[y*s.size+x] || 0;
            const nx = d==='E' ? x+1 : x, ny = d==='S' ? y+1 : y;
            const h2 = (nx < s.size && ny < s.size) ? s.heights[ny*s.size+nx] : h1;
            const h = Math.max(h1, h2);
            const cx = (x+0.5-y-0.5)*32, cy = (x+0.5+y+0.5)*16 - h*10;
            const mx = d==='E' ? cx+16 : cx-16, my = cy+8;
            return { sx: mx*r.cam.zoom + r.cam.x, sy: my*r.cam.zoom + r.cam.y };
        }""",
        [x, y, d],
    )
    await page.mouse.click(p["sx"], p["sy"])
    await page.wait_for_timeout(45)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1920, "height": 950})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)[:300]))
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1200)
        await page.evaluate("localStorage.setItem('aetherion_tutorial_done','1')")
        await page.click('[data-testid="start-game-button"]')  # management mode default
        await page.wait_for_timeout(2000)
        S = lambda expr: page.evaluate(expr)
        await page.click('[data-testid="hud-time-pause-button"]')  # pause while building

        # ---- path from entrance stub (36,67) north to (36,55) ----
        await center(page, 36, 62)
        await page.click('[data-testid="cat-paths"]')
        await page.click('[data-testid="tool-path"]')
        for y in range(66, 54, -1):
            await click_tile(page, 36, y)
        n_paths = await S("window.__game.state.paths.reduce((a,b)=>a+b,0)")
        print("paths:", n_paths)

        # ---- flatten + admin (3x3) at (32,58) adjacent to path? not adjacent. put at (37,58) ----
        await page.click('[data-testid="cat-terrain"]')
        await page.click('[data-testid="tool-flatten"]')
        await page.click('[data-testid="brush-size-3"]')
        for tx, ty in [(38, 58), (39, 60), (42, 58), (44, 60), (42, 62), (39, 57), (43, 57)]:
            await click_tile(page, tx, ty)
        await page.click('[data-testid="brush-size-1"]')
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-admin"]')
        await click_tile(page, 37, 57)
        admin = await S("window.__game.state.buildings.filter(b=>b.type==='admin').length")
        print("admin placed:", "PASS" if admin == 1 else "FAIL")

        # ---- lab for research ----
        await page.click('[data-testid="building-lab"]')
        await click_tile(page, 37, 61)
        lab = await S("window.__game.state.buildings.filter(b=>b.type==='lab').length")
        print("lab placed:", "PASS" if lab == 1 else "FAIL")

        # ---- viewing platform adjacent to path at (34,56)? place at (34,55) ----
        await page.click('[data-testid="cat-terrain"]'); await page.click('[data-testid="tool-flatten"]'); await page.click('[data-testid="brush-size-3"]')
        for tx, ty in [(34, 56), (33, 54)]:
            await click_tile(page, tx, ty)
        await page.click('[data-testid="brush-size-1"]')
        await page.click('[data-testid="cat-facilities"]')
        await page.click('[data-testid="building-viewing"]')
        await click_tile(page, 34, 55)
        viewing = await S("window.__game.state.buildings.filter(b=>b.type==='viewing').length")
        print("viewing platform:", "PASS" if viewing == 1 else "FAIL")

        # ---- food stall + restroom near path ----
        await page.click('[data-testid="building-drink_stall"]')
        await click_tile(page, 35, 60)
        await page.click('[data-testid="building-restroom"]')
        await click_tile(page, 35, 62)
        stalls = await S("window.__game.state.buildings.length")
        print("total buildings:", stalls)

        # ---- enclosure next to platform: rect (30..37, 50..53)?? keep clear of platform(34,55 2x2) & path x=36 ----
        # use rect (28..34, 46..52)
        await page.click('[data-testid="cat-terrain"]'); await page.click('[data-testid="tool-flatten"]'); await page.click('[data-testid="brush-size-3"]')
        await center(page, 31, 49)
        for tx, ty in [(29, 47), (33, 47), (29, 51), (33, 51), (31, 49)]:
            await click_tile(page, tx, ty)
        await page.click('[data-testid="brush-size-1"]')
        x0, y0, x1, y1 = 28, 46, 34, 52
        await page.click('[data-testid="cat-fences"]')
        await page.click('[data-testid="fence-tier-1"]')
        for _ in range(3):
            for x in range(x0, x1 + 1):
                await place_edge(page, x, y0 - 1, "S")
                await place_edge(page, x, y1, "S")
            for y in range(y0, y1 + 1):
                await place_edge(page, x0 - 1, y, "E")
                await place_edge(page, x1, y, "E")
            missing = await page.evaluate(
                """([x0,y0,x1,y1]) => {
                    const f = window.__game.state.fences; const miss = [];
                    for (let x=x0; x<=x1; x++) { if(!f[`${x},${y0-1},S`]) miss.push([x,y0-1,'S']); if(!f[`${x},${y1},S`]) miss.push([x,y1,'S']); }
                    for (let y=y0; y<=y1; y++) { if(!f[`${x0-1},${y},E`]) miss.push([x0-1,y,'E']); if(!f[`${x1},${y},E`]) miss.push([x1,y,'E']); }
                    return miss;
                }""",
                [x0, y0, x1, y1],
            )
            if not missing:
                break
        print("enclosure perimeter:", "PASS" if not missing else f"FAIL {missing}")
        await page.click('[data-testid="tool-gate"]')
        await place_edge(page, 31, y1, "S")

        # water inside enclosure (aquatic evidence source) + feeder
        await page.click('[data-testid="cat-water"]')
        await page.click('[data-testid="tool-water-shallow"]')
        await page.click('[data-testid="brush-size-2"]')
        await click_tile(page, 30, 48)
        await page.click('[data-testid="brush-size-1"]')
        wtiles = await S("window.__game.state.water.filter(w=>w>0).length")
        await page.click('[data-testid="cat-habitat"]')
        await page.click('[data-testid="building-feeder_forage"]')
        await click_tile(page, 33, 50)

        # ---- acquire 3 veyra (hidden: water, social) ----
        for i in range(3):
            await page.click('[data-testid="open-fieldops-button"]')
            await page.wait_for_timeout(350)
            await page.click('[data-testid="acquire-buy-veyra"]')
            await page.wait_for_timeout(250)
            await click_tile(page, 31, 49)
        nc = await S("window.__game.state.creatures.length")
        print("veyra released:", nc, "PASS" if nc == 3 else "FAIL")

        # unknown attrs gated?
        unknown = await S("""(() => {
            const k = window.__game.state.knowledge['veyra'];
            return { discovered: Object.keys(k.discovered), evidence: k.evidence };
        })()""")
        print("veyra knowledge initial:", unknown)

        cash0 = await S("window.__game.state.cash")

        # ---- start research (Observation Protocols I) ----
        await page.click('[data-testid="open-research-button"]')
        await page.wait_for_timeout(400)
        await page.click('[data-testid="research-start-bio_obs1"]')
        await page.wait_for_timeout(300)
        await page.click('[data-testid="research-close-button"]')
        active = await S("window.__game.state.research.active?.id")
        print("research started:", active, "PASS" if active == "bio_obs1" else "FAIL")

        # ---- run at 3x for ~75s ----
        await page.click('[data-testid="hud-speed-3-button"]')
        for i in range(15):
            await page.wait_for_timeout(5000)
            snap = await S("""(() => {
                const s = window.__game.state;
                const k = s.knowledge['veyra'];
                return { tick: s.tick, guests: s.guests.length, guestsTotal: s.stats.guestsTotal,
                         cash: Math.round(s.cash), discoveries: s.stats.discoveries,
                         evidence: k.evidence, discovered: Object.keys(k.discovered),
                         research: s.research.active ? s.research.active.progress : 'done',
                         dyn: s.research.dynamicProjects.map(p=>p.id) };
            })()""")
            print(f"t+{(i+1)*5}s:", snap)
            if snap["discoveries"] >= 1 and snap["guestsTotal"] > 5:
                break

        final = await S("""(() => {
            const s = window.__game.state;
            return { welfare: s.creatures.map(c=>+c.welfare.toFixed(2)),
                     states: s.creatures.map(c=>c.state),
                     income: s.finances.today.income, expenses: s.finances.today.expenses,
                     alerts: s.alerts.slice(0,6).map(a=>a.title + ': ' + a.msg.slice(0,60)),
                     rating: +s.rating.overall.toFixed(2), completed: s.research.completed };
        })()""")
        import json
        print("FINAL:", json.dumps(final, indent=1)[:1600])

        await page.screenshot(path="/tmp/scenario.jpg", quality=30, type="jpeg")
        print("PAGE ERRORS:" if errors else "No page errors.")
        for e in errors[:10]:
            print(" -", e)
        await browser.close()


asyncio.run(main())
