import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const RankingsContext = createContext();

export const useRankings = () => {
  const context = useContext(RankingsContext);
  if (!context) {
    throw new Error('useRankings must be used within a RankingsProvider');
  }
  return context;
};

export const RankingsProvider = ({ children }) => {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    const seasonStart = new Date(today.getFullYear(), 8, 1); // Sept 1
    const weeksSinceStart = Math.floor((today - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeksSinceStart + 1, 1), 18);
  });

  const [currentSeason, setCurrentSeason] = useState(new Date().getFullYear());
  const [rankings, setRankings] = useState(null);
  const [availableRankings, setAvailableRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [nameMappings, setNameMappings] = useState({});
  const [myTeam, setMyTeam] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);

  const fetchAvailableRankings = async () => {
    try {
      setLoading(true);
      const response = await api.getAvailableRankings();
      if (response.success) {
        setAvailableRankings(response.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRankings = async (week = currentWeek, season = currentSeason) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getRankings(week, season);
      if (response.success) {
        setRankings(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadRankings = async (file) => {
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      const response = await api.uploadRankings(file, currentWeek, currentSeason);

      if (response.success) {
        await fetchRankings(currentWeek, currentSeason);
        await fetchAvailableRankings();
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const deleteRankings = async (week, season) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.deleteRankings(week, season);

      if (response.success) {
        if (week === currentWeek && season === currentSeason) {
          setRankings(null);
        }
        await fetchAvailableRankings();
        return true;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const compareWeeks = async (weeks) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.compareWeeks(weeks, currentSeason);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const manualPlayerMapping = async (playerKey, espnId, espnName) => {
    try {
      const response = await api.manualPlayerMapping(playerKey, espnId, espnName);
      if (response.success) {
        setNameMappings(prev => ({
          ...prev,
          [playerKey]: {
            espnId,
            espnName,
            confidence: 1.0,
            method: 'manual'
          }
        }));
        return true;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const fetchMyTeam = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getMyTeamRoster();
      if (response.success) {
        setMyTeam(response.team);
      } else {
        setError(response.error || 'Failed to fetch team');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreeAgents = async (position = null) => {
    try {
      setLoading(true);
      const response = await api.getFreeAgents(position);
      if (response.success) {
        setFreeAgents(response.freeAgents || []);
      }
    } catch (err) {
      console.error('Error fetching free agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeagueTeams = async () => {
    try {
      const response = await api.getLeagueTeams();
      if (response.success) {
        setLeagueTeams(response.teams || []);
      }
    } catch (err) {
      console.error('Error fetching league teams:', err);
    }
  };

  useEffect(() => {
    fetchAvailableRankings();
    fetchMyTeam();
  }, []);

  const value = {
    currentWeek,
    setCurrentWeek,
    currentSeason,
    setCurrentSeason,
    rankings,
    availableRankings,
    loading,
    error,
    uploadProgress,
    selectedPosition,
    setSelectedPosition,
    nameMappings,
    myTeam,
    freeAgents,
    leagueTeams,
    fetchRankings,
    uploadRankings,
    deleteRankings,
    compareWeeks,
    manualPlayerMapping,
    fetchAvailableRankings,
    fetchMyTeam,
    fetchFreeAgents,
    fetchLeagueTeams,
  };

  return (
    <RankingsContext.Provider value={value}>
      {children}
    </RankingsContext.Provider>
  );
};