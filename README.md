# Aetherion Reserve

A creature-containment / park-management game. React UI over a custom HTML5 Canvas isometric renderer, a
deterministic fixed-timestep simulation, a small FastAPI save service and MongoDB save slots. **All art and
audio are generated procedurally in code** — there are no image or sound assets.

See `HANDOFF.md` for the full technical map (simulation loops, render passes, hotkeys, data schemas) and
`plan.md` for the phase-by-phase history and roadmap.

## Run it locally (three processes)

```bash
# 1) MongoDB (throwaway local instance)
docker run -d --name aetherion-mongo -p 27017:27017 mongo:7

# 2) Backend — FastAPI save service on :8001
cd backend
cp .env.example .env            # MONGO_URL / DB_NAME / CORS_ORIGINS
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# 3) Frontend — React dev server on :3000
cd frontend
cp .env.example .env            # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start
```

Open http://localhost:3000. The frontend calls the backend at `${REACT_APP_BACKEND_URL}/api/...`.

> If `requirements.txt` fights your platform, the save service itself only needs
> `fastapi uvicorn motor pydantic python-dotenv`.

## Save scoping

Each browser generates a random player token (stored in `localStorage` as `aetherion_player_token`) and sends it
as the `X-Player-Token` header. Saves are stored with that token as `owner`; a browser only lists/loads/updates
its own saves. Legacy saves written before this scheme have no owner and stay visible to everyone.

## Tests

The suites in `tests/` are Playwright (browser) and `requests` (backend) scripts. They target the URL in the
`AETHERION_URL` environment variable (defaulting to the hosted preview), so point them at your local stack:

```bash
pip install playwright requests && playwright install chromium
export AETHERION_URL=http://localhost:3000        # backend suites append /api
export DB_NAME=aetherion_test                      # in backend/.env — keep test saves out of your real DB

python tests/backend_api_test.py                   # save-service CRUD
python tests/backend_regression_test.py
python tests/assessment_fixes_test.py              # H1/H2/H4 correctness + determinism
python tests/creature_art_test.py                  # Phase G sprite sheets + in-world screenshots
python tests/smoke_game.py                         # end-to-end play loop
python tests/phase20_features_test.py              # run heavy browser suites ONE AT A TIME
```

Browser suites count rendered frames; running two in parallel starves the headless renderer and produces
flaky timing failures. `python tests/art_gallery.py a|b|c [night]` renders sprite review sheets to `artifacts/`.

## Project layout

```
backend/server.py                FastAPI save service (/api/saves CRUD)
frontend/src/game/               simulation (sim.js, creatures.js, state.js), renderer.js, fx.js, audio.js
frontend/src/game/art/           procedural pixel painters (pixel.js toolkit, rig.js, creatures_*.js, buildings.js ...)
frontend/src/components/game/    React HUD / panels / menus over the canvas
tests/                           Playwright + requests suites (see above)
```
