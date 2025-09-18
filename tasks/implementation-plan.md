# Weekly Rankings XLSX Upload - Implementation Plan & Status

## Project Overview
A lightweight POC system for uploading and managing weekly fantasy football rankings from XLSX files. Designed for personal use (few minutes per week) with file-based storage instead of a database.

## Current Status: Phase 1 ✅ COMPLETE

### What's Been Built
- **XLSX Parser Service** (`services/xlsxParser.js`)
  - Multi-tab parsing (QB, RB, WR, TE, FLEX, DST, K)
  - Column normalization and validation
  - Team abbreviation mapping
  - Player name cleaning

- **Name Matching Service** (`services/nameMatch.js`)
  - Fuzzy matching using Fuse.js
  - Confidence scoring system
  - Manual mapping persistence
  - Atomic file operations for data integrity

- **Rankings API** (`api/rankings.js`)
  - Upload endpoint with file validation
  - CRUD operations for rankings
  - Player matching with ESPN rosters
  - Comparison between weeks

- **Express Server** (`server-express.js`)
  - Integrated with existing ESPN API
  - Input validation middleware
  - Rate limiting and CORS
  - Security hardening applied

- **Test Interface** (`public/upload-test.html`)
  - Drag-and-drop upload
  - Rankings viewer
  - Status tracking

### Security Fixes Applied
✅ Path traversal vulnerability fixed
✅ File upload security enhanced
✅ JSON parsing validation added
✅ Input validation middleware implemented
✅ Atomic file operations for data integrity

### How to Use
1. Start server: `node server-express.js`
2. Navigate to: http://localhost:3001/upload-test.html
3. Upload XLSX file with rankings
4. View at: http://localhost:3001/api/rankings?week=X&season=Y

### Test Data
- Generator: `node test-rankings-generator.js`
- Sample file: `data/uploads/test-rankings.xlsx`
- Stored rankings: `data/rankings/2024-week15.json`

---

## Phase 2: React Frontend (NOT STARTED)
**Estimated Time**: 2-3 hours

### Planned Components
- `client/src/components/FileUpload.jsx` - Drag-and-drop interface
- `client/src/components/RankingsTable.jsx` - Sortable/filterable table
- `client/src/components/NameResolver.jsx` - Manual name matching UI
- `client/src/components/WeekSelector.jsx` - Week/season navigation

### Implementation Notes
- Use react-dropzone for file upload
- Consider Material-UI or Ant Design for components
- State management with Context API or Redux
- Integration with existing Express API

---

## Phase 3: Optimization Features (NOT STARTED)
**Estimated Time**: 2-3 hours

### Lineup Optimizer
- Algorithm to fill roster slots by rank
- Handle FLEX position properly
- Filter OUT/Bye players
- Integrate with ESPN roster data

### Waiver Wire Analysis
- Compare free agents to bench players
- Rank differential scoring
- Add/drop recommendations
- Top 5-10 suggestions

### Services to Create
- `services/optimizer.js` - Lineup optimization logic
- `services/waiverAnalysis.js` - Waiver suggestions

---

## Phase 4: Future Enhancements (OPTIONAL)

### ROS (Rest of Season) Rankings
- Additional upload for season-long rankings
- Tie-breaking for lineup optimizer
- Enhanced waiver recommendations

### Advanced Features
- Projections integration
- Trade analyzer
- Schedule strength analysis
- Historical performance tracking

---

## Technical Details for Handoff

### File Structure
```
/ESPN-Fantasy-Football-API
├── api/
│   └── rankings.js          # Rankings API endpoints
├── services/
│   ├── xlsxParser.js        # XLSX file parsing
│   └── nameMatch.js         # Fuzzy name matching
├── middleware/
│   └── validation.js        # Input validation
├── data/
│   ├── rankings/            # JSON rankings storage
│   └── uploads/             # Temporary file uploads
├── public/
│   └── upload-test.html    # Test interface
└── server-express.js        # Main Express server
```

### API Endpoints
- `POST /api/rankings/upload` - Upload XLSX file
- `GET /api/rankings?week=X&season=Y&position=POS` - Get rankings
- `GET /api/rankings/available` - List available rankings
- `POST /api/rankings/match` - Match with ESPN roster
- `POST /api/rankings/match/manual` - Manual player mapping
- `GET /api/rankings/compare?weeks=1,2,3` - Compare multiple weeks
- `DELETE /api/rankings?week=X&season=Y` - Delete rankings

### Dependencies Added
```json
{
  "multer": "^2.0.2",      // File uploads
  "xlsx": "^0.18.5",       // XLSX parsing
  "fuse.js": "^7.1.0",     // Fuzzy matching
  "express": "^5.1.0",     // Web framework
  "cors": "^2.8.5",        // CORS support
  "body-parser": "^2.2.0"  // Request parsing
}
```

### Data Formats

#### Rankings JSON Structure
```json
{
  "week": 15,
  "season": 2024,
  "uploadedAt": "2024-01-15T10:00:00Z",
  "positions": {
    "QB": [
      {"rank": 1, "name": "Josh Allen", "team": "BUF", "tier": 1}
    ]
  },
  "metadata": {
    "totalPlayers": 35,
    "sheetsProcessed": ["QB", "RB", "WR"],
    "errors": [],
    "warnings": []
  }
}
```

#### Name Mappings JSON
```json
{
  "player_key": {
    "espnId": 123456,
    "espnName": "Official Name",
    "confidence": 0.95,
    "method": "fuzzy_match"
  }
}
```

### Environment Variables
Using `.env.local`:
- `LEAGUE1_ID` - ESPN League ID
- `LEAGUE1_TEAM_ID` - Your team ID
- `LEAGUE1_ESPN_S2` - ESPN auth cookie
- `LEAGUE1_SWID` - ESPN SWID cookie

### Testing Recommendations
1. **Unit Tests**: Parser functions, name matching algorithm
2. **Integration Tests**: Upload workflow, API endpoints
3. **Edge Cases**: Invalid files, special characters, duplicates
4. **Performance**: Large files (500+ players)

### Known Limitations
- No database (file-based storage)
- Single league support
- No real-time updates
- Manual XLSX upload only
- No automated ESPN sync

### Next Session Starting Points
1. **For Frontend**: Start with Phase 2, create React app
2. **For Optimization**: Jump to Phase 3, implement optimizer
3. **For Production**: Add database, user auth, multi-league support

### Git Repository
- Fork: https://github.com/reneramirezbu/ESPN-Fantasy-Football-API
- Latest commit: `9422d14` - Phase 1 complete with security fixes

### Support Files
- PRD: `tasks/PRD.md` - Original requirements
- Test generator: `test-rankings-generator.js`
- Sample XLSX: `data/uploads/test-rankings.xlsx`

---

## Quick Start for New Session
```bash
# Install dependencies (if needed)
npm install

# Start server
node server-express.js

# Generate test data
node test-rankings-generator.js

# Access UI
open http://localhost:3001/upload-test.html
```

## Contact & Notes
- This is a POC for personal use
- Optimized for weekly usage (few minutes)
- Security hardened but not production-scale
- File-based storage is intentional (no DB needed)