import React from 'react';
import {
  Paper,
  Grid,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  TrendingUp as WinsIcon,
  TrendingDown as LossesIcon,
  SportsScore as PointsIcon,
} from '@mui/icons-material';

const TeamStats = ({ team }) => {
  if (!team) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading team statistics...
        </Typography>
      </Paper>
    );
  }

  const winPercentage = team.record
    ? (team.record.wins / (team.record.wins + team.record.losses)) * 100
    : 0;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        {team.name || 'My Team'}
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={3}>
          <Box
            sx={{
              textAlign: 'center',
              p: 2,
              borderRadius: 2,
              backgroundColor: 'background.default',
            }}
          >
            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
              <WinsIcon color="success" />
              <Typography variant="h4" color="success.main">
                {team.record?.wins || 0}
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              Wins
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box
            sx={{
              textAlign: 'center',
              p: 2,
              borderRadius: 2,
              backgroundColor: 'background.default',
            }}
          >
            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
              <LossesIcon color="error" />
              <Typography variant="h4" color="error.main">
                {team.record?.losses || 0}
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              Losses
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box
            sx={{
              textAlign: 'center',
              p: 2,
              borderRadius: 2,
              backgroundColor: 'background.default',
            }}
          >
            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
              <PointsIcon color="primary" />
              <Typography variant="h4" color="primary.main">
                {team.record?.pointsFor?.toFixed(1) || '0.0'}
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              Points For
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box
            sx={{
              textAlign: 'center',
              p: 2,
              borderRadius: 2,
              backgroundColor: 'background.default',
            }}
          >
            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
              <PointsIcon color="secondary" />
              <Typography variant="h4" color="secondary.main">
                {team.record?.pointsAgainst?.toFixed(1) || '0.0'}
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              Points Against
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {team.record && (
        <Box sx={{ mt: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="textSecondary">
              Win Percentage
            </Typography>
            <Chip
              label={`${winPercentage.toFixed(1)}%`}
              color={winPercentage >= 50 ? 'success' : 'error'}
              size="small"
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={winPercentage}
            sx={{
              height: 8,
              borderRadius: 1,
              backgroundColor: 'grey.300',
              '& .MuiLinearProgress-bar': {
                backgroundColor: winPercentage >= 50 ? 'success.main' : 'error.main',
              },
            }}
          />
        </Box>
      )}

      {team.rank && (
        <Box display="flex" alignItems="center" gap={1} sx={{ mt: 2 }}>
          <TrophyIcon color="warning" />
          <Typography variant="body1">
            League Rank: <strong>#{team.rank}</strong>
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default TeamStats;