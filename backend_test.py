#!/usr/bin/env python3
"""Backend API test for Aetherion Reserve Phase 21"""
import requests
import sys
import json

import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests'))
from config import API as BASE_URL  # noqa: E402  (AETHERION_URL env var, preview fallback)

class APITester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.save_id = None

    def test(self, name, condition, detail=""):
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}: {detail}")
        return condition

    def run(self):
        try:
            return self._run()
        finally:
            if self.save_id:  # never leave test records behind
                try: requests.delete(f"{BASE_URL}/saves/{self.save_id}", timeout=15)
                except Exception: pass

    def _run(self):
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

        print(f"\n📊 Backend Tests: {self.tests_passed}/{self.tests_run} passed")
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = APITester()
    success = tester.run()
    sys.exit(0 if success else 1)
