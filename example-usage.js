#!/usr/bin/env node

/**
 * Example usage of the Fantasy Football Manager
 * 
 * This script demonstrates how to use the various modules
 * to manage your fantasy football leagues programmatically
 */

import 'dotenv/config';
import LeagueManager from './src/my-leagues/LeagueManager.js';
import RankingsManager from './src/rankings/RankingsManager.js';
import LineupOptimizer from './src/lineup-optimizer/LineupOptimizer.js';
import WaiverAnalyzer from './src/waiver-analysis/WaiverAnalyzer.js';

async function main() {
    console.log('🏈 Fantasy Football Manager - Example Usage\n');
    console.log('═══════════════════════════════════════════\n');
    
    // Initialize managers
    const leagueManager = new LeagueManager();
    const rankingsManager = new RankingsManager();
    
    // Load leagues from environment or config
    const leagueConfigs = [];
    
    if (process.env.LEAGUE1_ID) {
        leagueConfigs.push({
            id: parseInt(process.env.LEAGUE1_ID),
            name: 'League 1',
            espnS2: process.env.LEAGUE1_ESPN_S2,
            SWID: process.env.LEAGUE1_SWID,
            teamName: process.env.LEAGUE1_TEAM_NAME || 'My Team',
            active: true
        });
    }
    
    if (leagueConfigs.length === 0) {
        console.error('❌ No leagues configured. Please set up your .env file.');
        console.log('\nExample .env file:');
        console.log('LEAGUE1_ID=123456');
        console.log('LEAGUE1_ESPN_S2=your_espn_s2_cookie');
        console.log('LEAGUE1_SWID=your_swid_cookie');
        console.log('LEAGUE1_TEAM_NAME=Your Team Name');
        return;
    }
    
    leagueManager.loadLeagues(leagueConfigs);
    
    // Create sample rankings if they don't exist
    console.log('📊 Setting up sample rankings...\n');
    const sampleWeeklyRankings = [
        { rank: 1, name: "Josh Allen", position: "QB", team: "BUF", points: 25.5 },
        { rank: 2, name: "Christian McCaffrey", position: "RB", team: "SF", points: 24.2 },
        { rank: 3, name: "Tyreek Hill", position: "WR", team: "MIA", points: 22.8 },
        { rank: 4, name: "Austin Ekeler", position: "RB", team: "LAC", points: 21.5 },
        { rank: 5, name: "Stefon Diggs", position: "WR", team: "BUF", points: 20.3 },
        { rank: 6, name: "Justin Jefferson", position: "WR", team: "MIN", points: 19.8 },
        { rank: 7, name: "Patrick Mahomes", position: "QB", team: "KC", points: 23.2 },
        { rank: 8, name: "Travis Kelce", position: "TE", team: "KC", points: 17.5 },
        { rank: 9, name: "Saquon Barkley", position: "RB", team: "NYG", points: 18.9 },
        { rank: 10, name: "CeeDee Lamb", position: "WR", team: "DAL", points: 18.2 }
    ];
    
    rankingsManager.saveRankings(sampleWeeklyRankings, 'week1_sample.json');
    await rankingsManager.loadWeeklyRankings(1, 'week1_sample.json');
    
    // Initialize optimizer and analyzer
    const lineupOptimizer = new LineupOptimizer({
        leagueManager: leagueManager,
        rankingsManager: rankingsManager
    });
    
    const waiverAnalyzer = new WaiverAnalyzer({
        leagueManager: leagueManager,
        rankingsManager: rankingsManager
    });
    
    // Example 1: Get League Summary
    console.log('📋 EXAMPLE 1: League Summary');
    console.log('─────────────────────────────\n');
    
    try {
        const summaries = await leagueManager.getLeaguesSummary();
        summaries.forEach(summary => {
            if (!summary.error) {
                console.log(`League: ${summary.leagueName}`);
                console.log(`  Team: ${summary.teamName}`);
                console.log(`  Record: ${summary.record}`);
                console.log(`  Points: ${summary.points}`);
                console.log(`  Roster Size: ${summary.rosterSize}\n`);
            } else {
                console.log(`League: ${summary.leagueName}`);
                console.log(`  Error: ${summary.error}\n`);
            }
        });
    } catch (error) {
        console.error('Error getting league summary:', error.message);
    }
    
    // Example 2: Get Current Roster
    console.log('\n📋 EXAMPLE 2: Current Roster');
    console.log('────────────────────────────\n');
    
    try {
        const leagueId = leagueManager.leagues[0].id;
        const myTeam = await leagueManager.getMyRoster(leagueId);
        
        console.log(`Team: ${myTeam.name}`);
        console.log(`Roster (${myTeam.roster?.length || 0} players):\n`);
        
        if (myTeam.roster) {
            // Group by position
            const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
            positions.forEach(pos => {
                const players = myTeam.roster.filter(p => p.defaultPosition === pos);
                if (players.length > 0) {
                    console.log(`${pos}:`);
                    players.forEach(player => {
                        const name = player.fullName || `${player.firstName} ${player.lastName}`;
                        const status = player.injuryStatus || 'Healthy';
                        console.log(`  - ${name} (${player.proTeam || 'FA'}) - ${status}`);
                    });
                    console.log();
                }
            });
        }
    } catch (error) {
        console.error('Error getting roster:', error.message);
    }
    
    // Example 3: Lineup Optimization
    console.log('\n🎯 EXAMPLE 3: Lineup Optimization');
    console.log('──────────────────────────────────\n');
    
    try {
        const leagueId = leagueManager.leagues[0].id;
        const week = 1;
        
        console.log(`Optimizing lineup for Week ${week}...\n`);
        const optimization = await lineupOptimizer.optimizeLineup(leagueId, week);
        
        console.log('Optimization Results:');
        console.log(`  Current Projected: ${optimization.projectedImprovement.currentProjected?.toFixed(1)} points`);
        console.log(`  Optimal Projected: ${optimization.projectedImprovement.optimalProjected?.toFixed(1)} points`);
        console.log(`  Improvement: +${optimization.projectedImprovement.improvement?.toFixed(1)} points\n`);
        
        if (optimization.changes.length > 0) {
            console.log('Recommended Changes:');
            optimization.changes.forEach(change => {
                const playerName = change.player.fullName || 
                                 `${change.player.firstName} ${change.player.lastName}`;
                console.log(`  ${change.action}: ${playerName} - ${change.reason}`);
            });
        } else {
            console.log('Your lineup is already optimal!');
        }
    } catch (error) {
        console.error('Error optimizing lineup:', error.message);
    }
    
    // Example 4: Waiver Wire Analysis (simplified)
    console.log('\n\n🔍 EXAMPLE 4: Top Waiver Targets');
    console.log('─────────────────────────────────\n');
    
    try {
        const leagueId = leagueManager.leagues[0].id;
        const week = 1;
        
        console.log('Analyzing waiver wire...\n');
        
        // Get free agents
        const freeAgents = await leagueManager.getFreeAgents(leagueId, week);
        
        console.log(`Found ${freeAgents.length} free agents\n`);
        
        // Display top available players by position
        const positions = ['RB', 'WR', 'QB', 'TE'];
        positions.forEach(pos => {
            const positionPlayers = freeAgents
                .filter(p => p.defaultPosition === pos)
                .sort((a, b) => (b.percentOwned || 0) - (a.percentOwned || 0))
                .slice(0, 3);
            
            if (positionPlayers.length > 0) {
                console.log(`Top Available ${pos}s:`);
                positionPlayers.forEach(player => {
                    const name = player.fullName || `${player.firstName} ${player.lastName}`;
                    const owned = player.percentOwned || 0;
                    console.log(`  - ${name} (${player.proTeam || 'FA'}) - ${owned.toFixed(1)}% owned`);
                });
                console.log();
            }
        });
    } catch (error) {
        console.error('Error analyzing waiver wire:', error.message);
    }
    
    // Example 5: Player Search
    console.log('\n🔎 EXAMPLE 5: Player Search');
    console.log('────────────────────────────\n');
    
    try {
        const leagueId = leagueManager.leagues[0].id;
        const searchName = "Patrick Mahomes"; // Example player
        
        console.log(`Searching for "${searchName}"...\n`);
        const player = await leagueManager.findPlayer(searchName, leagueId);
        
        if (player) {
            console.log('Player Found:');
            console.log(`  Name: ${player.fullName || player.firstName + ' ' + player.lastName}`);
            console.log(`  Position: ${player.defaultPosition}`);
            console.log(`  Team: ${player.proTeam || 'FA'}`);
            console.log(`  Status: ${player.status}`);
            if (player.status === 'rostered') {
                console.log(`  Rostered by: ${player.team}`);
            }
        } else {
            console.log('Player not found in league');
        }
    } catch (error) {
        console.error('Error searching for player:', error.message);
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('            Examples Complete!');
    console.log('═══════════════════════════════════════════\n');
    
    console.log('To start the web interface, run:');
    console.log('  node app.js\n');
    console.log('Then open: http://localhost:3000\n');
}

// Run examples
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});