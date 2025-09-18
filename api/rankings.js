const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSXParser = require('../services/xlsxParser');
const NameMatcher = require('../services/nameMatch');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();

    // Only allow specific extensions
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(new Error('Invalid file extension. Only .xlsx, .xls, and .csv files are allowed'));
    }

    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 50); // Limit length to prevent overly long filenames

    cb(null, `rankings_${timestamp}_${baseName}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept XLSX and CSV files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only XLSX and CSV files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize services
const xlsxParser = new XLSXParser();
const nameMatcher = new NameMatcher();

/**
 * Rankings API endpoints
 */
class RankingsAPI {
  /**
   * POST /api/rankings/upload
   * Upload and process rankings file
   */
  static uploadRankings = [
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No file uploaded'
          });
        }

        // Extract parameters
        const week = parseInt(req.body.week) || parseInt(req.query.week) || xlsxParser.getCurrentWeek();
        const season = parseInt(req.body.season) || parseInt(req.query.season) || new Date().getFullYear();

        console.log(`Processing rankings file: ${req.file.filename} for Week ${week}, Season ${season}`);

        // Parse the XLSX file
        const rankings = xlsxParser.parseRankingsFile(req.file.path, week, season);

        // Save rankings to JSON
        const saveResult = xlsxParser.saveRankings(rankings);

        // Get match statistics (if ESPN roster is available)
        let matchStats = null;
        if (req.body.espnRoster) {
          try {
            const espnRoster = JSON.parse(req.body.espnRoster);

            // Validate that it's an array
            if (!Array.isArray(espnRoster)) {
              console.warn('ESPN roster must be an array, skipping match statistics');
            } else {
              matchStats = nameMatcher.getMatchStatistics(rankings, espnRoster);

              // Update ESPN players database
              nameMatcher.updateESPNPlayersFromRoster(espnRoster);
            }
          } catch (error) {
            console.error('Error processing ESPN roster - invalid JSON:', error.message);
            // Continue without roster matching - not critical for upload success
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          data: {
            week,
            season,
            filename: saveResult.filename,
            totalPlayers: saveResult.totalPlayers,
            sheetsProcessed: rankings.metadata.sheetsProcessed,
            errors: rankings.metadata.errors,
            warnings: rankings.metadata.warnings,
            matchStatistics: matchStats
          }
        });
      } catch (error) {
        console.error('Error uploading rankings:', error);

        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
          success: false,
          error: error.message || 'Failed to process rankings file'
        });
      }
    }
  ];

  /**
   * GET /api/rankings
   * Get rankings for a specific week
   */
  static getRankings = async (req, res) => {
    try {
      const week = parseInt(req.query.week) || xlsxParser.getCurrentWeek();
      const season = parseInt(req.query.season) || new Date().getFullYear();
      const position = req.query.position?.toUpperCase();

      // Load rankings from file
      const rankings = xlsxParser.loadRankings(week, season);

      if (!rankings) {
        return res.status(404).json({
          success: false,
          error: `No rankings found for Week ${week}, Season ${season}`
        });
      }

      // Filter by position if specified
      let responseData = rankings;
      if (position && rankings.positions[position]) {
        responseData = {
          ...rankings,
          positions: {
            [position]: rankings.positions[position]
          }
        };
      } else if (position) {
        return res.status(404).json({
          success: false,
          error: `No rankings found for position ${position}`
        });
      }

      res.json({
        success: true,
        data: responseData
      });
    } catch (error) {
      console.error('Error fetching rankings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch rankings'
      });
    }
  };

  /**
   * GET /api/rankings/available
   * Get list of available rankings
   */
  static getAvailableRankings = async (req, res) => {
    try {
      const available = xlsxParser.getAvailableRankings();

      res.json({
        success: true,
        data: available
      });
    } catch (error) {
      console.error('Error fetching available rankings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch available rankings'
      });
    }
  };

  /**
   * POST /api/rankings/match
   * Match rankings players with ESPN roster
   */
  static matchPlayers = async (req, res) => {
    try {
      const { rankings, espnRoster } = req.body;

      if (!rankings || !espnRoster) {
        return res.status(400).json({
          success: false,
          error: 'Both rankings and espnRoster are required'
        });
      }

      // Update ESPN players database
      nameMatcher.updateESPNPlayersFromRoster(espnRoster);

      // Get match results for all players
      const matches = {};
      const unmatched = [];

      Object.entries(rankings.positions).forEach(([position, players]) => {
        matches[position] = [];

        players.forEach(player => {
          const match = nameMatcher.matchPlayer(player, espnRoster);

          if (match.matched && match.confidence >= 0.8) {
            matches[position].push({
              ...player,
              espnId: match.espnId,
              espnName: match.espnName,
              confidence: match.confidence,
              method: match.method
            });
          } else {
            unmatched.push({
              ...player,
              position,
              candidates: match.candidates || []
            });
          }
        });
      });

      // Get statistics
      const stats = nameMatcher.getMatchStatistics(rankings, espnRoster);

      res.json({
        success: true,
        data: {
          matches,
          unmatched,
          statistics: stats
        }
      });
    } catch (error) {
      console.error('Error matching players:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to match players'
      });
    }
  };

  /**
   * POST /api/rankings/match/manual
   * Manually map a player
   */
  static manualMatch = async (req, res) => {
    try {
      const { rankingPlayer, espnId, espnName } = req.body;

      if (!rankingPlayer || !espnId || !espnName) {
        return res.status(400).json({
          success: false,
          error: 'rankingPlayer, espnId, and espnName are required'
        });
      }

      const result = nameMatcher.manuallyMapPlayer(rankingPlayer, espnId, espnName);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error manual matching:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save manual match'
      });
    }
  };

  /**
   * GET /api/rankings/compare
   * Compare rankings between weeks or positions
   */
  static compareRankings = async (req, res) => {
    try {
      const weeks = req.query.weeks ? req.query.weeks.split(',').map(w => parseInt(w)) : [];
      const season = parseInt(req.query.season) || new Date().getFullYear();
      const position = req.query.position?.toUpperCase();

      if (weeks.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 weeks are required for comparison'
        });
      }

      const comparisons = {};

      // Load rankings for each week
      for (const week of weeks) {
        const rankings = xlsxParser.loadRankings(week, season);
        if (rankings) {
          comparisons[`week${week}`] = position
            ? rankings.positions[position] || []
            : rankings.positions;
        }
      }

      res.json({
        success: true,
        data: {
          season,
          weeks,
          position: position || 'ALL',
          comparisons
        }
      });
    } catch (error) {
      console.error('Error comparing rankings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to compare rankings'
      });
    }
  };

  /**
   * DELETE /api/rankings
   * Delete rankings for a specific week
   */
  static deleteRankings = async (req, res) => {
    try {
      const week = parseInt(req.query.week);
      const season = parseInt(req.query.season) || new Date().getFullYear();

      if (!week) {
        return res.status(400).json({
          success: false,
          error: 'Week parameter is required'
        });
      }

      const filename = `${season}-week${week}.json`;
      const filepath = path.join(__dirname, '..', 'data', 'rankings', filename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({
          success: false,
          error: `No rankings found for Week ${week}, Season ${season}`
        });
      }

      fs.unlinkSync(filepath);

      res.json({
        success: true,
        message: `Rankings for Week ${week}, Season ${season} deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting rankings:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete rankings'
      });
    }
  };
}

module.exports = RankingsAPI;