"""Backend regression test: saves CRUD with staff assignment fields."""
import requests
import os
import sys
import json

BASE_URL = os.environ.get("AETHERION_URL", "https://discovery-bio.preview.emergentagent.com") + "/api"

def test_backend():
    print("=== BACKEND REGRESSION TEST ===\n")
    
    # Test 1: Health check
    print("Test 1: Health check...")
    try:
        r = requests.get(f"{BASE_URL}/", timeout=10)
        if r.status_code == 200 and r.json().get("status") == "ok":
            print("✅ Health check passed")
        else:
            print(f"❌ Health check failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test 2: Create save with staff assignment fields
    print("\nTest 2: Create save with staff assignment fields...")
    test_save = {
        "name": "Backend Test Save",
        "park_name": "Test Facility",
        "mode": "sandbox",
        "day": 5,
        "cash": 50000,
        "rating": 3.5,
        "creatures": 2,
        "state": {
            "tick": 1000,
            "staff": [
                {
                    "id": 1,
                    "role": "xenobiologist",
                    "name": "Test Keeper",
                    "x": 10.5,
                    "y": 15.5,
                    "assignedEnclosureId": 3,
                    "assignedAnchor": {"x": 42, "y": 33},
                    "state": "idle",
                    "task": None
                }
            ]
        }
    }
    
    try:
        r = requests.post(f"{BASE_URL}/saves", json=test_save, timeout=10)
        if r.status_code == 200:
            save_data = r.json()
            save_id = save_data.get("id")
            print(f"✅ Save created: {save_id}")
        else:
            print(f"❌ Save creation failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ Save creation error: {e}")
        return False
    
    # Test 3: Retrieve save and verify staff fields
    print("\nTest 3: Retrieve save and verify staff fields...")
    try:
        r = requests.get(f"{BASE_URL}/saves/{save_id}", timeout=10)
        if r.status_code == 200:
            retrieved = r.json()
            staff = retrieved.get("state", {}).get("staff", [])
            if len(staff) > 0:
                keeper = staff[0]
                assigned_enc = keeper.get("assignedEnclosureId")
                assigned_anchor = keeper.get("assignedAnchor")
                
                if assigned_enc == 3:
                    print(f"✅ assignedEnclosureId persisted correctly: {assigned_enc}")
                else:
                    print(f"❌ assignedEnclosureId mismatch: expected 3, got {assigned_enc}")
                    return False
                
                if assigned_anchor and assigned_anchor.get("x") == 42 and assigned_anchor.get("y") == 33:
                    print(f"✅ assignedAnchor persisted correctly: {assigned_anchor}")
                else:
                    print(f"❌ assignedAnchor mismatch: expected {{x:42,y:33}}, got {assigned_anchor}")
                    return False
            else:
                print("❌ No staff found in retrieved save")
                return False
        else:
            print(f"❌ Save retrieval failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ Save retrieval error: {e}")
        return False
    
    # Test 4: Update save
    print("\nTest 4: Update save...")
    test_save["day"] = 10
    test_save["state"]["staff"][0]["assignedEnclosureId"] = 5
    try:
        r = requests.put(f"{BASE_URL}/saves/{save_id}", json=test_save, timeout=10)
        if r.status_code == 200:
            print("✅ Save updated successfully")
        else:
            print(f"❌ Save update failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ Save update error: {e}")
        return False
    
    # Test 5: List saves
    print("\nTest 5: List saves...")
    try:
        r = requests.get(f"{BASE_URL}/saves", timeout=10)
        if r.status_code == 200:
            saves = r.json()
            found = any(s.get("id") == save_id for s in saves)
            if found:
                print(f"✅ Save found in list (total: {len(saves)} saves)")
            else:
                print("❌ Save not found in list")
                return False
        else:
            print(f"❌ List saves failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ List saves error: {e}")
        return False
    
    # Test 6: Delete save
    print("\nTest 6: Delete save...")
    try:
        r = requests.delete(f"{BASE_URL}/saves/{save_id}", timeout=10)
        if r.status_code == 200:
            print("✅ Save deleted successfully")
        else:
            print(f"❌ Save deletion failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"❌ Save deletion error: {e}")
        return False
    
    print("\n=== ALL BACKEND TESTS PASSED ===")
    return True

if __name__ == "__main__":
    success = test_backend()
    sys.exit(0 if success else 1)
