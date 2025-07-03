const { pool } = require('../config/database');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

class ReportsController {
    // Task statistics: completed, pending, in-progress, cancelled
    static async taskStats(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let where = '';
            let params = [];
            if (startDate) {
                params.push(startDate);
                where += (where ? ' AND ' : 'WHERE ') + 'created_at >= $' + params.length;
            }
            if (endDate) {
                params.push(endDate);
                where += (where ? ' AND ' : 'WHERE ') + 'created_at <= $' + params.length;
            }
            const result = await pool.query(`
                SELECT 
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                    COUNT(*) FILTER (WHERE status = 'in-progress') AS in_progress,
                    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
                FROM tasks
                ${where}
            `, params);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch task stats' });
        }
    }

    // User productivity: tasks completed per user, time spent
    static async userProductivity(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let where = '';
            let params = [];
            if (startDate) {
                params.push(startDate);
                where += (where ? ' AND ' : 'WHERE ') + 't.created_at >= $' + params.length;
            }
            if (endDate) {
                params.push(endDate);
                where += (where ? ' AND ' : 'WHERE ') + 't.created_at <= $' + params.length;
            }
            const result = await pool.query(`
                SELECT u.id, u.username, u.full_name, 
                    COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
                    COALESCE(SUM(te.duration), 0) AS total_minutes
                FROM users u
                LEFT JOIN tasks t ON t.assigned_to = u.id
                LEFT JOIN time_entries te ON te.user_id = u.id AND te.task_id = t.id
                ${where}
                GROUP BY u.id
                ORDER BY completed_tasks DESC
            `, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch user productivity' });
        }
    }

    // Time tracking: total/average time per user and per project
    static async timeTracking(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let where = '';
            let params = [];
            if (startDate) {
                params.push(startDate);
                where += (where ? ' AND ' : 'WHERE ') + 'te.start_time >= $' + params.length;
            }
            if (endDate) {
                params.push(endDate);
                where += (where ? ' AND ' : 'WHERE ') + 'te.end_time <= $' + params.length;
            }
            const result = await pool.query(`
                SELECT u.id AS user_id, u.username, t.id AS task_id, t.title,
                    COUNT(te.id) AS entries,
                    COALESCE(SUM(te.duration), 0) AS total_minutes,
                    COALESCE(AVG(te.duration), 0) AS avg_minutes
                FROM users u
                LEFT JOIN time_entries te ON te.user_id = u.id
                LEFT JOIN tasks t ON t.id = te.task_id
                ${where}
                GROUP BY u.id, t.id
                ORDER BY u.id, t.id
            `, params);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch time tracking data' });
        }
    }

    // Export reports as CSV or PDF
    static async exportReport(req, res) {
        try {
            const { type, report, startDate, endDate } = req.query;
            let data = [];
            // Fetch the relevant report data
            if (report === 'task-stats') {
                const result = await ReportsController.taskStatsData(startDate, endDate);
                data = [result];
            } else if (report === 'user-productivity') {
                data = await ReportsController.userProductivityData(startDate, endDate);
            } else if (report === 'time-tracking') {
                data = await ReportsController.timeTrackingData(startDate, endDate);
            } else {
                return res.status(400).json({ error: 'Invalid report type' });
            }
            if (type === 'csv') {
                const parser = new Parser();
                const csv = parser.parse(data);
                res.header('Content-Type', 'text/csv');
                res.attachment(`${report}.csv`);
                return res.send(csv);
            } else if (type === 'pdf') {
                const doc = new PDFDocument();
                res.header('Content-Type', 'application/pdf');
                res.attachment(`${report}.pdf`);
                doc.text(JSON.stringify(data, null, 2));
                doc.pipe(res);
                doc.end();
            } else {
                res.status(400).json({ error: 'Invalid export type' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to export report' });
        }
    }

    // Helper methods for export
    static async taskStatsData(startDate, endDate) {
        let where = '';
        let params = [];
        if (startDate) {
            params.push(startDate);
            where += (where ? ' AND ' : 'WHERE ') + 'created_at >= $' + params.length;
        }
        if (endDate) {
            params.push(endDate);
            where += (where ? ' AND ' : 'WHERE ') + 'created_at <= $' + params.length;
        }
        const result = await pool.query(`
            SELECT 
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE status = 'in-progress') AS in_progress,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
            FROM tasks
            ${where}
        `, params);
        return result.rows[0];
    }
    static async userProductivityData(startDate, endDate) {
        let where = '';
        let params = [];
        if (startDate) {
            params.push(startDate);
            where += (where ? ' AND ' : 'WHERE ') + 't.created_at >= $' + params.length;
        }
        if (endDate) {
            params.push(endDate);
            where += (where ? ' AND ' : 'WHERE ') + 't.created_at <= $' + params.length;
        }
        const result = await pool.query(`
            SELECT u.id, u.username, u.full_name, 
                COUNT(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks,
                COALESCE(SUM(te.duration), 0) AS total_minutes
            FROM users u
            LEFT JOIN tasks t ON t.assigned_to = u.id
            LEFT JOIN time_entries te ON te.user_id = u.id AND te.task_id = t.id
            ${where}
            GROUP BY u.id
            ORDER BY completed_tasks DESC
        `, params);
        return result.rows;
    }
    static async timeTrackingData(startDate, endDate) {
        let where = '';
        let params = [];
        if (startDate) {
            params.push(startDate);
            where += (where ? ' AND ' : 'WHERE ') + 'te.start_time >= $' + params.length;
        }
        if (endDate) {
            params.push(endDate);
            where += (where ? ' AND ' : 'WHERE ') + 'te.end_time <= $' + params.length;
        }
        const result = await pool.query(`
            SELECT u.id AS user_id, u.username, t.id AS task_id, t.title,
                COUNT(te.id) AS entries,
                COALESCE(SUM(te.duration), 0) AS total_minutes,
                COALESCE(AVG(te.duration), 0) AS avg_minutes
            FROM users u
            LEFT JOIN time_entries te ON te.user_id = u.id
            LEFT JOIN tasks t ON t.id = te.task_id
            ${where}
            GROUP BY u.id, t.id
            ORDER BY u.id, t.id
        `, params);
        return result.rows;
    }
}

module.exports = ReportsController; 