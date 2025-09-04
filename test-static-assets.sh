#!/bin/bash

# Static Asset Testing Script for Vercel Deployment
# Tests CSS and JS file serving with correct headers

# Configuration
VERCEL_URL="${VERCEL_URL:-https://your-app-name.vercel.app}"
TEMP_DIR="/tmp/vercel-test-$$"
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

# Test function for static assets
test_static_asset() {
    local asset_path="$1"
    local expected_content_type="$2"
    local asset_name="$3"
    
    log_info "Testing $asset_name at $asset_path"
    
    # Make request and save headers and content
    local response_file="$TEMP_DIR/${asset_name}_response"
    local headers_file="$TEMP_DIR/${asset_name}_headers"
    
    curl -s -w "%{http_code}|%{content_type}|%{size_download}|%{time_total}" \
         -D "$headers_file" \
         -o "$response_file" \
         "$VERCEL_URL$asset_path" > "$TEMP_DIR/${asset_name}_meta"
    
    # Parse response metadata
    local metadata=$(cat "$TEMP_DIR/${asset_name}_meta")
    IFS='|' read -r http_code content_type size_download time_total <<< "$metadata"
    
    # Test 1: HTTP Status Code
    if [[ "$http_code" == "200" ]]; then
        log_success "$asset_name returns HTTP 200"
    else
        log_failure "$asset_name returns HTTP $http_code (expected 200)"
        return 1
    fi
    
    # Test 2: Content-Type Header
    if [[ "$content_type" == *"$expected_content_type"* ]]; then
        log_success "$asset_name has correct Content-Type: $content_type"
    else
        log_failure "$asset_name has wrong Content-Type: $content_type (expected: $expected_content_type)"
    fi
    
    # Test 3: File Size (should be > 0)
    if [[ "$size_download" -gt 0 ]]; then
        log_success "$asset_name has content ($size_download bytes)"
    else
        log_failure "$asset_name is empty (0 bytes)"
    fi
    
    # Test 4: Cache-Control Header (for static assets)
    local cache_control=$(grep -i "cache-control:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ "$cache_control" == *"max-age=31536000"* ]] && [[ "$cache_control" == *"immutable"* ]]; then
        log_success "$asset_name has correct cache headers: $cache_control"
    else
        log_warning "$asset_name cache headers: $cache_control (expected: max-age=31536000, immutable)"
    fi
    
    # Test 5: X-Content-Type-Options Header
    local content_type_options=$(grep -i "x-content-type-options:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ "$content_type_options" == "nosniff" ]]; then
        log_success "$asset_name has X-Content-Type-Options: nosniff"
    else
        log_failure "$asset_name missing X-Content-Type-Options: nosniff (found: $content_type_options)"
    fi
    
    # Test 6: Performance (loading time)
    local time_threshold=2.0
    if (( $(echo "$time_total < $time_threshold" | bc -l) )); then
        log_success "$asset_name loads quickly (${time_total}s)"
    else
        log_warning "$asset_name loads slowly (${time_total}s, threshold: ${time_threshold}s)"
    fi
    
    # Test 7: Content validation (basic)
    if [[ "$asset_path" == "/styles.css" ]]; then
        # Check if CSS contains expected patterns
        if grep -q "body\|\.nav-btn\|header" "$response_file"; then
            log_success "CSS file contains expected styles"
        else
            log_failure "CSS file appears to be invalid or empty"
        fi
    elif [[ "$asset_path" == "/app.js" ]]; then
        # Check if JS contains expected patterns
        if grep -q "FFWebClient\|class\|function" "$response_file"; then
            log_success "JS file contains expected code"
        else
            log_failure "JS file appears to be invalid or empty"
        fi
    fi
}

# Test compression/encoding
test_compression() {
    local asset_path="$1"
    local asset_name="$2"
    
    log_info "Testing compression for $asset_name"
    
    # Test with Accept-Encoding: gzip
    local compressed_size=$(curl -s -H "Accept-Encoding: gzip" -w "%{size_download}" -o /dev/null "$VERCEL_URL$asset_path")
    local uncompressed_size=$(curl -s -w "%{size_download}" -o /dev/null "$VERCEL_URL$asset_path")
    
    if [[ "$compressed_size" -lt "$uncompressed_size" ]]; then
        log_success "$asset_name is compressed (${compressed_size} vs ${uncompressed_size} bytes)"
    else
        log_warning "$asset_name may not be compressed (${compressed_size} vs ${uncompressed_size} bytes)"
    fi
}

# Main test execution
main() {
    echo "========================================="
    echo "Static Asset Testing for Vercel Deployment"
    echo "URL: $VERCEL_URL"
    echo "Timestamp: $(date)"
    echo "========================================="
    echo
    
    # Test CSS file
    test_static_asset "/styles.css" "text/css" "CSS"
    echo
    
    # Test JS file
    test_static_asset "/app.js" "application/javascript" "JavaScript"
    echo
    
    # Test compression
    test_compression "/styles.css" "CSS"
    test_compression "/app.js" "JavaScript"
    echo
    
    # Test 404 handling for missing static assets
    log_info "Testing 404 handling for missing assets"
    local missing_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL/nonexistent.css")
    if [[ "$missing_response" == "404" ]]; then
        log_success "Missing assets return HTTP 404"
    else
        log_failure "Missing assets return HTTP $missing_response (expected 404)"
    fi
    
    echo
    echo "========================================="
    echo "Test Summary"
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
        echo -e "${GREEN}🎉 All static asset tests passed!${NC}"
        cleanup
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Check the deployment configuration.${NC}"
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

if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}Warning: bc is recommended for performance calculations${NC}"
fi

# Run tests
main