import axios from 'axios';

const API_BASE_URL = '/api';

class RankingsAPI {
  async uploadRankings(file, week, season) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('week', week);
    formData.append('season', season);

    const response = await axios.post(`${API_BASE_URL}/rankings/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${percentCompleted}%`);
      },
    });

    return response.data;
  }

  async getRankings(week, season, position = null) {
    const params = new URLSearchParams();
    params.append('week', week);
    params.append('season', season);
    if (position) {
      params.append('position', position);
    }

    const response = await axios.get(`${API_BASE_URL}/rankings?${params.toString()}`);
    return response.data;
  }

  async getAvailableRankings() {
    const response = await axios.get(`${API_BASE_URL}/rankings/available`);
    return response.data;
  }

  async matchWithRoster(week, season, espnRoster) {
    const response = await axios.post(`${API_BASE_URL}/rankings/match`, {
      week,
      season,
      espnRoster,
    });
    return response.data;
  }

  async manualPlayerMapping(playerKey, espnId, espnName) {
    const response = await axios.post(`${API_BASE_URL}/rankings/match/manual`, {
      playerKey,
      espnId,
      espnName,
    });
    return response.data;
  }

  async compareWeeks(weeks, season) {
    const params = new URLSearchParams();
    params.append('weeks', weeks.join(','));
    params.append('season', season);

    const response = await axios.get(`${API_BASE_URL}/rankings/compare?${params.toString()}`);
    return response.data;
  }

  async deleteRankings(week, season) {
    const params = new URLSearchParams();
    params.append('week', week);
    params.append('season', season);

    const response = await axios.delete(`${API_BASE_URL}/rankings?${params.toString()}`);
    return response.data;
  }

  async getESPNRoster(leagueId, teamId) {
    const response = await axios.get(`${API_BASE_URL}/espn/roster/${leagueId}/${teamId}`);
    return response.data;
  }

  async getESPNLeague(leagueId) {
    const response = await axios.get(`${API_BASE_URL}/espn/league/${leagueId}`);
    return response.data;
  }

  async getMyTeamRoster() {
    const response = await axios.get(`${API_BASE_URL}/roster`);
    return response.data;
  }

  async getLeagueTeams() {
    const response = await axios.get(`${API_BASE_URL}/teams`);
    return response.data;
  }

  async getFreeAgents(position = null) {
    const params = position ? `?position=${position}` : '';
    const response = await axios.get(`${API_BASE_URL}/free-agents${params}`);
    return response.data;
  }
}

const api = new RankingsAPI();
export default api;