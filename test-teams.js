#!/usr/bin/env node

/**
 * Test script to verify team IDs and names in the league
 */

import dotenv from 'dotenv';
import Client from './src/client/client.js';

// Load environment variables
dotenv.config();

async function testTeams() {
  console.log('\n🏈 Testing Team ID Configuration\n');
  console.log('═══════════════════════════════════════════\n');
  
  const leagueId = parseInt(process.env.LEAGUE1_ID);
  const configuredTeamId = process.env.LEAGUE1_TEAM_ID ? parseInt(process.env.LEAGUE1_TEAM_ID) : null;
  const configuredTeamName = process.env.LEAGUE1_TEAM_NAME;
  
  console.log('📋 Configuration:');
  console.log(`   League ID: ${leagueId}`);
  console.log(`   Configured Team ID: ${configuredTeamId}`);
  console.log(`   Configured Team Name: ${configuredTeamName}`);
  console.log('\n═══════════════════════════════════════════\n');
  
  try {
    // Create ESPN client
    const client = new Client({
      leagueId: leagueId,
      espnS2: process.env.LEAGUE1_ESPN_S2,
      SWID: process.env.LEAGUE1_SWID
    });
    
    // Get all teams
    const teams = await client.getTeamsAtWeek({
      seasonId: 2025,
      scoringPeriodId: 1
    });
    
    console.log(`📊 Found ${teams.length} teams in the league:\n`);
    
    teams.forEach(team => {
      const isConfiguredId = team.id === configuredTeamId;
      const isConfiguredName = team.name === configuredTeamName || team.nickname === configuredTeamName;
      const marker = (isConfiguredId || isConfiguredName) ? ' ⭐' : '';
      
      console.log(`Team ID: ${team.id.toString().padEnd(3)} | Name: ${(team.name || team.nickname).padEnd(25)} | Wins: ${team.wins} | Losses: ${team.losses}${marker}`);
      
      if (isConfiguredId) {
        console.log(`    ✅ This matches your configured Team ID (${configuredTeamId})`);
      }
      if (isConfiguredName) {
        console.log(`    ✅ This matches your configured Team Name ("${configuredTeamName}")`);
      }
    });
    
    console.log('\n═══════════════════════════════════════════\n');
    
    // Check if configured team ID exists
    if (configuredTeamId) {
      const matchedTeam = teams.find(team => team.id === configuredTeamId);
      if (matchedTeam) {
        console.log(`✅ Team ID ${configuredTeamId} found: "${matchedTeam.name || matchedTeam.nickname}"`);
        
        if ((matchedTeam.name || matchedTeam.nickname) !== configuredTeamName) {
          console.log(`⚠️  Warning: The actual team name "${matchedTeam.name || matchedTeam.nickname}" doesn't match configured name "${configuredTeamName}"`);
          console.log(`    The system will use Team ID ${configuredTeamId} which corresponds to "${matchedTeam.name || matchedTeam.nickname}"`);
        }
      } else {
        console.log(`❌ Team ID ${configuredTeamId} not found in the league!`);
        console.log('   Please update LEAGUE1_TEAM_ID in your .env file with a valid team ID from the list above.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching teams:', error.message);
    console.error('\nMake sure your ESPN credentials are correct in the .env file.');
  }
}

// Run the test
testTeams().catch(console.error);