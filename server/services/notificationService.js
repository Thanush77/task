class NotificationService {
    constructor(io) {
        this.io = io;
    }

    // Send real-time notification to a specific user
    notifyUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user-${userId}`).emit(event, data);
        }
    }

    // Send real-time notification to all users in a task room
    notifyTaskRoom(taskId, event, data) {
        if (this.io) {
            this.io.to(`task-${taskId}`).emit(event, data);
        }
    }

    // Broadcast to all connected users
    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    // Send task creation notification
    notifyTaskCreated(task) {
        this.broadcast('task-created', { task });
        
        if (task.assigned_to) {
            this.notifyUser(task.assigned_to, 'task-assigned', { task });
        }
    }

    // Send task update notification
    notifyTaskUpdated(task, changes = {}) {
        this.broadcast('task-updated', { task, changes });
        this.notifyTaskRoom(task.id, 'task-changed', { task, changes });
        
        // Notify specific users based on changes
        if (changes.assignedTo) {
            this.notifyUser(changes.assignedTo, 'task-assigned', { task });
        }
        
        if (changes.status) {
            this.broadcast('task-status-changed', {
                taskId: task.id,
                oldStatus: changes.oldStatus,
                newStatus: changes.status,
                task
            });
        }
    }

    // Send task deletion notification
    notifyTaskDeleted(taskId) {
        this.broadcast('task-deleted', { taskId });
        this.notifyTaskRoom(taskId, 'task-removed', { taskId });
    }

    // Send overdue task notification
    notifyOverdueTask(userId, task) {
        this.notifyUser(userId, 'task-overdue', { task });
    }

    // Send task due soon notification
    notifyTaskDueSoon(userId, task) {
        this.notifyUser(userId, 'task-due-soon', { task });
    }

    // Send file upload notification
    notifyFileUploaded(taskId, file, uploadedBy) {
        this.notifyTaskRoom(taskId, 'file-uploaded', { file, uploadedBy });
    }

    // Send general system notification
    notifySystem(userId, message, type = 'info') {
        this.notifyUser(userId, 'system-notification', { message, type });
    }
}

module.exports = NotificationService;