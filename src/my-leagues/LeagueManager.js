import Client from '../client/client.js';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';

/**
 * Manages multiple fantasy football leagues and provides
 * consolidated roster and team management functionality
 */
class LeagueManager {
  constructor(options = {}) {
    this.leagues = [];
    this.clients = {};
    this.season = options.season || new Date().getFullYear();
    this.currentWeek = options.currentWeek || 1;
    this.configPath = options.configPath || path.join(process.cwd(), 'config', 'leagues.json');
    
    // Cache for team and roster data
    this.teamsCache = {};
    this.rostersCache = {};
    this.freeAgentsCache = {};
  }
  
  /**
   * Load league configurations from file or options
   * @param {Array} leagueConfigs - Array of league configuration objects
   */
  loadLeagues(leagueConfigs) {
    if (!leagueConfigs && fs.existsSync(this.configPath)) {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      leagueConfigs = config.leagues;
      this.season = config.season || this.season;
      this.currentWeek = config.currentWeek || this.currentWeek;
    }
    
    if (!leagueConfigs || !Array.isArray(leagueConfigs)) {
      throw new Error('No league configurations provided');
    }
    
    leagueConfigs.forEach(config => {
      if (config.active && config.id) {
        this.addLeague(config);
      }
    });
  }
  
  /**
   * Add a league to the manager
   * @param {Object} leagueConfig - League configuration
   * @param {number} leagueConfig.id - ESPN league ID
   * @param {string} leagueConfig.name - League name
   * @param {string} leagueConfig.espnS2 - ESPN S2 cookie
   * @param {string} leagueConfig.SWID - ESPN SWID cookie
   * @param {string} leagueConfig.teamName - Your team name in this league
   */
  addLeague(leagueConfig) {
    const client = new Client({
      leagueId: leagueConfig.id,
      espnS2: leagueConfig.espnS2,
      SWID: leagueConfig.SWID
    });
    
    this.leagues.push({
      ...leagueConfig,
      client: client
    });
    
    this.clients[leagueConfig.id] = client;
  }
  
  /**
   * Get all teams for a specific league
   * @param {number} leagueId - League ID
   * @param {number} scoringPeriodId - Scoring period (NFL week)
   * @returns {Promise<Array>} Array of team objects
   */
  async getTeams(leagueId, scoringPeriodId = null) {
    const period = scoringPeriodId || this.currentWeek;
    const cacheKey = `${leagueId}-${period}`;
    
    // Check cache first
    if (this.teamsCache[cacheKey]) {
      return this.teamsCache[cacheKey];
    }
    
    const client = this.clients[leagueId];
    if (!client) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    try {
      const teams = await client.getTeamsAtWeek({
        seasonId: this.season,
        scoringPeriodId: period
      });
      
      this.teamsCache[cacheKey] = teams;
      return teams;
    } catch (error) {
      console.error(`Error fetching teams for league ${leagueId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get your team's roster for a specific league
   * @param {number} leagueId - League ID
   * @param {string} teamName - Your team name (optional)
   * @param {number} scoringPeriodId - Scoring period
   * @returns {Promise<Object>} Your team with roster
   */
  async getMyRoster(leagueId, teamName = null, scoringPeriodId = null) {
    const period = scoringPeriodId || this.currentWeek;
    const teams = await this.getTeams(leagueId, period);
    
    // Find your team
    const league = this.leagues.find(l => l.id === leagueId);
    const searchName = teamName || league?.teamName;
    
    if (!searchName) {
      // If no team name specified, return the first team (assume it's yours)
      return teams[0];
    }
    
    const myTeam = teams.find(team => 
      team.name?.toLowerCase() === searchName.toLowerCase() ||
      team.ownerName?.toLowerCase() === searchName.toLowerCase()
    );
    
    if (!myTeam) {
      throw new Error(`Team "${searchName}" not found in league ${leagueId}`);
    }
    
    return myTeam;
  }
  
  /**
   * Get all rosters across all active leagues
   * @param {number} scoringPeriodId - Scoring period
   * @returns {Promise<Object>} Object with league IDs as keys and rosters as values
   */
  async getAllRosters(scoringPeriodId = null) {
    const period = scoringPeriodId || this.currentWeek;
    const rosters = {};
    
    await Promise.all(
      this.leagues.map(async league => {
        try {
          const roster = await this.getMyRoster(league.id, league.teamName, period);
          rosters[league.id] = {
            leagueName: league.name,
            team: roster
          };
        } catch (error) {
          console.error(`Error fetching roster for league ${league.name}:`, error);
        }
      })
    );
    
    return rosters;
  }
  
  /**
   * Get free agents for a league
   * @param {number} leagueId - League ID
   * @param {number} scoringPeriodId - Scoring period
   * @returns {Promise<Array>} Array of free agent players
   */
  async getFreeAgents(leagueId, scoringPeriodId = null) {
    const period = scoringPeriodId || this.currentWeek;
    const cacheKey = `${leagueId}-${period}`;
    
    // Check cache first
    if (this.freeAgentsCache[cacheKey]) {
      return this.freeAgentsCache[cacheKey];
    }
    
    const client = this.clients[leagueId];
    if (!client) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    try {
      const freeAgents = await client.getFreeAgents({
        seasonId: this.season,
        scoringPeriodId: period
      });
      
      this.freeAgentsCache[cacheKey] = freeAgents;
      return freeAgents;
    } catch (error) {
      console.error(`Error fetching free agents for league ${leagueId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get player by name from roster or free agents
   * @param {string} playerName - Player name to search
   * @param {number} leagueId - League ID
   * @returns {Promise<Object|null>} Player object or null
   */
  async findPlayer(playerName, leagueId) {
    const normalizedSearch = playerName.toLowerCase();
    
    // First check rosters
    const teams = await this.getTeams(leagueId);
    for (const team of teams) {
      if (team.roster && Array.isArray(team.roster)) {
        const player = team.roster.find(p => 
          p.fullName?.toLowerCase() === normalizedSearch ||
          `${p.firstName} ${p.lastName}`.toLowerCase() === normalizedSearch
        );
        if (player) {
          return { ...player, status: 'rostered', team: team.name };
        }
      }
    }
    
    // Then check free agents
    const freeAgents = await this.getFreeAgents(leagueId);
    const freeAgent = freeAgents.find(p => 
      p.fullName?.toLowerCase() === normalizedSearch ||
      `${p.firstName} ${p.lastName}`.toLowerCase() === normalizedSearch
    );
    
    if (freeAgent) {
      return { ...freeAgent, status: 'free_agent' };
    }
    
    return null;
  }
  
  /**
   * Get players on bye week
   * @param {number} week - NFL week
   * @param {number} leagueId - League ID
   * @returns {Promise<Array>} Players on bye
   */
  async getByeWeekPlayers(week, leagueId) {
    const roster = await this.getMyRoster(leagueId);
    
    if (!roster || !roster.roster) {
      return [];
    }
    
    // Filter players on bye
    // Note: You'll need to implement bye week detection based on ESPN data structure
    return roster.roster.filter(player => {
      // This is a placeholder - actual implementation depends on ESPN data
      return player.byeWeek === week;
    });
  }
  
  /**
   * Get injured players from roster
   * @param {number} leagueId - League ID
   * @returns {Promise<Array>} Injured players
   */
  async getInjuredPlayers(leagueId) {
    const roster = await this.getMyRoster(leagueId);
    
    if (!roster || !roster.roster) {
      return [];
    }
    
    // Filter injured players
    return roster.roster.filter(player => {
      return player.injuryStatus && 
             player.injuryStatus !== 'ACTIVE' && 
             player.injuryStatus !== 'NORMAL';
    });
  }
  
  /**
   * Get lineup for a specific week
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   * @returns {Promise<Object>} Lineup with starters and bench
   */
  async getLineup(leagueId, week = null) {
    const period = week || this.currentWeek;
    const roster = await this.getMyRoster(leagueId, null, period);
    
    if (!roster || !roster.roster) {
      return { starters: [], bench: [] };
    }
    
    const starters = [];
    const bench = [];
    
    roster.roster.forEach(player => {
      // Check if player is in starting lineup
      // This depends on ESPN's data structure for lineup slots
      if (player.lineupSlotId !== undefined && player.lineupSlotId < 20) {
        // Lineup slot IDs < 20 are typically starters
        starters.push(player);
      } else {
        bench.push(player);
      }
    });
    
    return {
      starters: _.sortBy(starters, 'lineupSlotId'),
      bench: _.sortBy(bench, 'defaultPosition')
    };
  }
  
  /**
   * Get matchup for a specific week
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   * @returns {Promise<Object>} Matchup information
   */
  async getMatchup(leagueId, week = null) {
    const period = week || this.currentWeek;
    const client = this.clients[leagueId];
    
    if (!client) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    try {
      const boxscores = await client.getBoxscoreForWeek({
        seasonId: this.season,
        matchupPeriodId: period,
        scoringPeriodId: period
      });
      
      // Find your team's matchup
      const myTeam = await this.getMyRoster(leagueId);
      const myMatchup = boxscores.find(boxscore => 
        boxscore.homeTeam.id === myTeam.id || 
        boxscore.awayTeam.id === myTeam.id
      );
      
      return myMatchup;
    } catch (error) {
      console.error(`Error fetching matchup for league ${leagueId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.teamsCache = {};
    this.rostersCache = {};
    this.freeAgentsCache = {};
  }
  
  /**
   * Get summary of all leagues
   * @returns {Promise<Array>} Summary of each league
   */
  async getLeaguesSummary() {
    const summaries = await Promise.all(
      this.leagues.map(async league => {
        try {
          const myTeam = await this.getMyRoster(league.id, league.teamName);
          return {
            leagueId: league.id,
            leagueName: league.name,
            teamName: myTeam.name,
            record: `${myTeam.wins}-${myTeam.losses}${myTeam.ties ? `-${myTeam.ties}` : ''}`,
            standing: myTeam.playoffSeed || myTeam.rankCalculatedFinal || 'N/A',
            points: myTeam.points,
            rosterSize: myTeam.roster?.length || 0
          };
        } catch (error) {
          return {
            leagueId: league.id,
            leagueName: league.name,
            error: error.message
          };
        }
      })
    );
    
    return summaries;
  }
}

export default LeagueManager;