import _ from 'lodash';

/**
 * Optimizes fantasy football lineups based on rankings and matchups
 */
class LineupOptimizer {
  constructor(options = {}) {
    this.leagueManager = options.leagueManager;
    this.rankingsManager = options.rankingsManager;
    
    // Default lineup positions (can be overridden)
    this.lineupRequirements = options.lineupRequirements || {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,  // RB/WR/TE
      DST: 1,
      K: 1
    };
    
    // Position eligibility for FLEX spots
    this.flexEligible = ['RB', 'WR', 'TE'];
    this.superFlexEligible = ['QB', 'RB', 'WR', 'TE'];
  }
  
  /**
   * Generate optimal lineup for a specific week
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   * @param {string} rankingType - Type of rankings to use ('weekly' or 'ros')
   * @returns {Promise<Object>} Optimal lineup with starters and bench
   */
  async optimizeLineup(leagueId, week, rankingType = 'weekly') {
    // Get current roster
    const myTeam = await this.leagueManager.getMyRoster(leagueId, null, week);
    
    if (!myTeam || !myTeam.roster) {
      throw new Error('Unable to fetch roster');
    }
    
    // Get rankings for the week
    const rankings = rankingType === 'weekly' 
      ? this.rankingsManager.getWeeklyRankings(week)
      : this.rankingsManager.getRestOfSeasonRankings();
    
    // Enhance roster with rankings
    const enhancedRoster = this.enhanceRosterWithRankings(myTeam.roster, rankings);
    
    // Filter out injured and bye week players
    const availablePlayers = this.filterAvailablePlayers(enhancedRoster, week);
    
    // Generate optimal lineup
    const optimizedLineup = this.generateOptimalLineup(availablePlayers);
    
    // Get current lineup for comparison
    const currentLineup = await this.leagueManager.getLineup(leagueId, week);
    
    // Calculate projected points difference
    const projectedImprovement = this.calculateProjectedImprovement(
      currentLineup,
      optimizedLineup
    );
    
    return {
      optimal: optimizedLineup,
      current: currentLineup,
      changes: this.identifyLineupChanges(currentLineup, optimizedLineup),
      projectedImprovement: projectedImprovement,
      week: week,
      leagueId: leagueId
    };
  }
  
  /**
   * Enhance roster with ranking information
   * @param {Array} roster - Array of player objects
   * @param {Array} rankings - Array of ranking objects
   * @returns {Array} Enhanced roster
   */
  enhanceRosterWithRankings(roster, rankings) {
    return roster.map(player => {
      const playerName = player.fullName || `${player.firstName} ${player.lastName}`;
      const ranking = this.rankingsManager.findPlayerRanking(playerName, 'weekly');
      
      return {
        ...player,
        ranking: ranking?.rank || 999,
        projectedPoints: ranking?.points || ranking?.projectedpoints || player.projectedPoints || 0,
        rankingTier: ranking?.tier || null
      };
    });
  }
  
  /**
   * Filter out unavailable players (injured, bye, suspended)
   * @param {Array} roster - Enhanced roster
   * @param {number} week - NFL week
   * @returns {Array} Available players
   */
  filterAvailablePlayers(roster, week) {
    return roster.filter(player => {
      // Check injury status
      if (player.injuryStatus) {
        const unavailableStatuses = ['OUT', 'SUSPENDED', 'IR'];
        if (unavailableStatuses.includes(player.injuryStatus)) {
          return false;
        }
      }
      
      // Check bye week (if available in data)
      if (player.byeWeek === week) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Generate optimal lineup based on rankings
   * @param {Array} availablePlayers - Available players
   * @returns {Object} Optimal lineup with starters and bench
   */
  generateOptimalLineup(availablePlayers) {
    const lineup = {
      starters: [],
      bench: []
    };
    
    // Group players by position
    const playersByPosition = _.groupBy(availablePlayers, 'defaultPosition');
    
    // Used players tracker
    const usedPlayers = new Set();
    
    // Fill required positions first (except FLEX)
    Object.entries(this.lineupRequirements).forEach(([position, count]) => {
      if (position === 'FLEX' || position === 'SUPERFLEX') {
        return; // Handle FLEX spots last
      }
      
      const positionPlayers = playersByPosition[position] || [];
      const sortedPlayers = _.sortBy(positionPlayers, 'ranking');
      
      for (let i = 0; i < count && i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        if (!usedPlayers.has(player.id)) {
          lineup.starters.push({
            ...player,
            lineupPosition: position
          });
          usedPlayers.add(player.id);
        }
      }
    });
    
    // Fill FLEX positions
    if (this.lineupRequirements.FLEX) {
      const flexPlayers = this.getFlexEligiblePlayers(
        availablePlayers,
        usedPlayers,
        this.flexEligible
      );
      
      const sortedFlexPlayers = _.sortBy(flexPlayers, 'ranking');
      
      for (let i = 0; i < this.lineupRequirements.FLEX && i < sortedFlexPlayers.length; i++) {
        const player = sortedFlexPlayers[i];
        lineup.starters.push({
          ...player,
          lineupPosition: 'FLEX'
        });
        usedPlayers.add(player.id);
      }
    }
    
    // Fill SUPERFLEX positions if exists
    if (this.lineupRequirements.SUPERFLEX) {
      const superFlexPlayers = this.getFlexEligiblePlayers(
        availablePlayers,
        usedPlayers,
        this.superFlexEligible
      );
      
      const sortedSuperFlexPlayers = _.sortBy(superFlexPlayers, 'ranking');
      
      for (let i = 0; i < this.lineupRequirements.SUPERFLEX && i < sortedSuperFlexPlayers.length; i++) {
        const player = sortedSuperFlexPlayers[i];
        lineup.starters.push({
          ...player,
          lineupPosition: 'SUPERFLEX'
        });
        usedPlayers.add(player.id);
      }
    }
    
    // Add remaining players to bench
    availablePlayers.forEach(player => {
      if (!usedPlayers.has(player.id)) {
        lineup.bench.push(player);
      }
    });
    
    // Sort bench by ranking
    lineup.bench = _.sortBy(lineup.bench, 'ranking');
    
    return lineup;
  }
  
  /**
   * Get FLEX eligible players
   * @param {Array} players - All available players
   * @param {Set} usedPlayers - Set of used player IDs
   * @param {Array} eligiblePositions - Positions eligible for FLEX
   * @returns {Array} FLEX eligible players
   */
  getFlexEligiblePlayers(players, usedPlayers, eligiblePositions) {
    return players.filter(player => 
      eligiblePositions.includes(player.defaultPosition) && 
      !usedPlayers.has(player.id)
    );
  }
  
  /**
   * Identify lineup changes between current and optimal
   * @param {Object} currentLineup - Current lineup
   * @param {Object} optimalLineup - Optimal lineup
   * @returns {Array} Array of changes
   */
  identifyLineupChanges(currentLineup, optimalLineup) {
    const changes = [];
    
    // Create maps for easy comparison
    const currentStarterIds = new Set(
      currentLineup.starters.map(p => p.id)
    );
    const optimalStarterIds = new Set(
      optimalLineup.starters.map(p => p.id)
    );
    
    // Find players to bench
    currentLineup.starters.forEach(player => {
      if (!optimalStarterIds.has(player.id)) {
        changes.push({
          action: 'BENCH',
          player: player,
          reason: 'Better option available'
        });
      }
    });
    
    // Find players to start
    optimalLineup.starters.forEach(player => {
      if (!currentStarterIds.has(player.id)) {
        changes.push({
          action: 'START',
          player: player,
          position: player.lineupPosition,
          reason: `Ranked #${player.ranking} with ${player.projectedPoints} projected points`
        });
      }
    });
    
    return changes;
  }
  
  /**
   * Calculate projected improvement
   * @param {Object} currentLineup - Current lineup
   * @param {Object} optimalLineup - Optimal lineup
   * @returns {number} Projected point improvement
   */
  calculateProjectedImprovement(currentLineup, optimalLineup) {
    const currentPoints = _.sumBy(currentLineup.starters, 'projectedPoints');
    const optimalPoints = _.sumBy(optimalLineup.starters, 'projectedPoints');
    
    return {
      currentProjected: currentPoints,
      optimalProjected: optimalPoints,
      improvement: optimalPoints - currentPoints,
      percentImprovement: currentPoints > 0 
        ? ((optimalPoints - currentPoints) / currentPoints) * 100 
        : 0
    };
  }
  
  /**
   * Get lineup recommendations with explanations
   * @param {number} leagueId - League ID
   * @param {number} week - NFL week
   * @returns {Promise<Object>} Detailed recommendations
   */
  async getLineupRecommendations(leagueId, week) {
    const optimized = await this.optimizeLineup(leagueId, week);
    
    const recommendations = {
      summary: this.generateSummary(optimized),
      mustStart: this.identifyMustStarts(optimized.optimal.starters),
      sitPlayers: this.identifySitPlayers(optimized.current.starters, optimized.optimal),
      flexDecision: this.analyzeFlexDecision(optimized.optimal),
      injuryConsiderations: await this.getInjuryConsiderations(leagueId),
      confidenceScore: this.calculateConfidenceScore(optimized)
    };
    
    return {
      ...optimized,
      recommendations
    };
  }
  
  /**
   * Generate summary of lineup optimization
   * @param {Object} optimized - Optimized lineup data
   * @returns {string} Summary text
   */
  generateSummary(optimized) {
    const improvement = optimized.projectedImprovement.improvement;
    
    if (improvement > 10) {
      return `Strong recommendation to make changes. Projected ${improvement.toFixed(1)} point improvement.`;
    } else if (improvement > 5) {
      return `Moderate improvements available. Projected ${improvement.toFixed(1)} point improvement.`;
    } else if (improvement > 0) {
      return `Minor optimizations available. Projected ${improvement.toFixed(1)} point improvement.`;
    } else {
      return 'Your current lineup is already optimal!';
    }
  }
  
  /**
   * Identify must-start players
   * @param {Array} starters - Optimal starters
   * @returns {Array} Must-start players
   */
  identifyMustStarts(starters) {
    return starters
      .filter(player => player.ranking <= 10 || player.projectedPoints >= 15)
      .map(player => ({
        player: player.fullName || `${player.firstName} ${player.lastName}`,
        position: player.lineupPosition,
        ranking: player.ranking,
        projectedPoints: player.projectedPoints,
        confidence: 'HIGH'
      }));
  }
  
  /**
   * Identify players to sit
   * @param {Array} currentStarters - Current starters
   * @param {Object} optimal - Optimal lineup
   * @returns {Array} Players to sit
   */
  identifySitPlayers(currentStarters, optimal) {
    const optimalStarterIds = new Set(optimal.starters.map(p => p.id));
    
    return currentStarters
      .filter(player => !optimalStarterIds.has(player.id))
      .map(player => ({
        player: player.fullName || `${player.firstName} ${player.lastName}`,
        currentPosition: player.lineupPosition,
        ranking: player.ranking,
        reason: this.getSitReason(player, optimal)
      }));
  }
  
  /**
   * Get reason for sitting a player
   * @param {Object} player - Player to sit
   * @param {Object} optimal - Optimal lineup
   * @returns {string} Reason
   */
  getSitReason(player, optimal) {
    if (player.injuryStatus && player.injuryStatus !== 'ACTIVE') {
      return `Injury concern: ${player.injuryStatus}`;
    }
    
    if (player.ranking > 50) {
      return `Low ranking (#${player.ranking})`;
    }
    
    const replacement = optimal.starters.find(
      p => p.lineupPosition === player.lineupPosition
    );
    
    if (replacement) {
      return `Better option: ${replacement.fullName || replacement.firstName + ' ' + replacement.lastName} (Rank #${replacement.ranking})`;
    }
    
    return 'Better options available';
  }
  
  /**
   * Analyze FLEX position decision
   * @param {Object} optimal - Optimal lineup
   * @returns {Object} FLEX analysis
   */
  analyzeFlexDecision(optimal) {
    const flexPlayer = optimal.starters.find(p => p.lineupPosition === 'FLEX');
    
    if (!flexPlayer) {
      return { hasFlexPlayer: false };
    }
    
    // Find next best options
    const alternativeFlexOptions = optimal.bench
      .filter(p => this.flexEligible.includes(p.defaultPosition))
      .slice(0, 3);
    
    return {
      hasFlexPlayer: true,
      current: {
        player: flexPlayer.fullName || `${flexPlayer.firstName} ${flexPlayer.lastName}`,
        position: flexPlayer.defaultPosition,
        ranking: flexPlayer.ranking,
        projectedPoints: flexPlayer.projectedPoints
      },
      alternatives: alternativeFlexOptions.map(p => ({
        player: p.fullName || `${p.firstName} ${p.lastName}`,
        position: p.defaultPosition,
        ranking: p.ranking,
        projectedPoints: p.projectedPoints,
        pointsDifference: flexPlayer.projectedPoints - p.projectedPoints
      }))
    };
  }
  
  /**
   * Get injury considerations for lineup decisions
   * @param {number} leagueId - League ID
   * @returns {Promise<Array>} Injury considerations
   */
  async getInjuryConsiderations(leagueId) {
    const injuredPlayers = await this.leagueManager.getInjuredPlayers(leagueId);
    
    return injuredPlayers.map(player => ({
      player: player.fullName || `${player.firstName} ${player.lastName}`,
      status: player.injuryStatus,
      recommendation: this.getInjuryRecommendation(player.injuryStatus)
    }));
  }
  
  /**
   * Get recommendation based on injury status
   * @param {string} status - Injury status
   * @returns {string} Recommendation
   */
  getInjuryRecommendation(status) {
    const recommendations = {
      'QUESTIONABLE': 'Monitor before game time - have backup ready',
      'DOUBTFUL': 'Strongly consider benching',
      'OUT': 'Do not start',
      'IR': 'Ineligible to play',
      'SUSPENDED': 'Ineligible to play'
    };
    
    return recommendations[status] || 'Monitor status';
  }
  
  /**
   * Calculate confidence score for recommendations
   * @param {Object} optimized - Optimized lineup
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidenceScore(optimized) {
    let score = 100;
    
    // Reduce confidence if improvement is minimal
    if (optimized.projectedImprovement.improvement < 2) {
      score -= 20;
    }
    
    // Reduce confidence if many injured players
    const injuredStarters = optimized.optimal.starters.filter(
      p => p.injuryStatus && p.injuryStatus !== 'ACTIVE'
    );
    score -= injuredStarters.length * 10;
    
    // Reduce confidence if rankings are missing
    const unrankedStarters = optimized.optimal.starters.filter(
      p => p.ranking === 999
    );
    score -= unrankedStarters.length * 15;
    
    return Math.max(0, Math.min(100, score));
  }
}

export default LineupOptimizer;