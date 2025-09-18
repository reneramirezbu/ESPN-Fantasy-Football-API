const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');

class NameMatcher {
  constructor() {
    this.mappingsFile = path.join(__dirname, '..', 'data', 'name-mappings.json');
    this.espnPlayersFile = path.join(__dirname, '..', 'data', 'espn-players.json');
    this.loadMappings();
    this.loadESPNPlayers();
  }

  /**
   * Load saved name mappings from file
   */
  loadMappings() {
    try {
      if (fs.existsSync(this.mappingsFile)) {
        const data = fs.readFileSync(this.mappingsFile, 'utf8');
        this.mappings = JSON.parse(data);
      } else {
        this.mappings = {};
      }
    } catch (error) {
      console.error('Error loading name mappings:', error);
      this.mappings = {};
    }
  }

  /**
   * Save name mappings to file (atomic operation)
   */
  saveMappings() {
    try {
      // Write to temporary file first
      const tempFile = `${this.mappingsFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.mappings, null, 2));

      // Atomic rename to prevent corruption
      fs.renameSync(tempFile, this.mappingsFile);
    } catch (error) {
      console.error('Error saving name mappings:', error);

      // Clean up temp file if it exists
      const tempFile = `${this.mappingsFile}.tmp`;
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }
  }

  /**
   * Load ESPN players list (this would ideally come from the ESPN API)
   */
  loadESPNPlayers() {
    try {
      // For now, we'll build this list as we encounter players from ESPN API
      // In production, this would be populated from the ESPN API
      if (fs.existsSync(this.espnPlayersFile)) {
        const data = fs.readFileSync(this.espnPlayersFile, 'utf8');
        this.espnPlayers = JSON.parse(data);
      } else {
        // Start with an empty list that will be populated over time
        this.espnPlayers = [];
      }
    } catch (error) {
      console.error('Error loading ESPN players:', error);
      this.espnPlayers = [];
    }
  }

  /**
   * Save ESPN players list (atomic operation)
   */
  saveESPNPlayers() {
    try {
      // Write to temporary file first
      const tempFile = `${this.espnPlayersFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.espnPlayers, null, 2));

      // Atomic rename to prevent corruption
      fs.renameSync(tempFile, this.espnPlayersFile);
    } catch (error) {
      console.error('Error saving ESPN players:', error);

      // Clean up temp file if it exists
      const tempFile = `${this.espnPlayersFile}.tmp`;
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }
  }

  /**
   * Match a player name from rankings to ESPN player data
   * @param {Object} rankingPlayer - Player from rankings { name, team, pos }
   * @param {Array} espnRoster - Current ESPN roster for context
   * @returns {Object} Match result with confidence score
   */
  matchPlayer(rankingPlayer, espnRoster = []) {
    const { name, team, pos } = rankingPlayer;

    // Create a unique key for this player
    const playerKey = this.createPlayerKey(name, team, pos);

    // Step 1: Check saved mappings
    if (this.mappings[playerKey]) {
      return {
        matched: true,
        confidence: 1.0,
        espnId: this.mappings[playerKey].espnId,
        espnName: this.mappings[playerKey].espnName,
        method: 'saved_mapping'
      };
    }

    // Step 2: Try exact match with ESPN roster
    const exactMatch = this.findExactMatch(name, team, pos, espnRoster);
    if (exactMatch) {
      // Save this mapping for future use
      this.saveMapping(playerKey, exactMatch);
      return exactMatch;
    }

    // Step 3: Try fuzzy matching
    const fuzzyMatch = this.findFuzzyMatch(name, team, pos, espnRoster);
    if (fuzzyMatch && fuzzyMatch.confidence >= 0.8) {
      // Auto-save high confidence matches
      if (fuzzyMatch.confidence >= 0.9) {
        this.saveMapping(playerKey, fuzzyMatch);
      }
      return fuzzyMatch;
    }

    // Step 4: Return best match even if low confidence, or indicate no match
    return fuzzyMatch || {
      matched: false,
      confidence: 0,
      candidates: this.findCandidates(name, pos, espnRoster),
      method: 'no_match'
    };
  }

  /**
   * Find exact match in ESPN roster
   */
  findExactMatch(name, team, pos, espnRoster) {
    const normalizedName = this.normalizeName(name);

    for (const player of espnRoster) {
      const espnNormalized = this.normalizeName(player.fullName || player.name);

      if (normalizedName === espnNormalized) {
        // Verify position matches (if provided)
        if (pos && player.position && pos !== player.position) {
          continue;
        }

        return {
          matched: true,
          confidence: 1.0,
          espnId: player.id,
          espnName: player.fullName || player.name,
          method: 'exact_match'
        };
      }
    }

    return null;
  }

  /**
   * Find fuzzy match using Fuse.js
   */
  findFuzzyMatch(name, team, pos, espnRoster) {
    // Filter roster by position if provided
    let candidates = espnRoster;
    if (pos) {
      candidates = espnRoster.filter(p => !p.position || p.position === pos);
    }

    if (candidates.length === 0) {
      candidates = espnRoster; // Fall back to full roster
    }

    // Configure Fuse.js for fuzzy searching
    const fuseOptions = {
      keys: ['fullName', 'name'],
      threshold: 0.3, // Lower is stricter
      includeScore: true,
      ignoreLocation: true,
      useExtendedSearch: false
    };

    const fuse = new Fuse(candidates, fuseOptions);
    const results = fuse.search(name);

    if (results.length > 0) {
      const bestMatch = results[0];
      const confidence = 1 - bestMatch.score; // Convert score to confidence

      return {
        matched: true,
        confidence: Math.round(confidence * 100) / 100,
        espnId: bestMatch.item.id,
        espnName: bestMatch.item.fullName || bestMatch.item.name,
        method: 'fuzzy_match',
        alternatives: results.slice(1, 3).map(r => ({
          name: r.item.fullName || r.item.name,
          confidence: Math.round((1 - r.score) * 100) / 100
        }))
      };
    }

    return null;
  }

  /**
   * Find potential candidates for manual matching
   */
  findCandidates(name, pos, espnRoster) {
    let candidates = espnRoster;

    // Filter by position if provided
    if (pos) {
      candidates = candidates.filter(p => !p.position || p.position === pos);
    }

    // Use Fuse.js to find similar names
    const fuseOptions = {
      keys: ['fullName', 'name'],
      threshold: 0.6, // More lenient for candidates
      includeScore: true,
      ignoreLocation: true
    };

    const fuse = new Fuse(candidates, fuseOptions);
    const results = fuse.search(name);

    return results.slice(0, 5).map(r => ({
      id: r.item.id,
      name: r.item.fullName || r.item.name,
      position: r.item.position,
      team: r.item.proTeam,
      confidence: Math.round((1 - r.score) * 100) / 100
    }));
  }

  /**
   * Manually map a player
   */
  manuallyMapPlayer(rankingPlayer, espnId, espnName) {
    const playerKey = this.createPlayerKey(
      rankingPlayer.name,
      rankingPlayer.team,
      rankingPlayer.pos
    );

    this.mappings[playerKey] = {
      espnId,
      espnName,
      manual: true,
      createdAt: new Date().toISOString()
    };

    this.saveMappings();

    return {
      matched: true,
      confidence: 1.0,
      espnId,
      espnName,
      method: 'manual_mapping'
    };
  }

  /**
   * Save a mapping
   */
  saveMapping(playerKey, matchResult) {
    this.mappings[playerKey] = {
      espnId: matchResult.espnId,
      espnName: matchResult.espnName,
      confidence: matchResult.confidence,
      method: matchResult.method,
      createdAt: new Date().toISOString()
    };

    this.saveMappings();
  }

  /**
   * Create a unique key for a player
   */
  createPlayerKey(name, team, pos) {
    const normalized = this.normalizeName(name);
    const teamStr = team || 'FA';
    const posStr = pos || 'UNKNOWN';
    return `${normalized}|${teamStr}|${posStr}`.toLowerCase();
  }

  /**
   * Normalize player name for matching
   */
  normalizeName(name) {
    if (!name) return '';

    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => !['jr', 'sr', 'ii', 'iii', 'iv', 'v'].includes(word))
      .join(' ');
  }

  /**
   * Update ESPN players from a roster response
   */
  updateESPNPlayersFromRoster(roster) {
    const updated = false;

    roster.forEach(player => {
      const existingIndex = this.espnPlayers.findIndex(p => p.id === player.id);

      if (existingIndex === -1) {
        // New player
        this.espnPlayers.push({
          id: player.id,
          name: player.fullName || player.name,
          position: player.position,
          team: player.proTeam,
          lastSeen: new Date().toISOString()
        });
        updated = true;
      } else {
        // Update existing player
        this.espnPlayers[existingIndex].lastSeen = new Date().toISOString();
      }
    });

    if (updated) {
      this.saveESPNPlayers();
    }
  }

  /**
   * Get match statistics
   */
  getMatchStatistics(rankings, espnRoster) {
    const stats = {
      total: 0,
      matched: 0,
      exact: 0,
      fuzzy: 0,
      manual: 0,
      unmatched: 0,
      byPosition: {}
    };

    Object.entries(rankings.positions).forEach(([position, players]) => {
      stats.byPosition[position] = {
        total: players.length,
        matched: 0,
        unmatched: 0
      };

      players.forEach(player => {
        stats.total++;
        const match = this.matchPlayer(player, espnRoster);

        if (match.matched) {
          stats.matched++;
          stats.byPosition[position].matched++;

          switch (match.method) {
            case 'exact_match':
              stats.exact++;
              break;
            case 'fuzzy_match':
              stats.fuzzy++;
              break;
            case 'manual_mapping':
            case 'saved_mapping':
              stats.manual++;
              break;
          }
        } else {
          stats.unmatched++;
          stats.byPosition[position].unmatched++;
        }
      });
    });

    stats.matchRate = stats.total > 0
      ? Math.round((stats.matched / stats.total) * 100)
      : 0;

    return stats;
  }

  /**
   * Clear all mappings (useful for testing)
   */
  clearMappings() {
    this.mappings = {};
    this.saveMappings();
  }

  /**
   * Get all unmatched players from a rankings set
   */
  getUnmatchedPlayers(rankings, espnRoster) {
    const unmatched = [];

    Object.entries(rankings.positions).forEach(([position, players]) => {
      players.forEach(player => {
        const match = this.matchPlayer(player, espnRoster);
        if (!match.matched || match.confidence < 0.8) {
          unmatched.push({
            ...player,
            position,
            candidates: match.candidates || []
          });
        }
      });
    });

    return unmatched;
  }
}

module.exports = NameMatcher;