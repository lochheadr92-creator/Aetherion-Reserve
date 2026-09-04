"""Remediation pass backend verification.

Tests all 8 backend-related items from the remediation pass:
- Backend health endpoint
- CRUD operations with X-Player-Token
- Ownerless save adoption/deletion (item 1)
- Token validation and query param limits (item 2)
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
    status = "✅ PASS" if ok else "❌ FAIL"
    print(f"{status} {name} {detail}")


def legacy_doc(name):
    """A save document WITHOUT any `owner` key (pre-scoping format)."""
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "park_name": "Legacy Facility",
        "mode": "management",
        "day": 1,
        "cash": 1000,
        "rating": 0.5,
        "creatures": 0,
        "state": {"tick": 1},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def main():
    print("\n=== BACKEND HEALTH CHECK ===")
    
    # Health endpoint
    r = requests.get(f"{API}/", timeout=15)
    check("Backend health endpoint returns 200", r.status_code == 200)
    data = r.json()
    check("Health endpoint returns status='ok'", data.get("status") == "ok", f"(got {data})")
    
    print("\n=== BACKEND CRUD WITH X-PLAYER-TOKEN ===")
    
    token_a = f"test-{uuid.uuid4()}"
    token_b = f"test-{uuid.uuid4()}"
    headers_a = {"X-Player-Token": token_a}
    headers_b = {"X-Player-Token": token_b}
    
    with SaveCleanup() as tracker:
        # Create save with token A
        body = {"name": "Test Save A", "state": {"tick": 1}}
        r = requests.post(f"{API}/saves", json=body, headers=headers_a, timeout=15)
        check("POST /api/saves with token returns 200", r.status_code == 200)
        save_a = r.json()
        tracker.add(save_a["id"], token_a)
        
        # Token A can GET their own save
        r = requests.get(f"{API}/saves/{save_a['id']}", headers=headers_a, timeout=15)
        check("GET own save returns 200", r.status_code == 200)
        
        # Token B cannot GET token A's save
        r = requests.get(f"{API}/saves/{save_a['id']}", headers=headers_b, timeout=15)
        check("GET another token's save returns 404", r.status_code == 404)
        
        # Token A can PUT their own save
        r = requests.put(f"{API}/saves/{save_a['id']}", json=body, headers=headers_a, timeout=15)
        check("PUT own save returns 200", r.status_code == 200)
        
        # Token B cannot PUT token A's save
        r = requests.put(f"{API}/saves/{save_a['id']}", json=body, headers=headers_b, timeout=15)
        check("PUT another token's save returns 404", r.status_code == 404)
        
        # Token B cannot DELETE token A's save
        r = requests.delete(f"{API}/saves/{save_a['id']}", headers=headers_b, timeout=15)
        check("DELETE another token's save returns 404", r.status_code == 404)
        
        # Token A can DELETE their own save
        r = requests.delete(f"{API}/saves/{save_a['id']}", headers=headers_a, timeout=15)
        check("DELETE own save returns 200", r.status_code == 200)
        tracker.forget(save_a["id"])
        
        # List scoping
        body_b = {"name": "Test Save B", "state": {"tick": 2}}
        r = requests.post(f"{API}/saves", json=body_b, headers=headers_b, timeout=15)
        save_b = r.json()
        tracker.add(save_b["id"], token_b)
        
        list_a = requests.get(f"{API}/saves", headers=headers_a, timeout=15).json()
        list_b = requests.get(f"{API}/saves", headers=headers_b, timeout=15).json()
        ids_a = [s["id"] for s in list_a]
        ids_b = [s["id"] for s in list_b]
        
        check("List scoping: token B's save not visible to token A", save_b["id"] not in ids_a)
        check("List scoping: token B sees their own save", save_b["id"] in ids_b)
    
    print("\n=== ITEM 1: OWNERLESS SAVE ADOPTION/DELETION ===")
    
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    token = f"adopter-{uuid.uuid4()}"
    headers = {"X-Player-Token": token}
    
    with SaveCleanup() as tracker:
        # Insert ownerless documents directly into MongoDB
        put_doc = legacy_doc("ownerless PUT")
        del_doc = legacy_doc("ownerless DELETE")
        tracker.add(put_doc["id"], token)
        tracker.add(del_doc["id"], token)
        
        try:
            await db.saves.insert_many([dict(put_doc), dict(del_doc)])
            
            # Verify no owner key exists
            stored = await db.saves.find_one({"id": put_doc["id"]}, {"_id": 0, "owner": 1})
            check("Ownerless doc projection yields {}", stored == {}, f"(got {stored})")
            
            # PUT with token should adopt the save
            body = {"name": "adopted", "state": {"tick": 100}}
            r = requests.put(f"{API}/saves/{put_doc['id']}", json=body, headers=headers, timeout=15)
            check("PUT ownerless save with token returns 200", r.status_code == 200, f"(status {r.status_code})")
            
            # Verify owner was set
            after = await db.saves.find_one({"id": put_doc["id"]}, {"_id": 0, "owner": 1})
            check("Ownerless save adopted (owner set to token)", 
                  after is not None and after.get("owner") == token, f"(got {after})")
            
            # DELETE adopted save
            r = requests.delete(f"{API}/saves/{put_doc['id']}", headers=headers, timeout=15)
            check("DELETE adopted save returns 200", r.status_code == 200)
            tracker.forget(put_doc["id"])
            
            # DELETE ownerless save without prior PUT
            r = requests.delete(f"{API}/saves/{del_doc['id']}", headers=headers, timeout=15)
            check("DELETE ownerless save (no prior PUT) returns 200", r.status_code == 200)
            tracker.forget(del_doc["id"])
            
            # Verify both deleted
            remaining = await db.saves.count_documents({"id": {"$in": [put_doc["id"], del_doc["id"]]}})
            check("Both ownerless saves removed", remaining == 0, f"({remaining} remaining)")
            
        finally:
            await db.saves.delete_many({"id": {"$in": [put_doc["id"], del_doc["id"]]}})
    
    client.close()
    
    print("\n=== ITEM 2: TOKEN VALIDATION & QUERY LIMITS ===")
    
    # Token validation
    too_long = {"X-Player-Token": "a" * 65}
    bad_chars_underscore = {"X-Player-Token": "abc_def"}
    bad_chars_dot = {"X-Player-Token": "abc.def"}
    valid_64 = {"X-Player-Token": "A" * 64}
    
    r_long = requests.get(f"{API}/saves", headers=too_long, timeout=15)
    check("Token > 64 chars rejected with 400", r_long.status_code == 400)
    
    r_underscore = requests.get(f"{API}/saves", headers=bad_chars_underscore, timeout=15)
    check("Token with underscore rejected with 400", r_underscore.status_code == 400)
    
    r_dot = requests.get(f"{API}/saves", headers=bad_chars_dot, timeout=15)
    check("Token with dot rejected with 400", r_dot.status_code == 400)
    
    # POST with bad token
    body = {"name": "test", "state": {"tick": 1}}
    r_post_bad = requests.post(f"{API}/saves", json=body, headers=bad_chars_underscore, timeout=15)
    check("POST with invalid token rejected with 400", r_post_bad.status_code == 400)
    
    # Valid 64-char token
    r_valid = requests.get(f"{API}/saves", headers=valid_64, timeout=15)
    check("Valid 64-char token accepted (200)", r_valid.status_code == 200)
    
    # Absent header (legacy)
    r_none = requests.get(f"{API}/saves", timeout=15)
    check("Absent X-Player-Token header accepted (legacy)", r_none.status_code == 200)
    
    # Query param limits
    r_skip_over = requests.get(f"{API}/saves?skip=10001", timeout=15)
    check("skip > 10000 rejected with 422", r_skip_over.status_code == 422)
    
    r_skip_edge = requests.get(f"{API}/saves?skip=10000", timeout=15)
    check("skip = 10000 accepted (200)", r_skip_edge.status_code == 200)
    
    r_limit_over = requests.get(f"{API}/saves?limit=999", timeout=15)
    check("limit > 200 rejected with 422", r_limit_over.status_code == 422)
    
    r_limit_ok = requests.get(f"{API}/saves?limit=200", timeout=15)
    check("limit = 200 accepted (200)", r_limit_ok.status_code == 200)
    
    print(f"\n{'='*50}")
    print(f"BACKEND TESTS: {sum(results)}/{len(results)} checks passed")
    print(f"{'='*50}\n")
    
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
