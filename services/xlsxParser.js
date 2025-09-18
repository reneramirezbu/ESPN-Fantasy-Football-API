const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Position tabs we expect in the XLSX file
const POSITION_TABS = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K'];

// Column mappings (case-insensitive)
const REQUIRED_COLUMNS = ['player', 'team', 'pos', 'rank'];
const OPTIONAL_COLUMNS = ['week', 'tier', 'notes'];

class XLSXParser {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Parse an XLSX file and extract rankings data
   * @param {string} filePath - Path to the uploaded XLSX file
   * @param {number} week - Week number (if not in file)
   * @param {number} season - Season year
   * @returns {Object} Parsed rankings data
   */
  parseRankingsFile(filePath, week, season) {
    try {
      this.errors = [];
      this.warnings = [];

      // Read the workbook
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      // Check for expected position tabs
      const foundPositions = sheetNames.filter(name =>
        POSITION_TABS.includes(name.toUpperCase())
      );

      if (foundPositions.length === 0) {
        throw new Error(`No valid position tabs found. Expected: ${POSITION_TABS.join(', ')}`);
      }

      const rankings = {
        week: week || this.getCurrentWeek(),
        season: season || new Date().getFullYear(),
        uploadedAt: new Date().toISOString(),
        positions: {},
        metadata: {
          totalPlayers: 0,
          sheetsProcessed: [],
          errors: [],
          warnings: []
        }
      };

      // Process each position sheet
      for (const sheetName of foundPositions) {
        const sheet = workbook.Sheets[sheetName];
        const position = sheetName.toUpperCase();

        const players = this.parseSheet(sheet, position);
        rankings.positions[position] = players;
        rankings.metadata.totalPlayers += players.length;
        rankings.metadata.sheetsProcessed.push(position);
      }

      // Add any errors/warnings to metadata
      rankings.metadata.errors = this.errors;
      rankings.metadata.warnings = this.warnings;

      return rankings;
    } catch (error) {
      console.error('Error parsing XLSX file:', error);
      throw error;
    }
  }

  /**
   * Parse a single sheet and extract player data
   */
  parseSheet(sheet, positionName) {
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: null
    });

    const players = [];
    const normalizedHeaders = this.getNormalizedHeaders(jsonData[0]);

    jsonData.forEach((row, index) => {
      try {
        const player = this.extractPlayerData(row, normalizedHeaders, positionName);
        if (player) {
          players.push(player);
        }
      } catch (error) {
        this.warnings.push(`Row ${index + 2} in ${positionName} sheet: ${error.message}`);
      }
    });

    // Sort by rank
    players.sort((a, b) => a.rank - b.rank);

    return players;
  }

  /**
   * Get normalized column headers
   */
  getNormalizedHeaders(firstRow) {
    if (!firstRow) return {};

    const headers = {};
    Object.keys(firstRow).forEach(key => {
      const normalizedKey = key.toLowerCase().trim();

      // Map variations to standard names
      if (normalizedKey.includes('player') || normalizedKey.includes('name')) {
        headers.player = key;
      } else if (normalizedKey.includes('team') && !normalizedKey.includes('bye')) {
        headers.team = key;
      } else if (normalizedKey === 'pos' || normalizedKey.includes('position')) {
        headers.pos = key;
      } else if (normalizedKey.includes('rank') && !normalizedKey.includes('tier')) {
        headers.rank = key;
      } else if (normalizedKey.includes('tier')) {
        headers.tier = key;
      } else if (normalizedKey.includes('week')) {
        headers.week = key;
      } else if (normalizedKey.includes('note') || normalizedKey.includes('comment')) {
        headers.notes = key;
      }
    });

    return headers;
  }

  /**
   * Extract player data from a row
   */
  extractPlayerData(row, headers, expectedPosition) {
    if (!headers.player || !row[headers.player]) {
      return null; // Skip empty rows
    }

    const playerName = this.cleanPlayerName(row[headers.player]);
    const team = headers.team ? this.normalizeTeam(row[headers.team]) : null;
    const position = headers.pos ? row[headers.pos] : expectedPosition;
    const rank = headers.rank ? parseInt(row[headers.rank], 10) : null;

    // Validate required fields
    if (!playerName || !rank || isNaN(rank)) {
      throw new Error(`Missing required fields: player="${playerName}", rank="${rank}"`);
    }

    const playerData = {
      name: playerName,
      team: team,
      pos: position,
      rank: rank
    };

    // Add optional fields if present
    if (headers.tier && row[headers.tier]) {
      playerData.tier = row[headers.tier];
    }
    if (headers.notes && row[headers.notes]) {
      playerData.notes = row[headers.notes];
    }

    return playerData;
  }

  /**
   * Clean and normalize player name
   */
  cleanPlayerName(name) {
    if (!name) return null;

    return name
      .toString()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-'\.]/g, '') // Keep letters, numbers, spaces, hyphens, apostrophes, periods
      .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, ''); // Remove suffixes
  }

  /**
   * Normalize team abbreviation
   */
  normalizeTeam(team) {
    if (!team) return 'FA';

    const cleaned = team.toString().toUpperCase().trim();

    // Handle special cases
    const teamMappings = {
      'JAC': 'JAX',
      'JAGS': 'JAX',
      'WASHINGTON': 'WAS',
      'ARIZONA': 'ARI',
      'ATLANTA': 'ATL',
      'BALTIMORE': 'BAL',
      'BUFFALO': 'BUF',
      'CAROLINA': 'CAR',
      'CHICAGO': 'CHI',
      'CINCINNATI': 'CIN',
      'CLEVELAND': 'CLE',
      'DALLAS': 'DAL',
      'DENVER': 'DEN',
      'DETROIT': 'DET',
      'GREEN BAY': 'GB',
      'HOUSTON': 'HOU',
      'INDIANAPOLIS': 'IND',
      'KANSAS CITY': 'KC',
      'LAS VEGAS': 'LV',
      'LA CHARGERS': 'LAC',
      'LA RAMS': 'LAR',
      'MIAMI': 'MIA',
      'MINNESOTA': 'MIN',
      'NEW ENGLAND': 'NE',
      'NEW ORLEANS': 'NO',
      'NY GIANTS': 'NYG',
      'NY JETS': 'NYJ',
      'PHILADELPHIA': 'PHI',
      'PITTSBURGH': 'PIT',
      'SAN FRANCISCO': 'SF',
      '49ERS': 'SF',
      'SEATTLE': 'SEA',
      'TAMPA BAY': 'TB',
      'TENNESSEE': 'TEN'
    };

    // Check if it's a full team name
    for (const [fullName, abbr] of Object.entries(teamMappings)) {
      if (cleaned.includes(fullName)) {
        return abbr;
      }
    }

    // Return the cleaned abbreviation if it's 2-4 characters
    if (cleaned.length >= 2 && cleaned.length <= 4) {
      return teamMappings[cleaned] || cleaned;
    }

    return 'FA'; // Free Agent
  }

  /**
   * Get current NFL week (rough approximation)
   */
  getCurrentWeek() {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // Sept 1st

    if (now < seasonStart) {
      return 1; // Preseason/early season
    }

    const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 18); // NFL weeks 1-18
  }

  /**
   * Save rankings to JSON file
   */
  saveRankings(rankings) {
    // Validate and sanitize inputs to prevent path traversal
    const sanitizedSeason = parseInt(rankings.season, 10);
    const sanitizedWeek = parseInt(rankings.week, 10);

    if (!sanitizedSeason || sanitizedSeason < 2020 || sanitizedSeason > 2030) {
      throw new Error('Invalid season year: must be between 2020 and 2030');
    }
    if (!sanitizedWeek || sanitizedWeek < 1 || sanitizedWeek > 18) {
      throw new Error('Invalid week number: must be between 1 and 18');
    }

    const filename = `${sanitizedSeason}-week${sanitizedWeek}.json`;
    const filepath = path.join(__dirname, '..', 'data', 'rankings', filename);

    fs.writeFileSync(filepath, JSON.stringify(rankings, null, 2));

    return {
      filepath,
      filename,
      totalPlayers: rankings.metadata.totalPlayers
    };
  }

  /**
   * Load rankings from JSON file
   */
  loadRankings(week, season) {
    // Validate inputs to prevent path traversal
    const sanitizedSeason = parseInt(season, 10);
    const sanitizedWeek = parseInt(week, 10);

    if (!sanitizedSeason || sanitizedSeason < 2020 || sanitizedSeason > 2030) {
      throw new Error('Invalid season year: must be between 2020 and 2030');
    }
    if (!sanitizedWeek || sanitizedWeek < 1 || sanitizedWeek > 18) {
      throw new Error('Invalid week number: must be between 1 and 18');
    }

    const filename = `${sanitizedSeason}-week${sanitizedWeek}.json`;
    const filepath = path.join(__dirname, '..', 'data', 'rankings', filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Get all available rankings files
   */
  getAvailableRankings() {
    const rankingsDir = path.join(__dirname, '..', 'data', 'rankings');

    if (!fs.existsSync(rankingsDir)) {
      return [];
    }

    const files = fs.readdirSync(rankingsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const match = file.match(/(\d{4})-week(\d+)\.json/);
        if (match) {
          return {
            season: parseInt(match[1], 10),
            week: parseInt(match[2], 10),
            filename: file
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.season !== b.season) return b.season - a.season;
        return b.week - a.week;
      });

    return files;
  }
}

module.exports = XLSXParser;