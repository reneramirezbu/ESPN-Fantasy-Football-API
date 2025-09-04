# Vercel Deployment Testing Guide

## Quick Start

After deploying to Vercel, verify your deployment works correctly:

```bash
# 1. Set your Vercel deployment URL
export VERCEL_URL=https://your-actual-app.vercel.app

# 2. Run all tests at once
./run-all-tests.sh
```

That's it! The script will verify everything automatically and provide a comprehensive report.

## What Gets Tested

### 📄 Static Asset Verification (`test-static-assets.sh`)
- CSS file (`/styles.css`) served with correct content-type
- JavaScript file (`/app.js`) served with correct content-type
- Proper caching headers (1-year cache for static assets)
- Content validation (files contain expected code)
- Compression/gzip optimization
- Security headers (X-Content-Type-Options)

### 🔌 API Endpoint Testing (`test-api-endpoints.sh`)
- All API endpoints accessible (`/api`, `/api/health`, `/api/leagues`)
- JSON responses properly formatted
- CORS headers configured correctly
- Proper cache control (no-cache for API responses)
- Parameterized endpoint routing
- HTTP method validation (POST, OPTIONS)

### 🔄 SPA Routing Verification (`test-spa-routing.sh`)
- All non-API routes serve `index.html`
- Client-side routing components present
- Deep nested routes work (`/dashboard/league/123`)
- Query parameters preserved
- API routes excluded from SPA routing
- Static assets excluded from SPA routing

### 🛡️ Security Headers Validation (`test-security-headers.sh`)
- HSTS (Strict-Transport-Security) with preload
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- HTTPS enforcement
- Information disclosure prevention
- TLS configuration validation

## Individual Test Commands

Run specific test categories if needed:

```bash
# Test static assets only
./test-static-assets.sh

# Test API endpoints only  
./test-api-endpoints.sh

# Test SPA routing only
./test-spa-routing.sh

# Test security headers only
./test-security-headers.sh
```

## Expected Results

### ✅ All Tests Pass
When everything works correctly, you'll see:

```
🎉 ALL DEPLOYMENT TESTS PASSED!

✅ Your Vercel deployment is ready for production!

Deployment verified:
  ✅ Static assets (CSS/JS) served correctly
  ✅ API endpoints functional
  ✅ SPA routing working
  ✅ Security headers configured
```

### ❌ Some Tests Fail
When issues are detected:

```
❌ SOME DEPLOYMENT TESTS FAILED

⚠️  Your deployment has issues that need to be addressed.

Next steps:
  1. Review failed test outputs above
  2. Fix configuration issues
  3. Redeploy and test again
  4. Consider rollback if issues are critical
```

## Common Issues and Fixes

### Static Assets Return 404
**Problem**: CSS/JS files not accessible
**Fix**: Check `vercel.json` routes configuration:
```json
{
  "src": "/styles.css",
  "dest": "/public/styles.css"
},
{
  "src": "/app.js",
  "dest": "/public/app.js"
}
```

### API Endpoints Return HTML Instead of JSON
**Problem**: API routes caught by SPA catch-all
**Fix**: Ensure API routes come BEFORE catch-all in `vercel.json`:
```json
{
  "src": "/api/(.*)",
  "dest": "/api"
},
// ... static asset routes ...
{
  "src": "/(.*)",
  "dest": "/public/index.html"
}
```

### SPA Routing Returns 404 on Refresh
**Problem**: No catch-all route for client-side routing
**Fix**: Add catch-all route as LAST route:
```json
{
  "src": "/(.*)",
  "dest": "/public/index.html"
}
```

### CORS Errors in Browser
**Problem**: Missing CORS headers
**Fix**: Add CORS headers to API routes:
```json
{
  "source": "/api/(.*)",
  "headers": [
    {
      "key": "Access-Control-Allow-Origin",
      "value": "*"
    }
  ]
}
```

### Security Headers Missing
**Problem**: Security headers not applied
**Fix**: Add headers section to `vercel.json`:
```json
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "X-Frame-Options",
      "value": "DENY"
    }
  ]
}
```

## Rollback Procedure

If critical issues are detected, use the rollback procedure:

```bash
# Quick rollback using Vercel CLI
vercel rollback

# See detailed instructions
cat rollback-procedure.md
```

## File Structure

After running the setup, you'll have these files:

```
├── vercel-deployment-test-plan.md     # Overall strategy document
├── test-static-assets.sh              # Static asset tests
├── test-api-endpoints.sh               # API endpoint tests  
├── test-spa-routing.sh                 # SPA routing tests
├── test-security-headers.sh            # Security header tests
├── run-all-tests.sh                    # Master test runner
├── rollback-procedure.md               # Emergency rollback guide
└── DEPLOYMENT-TESTING-GUIDE.md         # This guide
```

## Advanced Usage

### Custom URL Testing
Test a specific deployment preview:
```bash
export VERCEL_URL=https://preview-abc123.vercel.app
./run-all-tests.sh
```

### CI/CD Integration
Add to your deployment pipeline:
```yaml
# GitHub Actions example
- name: Test Deployment
  run: |
    export VERCEL_URL=${{ steps.deploy.outputs.url }}
    ./run-all-tests.sh
```

### Automated Monitoring
Set up periodic testing:
```bash
# Add to crontab for hourly checks
0 * * * * cd /path/to/project && export VERCEL_URL=https://your-app.vercel.app && ./run-all-tests.sh >> deployment-test.log 2>&1
```

## Troubleshooting

### Tests Can't Connect
```bash
# Check if URL is accessible
curl -I https://your-app.vercel.app

# Check DNS resolution
nslookup your-app.vercel.app

# Test with verbose output
curl -v https://your-app.vercel.app
```

### Script Permission Errors
```bash
# Make all scripts executable
chmod +x *.sh

# Or individually:
chmod +x run-all-tests.sh
chmod +x test-static-assets.sh
chmod +x test-api-endpoints.sh
chmod +x test-spa-routing.sh
chmod +x test-security-headers.sh
```

### Missing Dependencies
```bash
# Install required tools
# On Ubuntu/Debian:
sudo apt-get update
sudo apt-get install curl jq bc openssl

# On macOS:
brew install curl jq bc openssl

# On Red Hat/CentOS:
sudo yum install curl jq bc openssl
```

## Best Practices

### Before Each Deployment
1. Test locally first
2. Use preview deployments
3. Run test suite on preview
4. Only promote to production after tests pass

### After Each Deployment
1. Run full test suite immediately
2. Monitor for 30 minutes
3. Check error logs
4. Verify user-facing functionality

### Regular Maintenance
- Run tests weekly even without deployments
- Update test scripts when adding new features
- Review and update security requirements
- Test rollback procedure monthly

## Support

If you encounter issues with the testing scripts or need help interpreting results:

1. Check the detailed error messages in individual test outputs
2. Review the `vercel.json` configuration against working examples
3. Consult Vercel documentation for specific error codes
4. Test configuration changes on preview deployments first

---

**Remember**: These tests verify technical functionality. Always perform manual user acceptance testing for business logic and user experience validation.