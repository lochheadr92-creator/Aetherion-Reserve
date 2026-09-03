"""Shared test configuration.

All suites target the URL in the AETHERION_URL environment variable and fall back to the
hosted preview, so behaviour with no env var set is identical to before. Backend suites use API.

    AETHERION_URL=http://localhost:3000 python tests/smoke_game.py
"""
import os

URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com").rstrip("/")
API = URL + "/api"
