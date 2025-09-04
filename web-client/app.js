/**
 * Fantasy Football Manager Web Client
 */

class FFWebClient {
    constructor() {
        this.currentView = 'dashboard';
        this.leagues = [];
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
    }
    
    showLoading(show = true) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }
    
    async loadLeagues() {
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/leagues');
            this.leagues = await response.json();
            
            this.displayLeagues();
            this.populateLeagueSelects();
        } catch (error) {
            this.showError('Failed to load leagues: ' + error.message);
        } finally {
            this.showLoading(false);
        }
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
        
        container.innerHTML = this.leagues.map(league => `
            <div class="league-card">
                <h3>${league.leagueName}</h3>
                <div class="league-stats">
                    <div class="stat-item">
                        <span class="stat-label">Team:</span>
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
                        <span class="stat-value">${league.points || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Roster Size:</span>
                        <span class="stat-value">${league.rosterSize || 'N/A'}</span>
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
            const response = await fetch(`/api/leagues/${leagueId}/lineup?week=${week}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displayLineupRecommendations(data);
        } catch (error) {
            this.showError('Failed to optimize lineup: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    displayLineupRecommendations(data) {
        const container = document.getElementById('lineup-results');
        
        const summary = data.recommendations?.summary || 'No recommendations available';
        const changes = data.changes || [];
        const improvement = data.projectedImprovement || {};
        const confidence = data.recommendations?.confidenceScore || 0;
        
        let html = `
            <div class="lineup-summary">
                <h3>Optimization Summary</h3>
                <p>${summary}</p>
                <div class="league-stats" style="margin-top: 15px;">
                    <div class="stat-item">
                        <span class="stat-label">Current Projected:</span>
                        <span class="stat-value">${improvement.currentProjected?.toFixed(1) || 'N/A'} pts</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Optimal Projected:</span>
                        <span class="stat-value">${improvement.optimalProjected?.toFixed(1) || 'N/A'} pts</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Improvement:</span>
                        <span class="stat-value" style="color: ${improvement.improvement > 0 ? '#4CAF50' : '#666'}">
                            +${improvement.improvement?.toFixed(1) || 0} pts
                        </span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Confidence:</span>
                        <span class="stat-value">${confidence}%</span>
                    </div>
                </div>
            </div>
        `;
        
        if (changes.length > 0) {
            html += `
                <div class="lineup-changes">
                    <h3>Recommended Changes</h3>
                    ${changes.map(change => {
                        const playerName = change.player.fullName || 
                                         `${change.player.firstName} ${change.player.lastName}`;
                        return `
                            <div class="change-item">
                                <span class="change-action ${change.action.toLowerCase()}">
                                    ${change.action}
                                </span>
                                <span class="player-name">${playerName}</span>
                                <span class="player-position">${change.player.defaultPosition}</span>
                                <div style="margin-top: 5px; color: #666; font-size: 0.9rem;">
                                    ${change.reason}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // Display optimal lineup
        if (data.optimal) {
            html += `
                <div class="lineup-grid">
                    <h3>Optimal Lineup</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Player</th>
                                <th>Team</th>
                                <th>Rank</th>
                                <th>Projected</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.optimal.starters.map(player => {
                                const name = player.fullName || `${player.firstName} ${player.lastName}`;
                                return `
                                    <tr>
                                        <td><strong>${player.lineupPosition}</strong></td>
                                        <td>${name}</td>
                                        <td>${player.proTeam || 'N/A'}</td>
                                        <td>${player.ranking || 'N/A'}</td>
                                        <td>${player.projectedPoints?.toFixed(1) || 'N/A'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        container.innerHTML = html;
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
            const response = await fetch(`/api/leagues/${leagueId}/waiver?week=${week}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displayWaiverAnalysis(data);
        } catch (error) {
            this.showError('Failed to analyze waiver wire: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    displayWaiverAnalysis(data) {
        const container = document.getElementById('waiver-results');
        
        const summary = data.summary || 'No analysis available';
        const recommendations = data.recommendations || [];
        const breakouts = data.breakoutCandidates || [];
        const stashes = data.stashCandidates || [];
        
        let html = `
            <div class="alert alert-info">
                <strong>Summary:</strong> ${summary}
            </div>
        `;
        
        if (recommendations.length > 0) {
            html += `
                <div class="waiver-section">
                    <h3>Top Recommendations</h3>
                    ${recommendations.map((rec, index) => {
                        const addName = rec.player.fullName || 
                                       `${rec.player.firstName} ${rec.player.lastName}`;
                        const dropName = rec.dropPlayer.fullName || 
                                        `${rec.dropPlayer.firstName} ${rec.dropPlayer.lastName}`;
                        
                        return `
                            <div class="waiver-recommendation">
                                <span class="waiver-priority priority-${rec.priority.toLowerCase()}">
                                    ${rec.priority}
                                </span>
                                <strong>#${index + 1}</strong>
                                
                                <div class="player-info">
                                    <div>
                                        <span style="color: #4CAF50; font-weight: bold;">ADD:</span>
                                        <span class="player-name">${addName}</span>
                                        <span class="player-position">${rec.player.defaultPosition}</span>
                                    </div>
                                    <div>
                                        <span style="color: #f44336; font-weight: bold;">DROP:</span>
                                        <span class="player-name">${dropName}</span>
                                    </div>
                                </div>
                                
                                <div style="margin-top: 10px;">
                                    <strong>Reason:</strong> ${rec.reason}
                                </div>
                                <div style="margin-top: 5px;">
                                    <strong>Confidence:</strong> ${rec.confidence}%
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        if (breakouts.length > 0) {
            html += `
                <div class="waiver-section">
                    <h3>💎 Breakout Candidates</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Position</th>
                                <th>Week Rank</th>
                                <th>ROS Rank</th>
                                <th>Ownership</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${breakouts.map(candidate => {
                                const name = candidate.player.fullName || 
                                           `${candidate.player.firstName} ${candidate.player.lastName}`;
                                return `
                                    <tr>
                                        <td><strong>${name}</strong></td>
                                        <td>${candidate.player.defaultPosition}</td>
                                        <td>${candidate.weeklyRank || 'N/A'}</td>
                                        <td>${candidate.rosRank || 'N/A'}</td>
                                        <td>${candidate.ownership || 0}%</td>
                                        <td>${candidate.breakoutReason}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    async uploadRankings() {
        const type = document.getElementById('ranking-type').value;
        const week = document.getElementById('ranking-week').value;
        const fileInput = document.getElementById('ranking-file');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('Please select a file to upload');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const text = await file.text();
            let data;
            
            if (file.name.endsWith('.json')) {
                data = JSON.parse(text);
            } else if (file.name.endsWith('.csv')) {
                data = this.parseCSV(text);
            } else {
                throw new Error('Unsupported file format. Please use .json or .csv');
            }
            
            const response = await fetch('/api/rankings/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: type,
                    week: week,
                    data: data
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.showSuccess('Rankings uploaded successfully!');
            fileInput.value = '';
        } catch (error) {
            this.showError('Failed to upload rankings: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const player = {};
            
            headers.forEach((header, index) => {
                const value = values[index];
                if (header === 'rank' || header.includes('points')) {
                    player[header] = parseFloat(value) || 0;
                } else {
                    player[header] = value;
                }
            });
            
            return player;
        });
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '1001';
        notification.style.minWidth = '300px';
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ffClient = new FFWebClient();
});