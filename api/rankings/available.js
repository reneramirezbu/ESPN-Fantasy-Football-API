import fs from 'fs';
import path from 'path';
import { getCORSHeaders } from '../../utils/rosterUtils';

// For Vercel, we use /tmp for temporary storage
const RANKINGS_DIR = '/tmp/rankings';

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
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // Read all JSON files in the rankings directory
    const files = fs.readdirSync(RANKINGS_DIR);
    const rankings = [];

    files.forEach(file => {
      if (file.endsWith('.json')) {
        // Parse filename to extract week and season
        const match = file.match(/^(\d{4})-week(\d+)\.json$/);
        if (match) {
          const filepath = path.join(RANKINGS_DIR, file);
          const stats = fs.statSync(filepath);

          rankings.push({
            filename: file,
            season: parseInt(match[1]),
            week: parseInt(match[2]),
            uploadedAt: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }
    });

    // Sort by season and week (newest first)
    rankings.sort((a, b) => {
      if (a.season !== b.season) {
        return b.season - a.season;
      }
      return b.week - a.week;
    });

    return res.status(200).json({
      success: true,
      data: rankings
    });

  } catch (error) {
    console.error('Error listing rankings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list available rankings'
    });
  }
}