class WebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventHandlers = {};
        this.userId = null;
        this.currentTaskId = null;
    }

    connect(userId) {
        try {
            this.userId = userId;
            
            // Initialize Socket.IO connection
            this.socket = io(window.location.origin, {
                transports: ['websocket', 'polling']
            });

            this.setupEventHandlers();
            this.setupConnectionHandlers();
            
            console.log('🔌 WebSocket connection initiated');
        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }

    setupConnectionHandlers() {
        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Join user room for private notifications
            if (this.userId) {
                this.socket.emit('join-user-room', this.userId);
            }
            
            // Rejoin current task room if applicable
            if (this.currentTaskId) {
                this.socket.emit('join-task-room', this.currentTaskId);
            }
            
            this.showNotification('Connected to real-time updates', 'success');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            this.isConnected = false;
            this.showNotification('Disconnected from real-time updates', 'warning');
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.handleReconnect();
        });
    }

    setupEventHandlers() {
        // Task events
        this.socket.on('task-created', (data) => {
            this.handleTaskCreated(data.task);
        });

        this.socket.on('task-updated', (data) => {
            this.handleTaskUpdated(data.task);
        });

        this.socket.on('task-deleted', (data) => {
            this.handleTaskDeleted(data.taskId);
        });

        this.socket.on('task-assigned', (data) => {
            this.handleTaskAssigned(data.task);
        });

        this.socket.on('task-status-changed', (data) => {
            this.handleTaskStatusChanged(data);
        });

        this.socket.on('task-overdue', (data) => {
            this.handleTaskOverdue(data.task);
        });

        this.socket.on('task-due-soon', (data) => {
            this.handleTaskDueSoon(data.task);
        });

        // File events
        this.socket.on('file-uploaded', (data) => {
            this.handleFileUploaded(data.file, data.uploadedBy);
        });

        this.socket.on('file-deleted', (data) => {
            this.handleFileDeleted(data.fileId, data.filename);
        });

        // System events
        this.socket.on('system-notification', (data) => {
            this.showNotification(data.message, data.type);
        });
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect(this.userId);
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }

    joinTaskRoom(taskId) {
        if (this.socket && this.isConnected) {
            this.currentTaskId = taskId;
            this.socket.emit('join-task-room', taskId);
        }
    }

    leaveTaskRoom(taskId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('leave-task-room', taskId);
            if (this.currentTaskId === taskId) {
                this.currentTaskId = null;
            }
        }
    }

    // Event handlers
    handleTaskCreated(task) {
        console.log('📋 Task created:', task.title);
        this.showNotification(`New task created: ${task.title}`, 'info');
        
        // Refresh task list if on tasks page
        if (window.currentPage === 'tasks') {
            loadTasks();
        }
    }

    handleTaskUpdated(task) {
        console.log('📝 Task updated:', task.title);
        
        // Update task in UI if visible
        const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
        if (taskElement) {
            this.updateTaskElement(taskElement, task);
        }
        
        // Refresh analytics if on dashboard
        if (window.currentPage === 'dashboard') {
            loadAnalytics();
        }
    }

    handleTaskDeleted(taskId) {
        console.log('🗑️ Task deleted:', taskId);
        
        // Remove task from UI
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.remove();
        }
        
        this.showNotification('Task deleted', 'info');
    }

    handleTaskAssigned(task) {
        console.log('👤 Task assigned:', task.title);
        this.showNotification(`You were assigned: ${task.title}`, 'info');
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
            new Notification('New Task Assignment', {
                body: `You were assigned: ${task.title}`,
                icon: '/favicon.ico'
            });
        }
    }

    handleTaskStatusChanged(data) {
        console.log('🔄 Task status changed:', data.taskId, data.oldStatus, '->', data.newStatus);
        
        const statusMessages = {
            'completed': 'Task completed',
            'in-progress': 'Task in progress',
            'pending': 'Task pending',
            'cancelled': 'Task cancelled'
        };
        
        const message = statusMessages[data.newStatus] || 'Task status changed';
        this.showNotification(`${message}: ${data.task.title}`, 'info');
    }

    handleTaskOverdue(task) {
        console.log('⚠️ Task overdue:', task.title);
        this.showNotification(`Task overdue: ${task.title}`, 'error');
        
        // Show browser notification
        if (Notification.permission === 'granted') {
            new Notification('Task Overdue!', {
                body: `${task.title} is overdue`,
                icon: '/favicon.ico'
            });
        }
    }

    handleTaskDueSoon(task) {
        console.log('📅 Task due soon:', task.title);
        this.showNotification(`Task due soon: ${task.title}`, 'warning');
        
        // Show browser notification
        if (Notification.permission === 'granted') {
            new Notification('Task Due Soon', {
                body: `${task.title} is due soon`,
                icon: '/favicon.ico'
            });
        }
    }

    handleFileUploaded(file, uploadedBy) {
        console.log('📁 File uploaded:', file.originalName);
        this.showNotification(`File uploaded: ${file.originalName}`, 'info');
        
        // Refresh file list if on task detail page
        if (window.currentTaskId) {
            loadTaskFiles(window.currentTaskId);
        }
    }

    handleFileDeleted(fileId, filename) {
        console.log('🗑️ File deleted:', filename);
        this.showNotification(`File deleted: ${filename}`, 'info');
        
        // Remove file from UI
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.remove();
        }
    }

    updateTaskElement(element, task) {
        // Update task title
        const titleElement = element.querySelector('.task-title');
        if (titleElement) {
            titleElement.textContent = task.title;
        }
        
        // Update task status
        const statusElement = element.querySelector('.task-status');
        if (statusElement) {
            statusElement.textContent = task.status;
            statusElement.className = `task-status status-${task.status}`;
        }
        
        // Update task priority
        const priorityElement = element.querySelector('.task-priority');
        if (priorityElement) {
            priorityElement.textContent = task.priority;
            priorityElement.className = `task-priority priority-${task.priority}`;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to notification container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// Initialize WebSocket client
const wsClient = new WebSocketClient();

// Request notification permissions
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}