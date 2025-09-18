import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Typography,
} from '@mui/material';
import { useRankings } from '../context/RankingsContext';

const WeekSelector = () => {
  const {
    currentWeek,
    setCurrentWeek,
    currentSeason,
    setCurrentSeason,
    availableRankings,
    fetchRankings,
  } = useRankings();

  const handleWeekChange = (event) => {
    const week = event.target.value;
    setCurrentWeek(week);
    fetchRankings(week, currentSeason);
  };

  const handleSeasonChange = (event) => {
    const season = event.target.value;
    setCurrentSeason(season);
    fetchRankings(currentWeek, season);
  };

  const isRankingAvailable = (week, season) => {
    return availableRankings.some(
      (ranking) => ranking.week === week && ranking.season === season
    );
  };

  const getAvailableWeeks = () => {
    const weeks = [];
    for (let i = 1; i <= 18; i++) {
      weeks.push(i);
    }
    return weeks;
  };

  const getAvailableSeasons = () => {
    const currentYear = new Date().getFullYear();
    const seasons = [];
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      seasons.push(year);
    }
    return seasons;
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Week</InputLabel>
          <Select
            value={currentWeek}
            label="Week"
            onChange={handleWeekChange}
            size="small"
          >
            {getAvailableWeeks().map((week) => (
              <MenuItem key={week} value={week}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>Week {week}</Typography>
                  {isRankingAvailable(week, currentSeason) && (
                    <Chip
                      label="Available"
                      size="small"
                      color="success"
                      sx={{ height: 20 }}
                    />
                  )}
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Season</InputLabel>
          <Select
            value={currentSeason}
            label="Season"
            onChange={handleSeasonChange}
            size="small"
          >
            {getAvailableSeasons().map((season) => (
              <MenuItem key={season} value={season}>
                {season}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {isRankingAvailable(currentWeek, currentSeason) && (
          <Chip
            label="Rankings Available"
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {availableRankings.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="textSecondary">
            Quick Jump:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {availableRankings
              .filter((r) => r.season === currentSeason)
              .sort((a, b) => b.week - a.week)
              .slice(0, 5)
              .map((ranking) => (
                <Chip
                  key={`${ranking.season}-${ranking.week}`}
                  label={`Week ${ranking.week}`}
                  size="small"
                  onClick={() => {
                    setCurrentWeek(ranking.week);
                    fetchRankings(ranking.week, ranking.season);
                  }}
                  color={ranking.week === currentWeek ? 'primary' : 'default'}
                  variant={ranking.week === currentWeek ? 'filled' : 'outlined'}
                />
              ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default WeekSelector;