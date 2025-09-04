/**
 * Fantasy Football Manager Web Client
 * Production-ready with comprehensive error handling
 */

class FFWebClient {
    constructor() {
        this.currentView = 'dashboard';
        this.leagues = [];
        this.currentTeam = null;
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        this.loadLeagues();
    }
    
    attachEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Lineup Optimizer
        document.getElementById('optimize-btn').addEventListener('click', () => this.optimizeLineup());
        
        // Waiver Wire
        document.getElementById('analyze-waiver-btn').addEventListener('click', () => this.analyzeWaiverWire());
        
        // Rankings Upload
        document.getElementById('upload-rankings-btn').addEventListener('click', () => this.uploadRankings());
    }
    
    switchView(viewName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        
        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
        });
        
        this.currentView = viewName;
        
        // Load team data when switching to dashboard
        if (viewName === 'dashboard' && this.leagues.length > 0) {
            this.loadMyTeam(this.leagues[0].leagueId);
        }
    }
    
    showLoading(show = true) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }
    
    /**
     * Safe JSON parsing with error handling
     */
    async parseJSON(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (error) {
            console.error('JSON Parse Error:', error);
            console.error('Response text:', text);
            throw new Error(`Server returned invalid JSON: ${text.substring(0, 100)}...`);
        }
    }
    
    /**
     * Centralized API call with error handling
     */
    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await this.parseJSON(response);
            
            // Check for API error response
            if (data.success === false) {
                throw new Error(data.error?.message || 'API request failed');
            }
            
            return data;
        } catch (error) {
            // Re-throw with more context
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Unable to connect to server. Please check your connection.');
            }
            throw error;
        }
    }
    
    async loadLeagues() {
        this.showLoading(true);
        
        try {
            const result = await this.apiCall('/api/leagues');
            this.leagues = result.data || result; // Handle both old and new API format
            
            // Filter out leagues with errors
            const validLeagues = this.leagues.filter(l => !l.error);
            if (validLeagues.length === 0) {
                throw new Error('No valid leagues found. Please check your ESPN credentials.');
            }
            
            this.displayLeagues();
            this.populateLeagueSelects();
            
            // Automatically load first league's team data
            if (validLeagues.length > 0) {
                await this.loadMyTeam(validLeagues[0].leagueId);
            }
        } catch (error) {
            this.showError('Failed to load leagues: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Load and display user's team roster
     */
    async loadMyTeam(leagueId) {
        if (!leagueId) return;
        
        try {
            const result = await this.apiCall(`/api/leagues/${leagueId}/my-team`);
            this.currentTeam = result.data;
            this.displayMyTeam();
        } catch (error) {
            console.error('Failed to load team data:', error);
            // Don't show error for team loading, just log it
        }
    }
    
    /**
     * Display user's team with roster
     */
    displayMyTeam() {
        const container = document.getElementById('my-team-container');
        
        if (!container) {
            // Create container if it doesn't exist
            const leaguesContainer = document.getElementById('leagues-container');
            const teamDiv = document.createElement('div');
            teamDiv.id = 'my-team-container';
            teamDiv.className = 'my-team-section';
            leaguesContainer.parentNode.insertBefore(teamDiv, leaguesContainer.nextSibling);
        }
        
        const teamContainer = document.getElementById('my-team-container') || container;
        
        if (!this.currentTeam) {
            teamContainer.innerHTML = '';
            return;
        }
        
        const { team, roster } = this.currentTeam;
        
        // Format player row
        const formatPlayerRow = (player, isStarter = true) => `
            <tr class="${player.injuryStatus !== 'ACTIVE' ? 'injured' : ''}">
                <td>${isStarter ? '▶' : ''}</td>
                <td>${player.name}</td>
                <td>${player.position}</td>
                <td>${player.team || '-'}</td>
                <td class="${player.injuryStatus !== 'ACTIVE' ? 'injury-status' : ''}">
                    ${player.injuryStatus}
                </td>
                <td>${player.projectedPoints.toFixed(1)}</td>
                <td>${player.actualPoints.toFixed(1)}</td>
            </tr>
        `;
        
        teamContainer.innerHTML = `
            <div class="my-team-card">
                <h2>My Team: ${team.name}</h2>
                <div class="team-summary">
                    <span>Record: ${team.record}</span>
                    <span>Standing: ${team.standing}</span>
                    <span>Points: ${team.points?.toFixed(1) || 'N/A'}</span>
                </div>
                
                <div class="roster-section">
                    <h3>Starting Lineup</h3>
                    <table class="roster-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Player</th>
                                <th>Pos</th>
                                <th>Team</th>
                                <th>Status</th>
                                <th>Proj</th>
                                <th>Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${roster.starters.map(p => formatPlayerRow(p, true)).join('')}
                        </tbody>
                    </table>
                    
                    <h3>Bench</h3>
                    <table class="roster-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Player</th>
                                <th>Pos</th>
                                <th>Team</th>
                                <th>Status</th>
                                <th>Proj</th>
                                <th>Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${roster.bench.map(p => formatPlayerRow(p, false)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    displayLeagues() {
        const container = document.getElementById('leagues-container');
        
        if (this.leagues.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    No leagues configured. Please set up your leagues in the configuration file.
                </div>
            `;
            return;
        }
        
        // Only show league summary cards, not other teams
        container.innerHTML = this.leagues.map(league => `
            <div class="league-card ${league.error ? 'has-error' : ''}" 
                 onclick="window.ffClient.loadMyTeam(${league.leagueId})"
                 style="cursor: pointer;">
                <h3>${league.leagueName}</h3>
                <div class="league-stats">
                    <div class="stat-item">
                        <span class="stat-label">My Team:</span>
                        <span class="stat-value">${league.teamName || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Record:</span>
                        <span class="stat-value">${league.record || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Standing:</span>
                        <span class="stat-value">${league.standing || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Points:</span>
                        <span class="stat-value">${league.points?.toFixed(1) || 'N/A'}</span>
                    </div>
                </div>
                ${league.error ? `
                    <div class="alert alert-error" style="margin-top: 10px;">
                        ${league.error}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    populateLeagueSelects() {
        const selects = ['league-select-lineup', 'league-select-waiver'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="">Select League</option>';
            
            this.leagues.forEach(league => {
                if (!league.error) {
                    select.innerHTML += `
                        <option value="${league.leagueId}">
                            ${league.leagueName} - ${league.teamName}
                        </option>
                    `;
                }
            });
        });
    }
    
    async optimizeLineup() {
        const leagueId = document.getElementById('league-select-lineup').value;
        const week = document.getElementById('week-input-lineup').value;
        
        if (!leagueId) {
            this.showError('Please select a league');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const result = await this.apiCall(`/api/leagues/${leagueId}/lineup?week=${week}`);
            const data = result.data || result;
            
            this.displayLineupRecommendations(data);
        } catch (error) {
            this.showError('Failed to optimize lineup: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    displayLineupRecommendations(recommendations) {
        const container = document.getElementById('lineup-results');
        
        if (!recommendations || !recommendations.optimal) {
            container.innerHTML = '<div class="alert alert-warning">No recommendations available</div>';
            return;
        }
        
        const { optimal, current, summary, confidence } = recommendations;
        
        container.innerHTML = `
            <div class="recommendations-card">
                <h3>Lineup Optimization Results</h3>
                <div class="confidence-score">
                    Confidence: ${confidence}%
                </div>
                <p class="summary">${summary}</p>
                
                <div class="lineup-comparison">
                    <div class="lineup-column">
                        <h4>Optimal Lineup</h4>
                        <div class="player-list">
                            ${optimal.starters.map(player => `
                                <div class="player-item optimal">
                                    <span class="player-name">${player.fullName || player.name}</span>
                                    <span class="player-position">${player.defaultPosition || player.position}</span>
                                    <span class="player-points">${player.projectedPoints?.toFixed(1) || '0.0'} pts</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    ${current ? `
                    <div class="lineup-column">
                        <h4>Current Lineup</h4>
                        <div class="player-list">
                            ${current.starters.map(player => `
                                <div class="player-item current">
                                    <span class="player-name">${player.fullName || player.name}</span>
                                    <span class="player-position">${player.defaultPosition || player.position}</span>
                                    <span class="player-points">${player.projectedPoints?.toFixed(1) || '0.0'} pts</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                ${recommendations.changes && recommendations.changes.length > 0 ? `
                    <div class="recommended-changes">
                        <h4>Recommended Changes</h4>
                        <ul>
                            ${recommendations.changes.map(change => `
                                <li>${change.action}: ${change.player} ${change.reason ? `(${change.reason})` : ''}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    async analyzeWaiverWire() {
        const leagueId = document.getElementById('league-select-waiver').value;
        const week = document.getElementById('week-input-waiver').value;
        
        if (!leagueId) {
            this.showError('Please select a league');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const result = await this.apiCall(`/api/leagues/${leagueId}/waiver?week=${week}`);
            const data = result.data || result;
            
            this.displayWaiverAnalysis(data);
        } catch (error) {
            this.showError('Failed to analyze waiver wire: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    displayWaiverAnalysis(analysis) {
        const container = document.getElementById('waiver-results');
        
        if (!analysis || !analysis.recommendations) {
            container.innerHTML = '<div class="alert alert-warning">No waiver recommendations available</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="waiver-analysis-card">
                <h3>Waiver Wire Analysis</h3>
                <p class="summary">${analysis.summary}</p>
                
                ${analysis.recommendations.length > 0 ? `
                    <div class="waiver-recommendations">
                        <h4>Top Recommendations</h4>
                        ${analysis.recommendations.slice(0, 5).map((rec, index) => `
                            <div class="waiver-item">
                                <div class="waiver-rank">#${index + 1}</div>
                                <div class="waiver-details">
                                    <div class="waiver-action">
                                        <span class="add">ADD: ${rec.player.fullName || rec.player.name}</span>
                                        <span class="drop">DROP: ${rec.dropPlayer?.fullName || rec.dropPlayer?.name || 'N/A'}</span>
                                    </div>
                                    <div class="waiver-reason">${rec.reason}</div>
                                    <div class="waiver-meta">
                                        Priority: ${rec.priority} | Confidence: ${rec.confidence}%
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="alert alert-info">No waiver moves recommended this week</div>'}
            </div>
        `;
    }
    
    async uploadRankings() {
        const fileInput = document.getElementById('rankings-file');
        const weekInput = document.getElementById('rankings-week');
        const typeSelect = document.getElementById('rankings-type');
        
        if (!fileInput.files[0]) {
            this.showError('Please select a file');
            return;
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                const result = await this.apiCall('/api/rankings/upload', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: typeSelect.value,
                        week: weekInput.value,
                        data: data
                    })
                });
                
                this.showSuccess('Rankings uploaded successfully');
            } catch (error) {
                this.showError('Failed to upload rankings: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error-message') || this.createMessageDiv('error-message');
        errorDiv.className = 'alert alert-error';
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    showSuccess(message) {
        const successDiv = document.getElementById('success-message') || this.createMessageDiv('success-message');
        successDiv.className = 'alert alert-success';
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
    
    createMessageDiv(id) {
        const div = document.createElement('div');
        div.id = id;
        div.style.position = 'fixed';
        div.style.top = '20px';
        div.style.right = '20px';
        div.style.zIndex = '9999';
        document.body.appendChild(div);
        return div;
    }
}

// Initialize the web client
document.addEventListener('DOMContentLoaded', () => {
    window.ffClient = new FFWebClient();
});