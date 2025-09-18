const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const RankingsAPI = require('./api/rankings');
const {
  validateConfig,
  sanitizeError,
  processRoster,
  buildESPNUrl,
  getCORSHeaders
} = require('./utils/rosterUtils');
const {
  validateRankingsQuery,
  validateCompareQuery,
  validateUploadBody,
  validateMatchBody,
  validateManualMatchBody
} = require('./middleware/validation');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://espn-fantasy-football-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

// Rate limiting middleware
app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests',
      details: 'Please wait before making another request'
    });
  }

  next();
});

// ====================
// ESPN API Routes
// ====================

app.get('/api/roster', async (req, res) => {
  try {
    // Get and validate environment variables
    const config = {
      SEASON_YEAR: process.env.SEASON_YEAR || new Date().getFullYear().toString(),
      LEAGUE_ID: process.env.LEAGUE1_ID,
      TEAM_ID: process.env.LEAGUE1_TEAM_ID,
      ESPN_S2: process.env.LEAGUE1_ESPN_S2,
      SWID: process.env.LEAGUE1_SWID
    };

    // Validate configuration
    try {
      validateConfig(config);
    } catch (validationError) {
      console.error('Config validation error:', validationError);
      return res.status(500).json({
        error: 'Configuration error',
        details: 'The server is not properly configured'
      });
    }

    // Build ESPN API URL
    const espnUrl = buildESPNUrl(config.SEASON_YEAR, config.LEAGUE_ID);

    // Import fetch dynamically (Node 18+)
    const fetch = (await import('node-fetch')).default;

    // Make request to ESPN API
    const response = await fetch(espnUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'ESPN-Fantasy-Dashboard/1.0',
        'Accept': 'application/json',
        'Cookie': `espn_s2=${config.ESPN_S2}; SWID=${config.SWID}`
      }
    });

    if (!response.ok) {
      const errorMessage = `ESPN API returned ${response.status}`;
      console.error('ESPN API error:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Find user's team
    const userTeam = data.teams?.find(team => team.id.toString() === config.TEAM_ID);

    if (!userTeam) {
      throw new Error('Team not found');
    }

    // Process roster using utility function
    const roster = processRoster(userTeam);

    // Build response
    const responseData = {
      success: true,
      team: {
        id: userTeam.id,
        name: userTeam.name || `${userTeam.location} ${userTeam.nickname}`.trim(),
        abbreviation: userTeam.abbrev,
        record: {
          wins: userTeam.record?.overall?.wins || 0,
          losses: userTeam.record?.overall?.losses || 0,
          ties: userTeam.record?.overall?.ties || 0,
          pointsFor: Math.round((userTeam.record?.overall?.pointsFor || 0) * 10) / 10,
          pointsAgainst: Math.round((userTeam.record?.overall?.pointsAgainst || 0) * 10) / 10
        },
        roster: roster
      },
      seasonYear: config.SEASON_YEAR,
      lastUpdated: new Date().toISOString()
    };

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching roster:', error.message);

    // Sanitize error message before sending to client
    const safeErrorMessage = sanitizeError(error);

    res.status(500).json({
      error: 'Failed to fetch roster',
      details: safeErrorMessage
    });
  }
});

// ====================
// Rankings API Routes
// ====================

// Upload rankings (with validation)
app.post('/api/rankings/upload', validateUploadBody, RankingsAPI.uploadRankings);

// Get rankings (with validation)
app.get('/api/rankings', validateRankingsQuery, RankingsAPI.getRankings);

// Get available rankings
app.get('/api/rankings/available', RankingsAPI.getAvailableRankings);

// Match players (with validation)
app.post('/api/rankings/match', validateMatchBody, RankingsAPI.matchPlayers);

// Manual match (with validation)
app.post('/api/rankings/match/manual', validateManualMatchBody, RankingsAPI.manualMatch);

// Compare rankings (with validation)
app.get('/api/rankings/compare', validateCompareQuery, RankingsAPI.compareRankings);

// Delete rankings (with validation)
app.delete('/api/rankings', validateRankingsQuery, RankingsAPI.deleteRankings);

// ====================
// Health Check
// ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ====================
// Error Handling
// ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 10MB.'
    });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ====================
// Start Server
// ====================

app.listen(PORT, () => {
  console.log(`
  ========================================
  ESPN Fantasy Football API Server
  ========================================
  Server running at: http://localhost:${PORT}

  Available endpoints:
  - GET  /api/roster                 - Get ESPN roster
  - POST /api/rankings/upload        - Upload rankings XLSX
  - GET  /api/rankings               - Get rankings
  - GET  /api/rankings/available     - List available rankings
  - POST /api/rankings/match         - Match players
  - POST /api/rankings/match/manual  - Manual player mapping
  - GET  /api/rankings/compare       - Compare rankings
  - DELETE /api/rankings             - Delete rankings
  - GET  /health                     - Health check

  Security features enabled:
  - CORS restrictions
  - Rate limiting (${MAX_REQUESTS_PER_WINDOW} requests per minute)
  - Input validation
  ========================================
  `);
});