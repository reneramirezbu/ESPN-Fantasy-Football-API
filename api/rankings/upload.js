import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { getCORSHeaders } from '../../utils/rosterUtils';

// We need to use a more permanent storage solution for Vercel
// For now, we'll use /tmp which is available in Vercel functions
const XLSX = require('xlsx');

// Position tabs we expect in the XLSX file
const POSITION_TABS = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K'];

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, formidable will handle it
  },
};

function parseExcelFile(filePath, week, season) {
  try {
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
      week: week || getCurrentWeek(),
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

      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        raw: false,
        defval: null
      });

      const players = [];

      jsonData.forEach((row) => {
        // Handle Weekly Rankings format
        if (row['Player (team)']) {
          const playerWithTeam = row['Player (team)'];
          const match = playerWithTeam.match(/^(.+?)\s*\(([A-Z]+)\)$/);

          if (match) {
            const playerName = match[1].trim();
            const team = match[2];
            const weeklyRank = row['#'] ? parseInt(row['#'], 10) : null;
            const rosRank = row['ECR™'] || row['ECR'] ? parseInt(row['ECR™'] || row['ECR'], 10) : null;
            const matchup = row['Matchup'] || null;

            // For FLEX sheet, extract position from Pos column
            let playerPosition = position;
            if (row['Pos']) {
              const posMatch = row['Pos'].match(/^([A-Z]+)/);
              if (posMatch) {
                playerPosition = posMatch[1];
              }
            }

            if (playerName && weeklyRank) {
              players.push({
                name: playerName,
                team: team,
                pos: playerPosition,
                rank: weeklyRank,
                rosRank: rosRank,
                matchup: matchup
              });
            }
          }
        }
      });

      // Sort by rank
      players.sort((a, b) => a.rank - b.rank);

      rankings.positions[position] = players;
      rankings.metadata.totalPlayers += players.length;
      rankings.metadata.sheetsProcessed.push(position);
    }

    return rankings;
  } catch (error) {
    console.error('Error parsing XLSX file:', error);
    throw error;
  }
}

function getCurrentWeek() {
  // Simple week calculation - you may want to adjust based on NFL season
  const seasonStart = new Date('2024-09-05'); // NFL 2024 season start
  const now = new Date();
  const diffTime = Math.abs(now - seasonStart);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(Math.ceil(diffDays / 7), 18); // Cap at week 18
}

async function saveRankings(rankings) {
  try {
    // For Vercel, we'll store in /tmp temporarily
    // In production, you'd want to use Vercel Blob Storage or a database
    const dataDir = '/tmp/rankings';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filename = `${rankings.season}-week${rankings.week}.json`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(rankings, null, 2));

    return {
      success: true,
      filename,
      message: 'Rankings saved successfully (temporary storage)'
    };
  } catch (error) {
    console.error('Error saving rankings:', error);
    return {
      success: false,
      error: error.message
    };
  }
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

  const form = formidable({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    keepExtensions: true,
  });

  try {
    const [fields, files] = await form.parse(req);

    console.log('Upload request received');
    console.log('Fields:', fields);
    console.log('Files:', files);

    // Get the uploaded file
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = path.extname(file.originalFilename || file.name).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .xlsx and .xls files are allowed.'
      });
    }

    // Extract week and season
    const week = fields.week ? parseInt(fields.week[0]) : getCurrentWeek();
    const season = fields.season ? parseInt(fields.season[0]) : new Date().getFullYear();

    console.log(`Processing rankings for Week ${week}, Season ${season}`);

    // Parse the Excel file
    const rankings = parseExcelFile(file.filepath, week, season);

    // Save rankings
    const saveResult = await saveRankings(rankings);

    if (!saveResult.success) {
      return res.status(500).json({
        success: false,
        error: saveResult.error || 'Failed to save rankings'
      });
    }

    // Clean up temp file
    try {
      fs.unlinkSync(file.filepath);
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }

    return res.status(200).json({
      success: true,
      data: {
        week: rankings.week,
        season: rankings.season,
        filename: saveResult.filename,
        totalPlayers: rankings.metadata.totalPlayers,
        sheetsProcessed: rankings.metadata.sheetsProcessed,
        errors: rankings.metadata.errors,
        warnings: rankings.metadata.warnings
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}