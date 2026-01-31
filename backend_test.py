import requests
import sys
import json
from datetime import datetime, timedelta
import time

class EAuctionAPITester:
    def __init__(self, base_url="https://auctionspot-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.user_name = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    details += f", Error: {error_detail}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_data = {
            "email": f"testuser{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        result = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if result:
            self.token = result.get('access_token')
            self.user_id = result.get('user', {}).get('id')
            self.user_name = result.get('user', {}).get('name')
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # Create a user first for login test
        timestamp = int(time.time()) + 1
        register_data = {
            "email": f"logintest{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Login Test User {timestamp}"
        }
        
        # Register user
        register_result = self.run_test(
            "User Registration for Login Test",
            "POST",
            "auth/register",
            200,
            data=register_data
        )
        
        if not register_result:
            return False
        
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        result = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        return result is not None

    def test_get_current_user(self):
        """Test getting current user info"""
        result = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return result is not None

    def test_create_forward_auction(self):
        """Test creating a forward auction"""
        end_time = (datetime.now() + timedelta(hours=24)).isoformat()
        
        auction_data = {
            "title": "Test Forward Auction",
            "description": "A test forward auction for API testing",
            "auction_type": "forward",
            "starting_price": 100.0,
            "bid_increment": 5.0,
            "end_time": end_time,
            "image_url": "https://example.com/test-image.jpg"
        }
        
        result = self.run_test(
            "Create Forward Auction",
            "POST",
            "auctions",
            200,
            data=auction_data
        )
        
        if result:
            self.forward_auction_id = result.get('id')
            return True
        return False

    def test_create_reverse_auction(self):
        """Test creating a reverse auction"""
        end_time = (datetime.now() + timedelta(hours=24)).isoformat()
        
        auction_data = {
            "title": "Test Reverse Auction",
            "description": "A test reverse auction for API testing",
            "auction_type": "reverse",
            "starting_price": 200.0,
            "bid_increment": 10.0,
            "end_time": end_time
        }
        
        result = self.run_test(
            "Create Reverse Auction",
            "POST",
            "auctions",
            200,
            data=auction_data
        )
        
        if result:
            self.reverse_auction_id = result.get('id')
            return True
        return False

    def test_get_auctions(self):
        """Test getting all auctions"""
        result = self.run_test(
            "Get All Auctions",
            "GET",
            "auctions",
            200
        )
        return result is not None

    def test_get_active_auctions(self):
        """Test getting active auctions"""
        result = self.run_test(
            "Get Active Auctions",
            "GET",
            "auctions?status=active",
            200
        )
        return result is not None

    def test_get_auction_by_id(self):
        """Test getting specific auction"""
        if hasattr(self, 'forward_auction_id'):
            result = self.run_test(
                "Get Auction by ID",
                "GET",
                f"auctions/{self.forward_auction_id}",
                200
            )
            return result is not None
        else:
            self.log_test("Get Auction by ID", False, "No auction ID available")
            return False

    def test_get_my_auctions(self):
        """Test getting user's auctions"""
        result = self.run_test(
            "Get My Auctions",
            "GET",
            "my-auctions",
            200
        )
        return result is not None

    def test_get_my_bids(self):
        """Test getting user's bids"""
        result = self.run_test(
            "Get My Bids",
            "GET",
            "my-bids",
            200
        )
        return result is not None

    def test_place_bid_on_own_auction(self):
        """Test placing bid on own auction (should fail)"""
        if hasattr(self, 'forward_auction_id'):
            bid_data = {
                "auction_id": self.forward_auction_id,
                "amount": 105.0
            }
            
            result = self.run_test(
                "Place Bid on Own Auction (Should Fail)",
                "POST",
                "bids",
                400,  # Should fail with 400
                data=bid_data
            )
            return result is None  # Should return None for failed request
        else:
            self.log_test("Place Bid on Own Auction", False, "No auction ID available")
            return False

    def test_create_second_user_and_bid(self):
        """Create second user and test bidding"""
        # Create second user
        timestamp = int(time.time()) + 2
        user2_data = {
            "email": f"bidder{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Bidder User {timestamp}"
        }
        
        result = self.run_test(
            "Create Second User for Bidding",
            "POST",
            "auth/register",
            200,
            data=user2_data
        )
        
        if not result:
            return False
        
        # Store original token
        original_token = self.token
        
        # Use second user's token
        self.token = result.get('access_token')
        
        # Test bidding on forward auction
        if hasattr(self, 'forward_auction_id'):
            bid_data = {
                "auction_id": self.forward_auction_id,
                "amount": 105.0
            }
            
            bid_result = self.run_test(
                "Place Valid Bid on Forward Auction",
                "POST",
                "bids",
                200,
                data=bid_data
            )
            
            # Test getting auction bids
            bids_result = self.run_test(
                "Get Auction Bids",
                "GET",
                f"auctions/{self.forward_auction_id}/bids",
                200
            )
        
        # Test bidding on reverse auction
        if hasattr(self, 'reverse_auction_id'):
            reverse_bid_data = {
                "auction_id": self.reverse_auction_id,
                "amount": 190.0  # Lower than starting price for reverse auction
            }
            
            reverse_bid_result = self.run_test(
                "Place Valid Bid on Reverse Auction",
                "POST",
                "bids",
                200,
                data=reverse_bid_data
            )
        
        # Restore original token
        self.token = original_token
        
        return bid_result is not None

    def test_auto_bidding(self):
        """Test auto-bidding functionality"""
        # Create third user for auto-bidding
        timestamp = int(time.time()) + 3
        user3_data = {
            "email": f"autobidder{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Auto Bidder {timestamp}"
        }
        
        result = self.run_test(
            "Create User for Auto-Bidding",
            "POST",
            "auth/register",
            200,
            data=user3_data
        )
        
        if not result:
            return False
        
        # Store original token
        original_token = self.token
        self.token = result.get('access_token')
        
        # Set up auto-bid
        if hasattr(self, 'forward_auction_id'):
            auto_bid_data = {
                "auction_id": self.forward_auction_id,
                "max_amount": 150.0
            }
            
            auto_bid_result = self.run_test(
                "Create Auto-Bid",
                "POST",
                "auto-bids",
                200,
                data=auto_bid_data
            )
            
            # Get auto-bid
            get_auto_bid_result = self.run_test(
                "Get Auto-Bid",
                "GET",
                f"auto-bids/{self.forward_auction_id}",
                200
            )
        
        # Restore original token
        self.token = original_token
        
        return auto_bid_result is not None

    def test_notifications(self):
        """Test notifications functionality"""
        # Get notifications
        result = self.run_test(
            "Get Notifications",
            "GET",
            "notifications",
            200
        )
        
        if result and len(result) > 0:
            # Test marking notification as read
            notification_id = result[0].get('id')
            if notification_id:
                read_result = self.run_test(
                    "Mark Notification as Read",
                    "PUT",
                    f"notifications/{notification_id}/read",
                    200
                )
                
                # Test mark all as read
                mark_all_result = self.run_test(
                    "Mark All Notifications as Read",
                    "PUT",
                    "notifications/read-all",
                    200
                )
                
                return read_result is not None and mark_all_result is not None
        
        return result is not None

    def test_invalid_bid_amounts(self):
        """Test invalid bid amounts"""
        if hasattr(self, 'forward_auction_id'):
            # Test bid below minimum increment
            invalid_bid_data = {
                "auction_id": self.forward_auction_id,
                "amount": 102.0  # Less than required increment
            }
            
            # This should fail
            result = self.run_test(
                "Invalid Bid Amount (Should Fail)",
                "POST",
                "bids",
                400,
                data=invalid_bid_data
            )
            
            return result is None  # Should return None for failed request
        
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting eAuction API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        if not self.test_user_registration():
            print("❌ Registration failed - stopping tests")
            return False
        
        self.test_user_login()
        self.test_get_current_user()
        
        # Auction creation tests
        self.test_create_forward_auction()
        self.test_create_reverse_auction()
        
        # Auction retrieval tests
        self.test_get_auctions()
        self.test_get_active_auctions()
        self.test_get_auction_by_id()
        self.test_get_my_auctions()
        self.test_get_my_bids()
        
        # Bidding tests
        self.test_place_bid_on_own_auction()
        self.test_create_second_user_and_bid()
        self.test_invalid_bid_amounts()
        
        # Advanced features
        self.test_auto_bidding()
        self.test_notifications()
        
        # Print results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = EAuctionAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())