const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  validateConfig,
  sanitizeError,
  processRoster,
  buildESPNUrl,
  getCORSHeaders
} = require('./utils/rosterUtils');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const PORT = 3001;

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];

  // Clean old requests
  const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Get client IP for rate limiting
  const clientIp = req.connection.remoteAddress || 'unknown';

  // Apply CORS headers
  const corsHeaders = getCORSHeaders(req.headers.origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve API endpoint
  if (url.pathname === '/api/roster' && req.method === 'GET') {
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Too many requests',
        details: 'Please wait before making another request'
      }));
      return;
    }

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
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Configuration error',
          details: 'The server is not properly configured'
        }));
        return;
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));

    } catch (error) {
      console.error('Error fetching roster:', error.message);

      // Sanitize error message before sending to client
      const safeErrorMessage = sanitizeError(error);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to fetch roster',
        details: safeErrorMessage
      }));
    }
    return;
  }

  // Serve HTML file
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
    return;
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/roster`);
  console.log('Security features enabled: CORS restrictions, rate limiting, input validation');
});