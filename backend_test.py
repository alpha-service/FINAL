#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, List, Any

class POSAPITester:
    def __init__(self, base_url="https://laughing-kare.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.sample_data = {}

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 data: Dict = None, params: Dict = None) -> tuple:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text

            details = f"Status: {response.status_code}"
            if not success:
                details += f" (expected {expected_status})"
                
            self.log_test(name, success, details, response_data if not success else None)
            return success, response_data

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, data = self.run_test("API Root", "GET", "")
        if success and isinstance(data, dict):
            return data.get("message") == "ALPHA&CO POS API"
        return False

    def test_categories(self):
        """Test categories endpoint"""
        success, data = self.run_test("Get Categories", "GET", "categories")
        if success and isinstance(data, list) and len(data) > 0:
            self.sample_data['categories'] = data
            # Check if categories have required fields
            first_cat = data[0]
            required_fields = ['id', 'name_fr', 'name_nl']
            has_fields = all(field in first_cat for field in required_fields)
            self.log_test("Categories Structure", has_fields, 
                         f"Found {len(data)} categories with required fields" if has_fields else "Missing required fields")
            return has_fields
        return False

    def test_products(self):
        """Test products endpoint"""
        success, data = self.run_test("Get Products", "GET", "products")
        if success and isinstance(data, list) and len(data) > 0:
            self.sample_data['products'] = data
            # Check if products have required fields
            first_product = data[0]
            required_fields = ['id', 'sku', 'name_fr', 'name_nl', 'category_id', 'price_retail', 'stock_qty']
            has_fields = all(field in first_product for field in required_fields)
            self.log_test("Products Structure", has_fields, 
                         f"Found {len(data)} products with required fields" if has_fields else "Missing required fields")
            return has_fields
        return False

    def test_product_search(self):
        """Test product search functionality"""
        if not self.sample_data.get('products'):
            self.log_test("Product Search", False, "No products available for search test")
            return False
            
        # Test search by SKU
        sample_product = self.sample_data['products'][0]
        sku = sample_product['sku']
        success, data = self.run_test("Product Search by SKU", "GET", "products", 
                                     params={"search": sku})
        
        if success and isinstance(data, list):
            found_product = next((p for p in data if p['sku'] == sku), None)
            search_works = found_product is not None
            self.log_test("SKU Search Result", search_works, 
                         f"Found product with SKU {sku}" if search_works else f"SKU {sku} not found")
            return search_works
        return False

    def test_product_category_filter(self):
        """Test product category filtering"""
        if not self.sample_data.get('categories'):
            self.log_test("Category Filter", False, "No categories available for filter test")
            return False
            
        # Test filter by category
        sample_category = self.sample_data['categories'][0]
        cat_id = sample_category['id']
        success, data = self.run_test("Product Category Filter", "GET", "products", 
                                     params={"category_id": cat_id})
        
        if success and isinstance(data, list):
            all_match_category = all(p['category_id'] == cat_id for p in data)
            self.log_test("Category Filter Result", all_match_category, 
                         f"Found {len(data)} products in category {cat_id}")
            return all_match_category
        return False

    def test_customers(self):
        """Test customers endpoint"""
        success, data = self.run_test("Get Customers", "GET", "customers")
        if success and isinstance(data, list) and len(data) > 0:
            self.sample_data['customers'] = data
            # Check if customers have required fields
            first_customer = data[0]
            required_fields = ['id', 'name', 'type']
            has_fields = all(field in first_customer for field in required_fields)
            self.log_test("Customers Structure", has_fields, 
                         f"Found {len(data)} customers with required fields" if has_fields else "Missing required fields")
            return has_fields
        return False

    def test_customer_search(self):
        """Test customer search functionality"""
        if not self.sample_data.get('customers'):
            self.log_test("Customer Search", False, "No customers available for search test")
            return False
            
        # Test search by name
        sample_customer = self.sample_data['customers'][0]
        name_part = sample_customer['name'].split()[0]  # First word of name
        success, data = self.run_test("Customer Search by Name", "GET", "customers", 
                                     params={"search": name_part})
        
        if success and isinstance(data, list):
            found_customer = next((c for c in data if name_part.lower() in c['name'].lower()), None)
            search_works = found_customer is not None
            self.log_test("Customer Search Result", search_works, 
                         f"Found customer with name containing '{name_part}'" if search_works else f"Name '{name_part}' not found")
            return search_works
        return False

    def test_sale_creation(self):
        """Test sale creation"""
        if not self.sample_data.get('products') or not self.sample_data.get('customers'):
            self.log_test("Sale Creation", False, "Missing products or customers for sale test")
            return False

        # Create a test sale
        product = self.sample_data['products'][0]
        customer = self.sample_data['customers'][0]
        
        sale_data = {
            "customer_id": customer['id'],
            "items": [
                {
                    "product_id": product['id'],
                    "sku": product['sku'],
                    "name": product['name_fr'],
                    "qty": 2,
                    "unit_price": product['price_retail'],
                    "vat_rate": product.get('vat_rate', 21.0)
                }
            ],
            "payments": [
                {
                    "method": "cash",
                    "amount": product['price_retail'] * 2 * 1.21  # Include VAT
                }
            ]
        }
        
        success, data = self.run_test("Create Sale", "POST", "sales", 201, sale_data)
        
        if success and isinstance(data, dict):
            required_fields = ['id', 'number', 'status', 'total', 'items', 'payments']
            has_fields = all(field in data for field in required_fields)
            self.log_test("Sale Creation Structure", has_fields, 
                         f"Sale created with number {data.get('number')}" if has_fields else "Missing required fields")
            
            if has_fields:
                self.sample_data['sale'] = data
            return has_fields
        return False

    def test_get_sales(self):
        """Test getting sales list"""
        success, data = self.run_test("Get Sales", "GET", "sales")
        if success and isinstance(data, list):
            self.log_test("Sales List", True, f"Found {len(data)} sales")
            return True
        return False

    def test_individual_product(self):
        """Test getting individual product"""
        if not self.sample_data.get('products'):
            self.log_test("Individual Product", False, "No products available")
            return False
            
        product_id = self.sample_data['products'][0]['id']
        success, data = self.run_test("Get Individual Product", "GET", f"products/{product_id}")
        
        if success and isinstance(data, dict):
            correct_product = data.get('id') == product_id
            self.log_test("Individual Product Result", correct_product, 
                         f"Retrieved product {product_id}" if correct_product else "Wrong product returned")
            return correct_product
        return False

    def test_individual_customer(self):
        """Test getting individual customer"""
        if not self.sample_data.get('customers'):
            self.log_test("Individual Customer", False, "No customers available")
            return False
            
        customer_id = self.sample_data['customers'][0]['id']
        success, data = self.run_test("Get Individual Customer", "GET", f"customers/{customer_id}")
        
        if success and isinstance(data, dict):
            correct_customer = data.get('id') == customer_id
            self.log_test("Individual Customer Result", correct_customer, 
                         f"Retrieved customer {customer_id}" if correct_customer else "Wrong customer returned")
            return correct_customer
        return False

    def test_document_creation(self):
        """Test document creation (quote)"""
        if not self.sample_data.get('products') or not self.sample_data.get('customers'):
            self.log_test("Document Creation", False, "Missing products or customers for document test")
            return False

        # Create a test quote with multiple items and different VAT rates
        product1 = self.sample_data['products'][0]
        product2 = self.sample_data['products'][1] if len(self.sample_data['products']) > 1 else self.sample_data['products'][0]
        customer = self.sample_data['customers'][0]
        
        document_data = {
            "doc_type": "quote",
            "customer_id": customer['id'],
            "items": [
                {
                    "product_id": product1['id'],
                    "sku": product1['sku'],
                    "name": product1['name_fr'],
                    "qty": 2.0,
                    "unit_price": product1['price_retail'],
                    "vat_rate": product1.get('vat_rate', 21.0)
                },
                {
                    "product_id": product2['id'],
                    "sku": product2['sku'],
                    "name": product2['name_fr'],
                    "qty": 1.5,
                    "unit_price": product2['price_retail'],
                    "vat_rate": product2.get('vat_rate', 21.0)
                }
            ],
            "payments": [],
            "notes": "Test quote for PDF generation"
        }
        
        success, data = self.run_test("Create Document (Quote)", "POST", "documents", 200, document_data)
        
        if success and isinstance(data, dict):
            required_fields = ['id', 'number', 'doc_type', 'status', 'total', 'items', 'subtotal', 'vat_total']
            has_fields = all(field in data for field in required_fields)
            
            # Verify document type and number format
            correct_type = data.get('doc_type') == 'quote'
            correct_number_format = data.get('number', '').startswith('DV')
            
            self.log_test("Document Creation Structure", has_fields and correct_type and correct_number_format, 
                         f"Quote created with number {data.get('number')}, total €{data.get('total')}" if has_fields else "Missing required fields or incorrect format")
            
            if has_fields and correct_type:
                self.sample_data['document'] = data
                return True
        return False

    def test_document_detail(self):
        """Test document detail endpoint"""
        if not self.sample_data.get('document'):
            self.log_test("Document Detail", False, "No document available for detail test")
            return False
            
        doc_id = self.sample_data['document']['id']
        success, data = self.run_test("Get Document Detail", "GET", f"documents/{doc_id}")
        
        if success and isinstance(data, dict):
            # Verify complete document structure
            required_fields = ['id', 'number', 'doc_type', 'status', 'items', 'subtotal', 'vat_total', 'total', 'paid_total', 'created_at']
            has_fields = all(field in data for field in required_fields)
            
            # Verify items structure
            items_valid = True
            if 'items' in data and isinstance(data['items'], list) and len(data['items']) > 0:
                item = data['items'][0]
                item_fields = ['sku', 'name', 'qty', 'unit_price', 'vat_rate', 'line_total']
                items_valid = all(field in item for field in item_fields)
            
            # Verify customer info if present
            customer_info_valid = True
            if data.get('customer_id'):
                customer_fields = ['customer_name']
                customer_info_valid = any(field in data for field in customer_fields)
            
            # Verify totals calculation
            totals_valid = True
            if 'subtotal' in data and 'vat_total' in data and 'total' in data:
                calculated_total = round(data['subtotal'] + data['vat_total'], 2)
                totals_valid = abs(calculated_total - data['total']) < 0.01
            
            all_valid = has_fields and items_valid and customer_info_valid and totals_valid
            
            details = f"Document {data.get('number')} retrieved"
            if not items_valid:
                details += " - Items structure invalid"
            if not customer_info_valid:
                details += " - Customer info missing"
            if not totals_valid:
                details += " - Totals calculation incorrect"
                
            self.log_test("Document Detail Structure", all_valid, details)
            return all_valid
        return False

    def test_pdf_generation(self):
        """Test PDF generation endpoint"""
        if not self.sample_data.get('document'):
            self.log_test("PDF Generation", False, "No document available for PDF test")
            return False
            
        doc_id = self.sample_data['document']['id']
        doc_number = self.sample_data['document']['number']
        
        # Test PDF generation endpoint
        url = f"{self.api_url}/documents/{doc_id}/pdf"
        headers = {'Accept': 'application/pdf'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            # Check status code
            status_ok = response.status_code == 200
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            content_type_ok = 'application/pdf' in content_type
            
            # Check content disposition header for filename
            content_disposition = response.headers.get('content-disposition', '')
            expected_filename = f"{doc_number}.pdf"
            filename_ok = expected_filename in content_disposition
            
            # Check if response contains PDF binary data
            content_length = len(response.content)
            has_content = content_length > 1000  # PDF should be at least 1KB
            
            # Check PDF magic bytes
            is_pdf = response.content.startswith(b'%PDF-')
            
            all_checks_pass = status_ok and content_type_ok and filename_ok and has_content and is_pdf
            
            details = f"Status: {response.status_code}, Content-Type: {content_type}, Size: {content_length} bytes"
            if not content_type_ok:
                details += " - Wrong content type"
            if not filename_ok:
                details += f" - Filename issue (expected {expected_filename})"
            if not has_content:
                details += " - Content too small"
            if not is_pdf:
                details += " - Not valid PDF format"
                
            self.log_test("PDF Generation", all_checks_pass, details)
            return all_checks_pass
            
        except Exception as e:
            self.log_test("PDF Generation", False, f"Error: {str(e)}")
            return False

    def test_documents_list(self):
        """Test documents list endpoint"""
        success, data = self.run_test("Get Documents List", "GET", "documents")
        if success and isinstance(data, list):
            self.log_test("Documents List", True, f"Found {len(data)} documents")
            
            # If we have documents, verify structure
            if len(data) > 0:
                doc = data[0]
                required_fields = ['id', 'number', 'doc_type', 'status', 'total', 'created_at']
                has_fields = all(field in doc for field in required_fields)
                self.log_test("Documents List Structure", has_fields, 
                             "Document list items have required fields" if has_fields else "Missing required fields in document list")
                return has_fields
            return True
        return False

    def run_document_tests(self):
        """Run document-specific tests for PDF generation and navigation"""
        print(f"🚀 Starting Document PDF Generation and Navigation Tests")
        print(f"📍 Testing endpoint: {self.api_url}")
        print("=" * 60)
        
        # Basic connectivity
        self.test_api_root()
        
        # Get required data
        self.test_products()
        self.test_customers()
        
        # Document functionality tests
        self.test_document_creation()
        self.test_document_detail()
        self.test_pdf_generation()
        self.test_documents_list()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All document tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting ALPHA&CO POS API Tests")
        print(f"📍 Testing endpoint: {self.api_url}")
        print("=" * 60)
        
        # Basic connectivity
        self.test_api_root()
        
        # Core data endpoints
        self.test_categories()
        self.test_products()
        self.test_customers()
        
        # Search and filter functionality
        self.test_product_search()
        self.test_product_category_filter()
        self.test_customer_search()
        
        # Individual item retrieval
        self.test_individual_product()
        self.test_individual_customer()
        
        # Sales functionality
        self.test_sale_creation()
        self.test_get_sales()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    """Main test runner"""
    import sys
    
    # Check if we should run document-specific tests
    run_document_tests = len(sys.argv) > 1 and sys.argv[1] == "documents"
    
    tester = POSAPITester()
    
    try:
        if run_document_tests:
            success = tester.run_document_tests()
        else:
            success = tester.run_all_tests()
        
        # Save detailed results
        results = {
            "timestamp": datetime.now().isoformat(),
            "test_type": "document_tests" if run_document_tests else "full_tests",
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "failed_tests": tester.tests_run - tester.tests_passed,
                "success_rate": f"{(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%"
            },
            "test_results": tester.test_results,
            "sample_data": {
                "categories_count": len(tester.sample_data.get('categories', [])),
                "products_count": len(tester.sample_data.get('products', [])),
                "customers_count": len(tester.sample_data.get('customers', [])),
                "document_created": bool(tester.sample_data.get('document'))
            }
        }
        
        # Create test_reports directory if it doesn't exist
        import os
        os.makedirs('/app/test_reports', exist_ok=True)
        
        filename = 'document_api_results.json' if run_document_tests else 'backend_api_results.json'
        with open(f'/app/test_reports/{filename}', 'w') as f:
            json.dump(results, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())