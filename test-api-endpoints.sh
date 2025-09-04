#!/bin/bash

# API Endpoint Testing Script for Vercel Deployment
# Tests all API endpoints with proper headers and responses

# Configuration
VERCEL_URL="${VERCEL_URL:-https://your-app-name.vercel.app}"
TEMP_DIR="/tmp/vercel-api-test-$$"
mkdir -p "$TEMP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
    TEST_RESULTS+=("PASS: $1")
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
    TEST_RESULTS+=("FAIL: $1")
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test API endpoint function
test_api_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local description="$3"
    
    log_info "Testing $description: $endpoint"
    
    local response_file="$TEMP_DIR/api_response_$(basename "$endpoint")"
    local headers_file="$TEMP_DIR/api_headers_$(basename "$endpoint")"
    
    # Make request with detailed metrics
    curl -s -w "%{http_code}|%{content_type}|%{size_download}|%{time_total}" \
         -D "$headers_file" \
         -o "$response_file" \
         "$VERCEL_URL$endpoint" > "$TEMP_DIR/api_meta_$(basename "$endpoint")"
    
    # Parse response metadata
    local metadata=$(cat "$TEMP_DIR/api_meta_$(basename "$endpoint")")
    IFS='|' read -r http_code content_type size_download time_total <<< "$metadata"
    
    # Test 1: HTTP Status Code
    if [[ "$http_code" == "$expected_status" ]]; then
        log_success "$description returns HTTP $http_code"
    else
        log_failure "$description returns HTTP $http_code (expected $expected_status)"
        return 1
    fi
    
    # Test 2: Content-Type (should be JSON for API endpoints)
    if [[ "$content_type" == *"application/json"* ]]; then
        log_success "$description returns JSON content-type: $content_type"
    else
        log_failure "$description returns non-JSON content-type: $content_type"
    fi
    
    # Test 3: Response body validation (JSON format)
    if [[ "$expected_status" == "200" ]]; then
        if jq empty "$response_file" 2>/dev/null; then
            log_success "$description returns valid JSON"
            
            # Additional validation for specific endpoints
            case "$endpoint" in
                "/api")
                    if jq -e '.message and .version and .endpoints' "$response_file" >/dev/null 2>&1; then
                        log_success "$description contains expected API info"
                    else
                        log_warning "$description missing expected fields (message, version, endpoints)"
                    fi
                    ;;
                "/api/health")
                    if jq -e '.status and .initialized != null' "$response_file" >/dev/null 2>&1; then
                        log_success "$description contains health status"
                    else
                        log_failure "$description missing health status fields"
                    fi
                    ;;
                "/api/leagues")
                    if jq -e 'type == "array" or (.error and type == "object")' "$response_file" >/dev/null 2>&1; then
                        log_success "$description returns leagues array or error object"
                    else
                        log_failure "$description returns unexpected format"
                    fi
                    ;;
            esac
        else
            log_failure "$description returns invalid JSON"
        fi
    fi
    
    # Test 4: CORS Headers
    local cors_origin=$(grep -i "access-control-allow-origin:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    local cors_methods=$(grep -i "access-control-allow-methods:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    
    if [[ -n "$cors_origin" ]]; then
        log_success "$description has CORS origin header: $cors_origin"
    else
        log_failure "$description missing CORS origin header"
    fi
    
    if [[ "$cors_methods" == *"GET"* ]] && [[ "$cors_methods" == *"POST"* ]]; then
        log_success "$description has correct CORS methods: $cors_methods"
    else
        log_warning "$description CORS methods: $cors_methods (expected GET, POST)"
    fi
    
    # Test 5: Cache Control for API (should be no-cache)
    local cache_control=$(grep -i "cache-control:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ "$cache_control" == *"max-age=0"* ]] && [[ "$cache_control" == *"must-revalidate"* ]]; then
        log_success "$description has correct no-cache headers: $cache_control"
    else
        log_warning "$description cache headers: $cache_control (expected max-age=0, must-revalidate)"
    fi
    
    # Test 6: Response Time
    local time_threshold=5.0
    if (( $(echo "$time_total < $time_threshold" | bc -l 2>/dev/null || echo "1") )); then
        log_success "$description responds quickly (${time_total}s)"
    else
        log_warning "$description responds slowly (${time_total}s, threshold: ${time_threshold}s)"
    fi
}

# Test CORS preflight
test_cors_preflight() {
    local endpoint="$1"
    local description="$2"
    
    log_info "Testing CORS preflight for $description"
    
    local headers_file="$TEMP_DIR/cors_preflight_headers"
    
    # Send OPTIONS request
    local http_code=$(curl -s -w "%{http_code}" \
         -X OPTIONS \
         -H "Origin: https://example.com" \
         -H "Access-Control-Request-Method: POST" \
         -H "Access-Control-Request-Headers: Content-Type" \
         -D "$headers_file" \
         -o /dev/null \
         "$VERCEL_URL$endpoint")
    
    if [[ "$http_code" == "200" ]]; then
        log_success "$description CORS preflight returns HTTP 200"
        
        # Check preflight response headers
        local allow_origin=$(grep -i "access-control-allow-origin:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
        local allow_methods=$(grep -i "access-control-allow-methods:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
        local allow_headers=$(grep -i "access-control-allow-headers:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
        
        if [[ -n "$allow_origin" ]]; then
            log_success "$description CORS allows origin: $allow_origin"
        else
            log_failure "$description CORS preflight missing Allow-Origin"
        fi
        
        if [[ "$allow_methods" == *"POST"* ]]; then
            log_success "$description CORS allows POST method"
        else
            log_failure "$description CORS preflight missing POST method"
        fi
        
        if [[ "$allow_headers" == *"Content-Type"* ]]; then
            log_success "$description CORS allows Content-Type header"
        else
            log_failure "$description CORS preflight missing Content-Type header"
        fi
    else
        log_failure "$description CORS preflight returns HTTP $http_code (expected 200)"
    fi
}

# Test POST endpoint (rankings upload)
test_post_endpoint() {
    log_info "Testing POST endpoint: /api/rankings/upload"
    
    local response_file="$TEMP_DIR/post_response"
    local headers_file="$TEMP_DIR/post_headers"
    
    # Create test data
    local test_data='{"type": "weekly", "week": 1, "data": [{"rank": 1, "name": "Test Player", "position": "QB", "points": 25.0}]}'
    
    curl -s -w "%{http_code}|%{content_type}" \
         -X POST \
         -H "Content-Type: application/json" \
         -d "$test_data" \
         -D "$headers_file" \
         -o "$response_file" \
         "$VERCEL_URL/api/rankings/upload" > "$TEMP_DIR/post_meta"
    
    local metadata=$(cat "$TEMP_DIR/post_meta")
    IFS='|' read -r http_code content_type <<< "$metadata"
    
    # Accept both success and service unavailable (depending on backend setup)
    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "503" ]]; then
        log_success "POST endpoint accessible (HTTP $http_code)"
        
        if [[ "$content_type" == *"application/json"* ]]; then
            log_success "POST endpoint returns JSON"
        else
            log_failure "POST endpoint returns non-JSON: $content_type"
        fi
    else
        log_failure "POST endpoint returns HTTP $http_code (expected 200 or 503)"
    fi
}

# Test parameterized endpoints (if possible)
test_parameterized_endpoints() {
    log_info "Testing parameterized endpoints with demo data"
    
    # Test with demo league ID (this will likely return 404 or error, but should be accessible)
    local demo_endpoints=(
        "/api/leagues/12345/lineup?week=1"
        "/api/leagues/12345/waiver?week=1"
        "/api/leagues/12345/my-team"
    )
    
    for endpoint in "${demo_endpoints[@]}"; do
        local description="Parameterized endpoint $(echo "$endpoint" | cut -d'?' -f1)"
        
        local response_file="$TEMP_DIR/param_response_$(echo "$endpoint" | sed 's/[^a-zA-Z0-9]/_/g')"
        local http_code=$(curl -s -w "%{http_code}" -o "$response_file" "$VERCEL_URL$endpoint")
        
        # Accept various status codes as long as the endpoint is reachable
        if [[ "$http_code" == "200" ]] || [[ "$http_code" == "400" ]] || [[ "$http_code" == "503" ]]; then
            log_success "$description is accessible (HTTP $http_code)"
        else
            log_failure "$description returns HTTP $http_code (endpoint may not be configured)"
        fi
    done
}

# Main test execution
main() {
    echo "========================================="
    echo "API Endpoint Testing for Vercel Deployment"
    echo "URL: $VERCEL_URL"
    echo "Timestamp: $(date)"
    echo "========================================="
    echo
    
    # Core API endpoints
    test_api_endpoint "/api" "200" "Root API endpoint"
    echo
    
    test_api_endpoint "/api/health" "200" "Health check endpoint"
    echo
    
    test_api_endpoint "/api/leagues" "200" "Leagues endpoint"
    echo
    
    # Test CORS preflight
    test_cors_preflight "/api/health" "Health endpoint"
    echo
    
    # Test POST endpoint
    test_post_endpoint
    echo
    
    # Test parameterized endpoints
    test_parameterized_endpoints
    echo
    
    # Test 404 for non-existent API endpoint
    log_info "Testing 404 handling for non-existent API endpoints"
    local missing_api_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL/api/nonexistent")
    if [[ "$missing_api_response" == "404" ]]; then
        log_success "Non-existent API endpoints return HTTP 404"
    else
        log_failure "Non-existent API endpoints return HTTP $missing_api_response (expected 404)"
    fi
    
    echo
    echo "========================================="
    echo "API Test Summary"
    echo "========================================="
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo
    
    # Print detailed results
    echo "Detailed Results:"
    for result in "${TEST_RESULTS[@]}"; do
        if [[ "$result" == PASS:* ]]; then
            echo -e "${GREEN}✓${NC} ${result#PASS: }"
        else
            echo -e "${RED}✗${NC} ${result#FAIL: }"
        fi
    done
    
    echo
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All API endpoint tests passed!${NC}"
        cleanup
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Check the API configuration.${NC}"
        cleanup
        exit 1
    fi
}

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}

# Handle script interruption
trap cleanup EXIT

# Validate URL is set
if [[ "$VERCEL_URL" == *"your-app-name"* ]]; then
    echo -e "${RED}Error: Please set VERCEL_URL environment variable to your actual Vercel URL${NC}"
    echo "Example: export VERCEL_URL=https://your-actual-app.vercel.app"
    exit 1
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is recommended for JSON validation but not installed${NC}"
fi

if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}Warning: bc is recommended for time calculations but not installed${NC}"
fi

# Run tests
main