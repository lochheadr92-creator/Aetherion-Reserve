"""Backend API test suite for Aetherion Reserve save/load endpoints."""
import sys
from datetime import datetime

import requests

BASE_URL = "https://discovery-bio.preview.emergentagent.com/api"
GRID_CELLS = 4096

# Expected scenario field values used by the persistence test.
SCENARIO_FIELDS = {
    "escapeTicks": 1500,
    "minCash": 22000,
    "mastery": None,
}


def make_state(**overrides):
    """Build a minimal valid game-state payload, with optional overrides."""
    state = {
        "tick": 0,
        "cash": 50000,
        "rating": 0,
        "heights": [0] * GRID_CELLS,
        "materials": [0] * GRID_CELLS,
        "water": [0] * GRID_CELLS,
        "paths": [False] * GRID_CELLS,
        "veg": [0] * GRID_CELLS,
        "fences": {},
        "buildings": [],
        "creatures": [],
        "guests": [],
        "entrance": {"x": 32, "y": 32},
    }
    state.update(overrides)
    return state


class APITester:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.save_id = None

    # ---------- core helpers ----------

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API request test. Returns (success, json_body)."""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")

        try:
            response = requests.request(
                method, url, json=data,
                headers={"Content-Type": "application/json"}, timeout=10,
            )
        except requests.RequestException as exc:
            print(f"❌ Failed - Error: {exc}")
            return False, {}

        if response.status_code != expected_status:
            print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False, {}

        self.tests_passed += 1
        print(f"✅ Passed - Status: {response.status_code}")
        try:
            return True, response.json()
        except ValueError:
            return True, {}

    def record_check(self, name, passed):
        """Count a standalone assertion as a test result."""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"   ✅ {name}")
        else:
            print(f"   ❌ {name}")
        return passed

    # ---------- basic CRUD tests ----------

    def test_health(self):
        """Test health endpoint."""
        success, _ = self.run_test("Health Check", "GET", "", 200)
        return success

    def test_list_saves_empty(self):
        """Test listing saves (should be empty or return list)."""
        success, response = self.run_test("List Saves (initial)", "GET", "saves", 200)
        if success:
            print(f"   Found {len(response)} existing saves")
        return success

    def test_create_save(self):
        """Create a test save."""
        success, response = self.run_test(
            "Create Save", "POST", "saves", 200,
            data={
                "name": f"Test Save {datetime.now().strftime('%H%M%S')}",
                "park_name": "Test Facility",
                "mode": "management",
                "day": 1,
                "cash": 50000,
                "rating": 0,
                "creatures": 0,
                "state": make_state(),
            },
        )
        if success and "id" in response:
            self.save_id = response["id"]
            print(f"   Created save with ID: {self.save_id}")
        return success

    def test_get_save(self):
        """Get the created save."""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False

        success, response = self.run_test(
            "Get Save by ID", "GET", f"saves/{self.save_id}", 200,
        )
        if success:
            has_state = "state" in response
            print(f"   Save has state: {has_state}")
            if has_state:
                print(f"   State keys: {list(response['state'].keys())[:5]}...")
        return success

    def test_update_save(self):
        """Update the created save."""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False

        success, _ = self.run_test(
            "Update Save", "PUT", f"saves/{self.save_id}", 200,
            data={
                "name": "Updated Test Save",
                "park_name": "Updated Facility",
                "mode": "management",
                "day": 2,
                "cash": 45000,
                "rating": 0.5,
                "creatures": 0,
                "state": make_state(tick=100, cash=45000, rating=0.5),
            },
        )
        return success

    def test_list_saves_with_data(self):
        """Test listing saves after creation."""
        success, response = self.run_test("List Saves (with data)", "GET", "saves", 200)
        if success:
            print(f"   Found {len(response)} saves")
            if self.save_id:
                found = any(s.get("id") == self.save_id for s in response)
                print(f"   Test save found in list: {found}")
        return success

    def test_delete_save(self):
        """Delete the created save."""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False

        success, _ = self.run_test(
            "Delete Save", "DELETE", f"saves/{self.save_id}", 200,
        )
        return success

    # ---------- scenario persistence test (split into focused steps) ----------

    def _create_scenario_save(self):
        """Create a save carrying scenario tracker fields. Returns save id or None."""
        scenario = {
            "id": "sovereign_containment",
            "status": "active",
            "startDay": 1,
            "progress": {"perimeter": True, "welfare": False},
            "ack": False,
        }
        scenario.update(SCENARIO_FIELDS)
        state = make_state(tick=500, cash=25000, rating=0.6, scenario=scenario)

        success, response = self.run_test(
            "Create Save with Scenario Fields", "POST", "saves", 200,
            data={
                "name": f"Scenario Test {datetime.now().strftime('%H%M%S')}",
                "park_name": "Sovereign Test",
                "mode": "management",
                "day": 5,
                "cash": 25000,
                "rating": 0.6,
                "creatures": 1,
                "state": state,
            },
        )
        if not success or "id" not in response:
            return None
        print(f"   Created scenario save with ID: {response['id']}")
        return response["id"]

    def _verify_scenario_fields(self, save_id):
        """Fetch the save back and assert each scenario field round-trips."""
        success, response = self.run_test(
            "Get Save and Verify Scenario Fields", "GET", f"saves/{save_id}", 200,
        )
        if not success or "state" not in response:
            return False

        scenario = response["state"].get("scenario", {})
        all_correct = True
        for key, expected in SCENARIO_FIELDS.items():
            present = key in scenario
            correct = present and scenario.get(key) == expected
            print(f"   {key} present: {present}, value correct: {correct}")
            all_correct = all_correct and correct

        return self.record_check("All scenario fields preserved correctly", all_correct)

    def _cleanup_scenario_save(self, save_id):
        """Delete the temporary scenario save."""
        self.run_test("Delete Scenario Test Save", "DELETE", f"saves/{save_id}", 200)

    def test_scenario_fields_persistence(self):
        """Scenario fields (escapeTicks, minCash, mastery) must survive save/load."""
        save_id = self._create_scenario_save()
        if save_id is None:
            return False

        fields_ok = self._verify_scenario_fields(save_id)
        self._cleanup_scenario_save(save_id)
        return fields_ok


def main():
    print("=" * 60)
    print("Aetherion Reserve - Backend API Test Suite")
    print("=" * 60)

    tester = APITester()

    tests = (
        tester.test_health,
        tester.test_list_saves_empty,
        tester.test_create_save,
        tester.test_get_save,
        tester.test_update_save,
        tester.test_list_saves_with_data,
        tester.test_scenario_fields_persistence,
        tester.test_delete_save,
    )
    for test in tests:
        test()

    print("\n" + "=" * 60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print("=" * 60)

    return 0 if tester.tests_passed == tester.tests_run else 1


if __name__ == "__main__":
    sys.exit(main())
