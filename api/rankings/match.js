import fs from 'fs';
import path from 'path';
import { getCORSHeaders } from '../../utils/rosterUtils';

const RANKINGS_DIR = '/tmp/rankings';

// Simple name matching algorithm
function normalizePlayerName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '') // Remove non-letters
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ''); // Remove suffixes
}

function matchPlayers(rankings, espnRoster) {
  const matches = [];
  const unmatched = {
    rankings: [],
    espn: []
  };

  // Create normalized lookup for ESPN roster
  const espnLookup = {};
  espnRoster.forEach(player => {
    const normalizedName = normalizePlayerName(player.fullName);
    espnLookup[normalizedName] = player;
  });

  // Match rankings to ESPN roster
  Object.entries(rankings.positions).forEach(([position, players]) => {
    players.forEach(rankedPlayer => {
      const normalizedRankName = normalizePlayerName(rankedPlayer.name);
      const espnPlayer = espnLookup[normalizedRankName];

      if (espnPlayer) {
        matches.push({
          rankingPlayer: rankedPlayer,
          espnPlayer: espnPlayer,
          confidence: 1.0
        });
        delete espnLookup[normalizedRankName];
      } else {
        // Try partial matching
        let bestMatch = null;
        let bestScore = 0;

        Object.entries(espnLookup).forEach(([espnNormName, espnPlayer]) => {
          // Check if last names match
          const rankLastName = normalizedRankName.split(' ').pop();
          const espnLastName = espnNormName.split(' ').pop();

          if (rankLastName === espnLastName && espnPlayer.position === position) {
            const score = 0.7; // Partial match score
            if (score > bestScore) {
              bestScore = score;
              bestMatch = espnPlayer;
            }
          }
        });

        if (bestMatch && bestScore > 0.5) {
          matches.push({
            rankingPlayer: rankedPlayer,
            espnPlayer: bestMatch,
            confidence: bestScore
          });
          const normalizedBestName = normalizePlayerName(bestMatch.fullName);
          delete espnLookup[normalizedBestName];
        } else {
          unmatched.rankings.push(rankedPlayer);
        }
      }
    });
  });

  // Remaining ESPN players are unmatched
  unmatched.espn = Object.values(espnLookup);

  return {
    matches,
    unmatched,
    matchRate: matches.length / (matches.length + unmatched.rankings.length)
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  const corsHeaders = getCORSHeaders(req);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { week, season, espnRoster } = req.body;

    // Validate input
    if (!week || !season) {
      return res.status(400).json({
        success: false,
        error: 'Week and season are required'
      });
    }

    if (!espnRoster || !Array.isArray(espnRoster)) {
      return res.status(400).json({
        success: false,
        error: 'ESPN roster array is required'
      });
    }

    // Load rankings
    const filename = `${season}-week${week}.json`;
    const filepath = path.join(RANKINGS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: `Rankings not found for Week ${week}, Season ${season}`
      });
    }

    const fileContent = fs.readFileSync(filepath, 'utf8');
    const rankings = JSON.parse(fileContent);

    // Match players
    const matchResult = matchPlayers(rankings, espnRoster);

    return res.status(200).json({
      success: true,
      data: {
        matches: matchResult.matches,
        unmatched: matchResult.unmatched,
        statistics: {
          totalMatches: matchResult.matches.length,
          unmatchedRankings: matchResult.unmatched.rankings.length,
          unmatchedEspn: matchResult.unmatched.espn.length,
          matchRate: Math.round(matchResult.matchRate * 100) + '%'
        }
      }
    });

  } catch (error) {
    console.error('Error matching players:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to match players'
    });
  }
}