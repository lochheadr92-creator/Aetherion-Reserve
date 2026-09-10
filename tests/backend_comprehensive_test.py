"""Comprehensive backend API test for Photo Album and Saves endpoints.

Tests:
1. /api/photos POST with various payloads (valid, XSS attempt, oversized)
2. /api/photos GET list and GET by ID
3. /api/photos DELETE
4. /api/saves regression (still works with X-Player-Token scoping)
5. Token isolation for both endpoints

    python tests/backend_comprehensive_test.py
"""
import requests
import uuid
import sys

from config import URL

API = URL.rstrip('/') + "/api"
results = []

# 1x1 JPEG base64 (tiny valid image)
TINY_IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="


def check(name, ok, detail=""):
    results.append(bool(ok))
    status = "✅ PASS" if ok else "❌ FAIL"
    print(f"{status} {name} {detail}")


def test_photos_api():
    """Test /api/photos endpoint with various scenarios."""
    tok = "backend-test-" + uuid.uuid4().hex[:12]
    other_tok = "backend-other-" + uuid.uuid4().hex[:12]
    h = {"X-Player-Token": tok}
    h_other = {"X-Player-Token": other_tok}

    # 1. Valid POST
    payload = {
        "park_name": "Test Park",
        "day": 5,
        "clock": "12:30",
        "width": 1920,
        "height": 1080,
        "image": TINY_IMG,
        "thumb": TINY_IMG
    }
    r = requests.post(f"{API}/photos", json=payload, headers=h, timeout=20)
    photo_id = r.json().get("id") if r.status_code == 200 else None
    check("1a POST /api/photos with valid payload returns 200 and meta without image",
          r.status_code == 200 and "image" not in r.json() and r.json().get("thumb", "").startswith("data:image/jpeg"),
          f"status={r.status_code}")

    # 2. GET list (should have thumb, no image)
    r = requests.get(f"{API}/photos", headers=h, timeout=20)
    photos = r.json()
    check("2a GET /api/photos returns list with thumb only (no image field)",
          r.status_code == 200 and len(photos) == 1 and "image" not in photos[0] and "thumb" in photos[0],
          f"count={len(photos)}")

    # 3. GET by ID (should have full image)
    if photo_id:
        r = requests.get(f"{API}/photos/{photo_id}", headers=h, timeout=20)
        check("3a GET /api/photos/{id} returns full image",
              r.status_code == 200 and r.json().get("image") == TINY_IMG and r.json().get("day") == 5,
              f"status={r.status_code}")

    # 4. Token isolation - other token sees nothing
    r = requests.get(f"{API}/photos", headers=h_other, timeout=20)
    check("4a Other token sees empty list",
          r.status_code == 200 and r.json() == [],
          f"count={len(r.json())}")

    if photo_id:
        r = requests.get(f"{API}/photos/{photo_id}", headers=h_other, timeout=20)
        check("4b Other token gets 404 on specific photo",
              r.status_code == 404,
              f"status={r.status_code}")

    # 5. XSS attempt - javascript: URL
    xss_payload = {
        "park_name": "XSS Test",
        "day": 1,
        "clock": "00:00",
        "width": 100,
        "height": 100,
        "image": "javascript:alert(1)",
        "thumb": "javascript:alert(1)"
    }
    r = requests.post(f"{API}/photos", json=xss_payload, headers=h, timeout=20)
    check("5a POST with javascript: URL returns 400",
          r.status_code == 400,
          f"status={r.status_code}")

    # 6. Oversized image (> 6 MB)
    # Create a large base64 string (approximately 7 MB when decoded)
    large_data = "data:image/jpeg;base64," + "A" * (8 * 1024 * 1024)  # ~8MB base64
    large_payload = {
        "park_name": "Large Test",
        "day": 1,
        "clock": "00:00",
        "width": 4000,
        "height": 4000,
        "image": large_data,
        "thumb": TINY_IMG
    }
    r = requests.post(f"{API}/photos", json=large_payload, headers=h, timeout=20)
    check("6a POST with oversized image (>6MB) returns 413",
          r.status_code == 413,
          f"status={r.status_code}")

    # 7. DELETE photo
    if photo_id:
        r = requests.delete(f"{API}/photos/{photo_id}", headers=h, timeout=20)
        check("7a DELETE /api/photos/{id} returns 200",
              r.status_code == 200,
              f"status={r.status_code}")

        # Verify it's gone
        r = requests.get(f"{API}/photos/{photo_id}", headers=h, timeout=20)
        check("7b GET after DELETE returns 404",
              r.status_code == 404,
              f"status={r.status_code}")


def test_saves_regression():
    """Test /api/saves endpoint still works with X-Player-Token scoping."""
    tok = "saves-test-" + uuid.uuid4().hex[:12]
    other_tok = "saves-other-" + uuid.uuid4().hex[:12]
    h = {"X-Player-Token": tok}
    h_other = {"X-Player-Token": other_tok}

    # 1. POST save
    save_payload = {
        "name": "Test Save",
        "mode": "sandbox",
        "state": {"tick": 100, "cash": 50000}
    }
    r = requests.post(f"{API}/saves", json=save_payload, headers=h, timeout=20)
    save_id = r.json().get("id") if r.status_code == 200 else None
    check("8a POST /api/saves returns 200",
          r.status_code == 200 and save_id is not None,
          f"status={r.status_code}")

    # 2. GET list
    r = requests.get(f"{API}/saves", headers=h, timeout=20)
    saves = r.json()
    check("8b GET /api/saves returns list",
          r.status_code == 200 and len(saves) >= 1,
          f"count={len(saves)}")

    # 3. GET by ID
    if save_id:
        r = requests.get(f"{API}/saves/{save_id}", headers=h, timeout=20)
        check("8c GET /api/saves/{id} returns save data",
              r.status_code == 200 and r.json().get("name") == "Test Save",
              f"status={r.status_code}")

    # 4. Token isolation
    r = requests.get(f"{API}/saves", headers=h_other, timeout=20)
    other_saves = [s for s in r.json() if s.get("id") == save_id]
    check("8d Other token cannot see this player's saves",
          len(other_saves) == 0,
          f"found={len(other_saves)}")

    # 5. DELETE save
    if save_id:
        r = requests.delete(f"{API}/saves/{save_id}", headers=h, timeout=20)
        check("8e DELETE /api/saves/{id} returns 200",
              r.status_code == 200,
              f"status={r.status_code}")


def main():
    print("=" * 60)
    print("BACKEND COMPREHENSIVE TEST")
    print("=" * 60)
    print()

    print("Testing /api/photos endpoint...")
    test_photos_api()
    print()

    print("Testing /api/saves regression...")
    test_saves_regression()
    print()

    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"RESULTS: {passed}/{total} checks passed")
    print("=" * 60)

    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
