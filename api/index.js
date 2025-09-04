import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Safely import our custom modules with error handling
let LeagueManager, RankingsManager, LineupOptimizer, WaiverAnalyzer;

try {
  const modules = await Promise.all([
    import('../src/my-leagues/LeagueManager.js'),
    import('../src/rankings/RankingsManager.js'),
    import('../src/lineup-optimizer/LineupOptimizer.js'),
    import('../src/waiver-analysis/WaiverAnalyzer.js')
  ]);
  
  LeagueManager = modules[0].default;
  RankingsManager = modules[1].default;
  LineupOptimizer = modules[2].default;
  WaiverAnalyzer = modules[3].default;
} catch (error) {
  console.error('Failed to load modules:', error);
  // Continue with limited functionality
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
app.use(express.json());

// CORS headers for Vercel - Production ready with specific origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://espn-fantasy-football-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Memory-efficient cache with TTL and size limits
class CacheManager {
  constructor(ttlMs = 300000, maxSize = 50) { // 5 minutes default, 50 items max
    this.cache = new Map();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  set(key, value) {
    // Enforce cache size limit (LRU eviction)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new CacheManager();

// Initialize managers
let initialized = false;
let initializationError = null;
let leagueManager;
let rankingsManager;
let lineupOptimizer;
let waiverAnalyzer;

async function initialize() {
  if (initialized) return true;
  if (initializationError) throw initializationError;
  
  try {
    // Check if modules loaded successfully
    if (!LeagueManager || !RankingsManager) {
      throw new Error('Required modules not loaded');
    }
    
    leagueManager = new LeagueManager();
    rankingsManager = new RankingsManager();
    
    // Load league configurations from environment
    const configs = [];
    
    // Try to load from environment variables
    if (process.env.LEAGUE1_ID) {
      configs.push({
        id: parseInt(process.env.LEAGUE1_ID),
        name: process.env.LEAGUE1_NAME || 'League 1',
        espnS2: process.env.LEAGUE1_ESPN_S2,
        SWID: process.env.LEAGUE1_SWID,
        teamName: process.env.LEAGUE1_TEAM_NAME || 'My Team',
        active: true
      });
    }
    
    if (process.env.LEAGUE2_ID) {
      configs.push({
        id: parseInt(process.env.LEAGUE2_ID),
        name: process.env.LEAGUE2_NAME || 'League 2',
        espnS2: process.env.LEAGUE2_ESPN_S2,
        SWID: process.env.LEAGUE2_SWID,
        teamName: process.env.LEAGUE2_TEAM_NAME || 'My Team',
        active: true
      });
    }
    
    // If no environment configs, try to load from config file
    if (configs.length === 0) {
      try {
        const configPath = path.join(__dirname, '..', 'config', 'leagues.json');
        if (fs.existsSync(configPath)) {
          const fileContent = fs.readFileSync(configPath, 'utf-8');
          const fileConfigs = JSON.parse(fileContent);
          if (Array.isArray(fileConfigs)) {
            configs.push(...fileConfigs.filter(c => c && c.id));
          }
        }
      } catch (err) {
        console.warn('Could not load config file:', err.message);
      }
    }
    
    // Load leagues if we have configs
    if (configs.length > 0) {
      leagueManager.loadLeagues(configs);
      
      // Initialize optimizer and analyzer only if modules are available
      if (LineupOptimizer && WaiverAnalyzer) {
        lineupOptimizer = new LineupOptimizer({
          leagueManager: leagueManager,
          rankingsManager: rankingsManager
        });
        
        waiverAnalyzer = new WaiverAnalyzer({
          leagueManager: leagueManager,
          rankingsManager: rankingsManager
        });
      }
      
      // Load sample rankings for demo
      await loadSampleRankings();
    }
    
    initialized = true;
    return true;
  } catch (error) {
    console.error('Initialization error:', error);
    initializationError = error;
    throw error;
  }
}

async function loadSampleRankings() {
  try {
    const sampleWeeklyRankings = [
      { rank: 1, name: "Josh Allen", position: "QB", team: "BUF", points: 25.5 },
      { rank: 2, name: "Christian McCaffrey", position: "RB", team: "SF", points: 24.2 },
      { rank: 3, name: "Tyreek Hill", position: "WR", team: "MIA", points: 22.8 },
      { rank: 4, name: "Austin Ekeler", position: "RB", team: "LAC", points: 21.5 },
      { rank: 5, name: "Stefon Diggs", position: "WR", team: "BUF", points: 20.3 }
    ];
    
    if (rankingsManager) {
      rankingsManager.saveRankings(sampleWeeklyRankings, 'week1.json');
      await rankingsManager.loadWeeklyRankings(1, 'week1.json');
    }
  } catch (error) {
    console.warn('Could not load sample rankings:', error.message);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'An error occurred',
    ...(isDev && { stack: err.stack })
  });
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    initialized: initialized,
    leagues: initialized ? leagueManager?.leagues?.length || 0 : 0,
    modules: {
      LeagueManager: !!LeagueManager,
      RankingsManager: !!RankingsManager,
      LineupOptimizer: !!LineupOptimizer,
      WaiverAnalyzer: !!WaiverAnalyzer
    }
  });
});

app.get('/api/leagues', async (req, res, next) => {
  try {
    // Check cache first
    const cacheKey = 'leagues';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    await initialize();
    
    // Return demo data if no leagues configured
    if (!leagueManager || leagueManager.leagues.length === 0) {
      const demoData = [{
        id: 'demo',
        leagueName: 'Demo League',
        teamName: 'Demo Team',
        teamId: 1,
        standing: 1,
        record: { wins: 0, losses: 0, ties: 0 },
        points: 0,
        pointsAgainst: 0,
        rosterSize: 16,
        isDemo: true,
        error: 'No leagues configured. Add your ESPN credentials to environment variables.'
      }];
      return res.json(demoData);
    }
    
    const summaries = await leagueManager.getLeaguesSummary();
    
    // Cache the result
    cache.set(cacheKey, summaries);
    
    res.json(summaries);
  } catch (error) {
    next(error);
  }
});

app.get('/api/leagues/:id/lineup', async (req, res, next) => {
  try {
    // Input validation
    const leagueId = parseInt(req.params.id);
    if (!leagueId || leagueId <= 0 || leagueId > 999999999) {
      return res.status(400).json({ 
        error: 'Invalid league ID',
        message: 'League ID must be a valid number'
      });
    }
    
    const week = parseInt(req.query.week) || 1;
    if (week < 1 || week > 18) {
      return res.status(400).json({ 
        error: 'Invalid week',
        message: 'Week must be between 1 and 18'
      });
    }
    
    await initialize();
    
    if (!lineupOptimizer) {
      return res.status(503).json({ 
        error: 'Lineup optimizer not available',
        message: 'The lineup optimizer service is currently unavailable. Please try again later.'
      });
    }
    
    const cacheKey = `lineup-${leagueId}-${week}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const recommendations = await lineupOptimizer.getLineupRecommendations(
      leagueId,
      week
    );
    
    // Cache result
    cache.set(cacheKey, recommendations);
    
    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

app.get('/api/leagues/:id/waiver', async (req, res, next) => {
  try {
    await initialize();
    
    if (!waiverAnalyzer) {
      return res.status(503).json({ 
        error: 'Waiver analyzer not available',
        message: 'The waiver analyzer service is currently unavailable. Please try again later.'
      });
    }
    
    const week = parseInt(req.query.week) || 1;
    const cacheKey = `waiver-${req.params.id}-${week}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const analysis = await waiverAnalyzer.analyzeWaiverWire(
      parseInt(req.params.id),
      week
    );
    
    // Cache result
    cache.set(cacheKey, analysis);
    
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

app.get('/api/leagues/:id/my-team', async (req, res, next) => {
  try {
    await initialize();
    
    if (!leagueManager) {
      return res.status(503).json({ 
        error: 'League manager not available',
        message: 'The league manager service is currently unavailable. Please try again later.'
      });
    }
    
    const leagueId = parseInt(req.params.id);
    const cacheKey = `myteam-${leagueId}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const roster = await leagueManager.getUserRoster(leagueId);
    
    // Cache result
    cache.set(cacheKey, roster);
    
    res.json(roster);
  } catch (error) {
    next(error);
  }
});

app.post('/api/rankings/upload', async (req, res, next) => {
  try {
    await initialize();
    
    if (!rankingsManager) {
      return res.status(503).json({ 
        error: 'Rankings manager not available',
        message: 'The rankings manager service is currently unavailable. Please try again later.'
      });
    }
    
    const { type, week, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Please provide type and data in request body'
      });
    }
    
    if (type === 'weekly') {
      rankingsManager.saveRankings(data, `week${week}.json`);
      await rankingsManager.loadWeeklyRankings(week, `week${week}.json`);
    } else if (type === 'ros') {
      rankingsManager.saveRankings(data, 'ros.json');
      await rankingsManager.loadRestOfSeasonRankings('ros.json');
    } else {
      return res.status(400).json({ 
        error: 'Invalid type',
        message: 'Type must be "weekly" or "ros"'
      });
    }
    
    // Clear cache after rankings update
    cache.clear();
    
    res.json({ success: true, message: 'Rankings uploaded successfully' });
  } catch (error) {
    next(error);
  }
});

// Default route
app.get('/api', (req, res) => {
  res.json({
    message: 'ESPN Fantasy Football Manager API',
    version: '2.0.1',
    status: initialized ? 'ready' : 'initializing',
    endpoints: {
      health: '/api/health',
      leagues: '/api/leagues',
      lineup: '/api/leagues/:id/lineup?week=1',
      waiver: '/api/leagues/:id/waiver?week=1',
      myTeam: '/api/leagues/:id/my-team',
      rankings: '/api/rankings/upload'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested endpoint ${req.path} does not exist`
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Export for Vercel
export default app;