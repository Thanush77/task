const User = require('../models/User');
const Task = require('../models/Task');
const { pool } = require('../config/database');

class UserController {
    static async getAllUsers(req, res) {
        try {
            const options = {
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset) : undefined,
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true
            };

            const users = await User.findAll(options);

            res.json({
                users: users.map(user => ({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.fullName,
                    avatar_url: user.avatarUrl,
                    role: user.role,
                    is_active: user.isActive,
                    created_at: user.createdAt
                })),
                count: users.length
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: 'Failed to retrieve users' });
        }
    }

    static async getUserById(req, res) {
        try {
            const userId = parseInt(req.params.id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            const user = await User.findById(userId);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Only return public information unless it's the user themselves or an admin
            const isOwnProfile = req.user.id === userId;
            const isAdmin = req.user.role === 'admin';

            if (isOwnProfile || isAdmin) {
                res.json({ user: user.toJSON() });
            } else {
                res.json({
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.fullName,
                        avatar_url: user.avatarUrl,
                        role: user.role
                    }
                });
            }
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Failed to retrieve user' });
        }
    }

    static async getDashboardStats(req, res) {
        try {
            const userId = req.user.id;

            // Get task statistics
            const taskStats = await Task.getStatsByUser(userId);

            // Get today's time tracking
            const timeResult = await pool.query(
                `SELECT SUM(duration) as total_minutes FROM time_entries 
                 WHERE user_id = $1 AND DATE(start_time) = CURRENT_DATE`,
                [userId]
            );

            const totalMinutes = timeResult.rows[0].total_minutes || 0;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            res.json({
                totalTasks: parseInt(taskStats.total_tasks) || 0,
                completedTasks: parseInt(taskStats.completed_tasks) || 0,
                inProgressTasks: parseInt(taskStats.in_progress_tasks) || 0,
                assignedToMe: parseInt(taskStats.assigned_to_me) || 0,
                assignedByMe: parseInt(taskStats.assigned_by_me) || 0,
                overdueTasks: parseInt(taskStats.overdue_tasks) || 0,
                timeToday: `${hours}h ${minutes}m`
            });
        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
        }
    }

    static async updateUser(req, res) {
        try {
            const userId = parseInt(req.params.id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            // Check permissions
            const isOwnProfile = req.user.id === userId;
            const isAdmin = req.user.role === 'admin';

            if (!isOwnProfile && !isAdmin) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            const user = await User.findById(userId);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const allowedFields = isAdmin 
                ? ['fullName', 'email', 'role', 'isActive', 'avatarUrl']
                : ['fullName', 'email', 'avatarUrl'];

            const updateData = {};
            
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            const updatedUser = await user.update(updateData);

            res.json({
                message: 'User updated successfully',
                user: updatedUser.toJSON()
            });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    }

    static async getUserTasks(req, res) {
        try {
            const userId = parseInt(req.params.id);
            
            if (isNaN(userId)) {
                return res.status(400).json({ error: 'Invalid user ID' });
            }

            // Check permissions
            const isOwnProfile = req.user.id === userId;
            const isAdmin = req.user.role === 'admin';

            if (!isOwnProfile && !isAdmin) {
                return res.status(403).json({ error: 'Permission denied' });
            }

            const filters = {
                assignedTo: userId,
                status: req.query.status,
                priority: req.query.priority,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined
            };

            const tasks = await Task.findAll(filters);

            res.json({
                tasks: tasks.map(task => task.toJSON()),
                count: tasks.length,
                userId: userId
            });
        } catch (error) {
            console.error('Get user tasks error:', error);
            res.status(500).json({ error: 'Failed to retrieve user tasks' });
        }
    }
}

module.exports = UserController;