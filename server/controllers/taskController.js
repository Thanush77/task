const Task = require('../models/Task');
const TimeEntry = require('../models/TimeEntry');
const { sanitizeInput } = require('../utils/helpers');

class TaskController {
    static async getAllTasks(req, res) {
        try {
            const filters = {
                status: req.query.status,
                assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : undefined,
                createdBy: req.query.createdBy ? parseInt(req.query.createdBy) : undefined,
                priority: req.query.priority,
                category: req.query.category,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset) : undefined
            };

            // Remove undefined values
            Object.keys(filters).forEach(key => 
                filters[key] === undefined && delete filters[key]
            );

            const tasks = await Task.findAll(filters);

            res.json({
                tasks: tasks.map(task => task.toJSON()),
                count: tasks.length,
                filters: filters
            });
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ error: 'Failed to retrieve tasks' });
        }
    }

    static async getTaskById(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID' });
            }

            const task = await Task.findById(taskId);
            
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            res.json({
                task: task.toJSON()
            });
        } catch (error) {
            console.error('Get task error:', error);
            res.status(500).json({ error: 'Failed to retrieve task' });
        }
    }

    static async createTask(req, res) {
        try {
            const {
                title,
                description,
                assignedTo,
                priority = 'medium',
                category = 'general',
                estimatedHours = 1.0,
                startDate,
                dueDate,
                tags = []
            } = req.body;

            // Input validation
            if (!title || title.trim().length === 0) {
                return res.status(400).json({ error: 'Task title is required' });
            }

            if (title.length > 255) {
                return res.status(400).json({ error: 'Task title too long (max 255 characters)' });
            }

            if (assignedTo && isNaN(parseInt(assignedTo))) {
                return res.status(400).json({ error: 'Invalid assigned user ID' });
            }

            if (!['low', 'medium', 'high'].includes(priority)) {
                return res.status(400).json({ error: 'Invalid priority level' });
            }

            if (estimatedHours <= 0 || estimatedHours > 1000) {
                return res.status(400).json({ error: 'Estimated hours must be between 0.1 and 1000' });
            }

            // Validate dates
            if (startDate && dueDate) {
                const start = new Date(startDate);
                const due = new Date(dueDate);
                
                if (due < start) {
                    return res.status(400).json({ error: 'Due date cannot be before start date' });
                }
            }

            const taskData = {
                title: sanitizeInput(title),
                description: description ? sanitizeInput(description) : null,
                assignedTo: assignedTo ? parseInt(assignedTo) : null,
                createdBy: req.user.id,
                priority,
                category: sanitizeInput(category),
                estimatedHours: parseFloat(estimatedHours),
                startDate: startDate || null,
                dueDate: dueDate || null,
                tags: Array.isArray(tags) ? tags.map(tag => sanitizeInput(tag)) : []
            };

            const task = await Task.create(taskData);

            res.status(201).json({
                message: 'Task created successfully',
                task: task.toJSON()
            });
        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({ error: 'Failed to create task' });
        }
    }

    static async updateTask(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID' });
            }

            const task = await Task.findById(taskId);
            
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // Check permissions (only creator or assignee can update)
            if (task.createdBy !== req.user.id && task.assignedTo !== req.user.id) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            const updateData = {};
            const allowedFields = [
                'title', 'description', 'assignedTo', 'priority', 'category',
                'estimatedHours', 'actualHours', 'startDate', 'dueDate', 'status', 'tags'
            ];

            // Validate and sanitize update data
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    let value = req.body[field];

                    switch (field) {
                        case 'title':
                            if (!value || value.trim().length === 0) {
                                return res.status(400).json({ error: 'Task title cannot be empty' });
                            }
                            if (value.length > 255) {
                                return res.status(400).json({ error: 'Task title too long' });
                            }
                            updateData[field] = sanitizeInput(value);
                            break;

                        case 'description':
                            updateData[field] = value ? sanitizeInput(value) : null;
                            break;

                        case 'assignedTo':
                            updateData[field] = value ? parseInt(value) : null;
                            break;

                        case 'priority':
                            if (!['low', 'medium', 'high'].includes(value)) {
                                return res.status(400).json({ error: 'Invalid priority level' });
                            }
                            updateData[field] = value;
                            break;

                        case 'status':
                            if (!['pending', 'in-progress', 'completed', 'cancelled'].includes(value)) {
                                return res.status(400).json({ error: 'Invalid status' });
                            }
                            updateData[field] = value;
                            break;

                        case 'category':
                            updateData[field] = sanitizeInput(value);
                            break;

                        case 'estimatedHours':
                        case 'actualHours':
                            const hours = parseFloat(value);
                            if (hours < 0 || hours > 1000) {
                                return res.status(400).json({ 
                                    error: `${field} must be between 0 and 1000` 
                                });
                            }
                            updateData[field] = hours;
                            break;

                        case 'startDate':
                        case 'dueDate':
                            updateData[field] = value || null;
                            break;

                        case 'tags':
                            updateData[field] = Array.isArray(value) ? 
                                value.map(tag => sanitizeInput(tag)).filter(tag => tag) : [];
                            break;
                    }
                }
            }

            // Validate dates if both are provided
            if (updateData.startDate && updateData.dueDate) {
                const start = new Date(updateData.startDate);
                const due = new Date(updateData.dueDate);
                
                if (due < start) {
                    return res.status(400).json({ error: 'Due date cannot be before start date' });
                }
            }

            const updatedTask = await task.update(updateData);

            res.json({
                message: 'Task updated successfully',
                task: updatedTask.toJSON()
            });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ error: 'Failed to update task' });
        }
    }

    static async deleteTask(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            
            if (isNaN(taskId)) {
                return res.status(400).json({ error: 'Invalid task ID' });
            }

            const task = await Task.findById(taskId);
            
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            // Check permissions (only creator can delete)
            if (task.createdBy !== req.user.id) {
                return res.status(403).json({ error: 'Only task creator can delete this task' });
            }

            const deleted = await task.delete();
            
            if (deleted) {
                res.json({ message: 'Task deleted successfully' });
            } else {
                res.status(500).json({ error: 'Failed to delete task' });
            }
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ error: 'Failed to delete task' });
        }
    }

    static async getTaskStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await Task.getStatsByUser(userId);

            res.json({
                stats: {
                    totalTasks: parseInt(stats.total_tasks) || 0,
                    completedTasks: parseInt(stats.completed_tasks) || 0,
                    inProgressTasks: parseInt(stats.in_progress_tasks) || 0,
                    assignedToMe: parseInt(stats.assigned_to_me) || 0,
                    assignedByMe: parseInt(stats.assigned_by_me) || 0,
                    overdueTasks: parseInt(stats.overdue_tasks) || 0
                }
            });
        } catch (error) {
            console.error('Get task stats error:', error);
            res.status(500).json({ error: 'Failed to retrieve task statistics' });
        }
    }

    // Start time tracking for a task
    static async startTime(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            const userId = req.user.id;
            const entry = await TimeEntry.start(taskId, userId);
            res.json({ message: 'Timer started', entry });
        } catch (error) {
            res.status(500).json({ error: 'Failed to start timer' });
        }
    }

    // Pause time tracking for a task
    static async pauseTime(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            const userId = req.user.id;
            const entry = await TimeEntry.pause(taskId, userId);
            res.json({ message: 'Timer paused', entry });
        } catch (error) {
            res.status(500).json({ error: 'Failed to pause timer' });
        }
    }

    // Get active time entry for a task/user
    static async getActiveTime(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            const userId = req.user.id;
            const entry = await TimeEntry.getActive(taskId, userId);
            res.json({ entry });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get active timer' });
        }
    }

    // Get time entry history for a task/user
    static async getTimeHistory(req, res) {
        try {
            const taskId = parseInt(req.params.id);
            const userId = req.user.id;
            const history = await TimeEntry.getHistory(taskId, userId);
            res.json({ history });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get time history' });
        }
    }
}

module.exports = TaskController;