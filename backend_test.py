"""Backend API test for Aetherion Reserve /api/saves CRUD endpoints."""
import requests
import sys
import json
from datetime import datetime

class SavesAPITester:
    def __init__(self, base_url="https://discovery-bio.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_save_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, json_data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=json_data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=json_data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root(self):
        """Test root endpoint"""
        success, response = self.run_test(
            "Root endpoint",
            "GET",
            "api/",
            200
        )
        if success and response.get('status') == 'ok':
            print(f"   Message: {response.get('message')}")
            return True
        return False

    def test_list_saves_empty(self):
        """Test listing saves (initially empty or existing)"""
        success, response = self.run_test(
            "List saves",
            "GET",
            "api/saves",
            200
        )
        if success:
            print(f"   Found {len(response)} existing saves")
            return True
        return False

    def test_create_save(self):
        """Test creating a new save"""
        test_state = {
            "tick": 0,
            "day": 1,
            "cash": 150000,
            "creatures": [],
            "buildings": [],
            "heights": [0] * 5184,  # 72x72
            "materials": [0] * 5184,
            "water": [0] * 5184,
            "paths": [0] * 5184,
            "fences": {}
        }
        
        payload = {
            "name": f"Test Save {datetime.now().strftime('%H%M%S')}",
            "park_name": "Test Facility Alpha",
            "mode": "management",
            "day": 1,
            "cash": 150000,
            "rating": 0,
            "creatures": 0,
            "state": test_state
        }
        
        success, response = self.run_test(
            "Create save",
            "POST",
            "api/saves",
            200,
            json_data=payload
        )
        
        if success and 'id' in response:
            save_id = response['id']
            self.created_save_ids.append(save_id)
            print(f"   Created save ID: {save_id}")
            print(f"   Park name: {response.get('park_name')}")
            print(f"   Mode: {response.get('mode')}")
            print(f"   Cash: {response.get('cash')}")
            
            # Verify metadata fields
            required_fields = ['id', 'name', 'park_name', 'mode', 'day', 'cash', 'rating', 'creatures', 'updated_at']
            missing = [f for f in required_fields if f not in response]
            if missing:
                print(f"   ⚠️  Missing metadata fields: {missing}")
                return False
            
            # Verify state is NOT in response (should be excluded from metadata)
            if 'state' in response:
                print(f"   ⚠️  State should not be in create response")
                return False
                
            return True
        return False

    def test_get_save_by_id(self, save_id):
        """Test retrieving a save by ID"""
        success, response = self.run_test(
            f"Get save by ID",
            "GET",
            f"api/saves/{save_id}",
            200
        )
        
        if success:
            print(f"   Retrieved save: {response.get('name')}")
            # Verify state IS included in full retrieval
            if 'state' not in response:
                print(f"   ❌ State missing from full save retrieval")
                return False
            print(f"   State keys: {list(response['state'].keys())[:5]}...")
            return True
        return False

    def test_get_nonexistent_save(self):
        """Test 404 handling for nonexistent save"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        success, response = self.run_test(
            "Get nonexistent save (expect 404)",
            "GET",
            f"api/saves/{fake_id}",
            404
        )
        return success

    def test_update_save(self, save_id):
        """Test updating an existing save"""
        updated_state = {
            "tick": 1000,
            "day": 2,
            "cash": 145000,
            "creatures": [{"id": "c1", "species": "skitter"}],
            "buildings": [{"type": "admin"}],
            "heights": [0] * 5184,
            "materials": [0] * 5184,
            "water": [0] * 5184,
            "paths": [0] * 5184,
            "fences": {"40,30,S": {"tier": 1}}
        }
        
        payload = {
            "name": "Updated Test Save",
            "park_name": "Updated Facility",
            "mode": "sandbox",
            "day": 2,
            "cash": 145000,
            "rating": 3.5,
            "creatures": 1,
            "state": updated_state
        }
        
        success, response = self.run_test(
            "Update save",
            "PUT",
            f"api/saves/{save_id}",
            200,
            json_data=payload
        )
        
        if success:
            print(f"   Updated park name: {response.get('park_name')}")
            print(f"   Updated cash: {response.get('cash')}")
            print(f"   Updated creatures: {response.get('creatures')}")
            
            # Verify updated values
            if response.get('park_name') != 'Updated Facility':
                print(f"   ❌ Park name not updated correctly")
                return False
            if response.get('creatures') != 1:
                print(f"   ❌ Creatures count not updated correctly")
                return False
            return True
        return False

    def test_update_nonexistent_save(self):
        """Test 404 handling for updating nonexistent save"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        payload = {
            "name": "Fake",
            "park_name": "Fake",
            "mode": "management",
            "day": 1,
            "cash": 0,
            "rating": 0,
            "creatures": 0,
            "state": {}
        }
        success, response = self.run_test(
            "Update nonexistent save (expect 404)",
            "PUT",
            f"api/saves/{fake_id}",
            404,
            json_data=payload
        )
        return success

    def test_delete_save(self, save_id):
        """Test deleting a save"""
        success, response = self.run_test(
            "Delete save",
            "DELETE",
            f"api/saves/{save_id}",
            200
        )
        
        if success and response.get('deleted') == save_id:
            print(f"   Deleted save ID: {save_id}")
            return True
        return False

    def test_delete_nonexistent_save(self):
        """Test 404 handling for deleting nonexistent save"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        success, response = self.run_test(
            "Delete nonexistent save (expect 404)",
            "DELETE",
            f"api/saves/{fake_id}",
            404
        )
        return success

    def cleanup(self):
        """Clean up any remaining test saves"""
        print("\n🧹 Cleaning up test saves...")
        for save_id in self.created_save_ids:
            try:
                requests.delete(f"{self.base_url}/api/saves/{save_id}", timeout=5)
                print(f"   Cleaned up {save_id}")
            except:
                pass


def main():
    print("=" * 60)
    print("AETHERION RESERVE - BACKEND API TEST")
    print("=" * 60)
    
    tester = SavesAPITester()
    
    # Test sequence
    try:
        # 1. Root endpoint
        tester.test_root()
        
        # 2. List saves
        tester.test_list_saves_empty()
        
        # 3. Create save
        if not tester.test_create_save():
            print("\n❌ Create save failed, stopping tests")
            return 1
        
        save_id = tester.created_save_ids[0]
        
        # 4. Get save by ID
        tester.test_get_save_by_id(save_id)
        
        # 5. Get nonexistent save (404)
        tester.test_get_nonexistent_save()
        
        # 6. Update save
        tester.test_update_save(save_id)
        
        # 7. Update nonexistent save (404)
        tester.test_update_nonexistent_save()
        
        # 8. Delete nonexistent save (404)
        tester.test_delete_nonexistent_save()
        
        # 9. Delete save
        tester.test_delete_save(save_id)
        
        # 10. Verify deletion
        tester.test_get_nonexistent_save()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
    finally:
        tester.cleanup()
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    print("=" * 60)
    
    if tester.tests_passed == tester.tests_run:
        print("✅ All backend tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
