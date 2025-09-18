# ESPN Fantasy Football Dashboard

## Overview
This dashboard displays your ESPN Fantasy Football roster with real-time data fetched directly from ESPN's API.

## Features
- ✅ Real-time roster data from ESPN Fantasy Football
- ✅ Team statistics (Win/Loss record, Points For/Against)
- ✅ Player lineup with positions, NFL teams, and injury status
- ✅ Projected and actual points for each player
- ✅ Responsive design that works on mobile and desktop
- ✅ Auto-refresh capability

## Setup

### Environment Variables
The application uses the following environment variables (already configured in your Vercel deployment):

- `SEASON_YEAR`: Current season year (e.g., 2025)
- `LEAGUE1_ID`: Your ESPN league ID
- `LEAGUE1_TEAM_ID`: Your team ID within the league
- `LEAGUE1_ESPN_S2`: ESPN authentication cookie
- `LEAGUE1_SWID`: ESPN user identifier

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
node server.js
```

3. Open your browser to http://localhost:3001

### Production Deployment (Vercel)

The application is already deployed at: https://espn-fantasy-football-api.vercel.app

To deploy updates:
```bash
git add .
git commit -m "Update dashboard"
git push
```

Vercel will automatically deploy the changes.

## File Structure

```
ESPN-Fantasy-Football-API/
├── api/
│   └── roster.js          # Vercel serverless function for fetching roster
├── public/
│   └── index.html        # Dashboard UI
├── server.js             # Local development server
├── .env.local           # Local environment variables
└── vercel.json          # Vercel configuration
```

## API Endpoint

### GET /api/roster
Fetches the current roster for your fantasy team.

**Response Format:**
```json
{
  "success": true,
  "team": {
    "id": 5,
    "name": "Team Name",
    "record": {
      "wins": 1,
      "losses": 1,
      "pointsFor": 272.4,
      "pointsAgainst": 274.7
    },
    "roster": [
      {
        "fullName": "Player Name",
        "position": "RB",
        "proTeam": "BUF",
        "lineupSlot": "RB",
        "injuryStatus": "ACTIVE",
        "projectedPoints": 15.5,
        "actualPoints": 22.3
      }
    ]
  }
}
```

## Troubleshooting

### "Unable to connect to server" error
- Check that your ESPN credentials in environment variables are valid
- Verify your league ID and team ID are correct
- Ensure you're logged into ESPN Fantasy in your browser

### Local development issues
- Make sure Node.js is installed (v16 or higher)
- Verify `.env.local` file exists with correct variables
- Check that port 3001 is not already in use

## Future Enhancements
- Add player statistics and trends
- Implement lineup optimization suggestions
- Add waiver wire recommendations
- Support for multiple leagues
- Historical performance tracking