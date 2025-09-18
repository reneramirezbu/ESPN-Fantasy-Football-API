/**
 * Input validation middleware for API endpoints
 */

const VALID_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K'];
const MIN_SEASON = 2020;
const MAX_SEASON = 2030;
const MIN_WEEK = 1;
const MAX_WEEK = 18;

/**
 * Validate week and season query parameters
 */
const validateRankingsQuery = (req, res, next) => {
  const { week, season, position } = req.query;

  // Validate week if provided
  if (week !== undefined) {
    const weekNum = parseInt(week, 10);
    if (isNaN(weekNum) || weekNum < MIN_WEEK || weekNum > MAX_WEEK) {
      return res.status(400).json({
        success: false,
        error: `Invalid week: must be between ${MIN_WEEK} and ${MAX_WEEK}`
      });
    }
    req.query.week = weekNum; // Store parsed value
  }

  // Validate season if provided
  if (season !== undefined) {
    const seasonNum = parseInt(season, 10);
    if (isNaN(seasonNum) || seasonNum < MIN_SEASON || seasonNum > MAX_SEASON) {
      return res.status(400).json({
        success: false,
        error: `Invalid season: must be between ${MIN_SEASON} and ${MAX_SEASON}`
      });
    }
    req.query.season = seasonNum; // Store parsed value
  }

  // Validate position if provided
  if (position !== undefined) {
    const upperPosition = position.toUpperCase();
    if (!VALID_POSITIONS.includes(upperPosition)) {
      return res.status(400).json({
        success: false,
        error: `Invalid position: must be one of ${VALID_POSITIONS.join(', ')}`
      });
    }
    req.query.position = upperPosition; // Store normalized value
  }

  next();
};

/**
 * Validate compare rankings parameters
 */
const validateCompareQuery = (req, res, next) => {
  const { weeks, season } = req.query;

  // Weeks are required for comparison
  if (!weeks) {
    return res.status(400).json({
      success: false,
      error: 'Weeks parameter is required for comparison'
    });
  }

  // Parse and validate weeks array
  const weekArray = weeks.split(',').map(w => parseInt(w.trim(), 10));

  if (weekArray.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'At least 2 weeks are required for comparison'
    });
  }

  // Validate each week
  for (const week of weekArray) {
    if (isNaN(week) || week < MIN_WEEK || week > MAX_WEEK) {
      return res.status(400).json({
        success: false,
        error: `Invalid week ${week}: must be between ${MIN_WEEK} and ${MAX_WEEK}`
      });
    }
  }

  // Validate season if provided
  if (season !== undefined) {
    const seasonNum = parseInt(season, 10);
    if (isNaN(seasonNum) || seasonNum < MIN_SEASON || seasonNum > MAX_SEASON) {
      return res.status(400).json({
        success: false,
        error: `Invalid season: must be between ${MIN_SEASON} and ${MAX_SEASON}`
      });
    }
    req.query.season = seasonNum;
  }

  // Store parsed weeks
  req.query.weekArray = weekArray;

  next();
};

/**
 * Validate upload body parameters
 */
const validateUploadBody = (req, res, next) => {
  const { week, season } = req.body;

  // Validate week if provided
  if (week !== undefined) {
    const weekNum = parseInt(week, 10);
    if (isNaN(weekNum) || weekNum < MIN_WEEK || weekNum > MAX_WEEK) {
      return res.status(400).json({
        success: false,
        error: `Invalid week: must be between ${MIN_WEEK} and ${MAX_WEEK}`
      });
    }
    req.body.week = weekNum;
  }

  // Validate season if provided
  if (season !== undefined) {
    const seasonNum = parseInt(season, 10);
    if (isNaN(seasonNum) || seasonNum < MIN_SEASON || seasonNum > MAX_SEASON) {
      return res.status(400).json({
        success: false,
        error: `Invalid season: must be between ${MIN_SEASON} and ${MAX_SEASON}`
      });
    }
    req.body.season = seasonNum;
  }

  next();
};

/**
 * Validate match players request body
 */
const validateMatchBody = (req, res, next) => {
  const { rankings, espnRoster } = req.body;

  if (!rankings) {
    return res.status(400).json({
      success: false,
      error: 'Rankings data is required'
    });
  }

  if (!espnRoster) {
    return res.status(400).json({
      success: false,
      error: 'ESPN roster data is required'
    });
  }

  // Validate rankings structure
  if (!rankings.positions || typeof rankings.positions !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Rankings must have a positions object'
    });
  }

  // Validate ESPN roster is array
  if (!Array.isArray(espnRoster)) {
    return res.status(400).json({
      success: false,
      error: 'ESPN roster must be an array'
    });
  }

  next();
};

/**
 * Validate manual match request body
 */
const validateManualMatchBody = (req, res, next) => {
  const { rankingPlayer, espnId, espnName } = req.body;

  if (!rankingPlayer || typeof rankingPlayer !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'rankingPlayer object is required'
    });
  }

  if (!rankingPlayer.name) {
    return res.status(400).json({
      success: false,
      error: 'rankingPlayer.name is required'
    });
  }

  if (!espnId) {
    return res.status(400).json({
      success: false,
      error: 'espnId is required'
    });
  }

  if (!espnName) {
    return res.status(400).json({
      success: false,
      error: 'espnName is required'
    });
  }

  next();
};

module.exports = {
  validateRankingsQuery,
  validateCompareQuery,
  validateUploadBody,
  validateMatchBody,
  validateManualMatchBody,
  VALID_POSITIONS,
  MIN_SEASON,
  MAX_SEASON,
  MIN_WEEK,
  MAX_WEEK
};