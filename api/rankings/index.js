const fs = require('fs');
const path = require('path');
const { getCORSHeaders } = require('../../utils/rosterUtils');

// For Vercel, we use /tmp for temporary storage
// In production, use Vercel Blob Storage or a database
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

  // GET - Retrieve rankings
  if (req.method === 'GET') {
    try {
      const { week, season } = req.query;

      if (!week || !season) {
        return res.status(400).json({
          success: false,
          error: 'Week and season parameters are required'
        });
      }

      const filename = `${season}-week${week}.json`;
      const filepath = path.join(RANKINGS_DIR, filename);

      // Check if file exists
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({
          success: false,
          error: `Rankings not found for Week ${week}, Season ${season}`
        });
      }

      // Read and parse the file
      const fileContent = fs.readFileSync(filepath, 'utf8');
      const rankings = JSON.parse(fileContent);

      return res.status(200).json({
        success: true,
        data: rankings
      });

    } catch (error) {
      console.error('Error retrieving rankings:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve rankings'
      });
    }
  }

  // DELETE - Remove rankings
  if (req.method === 'DELETE') {
    try {
      const { week, season } = req.query;

      if (!week || !season) {
        return res.status(400).json({
          success: false,
          error: 'Week and season parameters are required'
        });
      }

      const filename = `${season}-week${week}.json`;
      const filepath = path.join(RANKINGS_DIR, filename);

      // Check if file exists
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({
          success: false,
          error: `Rankings not found for Week ${week}, Season ${season}`
        });
      }

      // Delete the file
      fs.unlinkSync(filepath);

      return res.status(200).json({
        success: true,
        message: `Rankings deleted for Week ${week}, Season ${season}`
      });

    } catch (error) {
      console.error('Error deleting rankings:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete rankings'
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}