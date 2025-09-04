import _ from 'lodash';

/**
 * Analyzes waiver wire and provides pickup/drop recommendations
 */
class WaiverAnalyzer {
  constructor(options = {}) {
    this.leagueManager = options.leagueManager;
    this.rankingsManager = options.rankingsManager;
    
    // Thresholds for recommendations
    this.thresholds = {
      mustAdd: options.mustAddThreshold || 30,        // Top 30 ranked players
      consider: options.considerThreshold || 50,       // Top 50 ranked players
      rostersPercentage: options.rostersPercentage || 0.3,  // 30% rostered threshold
      projectedPointsDiff: options.pointsDiff || 3     // Min points difference
    };
    
    // Position priorities for waiver claims
    this.positionPriority = options.positionPriority || {
      'RB': 1,
      'WR': 2,
      'QB': 3,
      'TE': 4,
      'DST': 5,
      'K': 6
    };
  }
  
  /**
   * Analyze waiver wire and provide recommendations
   * @param {number} leagueId - League ID
   * @param {number} week - Current NFL week
   * @returns {Promise<Object>} Waiver analysis and recommendations
   */
  async analyzeWaiverWire(leagueId, week = null) {
    // Get free agents
    const freeAgents = await this.leagueManager.getFreeAgents(leagueId, week);
    
    // Get current roster
    const myTeam = await this.leagueManager.getMyRoster(leagueId, null, week);
    
    // Get rankings (both weekly and ROS)
    const weeklyRankings = this.rankingsManager.getWeeklyRankings(week);
    const rosRankings = this.rankingsManager.getRestOfSeasonRankings();
    
    // Enhance free agents with rankings
    const enhancedFreeAgents = this.enhanceFreeAgentsWithRankings(
      freeAgents,
      weeklyRankings,
      rosRankings
    );
    
    // Analyze roster needs
    const rosterNeeds = this.analyzeRosterNeeds(myTeam.roster);
    
    // Get top waiver targets
    const waiverTargets = this.identifyWaiverTargets(
      enhancedFreeAgents,
      rosterNeeds
    );
    
    // Get drop candidates from roster
    const dropCandidates = this.identifyDropCandidates(
      myTeam.roster,
      rosRankings
    );
    
    // Generate pickup/drop recommendations
    const recommendations = this.generateRecommendations(
      waiverTargets,
      dropCandidates,
      rosterNeeds
    );
    
    // Identify breakout candidates
    const breakoutCandidates = this.identifyBreakoutCandidates(enhancedFreeAgents);
    
    // Get stash candidates (injured stars, etc.)
    const stashCandidates = this.identifyStashCandidates(enhancedFreeAgents);
    
    return {
      week: week,
      leagueId: leagueId,
      topTargets: waiverTargets.slice(0, 10),
      dropCandidates: dropCandidates,
      recommendations: recommendations,
      breakoutCandidates: breakoutCandidates,
      stashCandidates: stashCandidates,
      rosterNeeds: rosterNeeds,
      summary: this.generateSummary(recommendations, rosterNeeds)
    };
  }
  
  /**
   * Enhance free agents with ranking data
   * @param {Array} freeAgents - Free agent players
   * @param {Array} weeklyRankings - Weekly rankings
   * @param {Array} rosRankings - Rest of season rankings
   * @returns {Array} Enhanced free agents
   */
  enhanceFreeAgentsWithRankings(freeAgents, weeklyRankings, rosRankings) {
    return freeAgents.map(player => {
      const playerName = player.fullName || `${player.firstName} ${player.lastName}`;
      
      const weeklyRank = this.rankingsManager.findPlayerRanking(
        playerName, 
        'weekly'
      );
      
      const rosRank = this.rankingsManager.findPlayerRanking(
        playerName,
        'ros'
      );
      
      return {
        ...player,
        weeklyRanking: weeklyRank?.rank || 999,
        weeklyProjectedPoints: weeklyRank?.points || weeklyRank?.projectedpoints || 0,
        rosRanking: rosRank?.rank || 999,
        rosProjectedPoints: rosRank?.points || rosRank?.projectedpoints || 0,
        percentRostered: player.percentOwned || 0,
        waiverPriority: this.calculateWaiverPriority(player, weeklyRank, rosRank)
      };
    });
  }
  
  /**
   * Calculate waiver priority score
   * @param {Object} player - Player object
   * @param {Object} weeklyRank - Weekly ranking
   * @param {Object} rosRank - ROS ranking
   * @returns {number} Priority score (higher is better)
   */
  calculateWaiverPriority(player, weeklyRank, rosRank) {
    let score = 0;
    
    // Weekly ranking component (40%)
    if (weeklyRank) {
      score += (100 - weeklyRank.rank) * 0.4;
    }
    
    // ROS ranking component (40%)
    if (rosRank) {
      score += (100 - rosRank.rank) * 0.4;
    }
    
    // Ownership percentage component (10%)
    score += (100 - (player.percentOwned || 0)) * 0.1;
    
    // Position scarcity component (10%)
    const positionMultiplier = {
      'RB': 1.2,
      'WR': 1.1,
      'TE': 1.0,
      'QB': 0.9,
      'DST': 0.8,
      'K': 0.7
    };
    score *= positionMultiplier[player.defaultPosition] || 1.0;
    
    return score;
  }
  
  /**
   * Analyze roster needs based on current roster
   * @param {Array} roster - Current roster
   * @returns {Object} Roster needs analysis
   */
  analyzeRosterNeeds(roster) {
    const positionCounts = _.countBy(roster, 'defaultPosition');
    const injuredPlayers = roster.filter(p => 
      p.injuryStatus && p.injuryStatus !== 'ACTIVE'
    );
    
    const needs = {
      immediate: [],
      moderate: [],
      depth: [],
      positionCounts: positionCounts,
      injuredPositions: _.countBy(injuredPlayers, 'defaultPosition')
    };
    
    // Define ideal roster composition
    const idealComposition = {
      'QB': { min: 1, ideal: 2 },
      'RB': { min: 4, ideal: 5 },
      'WR': { min: 4, ideal: 5 },
      'TE': { min: 1, ideal: 2 },
      'DST': { min: 1, ideal: 1 },
      'K': { min: 1, ideal: 1 }
    };
    
    // Analyze each position
    Object.entries(idealComposition).forEach(([position, requirements]) => {
      const currentCount = positionCounts[position] || 0;
      const injuredCount = needs.injuredPositions[position] || 0;
      const healthyCount = currentCount - injuredCount;
      
      if (healthyCount < requirements.min) {
        needs.immediate.push({
          position: position,
          severity: 'CRITICAL',
          currentCount: currentCount,
          healthyCount: healthyCount,
          needed: requirements.min - healthyCount
        });
      } else if (currentCount < requirements.ideal) {
        needs.moderate.push({
          position: position,
          severity: 'MODERATE',
          currentCount: currentCount,
          healthyCount: healthyCount,
          needed: requirements.ideal - currentCount
        });
      } else if (injuredCount > 0) {
        needs.depth.push({
          position: position,
          severity: 'DEPTH',
          currentCount: currentCount,
          healthyCount: healthyCount,
          injuredCount: injuredCount
        });
      }
    });
    
    return needs;
  }
  
  /**
   * Identify top waiver wire targets
   * @param {Array} freeAgents - Enhanced free agents
   * @param {Object} rosterNeeds - Roster needs analysis
   * @returns {Array} Top waiver targets
   */
  identifyWaiverTargets(freeAgents, rosterNeeds) {
    // Filter to relevant players
    const relevantPlayers = freeAgents.filter(player => 
      player.weeklyRanking <= 100 || 
      player.rosRanking <= 100 ||
      player.percentRostered >= 10
    );
    
    // Apply position need boost
    const boostedPlayers = relevantPlayers.map(player => {
      let boost = 1.0;
      
      // Check if position is needed
      const immediateNeed = rosterNeeds.immediate.find(
        n => n.position === player.defaultPosition
      );
      const moderateNeed = rosterNeeds.moderate.find(
        n => n.position === player.defaultPosition
      );
      
      if (immediateNeed) {
        boost = 1.5;
      } else if (moderateNeed) {
        boost = 1.2;
      }
      
      return {
        ...player,
        adjustedPriority: player.waiverPriority * boost
      };
    });
    
    // Sort by adjusted priority
    return _.orderBy(boostedPlayers, ['adjustedPriority'], ['desc']);
  }
  
  /**
   * Identify drop candidates from roster
   * @param {Array} roster - Current roster
   * @param {Array} rosRankings - ROS rankings
   * @returns {Array} Drop candidates
   */
  identifyDropCandidates(roster, rosRankings) {
    const enhancedRoster = roster.map(player => {
      const playerName = player.fullName || `${player.firstName} ${player.lastName}`;
      const rosRank = this.rankingsManager.findPlayerRanking(playerName, 'ros');
      
      return {
        ...player,
        rosRanking: rosRank?.rank || 999,
        rosProjectedPoints: rosRank?.points || rosRank?.projectedpoints || 0,
        dropScore: this.calculateDropScore(player, rosRank)
      };
    });
    
    // Sort by drop score (higher score = better drop candidate)
    const sorted = _.orderBy(enhancedRoster, ['dropScore'], ['desc']);
    
    // Return top drop candidates
    return sorted.slice(0, 5).map(player => ({
      player: player,
      reason: this.getDropReason(player),
      dropScore: player.dropScore
    }));
  }
  
  /**
   * Calculate drop score for a player
   * @param {Object} player - Player object
   * @param {Object} rosRank - ROS ranking
   * @returns {number} Drop score
   */
  calculateDropScore(player, rosRank) {
    let score = 0;
    
    // Poor ROS ranking
    if (!rosRank || rosRank.rank > 150) {
      score += 50;
    } else if (rosRank.rank > 100) {
      score += 30;
    } else if (rosRank.rank > 75) {
      score += 10;
    }
    
    // Injury status
    if (player.injuryStatus === 'IR' || player.injuryStatus === 'OUT') {
      score += 40;
    } else if (player.injuryStatus === 'DOUBTFUL') {
      score += 20;
    }
    
    // Position value (kickers and defenses are more droppable)
    if (player.defaultPosition === 'K' || player.defaultPosition === 'DST') {
      score += 20;
    }
    
    // Bye week considerations
    if (player.byeWeek && player.byeWeek <= this.currentWeek + 1) {
      score += 15;
    }
    
    return score;
  }
  
  /**
   * Get reason for dropping a player
   * @param {Object} player - Player object
   * @returns {string} Drop reason
   */
  getDropReason(player) {
    const reasons = [];
    
    if (player.rosRanking > 150) {
      reasons.push(`Poor ROS ranking (#${player.rosRanking})`);
    }
    
    if (player.injuryStatus && player.injuryStatus !== 'ACTIVE') {
      reasons.push(`Injury: ${player.injuryStatus}`);
    }
    
    if (player.byeWeek && player.byeWeek <= this.currentWeek + 1) {
      reasons.push(`Upcoming bye week ${player.byeWeek}`);
    }
    
    if (player.defaultPosition === 'K' || player.defaultPosition === 'DST') {
      reasons.push('Replaceable position');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Lower priority player';
  }
  
  /**
   * Generate pickup/drop recommendations
   * @param {Array} waiverTargets - Top waiver targets
   * @param {Array} dropCandidates - Drop candidates
   * @param {Object} rosterNeeds - Roster needs
   * @returns {Array} Recommendations
   */
  generateRecommendations(waiverTargets, dropCandidates, rosterNeeds) {
    const recommendations = [];
    const usedDropCandidates = new Set();
    
    // Priority 1: Fill immediate needs
    rosterNeeds.immediate.forEach(need => {
      const targets = waiverTargets.filter(
        p => p.defaultPosition === need.position
      ).slice(0, need.needed);
      
      targets.forEach(target => {
        const dropCandidate = dropCandidates.find(
          d => !usedDropCandidates.has(d.player.id)
        );
        
        if (dropCandidate) {
          recommendations.push({
            priority: 'HIGH',
            action: 'ADD',
            player: target,
            dropPlayer: dropCandidate.player,
            reason: `Critical need at ${need.position}`,
            confidence: this.calculateConfidence(target, dropCandidate)
          });
          usedDropCandidates.add(dropCandidate.player.id);
        }
      });
    });
    
    // Priority 2: Top value adds
    const topValueAdds = waiverTargets
      .filter(p => p.weeklyRanking <= this.thresholds.mustAdd)
      .slice(0, 3);
    
    topValueAdds.forEach(target => {
      const dropCandidate = dropCandidates.find(
        d => !usedDropCandidates.has(d.player.id)
      );
      
      if (dropCandidate && this.isWorthSwap(target, dropCandidate.player)) {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'ADD',
          player: target,
          dropPlayer: dropCandidate.player,
          reason: `High value player available (Rank #${target.weeklyRanking})`,
          confidence: this.calculateConfidence(target, dropCandidate)
        });
        usedDropCandidates.add(dropCandidate.player.id);
      }
    });
    
    return recommendations;
  }
  
  /**
   * Check if swap is worth making
   * @param {Object} addPlayer - Player to add
   * @param {Object} dropPlayer - Player to drop
   * @returns {boolean} Whether swap is worth it
   */
  isWorthSwap(addPlayer, dropPlayer) {
    // Check ranking difference
    const rankDiff = dropPlayer.rosRanking - addPlayer.rosRanking;
    if (rankDiff < 20) return false;
    
    // Check projected points difference
    const pointsDiff = addPlayer.rosProjectedPoints - dropPlayer.rosProjectedPoints;
    if (pointsDiff < this.thresholds.projectedPointsDiff) return false;
    
    return true;
  }
  
  /**
   * Calculate confidence in recommendation
   * @param {Object} addPlayer - Player to add
   * @param {Object} dropCandidate - Drop candidate
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(addPlayer, dropCandidate) {
    let confidence = 50;
    
    // Ranking difference
    const rankDiff = dropCandidate.player.rosRanking - addPlayer.rosRanking;
    if (rankDiff > 50) confidence += 30;
    else if (rankDiff > 30) confidence += 20;
    else if (rankDiff > 15) confidence += 10;
    
    // Ownership percentage
    if (addPlayer.percentRostered < 10) confidence -= 10;
    else if (addPlayer.percentRostered > 30) confidence += 10;
    
    // Position value
    if (addPlayer.defaultPosition === 'RB' || addPlayer.defaultPosition === 'WR') {
      confidence += 10;
    }
    
    return Math.min(100, Math.max(0, confidence));
  }
  
  /**
   * Identify potential breakout candidates
   * @param {Array} freeAgents - Enhanced free agents
   * @returns {Array} Breakout candidates
   */
  identifyBreakoutCandidates(freeAgents) {
    return freeAgents
      .filter(player => {
        // Low ownership but good recent performance
        const lowOwnership = player.percentRostered < 20;
        const risingRank = player.weeklyRanking < player.rosRanking;
        const goodProjection = player.weeklyProjectedPoints > 10;
        
        return lowOwnership && (risingRank || goodProjection);
      })
      .slice(0, 5)
      .map(player => ({
        player: player,
        weeklyRank: player.weeklyRanking,
        rosRank: player.rosRanking,
        ownership: player.percentRostered,
        breakoutReason: this.getBreakoutReason(player)
      }));
  }
  
  /**
   * Get breakout reason for player
   * @param {Object} player - Player object
   * @returns {string} Breakout reason
   */
  getBreakoutReason(player) {
    const reasons = [];
    
    if (player.weeklyRanking < player.rosRanking - 20) {
      reasons.push('Trending up in rankings');
    }
    
    if (player.weeklyProjectedPoints > 12) {
      reasons.push(`Strong projection (${player.weeklyProjectedPoints.toFixed(1)} pts)`);
    }
    
    if (player.percentRostered < 10) {
      reasons.push('Widely available');
    }
    
    return reasons.join(', ') || 'Potential breakout';
  }
  
  /**
   * Identify stash candidates (injured stars, suspended players)
   * @param {Array} freeAgents - Enhanced free agents
   * @returns {Array} Stash candidates
   */
  identifyStashCandidates(freeAgents) {
    return freeAgents
      .filter(player => {
        const hasHighROS = player.rosRanking <= 50;
        const currentlyUnavailable = 
          player.injuryStatus === 'IR' || 
          player.injuryStatus === 'SUSPENDED';
        
        return hasHighROS && currentlyUnavailable;
      })
      .slice(0, 3)
      .map(player => ({
        player: player,
        rosRank: player.rosRanking,
        status: player.injuryStatus,
        estimatedReturn: player.estimatedReturn || 'Unknown',
        stashValue: this.calculateStashValue(player)
      }));
  }
  
  /**
   * Calculate stash value for injured/suspended players
   * @param {Object} player - Player object
   * @returns {string} Stash value rating
   */
  calculateStashValue(player) {
    if (player.rosRanking <= 20) return 'ELITE';
    if (player.rosRanking <= 35) return 'HIGH';
    if (player.rosRanking <= 50) return 'MODERATE';
    return 'LOW';
  }
  
  /**
   * Generate summary of waiver analysis
   * @param {Array} recommendations - Recommendations
   * @param {Object} rosterNeeds - Roster needs
   * @returns {string} Summary text
   */
  generateSummary(recommendations, rosterNeeds) {
    const highPriority = recommendations.filter(r => r.priority === 'HIGH');
    const criticalNeeds = rosterNeeds.immediate;
    
    if (highPriority.length > 0) {
      return `${highPriority.length} high-priority waiver moves recommended. Critical needs at: ${criticalNeeds.map(n => n.position).join(', ')}.`;
    } else if (recommendations.length > 0) {
      return `${recommendations.length} waiver moves available to improve roster depth.`;
    } else {
      return 'No urgent waiver moves needed. Consider stashing high-upside players.';
    }
  }
  
  /**
   * Get FAAB bid recommendations
   * @param {Object} player - Player to bid on
   * @param {number} totalFAAB - Total FAAB budget
   * @param {number} remainingFAAB - Remaining FAAB
   * @returns {Object} FAAB bid recommendation
   */
  getFAABRecommendation(player, totalFAAB = 100, remainingFAAB = 100) {
    const percentOfBudget = remainingFAAB / totalFAAB;
    let bidAmount = 0;
    let bidPercentage = 0;
    
    // Base bid on ranking and position
    if (player.weeklyRanking <= 20) {
      bidPercentage = 30;
    } else if (player.weeklyRanking <= 40) {
      bidPercentage = 20;
    } else if (player.weeklyRanking <= 60) {
      bidPercentage = 10;
    } else {
      bidPercentage = 5;
    }
    
    // Adjust for position scarcity
    if (player.defaultPosition === 'RB') {
      bidPercentage *= 1.3;
    } else if (player.defaultPosition === 'WR') {
      bidPercentage *= 1.1;
    }
    
    // Adjust for remaining budget
    bidPercentage *= percentOfBudget;
    
    // Calculate actual bid
    bidAmount = Math.round((bidPercentage / 100) * remainingFAAB);
    
    return {
      recommendedBid: bidAmount,
      bidPercentage: bidPercentage,
      confidence: this.calculateFAABConfidence(player, bidPercentage),
      minBid: Math.max(1, Math.round(bidAmount * 0.7)),
      maxBid: Math.round(bidAmount * 1.3)
    };
  }
  
  /**
   * Calculate FAAB bid confidence
   * @param {Object} player - Player object
   * @param {number} bidPercentage - Bid percentage
   * @returns {string} Confidence level
   */
  calculateFAABConfidence(player, bidPercentage) {
    if (player.weeklyRanking <= 30 && bidPercentage >= 20) {
      return 'HIGH';
    } else if (player.weeklyRanking <= 50 && bidPercentage >= 10) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }
}

export default WaiverAnalyzer;