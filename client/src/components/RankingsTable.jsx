import React, { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Tabs,
  Tab,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
} from '@mui/icons-material';
import { useRankings } from '../context/RankingsContext';

const RankingsTable = () => {
  const { rankings, selectedPosition, setSelectedPosition } = useRankings();
  const [orderBy, setOrderBy] = useState('rank');
  const [order, setOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [previousRankings] = useState(null);

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K'];

  const handleTabChange = (event, newValue) => {
    setSelectedPosition(newValue);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const getTierColor = (tier) => {
    const colors = {
      1: '#4caf50',
      2: '#8bc34a',
      3: '#ffeb3b',
      4: '#ff9800',
      5: '#f44336',
    };
    return colors[tier] || '#9e9e9e';
  };

  const processedData = useMemo(() => {
    if (!rankings || !rankings.positions) return [];

    let allPlayers = [];

    if (selectedPosition === 'ALL') {
      Object.entries(rankings.positions).forEach(([position, players]) => {
        players.forEach((player) => {
          allPlayers.push({ ...player, position });
        });
      });
    } else if (selectedPosition === 'FLEX') {
      ['RB', 'WR', 'TE'].forEach((position) => {
        if (rankings.positions[position]) {
          rankings.positions[position].forEach((player) => {
            allPlayers.push({ ...player, position });
          });
        }
      });
    } else {
      if (rankings.positions[selectedPosition]) {
        rankings.positions[selectedPosition].forEach((player) => {
          allPlayers.push({ ...player, position: selectedPosition });
        });
      }
    }

    // Filter by search term
    if (searchTerm) {
      allPlayers = allPlayers.filter(
        (player) =>
          player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          player.team?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    const comparator = (a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      if (orderBy === 'rank') {
        aValue = a.rank || 999;
        bValue = b.rank || 999;
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    };

    return allPlayers.sort(comparator);
  }, [rankings, selectedPosition, searchTerm, orderBy, order]);

  const getRankChange = (player) => {
    if (!previousRankings || !previousRankings.positions) return null;

    const prevPosition = previousRankings.positions[player.position];
    if (!prevPosition) return null;

    const prevPlayer = prevPosition.find(p => p.name === player.name);
    if (!prevPlayer) return 'NEW';

    const change = prevPlayer.rank - player.rank;
    return change;
  };

  if (!rankings) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="textSecondary">
          No rankings available for the selected week.
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Upload a rankings file to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedPosition}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {positions.map((position) => (
            <Tab key={position} label={position} value={position} />
          ))}
        </Tabs>
      </Paper>

      <Paper sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search players or teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'rank'}
                  direction={orderBy === 'rank' ? order : 'asc'}
                  onClick={() => handleSort('rank')}
                >
                  Rank
                </TableSortLabel>
              </TableCell>
              {selectedPosition === 'ALL' && <TableCell>Pos</TableCell>}
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Player
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'team'}
                  direction={orderBy === 'team' ? order : 'asc'}
                  onClick={() => handleSort('team')}
                >
                  Team
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'tier'}
                  direction={orderBy === 'tier' ? order : 'asc'}
                  onClick={() => handleSort('tier')}
                >
                  Tier
                </TableSortLabel>
              </TableCell>
              {previousRankings && <TableCell>Change</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {processedData.map((player, index) => {
              const rankChange = getRankChange(player);
              return (
                <TableRow
                  key={`${player.position}-${player.name}-${index}`}
                  sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {player.rank}
                    </Typography>
                  </TableCell>
                  {selectedPosition === 'ALL' && (
                    <TableCell>
                      <Chip
                        label={player.position}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2">{player.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{player.team || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`T${player.tier || '-'}`}
                      size="small"
                      sx={{
                        backgroundColor: getTierColor(player.tier),
                        color: 'white',
                      }}
                    />
                  </TableCell>
                  {previousRankings && (
                    <TableCell>
                      {rankChange === 'NEW' ? (
                        <Chip label="NEW" size="small" color="info" />
                      ) : rankChange > 0 ? (
                        <Tooltip title={`Up ${rankChange} spots`}>
                          <Chip
                            icon={<UpIcon />}
                            label={rankChange}
                            size="small"
                            color="success"
                          />
                        </Tooltip>
                      ) : rankChange < 0 ? (
                        <Tooltip title={`Down ${Math.abs(rankChange)} spots`}>
                          <Chip
                            icon={<DownIcon />}
                            label={Math.abs(rankChange)}
                            size="small"
                            color="error"
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {processedData.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="textSecondary">
            No players found matching your criteria.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default RankingsTable;