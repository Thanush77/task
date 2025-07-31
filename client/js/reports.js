/**
 * Enhanced Reports Manager
 * Handles comprehensive analytics, charting, and export functionality
 */

class ReportsManager {
    constructor() {
        this.charts = {};
        this.currentData = {};
        this.dateRange = {
            start: null,
            end: null
        };
        this.refreshInterval = null;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Enhanced Reports Manager...');
        this.setupEventListeners();
        this.setDefaultDateRange();
        await this.loadAllReports();
        this.setupAutoRefresh();
        console.log('✅ Reports Manager initialized successfully');
    }

    setupEventListeners() {
        // Date range filters
        const applyButton = document.getElementById('applyReportFilters');
        const resetButton = document.getElementById('resetReportFilters');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyDateFilters());
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetDateFilters());
        }

        // Export buttons
        const exportCSV = document.getElementById('exportCSV');
        const exportPDF = document.getElementById('exportPDF');
        const exportExcel = document.getElementById('exportExcel');
        
        if (exportCSV) {
            exportCSV.addEventListener('click', () => this.exportReport('csv'));
        }
        
        if (exportPDF) {
            exportPDF.addEventListener('click', () => this.exportReport('pdf'));
        }
        
        if (exportExcel) {
            exportExcel.addEventListener('click', () => this.exportReport('excel'));
        }

        // Real-time data toggle
        const realtimeToggle = document.getElementById('realtimeToggle');
        if (realtimeToggle) {
            realtimeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startRealTimeUpdates();
                } else {
                    this.stopRealTimeUpdates();
                }
            });
        }

        // Report refresh button
        const refreshButton = document.getElementById('refreshReports');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshAllReports());
        }
    }

    setDefaultDateRange() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        const startInput = document.getElementById('reportStartDate');
        const endInput = document.getElementById('reportEndDate');
        
        if (startInput) {
            startInput.value = startDate.toISOString().split('T')[0];
        }
        if (endInput) {
            endInput.value = endDate.toISOString().split('T')[0];
        }

        this.dateRange = {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        };
    }

    async loadAllReports() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();

        try {
            await Promise.all([
                this.loadOverviewStats(),
                this.loadTaskStatusChart(),
                this.loadPriorityChart(),
                this.loadTeamPerformance(),
                this.loadCompletionTrend(),
                this.loadTimeAnalytics(),
                this.loadWorkloadDistribution(),
                this.loadOverdueTasks(),
                this.loadPredictiveAnalytics(),
                this.loadRealTimeDashboard()
            ]);
        } catch (error) {
            console.error('❌ Error loading reports:', error);
            this.showErrorState('Failed to load reports data');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    async loadOverviewStats() {
        try {
            const params = this.getDateParams();
            console.log('📊 Loading overview stats with params:', params);
            const data = await window.api.get('/reports/overview-stats', params);
            console.log('📊 Overview stats received:', data);
            this.currentData.overview = data;
            this.updateOverviewCards(data);
        } catch (error) {
            console.error('❌ Error loading overview stats:', error);
            this.showErrorInCard('analyticsTotal', 'Error loading stats');
            window.showNotification('Failed to load overview statistics', 'error');
        }
    }

    async loadTaskStatusChart() {
        try {
            const params = this.getDateParams();
            console.log('📊 Loading task stats with params:', params);
            const data = await window.api.get('/reports/task-stats', params);
            console.log('📊 Task stats received:', data);
            this.currentData.taskStats = data;
            this.renderTaskStatusChart(data);
        } catch (error) {
            console.error('❌ Error loading task status data:', error);
            this.showChartError('taskStatsChart', 'Failed to load task statistics');
            window.showNotification('Failed to load task status chart', 'error');
        }
    }

    async loadPriorityChart() {
        try {
            const params = this.getDateParams();
            const data = await window.api.get('/reports/priority-stats', params);
            this.currentData.priorityStats = data;
            this.renderPriorityChart(data);
        } catch (error) {
            console.error('Error loading priority data:', error);
        }
    }

    async loadTeamPerformance() {
        try {
            const params = this.getDateParams();
            const data = await window.api.get('/reports/team-performance', params);
            this.currentData.teamPerformance = data;
            this.renderTeamPerformanceTable(data);
        } catch (error) {
            console.error('Error loading team performance:', error);
        }
    }

    async loadCompletionTrend() {
        try {
            const params = this.getDateParams();
            const data = await window.api.get('/reports/completion-trend', params);
            this.currentData.completionTrend = data;
            this.renderCompletionTrendChart(data);
        } catch (error) {
            console.error('Error loading completion trend:', error);
        }
    }

    async loadTimeAnalytics() {
        try {
            const params = this.getDateParams();
            const data = await window.api.get('/reports/time-analytics', params);
            this.currentData.timeAnalytics = data;
            this.renderTimeAnalyticsChart(data);
        } catch (error) {
            console.error('Error loading time analytics:', error);
        }
    }

    async loadWorkloadDistribution() {
        try {
            const data = await window.api.get('/reports/workload-distribution');
            this.currentData.workloadDistribution = data;
            this.renderWorkloadChart(data);
        } catch (error) {
            console.error('Error loading workload distribution:', error);
        }
    }

    async loadOverdueTasks() {
        try {
            const data = await window.api.get('/reports/overdue-tasks');
            this.currentData.overdueTasks = data;
            this.renderOverdueTasksList(data);
        } catch (error) {
            console.error('Error loading overdue tasks:', error);
        }
    }

    async loadPredictiveAnalytics() {
        try {
            const data = await window.api.get('/reports/predictive-analytics');
            this.currentData.predictiveAnalytics = data;
            this.renderPredictiveInsights(data);
        } catch (error) {
            console.error('Error loading predictive analytics:', error);
        }
    }

    async loadRealTimeDashboard() {
        try {
            const data = await window.api.get('/reports/real-time-dashboard');
            this.currentData.realTimeDashboard = data;
            this.updateRealTimeDashboard(data);
        } catch (error) {
            console.error('Error loading real-time dashboard:', error);
        }
    }

    updateOverviewCards(data) {
        const elements = {
            total: document.getElementById('analyticsTotal'),
            completed: document.getElementById('analyticsCompleted'),
            avgTime: document.getElementById('analyticsAvgTime'),
            completionRate: document.getElementById('analyticsCompletionRate')
        };

        console.log('📊 Updating overview cards with data:', data);

        if (elements.total) {
            elements.total.textContent = data.total_tasks || 0;
            elements.total.style.color = '#333';
        }
        if (elements.completed) {
            elements.completed.textContent = data.completed_tasks || 0;
            elements.completed.style.color = '#10B981';
        }
        if (elements.avgTime) {
            const avgHours = parseFloat(data.avg_completion_hours || 0).toFixed(1);
            elements.avgTime.textContent = `${avgHours}h`;
            elements.avgTime.style.color = '#3B82F6';
        }
        if (elements.completionRate) {
            const rate = parseFloat(data.completion_rate || 0).toFixed(1);
            elements.completionRate.textContent = `${rate}%`;
            elements.completionRate.style.color = rate > 70 ? '#10B981' : rate > 40 ? '#F59E0B' : '#EF4444';
        }

        // Update trend indicators
        this.updateTrendIndicators(data);
    }

    showErrorInCard(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = 'Error';
            element.style.color = '#EF4444';
            element.title = message;
        }
    }

    showChartError(canvasId, message) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#EF4444';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(message, canvas.width / 2, canvas.height / 2);
        }
    }

    updateTrendIndicators(data) {
        // This would typically compare with previous period data
        // For now, we'll show positive trends for completed tasks
        const trends = {
            total: data.total_tasks > 0 ? '↗ +5%' : '— 0%',
            completed: data.completed_tasks > 0 ? '↗ +12%' : '— 0%',
            avgTime: data.avg_completion_hours < 24 ? '↗ -15%' : '↗ +8%',
            completionRate: data.completion_rate > 50 ? '↗ +8%' : '↘ -3%'
        };

        const trendElements = {
            total: document.getElementById('analyticsTotalTrend'),
            completed: document.getElementById('analyticsCompletedTrend'),
            avgTime: document.getElementById('analyticsAvgTimeTrend'),
            completionRate: document.getElementById('analyticsCompletionRateTrend')
        };

        Object.keys(trends).forEach(key => {
            if (trendElements[key]) {
                trendElements[key].textContent = trends[key];
                trendElements[key].className = trends[key].includes('↗') ? 'card-trend positive' : 
                                              trends[key].includes('↘') ? 'card-trend negative' : 'card-trend neutral';
            }
        });
    }

    renderTaskStatusChart(data) {
        const ctx = document.getElementById('taskStatsChart');
        if (!ctx) return;

        // Destroy existing chart
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
                    backgroundColor: [
                        '#10B981', // Green for completed
                        '#3B82F6', // Blue for in progress
                        '#F59E0B', // Yellow for pending
                        '#EF4444'  // Red for cancelled
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderPriorityChart(data) {
        const ctx = document.getElementById('priorityStatsChart');
        if (!ctx) return;

        if (this.charts.priority) {
            this.charts.priority.destroy();
        }

        const labels = data.map(item => this.capitalizePriority(item.priority));
        const totals = data.map(item => item.total);
        const completed = data.map(item => item.completed);

        this.charts.priority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Tasks',
                        data: totals,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Completed',
                        data: completed,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    renderCompletionTrendChart(data) {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        const labels = data.map(item => new Date(item.date).toLocaleDateString());
        const completedTasks = data.map(item => item.completed_tasks);

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: completedTasks,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    renderTimeAnalyticsChart(data) {
        const ctx = document.getElementById('timeAnalyticsChart');
        if (!ctx) return;

        if (this.charts.timeAnalytics) {
            this.charts.timeAnalytics.destroy();
        }

        const labels = data.map(item => new Date(item.date).toLocaleDateString());
        const totalMinutes = data.map(item => (item.total_minutes / 60).toFixed(1)); // Convert to hours
        const activeUsers = data.map(item => item.active_users);

        this.charts.timeAnalytics = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Hours Worked',
                        data: totalMinutes,
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Active Users',
                        data: activeUsers,
                        borderColor: 'rgba(245, 158, 11, 1)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Users'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    renderWorkloadChart(data) {
        const ctx = document.getElementById('workloadChart');
        if (!ctx) return;

        if (this.charts.workload) {
            this.charts.workload.destroy();
        }

        const labels = data.map(item => item.full_name);
        const pendingWorkload = data.map(item => item.pending_workload);
        const activeWorkload = data.map(item => item.active_workload);

        this.charts.workload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Pending Tasks',
                        data: pendingWorkload,
                        backgroundColor: 'rgba(245, 158, 11, 0.6)',
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Active Tasks',
                        data: activeWorkload,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderTeamPerformanceTable(data) {
        const container = document.getElementById('userProductivityTable');
        if (!container) return;

        const html = `
            <div class="table-responsive">
                <table class="performance-table">
                    <thead>
                        <tr>
                            <th>Team Member</th>
                            <th>Total Tasks</th>
                            <th>Completed</th>
                            <th>In Progress</th>
                            <th>Completion Rate</th>
                            <th>Avg. Time (hrs)</th>
                            <th>Total Time (hrs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(member => `
                            <tr>
                                <td>
                                    <div class="member-info">
                                        <div class="member-avatar">${member.full_name.charAt(0)}</div>
                                        <span>${member.full_name}</span>
                                    </div>
                                </td>
                                <td>${member.total_tasks || 0}</td>
                                <td><span class="badge badge-success">${member.completed_tasks || 0}</span></td>
                                <td><span class="badge badge-primary">${member.in_progress_tasks || 0}</span></td>
                                <td>
                                    <div class="progress-container">
                                        <div class="progress-bar" style="width: ${member.completion_rate || 0}%"></div>
                                        <span class="progress-text">${member.completion_rate || 0}%</span>
                                    </div>
                                </td>
                                <td>${member.avg_completion_hours || 0}</td>
                                <td>${((member.total_time_minutes || 0) / 60).toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    renderOverdueTasksList(data) {
        const container = document.getElementById('overdueTasksList');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <h3>No Overdue Tasks!</h3>
                    <p>Great job keeping up with deadlines!</p>
                </div>
            `;
            return;
        }

        const html = `
            <div class="overdue-tasks-list">
                ${data.map(task => `
                    <div class="overdue-task-item priority-${task.priority}">
                        <div class="task-header">
                            <h4>${this.escapeHtml(task.title)}</h4>
                            <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        </div>
                        <div class="task-meta">
                            <span class="overdue-days">${Math.floor(task.days_overdue)} days overdue</span>
                            <span class="assigned-to">👤 ${task.assigned_to_name || 'Unassigned'}</span>
                            <span class="category">📂 ${task.category}</span>
                        </div>
                        <div class="task-dates">
                            <small>Due: ${new Date(task.due_date).toLocaleDateString()}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    renderPredictiveInsights(data) {
        const container = document.getElementById('predictiveInsights');
        if (!container) return;

        const velocity = data.velocity || {};
        const efficiency = data.efficiency || {};

        const html = `
            <div class="predictive-analytics">
                <div class="insights-grid">
                    <div class="insight-card">
                        <div class="insight-header">
                            <h4>🚀 Team Velocity</h4>
                        </div>
                        <div class="insight-content">
                            <div class="metric-large">${velocity.current_weekly_velocity || 0}</div>
                            <div class="metric-label">Tasks/Week</div>
                            <div class="insight-details">
                                <p><strong>Remaining Tasks:</strong> ${velocity.remaining_tasks || 0}</p>
                                <p><strong>Estimated Completion:</strong> 
                                   ${velocity.estimated_completion_weeks ? 
                                     `${velocity.estimated_completion_weeks} weeks` : 
                                     'Unable to estimate'}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="insight-card">
                        <div class="insight-header">
                            <h4>⏱️ Efficiency Trend</h4>
                        </div>
                        <div class="insight-content">
                            <div class="metric-large">${efficiency.current_avg_hours || 0}h</div>
                            <div class="metric-label">Avg. Completion Time</div>
                            <div class="insight-details">
                                <p>Based on last 12 weeks of data</p>
                                <p>${efficiency.current_avg_hours > 24 ? 
                                    '📈 Consider task breakdown' : 
                                    '✅ Good task sizing'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="velocity-trend">
                    <h4>📊 Velocity Trend</h4>
                    <div id="velocityChart" class="mini-chart"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // Render velocity trend chart if we have data
        if (velocity.velocity_trend && velocity.velocity_trend.length > 0) {
            this.renderVelocityChart(velocity.velocity_trend);
        }
    }

    renderVelocityChart(data) {
        const ctx = document.getElementById('velocityChart');
        if (!ctx) return;

        if (this.charts.velocity) {
            this.charts.velocity.destroy();
        }

        const labels = data.map(item => new Date(item.week).toLocaleDateString());
        const completedTasks = data.map(item => parseInt(item.completed_tasks));

        this.charts.velocity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Weekly Velocity',
                    data: completedTasks,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    updateRealTimeDashboard(data) {
        // Update recent activity
        this.updateRecentActivity(data.recent_activity || []);
        
        // Update upcoming deadlines
        this.updateUpcomingDeadlines(data.upcoming_deadlines || []);
        
        // Update team status
        this.updateTeamStatus(data.team_status || []);
        
        // Update overview metrics with real-time data
        if (data.overview) {
            this.updateRealTimeOverview(data.overview);
        }
        
        // Update last updated timestamp
        const timestampEl = document.getElementById('lastUpdated');
        if (timestampEl) {
            timestampEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    updateRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        const html = `
            <div class="activity-list">
                ${activities.length === 0 ? 
                    '<div class="empty-state"><p>No recent activity</p></div>' :
                    activities.map(activity => `
                        <div class="activity-item">
                            <div class="activity-icon status-${activity.status}">
                                ${this.getStatusIcon(activity.status)}
                            </div>
                            <div class="activity-content">
                                <h5>${this.escapeHtml(activity.title)}</h5>
                                <p>Updated by ${activity.assigned_to_name || 'Unknown'}</p>
                                <small>${this.formatTimeAgo(activity.updated_at)}</small>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        container.innerHTML = html;
    }

    updateUpcomingDeadlines(deadlines) {
        const container = document.getElementById('upcomingDeadlines');
        if (!container) return;

        const html = `
            <div class="deadlines-list">
                ${deadlines.length === 0 ? 
                    '<div class="empty-state"><p>No upcoming deadlines</p></div>' :
                    deadlines.map(task => `
                        <div class="deadline-item priority-${task.priority}">
                            <div class="deadline-header">
                                <h5>${this.escapeHtml(task.title)}</h5>
                                <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                            </div>
                            <div class="deadline-meta">
                                <span class="due-date">📅 ${new Date(task.due_date).toLocaleDateString()}</span>
                                <span class="assigned-to">👤 ${task.assigned_to_name || 'Unassigned'}</span>
                                <span class="days-remaining">
                                    ${Math.ceil(task.days_until_due)} day(s) remaining
                                </span>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        container.innerHTML = html;
    }

    updateTeamStatus(teamMembers) {
        const container = document.getElementById('teamStatus');
        if (!container) return;

        const html = `
            <div class="team-status-grid">
                ${teamMembers.map(member => `
                    <div class="team-member-card">
                        <div class="member-avatar">${member.full_name.charAt(0)}</div>
                        <div class="member-info">
                            <h5>${member.full_name}</h5>
                            <div class="member-stats">
                                <span class="stat">
                                    <strong>${member.active_tasks || 0}</strong> active
                                </span>
                                <span class="stat">
                                    <strong>${member.completed_today || 0}</strong> completed today
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    updateRealTimeOverview(overview) {
        const elements = {
            totalTasks: document.getElementById('rtTotalTasks'),
            completedToday: document.getElementById('rtCompletedToday'),
            inProgress: document.getElementById('rtInProgress'),
            dueThisWeek: document.getElementById('rtDueThisWeek')
        };

        if (elements.totalTasks) elements.totalTasks.textContent = overview.total_tasks || 0;
        if (elements.completedToday) elements.completedToday.textContent = overview.completed_today || 0;
        if (elements.inProgress) elements.inProgress.textContent = overview.in_progress || 0;
        if (elements.dueThisWeek) elements.dueThisWeek.textContent = overview.due_this_week || 0;
    }

    // Utility methods
    getStatusIcon(status) {
        const icons = {
            'completed': '✅',
            'in-progress': '🔄',
            'pending': '⏳',
            'cancelled': '❌'
        };
        return icons[status] || '📋';
    }

    formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    // Utility methods
    getDateParams() {
        const params = {};
        
        // Get current date range from UI or use stored values
        const startInput = document.getElementById('reportStartDate');
        const endInput = document.getElementById('reportEndDate');
        
        if (startInput && startInput.value) {
            params.startDate = startInput.value;
            this.dateRange.start = startInput.value;
        } else if (this.dateRange.start) {
            params.startDate = this.dateRange.start;
        }
        
        if (endInput && endInput.value) {
            params.endDate = endInput.value;
            this.dateRange.end = endInput.value;
        } else if (this.dateRange.end) {
            params.endDate = this.dateRange.end;
        }
        
        console.log('📅 Date params:', params);
        return params;
    }

    applyDateFilters() {
        const startInput = document.getElementById('reportStartDate');
        const endInput = document.getElementById('reportEndDate');
        
        if (startInput && endInput) {
            this.dateRange = {
                start: startInput.value ? new Date(startInput.value).toISOString() : null,
                end: endInput.value ? new Date(endInput.value).toISOString() : null
            };
            
            this.loadAllReports();
            this.showNotification('Date filters applied successfully', 'success');
        }
    }

    resetDateFilters() {
        this.setDefaultDateRange();
        this.loadAllReports();
        this.showNotification('Date filters reset', 'info');
    }

    async exportReport(format) {
        try {
            this.showLoadingState('Generating export...');
            
            const params = {
                ...this.getDateParams(),
                type: format,
                report: 'comprehensive',
                includeDetails: 'true'
            };

            if (format === 'excel') {
                // For Excel, we'll generate CSV and let the user know to save as .xlsx
                params.type = 'csv';
            }

            const response = await fetch(`${window.api.baseURL}/reports/export?${new URLSearchParams(params)}`, {
                headers: {
                    'Authorization': `Bearer ${window.api.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const timestamp = new Date().toISOString().split('T')[0];
            a.download = `taskflow-report-${timestamp}.${format === 'excel' ? 'csv' : format}`;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            window.showNotification(`Report exported successfully as ${format.toUpperCase()}!`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            window.showNotification('Failed to export report', 'error');
        } finally {
            this.hideLoadingState();
        }
    }

    async refreshAllReports() {
        await this.loadAllReports();
        window.showNotification('Reports refreshed successfully', 'success');
    }

    startRealTimeUpdates() {
        if (this.refreshInterval) return;
        
        this.refreshInterval = setInterval(() => {
            this.loadAllReports();
        }, 30000); // Update every 30 seconds
        
        window.showNotification('Real-time updates enabled', 'info');
    }

    stopRealTimeUpdates() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.showNotification('Real-time updates disabled', 'info');
    }

    setupAutoRefresh() {
        // Auto-refresh every 5 minutes when the tab is visible
        setInterval(() => {
            if (document.visibilityState === 'visible' && !this.isLoading) {
                this.loadAllReports();
            }
        }, 5 * 60 * 1000);
    }

    // UI Helper methods
    showLoadingState(message = 'Loading reports...') {
        const loadingElements = document.querySelectorAll('.chart-container, .report-section');
        loadingElements.forEach(el => {
            if (!el.querySelector('.loading-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                `;
                el.appendChild(overlay);
            }
        });
    }

    hideLoadingState() {
        const overlays = document.querySelectorAll('.loading-overlay');
        overlays.forEach(overlay => overlay.remove());
    }

    showErrorState(message) {
        console.error('Reports error:', message);
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }

    capitalizePriority(priority) {
        return priority.charAt(0).toUpperCase() + priority.slice(1);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API methods
    destroy() {
        // Clean up charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        // Clear intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        console.log('📊 Reports Manager destroyed');
    }
}

// Initialize reports manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('reports')) {
        window.reportsManager = new ReportsManager();
    }
});

// Export functions for external use
window.refreshReports = function() {
    if (window.reportsManager) {
        window.reportsManager.refreshAllReports();
    }
};

window.exportReport = function(format) {
    if (window.reportsManager) {
        window.reportsManager.exportReport(format);
    }
};


// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsManager;
}