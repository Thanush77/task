const { pool } = require('../config/database');

class Task {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.assignedTo = data.assigned_to;
        this.createdBy = data.created_by;
        this.priority = data.priority;
        this.category = data.category;
        this.status = data.status;
        this.estimatedHours = data.estimated_hours;
        this.actualHours = data.actual_hours;
        this.startDate = data.start_date;
        this.dueDate = data.due_date;
        this.completedAt = data.completed_at;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
        
        // Additional fields from joins
        this.assignedToName = data.assigned_to_name;
        this.createdByName = data.created_by_name;
        this.assignedByName = data.assigned_by_name;
        this.assignedAt = data.assigned_at;
        this.tags = data.tags;
    }

    static async findById(id) {
        try {
            const result = await pool.query(`
                SELECT t.*, 
                       u1.full_name as assigned_to_name,
                       u2.full_name as created_by_name,
                       u3.full_name as assigned_by_name,
                       ta.assigned_at,
                       ARRAY_AGG(tt.tag) FILTER (WHERE tt.tag IS NOT NULL) as tags
                FROM tasks t
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN users u2 ON t.created_by = u2.id
                LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = true
                LEFT JOIN users u3 ON ta.assigned_by = u3.id
                LEFT JOIN task_tags tt ON t.id = tt.task_id
                WHERE t.id = $1
                GROUP BY t.id, u1.full_name, u2.full_name, u3.full_name, ta.assigned_at
            `, [id]);
            
            return result.rows.length > 0 ? new Task(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Error finding task by ID: ${error.message}`);
        }
    }

    static async findAll(filters = {}) {
        try {
            const { status, assignedTo, createdBy, priority, category, limit, offset } = filters;
            
            let query = `
                SELECT t.*, 
                       u1.full_name as assigned_to_name,
                       u2.full_name as created_by_name,
                       u3.full_name as assigned_by_name,
                       ta.assigned_at,
                       ARRAY_AGG(tt.tag) FILTER (WHERE tt.tag IS NOT NULL) as tags
                FROM tasks t
                LEFT JOIN users u1 ON t.assigned_to = u1.id
                LEFT JOIN users u2 ON t.created_by = u2.id
                LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.is_current = true
                LEFT JOIN users u3 ON ta.assigned_by = u3.id
                LEFT JOIN task_tags tt ON t.id = tt.task_id
                WHERE 1=1
            `;
            
            const params = [];
            let paramCount = 0;

            if (status) {
                paramCount++;
                query += ` AND t.status = $${paramCount}`;
                params.push(status);
            }

            if (assignedTo) {
                paramCount++;
                query += ` AND t.assigned_to = $${paramCount}`;
                params.push(assignedTo);
            }

            if (createdBy) {
                paramCount++;
                query += ` AND t.created_by = $${paramCount}`;
                params.push(createdBy);
            }

            if (priority) {
                paramCount++;
                query += ` AND t.priority = $${paramCount}`;
                params.push(priority);
            }

            if (category) {
                paramCount++;
                query += ` AND t.category = $${paramCount}`;
                params.push(category);
            }

            query += ` GROUP BY t.id, u1.full_name, u2.full_name, u3.full_name, ta.assigned_at ORDER BY t.created_at DESC`;

            if (limit) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                params.push(limit);
            }

            if (offset) {
                paramCount++;
                query += ` OFFSET $${paramCount}`;
                params.push(offset);
            }

            const result = await pool.query(query, params);
            return result.rows.map(row => new Task(row));
        } catch (error) {
            throw new Error(`Error finding tasks: ${error.message}`);
        }
    }

    static async create(taskData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const {
                title,
                description,
                assignedTo,
                createdBy,
                priority = 'medium',
                category = 'general',
                estimatedHours = 1.0,
                startDate,
                dueDate,
                tags = []
            } = taskData;

            // Create task
            const taskResult = await client.query(
                `INSERT INTO tasks (title, description, assigned_to, created_by, priority, category, 
                 estimated_hours, start_date, due_date) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [title, description, assignedTo, createdBy, priority, category, 
                 estimatedHours, startDate, dueDate]
            );

            const task = taskResult.rows[0];

            // Add tags if provided
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    if (tag && tag.trim()) {
                        await client.query(
                            'INSERT INTO task_tags (task_id, tag) VALUES ($1, $2)',
                            [task.id, tag.trim()]
                        );
                    }
                }
            }

            await client.query('COMMIT');
            
            // Return the created task with full details
            return await Task.findById(task.id);
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Error creating task: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async update(updateData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const allowedFields = [
                'title', 'description', 'assigned_to', 'priority', 'category',
                'estimated_hours', 'actual_hours', 'start_date', 'due_date', 'status'
            ];
            
            const updates = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updateData)) {
                const dbField = key === 'assignedTo' ? 'assigned_to' :
                               key === 'estimatedHours' ? 'estimated_hours' :
                               key === 'actualHours' ? 'actual_hours' :
                               key === 'startDate' ? 'start_date' :
                               key === 'dueDate' ? 'due_date' : key;
                
                if (allowedFields.includes(dbField)) {
                    updates.push(`${dbField} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }

            // Handle status change to completed
            if (updateData.status === 'completed' && this.status !== 'completed') {
                updates.push(`completed_at = CURRENT_TIMESTAMP`);
            } else if (updateData.status && updateData.status !== 'completed') {
                updates.push(`completed_at = NULL`);
            }

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(this.id);
            const query = `
                UPDATE tasks 
                SET ${updates.join(', ')} 
                WHERE id = $${paramCount} 
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Update tags if provided
            if (updateData.tags !== undefined) {
                await client.query('DELETE FROM task_tags WHERE task_id = $1', [this.id]);
                
                if (updateData.tags && updateData.tags.length > 0) {
                    for (const tag of updateData.tags) {
                        if (tag && tag.trim()) {
                            await client.query(
                                'INSERT INTO task_tags (task_id, tag) VALUES ($1, $2)',
                                [this.id, tag.trim()]
                            );
                        }
                    }
                }
            }

            await client.query('COMMIT');

            if (result.rows.length > 0) {
                Object.assign(this, result.rows[0]);
                return await Task.findById(this.id);
            }
            
            throw new Error('Task not found');
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Error updating task: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async delete() {
        try {
            const result = await pool.query(
                'DELETE FROM tasks WHERE id = $1 RETURNING *',
                [this.id]
            );
            
            return result.rows.length > 0;
        } catch (error) {
            throw new Error(`Error deleting task: ${error.message}`);
        }
    }

    static async getStatsByUser(userId) {
        try {
            const stats = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE assigned_to = $1 OR created_by = $1) as total_tasks,
                    COUNT(*) FILTER (WHERE (assigned_to = $1 OR created_by = $1) AND status = 'completed') as completed_tasks,
                    COUNT(*) FILTER (WHERE (assigned_to = $1 OR created_by = $1) AND status = 'in-progress') as in_progress_tasks,
                    COUNT(*) FILTER (WHERE assigned_to = $1) as assigned_to_me,
                    COUNT(*) FILTER (WHERE created_by = $1) as assigned_by_me,
                    COUNT(*) FILTER (WHERE (assigned_to = $1 OR created_by = $1) AND due_date < CURRENT_DATE AND status != 'completed') as overdue_tasks
                FROM tasks
            `, [userId]);

            return stats.rows[0];
        } catch (error) {
            throw new Error(`Error getting task stats: ${error.message}`);
        }
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            assignedTo: this.assignedTo,
            createdBy: this.createdBy,
            priority: this.priority,
            category: this.category,
            status: this.status,
            estimatedHours: this.estimatedHours,
            actualHours: this.actualHours,
            startDate: this.startDate,
            dueDate: this.dueDate,
            completedAt: this.completedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            assignedToName: this.assignedToName,
            createdByName: this.createdByName,
            tags: this.tags
        };
    }
}

module.exports = Task;