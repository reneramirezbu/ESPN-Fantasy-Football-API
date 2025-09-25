import React, { useEffect, useMemo } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  Alert,
  Button,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as InjuryIcon,
  CheckCircle as ActiveIcon,
  Cancel as OutIcon,
  QuestionMark as QuestionableIcon,
  Schedule as DoubtfulIcon,
  SportsTennis as ByeIcon,
} from '@mui/icons-material';
import { useRankings } from '../context/RankingsContext';
import TeamStats from './TeamStats';

const FLEX_ELIGIBLE = new Set(['RB', 'WR', 'TE']);

const buildPlayerKey = (name = '', team = '', position = '') =>
  [name, team, position].map(part => part?.toString().toLowerCase().trim() || '').join('|');

const MyTeam = () => {
  const { myTeam, fetchMyTeam, loading, error, rankings } = useRankings();

  const playerRankings = useMemo(() => {
    if (!myTeam?.roster || !rankings?.positions) {
      return {};
    }

    const flexLookup = rankings?.metadata?.flexLookup || {};
    const rankMap = {};

    const matchPlayer = (player) => {
      const nameLower = player.fullName?.toLowerCase();
      const team = player.proTeam;
      const lastName = player.fullName?.split(' ').slice(-1)[0]?.toLowerCase();

      const positions = Object.entries(rankings.positions);

      for (const [, players] of positions) {
        const exact = players.find(
          (p) => p.name?.toLowerCase() === nameLower && (!team || !p.team || p.team === team)
        );
        if (exact) {
          return exact;
        }
      }

      if (lastName) {
        for (const [position, players] of positions) {
          const loose = players.find((p) => {
            if (!p.name) return false;
            const pLastName = p.name.split(' ').slice(-1)[0]?.toLowerCase();
            return pLastName === lastName && (!team || !p.team || p.team === team);
          });
          if (loose) {
            return loose;
          }
        }
      }

      return null;
    };

    myTeam.roster.forEach((player) => {
      const ranking = matchPlayer(player);
      if (!ranking) {
        return;
      }

      const positionRank = ranking.positionRank ?? ranking.rank ?? null;

      let flexRank = ranking.flexRank ?? null;
      if (flexRank == null && FLEX_ELIGIBLE.has(player.position)) {
        const key = buildPlayerKey(ranking.name, ranking.team, ranking.pos || player.position);
        const lookupRank = flexLookup[key];
        if (typeof lookupRank === 'number') {
          flexRank = lookupRank;
        }
      }

      rankMap[player.fullName] = {
        weeklyRank: ranking.rank ?? null,
        positionRank,
        flexRank,
        rosRank: ranking.rosRank || null,
        matchup: ranking.matchup || null,
      };
    });

    return rankMap;
  }, [myTeam, rankings]);

  useEffect(() => {
    if (!myTeam) {
      fetchMyTeam();
    }
  }, []);

  const getInjuryIcon = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <ActiveIcon color="success" fontSize="small" />;
      case 'OUT':
        return <OutIcon color="error" fontSize="small" />;
      case 'QUESTIONABLE':
        return <QuestionableIcon color="warning" fontSize="small" />;
      case 'DOUBTFUL':
        return <DoubtfulIcon color="error" fontSize="small" />;
      default:
        return null;
    }
  };

  const getInjuryColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'OUT':
        return 'error';
      case 'QUESTIONABLE':
        return 'warning';
      case 'DOUBTFUL':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPositionColor = (position) => {
    const colors = {
      QB: 'error',
      RB: 'primary',
      WR: 'secondary',
      TE: 'warning',
      DST: 'info',
      K: 'success',
    };
    return colors[position] || 'default';
  };

  const getSlotName = (slot) => {
    const slotMap = {
      'RB/WR/TE': 'FLEX',
      'D/ST': 'DST',
    };
    return slotMap[slot] || slot;
  };

  const sortedRoster = myTeam?.roster?.sort((a, b) => {
    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K', 'Bench'];
    const aPos = a.lineupSlot === 'Bench' ? 'Bench' : a.position;
    const bPos = b.lineupSlot === 'Bench' ? 'Bench' : b.position;
    return positionOrder.indexOf(aPos) - positionOrder.indexOf(bPos);
  });

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button
          size="small"
          onClick={fetchMyTeam}
          sx={{ ml: 2 }}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      <TeamStats team={myTeam} />

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Roster</Typography>
          <IconButton onClick={fetchMyTeam} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        {!myTeam ? (
          <Alert severity="info">
            Loading your team roster from ESPN...
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Slot</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Team</TableCell>
                  <TableCell>Matchup</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Pos Rank</TableCell>
                  <TableCell align="center">Flex Rank</TableCell>
                  <TableCell align="center">Week Rank</TableCell>
                  <TableCell align="center">ROS Rank</TableCell>
                  <TableCell align="right">Proj</TableCell>
                  <TableCell align="right">Actual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRoster?.map((player, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      backgroundColor:
                        player.lineupSlot === 'Bench'
                          ? 'action.hover'
                          : 'background.paper',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={getSlotName(player.lineupSlot)}
                        size="small"
                        variant={player.lineupSlot === 'Bench' ? 'outlined' : 'filled'}
                        color={player.lineupSlot === 'Bench' ? 'default' : getPositionColor(player.position)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {player.fullName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={player.position}
                        size="small"
                        color={getPositionColor(player.position)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {player.proTeam || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {playerRankings[player.fullName]?.matchup || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {player.proTeam === 'Bye' ? (
                        <Chip
                          icon={<ByeIcon />}
                          label="BYE"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={getInjuryIcon(player.injuryStatus)}
                          label={player.injuryStatus || 'ACTIVE'}
                          size="small"
                          color={getInjuryColor(player.injuryStatus)}
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {playerRankings[player.fullName]?.positionRank ? (
                        <Tooltip title="Position Ranking">
                          <Chip
                            label={`#${playerRankings[player.fullName].positionRank}`}
                            size="small"
                            color="info"
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {typeof playerRankings[player.fullName]?.flexRank === 'number' && FLEX_ELIGIBLE.has(player.position) ? (
                        <Tooltip title="Flex Ranking">
                          <Chip
                            label={`#${playerRankings[player.fullName].flexRank}`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {playerRankings[player.fullName]?.weeklyRank ? (
                        <Tooltip title="Weekly Ranking">
                          <Chip
                            label={`#${playerRankings[player.fullName].weeklyRank}`}
                            size="small"
                            color="primary"
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {playerRankings[player.fullName]?.rosRank ? (
                        <Tooltip title="Rest of Season Ranking (ECR™)">
                          <Chip
                            label={`#${playerRankings[player.fullName].rosRank}`}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {player.projectedPoints?.toFixed(1) || '0.0'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={
                          player.actualPoints > player.projectedPoints
                            ? 'success.main'
                            : 'text.primary'
                        }
                      >
                        {player.actualPoints?.toFixed(1) || '0.0'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default MyTeam;