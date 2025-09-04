require('dotenv').config();
const { Client } = require('./node.js');

async function testESPN() {
  console.log('🏈 Testing ESPN Fantasy Football Connection\n');
  
  try {
    const client = new Client({
      leagueId: process.env.LEAGUE1_ID,
      espnS2: process.env.LEAGUE1_ESPN_S2,
      SWID: process.env.LEAGUE1_SWID
    });
    
    console.log(`Connecting to League ${process.env.LEAGUE1_ID}...`);
    
    // Get basic league info
    const teams = await client.getTeamsAtWeek({ seasonId: 2024, scoringPeriodId: 1 });
    
    console.log(`\n✅ Success! Connected to league with ${teams.length} teams:\n`);
    
    teams.forEach((team, i) => {
      console.log(`${i + 1}. ${team.name} (${team.wins}-${team.losses})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\nYour ESPN cookies may have expired. Get fresh ones by:');
      console.log('1. Log into ESPN Fantasy Football');  
      console.log('2. Open Chrome DevTools (F12)');
      console.log('3. Go to Application > Cookies > espn.com');
      console.log('4. Copy espn_s2 and SWID values');
    }
  }
}

testESPN();