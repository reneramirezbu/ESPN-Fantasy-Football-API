const fs = require('fs');
const path = require('path');
const { getCORSHeaders } = require('../../utils/rosterUtils');

// Global variable to store current rankings in memory
global.currentRankings = global.currentRankings || null;

// For Vercel, we use /tmp for temporary storage
const RANKINGS_DIR = '/tmp/rankings';

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

  // Only accept GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Debug logging
    console.log('Current rankings endpoint called');
    console.log('Global rankings available:', !!global.currentRankings);
    console.log('Checking RANKINGS_DIR:', RANKINGS_DIR);
    console.log('Directory exists:', fs.existsSync(RANKINGS_DIR));

    // First, try to get rankings from memory
    if (global.currentRankings) {
      console.log('Returning rankings from memory');
      return res.status(200).json({
        success: true,
        data: global.currentRankings
      });
    }

    if (fs.existsSync(RANKINGS_DIR)) {
      const dirContents = fs.readdirSync(RANKINGS_DIR);
      console.log('Directory contents:', dirContents);
    }

    // Fallback to filesystem if memory is empty
    if (!fs.existsSync(RANKINGS_DIR)) {
      console.log('Rankings directory does not exist and no memory cache');
      return res.status(404).json({
        success: false,
        error: 'No rankings uploaded yet'
      });
    }

    // Just read the current.json file
    const currentFile = path.join(RANKINGS_DIR, 'current.json');

    if (!fs.existsSync(currentFile)) {
      console.log('Current.json file does not exist and no memory cache');
      return res.status(404).json({
        success: false,
        error: 'No rankings available. Please upload rankings first.'
      });
    }

    // Read and return the current rankings from file
    console.log('Reading rankings from filesystem');
    const fileContent = fs.readFileSync(currentFile, 'utf8');
    const rankings = JSON.parse(fileContent);

    // Store in memory for next time
    global.currentRankings = rankings;

    return res.status(200).json({
      success: true,
      data: rankings
    });

  } catch (error) {
    console.error('Error retrieving current rankings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve rankings'
    });
  }
};