#!/bin/bash

# Security Headers Testing Script for Vercel Deployment
# Tests security headers, HTTPS enforcement, and security policies

# Configuration
VERCEL_URL="${VERCEL_URL:-https://your-app-name.vercel.app}"
TEMP_DIR="/tmp/vercel-security-test-$$"
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

# Test security headers for a given endpoint
test_security_headers() {
    local endpoint="$1"
    local description="$2"
    local expected_type="$3"  # "html", "css", "js", "api"
    
    log_info "Testing security headers for $description: $endpoint"
    
    local headers_file="$TEMP_DIR/security_headers_$(echo "$endpoint" | sed 's/[^a-zA-Z0-9]/_/g')"
    
    # Make request and capture headers
    curl -s -D "$headers_file" -o /dev/null "$VERCEL_URL$endpoint"
    
    # Test 1: X-Content-Type-Options
    local content_type_options=$(grep -i "x-content-type-options:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ "$content_type_options" == "nosniff" ]]; then
        log_success "$description has X-Content-Type-Options: nosniff"
    else
        log_failure "$description missing or incorrect X-Content-Type-Options (found: '$content_type_options')"
    fi
    
    # Test 2: X-Frame-Options (for HTML content)
    if [[ "$expected_type" == "html" ]]; then
        local frame_options=$(grep -i "x-frame-options:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
        if [[ "$frame_options" == "DENY" ]]; then
            log_success "$description has X-Frame-Options: DENY"
        else
            log_failure "$description missing or incorrect X-Frame-Options (found: '$frame_options', expected: DENY)"
        fi
    fi
    
    # Test 3: X-XSS-Protection (for HTML content)
    if [[ "$expected_type" == "html" ]]; then
        local xss_protection=$(grep -i "x-xss-protection:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
        if [[ "$xss_protection" == *"1"* ]] && [[ "$xss_protection" == *"mode=block"* ]]; then
            log_success "$description has X-XSS-Protection: 1; mode=block"
        else
            log_failure "$description missing or incorrect X-XSS-Protection (found: '$xss_protection')"
        fi
    fi
    
    # Test 4: Strict-Transport-Security (HSTS)
    local hsts=$(grep -i "strict-transport-security:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ "$hsts" == *"max-age="* ]] && [[ "$hsts" == *"includeSubDomains"* ]]; then
        local max_age=$(echo "$hsts" | grep -o 'max-age=[0-9]*' | cut -d'=' -f2)
        if [[ "$max_age" -ge 31536000 ]]; then  # At least 1 year
            log_success "$description has strong HSTS header (max-age: $max_age)"
        else
            log_warning "$description has weak HSTS max-age: $max_age (recommended: >= 31536000)"
        fi
        
        if [[ "$hsts" == *"preload"* ]]; then
            log_success "$description has HSTS preload directive"
        else
            log_warning "$description missing HSTS preload directive"
        fi
    else
        log_failure "$description missing or weak HSTS header (found: '$hsts')"
    fi
    
    # Test 5: Content Security Policy (CSP) - check if present
    local csp=$(grep -i "content-security-policy:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ -n "$csp" ]]; then
        log_success "$description has Content-Security-Policy header"
        
        # Basic CSP validation
        if [[ "$csp" == *"default-src"* ]] || [[ "$csp" == *"script-src"* ]]; then
            log_success "$description CSP includes source directives"
        else
            log_warning "$description CSP may be incomplete (no default-src or script-src)"
        fi
    else
        log_warning "$description missing Content-Security-Policy header (recommended)"
    fi
    
    # Test 6: Referrer Policy
    local referrer_policy=$(grep -i "referrer-policy:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ -n "$referrer_policy" ]]; then
        log_success "$description has Referrer-Policy: $referrer_policy"
    else
        log_warning "$description missing Referrer-Policy header (recommended)"
    fi
    
    # Test 7: Cache-Control validation based on content type
    local cache_control=$(grep -i "cache-control:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    case "$expected_type" in
        "html")
            if [[ "$cache_control" == *"no-cache"* ]] || [[ "$cache_control" == *"max-age=0"* ]]; then
                log_success "$description has appropriate cache control for HTML"
            else
                log_warning "$description cache control for HTML: $cache_control"
            fi
            ;;
        "css"|"js")
            if [[ "$cache_control" == *"max-age=31536000"* ]] && [[ "$cache_control" == *"immutable"* ]]; then
                log_success "$description has long-term cache control for static assets"
            else
                log_warning "$description cache control for static assets: $cache_control"
            fi
            ;;
        "api")
            if [[ "$cache_control" == *"max-age=0"* ]] && [[ "$cache_control" == *"must-revalidate"* ]]; then
                log_success "$description has no-cache control for API"
            else
                log_warning "$description cache control for API: $cache_control"
            fi
            ;;
    esac
}

# Test HTTPS enforcement
test_https_enforcement() {
    log_info "Testing HTTPS enforcement"
    
    # Extract domain from VERCEL_URL
    local domain=$(echo "$VERCEL_URL" | sed 's|https://||' | sed 's|/.*||')
    
    # Test HTTP to HTTPS redirect (if supported by curl)
    local http_url="http://$domain"
    
    # Make HTTP request and check for redirect
    local redirect_response=$(curl -s -w "%{http_code}|%{redirect_url}" -o /dev/null "$http_url" 2>/dev/null || echo "000|")
    IFS='|' read -r http_code redirect_url <<< "$redirect_response"
    
    if [[ "$http_code" == "301" ]] || [[ "$http_code" == "302" ]] || [[ "$http_code" == "307" ]] || [[ "$http_code" == "308" ]]; then
        if [[ "$redirect_url" == https://* ]]; then
            log_success "HTTP to HTTPS redirect working (HTTP $http_code -> $redirect_url)"
        else
            log_warning "HTTP redirects but not to HTTPS (HTTP $http_code -> $redirect_url)"
        fi
    else
        log_warning "HTTP to HTTPS redirect test inconclusive (HTTP $http_code)"
    fi
    
    # Test that HTTPS is working
    local https_response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL")
    if [[ "$https_response" == "200" ]]; then
        log_success "HTTPS connection successful"
    else
        log_failure "HTTPS connection failed (HTTP $https_response)"
    fi
}

# Test TLS/SSL configuration
test_tls_configuration() {
    log_info "Testing TLS/SSL configuration"
    
    local domain=$(echo "$VERCEL_URL" | sed 's|https://||' | sed 's|/.*||')
    
    # Test TLS version support using openssl (if available)
    if command -v openssl &> /dev/null; then
        # Test TLS 1.2 support
        if openssl s_client -tls1_2 -connect "$domain:443" -servername "$domain" < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
            log_success "TLS 1.2 supported and certificate valid"
        else
            log_warning "TLS 1.2 test inconclusive or certificate issues"
        fi
        
        # Test deprecated protocols (should fail)
        if ! openssl s_client -ssl3 -connect "$domain:443" -servername "$domain" < /dev/null 2>/dev/null | grep -q "Protocol.*SSLv3"; then
            log_success "SSLv3 properly disabled"
        else
            log_failure "SSLv3 still supported (security risk)"
        fi
    else
        log_warning "OpenSSL not available - skipping TLS configuration tests"
    fi
}

# Test security-related HTTP methods
test_http_methods() {
    log_info "Testing HTTP methods security"
    
    # Test that dangerous methods are not allowed
    local dangerous_methods=("TRACE" "TRACK" "DEBUG" "DELETE")
    
    for method in "${dangerous_methods[@]}"; do
        local response=$(curl -s -w "%{http_code}" -X "$method" -o /dev/null "$VERCEL_URL")
        
        if [[ "$response" == "405" ]] || [[ "$response" == "501" ]]; then
            log_success "HTTP $method method properly rejected (HTTP $response)"
        elif [[ "$response" == "404" ]]; then
            log_success "HTTP $method method returns 404 (acceptable)"
        else
            log_warning "HTTP $method method returns HTTP $response (check if this is expected)"
        fi
    done
    
    # Test OPTIONS method (should be allowed for CORS)
    local options_response=$(curl -s -w "%{http_code}" -X OPTIONS -o /dev/null "$VERCEL_URL/api/health")
    if [[ "$options_response" == "200" ]]; then
        log_success "HTTP OPTIONS method allowed for CORS"
    else
        log_warning "HTTP OPTIONS method returns HTTP $options_response (may affect CORS)"
    fi
}

# Test for information disclosure
test_information_disclosure() {
    log_info "Testing for information disclosure"
    
    local headers_file="$TEMP_DIR/info_disclosure_headers"
    curl -s -D "$headers_file" -o /dev/null "$VERCEL_URL"
    
    # Check for server information disclosure
    local server_header=$(grep -i "server:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ -z "$server_header" ]]; then
        log_success "Server header not disclosed"
    else
        log_warning "Server header disclosed: $server_header"
    fi
    
    # Check for X-Powered-By header
    local powered_by=$(grep -i "x-powered-by:" "$headers_file" | sed 's/.*: //' | tr -d '\r\n')
    if [[ -z "$powered_by" ]]; then
        log_success "X-Powered-By header not disclosed"
    else
        log_warning "X-Powered-By header disclosed: $powered_by"
    fi
    
    # Check for version information in headers
    local version_headers=$(grep -iE "(version|x-.*-version|x-framework)" "$headers_file" | tr -d '\r\n')
    if [[ -z "$version_headers" ]]; then
        log_success "No version information disclosed in headers"
    else
        log_warning "Version information found in headers: $version_headers"
    fi
}

# Main test execution
main() {
    echo "========================================="
    echo "Security Headers Testing for Vercel Deployment"
    echo "URL: $VERCEL_URL"
    echo "Timestamp: $(date)"
    echo "========================================="
    echo
    
    # Test security headers for different content types
    test_security_headers "/" "Root HTML page" "html"
    echo
    
    test_security_headers "/styles.css" "CSS file" "css"
    echo
    
    test_security_headers "/app.js" "JavaScript file" "js"
    echo
    
    test_security_headers "/api/health" "API endpoint" "api"
    echo
    
    # Test HTTPS enforcement
    test_https_enforcement
    echo
    
    # Test TLS configuration
    test_tls_configuration
    echo
    
    # Test HTTP methods
    test_http_methods
    echo
    
    # Test information disclosure
    test_information_disclosure
    echo
    
    # Additional security tests
    log_info "Testing additional security measures"
    
    # Test for common security files
    local security_files=("/.well-known/security.txt" "/robots.txt" "/.env" "/config.json")
    for file in "${security_files[@]}"; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$VERCEL_URL$file")
        case "$file" in
            "/.well-known/security.txt")
                if [[ "$response" == "200" ]]; then
                    log_success "security.txt file present (good security practice)"
                else
                    log_warning "security.txt file not found (consider adding)"
                fi
                ;;
            "/robots.txt")
                if [[ "$response" == "200" ]]; then
                    log_success "robots.txt file present"
                else
                    log_warning "robots.txt file not found (consider adding)"
                fi
                ;;
            "/.env"|"/config.json")
                if [[ "$response" == "404" ]]; then
                    log_success "Sensitive file $file properly protected (404)"
                else
                    log_failure "Sensitive file $file accessible (HTTP $response) - SECURITY RISK"
                fi
                ;;
        esac
    done
    
    echo
    echo "========================================="
    echo "Security Test Summary"
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
    
    # Security recommendations
    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${YELLOW}Security Recommendations:${NC}"
        echo "1. Ensure all required security headers are configured in vercel.json"
        echo "2. Verify HSTS settings include preload and sufficient max-age"
        echo "3. Consider implementing Content-Security-Policy"
        echo "4. Check that sensitive files are not accessible"
        echo "5. Review server information disclosure"
        echo
    fi
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🛡️  All security tests passed!${NC}"
        cleanup
        exit 0
    else
        echo -e "${RED}⚠️  Some security tests failed. Review and fix security issues before production deployment.${NC}"
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

if ! command -v openssl &> /dev/null; then
    echo -e "${YELLOW}Warning: openssl is recommended for TLS testing but not installed${NC}"
fi

# Run tests
main