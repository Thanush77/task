/**
 * Safe version of reports.js that only uses existing endpoints
 * Use this temporarily until new analytics endpoints are deployed
 */

class ReportsManagerSafe {
    constructor() {
        this.charts = {};
        this.currentData = {};
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Safe Reports Manager...');
        this.setupEventListeners();
        await this.loadBasicReports();
        console.log('✅ Safe Reports Manager initialized');
    }

    setupEventListeners() {
        // Add basic event listeners
        const refreshButton = document.getElementById('refreshReports');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.loadBasicReports());
        }
    }

    async loadBasicReports() {
        try {
            // Only load endpoints that exist on current deployment
            await Promise.all([
                this.loadTaskStats(),
                this.loadUserProductivity(),
                this.loadTimeTracking()
            ]);
        } catch (error) {
            console.error('Error loading basic reports:', error);
        }
    }

    async loadTaskStats() {
        try {
            const data = await window.api.get('/reports/task-stats');
            this.renderTaskStatsChart(data);
        } catch (error) {
            console.log('Task stats endpoint not available:', error.message);
        }
    }

    async loadUserProductivity() {
        try {
            const data = await window.api.get('/reports/user-productivity');
            this.renderUserProductivityChart(data);
        } catch (error) {
            console.log('User productivity endpoint not available:', error.message);
        }
    }

    async loadTimeTracking() {
        try {
            const data = await window.api.get('/reports/time-tracking');
            this.renderTimeTracking(data);
        } catch (error) {
            console.log('Time tracking endpoint not available:', error.message);
        }
    }

    renderTaskStatsChart(data) {
        const ctx = document.getElementById('taskStatsChart');
        if (!ctx) return;

        if (this.charts.taskStats) {
            this.charts.taskStats.destroy();
        }

        this.charts.taskStats = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [
                        data.completed || 0,
                        data.in_progress || 0,
                        data.pending || 0,
                        data.cancelled || 0
                    ],
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderUserProductivityChart(data) {
        const container = document.getElementById('userProductivityTable');
        if (!container || !data.length) return;

        const html = `
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Completed Tasks</th>
                        <th>Total Time (hrs)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(user => `
                        <tr>
                            <td>${user.full_name || user.username}</td>
                            <td>${user.completed_tasks || 0}</td>
                            <td>${((user.total_minutes || 0) / 60).toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }

    renderTimeTracking(data) {
        const container = document.getElementById('timeTrackingTable');
        if (!container) return;

        if (!data.length) {
            container.innerHTML = '<p>No time tracking data available</p>';
            return;
        }

        const html = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Task</th>
                        <th>Total Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(entry => `
                        <tr>
                            <td>${entry.username}</td>
                            <td>${entry.title || 'N/A'}</td>
                            <td>${Math.floor(entry.total_minutes / 60)}h ${entry.total_minutes % 60}m</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }
}

// Initialize safe reports manager
if (typeof window !== 'undefined') {
    window.reportsManagerSafe = new ReportsManagerSafe();
}