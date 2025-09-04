# Vercel Deployment Rollback Procedure

## Overview
This document outlines the complete rollback procedure for reverting a Vercel deployment when testing reveals critical issues with static asset serving, API functionality, or SPA routing.

## Rollback Triggers

Execute rollback immediately if any of the following critical issues are detected:

### 🔴 Critical Issues (Immediate Rollback Required)
1. **Static Assets Fail to Load**
   - CSS or JS files return 404 or wrong content-type
   - Assets served with incorrect routing configuration
   - Critical styling or functionality broken

2. **API Endpoints Completely Non-functional**
   - All API endpoints returning 500/502 errors
   - CORS completely broken preventing frontend-API communication
   - Database connectivity completely lost

3. **SPA Routing Broken**
   - All non-root routes returning 404 instead of index.html
   - Client-side routing completely non-functional
   - Users unable to navigate or refresh pages

4. **Security Issues**
   - Missing critical security headers (HSTS, X-Frame-Options)
   - Sensitive files (.env, config) exposed publicly
   - HTTPS not working or redirects broken

### 🟡 Warning Issues (Monitor but May Not Require Rollback)
- Slow API response times (>5 seconds)
- Missing optional headers (CSP, Referrer-Policy)
- Individual API endpoints returning expected errors (503, 400)
- Performance issues with asset loading

## Rollback Methods

### Method 1: Vercel CLI Rollback (Fastest)
```bash
# 1. Install Vercel CLI if not already installed
npm i -g vercel

# 2. Login to Vercel (if not already logged in)
vercel login

# 3. Navigate to your project directory
cd /home/rene/projects/FFRankings/ESPN-Fantasy-Football-API

# 4. List recent deployments
vercel list

# 5. Rollback to previous deployment
vercel rollback [DEPLOYMENT_URL_OR_ID]

# 6. Verify rollback success
vercel list
```

**Expected Time**: 2-5 minutes

### Method 2: Vercel Dashboard Rollback
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project: `ESPN-Fantasy-Football-API`
3. Click on the **"Deployments"** tab
4. Find the last known good deployment
5. Click the **"⋯"** menu next to it
6. Select **"Promote to Production"**
7. Confirm the rollback action

**Expected Time**: 3-7 minutes

### Method 3: Git Revert + Redeploy (Most Thorough)
```bash
# 1. Identify the problematic commit
git log --oneline -10

# 2. Revert to last known good commit
git revert [PROBLEMATIC_COMMIT_HASH]

# 3. Push revert to trigger new deployment
git push origin main

# 4. Monitor Vercel deployment
vercel list --scope your-team-name
```

**Expected Time**: 5-15 minutes

### Method 4: Configuration-Only Rollback
If the issue is only in `vercel.json`:

```bash
# 1. Backup current vercel.json
cp vercel.json vercel.json.backup

# 2. Restore from git history or known good config
git checkout HEAD~1 -- vercel.json

# 3. Deploy the fix
git add vercel.json
git commit -m "Rollback vercel.json configuration

🔧 Reverted to previous working routing configuration

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

## Post-Rollback Verification

After executing rollback, run verification tests:

### 1. Quick Health Check
```bash
# Set your deployment URL
export VERCEL_URL=https://your-app-name.vercel.app

# Quick smoke test
curl -s "$VERCEL_URL" | grep -q "Fantasy Football Manager" && echo "✅ Main page OK" || echo "❌ Main page FAIL"
curl -s "$VERCEL_URL/api/health" | grep -q "healthy" && echo "✅ API OK" || echo "❌ API FAIL"
curl -s "$VERCEL_URL/styles.css" | head -c 100 | grep -q "body" && echo "✅ CSS OK" || echo "❌ CSS FAIL"
```

### 2. Run Full Test Suite
```bash
# Run all tests to confirm rollback success
./test-static-assets.sh
./test-api-endpoints.sh
./test-spa-routing.sh
./test-security-headers.sh
```

### 3. Manual Verification Checklist
- [ ] Homepage loads correctly
- [ ] Navigation works (Dashboard, Lineup, Waiver, Rankings)
- [ ] CSS styling applied correctly
- [ ] JavaScript functionality working
- [ ] API endpoints responding
- [ ] Browser refresh works on sub-routes
- [ ] HTTPS certificate valid
- [ ] No console errors in browser dev tools

## Known Good Configuration

### Last Working vercel.json Template
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 512
    }
  },
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
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        },
        {
          "key": "Access-Control-Allow-Origin", 
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type"
        }
      ]
    },
    {
      "source": "/(.*\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection", 
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

## Emergency Contacts and Resources

### Vercel Resources
- **Vercel Status**: https://vercel.com/status
- **Vercel Documentation**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/contact

### Project Resources
- **Repository**: https://github.com/your-username/ESPN-Fantasy-Football-API
- **Deployment URL**: https://your-app-name.vercel.app
- **Vercel Project**: https://vercel.com/your-team/espn-fantasy-football-api

## Rollback Decision Matrix

| Issue Type | Severity | Action | Timeframe |
|------------|----------|--------|-----------|
| Static assets 404 | Critical | Immediate rollback | < 5 min |
| API all endpoints down | Critical | Immediate rollback | < 5 min |  
| SPA routing broken | Critical | Immediate rollback | < 5 min |
| Security headers missing | High | Rollback within 1 hour | < 1 hour |
| Single API endpoint error | Medium | Monitor, rollback if worsens | 4-24 hours |
| Performance degradation | Low | Investigate, rollback if severe | 24-48 hours |

## Incident Response Log Template

When executing rollback, document:

```
INCIDENT: [Date/Time]
ISSUE: [Brief description]
SEVERITY: [Critical/High/Medium/Low]
TRIGGER: [What test/monitoring detected it]
ROLLBACK METHOD: [CLI/Dashboard/Git/Config]
ROLLBACK TIME: [Start - End]
VERIFICATION: [Tests run post-rollback]
STATUS: [Success/Partial/Failed]
NEXT STEPS: [Investigation/fixes needed]
```

## Prevention Strategies

To minimize future rollbacks:

1. **Always test locally first**
   ```bash
   # Test static files serving
   npx serve public
   
   # Test API endpoints  
   npm run dev
   ```

2. **Use staging deployments**
   ```bash
   # Deploy to preview branch first
   vercel --prod=false
   ```

3. **Run test suite before production**
   ```bash
   export VERCEL_URL=https://preview-url.vercel.app
   ./test-static-assets.sh && ./test-api-endpoints.sh && ./test-spa-routing.sh
   ```

4. **Monitor after deployment**
   - Set up Vercel Analytics
   - Monitor error rates in first 30 minutes
   - Run automated tests every 15 minutes for first 2 hours

5. **Maintain rollback readiness**
   - Keep CLI tools updated
   - Test rollback procedure monthly
   - Document all configuration changes

---

**Remember**: When in doubt, rollback first, investigate later. User experience is the priority.