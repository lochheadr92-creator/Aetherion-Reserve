import requests
import json
import sys
from datetime import datetime

class APITester:
    def __init__(self, base_url="https://discovery-bio.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.save_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except (ValueError, json.JSONDecodeError):
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_list_saves_empty(self):
        """Test listing saves (should be empty or return list)"""
        success, response = self.run_test(
            "List Saves (initial)",
            "GET",
            "saves",
            200
        )
        if success:
            print(f"   Found {len(response)} existing saves")
        return success

    def test_create_save(self):
        """Create a test save"""
        test_state = {
            "tick": 0,
            "cash": 50000,
            "rating": 0,
            "heights": [0] * 4096,
            "materials": [0] * 4096,
            "water": [0] * 4096,
            "paths": [False] * 4096,
            "veg": [0] * 4096,
            "fences": {},
            "buildings": [],
            "creatures": [],
            "guests": [],
            "entrance": {"x": 32, "y": 32}
        }
        
        success, response = self.run_test(
            "Create Save",
            "POST",
            "saves",
            200,
            data={
                "name": f"Test Save {datetime.now().strftime('%H%M%S')}",
                "park_name": "Test Facility",
                "mode": "management",
                "day": 1,
                "cash": 50000,
                "rating": 0,
                "creatures": 0,
                "state": test_state
            }
        )
        if success and 'id' in response:
            self.save_id = response['id']
            print(f"   Created save with ID: {self.save_id}")
        return success

    def test_get_save(self):
        """Get the created save"""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False
        
        success, response = self.run_test(
            "Get Save by ID",
            "GET",
            f"saves/{self.save_id}",
            200
        )
        if success:
            has_state = 'state' in response
            print(f"   Save has state: {has_state}")
            if has_state:
                print(f"   State keys: {list(response['state'].keys())[:5]}...")
        return success

    def test_update_save(self):
        """Update the created save"""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False
        
        test_state = {
            "tick": 100,
            "cash": 45000,
            "rating": 0.5,
            "heights": [0] * 4096,
            "materials": [0] * 4096,
            "water": [0] * 4096,
            "paths": [False] * 4096,
            "veg": [0] * 4096,
            "fences": {},
            "buildings": [],
            "creatures": [],
            "guests": [],
            "entrance": {"x": 32, "y": 32}
        }
        
        success, response = self.run_test(
            "Update Save",
            "PUT",
            f"saves/{self.save_id}",
            200,
            data={
                "name": "Updated Test Save",
                "park_name": "Updated Facility",
                "mode": "management",
                "day": 2,
                "cash": 45000,
                "rating": 0.5,
                "creatures": 0,
                "state": test_state
            }
        )
        return success

    def test_list_saves_with_data(self):
        """Test listing saves after creation"""
        success, response = self.run_test(
            "List Saves (with data)",
            "GET",
            "saves",
            200
        )
        if success:
            print(f"   Found {len(response)} saves")
            if self.save_id:
                found = any(s.get('id') == self.save_id for s in response)
                print(f"   Test save found in list: {found}")
        return success

    def test_scenario_fields_persistence(self):
        """Test that scenario fields (escapeTicks, minCash, mastery) survive save/load"""
        test_state = {
            "tick": 500,
            "cash": 25000,
            "rating": 0.6,
            "heights": [0] * 4096,
            "materials": [0] * 4096,
            "water": [0] * 4096,
            "paths": [False] * 4096,
            "veg": [0] * 4096,
            "fences": {},
            "buildings": [],
            "creatures": [],
            "guests": [],
            "entrance": {"x": 32, "y": 32},
            "scenario": {
                "id": "sovereign_containment",
                "status": "active",
                "startDay": 1,
                "progress": {"perimeter": True, "welfare": False},
                "ack": False,
                "escapeTicks": 1500,
                "minCash": 22000,
                "mastery": None
            }
        }
        
        # Create save with scenario fields
        success, response = self.run_test(
            "Create Save with Scenario Fields",
            "POST",
            "saves",
            200,
            data={
                "name": f"Scenario Test {datetime.now().strftime('%H%M%S')}",
                "park_name": "Sovereign Test",
                "mode": "management",
                "day": 5,
                "cash": 25000,
                "rating": 0.6,
                "creatures": 1,
                "state": test_state
            }
        )
        
        if not success or 'id' not in response:
            return False
        
        scenario_save_id = response['id']
        print(f"   Created scenario save with ID: {scenario_save_id}")
        
        # Retrieve and verify scenario fields
        success, response = self.run_test(
            "Get Save and Verify Scenario Fields",
            "GET",
            f"saves/{scenario_save_id}",
            200
        )
        
        if success and 'state' in response:
            scenario = response['state'].get('scenario', {})
            has_escape_ticks = 'escapeTicks' in scenario
            has_min_cash = 'minCash' in scenario
            has_mastery = 'mastery' in scenario
            
            escape_ticks_correct = scenario.get('escapeTicks') == 1500
            min_cash_correct = scenario.get('minCash') == 22000
            mastery_correct = scenario.get('mastery') is None
            
            print(f"   escapeTicks present: {has_escape_ticks}, value correct: {escape_ticks_correct}")
            print(f"   minCash present: {has_min_cash}, value correct: {min_cash_correct}")
            print(f"   mastery present: {has_mastery}, value correct: {mastery_correct}")
            
            all_correct = (has_escape_ticks and escape_ticks_correct and 
                          has_min_cash and min_cash_correct and 
                          has_mastery and mastery_correct)
            
            if all_correct:
                print("   ✅ All scenario fields preserved correctly")
            else:
                print("   ❌ Some scenario fields missing or incorrect")
                self.tests_passed -= 1  # Adjust count since we marked it passed initially
        
        # Clean up
        self.run_test(
            "Delete Scenario Test Save",
            "DELETE",
            f"saves/{scenario_save_id}",
            200
        )
        
        return success

    def test_delete_save(self):
        """Delete the created save"""
        if not self.save_id:
            print("❌ Skipped - No save ID available")
            return False
        
        success, response = self.run_test(
            "Delete Save",
            "DELETE",
            f"saves/{self.save_id}",
            200
        )
        return success

def main():
    print("=" * 60)
    print("Aetherion Reserve - Backend API Test Suite")
    print("=" * 60)
    
    tester = APITester()

    # Run tests in sequence
    tester.test_health()
    tester.test_list_saves_empty()
    tester.test_create_save()
    tester.test_get_save()
    tester.test_update_save()
    tester.test_list_saves_with_data()
    tester.test_scenario_fields_persistence()
    tester.test_delete_save()

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print("=" * 60)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
