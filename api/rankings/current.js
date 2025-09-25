const fs = require('fs');
const path = require('path');
const { getCORSHeaders } = require('../../utils/rosterUtils');

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
    // Check if rankings directory exists
    if (!fs.existsSync(RANKINGS_DIR)) {
      return res.status(404).json({
        success: false,
        error: 'No rankings uploaded yet'
      });
    }

    // Just read the current.json file
    const currentFile = path.join(RANKINGS_DIR, 'current.json');

    if (!fs.existsSync(currentFile)) {
      return res.status(404).json({
        success: false,
        error: 'No rankings available. Please upload rankings first.'
      });
    }

    // Read and return the current rankings
    const fileContent = fs.readFileSync(currentFile, 'utf8');
    const rankings = JSON.parse(fileContent);

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