"""Backend: legacy (ownerless) save documents + X-Player-Token validation.

A save written before per-player scoping has NO `owner` key at all. The PUT/DELETE handlers
fetch it with the projection {"_id": 0, "owner": 1}, which yields an EMPTY dict for such a
document. `if not existing` treated that empty dict as "missing" and returned 404, so legacy
saves could never be updated, adopted or deleted. The handlers now test `existing is None`.

This suite inserts documents WITHOUT an owner key directly via motor (bypassing the API, which
always writes owner: null), then asserts through the HTTP API that:

  1  PUT with a token succeeds (200)
  2  the stored document's owner becomes that token (adoption)
  3  DELETE of the adopted document with the same token succeeds (200)
  4  DELETE of a second ownerless document (no prior PUT) with a token succeeds (200)
  5  both documents are gone from the collection
  6  token validation: > 64 chars -> 400; characters outside [A-Za-z0-9-] -> 400
  7  skip is capped at 10000 (10001 -> 422; 10000 -> 200)
  8  a valid 64-char token is accepted and an absent header still works (legacy)

Needs the backend .env (MONGO_URL / DB_NAME) — the API under test must share that database.

Usage: AETHERION_URL=http://localhost:3000 python tests/backend_ownerless_test.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from config import API
from save_cleanup import SaveCleanup

load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'} {name} {detail}")


def legacy_doc(name):
    """A save document exactly as a pre-scoping build wrote it: no `owner` key at all."""
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "park_name": "Legacy Facility",
        "mode": "management",
        "day": 3,
        "cash": 1000,
        "rating": 0.2,
        "creatures": 0,
        "state": {"tick": 42},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    token = f"legacy-{uuid.uuid4()}"
    headers = {"X-Player-Token": token}
    body = {"name": "adopted", "state": {"tick": 43}}

    put_doc, del_doc = legacy_doc("ownerless PUT"), legacy_doc("ownerless DELETE")
    with SaveCleanup() as tracker:
        tracker.add(put_doc["id"], token)
        tracker.add(del_doc["id"], token)
        try:
            await db.saves.insert_many([dict(put_doc), dict(del_doc)])
            stored = await db.saves.find_one({"id": put_doc["id"]}, {"_id": 0, "owner": 1})
            check("0 fixture really has no owner key (projection yields {})", stored == {}, str(stored))

            # ---- 1/2: PUT adopts the ownerless document ----
            r = requests.put(f"{API}/saves/{put_doc['id']}", json=body, headers=headers, timeout=15)
            check("1 PUT on an ownerless save with a token succeeds", r.status_code == 200, f"(status {r.status_code} {r.text[:120]})")
            after = await db.saves.find_one({"id": put_doc["id"]}, {"_id": 0, "owner": 1, "name": 1})
            check("2 document's owner becomes the caller's token", after is not None and after.get("owner") == token and after.get("name") == "adopted", str(after))

            # ---- 3: DELETE of the adopted document ----
            r = requests.delete(f"{API}/saves/{put_doc['id']}", headers=headers, timeout=15)
            check("3 DELETE of the adopted save with the same token succeeds", r.status_code == 200, f"(status {r.status_code})")

            # ---- 4: DELETE of a never-touched ownerless document ----
            r = requests.delete(f"{API}/saves/{del_doc['id']}", headers=headers, timeout=15)
            check("4 DELETE of an ownerless save (no prior PUT) with a token succeeds", r.status_code == 200, f"(status {r.status_code})")

            remaining = await db.saves.count_documents({"id": {"$in": [put_doc["id"], del_doc["id"]]}})
            check("5 both fixture documents removed from the collection", remaining == 0, f"({remaining} left)")
            if remaining == 0:  # deleted by the test itself: nothing left for teardown
                tracker.forget(put_doc["id"]); tracker.forget(del_doc["id"])
        finally:
            await db.saves.delete_many({"id": {"$in": [put_doc["id"], del_doc["id"]]}})

        # ---- 6: token validation ----
        too_long = {"X-Player-Token": "a" * 65}
        bad_chars = {"X-Player-Token": "abc_def.ghi"}
        r_long = requests.get(f"{API}/saves", headers=too_long, timeout=15)
        r_bad = requests.get(f"{API}/saves", headers=bad_chars, timeout=15)
        r_post_bad = requests.post(f"{API}/saves", json=body, headers=bad_chars, timeout=15)
        if r_post_bad.status_code == 200:  # must not happen; keep the DB clean if it does
            tracker.add(r_post_bad.json().get("id"))
        check("6a token longer than 64 chars is rejected with 400", r_long.status_code == 400, f"(status {r_long.status_code})")
        check("6b token with characters outside [A-Za-z0-9-] is rejected with 400 (GET and POST)",
              r_bad.status_code == 400 and r_post_bad.status_code == 400, f"(GET {r_bad.status_code}, POST {r_post_bad.status_code})")

        # ---- 7: skip cap ----
        r_over = requests.get(f"{API}/saves?skip=10001", headers=headers, timeout=15)
        r_edge = requests.get(f"{API}/saves?skip=10000", headers=headers, timeout=15)
        check("7 skip > 10000 is rejected (422); skip = 10000 accepted", r_over.status_code == 422 and r_edge.status_code == 200, f"({r_over.status_code} / {r_edge.status_code})")

        # ---- 8: valid edge cases ----
        ok64 = {"X-Player-Token": "A" * 64}
        r_ok = requests.get(f"{API}/saves", headers=ok64, timeout=15)
        r_none = requests.get(f"{API}/saves", timeout=15)
        check("8 64-char token accepted; absent header still served (legacy caller)", r_ok.status_code == 200 and r_none.status_code == 200, f"({r_ok.status_code} / {r_none.status_code})")

    client.close()
    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
