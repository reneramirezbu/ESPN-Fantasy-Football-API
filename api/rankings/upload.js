const { formidable } = require('formidable');
const fs = require('fs');
const path = require('path');
const { getCORSHeaders } = require('../../utils/rosterUtils');
const XLSXParser = require('../../services/xlsxParser.js');

// Global variable to store current rankings in memory (persists across requests)
global.currentRankings = global.currentRankings || null;

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CURRENT_SEASON_START = new Date().getFullYear() + '-09-05'; // NFL season typically starts in September

module.exports.config = {
  api: {
    bodyParser: false, // Disable body parsing, formidable will handle it
  },
};

function parseExcelFile(filePath, week, season) {
  // Use the proven XLSXParser class - let errors bubble up naturally
  const parser = new XLSXParser();
  return parser.parseRankingsFile(filePath, week, season);
}

function getCurrentWeek() {
  const seasonStart = new Date(CURRENT_SEASON_START);
  const now = new Date();
  const diffTime = Math.abs(now - seasonStart);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(Math.ceil(diffDays / 7), 18); // Cap at week 18
}

async function saveRankings(rankings) {
  try {
    // Save to Vercel's expected directory for consistency with other endpoints
    const RANKINGS_DIR = '/tmp/rankings';

    // Ensure directory exists
    if (!fs.existsSync(RANKINGS_DIR)) {
      fs.mkdirSync(RANKINGS_DIR, { recursive: true });
    }

    // Always save as current.json - we only care about the latest upload
    const filename = 'current.json';
    const filepath = path.join(RANKINGS_DIR, filename);

    // Debug logging before save
    console.log('About to save rankings to:', filepath);
    console.log('RANKINGS_DIR exists:', fs.existsSync(RANKINGS_DIR));
    console.log('Rankings object keys:', Object.keys(rankings));

    // Save the rankings to filesystem
    fs.writeFileSync(filepath, JSON.stringify(rankings, null, 2));

    // Also save to global memory for persistence across function calls
    global.currentRankings = rankings;

    // Debug logging after save
    console.log('Rankings saved successfully to file and memory');
    console.log('File exists after save:', fs.existsSync(filepath));
    console.log('Global rankings stored:', !!global.currentRankings);
    if (fs.existsSync(RANKINGS_DIR)) {
      console.log('Directory contents after save:', fs.readdirSync(RANKINGS_DIR));
    }

    return {
      success: true,
      filename,
      filepath,
      totalPlayers: rankings.metadata.totalPlayers,
      message: 'Rankings saved successfully'
    };
  } catch (error) {
    console.error('Error saving rankings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = async function handler(req, res) {
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
    maxFileSize: MAX_FILE_SIZE,
    keepExtensions: true,
  });

  let tempFile = null;

  try {
    const [fields, files] = await form.parse(req);

    console.log('Upload request received');
    console.log('Fields:', fields);
    console.log('Files:', files);

    // Get the uploaded file
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    tempFile = file; // Store for cleanup

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

    // Just use current date/time for the file
    const now = new Date();
    const week = getCurrentWeek();
    const season = now.getFullYear();

    console.log(`Processing rankings upload at ${now.toISOString()}`);

    // Parse the Excel file
    console.log(`Parsing Excel file: ${file.filepath}`);
    const rankings = parseExcelFile(file.filepath, week, season);

    console.log(`Parsed ${rankings.metadata.totalPlayers} players from ${rankings.metadata.sheetsProcessed.length} sheets`);

    // Check if there were any parsing errors
    if (rankings.metadata.errors.length > 0) {
      console.warn('Parsing errors occurred:', rankings.metadata.errors);
    }

    if (rankings.metadata.warnings.length > 0) {
      console.warn('Parsing warnings occurred:', rankings.metadata.warnings);
    }

    // Save rankings
    console.log('Saving rankings to persistent storage...');
    const saveResult = await saveRankings(rankings);

    if (!saveResult.success) {
      console.error('Failed to save rankings:', saveResult.error);
      return res.status(500).json({
        success: false,
        error: saveResult.error || 'Failed to save rankings'
      });
    }

    console.log(`Successfully saved rankings to: ${saveResult.filepath}`);

    return res.status(200).json({
      success: true,
      data: {
        week: rankings.week,
        season: rankings.season,
        filename: saveResult.filename,
        filepath: saveResult.filepath,
        totalPlayers: rankings.metadata.totalPlayers,
        sheetsProcessed: rankings.metadata.sheetsProcessed,
        errors: rankings.metadata.errors,
        warnings: rankings.metadata.warnings,
        uploadedAt: rankings.uploadedAt
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  } finally {
    // Always clean up temp file
    if (tempFile && tempFile.filepath) {
      try {
        fs.unlinkSync(tempFile.filepath);
        console.log('Cleaned up temp file:', tempFile.filepath);
      } catch (err) {
        console.error('Error cleaning up temp file:', err);
      }
    }
  }
}

