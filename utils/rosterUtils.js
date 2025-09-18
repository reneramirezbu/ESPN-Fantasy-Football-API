// ESPN Team ID to abbreviation mapping
const TEAM_MAP = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE',
  6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN',
  11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ',
  21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF',
  26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX',
  33: 'BAL', 34: 'HOU'
};

// Position ID to abbreviation mapping
const POSITION_MAP = {
  1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
};

// Lineup slot ID to name mapping
const SLOT_MAP = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K',
  20: 'BENCH', 21: 'IR', 23: 'FLEX'
};

// Stat source IDs
const STAT_SOURCES = {
  ACTUAL: 0,
  PROJECTED: 1
};

// Validate environment configuration
function validateConfig(config) {
  const errors = [];

  if (!config.LEAGUE_ID || !/^\d+$/.test(config.LEAGUE_ID)) {
    errors.push('Invalid LEAGUE_ID format - must be numeric');
  }

  if (!config.TEAM_ID || !/^\d+$/.test(config.TEAM_ID)) {
    errors.push('Invalid TEAM_ID format - must be numeric');
  }

  if (!config.ESPN_S2 || config.ESPN_S2.length < 10) {
    errors.push('Invalid ESPN_S2 format');
  }

  if (!config.SWID || !config.SWID.startsWith('{') || !config.SWID.endsWith('}')) {
    errors.push('Invalid SWID format - must be wrapped in curly braces');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }

  return true;
}

// Sanitize error messages for client response
function sanitizeError(error) {
  // Map known errors to safe messages
  const errorMap = {
    'fetch failed': 'Unable to connect to ESPN API',
    'ESPN API returned 401': 'Authentication failed - please check your credentials',
    'ESPN API returned 403': 'Access denied - please verify your permissions',
    'ESPN API returned 404': 'League or team not found',
    'ESPN API returned 500': 'ESPN service error - please try again later',
    'Configuration validation failed': 'Invalid configuration',
    'Team not found': 'Your team was not found in this league'
  };

  // Check if error message contains any known patterns
  for (const [pattern, safeMessage] of Object.entries(errorMap)) {
    if (error.message?.includes(pattern)) {
      return safeMessage;
    }
  }

  // Return generic error for unknown errors
  return 'An unexpected error occurred while fetching roster data';
}

// Process roster data from ESPN API response
function processRoster(userTeam) {
  if (!userTeam || !userTeam.roster?.entries) {
    return [];
  }

  return userTeam.roster.entries.map(entry => {
    const player = entry.playerPoolEntry?.player || {};

    // Extract stats
    let projectedPoints = 0;
    let actualPoints = 0;

    if (player.stats && Array.isArray(player.stats)) {
      player.stats.forEach(stat => {
        if (stat.statSourceId === STAT_SOURCES.PROJECTED) {
          projectedPoints = stat.appliedTotal || 0;
        } else if (stat.statSourceId === STAT_SOURCES.ACTUAL) {
          actualPoints = stat.appliedTotal || 0;
        }
      });
    }

    return {
      id: player.id,
      fullName: player.fullName || 'Unknown',
      position: POSITION_MAP[player.defaultPositionId] || 'UNK',
      proTeam: TEAM_MAP[player.proTeamId] || 'FA',
      lineupSlot: SLOT_MAP[entry.lineupSlotId] || `SLOT${entry.lineupSlotId}`,
      injuryStatus: player.injuryStatus || null,
      projectedPoints: Math.round(projectedPoints * 10) / 10,
      actualPoints: Math.round(actualPoints * 10) / 10
    };
  });
}

// Build ESPN API URL
function buildESPNUrl(seasonYear, leagueId) {
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonYear}/segments/0/leagues/${leagueId}?view=mRoster&view=mTeam`;
}

// Check CORS origin
function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

// Get CORS headers for response
function getCORSHeaders(requestOrigin) {
  const allowedOrigins = [
    'https://espn-fantasy-football-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  const headers = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Accept'
  };

  if (isAllowedOrigin(requestOrigin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

module.exports = {
  TEAM_MAP,
  POSITION_MAP,
  SLOT_MAP,
  STAT_SOURCES,
  validateConfig,
  sanitizeError,
  processRoster,
  buildESPNUrl,
  getCORSHeaders
};