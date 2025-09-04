require('dotenv').config();
const { Client } = require('./src/client/client');

async function testConnection() {
  console.log('Testing ESPN Fantasy Football API connection...\n');
  
  try {
    // Create client with League 1 credentials
    const client = new Client({
      leagueId: process.env.LEAGUE1_ID,
      espnS2: process.env.LEAGUE1_ESPN_S2,
      SWID: process.env.LEAGUE1_SWID
    });
    
    console.log(`✓ Connecting to League ID: ${process.env.LEAGUE1_ID}`);
    
    // Test 1: Get league info
    const league = await client.getLeagueInfo();
    console.log(`✓ League Name: ${league.name}`);
    console.log(`✓ Season: ${league.seasonId}`);
    console.log(`✓ Current Week: ${league.currentMatchupPeriodId}`);
    
    // Test 2: Get teams
    const teams = await client.getTeamsAtWeek();
    console.log(`✓ Found ${teams.length} teams in league`);
    
    // Test 3: Find your team
    const yourTeam = teams.find(team => 
      team.name?.toLowerCase().includes('your') || 
      team.abbreviation?.toLowerCase().includes('your')
    );
    
    if (yourTeam) {
      console.log(`✓ Your Team: ${yourTeam.name} (${yourTeam.abbreviation})`);
      console.log(`  - Record: ${yourTeam.wins}-${yourTeam.losses}`);
      console.log(`  - Points For: ${yourTeam.pointsFor}`);
    } else {
      console.log('ℹ Could not identify your team - showing all teams:');
      teams.forEach((team, i) => {
        console.log(`  ${i + 1}. ${team.name} (${team.wins}-${team.losses})`);
      });
    }
    
    // Test 4: Get free agents (top 5)
    console.log('\n✓ Testing free agent access...');
    const freeAgents = await client.getFreeAgents({ 
      scoringPeriodId: league.currentScoringPeriodId,
      limit: 5 
    });
    console.log(`  Found ${freeAgents.length} free agents (showing top 5)`);
    
    console.log('\n✅ All tests passed! Your ESPN connection is working.');
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n🔐 Authentication issue - your cookies may have expired.');
      console.error('Please get fresh cookies from ESPN by:');
      console.error('1. Log into ESPN Fantasy Football');
      console.error('2. Open Chrome DevTools (F12)');
      console.error('3. Go to Application > Cookies > espn.com');
      console.error('4. Copy new espn_s2 and SWID values to your .env file');
    }
  }
}

testConnection();