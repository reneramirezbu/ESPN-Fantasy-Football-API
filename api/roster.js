const {
  validateConfig,
  sanitizeError,
  processRoster,
  buildESPNUrl,
  getCORSHeaders
} = require('../utils/rosterUtils');

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

export default async function handler(req, res) {
  // Get client IP for rate limiting
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      error: 'Too many requests',
      details: 'Please wait before making another request'
    });
    return;
  }

  // Apply CORS headers
  const corsHeaders = getCORSHeaders(req.headers.origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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
      return res.status(500).json({
        error: 'Configuration error',
        details: 'The server is not properly configured'
      });
    }

    // Build ESPN API URL
    const url = buildESPNUrl(config.SEASON_YEAR, config.LEAGUE_ID);

    // Make request to ESPN API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ESPN-Fantasy-Dashboard/1.0',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `espn_s2=${config.ESPN_S2}; SWID=${config.SWID}`,
        'Referer': 'https://fantasy.espn.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
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
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching roster:', error.message);

    // Sanitize error message before sending to client
    const safeErrorMessage = sanitizeError(error);

    res.status(500).json({
      error: 'Failed to fetch roster',
      details: safeErrorMessage
    });
  }
}