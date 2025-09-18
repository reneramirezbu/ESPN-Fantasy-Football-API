const XLSX = require('xlsx');
const path = require('path');

// Sample data for each position
const sampleData = {
  QB: [
    { Player: 'Josh Allen', Team: 'BUF', Pos: 'QB', Rank: 1, Tier: 1, Notes: 'Elite QB1' },
    { Player: 'Jalen Hurts', Team: 'PHI', Pos: 'QB', Rank: 2, Tier: 1, Notes: 'Rushing upside' },
    { Player: 'Patrick Mahomes', Team: 'KC', Pos: 'QB', Rank: 3, Tier: 1, Notes: 'Always elite' },
    { Player: 'Lamar Jackson', Team: 'BAL', Pos: 'QB', Rank: 4, Tier: 2, Notes: 'Dual threat' },
    { Player: 'Dak Prescott', Team: 'DAL', Pos: 'QB', Rank: 5, Tier: 2, Notes: 'High volume' }
  ],
  RB: [
    { Player: 'Christian McCaffrey', Team: 'SF', Pos: 'RB', Rank: 1, Tier: 1, Notes: 'Overall RB1' },
    { Player: 'Austin Ekeler', Team: 'LAC', Pos: 'RB', Rank: 2, Tier: 1, Notes: 'PPR monster' },
    { Player: 'Saquon Barkley', Team: 'NYG', Pos: 'RB', Rank: 3, Tier: 1, Notes: 'Healthy and ready' },
    { Player: 'Derrick Henry', Team: 'TEN', Pos: 'RB', Rank: 4, Tier: 2, Notes: 'TD machine' },
    { Player: 'Nick Chubb', Team: 'CLE', Pos: 'RB', Rank: 5, Tier: 2, Notes: 'Consistent RB1' }
  ],
  WR: [
    { Player: 'Tyreek Hill', Team: 'MIA', Pos: 'WR', Rank: 1, Tier: 1, Notes: 'Elite speed' },
    { Player: 'Stefon Diggs', Team: 'BUF', Pos: 'WR', Rank: 2, Tier: 1, Notes: 'Target monster' },
    { Player: 'Justin Jefferson', Team: 'MIN', Pos: 'WR', Rank: 3, Tier: 1, Notes: 'Young stud' },
    { Player: 'CeeDee Lamb', Team: 'DAL', Pos: 'WR', Rank: 4, Tier: 1, Notes: 'Volume king' },
    { Player: 'AJ Brown', Team: 'PHI', Pos: 'WR', Rank: 5, Tier: 2, Notes: 'Red zone target' }
  ],
  TE: [
    { Player: 'Travis Kelce', Team: 'KC', Pos: 'TE', Rank: 1, Tier: 1, Notes: 'Elite TE' },
    { Player: 'Mark Andrews', Team: 'BAL', Pos: 'TE', Rank: 2, Tier: 2, Notes: 'Top target' },
    { Player: 'TJ Hockenson', Team: 'MIN', Pos: 'TE', Rank: 3, Tier: 2, Notes: 'Consistent' },
    { Player: 'George Kittle', Team: 'SF', Pos: 'TE', Rank: 4, Tier: 2, Notes: 'When healthy' },
    { Player: 'Dallas Goedert', Team: 'PHI', Pos: 'TE', Rank: 5, Tier: 3, Notes: 'Solid option' }
  ],
  FLEX: [
    { Player: 'Christian McCaffrey', Team: 'SF', Pos: 'RB', Rank: 1, Notes: 'Best FLEX' },
    { Player: 'Tyreek Hill', Team: 'MIA', Pos: 'WR', Rank: 2, Notes: 'Elite WR' },
    { Player: 'Austin Ekeler', Team: 'LAC', Pos: 'RB', Rank: 3, Notes: 'PPR value' },
    { Player: 'Stefon Diggs', Team: 'BUF', Pos: 'WR', Rank: 4, Notes: 'High floor' },
    { Player: 'Saquon Barkley', Team: 'NYG', Pos: 'RB', Rank: 5, Notes: 'RB1' }
  ],
  DST: [
    { Player: '49ers D/ST', Team: 'SF', Pos: 'DST', Rank: 1, Notes: 'Elite defense' },
    { Player: 'Bills D/ST', Team: 'BUF', Pos: 'DST', Rank: 2, Notes: 'Great matchup' },
    { Player: 'Cowboys D/ST', Team: 'DAL', Pos: 'DST', Rank: 3, Notes: 'Turnovers' },
    { Player: 'Patriots D/ST', Team: 'NE', Pos: 'DST', Rank: 4, Notes: 'Solid' },
    { Player: 'Jets D/ST', Team: 'NYJ', Pos: 'DST', Rank: 5, Notes: 'Improving' }
  ],
  K: [
    { Player: 'Justin Tucker', Team: 'BAL', Pos: 'K', Rank: 1, Notes: 'Most accurate' },
    { Player: 'Daniel Carlson', Team: 'LV', Pos: 'K', Rank: 2, Notes: 'High volume' },
    { Player: 'Harrison Butker', Team: 'KC', Pos: 'K', Rank: 3, Notes: 'Great offense' },
    { Player: 'Tyler Bass', Team: 'BUF', Pos: 'K', Rank: 4, Notes: 'Strong leg' },
    { Player: 'Evan McPherson', Team: 'CIN', Pos: 'K', Rank: 5, Notes: 'Rising star' }
  ]
};

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Add each position as a separate sheet
Object.keys(sampleData).forEach(position => {
  const worksheet = XLSX.utils.json_to_sheet(sampleData[position]);
  XLSX.utils.book_append_sheet(workbook, worksheet, position);
});

// Write to file
const outputPath = path.join(__dirname, 'data', 'uploads', 'test-rankings.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Sample rankings file created at: ${outputPath}`);
console.log('You can now upload this file using the web interface at http://localhost:3001/upload-test.html');