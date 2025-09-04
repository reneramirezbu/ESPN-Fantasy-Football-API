import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import our custom modules
import LeagueManager from '../src/my-leagues/LeagueManager.js';
import RankingsManager from '../src/rankings/RankingsManager.js';
import LineupOptimizer from '../src/lineup-optimizer/LineupOptimizer.js';
import WaiverAnalyzer from '../src/waiver-analysis/WaiverAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
app.use(express.json());

// CORS headers for Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize managers
let initialized = false;
let leagueManager;
let rankingsManager;
let lineupOptimizer;
let waiverAnalyzer;

async function initialize() {
  if (initialized) return;
  
  leagueManager = new LeagueManager();
  rankingsManager = new RankingsManager();
  
  // Load league configurations from environment
  const configs = [];
  
  if (process.env.LEAGUE1_ID) {
    configs.push({
      id: parseInt(process.env.LEAGUE1_ID),
      name: 'League 1',
      espnS2: process.env.LEAGUE1_ESPN_S2,
      SWID: process.env.LEAGUE1_SWID,
      teamName: process.env.LEAGUE1_TEAM_NAME || 'My Team',
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
      active: true
    });
  }
  
  if (configs.length > 0) {
    leagueManager.loadLeagues(configs);
    
    // Initialize optimizer and analyzer
    lineupOptimizer = new LineupOptimizer({
      leagueManager: leagueManager,
      rankingsManager: rankingsManager
    });
    
    waiverAnalyzer = new WaiverAnalyzer({
      leagueManager: leagueManager,
      rankingsManager: rankingsManager
    });
    
    // Load sample rankings
    await loadSampleRankings();
  }
  
  initialized = true;
}

async function loadSampleRankings() {
  const sampleWeeklyRankings = [
    { rank: 1, name: "Josh Allen", position: "QB", team: "BUF", points: 25.5 },
    { rank: 2, name: "Christian McCaffrey", position: "RB", team: "SF", points: 24.2 },
    { rank: 3, name: "Tyreek Hill", position: "WR", team: "MIA", points: 22.8 },
    { rank: 4, name: "Austin Ekeler", position: "RB", team: "LAC", points: 21.5 },
    { rank: 5, name: "Stefon Diggs", position: "WR", team: "BUF", points: 20.3 }
  ];
  
  rankingsManager.saveRankings(sampleWeeklyRankings, 'week1.json');
  await rankingsManager.loadWeeklyRankings(1, 'week1.json');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    initialized: initialized,
    leagues: initialized ? leagueManager?.leagues?.length || 0 : 0
  });
});

app.get('/api/leagues', async (req, res) => {
  try {
    await initialize();
    
    if (!leagueManager || leagueManager.leagues.length === 0) {
      return res.json([{
        leagueName: 'Demo Mode',
        teamName: 'No Leagues Configured',
        error: 'Please configure your leagues in environment variables'
      }]);
    }
    
    const summaries = await leagueManager.getLeaguesSummary();
    res.json(summaries);
  } catch (error) {
    console.error('Error in /api/leagues:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id/lineup', async (req, res) => {
  try {
    await initialize();
    
    if (!lineupOptimizer) {
      return res.status(400).json({ 
        error: 'Lineup optimizer not initialized. Please configure leagues.' 
      });
    }
    
    const week = parseInt(req.query.week) || 1;
    const recommendations = await lineupOptimizer.getLineupRecommendations(
      parseInt(req.params.id),
      week
    );
    res.json(recommendations);
  } catch (error) {
    console.error('Error in /api/leagues/:id/lineup:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id/waiver', async (req, res) => {
  try {
    await initialize();
    
    if (!waiverAnalyzer) {
      return res.status(400).json({ 
        error: 'Waiver analyzer not initialized. Please configure leagues.' 
      });
    }
    
    const week = parseInt(req.query.week) || 1;
    const analysis = await waiverAnalyzer.analyzeWaiverWire(
      parseInt(req.params.id),
      week
    );
    res.json(analysis);
  } catch (error) {
    console.error('Error in /api/leagues/:id/waiver:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rankings/upload', async (req, res) => {
  try {
    await initialize();
    
    const { type, week, data } = req.body;
    
    if (type === 'weekly') {
      rankingsManager.saveRankings(data, `week${week}.json`);
      await rankingsManager.loadWeeklyRankings(week, `week${week}.json`);
    } else if (type === 'ros') {
      rankingsManager.saveRankings(data, 'ros.json');
      await rankingsManager.loadRestOfSeasonRankings('ros.json');
    }
    
    res.json({ success: true, message: 'Rankings uploaded successfully' });
  } catch (error) {
    console.error('Error in /api/rankings/upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Default route
app.get('/api', (req, res) => {
  res.json({
    message: 'Fantasy Football Manager API',
    endpoints: {
      health: '/api/health',
      leagues: '/api/leagues',
      lineup: '/api/leagues/:id/lineup?week=1',
      waiver: '/api/leagues/:id/waiver?week=1',
      rankings: '/api/rankings/upload'
    }
  });
});

// Export for Vercel
export default app;