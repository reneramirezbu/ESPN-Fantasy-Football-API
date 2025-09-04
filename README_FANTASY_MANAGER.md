# Fantasy Football Manager

A comprehensive tool built on top of the ESPN Fantasy Football API to help you manage multiple fantasy football leagues with data-driven lineup optimization and waiver wire analysis.

## Features

- **Multi-League Management**: Manage multiple ESPN fantasy football leagues from one interface
- **Lineup Optimizer**: Get weekly lineup recommendations based on expert rankings
- **Waiver Wire Analysis**: Identify top waiver targets and get drop recommendations
- **Rankings Integration**: Upload and manage weekly and rest-of-season rankings
- **Web Interface**: Easy-to-use web dashboard for all features

## Prerequisites

- Node.js 16+ and npm 8+
- ESPN Fantasy Football account with at least one league
- ESPN authentication cookies (espn_s2 and SWID)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/reneramirezbu/ESPN-Fantasy-Football-API.git
cd ESPN-Fantasy-Football-API
```

2. Install dependencies:
```bash
npm install
```

3. Install additional dependencies for the web server:
```bash
npm install express dotenv
```

## Configuration

### Step 1: Get ESPN Authentication Cookies

1. Log into your ESPN Fantasy Football account
2. Open Chrome DevTools (F12)
3. Go to Application > Cookies > espn.com
4. Find and copy the values for:
   - `espn_s2`
   - `SWID`

### Step 2: Configure Your Leagues

Create a `.env` file in the root directory:

```env
# League 1
LEAGUE1_ID=YOUR_LEAGUE_ID
LEAGUE1_ESPN_S2=YOUR_ESPN_S2_COOKIE
LEAGUE1_SWID=YOUR_SWID_COOKIE
LEAGUE1_TEAM_NAME=Your Team Name

# League 2 (optional)
LEAGUE2_ID=YOUR_SECOND_LEAGUE_ID
LEAGUE2_ESPN_S2=YOUR_ESPN_S2_COOKIE
LEAGUE2_SWID=YOUR_SWID_COOKIE
LEAGUE2_TEAM_NAME=Your Team Name

# Season
SEASON_YEAR=2024
```

Alternatively, edit `config/leagues.json`:

```json
{
  "leagues": [
    {
      "name": "My Main League",
      "id": 123456,
      "espnS2": "your_espn_s2_cookie",
      "SWID": "your_swid_cookie",
      "teamName": "Your Team Name",
      "active": true
    }
  ],
  "season": 2024,
  "currentWeek": 1
}
```

## Usage

### Starting the Application

Run the main application:

```bash
node app.js
```

The web interface will be available at: http://localhost:3000

### Using the Web Interface

1. **Dashboard**: View all your leagues and their current standings
2. **Lineup Optimizer**: 
   - Select a league and week
   - Click "Optimize Lineup" to get recommendations
3. **Waiver Wire**:
   - Select a league and week
   - Click "Analyze Waiver Wire" for pickup/drop suggestions
4. **Rankings**:
   - Upload CSV or JSON rankings files
   - Choose between weekly and rest-of-season rankings

### Programmatic Usage

You can also use the modules programmatically:

```javascript
import FantasyFootballApp from './app.js';

const app = new FantasyFootballApp();
await app.initialize();

// Get lineup recommendations
const firstLeagueId = app.leagueManager.leagues[0].id;
const recommendations = await app.getLineupRecommendations(firstLeagueId, 1);

// Analyze waiver wire
const waiverAnalysis = await app.analyzeWaiverWire(firstLeagueId, 1);
```

## Rankings Format

### CSV Format
```csv
rank,name,position,team,points
1,Christian McCaffrey,RB,SF,24.5
2,Tyreek Hill,WR,MIA,22.3
3,Josh Allen,QB,BUF,21.8
```

### JSON Format
```json
[
  {
    "rank": 1,
    "name": "Christian McCaffrey",
    "position": "RB",
    "team": "SF",
    "points": 24.5
  }
]
```

## API Endpoints

The application provides the following API endpoints:

- `GET /api/leagues` - Get all configured leagues
- `GET /api/leagues/:id/lineup?week=1` - Get lineup recommendations
- `GET /api/leagues/:id/waiver?week=1` - Get waiver wire analysis
- `POST /api/rankings/upload` - Upload rankings data

## Project Structure

```
ESPN-Fantasy-Football-API/
├── src/
│   ├── my-leagues/         # League management
│   ├── rankings/           # Rankings management
│   ├── lineup-optimizer/   # Lineup optimization
│   └── waiver-analysis/    # Waiver wire analysis
├── web-client/             # Web interface
├── data/
│   └── rankings/          # Rankings storage
├── config/
│   └── leagues.json       # League configuration
├── app.js                 # Main application
└── .env                   # Environment variables
```

## Troubleshooting

### Authentication Issues
- Make sure your ESPN cookies are current (they expire)
- Ensure you're using the correct league ID
- Check that your team name matches exactly

### No Data Showing
- Verify your league is set to "active": true in config
- Check that the season year is correct
- Ensure the ESPN API is accessible

### Rankings Not Loading
- Verify the CSV/JSON format matches the examples
- Check that player names match ESPN's naming convention
- Ensure the rankings file is properly formatted

## Contributing

Feel free to submit issues and enhancement requests!

## Disclaimer

This tool is for personal use only. It relies on ESPN's API which may change without notice. Always make your own fantasy decisions!

## License

This project extends the ESPN Fantasy Football API and maintains its LGPL-3.0 license.