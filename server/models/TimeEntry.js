const { pool } = require('../config/database');

class TimeEntry {
    constructor(data) {
        this.id = data.id;
        this.taskId = data.task_id;
        this.userId = data.user_id;
        this.startTime = data.start_time;
        this.endTime = data.end_time;
        this.duration = data.duration;
        this.description = data.description;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    static async start(taskId, userId) {
        // End any previous active entry for this user/task
        await pool.query(
            `UPDATE time_entries SET end_time = NOW(), duration = EXTRACT(EPOCH FROM (NOW() - start_time))/60
             WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL`,
            [taskId, userId]
        );
        // Start new entry
        const result = await pool.query(
            `INSERT INTO time_entries (task_id, user_id, start_time) VALUES ($1, $2, NOW()) RETURNING *`,
            [taskId, userId]
        );
        return new TimeEntry(result.rows[0]);
    }

    static async pause(taskId, userId) {
        // End the current active entry
        const result = await pool.query(
            `UPDATE time_entries SET end_time = NOW(), duration = EXTRACT(EPOCH FROM (NOW() - start_time))/60
             WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL RETURNING *`,
            [taskId, userId]
        );
        return result.rows.length > 0 ? new TimeEntry(result.rows[0]) : null;
    }

    static async getActive(taskId, userId) {
        const result = await pool.query(
            `SELECT * FROM time_entries WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1`,
            [taskId, userId]
        );
        return result.rows.length > 0 ? new TimeEntry(result.rows[0]) : null;
    }

    static async getHistory(taskId, userId) {
        const result = await pool.query(
            `SELECT * FROM time_entries WHERE task_id = $1 AND user_id = $2 ORDER BY start_time DESC`,
            [taskId, userId]
        );
        return result.rows.map(row => new TimeEntry(row));
    }
}

module.exports = TimeEntry; 