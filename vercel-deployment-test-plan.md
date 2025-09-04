# Vercel Deployment Testing Strategy

## Overview
Comprehensive testing strategy for verifying Vercel deployment of ESPN Fantasy Football Manager application with proper static asset serving, API functionality, and SPA routing.

## Testing Requirements Summary

### 1. Static Asset Verification
- CSS files served with correct content-type (`text/css`)
- JS files served with correct content-type (`application/javascript`)
- Assets served with proper caching headers (`Cache-Control: public, max-age=31536000, immutable`)
- Security headers applied (`X-Content-Type-Options: nosniff`)

### 2. API Endpoint Testing
- All API endpoints accessible under `/api/*` path
- API endpoints return JSON responses
- CORS headers properly configured
- API caching headers applied (`Cache-Control: public, max-age=0, must-revalidate`)

### 3. SPA Routing Verification
- All non-API routes serve the main `index.html` file
- Client-side routing works correctly
- Browser navigation (back/forward) functions properly

### 4. Security Headers Validation
- Security headers present on all responses
- HSTS (Strict-Transport-Security) enabled
- XSS protection enabled
- Frame options configured

### 5. Performance Testing
- Asset loading times within acceptable limits
- Compression/gzip enabled
- Cache effectiveness validation

## Test Environment Setup

Replace `YOUR_VERCEL_URL` with your actual Vercel deployment URL in all test scripts.

Example: `https://your-app-name.vercel.app`

## Expected Vercel Routes Configuration

Based on your `vercel.json`:
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api"
    },
    {
      "src": "/styles.css",
      "dest": "/public/styles.css"
    },
    {
      "src": "/app.js",
      "dest": "/public/app.js"
    },
    {
      "src": "/(.*)",
      "dest": "/public/index.html"
    }
  ]
}
```

## Test Execution Order

1. **Pre-deployment checks** - Verify configuration
2. **Static asset tests** - Ensure CSS/JS serving
3. **API endpoint tests** - Verify backend functionality
4. **SPA routing tests** - Confirm client-side routing
5. **Security validation** - Check headers and policies
6. **Performance tests** - Validate loading times
7. **Integration tests** - End-to-end functionality

## Success Criteria

### Static Assets
- ✅ CSS file accessible at `/styles.css`
- ✅ JS file accessible at `/app.js`
- ✅ Correct content-type headers
- ✅ Proper caching headers (1 year cache)

### API Endpoints
- ✅ Health check endpoint responds
- ✅ Leagues endpoint returns data or proper error
- ✅ CORS headers configured
- ✅ No-cache headers on API responses

### SPA Routing
- ✅ Root path serves index.html
- ✅ Any non-API path serves index.html
- ✅ Client-side routing functional

### Security
- ✅ HSTS header present
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection enabled
- ✅ X-Content-Type-Options: nosniff

## Failure Recovery

If any test fails:
1. Check Vercel deployment logs
2. Verify vercel.json configuration
3. Re-deploy if configuration changes needed
4. Execute rollback procedure if critical issues found

## Rollback Criteria

Execute rollback if:
- Static assets not served correctly
- API endpoints completely non-functional
- Security headers missing or misconfigured
- SPA routing broken (404s on refresh)

---

**Next Steps**: Execute test scripts in order and document results for each test category.