#!/bin/bash

# SPA Routing Testing Script for Vercel Deployment
# Tests that all non-API routes serve the main index.html file

# Configuration
VERCEL_URL="${VERCEL_URL:-https://your-app-name.vercel.app}"
TEMP_DIR="/tmp/vercel-spa-test-$$"
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

# Get reference index.html content
get_reference_html() {
    local reference_file="$TEMP_DIR/reference_index.html"
    
    curl -s -o "$reference_file" "$VERCEL_URL/"
    
    if [[ -s "$reference_file" ]]; then
        echo "$reference_file"
        return 0
    else
        log_failure "Could not fetch reference index.html from root path"
        return 1
    fi
}

# Test SPA route function
test_spa_route() {
    local route="$1"
    local description="$2"
    local reference_file="$3"
    
    log_info "Testing SPA route: $route"
    
    local response_file="$TEMP_DIR/spa_response_$(echo "$route" | sed 's/[^a-zA-Z0-9]/_/g')"
    local headers_file="$TEMP_DIR/spa_headers_$(echo "$route" | sed 's/[^a-zA-Z0-9]/_/g')"
    
    # Make request
    curl -s -w "%{http_code}|%{content_type}|%{size_download}" \
         -D "$headers_file" \
         -o "$response_file" \
         "$VERCEL_URL$route" > "$TEMP_DIR/spa_meta_$(echo "$route" | sed 's/[^a-zA-Z0-9]/_/g')"
    
    # Parse response metadata
    local metadata=$(cat "$TEMP_DIR/spa_meta_$(echo "$route" | sed 's/[^a-zA-Z0-9]/_/g')")
    IFS='|' read -r http_code content_type size_download <<< "$metadata"
    
    # Test 1: HTTP Status Code should be 200
    if [[ "$http_code" == "200" ]]; then
        log_success "$description returns HTTP 200"
    else
        log_failure "$description returns HTTP $http_code (expected 200)"
        return 1
    fi
    
    # Test 2: Content-Type should be HTML
    if [[ "$content_type" == *"text/html"* ]]; then
        log_success "$description returns HTML content-type"
    else
        log_failure "$description returns non-HTML content-type: $content_type"
    fi
    
    # Test 3: Response should be same as reference index.html (or very similar)
    if [[ -f "$reference_file" ]]; then
        # Compare key elements instead of exact match (to handle dynamic content)
        local title_match=$(grep -c "<title>Fantasy Football Manager</title>" "$response_file")
        local app_div_match=$(grep -c 'id="app"' "$response_file")
        local script_match=$(grep -c 'src="app.js"' "$response_file")
        local css_match=$(grep -c 'href="styles.css"' "$response_file")
        
        if [[ "$title_match" -gt 0 ]] && [[ "$app_div_match" -gt 0 ]] && [[ "$script_match" -gt 0 ]] && [[ "$css_match" -gt 0 ]]; then
            log_success "$description serves correct index.html content"
        else
            log_failure "$description does not serve expected index.html content (title:$title_match, app:$app_div_match, script:$script_match, css:$css_match)"
        fi
    else
        log_warning "$description cannot validate content (no reference file)"
    fi
    
    # Test 4: File size should be reasonable (similar to reference)
    if [[ -f "$reference_file" ]]; then
        local reference_size=$(wc -c < "$reference_file")
        local size_diff=$((size_download - reference_size))
        local size_diff_abs=${size_diff#-}  # Get absolute value
        
        # Allow 10% size difference (for minor variations)
        local size_tolerance=$((reference_size / 10))
        
        if [[ "$size_diff_abs" -le "$size_tolerance" ]]; then
            log_success "$description has correct content size ($size_download bytes, ref: $reference_size bytes)"
        else
            log_warning "$description has different content size ($size_download vs $reference_size bytes, diff: $size_diff)"
        fi
    fi
    
    # Test 5: Check for SPA-specific elements
    local nav_buttons=$(grep -c 'class="nav-btn"' "$response_file")
    local view_divs=$(grep -c 'class="view' "$response_file")
    
    if [[ "$nav_buttons" -gt 0 ]] && [[ "$view_divs" -gt 0 ]]; then
        log_success "$description contains SPA navigation elements"
    else
        log_warning "$description may not contain expected SPA elements (nav:$nav_buttons, views:$view_divs)"
    fi
}

# Test client-side routing functionality
test_client_side_routing() {
    log_info "Testing client-side routing functionality"
    
    local index_file="$TEMP_DIR/index_for_routing.html"
    
    # Get the main page
    curl -s -o "$index_file" "$VERCEL_URL/"
    
    if [[ -s "$index_file" ]]; then
        # Check for client-side routing JavaScript
        if grep -q "switchView\|data-view\|nav-btn" "$index_file"; then
            log_success "Client-side routing JavaScript present"
        else
            log_failure "Client-side routing JavaScript not found"
        fi
        
        # Check for view containers
        local view_count=$(grep -c 'id=".*-view"' "$index_file")
        if [[ "$view_count" -gt 1 ]]; then
            log_success "Multiple view containers found ($view_count views)"
        else
            log_failure "Insufficient view containers found ($view_count views)"
        fi
        
        # Check for navigation buttons
        local nav_count=$(grep -c 'data-view=' "$index_file")
        if [[ "$nav_count" -gt 1 ]]; then
            log_success "Navigation buttons found ($nav_count buttons)"
        else
            log_failure "Navigation buttons not found or insufficient ($nav_count buttons)"
        fi
    else
        log_failure "Could not fetch index.html for client-side routing test"
    fi
}

# Test edge cases for SPA routing
test_spa_edge_cases() {
    log_info "Testing SPA routing edge cases"
    
    # Test deeply nested routes
    local deep_route="/dashboard/league/123/week/5"
    local deep_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL$deep_route")
    if [[ "$deep_response" == "200" ]]; then
        log_success "Deep nested routes return HTTP 200"
    else
        log_failure "Deep nested routes return HTTP $deep_response (expected 200)"
    fi
    
    # Test routes with query parameters
    local query_route="/dashboard?league=123&week=5"
    local query_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL$query_route")
    if [[ "$query_response" == "200" ]]; then
        log_success "Routes with query parameters return HTTP 200"
    else
        log_failure "Routes with query parameters return HTTP $query_response (expected 200)"
    fi
    
    # Test routes with hash fragments (these should still serve index.html)
    local hash_route="/dashboard#section1"
    local hash_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL$hash_route")
    if [[ "$hash_response" == "200" ]]; then
        log_success "Routes with hash fragments return HTTP 200"
    else
        log_failure "Routes with hash fragments return HTTP $hash_response (expected 200)"
    fi
}

# Test that API routes are NOT served as SPA routes
test_api_route_exclusion() {
    log_info "Testing that API routes are not served as SPA routes"
    
    local api_routes=(
        "/api"
        "/api/health" 
        "/api/leagues"
    )
    
    for route in "${api_routes[@]}"; do
        local response_file="$TEMP_DIR/api_exclusion_$(basename "$route")"
        local content_type=$(curl -s -w "%{content_type}" -o "$response_file" "$VERCEL_URL$route")
        
        # API routes should return JSON, not HTML
        if [[ "$content_type" == *"application/json"* ]]; then
            log_success "API route $route correctly returns JSON (not SPA HTML)"
        else
            log_failure "API route $route returns $content_type (should be JSON, not SPA HTML)"
        fi
        
        # Should not contain HTML structure
        if ! grep -q "<html\|<head\|<body" "$response_file"; then
            log_success "API route $route does not return HTML structure"
        else
            log_failure "API route $route incorrectly returns HTML structure"
        fi
    done
}

# Main test execution
main() {
    echo "========================================="
    echo "SPA Routing Testing for Vercel Deployment"
    echo "URL: $VERCEL_URL"
    echo "Timestamp: $(date)"
    echo "========================================="
    echo
    
    # Get reference index.html
    log_info "Getting reference index.html content"
    local reference_file
    if reference_file=$(get_reference_html); then
        log_success "Reference index.html obtained"
    else
        log_failure "Could not get reference index.html - aborting SPA tests"
        exit 1
    fi
    echo
    
    # Test common SPA routes
    local spa_routes=(
        "/"
        "/dashboard"
        "/lineup"
        "/waiver"
        "/rankings" 
        "/dashboard/league/123"
        "/lineup/optimizer"
        "/waiver/analysis"
        "/settings"
        "/profile"
        "/random-non-existent-route"
    )
    
    for route in "${spa_routes[@]}"; do
        local description="SPA route $route"
        test_spa_route "$route" "$description" "$reference_file"
        echo
    done
    
    # Test client-side routing functionality
    test_client_side_routing
    echo
    
    # Test edge cases
    test_spa_edge_cases
    echo
    
    # Test that API routes are excluded from SPA routing
    test_api_route_exclusion
    echo
    
    # Test that static assets are excluded from SPA routing
    log_info "Testing that static assets are not served as SPA routes"
    local css_content_type=$(curl -s -w "%{content_type}" -o /dev/null "$VERCEL_URL/styles.css")
    local js_content_type=$(curl -s -w "%{content_type}" -o /dev/null "$VERCEL_URL/app.js")
    
    if [[ "$css_content_type" == *"text/css"* ]]; then
        log_success "CSS file correctly returns CSS content-type (not SPA HTML)"
    else
        log_failure "CSS file returns wrong content-type: $css_content_type"
    fi
    
    if [[ "$js_content_type" == *"javascript"* ]]; then
        log_success "JS file correctly returns JavaScript content-type (not SPA HTML)"
    else
        log_failure "JS file returns wrong content-type: $js_content_type"
    fi
    
    echo
    echo "========================================="
    echo "SPA Routing Test Summary"
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
        echo -e "${GREEN}🎉 All SPA routing tests passed!${NC}"
        cleanup
        exit 0
    else
        echo -e "${RED}❌ Some SPA routing tests failed. Check the Vercel routing configuration.${NC}"
        echo
        echo "Common fixes:"
        echo "1. Verify vercel.json has the catch-all route: {\"src\": \"/(.*)\", \"dest\": \"/public/index.html\"}"
        echo "2. Ensure static assets have specific routes before the catch-all"
        echo "3. Ensure API routes are excluded from SPA routing"
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

# Run tests
main