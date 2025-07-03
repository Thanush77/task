/**
 * Main Application Logic
 * Handles task management, dashboard, team, and UI interactions
 */

class TaskManager {
    constructor() {
        this.tasks = [];
        this.users = [];
        this.currentFilters = {};
        this.currentEditingTask = null;
        this.refreshInterval = null;
        
        // Bind methods to preserve context
        this.init = this.init.bind(this);
        this.loadTasks = this.loadTasks.bind(this);
        this.loadUsers = this.loadUsers.bind(this);
        this.loadDashboardStats = this.loadDashboardStats.bind(this);
    }

    /**
     * Initialize the task manager
     */
    async init() {
        try {
            console.log('🚀 Initializing TaskManager...');
            
            // Load initial data
            await Promise.all([
                this.loadUsers(),
                this.loadTasks(),
                this.loadDashboardStats()
            ]);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            console.log('✅ TaskManager initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize TaskManager:', error);
            showNotification('Failed to load application data. Please refresh the page.', 'error');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Task form submission
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTaskSubmit();
            });
        }

        // Search and filter handlers
        const searchInput = document.getElementById('searchTasks');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.filterTasks(), 300);
            });
        }

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    /**
     * Set up auto-refresh for real-time updates
     */
    setupAutoRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await this.loadDashboardStats();
                
                // Only refresh tasks if we're on the tasks tab
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab && activeTab.id === 'tasks') {
                    await this.loadTasks();
                }
            }
        }, 30000);
    }

    /**
     * Load all users
     */
    async loadUsers() {
        try {
            const response = await window.api.getUsers();
            this.users = response.users || response;
            this.populateUserSelects();
            this.renderTeamGrid();
            
            console.log(`👥 Loaded ${this.users.length} users`);
            
        } catch (error) {
            console.error('❌ Failed to load users:', error);
            showNotification('Failed to load team members.', 'error');
        }
    }

    /**
     * Load all tasks
     */
    async loadTasks() {
        try {
            const response = await window.api.getTasks(this.currentFilters);
            this.tasks = response.tasks || response;
            this.renderTasks();
            
            console.log(`📋 Loaded ${this.tasks.length} tasks`);
            
        } catch (error) {
            console.error('❌ Failed to load tasks:', error);
            this.renderTasksError();
            showNotification('Failed to load tasks.', 'error');
        }
    }

    /**
     * Load dashboard statistics
     */
    async loadDashboardStats() {
        try {
            const stats = await window.api.getDashboardStats();
            this.updateDashboard(stats);
            
        } catch (error) {
            console.error('❌ Failed to load dashboard stats:', error);
            // Don't show notification for stats failure as it's not critical
        }
    }

    /**
     * Populate user select dropdowns
     */
    populateUserSelects() {
        const selects = document.querySelectorAll('#taskAssignTo');
        
        selects.forEach(select => {
            select.innerHTML = '<option value="">Select team member</option>';
            
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                const isCurrentUser = window.authManager.getCurrentUser()?.id === user.id;
                option.textContent = `${user.full_name} ${isCurrentUser ? '(Me)' : ''}`;
                select.appendChild(option);
            });
        });
    }

    /**
     * Handle task form submission
     */
    async handleTaskSubmit() {
        try {
            const taskData = this.getTaskFormData();
            
            // Validate required fields
            if (!taskData.title.trim()) {
                showNotification('Task title is required.', 'error');
                return;
            }

            if (!taskData.assignedTo) {
                showNotification('Please select a team member to assign the task.', 'error');
                return;
            }

            this.setTaskFormLoading(true);

            let response;
            if (this.currentEditingTask) {
                // Update existing task
                response = await window.api.updateTask(this.currentEditingTask.id, taskData);
                showNotification('Task updated successfully!', 'success');
            } else {
                // Create new task
                response = await window.api.createTask(taskData);
                showNotification('Task created successfully!', 'success');
            }

            // Refresh data
            await Promise.all([
                this.loadTasks(),
                this.loadDashboardStats()
            ]);

            // Close modal and reset form
            this.closeTaskModal();

        } catch (error) {
            console.error('❌ Task submit error:', error);
            showNotification(error.getUserMessage(), 'error');
        } finally {
            this.setTaskFormLoading(false);
        }
    }

    /**
     * Get task form data
     */
    getTaskFormData() {
        return {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim() || null,
            assignedTo: parseInt(document.getElementById('taskAssignTo').value) || null,
            priority: document.getElementById('taskPriority').value,
            category: document.getElementById('taskCategory').value,
            estimatedHours: parseFloat(document.getElementById('taskEstimatedHours').value) || 1.0,
            startDate: document.getElementById('taskStartDate').value || null,
            dueDate: document.getElementById('taskDueDate').value || null,
            tags: document.getElementById('taskTags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag)
        };
    }

    /**
     * Set task form loading state
     */
    setTaskFormLoading(isLoading) {
        const submitBtn = document.getElementById('taskSubmitBtn');
        if (!submitBtn) return;

        const textSpan = submitBtn.querySelector('.btn-text');
        const loaderSpan = submitBtn.querySelector('.btn-loader');

        if (isLoading) {
            submitBtn.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loaderSpan) {
                loaderSpan.style.display = 'flex';
            }
        } else {
            submitBtn.disabled = false;
            if (textSpan) textSpan.style.display = 'block';
            if (loaderSpan) loaderSpan.style.display = 'none';
        }
    }

    /**
     * Complete a task
     */
    async completeTask(taskId) {
        try {
            await window.api.updateTask(taskId, { status: 'completed' });
            
            // Update local task
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = 'completed';
                task.completed_at = new Date().toISOString();
            }

            // Refresh data
            await Promise.all([
                this.loadTasks(),
                this.loadDashboardStats()
            ]);

            showNotification('Task completed! 🎉', 'success');

        } catch (error) {
            console.error('❌ Complete task error:', error);
            showNotification(error.getUserMessage(), 'error');
        }
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
            return;
        }

        try {
            await window.api.deleteTask(taskId);
            
            // Remove from local tasks
            this.tasks = this.tasks.filter(t => t.id !== taskId);

            // Refresh data
            await Promise.all([
                this.loadTasks(),
                this.loadDashboardStats()
            ]);

            showNotification('Task deleted successfully.', 'info');

        } catch (error) {
            console.error('❌ Delete task error:', error);
            showNotification(error.getUserMessage(), 'error');
        }
    }

    /**
     * Edit a task
     */
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            showNotification('Task not found.', 'error');
            return;
        }

        this.currentEditingTask = task;
        this.populateTaskForm(task);
        this.openTaskModal('Edit Task');
    }

    /**
     * Populate task form with existing data
     */
    populateTaskForm(task) {
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskAssignTo').value = task.assigned_to || '';
        document.getElementById('taskPriority').value = task.priority || 'medium';
        document.getElementById('taskCategory').value = task.category || 'general';
        document.getElementById('taskEstimatedHours').value = task.estimated_hours || 1.0;
        
        // Format dates for datetime-local inputs
        if (task.start_date) {
            document.getElementById('taskStartDate').value = this.formatDateTimeLocal(task.start_date);
        }
        if (task.due_date) {
            document.getElementById('taskDueDate').value = this.formatDateTimeLocal(task.due_date);
        }
        
        // Format tags
        const tags = task.tags ? task.tags.filter(tag => tag).join(', ') : '';
        document.getElementById('taskTags').value = tags;
    }

    /**
     * Format date for datetime-local input
     */
    formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    /**
     * Filter tasks based on current filters
     */
    async filterTasks() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const searchQuery = document.getElementById('searchTasks').value.trim();

        this.currentFilters = {};
        
        if (statusFilter) this.currentFilters.status = statusFilter;
        if (priorityFilter) this.currentFilters.priority = priorityFilter;

        await this.loadTasks();

        // Apply client-side search filter
        if (searchQuery) {
            this.tasks = this.tasks.filter(task => 
                task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (task.assigned_to_name && task.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        this.renderTasks();
    }

    /**
     * Search tasks (called on input)
     */
    searchTasks() {
        this.filterTasks();
    }

    /**
     * Render tasks list
     */
    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;

        if (this.tasks.length === 0) {
            tasksList.innerHTML = this.getEmptyTasksHTML();
            return;
        }

        const tasksHTML = this.tasks.map(task => this.renderTask(task)).join('');
        tasksList.innerHTML = tasksHTML;
    }

    /**
     * Render single task
     */
    renderTask(task) {
        const priorityClass = `priority-${task.priority}`;
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
        const assignedToName = task.assigned_to_name || 'Unassigned';
        const tags = task.tags ? task.tags.filter(tag => tag).map(tag => 
            `<span class="task-tag">${this.escapeHtml(tag)}</span>`
        ).join('') : '';
        
        const isCompleted = task.status === 'completed';
        const canEdit = task.created_by === window.authManager.getCurrentUser()?.id || 
                       task.assigned_to === window.authManager.getCurrentUser()?.id;

        // Time tracking controls
        const timeControls = `
            <div class="task-timer" id="task-timer-${task.id}">
                <span class="timer-display" id="timer-display-${task.id}">--:--:--</span>
                <span class="timer-total" id="timer-total-${task.id}" style="margin-left:8px;font-size:0.9em;color:#888;">Total: --:--:--</span>
                <button class="btn btn-small btn-primary" onclick="taskManager.startTimer(${task.id})">▶️ Start</button>
                <button class="btn btn-small btn-warning" onclick="taskManager.pauseTimer(${task.id})">⏸️ Pause</button>
                <button class="btn btn-small btn-danger" onclick="taskManager.stopTimer(${task.id})">⏹️ Stop</button>
            </div>
        `;

        return `
            <div class="task-item ${priorityClass}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-priority ${priorityClass}">${task.priority}</div>
                </div>
                
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                
                <div class="task-meta">
                    <span>👤 ${this.escapeHtml(assignedToName)}</span>
                    <span>📅 ${dueDate}</span>
                    <span>⏱️ ${task.estimated_hours}h</span>
                    <span>📂 ${this.escapeHtml(task.category)}</span>
                    ${task.created_by_name ? `<span>👨‍💼 Created by ${this.escapeHtml(task.created_by_name)}</span>` : ''}
                </div>
                
                ${tags ? `<div class="task-tags">${tags}</div>` : ''}
                
                <div class="task-actions">
                    ${!isCompleted ? 
                        `<button class="btn btn-success btn-small" onclick="taskManager.completeTask(${task.id})">
                            ✅ Complete
                        </button>` :
                        `<span style="color: var(--success-color); font-weight: 600;">✅ Completed</span>`
                    }
                    ${canEdit ? 
                        `<button class="btn btn-secondary btn-small" onclick="taskManager.editTask(${task.id})">
                            ✏️ Edit
                        </button>` : ''
                    }
                    ${task.created_by === window.authManager.getCurrentUser()?.id ? 
                        `<button class="btn btn-danger btn-small" onclick="taskManager.deleteTask(${task.id})">
                            🗑️ Delete
                        </button>` : ''
                    }
                </div>
                ${!isCompleted ? timeControls : ''}
            </div>
        `;
    }

    /**
     * Render tasks error state
     */
    renderTasksError() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;

        tasksList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 16px;">❌</div>
                <h3>Failed to Load Tasks</h3>
                <p>There was an error loading your tasks. Please try refreshing the page.</p>
                <button class="btn btn-primary" onclick="taskManager.loadTasks()" style="margin-top: 1rem;">
                    🔄 Retry
                </button>
            </div>
        `;
    }

    /**
     * Get empty tasks HTML
     */
    getEmptyTasksHTML() {
        const hasFilters = Object.keys(this.currentFilters).length > 0 || 
                          document.getElementById('searchTasks').value.trim();

        if (hasFilters) {
            return `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 16px;">🔍</div>
                    <h3>No Tasks Found</h3>
                    <p>No tasks match your current filters. Try adjusting your search criteria.</p>
                    <button class="btn btn-secondary" onclick="taskManager.clearFilters()" style="margin-top: 1rem;">
                        Clear Filters
                    </button>
                </div>
            `;
        }

        return `
            <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 16px;">📝</div>
                <h3>No Tasks Yet</h3>
                <p>Create your first task to get started with task management!</p>
                <button class="btn btn-primary" onclick="openCreateTaskModal()" style="margin-top: 1rem;">
                    ➕ Create First Task
                </button>
            </div>
        `;
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('statusFilter').value = '';
        document.getElementById('priorityFilter').value = '';
        document.getElementById('searchTasks').value = '';
        
        this.currentFilters = {};
        this.loadTasks();
    }

    /**
     * Update dashboard statistics
     */
    updateDashboard(stats) {
        const elements = {
            totalTasks: document.getElementById('totalTasks'),
            completedTasks: document.getElementById('completedTasks'),
            inProgressTasks: document.getElementById('inProgressTasks'),
            assignedToMe: document.getElementById('assignedToMe'),
            assignedByMe: document.getElementById('assignedByMe'),
            timeToday: document.getElementById('timeToday')
        };

        Object.keys(elements).forEach(key => {
            if (elements[key] && stats[key] !== undefined) {
                elements[key].textContent = stats[key];
            }
        });

        // Add animation to updated numbers
        Object.values(elements).forEach(el => {
            if (el) {
                el.classList.add('animate-pulse');
                setTimeout(() => el.classList.remove('animate-pulse'), 1000);
            }
        });
    }

    /**
     * Render team grid
     */
    renderTeamGrid() {
        const teamGrid = document.getElementById('teamGrid');
        const teamCount = document.getElementById('teamCount');
        
        if (!teamGrid) return;

        if (teamCount) {
            teamCount.textContent = this.users.length;
        }

        if (this.users.length === 0) {
            teamGrid.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 16px;">👥</div>
                    <h3>No Team Members</h3>
                    <p>No team members found.</p>
                </div>
            `;
            return;
        }

        const membersHTML = this.users.map(user => this.renderTeamMember(user)).join('');
        teamGrid.innerHTML = membersHTML;
    }

    /**
     * Render team member card
     */
    renderTeamMember(user) {
        const initials = this.getUserInitials(user.full_name || user.username);
        const isCurrentUser = user.id === window.authManager.getCurrentUser()?.id;
        
        return `
            <div class="team-member">
                <div class="member-avatar">${initials}</div>
                <div class="member-name">${this.escapeHtml(user.full_name || user.username)}</div>
                <div class="member-email">${this.escapeHtml(user.email)}</div>
                <div class="member-role">${this.escapeHtml(user.role || 'User')}${isCurrentUser ? ' (You)' : ''}</div>
            </div>
        `;
    }

    /**
     * Get user initials
     */
    getUserInitials(name) {
        return name.split(' ')
                  .map(n => n.charAt(0))
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N - New task
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openCreateTaskModal();
        }

        // Escape - Close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
        }

        // Ctrl/Cmd + R - Refresh
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            this.refreshAll();
        }
    }

    /**
     * Refresh all data
     */
    async refreshAll() {
        const refreshIcon = document.getElementById('refreshIcon');
        if (refreshIcon) {
            refreshIcon.style.animation = 'spin 1s linear infinite';
        }

        try {
            await Promise.all([
                this.loadUsers(),
                this.loadTasks(),
                this.loadDashboardStats()
            ]);
            
            showNotification('Data refreshed successfully!', 'success');
        } catch (error) {
            showNotification('Failed to refresh data.', 'error');
        } finally {
            if (refreshIcon) {
                setTimeout(() => {
                    refreshIcon.style.animation = '';
                }, 1000);
            }
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        this.resetTaskForm();
    }

    /**
     * Reset task form
     */
    resetTaskForm() {
        const form = document.getElementById('taskForm');
        if (form) {
            form.reset();
        }
        
        this.currentEditingTask = null;
        
        // Reset form defaults
        const estimatedHours = document.getElementById('taskEstimatedHours');
        if (estimatedHours) {
            estimatedHours.value = '1.0';
        }
        
        const priority = document.getElementById('taskPriority');
        if (priority) {
            priority.value = 'medium';
        }
    }

    /**
     * Open task modal
     */
    openTaskModal(title = 'Create New Task') {
        const modal = document.getElementById('taskModal');
        const modalTitle = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('taskSubmitBtn');
        
        if (modalTitle) {
            modalTitle.textContent = title;
        }
        
        if (submitBtn) {
            const textSpan = submitBtn.querySelector('.btn-text');
            if (textSpan) {
                textSpan.textContent = title.includes('Edit') ? 'Update Task' : 'Create Task';
            }
        }
        
        if (modal) {
            modal.classList.add('active');
        }
        
        // Set default dates
        this.setDefaultDates();
        
        // Focus on title field
        setTimeout(() => {
            const titleField = document.getElementById('taskTitle');
            if (titleField) {
                titleField.focus();
            }
        }, 100);
    }

    /**
     * Close task modal
     */
    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.resetTaskForm();
    }

    /**
     * Set default dates for new tasks
     */
    setDefaultDates() {
        if (this.currentEditingTask) return; // Don't set defaults when editing
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        
        const startDateInput = document.getElementById('taskStartDate');
        if (startDateInput && !startDateInput.value) {
            startDateInput.value = now.toISOString().slice(0, 16);
        }
        
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const dueDateInput = document.getElementById('taskDueDate');
        if (dueDateInput && !dueDateInput.value) {
            dueDateInput.value = tomorrow.toISOString().slice(0, 16);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    // Time tracking logic
    timerIntervals = {};

    async startTimer(taskId) {
        try {
            await window.api.request(`/tasks/${taskId}/time/start`, { method: 'POST' });
            this.updateTimerDisplay(taskId);
        } catch (error) {
            showNotification('Failed to start timer', 'error');
        }
    }

    async pauseTimer(taskId) {
        try {
            await window.api.request(`/tasks/${taskId}/time/pause`, { method: 'POST' });
            this.updateTimerDisplay(taskId);
        } catch (error) {
            showNotification('Failed to pause timer', 'error');
        }
    }

    async stopTimer(taskId) {
        // Stop = pause and reset (no active timer)
        try {
            await window.api.request(`/tasks/${taskId}/time/pause`, { method: 'POST' });
            this.clearTimerInterval(taskId);
            this.updateTimerDisplay(taskId, true);
        } catch (error) {
            showNotification('Failed to stop timer', 'error');
        }
    }

    clearTimerInterval(taskId) {
        if (this.timerIntervals[taskId]) {
            clearInterval(this.timerIntervals[taskId]);
            delete this.timerIntervals[taskId];
        }
    }

    async updateTimerDisplay(taskId, reset = false) {
        // Get active timer and total time
        try {
            const res = await window.api.request(`/tasks/${taskId}/time/active`);
            const historyRes = await window.api.request(`/tasks/${taskId}/time/history`);
            const timerDisplay = document.getElementById(`timer-display-${taskId}`);
            const timerTotal = document.getElementById(`timer-total-${taskId}`);
            // Calculate total time (sum durations)
            let totalSeconds = 0;
            if (historyRes.history) {
                for (const entry of historyRes.history) {
                    if (entry.duration) totalSeconds += Math.floor(entry.duration * 60);
                }
            }
            // If timer is running, add current session
            if (res.entry && res.entry.startTime && !res.entry.endTime) {
                const start = new Date(res.entry.startTime);
                const now = new Date();
                const diff = Math.floor((now - start) / 1000);
                timerDisplay.textContent = this.formatSeconds(diff);
                this.clearTimerInterval(taskId);
                this.timerIntervals[taskId] = setInterval(() => {
                    const now2 = new Date();
                    const diff2 = Math.floor((now2 - start) / 1000);
                    timerDisplay.textContent = this.formatSeconds(diff2);
                }, 1000);
                timerTotal.textContent = `Total: ${this.formatSeconds(totalSeconds + diff)}`;
            } else {
                timerDisplay.textContent = '--:--:--';
                timerTotal.textContent = `Total: ${this.formatSeconds(totalSeconds)}`;
                this.clearTimerInterval(taskId);
            }
        } catch (error) {
            // Ignore
        }
    }

    formatSeconds(seconds) {
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
}

// =================== Global UI Functions ===================

/**
 * Show tab content
 */
window.showTab = function(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to clicked tab
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Show selected content
    const content = document.getElementById(tabName);
    if (content) {
        content.classList.add('active');
    }

    // Load data for specific tabs
    if (tabName === 'tasks' && window.taskManager) {
        window.taskManager.loadTasks();
    } else if (tabName === 'team' && window.taskManager) {
        window.taskManager.loadUsers();
    }
};

/**
 * Open create task modal
 */
window.openCreateTaskModal = function() {
    if (window.taskManager) {
        window.taskManager.openTaskModal();
    }
};

/**
 * Close task modal
 */
window.closeTaskModal = function() {
    if (window.taskManager) {
        window.taskManager.closeTaskModal();
    }
};

/**
 * Filter tasks
 */
window.filterTasks = function() {
    if (window.taskManager) {
        window.taskManager.filterTasks();
    }
};

/**
 * Search tasks
 */
window.searchTasks = function() {
    if (window.taskManager) {
        window.taskManager.searchTasks();
    }
};

/**
 * Refresh dashboard
 */
window.refreshDashboard = function() {
    if (window.taskManager) {
        window.taskManager.refreshAll();
    }
};

/**
 * Show notification
 */
window.showNotification = function(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add click to dismiss
    notification.addEventListener('click', () => {
        notification.remove();
    });

    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
};

/**
 * Format date for display
 */
window.formatDate = function(dateString) {
    if (!dateString) return 'No date';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return date < now ? 'Yesterday' : 'Tomorrow';
    } else if (diffDays < 7) {
        return `${diffDays} days ${date < now ? 'ago' : 'away'}`;
    } else {
        return date.toLocaleDateString();
    }
};

/**
 * Format time duration
 */
window.formatDuration = function(minutes) {
    if (!minutes) return '0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
        return `${mins}m`;
    } else if (mins === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${mins}m`;
    }
};

// =================== Reports & Analytics (with Chart.js) ===================

let taskStatsChartInstance = null;
let userProductivityChartInstance = null;

async function fetchAndRenderReports() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const params = [];
    if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
    const query = params.length ? `?${params.join('&')}` : '';

    // Task Statistics
    const taskStats = await window.api.request(`/reports/task-stats${query}`);
    renderTaskStatsChart(taskStats);

    // User Productivity
    const userProductivity = await window.api.request(`/reports/user-productivity${query}`);
    renderUserProductivityChart(userProductivity);

    // Time Tracking
    const timeTracking = await window.api.request(`/reports/time-tracking${query}`);
    renderTimeTracking(timeTracking);
}

function renderTaskStatsChart(stats) {
    const container = document.getElementById('taskStatsChart');
    if (!container) return;
    container.innerHTML = '<canvas id="taskStatsCanvas" height="120"></canvas>';
    const ctx = document.getElementById('taskStatsCanvas').getContext('2d');
    if (taskStatsChartInstance) taskStatsChartInstance.destroy();
    taskStatsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Completed', 'Pending', 'In Progress', 'Cancelled'],
            datasets: [{
                label: 'Tasks',
                data: [stats.completed, stats.pending, stats.in_progress, stats.cancelled],
                backgroundColor: [
                    '#4caf50', '#ff9800', '#2196f3', '#f44336'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderUserProductivityChart(data) {
    const container = document.getElementById('userProductivityTable');
    if (!container) return;
    container.innerHTML = '<canvas id="userProductivityCanvas" height="120"></canvas>';
    const ctx = document.getElementById('userProductivityCanvas').getContext('2d');
    if (userProductivityChartInstance) userProductivityChartInstance.destroy();
    userProductivityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(u => u.full_name || u.username),
            datasets: [{
                label: 'Completed Tasks',
                data: data.map(u => u.completed_tasks),
                backgroundColor: '#4caf50'
            }, {
                label: 'Total Time (min)',
                data: data.map(u => u.total_minutes),
                backgroundColor: '#2196f3'
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderTimeTracking(data) {
    const container = document.getElementById('timeTrackingTable');
    if (!container) return;
    let html = `<table class="report-table"><thead><tr><th>User</th><th>Task</th><th>Entries</th><th>Total Time (min)</th><th>Avg Time (min)</th></tr></thead><tbody>`;
    data.forEach(row => {
        html += `<tr><td>${row.username}</td><td>${row.title || '-'}</td><td>${row.entries}</td><td>${row.total_minutes}</td><td>${row.avg_minutes}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// =================== Application Initialization ===================

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 TaskFlow application starting...');
    
    // Create global task manager instance
    window.taskManager = new TaskManager();
    
    // Initialize if user is already authenticated
    if (window.authManager && window.authManager.isAuthenticated()) {
        window.taskManager.init();
    }
    
    // Listen for successful authentication
    window.addEventListener('authTokenChanged', (event) => {
        if (event.detail.token) {
            // User authenticated, initialize task manager
            window.taskManager.init();
        } else {
            // User logged out, clean up task manager
            if (window.taskManager) {
                window.taskManager.destroy();
            }
        }
    });
    
    // Hide loading screen after short delay
    setTimeout(() => {
        if (window.authManager) {
            window.authManager.hideLoadingScreen();
        }
    }, 1500);
});

/**
 * Handle page visibility changes
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.taskManager && window.authManager.isAuthenticated()) {
        // Refresh data when page becomes visible
        window.taskManager.loadDashboardStats();
    }
});

/**
 * Handle before page unload
 */
window.addEventListener('beforeunload', () => {
    if (window.taskManager) {
        window.taskManager.destroy();
    }
});

// =================== Service Worker Registration ===================

/**
 * Register service worker for offline support (optional)
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaskManager };
}