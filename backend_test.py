#!/usr/bin/env python3
"""Backend API test for Aetherion Reserve Phase V (Phase 21+)"""
import requests
import sys
import json
import uuid
from typing import Any, List, Optional

import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests'))
from config import API as BASE_URL  # noqa: E402  (AETHERION_URL env var, preview fallback)

# Minimal valid JPEG data URL for testing
IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="

class APITester:
    def __init__(self) -> None:
        self.tests_run: int = 0
        self.tests_passed: int = 0
        self.save_id: Optional[str] = None
        self.photo_ids: List[str] = []
        self.player_token: str = f"test-{uuid.uuid4().hex[:12]}"

    def test(self, name: str, condition: Any, detail: Any = "") -> bool:
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}: {detail}")
        return bool(condition)

    def run(self) -> bool:
        try:
            return self._run()
        finally:
            # Clean up test records
            if self.save_id:
                try: requests.delete(f"{BASE_URL}/saves/{self.save_id}", timeout=15)
                except Exception: pass
            for photo_id in self.photo_ids:
                try: requests.delete(f"{BASE_URL}/photos/{photo_id}", headers={"X-Player-Token": self.player_token}, timeout=15)
                except Exception: pass

    def _run(self) -> bool:
        print("Testing Backend API...")
        
        # Test 1: Root endpoint
        try:
            r = requests.get(f"{BASE_URL}/")
            self.test("GET / returns 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                data = r.json()
                self.test("Root has status ok", data.get("status") == "ok", str(data))
        except Exception as e:
            self.test("GET / returns 200", False, str(e))

        # Test 2: List saves
        try:
            r = requests.get(f"{BASE_URL}/saves")
            self.test("GET /saves returns 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                saves = r.json()
                self.test("GET /saves returns list", isinstance(saves, list), type(saves))
        except Exception as e:
            self.test("GET /saves returns 200", False, str(e))

        # Test 3: Create save with lineage and policies
        try:
            payload = {
                "name": "Test Save Phase 21",
                "park_name": "Test Facility",
                "mode": "sandbox",
                "day": 5,
                "cash": 10000,
                "rating": 0.8,
                "creatures": 2,
                "state": {
                    "tick": 1000,
                    "lineage": {
                        "1": {
                            "id": 1,
                            "name": "Test Creature A",
                            "speciesId": "nyxarr",
                            "gen": 0,
                            "mId": None,
                            "fId": None,
                            "morph": None,
                            "inbreed": 0,
                            "bornDay": 1,
                            "status": "park",
                            "leftDay": None
                        }
                    },
                    "policies": {
                        "keeperRadio": True
                    },
                    "creatures": [],
                    "staff": []
                }
            }
            r = requests.post(f"{BASE_URL}/saves", json=payload)
            self.test("POST /saves returns 200/201", r.status_code in [200, 201], f"status={r.status_code}")
            if r.status_code in [200, 201]:
                data = r.json()
                self.save_id = data.get("id")
                self.test("Created save has id", self.save_id is not None, str(data))
                self.test("Created save has name", data.get("name") == "Test Save Phase 21", str(data))
        except Exception as e:
            self.test("POST /saves returns 200/201", False, str(e))

        # Test 4: Get save by ID
        if self.save_id:
            try:
                r = requests.get(f"{BASE_URL}/saves/{self.save_id}")
                self.test("GET /saves/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
                if r.status_code == 200:
                    data = r.json()
                    self.test("Retrieved save has state", "state" in data, str(data.keys()))
                    if "state" in data:
                        state = data["state"]
                        self.test("State has lineage", "lineage" in state, str(state.keys()))
                        self.test("State has policies", "policies" in state, str(state.keys()))
                        if "policies" in state:
                            self.test("Policies has keeperRadio", "keeperRadio" in state["policies"], str(state["policies"]))
            except Exception as e:
                self.test("GET /saves/{id} returns 200", False, str(e))

        # Test 5: Update save
        if self.save_id:
            try:
                update_payload = {
                    "name": "Updated Test Save",
                    "park_name": "Updated Facility",
                    "mode": "sandbox",
                    "day": 10,
                    "cash": 20000,
                    "rating": 0.9,
                    "creatures": 3,
                    "state": {
                        "tick": 2000,
                        "lineage": {
                            "1": {"id": 1, "name": "Updated Creature", "speciesId": "nyxarr", "gen": 0, "mId": None, "fId": None, "morph": None, "inbreed": 0, "bornDay": 1, "status": "transferred", "leftDay": 5}
                        },
                        "policies": {"keeperRadio": False},
                        "creatures": [],
                        "staff": []
                    }
                }
                r = requests.put(f"{BASE_URL}/saves/{self.save_id}", json=update_payload)
                self.test("PUT /saves/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
                if r.status_code == 200:
                    data = r.json()
                    self.test("Updated save has new name", data.get("name") == "Updated Test Save", str(data))
            except Exception as e:
                self.test("PUT /saves/{id} returns 200", False, str(e))

        # Test 6: Verify update persisted
        if self.save_id:
            try:
                r = requests.get(f"{BASE_URL}/saves/{self.save_id}")
                if r.status_code == 200:
                    data = r.json()
                    state = data.get("state", {})
                    lineage = state.get("lineage", {})
                    policies = state.get("policies", {})
                    self.test("Updated lineage persisted", lineage.get("1", {}).get("status") == "transferred", str(lineage.get("1")))
                    self.test("Updated policies persisted", policies.get("keeperRadio") == False, str(policies))
            except Exception as e:
                self.test("Verify update persisted", False, str(e))

        # Test 7: Delete save
        if self.save_id:
            try:
                r = requests.delete(f"{BASE_URL}/saves/{self.save_id}")
                self.test("DELETE /saves/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
                if r.status_code == 200:
                    data = r.json()
                    self.test("Delete response has deleted id", data.get("deleted") == self.save_id, str(data))
            except Exception as e:
                self.test("DELETE /saves/{id} returns 200", False, str(e))

        # Test 8: Verify deletion
        if self.save_id:
            try:
                r = requests.get(f"{BASE_URL}/saves/{self.save_id}")
                self.test("GET deleted save returns 404", r.status_code == 404, f"status={r.status_code}")
            except Exception as e:
                self.test("GET deleted save returns 404", False, str(e))

        # ===== Phase V: Photo Album Caption Tests =====
        print("\n--- Phase V: Photo Album Caption Tests ---")
        
        # Test 9: Create a photo
        try:
            photo_payload = {
                "park_name": "Test Park",
                "mode": "sandbox",
                "day": 3,
                "clock": "14:30",
                "caption": "",
                "width": 1280,
                "height": 720,
                "image": IMG,
                "thumb": IMG
            }
            headers = {"X-Player-Token": self.player_token}
            r = requests.post(f"{BASE_URL}/photos", json=photo_payload, headers=headers, timeout=20)
            self.test("POST /photos returns 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                data = r.json()
                photo_id = data.get("id")
                if photo_id:
                    self.photo_ids.append(photo_id)
                self.test("Created photo has id", photo_id is not None, str(data))
                self.test("Created photo meta excludes image", "image" not in data, str(data.keys()))
                self.test("Created photo has thumb", data.get("thumb", "").startswith("data:image/jpeg"), data.get("thumb", "")[:50])
        except Exception as e:
            self.test("POST /photos returns 200", False, str(e))

        # Test 10: PATCH caption - basic update
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                caption_payload = {"caption": "  Dawn over\nthe   paddock  "}
                r = requests.patch(f"{BASE_URL}/photos/{photo_id}", json=caption_payload, headers=headers, timeout=20)
                self.test("PATCH /photos/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
                if r.status_code == 200:
                    data = r.json()
                    caption = data.get("caption", "")
                    self.test("Caption is cleaned (single line, whitespace collapsed)", caption == "Dawn over the paddock", f"got: '{caption}'")
                    self.test("PATCH response excludes image", "image" not in data, str(data.keys()))
            except Exception as e:
                self.test("PATCH /photos/{id} returns 200", False, str(e))

        # Test 11: PATCH caption - control character stripping
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                caption_payload = {"caption": "Test\x07caption\x00with\rcontrol\nchars"}
                r = requests.patch(f"{BASE_URL}/photos/{photo_id}", json=caption_payload, headers=headers, timeout=20)
                if r.status_code == 200:
                    data = r.json()
                    caption = data.get("caption", "")
                    has_control = any(ord(c) < 32 and c not in ' \t' for c in caption)
                    self.test("Caption strips control characters", not has_control and "Test" in caption and "caption" in caption, f"got: '{caption}'")
            except Exception as e:
                self.test("Caption strips control characters", False, str(e))

        # Test 12: PATCH caption - length capping (140 chars)
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                long_caption = "x" * 200
                caption_payload = {"caption": long_caption}
                r = requests.patch(f"{BASE_URL}/photos/{photo_id}", json=caption_payload, headers=headers, timeout=20)
                if r.status_code == 200:
                    data = r.json()
                    caption = data.get("caption", "")
                    self.test("Caption is capped at 140 chars", len(caption) == 140, f"length={len(caption)}")
            except Exception as e:
                self.test("Caption is capped at 140 chars", False, str(e))

        # Test 13: PATCH caption - owner scoping (different token cannot update)
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                other_token = f"other-{uuid.uuid4().hex[:12]}"
                caption_payload = {"caption": "hijack attempt"}
                r = requests.patch(f"{BASE_URL}/photos/{photo_id}", json=caption_payload, headers={"X-Player-Token": other_token}, timeout=20)
                self.test("PATCH with different token returns 404", r.status_code == 404, f"status={r.status_code}")
            except Exception as e:
                self.test("PATCH with different token returns 404", False, str(e))

        # Test 14: Verify caption persists
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                r = requests.get(f"{BASE_URL}/photos/{photo_id}", headers=headers, timeout=20)
                if r.status_code == 200:
                    data = r.json()
                    caption = data.get("caption", "")
                    self.test("Caption persists on GET", len(caption) == 140 and caption.startswith("x"), f"caption: '{caption[:20]}...'")
            except Exception as e:
                self.test("Caption persists on GET", False, str(e))

        # Test 15: GET /photos regression (list returns meta only, no image)
        try:
            r = requests.get(f"{BASE_URL}/photos", headers=headers, timeout=20)
            self.test("GET /photos returns 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                photos = r.json()
                self.test("GET /photos returns list", isinstance(photos, list), type(photos))
                if photos:
                    self.test("Photo list excludes image field", "image" not in photos[0], str(photos[0].keys()))
                    self.test("Photo list includes thumb", "thumb" in photos[0], str(photos[0].keys()))
        except Exception as e:
            self.test("GET /photos returns 200", False, str(e))

        # Test 16: DELETE /photos regression
        if self.photo_ids:
            photo_id = self.photo_ids[0]
            try:
                r = requests.delete(f"{BASE_URL}/photos/{photo_id}", headers=headers, timeout=20)
                self.test("DELETE /photos/{id} returns 200", r.status_code == 200, f"status={r.status_code}")
                if r.status_code == 200:
                    # Verify deletion
                    r2 = requests.get(f"{BASE_URL}/photos/{photo_id}", headers=headers, timeout=20)
                    self.test("Deleted photo returns 404", r2.status_code == 404, f"status={r2.status_code}")
                    self.photo_ids.remove(photo_id)
            except Exception as e:
                self.test("DELETE /photos/{id} returns 200", False, str(e))

        print(f"\n📊 Backend Tests: {self.tests_passed}/{self.tests_run} passed")
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = APITester()
    success = tester.run()
    sys.exit(0 if success else 1)
