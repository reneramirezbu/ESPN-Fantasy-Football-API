import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import our custom modules
import LeagueManager from './src/my-leagues/LeagueManager.js';
import RankingsManager from './src/rankings/RankingsManager.js';
import LineupOptimizer from './src/lineup-optimizer/LineupOptimizer.js';
import WaiverAnalyzer from './src/waiver-analysis/WaiverAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main Fantasy Football Management Application
 */
class FantasyFootballApp {
  constructor() {
    this.leagueManager = new LeagueManager();
    this.rankingsManager = new RankingsManager();
    this.lineupOptimizer = null;
    this.waiverAnalyzer = null;
    
    // Express app for web interface
    this.app = express();
    this.setupExpress();
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    console.log('🏈 Fantasy Football Manager Starting...\n');
    
    try {
      // Load league configurations
      await this.loadLeagueConfigurations();
      
      // Initialize optimizer and analyzer
      this.lineupOptimizer = new LineupOptimizer({
        leagueManager: this.leagueManager,
        rankingsManager: this.rankingsManager
      });
      
      this.waiverAnalyzer = new WaiverAnalyzer({
        leagueManager: this.leagueManager,
        rankingsManager: this.rankingsManager
      });
      
      // Load sample rankings if available
      await this.loadSampleRankings();
      
      console.log('✅ Application initialized successfully!\n');
      
      // Display league summary
      await this.displayLeaguesSummary();
      
    } catch (error) {
      console.error('❌ Error initializing application:', error.message);
      console.log('\nPlease check your configuration files and ESPN credentials.');
    }
  }
  
  /**
   * Load league configurations from environment and config file
   */
  async loadLeagueConfigurations() {
    const configs = [];
    
    // Load from environment variables
    if (process.env.LEAGUE1_ID) {
      configs.push({
        id: parseInt(process.env.LEAGUE1_ID),
        name: 'League 1',
        espnS2: process.env.LEAGUE1_ESPN_S2,
        SWID: process.env.LEAGUE1_SWID,
        teamName: process.env.LEAGUE1_TEAM_NAME || 'My Team',
        teamId: process.env.LEAGUE1_TEAM_ID ? parseInt(process.env.LEAGUE1_TEAM_ID, 10) : null,
        active: true
      });
    }
    
    if (process.env.LEAGUE2_ID) {
      configs.push({
        id: parseInt(process.env.LEAGUE2_ID),
        name: 'League 2',
        espnS2: process.env.LEAGUE2_ESPN_S2,
        SWID: process.env.LEAGUE2_SWID,
        teamName: process.env.LEAGUE2_TEAM_NAME || 'My Team',
        teamId: process.env.LEAGUE2_TEAM_ID ? parseInt(process.env.LEAGUE2_TEAM_ID, 10) : null,
        active: true
      });
    }
    
    // If no env configs, try loading from config file
    if (configs.length === 0) {
      const configPath = path.join(__dirname, 'config', 'leagues.json');
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        configs.push(...configData.leagues.filter(l => l.active && l.id));
      }
    }
    
    if (configs.length === 0) {
      throw new Error('No league configurations found. Please set up .env file or config/leagues.json');
    }
    
    // Load leagues into manager
    this.leagueManager.loadLeagues(configs);
    console.log(`📋 Loaded ${configs.length} league(s)`);
  }
  
  /**
   * Load sample rankings for testing
   */
  async loadSampleRankings() {
    // Check if sample rankings exist
    const weeklyPath = path.join(__dirname, 'data', 'rankings', 'week1.json');
    const rosPath = path.join(__dirname, 'data', 'rankings', 'ros.json');
    
    if (fs.existsSync(weeklyPath)) {
      await this.rankingsManager.loadWeeklyRankings(1, 'week1.json');
      console.log('📊 Loaded Week 1 rankings');
    }
    
    if (fs.existsSync(rosPath)) {
      await this.rankingsManager.loadRestOfSeasonRankings('ros.json');
      console.log('📊 Loaded ROS rankings');
    }
    
    // Create sample rankings if they don't exist
    if (!fs.existsSync(weeklyPath) && !fs.existsSync(rosPath)) {
      await this.createSampleRankings();
    }
  }
  
  /**
   * Create sample rankings for demonstration
   */
  async createSampleRankings() {
    const sampleWeeklyRankings = [
      { rank: 1, name: "Josh Allen", position: "QB", team: "BUF", points: 25.5 },
      { rank: 2, name: "Christian McCaffrey", position: "RB", team: "SF", points: 24.2 },
      { rank: 3, name: "Tyreek Hill", position: "WR", team: "MIA", points: 22.8 },
      { rank: 4, name: "Austin Ekeler", position: "RB", team: "LAC", points: 21.5 },
      { rank: 5, name: "Stefon Diggs", position: "WR", team: "BUF", points: 20.3 },
      // Add more sample players as needed
    ];
    
    const sampleROSRankings = [
      { rank: 1, name: "Christian McCaffrey", position: "RB", team: "SF", points: 280 },
      { rank: 2, name: "Austin Ekeler", position: "RB", team: "LAC", points: 265 },
      { rank: 3, name: "Tyreek Hill", position: "WR", team: "MIA", points: 260 },
      { rank: 4, name: "Justin Jefferson", position: "WR", team: "MIN", points: 255 },
      { rank: 5, name: "Josh Allen", position: "QB", team: "BUF", points: 340 },
      // Add more sample players as needed
    ];
    
    // Save sample rankings
    this.rankingsManager.saveRankings(sampleWeeklyRankings, 'week1.json');
    this.rankingsManager.saveRankings(sampleROSRankings, 'ros.json');
    
    // Load them
    await this.rankingsManager.loadWeeklyRankings(1, 'week1.json');
    await this.rankingsManager.loadRestOfSeasonRankings('ros.json');
    
    console.log('📊 Created and loaded sample rankings');
  }
  
  /**
   * Display summary of all leagues
   */
  async displayLeaguesSummary() {
    try {
      const summaries = await this.leagueManager.getLeaguesSummary();
      
      console.log('═══════════════════════════════════════════');
      console.log('            LEAGUE SUMMARY');
      console.log('═══════════════════════════════════════════\n');
      
      summaries.forEach(summary => {
        if (summary.error) {
          console.log(`❌ ${summary.leagueName}: ${summary.error}`);
        } else {
          console.log(`📌 ${summary.leagueName}`);
          console.log(`   Team: ${summary.teamName}`);
          console.log(`   Record: ${summary.record}`);
          console.log(`   Standing: ${summary.standing}`);
          console.log(`   Points: ${summary.points}`);
          console.log(`   Roster Size: ${summary.rosterSize}\n`);
        }
      });
      
      console.log('═══════════════════════════════════════════\n');
    } catch (error) {
      console.error('Error fetching league summaries:', error.message);
    }
  }
  
  /**
   * Get lineup recommendations for a week
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   */
  async getLineupRecommendations(leagueId, week = 1) {
    console.log(`\n🎯 Getting lineup recommendations for Week ${week}...\n`);
    
    try {
      const recommendations = await this.lineupOptimizer.getLineupRecommendations(
        leagueId, 
        week
      );
      
      console.log('📋 LINEUP RECOMMENDATIONS');
      console.log('─────────────────────────\n');
      
      console.log(`Summary: ${recommendations.recommendations.summary}\n`);
      
      if (recommendations.changes.length > 0) {
        console.log('Recommended Changes:');
        recommendations.changes.forEach(change => {
          const playerName = change.player.fullName || 
                            `${change.player.firstName} ${change.player.lastName}`;
          console.log(`  ${change.action}: ${playerName} - ${change.reason}`);
        });
      } else {
        console.log('No changes recommended - lineup is optimal!');
      }
      
      console.log(`\nProjected Improvement: ${recommendations.projectedImprovement.improvement.toFixed(1)} points`);
      console.log(`Confidence Score: ${recommendations.recommendations.confidenceScore}%`);
      
      return recommendations;
    } catch (error) {
      console.error('Error getting lineup recommendations:', error.message);
      throw error;
    }
  }
  
  /**
   * Analyze waiver wire
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   */
  async analyzeWaiverWire(leagueId, week = 1) {
    console.log(`\n🔍 Analyzing waiver wire for Week ${week}...\n`);
    
    try {
      const analysis = await this.waiverAnalyzer.analyzeWaiverWire(leagueId, week);
      
      console.log('🎯 WAIVER WIRE ANALYSIS');
      console.log('───────────────────────\n');
      
      console.log(`Summary: ${analysis.summary}\n`);
      
      if (analysis.recommendations.length > 0) {
        console.log('Top Recommendations:');
        analysis.recommendations.slice(0, 3).forEach((rec, index) => {
          const addName = rec.player.fullName || 
                         `${rec.player.firstName} ${rec.player.lastName}`;
          const dropName = rec.dropPlayer.fullName || 
                          `${rec.dropPlayer.firstName} ${rec.dropPlayer.lastName}`;
          
          console.log(`\n${index + 1}. ADD: ${addName} (${rec.player.defaultPosition})`);
          console.log(`   DROP: ${dropName}`);
          console.log(`   Reason: ${rec.reason}`);
          console.log(`   Priority: ${rec.priority} | Confidence: ${rec.confidence}%`);
        });
      }
      
      if (analysis.breakoutCandidates.length > 0) {
        console.log('\n💎 Breakout Candidates:');
        analysis.breakoutCandidates.slice(0, 3).forEach(candidate => {
          const name = candidate.player.fullName || 
                      `${candidate.player.firstName} ${candidate.player.lastName}`;
          console.log(`  • ${name} - ${candidate.breakoutReason}`);
        });
      }
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing waiver wire:', error.message);
      throw error;
    }
  }
  
  /**
   * Set up Express web server
   */
  setupExpress() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'web-client')));
    
    // Enable CORS for API endpoints
    this.app.use('/api', (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
    
    // API Routes
    this.app.get('/api/leagues', async (req, res, next) => {
      try {
        const summaries = await this.leagueManager.getLeaguesSummary();
        res.json(summaries); // Return raw array, not wrapped
      } catch (error) {
        next(error);
      }
    });
    
    this.app.get('/api/leagues/:id/lineup', async (req, res, next) => {
      try {
        const week = parseInt(req.query.week) || 1;
        const recommendations = await this.lineupOptimizer.getLineupRecommendations(
          parseInt(req.params.id),
          week
        );
        res.json(recommendations); // Return raw data, not wrapped
      } catch (error) {
        next(error);
      }
    });
    
    this.app.get('/api/leagues/:id/waiver', async (req, res, next) => {
      try {
        const week = parseInt(req.query.week) || 1;
        const analysis = await this.waiverAnalyzer.analyzeWaiverWire(
          parseInt(req.params.id),
          week
        );
        res.json(analysis); // Return raw data, not wrapped
      } catch (error) {
        next(error);
      }
    });
    
    // New endpoint: Get only user's team with roster
    this.app.get('/api/leagues/:id/my-team', async (req, res, next) => {
      try {
        const leagueId = parseInt(req.params.id);
        const week = parseInt(req.query.week) || this.leagueManager.currentWeek;
        
        // Get user's team with roster
        const myTeam = await this.leagueManager.getMyRoster(leagueId, null, week);
        
        // Get lineup (starters vs bench)
        const lineup = await this.leagueManager.getLineup(leagueId, week);
        
        // Filter to only essential player data for memory efficiency
        const formatPlayer = (player) => ({
          id: player.id,
          name: player.fullName || `${player.firstName} ${player.lastName}`,
          position: player.defaultPosition,
          team: player.proTeamAbbreviation,
          injuryStatus: player.injuryStatus || 'ACTIVE',
          projectedPoints: player.projectedRawStats?.appliedStatTotal || 0,
          actualPoints: player.rawStats?.appliedStatTotal || 0,
          percentOwned: player.percentOwned || 0,
          percentStarted: player.percentStarted || 0
        });
        
        const response = {
          team: {
            id: myTeam.id,
            name: myTeam.name || myTeam.nickname,
            record: `${myTeam.wins}-${myTeam.losses}${myTeam.ties ? `-${myTeam.ties}` : ''}`,
            standing: myTeam.playoffSeed || myTeam.rankCalculatedFinal || 'N/A',
            points: myTeam.points,
            projectedPoints: myTeam.projectedRawStats?.appliedStatTotal || 0
          },
          roster: {
            starters: lineup.starters.map(formatPlayer),
            bench: lineup.bench.map(formatPlayer)
          },
          week: week
        };
        
        res.json(response);
      } catch (error) {
        next(error);
      }
    });
    
    this.app.post('/api/rankings/upload', express.json(), async (req, res, next) => {
      try {
        const { type, week, data } = req.body;
        
        if (type === 'weekly') {
          this.rankingsManager.saveRankings(data, `week${week}.json`);
          await this.rankingsManager.loadWeeklyRankings(week, `week${week}.json`);
        } else if (type === 'ros') {
          this.rankingsManager.saveRankings(data, 'ros.json');
          await this.rankingsManager.loadRestOfSeasonRankings('ros.json');
        }
        
        res.json({ success: true, message: 'Rankings uploaded successfully' }); // Keep wrapped for upload response
      } catch (error) {
        next(error);
      }
    });
    
    // Global error handling middleware - MUST be last
    this.app.use((err, req, res, next) => {
      console.error('API Error:', err.message);
      
      // Always return JSON for API errors
      const status = err.status || 500;
      const response = {
        success: false,
        error: {
          message: err.message || 'An unexpected error occurred',
          code: err.code || 'INTERNAL_ERROR',
          status: status
        }
      };
      
      // Add details in development mode
      if (process.env.NODE_ENV === 'development') {
        response.error.stack = err.stack;
      }
      
      res.status(status).json(response);
    });
  }
  
  /**
   * Start the web server
   * @param {number} port - Port to listen on
   */
  startServer(port = 3000) {
    this.app.listen(port, () => {
      console.log(`\n🌐 Web interface available at: http://localhost:${port}`);
      console.log('📱 Access from any device on your network using your computer\'s IP address\n');
    });
  }
}

// Main execution
async function main() {
  const app = new FantasyFootballApp();
  
  await app.initialize();
  
  // If running directly (not imported), start the server
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    app.startServer();
    
    // Example: Get lineup recommendations for the first league
    if (app.leagueManager.leagues.length > 0) {
      const firstLeagueId = app.leagueManager.leagues[0].id;
      
      // Uncomment to test lineup recommendations
      // await app.getLineupRecommendations(firstLeagueId, 1);
      
      // Uncomment to test waiver analysis
      // await app.analyzeWaiverWire(firstLeagueId, 1);
    }
  }
}

// Run the app
main().catch(console.error);

export default FantasyFootballApp;