#!/bin/bash

# Master Test Script for Vercel Deployment Verification
# Runs all deployment tests in proper sequence

# Configuration
VERCEL_URL="${VERCEL_URL:-https://your-app-name.vercel.app}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test results tracking
OVERALL_PASSED=0
OVERALL_FAILED=0

# Logging functions
log_header() {
    echo
    echo -e "${BOLD}=========================================${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BOLD}=========================================${NC}"
    echo
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_failure() {
    echo -e "${RED}[FAILURE]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Run a test script and capture results
run_test_script() {
    local script_name="$1"
    local description="$2"
    
    log_header "Running $description"
    
    if [[ ! -f "$script_name" ]]; then
        log_failure "Test script $script_name not found"
        ((OVERALL_FAILED++))
        return 1
    fi
    
    if [[ ! -x "$script_name" ]]; then
        log_failure "Test script $script_name is not executable"
        ((OVERALL_FAILED++))
        return 1
    fi
    
    # Run the test script
    if ./"$script_name"; then
        log_success "$description completed successfully"
        ((OVERALL_PASSED++))
        return 0
    else
        log_failure "$description failed"
        ((OVERALL_FAILED++))
        return 1
    fi
}

# Pre-flight checks
pre_flight_checks() {
    log_header "Pre-flight Checks"
    
    # Check if URL is set
    if [[ "$VERCEL_URL" == *"your-app-name"* ]]; then
        log_failure "VERCEL_URL not set. Please export your Vercel URL:"
        echo "Example: export VERCEL_URL=https://your-actual-app.vercel.app"
        exit 1
    fi
    
    log_info "Testing basic connectivity to $VERCEL_URL"
    
    # Basic connectivity test
    if curl -s --connect-timeout 10 --max-time 30 -f "$VERCEL_URL" >/dev/null; then
        log_success "Basic connectivity test passed"
    else
        log_failure "Cannot connect to $VERCEL_URL"
        log_info "Please check:"
        echo "  1. URL is correct and accessible"
        echo "  2. Deployment completed successfully" 
        echo "  3. No network connectivity issues"
        exit 1
    fi
    
    # Check required dependencies
    local deps=("curl" "grep" "sed")
    local optional_deps=("jq" "bc" "openssl")
    
    log_info "Checking required dependencies"
    for dep in "${deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            log_success "$dep found"
        else
            log_failure "$dep not found (required)"
            exit 1
        fi
    done
    
    log_info "Checking optional dependencies"
    for dep in "${optional_deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            log_success "$dep found"
        else
            log_warning "$dep not found (optional, some tests may be limited)"
        fi
    done
}

# Generate summary report
generate_summary() {
    log_header "Test Execution Summary"
    
    local total_test_suites=$((OVERALL_PASSED + OVERALL_FAILED))
    
    echo -e "Deployment URL: ${BLUE}$VERCEL_URL${NC}"
    echo -e "Test Execution Time: $(date)"
    echo -e "Total Test Suites: $total_test_suites"
    echo -e "${GREEN}Passed Test Suites: $OVERALL_PASSED${NC}"
    echo -e "${RED}Failed Test Suites: $OVERALL_FAILED${NC}"
    
    if [[ $OVERALL_FAILED -eq 0 ]]; then
        echo
        log_success "🎉 ALL DEPLOYMENT TESTS PASSED!"
        echo
        echo -e "${GREEN}✅ Your Vercel deployment is ready for production!${NC}"
        echo
        echo "Deployment verified:"
        echo "  ✅ Static assets (CSS/JS) served correctly"
        echo "  ✅ API endpoints functional"
        echo "  ✅ SPA routing working"
        echo "  ✅ Security headers configured"
        echo
    else
        echo
        log_failure "❌ SOME DEPLOYMENT TESTS FAILED"
        echo
        echo -e "${RED}⚠️  Your deployment has issues that need to be addressed.${NC}"
        echo
        echo "Next steps:"
        echo "  1. Review failed test outputs above"
        echo "  2. Fix configuration issues"
        echo "  3. Redeploy and test again"
        echo "  4. Consider rollback if issues are critical"
        echo
        echo "For rollback instructions, see:"
        echo "  📋 ./rollback-procedure.md"
        echo
    fi
}

# Main execution
main() {
    # Script header
    echo -e "${BOLD}Vercel Deployment Testing Suite${NC}"
    echo "URL: $VERCEL_URL"
    echo "Started: $(date)"
    echo
    
    # Pre-flight checks
    pre_flight_checks
    
    # Run test suites in order
    local test_suites=(
        "test-static-assets.sh:Static Asset Verification"
        "test-api-endpoints.sh:API Endpoint Testing"
        "test-spa-routing.sh:SPA Routing Verification"
        "test-security-headers.sh:Security Headers Validation"
    )
    
    for suite in "${test_suites[@]}"; do
        IFS=':' read -r script_name description <<< "$suite"
        
        if ! run_test_script "$script_name" "$description"; then
            # Test failed, but continue with remaining tests for complete picture
            log_warning "Continuing with remaining tests to get complete assessment"
        fi
        
        # Brief pause between test suites
        sleep 2
    done
    
    # Generate final summary
    generate_summary
    
    # Exit with appropriate code
    if [[ $OVERALL_FAILED -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script interruption
cleanup() {
    echo
    log_warning "Test execution interrupted"
    exit 130
}

trap cleanup SIGINT SIGTERM

# Validate execution context
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    main "$@"
else
    # Script is being sourced
    log_info "Script sourced, functions available for individual use"
fi