import fs from 'fs';
import path from 'path';
import _ from 'lodash';

/**
 * Manages player rankings from various sources for lineup optimization
 * and waiver wire analysis
 */
class RankingsManager {
  constructor(options = {}) {
    this.rankingsDir = options.rankingsDir || path.join(process.cwd(), 'data', 'rankings');
    this.currentWeek = options.currentWeek || 1;
    this.season = options.season || new Date().getFullYear();
    
    // Cache for loaded rankings
    this.weeklyRankings = {};
    this.restOfSeasonRankings = null;
    this.dynastyRankings = null;
    
    // Ensure rankings directory exists
    if (!fs.existsSync(this.rankingsDir)) {
      fs.mkdirSync(this.rankingsDir, { recursive: true });
    }
  }
  
  /**
   * Load weekly rankings from a CSV or JSON file
   * @param {number} week - NFL week number
   * @param {string} filePath - Path to rankings file
   * @returns {Promise<Array>} Array of ranked players
   */
  async loadWeeklyRankings(week, filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.rankingsDir, filePath);
      
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const rankings = this.parseRankingsFile(fileContent, path.extname(fullPath));
      
      this.weeklyRankings[week] = rankings;
      return rankings;
    } catch (error) {
      console.error(`Error loading weekly rankings for week ${week}:`, error);
      throw error;
    }
  }
  
  /**
   * Load rest of season rankings
   * @param {string} filePath - Path to rankings file
   * @returns {Promise<Array>} Array of ranked players
   */
  async loadRestOfSeasonRankings(filePath) {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.rankingsDir, filePath);
      
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      this.restOfSeasonRankings = this.parseRankingsFile(
        fileContent, 
        path.extname(fullPath)
      );
      
      return this.restOfSeasonRankings;
    } catch (error) {
      console.error('Error loading rest of season rankings:', error);
      throw error;
    }
  }
  
  /**
   * Parse rankings file based on extension
   * @param {string} content - File content
   * @param {string} extension - File extension (.csv or .json)
   * @returns {Array} Parsed rankings
   */
  parseRankingsFile(content, extension) {
    if (extension === '.json') {
      return JSON.parse(content);
    } else if (extension === '.csv') {
      return this.parseCSV(content);
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }
  }
  
  /**
   * Parse CSV rankings file
   * Expected format: Rank,Player Name,Team,Position,Points
   * @param {string} content - CSV content
   * @returns {Array} Parsed rankings
   */
  parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const player = {};
      
      headers.forEach((header, index) => {
        const value = values[index];
        if (header === 'rank' || header === 'points' || header === 'projectedpoints') {
          player[header] = parseFloat(value) || 0;
        } else {
          player[header] = value;
        }
      });
      
      // Normalize player name for matching
      if (player.player || player.playername || player.name) {
        player.normalizedName = this.normalizePlayerName(
          player.player || player.playername || player.name
        );
      }
      
      return player;
    });
  }
  
  /**
   * Normalize player name for matching with ESPN data
   * @param {string} name - Player name
   * @returns {string} Normalized name
   */
  normalizePlayerName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/jr$|sr$|ii$|iii$|iv$/, '');
  }
  
  /**
   * Get weekly rankings for a specific week
   * @param {number} week - NFL week number
   * @returns {Array} Weekly rankings
   */
  getWeeklyRankings(week) {
    return this.weeklyRankings[week] || [];
  }
  
  /**
   * Get rest of season rankings
   * @returns {Array} ROS rankings
   */
  getRestOfSeasonRankings() {
    return this.restOfSeasonRankings || [];
  }
  
  /**
   * Find player ranking by name
   * @param {string} playerName - Player name to search
   * @param {string} rankingType - 'weekly', 'ros', or 'dynasty'
   * @param {number} week - Week number (for weekly rankings)
   * @returns {Object|null} Player ranking object
   */
  findPlayerRanking(playerName, rankingType = 'weekly', week = null) {
    const normalized = this.normalizePlayerName(playerName);
    let rankings;
    
    switch (rankingType) {
      case 'weekly':
        rankings = this.weeklyRankings[week || this.currentWeek] || [];
        break;
      case 'ros':
        rankings = this.restOfSeasonRankings || [];
        break;
      case 'dynasty':
        rankings = this.dynastyRankings || [];
        break;
      default:
        return null;
    }
    
    return rankings.find(player => 
      player.normalizedName === normalized ||
      (player.name && this.normalizePlayerName(player.name) === normalized)
    );
  }
  
  /**
   * Get top players by position
   * @param {string} position - Position (QB, RB, WR, TE, etc.)
   * @param {number} count - Number of players to return
   * @param {string} rankingType - Type of rankings to use
   * @param {number} week - Week number (for weekly rankings)
   * @returns {Array} Top players at position
   */
  getTopPlayersByPosition(position, count = 10, rankingType = 'weekly', week = null) {
    let rankings;
    
    switch (rankingType) {
      case 'weekly':
        rankings = this.weeklyRankings[week || this.currentWeek] || [];
        break;
      case 'ros':
        rankings = this.restOfSeasonRankings || [];
        break;
      default:
        rankings = [];
    }
    
    return rankings
      .filter(player => player.position === position.toUpperCase())
      .slice(0, count);
  }
  
  /**
   * Compare two players based on rankings
   * @param {string} player1Name - First player name
   * @param {string} player2Name - Second player name
   * @param {string} rankingType - Type of rankings to use
   * @param {number} week - Week number (for weekly rankings)
   * @returns {Object} Comparison result
   */
  comparePlayers(player1Name, player2Name, rankingType = 'weekly', week = null) {
    const player1 = this.findPlayerRanking(player1Name, rankingType, week);
    const player2 = this.findPlayerRanking(player2Name, rankingType, week);
    
    if (!player1 || !player2) {
      return {
        error: 'One or both players not found in rankings',
        player1Found: !!player1,
        player2Found: !!player2
      };
    }
    
    return {
      player1: player1,
      player2: player2,
      recommendation: player1.rank < player2.rank ? player1Name : player2Name,
      rankDifference: Math.abs(player1.rank - player2.rank),
      pointsDifference: Math.abs(
        (player1.points || player1.projectedpoints || 0) - 
        (player2.points || player2.projectedpoints || 0)
      )
    };
  }
  
  /**
   * Save rankings to file
   * @param {Array} rankings - Rankings to save
   * @param {string} fileName - File name to save to
   * @param {string} format - Format to save in ('json' or 'csv')
   */
  saveRankings(rankings, fileName, format = 'json') {
    const fullPath = path.join(this.rankingsDir, fileName);
    
    if (format === 'json') {
      fs.writeFileSync(fullPath, JSON.stringify(rankings, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(rankings);
      fs.writeFileSync(fullPath, csv);
    }
  }
  
  /**
   * Convert rankings to CSV format
   * @param {Array} rankings - Rankings array
   * @returns {string} CSV string
   */
  convertToCSV(rankings) {
    if (!rankings || rankings.length === 0) return '';
    
    const headers = Object.keys(rankings[0]).filter(key => key !== 'normalizedName');
    const csvLines = [headers.join(',')];
    
    rankings.forEach(player => {
      const values = headers.map(header => {
        const value = player[header];
        // Escape commas in string values
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      });
      csvLines.push(values.join(','));
    });
    
    return csvLines.join('\n');
  }
}

export default RankingsManager;