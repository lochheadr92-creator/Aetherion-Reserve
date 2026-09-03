"""Backend API tests for Aetherion Reserve"""
import requests
import os
import sys
from datetime import datetime

from config import API as BASE_URL
from save_cleanup import SaveCleanup
class BackendTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.save_id = None

    def test(self, name, func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        try:
            func()
            self.tests_passed += 1
            print(f"✅ PASS")
            return True
        except AssertionError as e:
            print(f"❌ FAIL: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False

    def test_health(self):
        """Test GET /api/ health endpoint"""
        response = requests.get(f"{BASE_URL}/", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Missing 'status' field"
        assert data["status"] == "ok", f"Status not ok: {data.get('status')}"
        print(f"   Response: {data}")

    def test_list_saves_empty(self):
        """Test GET /api/saves (initial state)"""
        response = requests.get(f"{BASE_URL}/saves", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"   Found {len(data)} existing saves")

    def test_create_save(self):
        """Test POST /api/saves with new Phase 13-16 fields"""
        payload = {
            "name": f"Test Save {datetime.now().strftime('%H%M%S')}",
            "park_name": "Test Park",
            "mode": "sandbox",
            "day": 5,
            "cash": 50000,
            "rating": 3.5,
            "creatures": 2,
            "state": {
                "creatures": [
                    {
                        "id": 1,
                        "speciesId": "skitter",
                        "genes": {
                            "gen": 0,
                            "parents": None,
                            "ancestors": [],
                            "inbreed": 0,
                            "agg": 0.5,
                            "fertility": 0.6,
                            "size": 1.0,
                            "hue": 0,
                            "sat": 1.0,
                            "morph": None
                        }
                    }
                ],
                "fences": {},
                "buildings": [],
                "expeditions": [],
                "contracts": {"available": [], "active": []},
                "security": {"units": []},
                "transport": {
                    "cars": [
                        {
                            "id": 100,
                            "key": "1:2",
                            "type": "tram",
                            "aId": 1,
                            "bId": 2,
                            "t": 0.5,
                            "dir": 1,
                            "riders": []
                        }
                    ]
                },
                "events": [
                    {
                        "id": 200,
                        "type": "birth",
                        "name": "New Birth",
                        "x": 10.5,
                        "y": 15.2,
                        "radius": 12,
                        "magnitude": 0.55,
                        "start": 1000,
                        "expires": 2200
                    }
                ],
                "rivalries": []
            }
        }
        response = requests.post(f"{BASE_URL}/saves", json=payload, timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "id" in data, "Missing 'id' field"
        assert data["name"] == payload["name"], "Name mismatch"
        assert data["cash"] == payload["cash"], "Cash mismatch"
        self.save_id = data["id"]
        print(f"   Created save ID: {self.save_id}")

    def test_get_save(self):
        """Test GET /api/saves/{save_id} - verify Phase 13-16 fields"""
        assert self.save_id, "No save_id from previous test"
        response = requests.get(f"{BASE_URL}/saves/{self.save_id}", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["id"] == self.save_id, "ID mismatch"
        assert "state" in data, "Missing 'state' field"
        assert "expeditions" in data["state"], "Missing expeditions in state"
        assert "contracts" in data["state"], "Missing contracts in state"
        assert "security" in data["state"], "Missing security in state"
        
        # Phase 13-16 fields
        assert "transport" in data["state"], "Missing transport in state"
        assert "cars" in data["state"]["transport"], "Missing transport.cars"
        assert len(data["state"]["transport"]["cars"]) == 1, "Transport cars not preserved"
        
        assert "events" in data["state"], "Missing events in state"
        assert len(data["state"]["events"]) == 1, "Events not preserved"
        
        assert "creatures" in data["state"], "Missing creatures in state"
        assert len(data["state"]["creatures"]) == 1, "Creatures not preserved"
        creature = data["state"]["creatures"][0]
        assert "genes" in creature, "Missing creature genes"
        assert "gen" in creature["genes"], "Missing genes.gen"
        assert "ancestors" in creature["genes"], "Missing genes.ancestors"
        assert "inbreed" in creature["genes"], "Missing genes.inbreed"
        
        print(f"   Retrieved save: {data['name']}")
        print(f"   ✓ transport.cars preserved: {len(data['state']['transport']['cars'])}")
        print(f"   ✓ events preserved: {len(data['state']['events'])}")
        print(f"   ✓ creature genes preserved with gen={creature['genes']['gen']}")

    def test_update_save(self):
        """Test PUT /api/saves/{save_id}"""
        assert self.save_id, "No save_id from previous test"
        payload = {
            "name": "Updated Test Save",
            "park_name": "Updated Park",
            "mode": "sandbox",
            "day": 10,
            "cash": 75000,
            "rating": 4.0,
            "creatures": 5,
            "state": {
                "creatures": [{"id": "c1", "species": "skitter"}],
                "fences": {"40,30,E": {"tier": 1}},
                "buildings": [{"type": "security_post"}],
                "expeditions": [{"zone": "mirefen", "status": "active"}],
                "contracts": {"available": [], "active": [{"type": "acquire"}]},
                "security": {"units": [{"id": "u1", "state": "idle"}]}
            }
        }
        response = requests.put(f"{BASE_URL}/saves/{self.save_id}", json=payload, timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["name"] == payload["name"], "Name not updated"
        assert data["cash"] == payload["cash"], "Cash not updated"
        print(f"   Updated save: {data['name']}")

    def test_delete_save(self):
        """Test DELETE /api/saves/{save_id}"""
        assert self.save_id, "No save_id from previous test"
        response = requests.delete(f"{BASE_URL}/saves/{self.save_id}", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["deleted"] == self.save_id, "Deleted ID mismatch"
        print(f"   Deleted save: {self.save_id}")
        
        # Verify deletion
        response = requests.get(f"{BASE_URL}/saves/{self.save_id}", timeout=10)
        assert response.status_code == 404, f"Expected 404 after delete, got {response.status_code}"

    def run_all(self):
        """Run all backend tests"""
        print("=" * 60)
        print("BACKEND API TESTS - Aetherion Reserve")
        print("=" * 60)
        
        with SaveCleanup() as tracker:  # never leave test records behind, even on failure
            self.test("Health Check (GET /api/)", self.test_health)
            self.test("List Saves (GET /api/saves)", self.test_list_saves_empty)
            self.test("Create Save (POST /api/saves)", self.test_create_save)
            tracker.add(self.save_id)
            self.test("Get Save (GET /api/saves/{id})", self.test_get_save)
            self.test("Update Save (PUT /api/saves/{id})", self.test_update_save)
            self.test("Delete Save (DELETE /api/saves/{id})", self.test_delete_save)
        
        print("\n" + "=" * 60)
        print(f"📊 RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 60)
        
        return 0 if self.tests_passed == self.tests_run else 1


if __name__ == "__main__":
    tester = BackendTester()
    sys.exit(tester.run_all())
