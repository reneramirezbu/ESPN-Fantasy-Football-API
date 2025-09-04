# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of the ESPN Fantasy Football API that has been extended with a comprehensive fantasy football management system. The project has two main components:

1. **ESPN API Wrapper** (original) - JavaScript client for ESPN's v3 fantasy football API
2. **Fantasy Manager Extensions** (new) - Multi-league management, lineup optimization, and waiver analysis tools

## Key Commands

### Development
```bash
# Install dependencies
npm install

# Run the fantasy manager application (web server on port 3000)
node app.js

# Run example usage scripts
node example-usage.js

# Run tests
npm test

# Run integration tests (requires ESPN credentials)
npm run test:integration

# Lint JavaScript files
npm run lint:js

# Build webpack bundles (for npm package)
npm run build
```

### Testing Individual Components
```bash
# Test a specific test file
jest path/to/test.js

# Test with coverage
jest --coverage

# Run tests in watch mode
jest --watch
```

## Architecture Overview

### Core ESPN API Structure
The original ESPN API wrapper uses ES6 classes with inheritance:
- `BaseCacheableObject` → Base class for all ESPN data models
- `Client` → Main entry point, handles ESPN API authentication and requests
- Model classes (`Team`, `Player`, `Boxscore`, etc.) → ESPN data representations

Key patterns:
- Uses `axios` for HTTP requests with ESPN cookies for private leagues
- Implements caching via `BaseCacheableObject` 
- Data mapping via static `responseMap` objects in each model class
- Supports both browser (`web.js`) and Node.js (`node.js`) via webpack builds

### Fantasy Manager Extensions

The new fantasy manager system adds four main modules in `src/`:

1. **LeagueManager** (`src/my-leagues/`)
   - Manages multiple ESPN leagues simultaneously
   - Handles roster retrieval and free agent queries
   - Maintains cache for teams, rosters, and free agents

2. **RankingsManager** (`src/rankings/`)
   - Loads weekly and rest-of-season rankings from CSV/JSON
   - Normalizes player names for matching
   - Handles file I/O (uses `/tmp` on Vercel)

3. **LineupOptimizer** (`src/lineup-optimizer/`)
   - Generates optimal lineups based on rankings
   - Handles FLEX position logic
   - Provides confidence scores and change recommendations

4. **WaiverAnalyzer** (`src/waiver-analysis/`)
   - Analyzes free agents against rankings
   - Identifies drop candidates
   - Provides FAAB bid recommendations

### Application Entry Points

- `app.js` - Main Express server for local development
- `api/index.js` - Vercel serverless function endpoint
- `web-client/` - Static frontend (copied to `public/` for Vercel)
- `example-usage.js` - Demonstrates programmatic API usage

## ESPN Authentication

Private leagues require two cookies from ESPN:
- `espn_s2` - Session cookie
- `SWID` - User identifier

These are passed to the `Client` constructor and must be obtained manually from browser DevTools.

## Configuration

Leagues can be configured via:
1. Environment variables (`.env` file) - preferred for credentials
2. `config/leagues.json` - for non-sensitive configuration

Example `.env`:
```
LEAGUE1_ID=123456
LEAGUE1_ESPN_S2=<cookie_value>
LEAGUE1_SWID=<cookie_value>
```

## Deployment Notes

### Vercel Deployment
- Uses serverless functions (`api/index.js`)
- Static files served from `public/` directory
- File storage uses `/tmp` directory (ephemeral)
- Requires environment variables set in Vercel dashboard

### Local Development
- Full Express server with file system access
- Rankings persist in `data/rankings/` directory
- Supports multiple concurrent leagues

## ESPN API Limitations

- ESPN may delete historical data without notice
- API changes can break functionality (last major change: v2 to v3 in 2019)
- Private league support only works in Node.js (not browsers)
- Some data unavailable before 2018 season
- Rate limiting may apply to rapid requests

## Module Dependencies

The fantasy manager modules depend on each other:
- `LineupOptimizer` and `WaiverAnalyzer` require both `LeagueManager` and `RankingsManager`
- `LeagueManager` uses the original `Client` class for ESPN API calls
- All modules use lodash for data manipulation

## Error Handling Patterns

- ESPN API errors bubble up through promise chains
- File I/O errors are caught and logged (especially important for Vercel)
- Missing rankings data defaults to rank 999
- Cache misses trigger fresh API calls