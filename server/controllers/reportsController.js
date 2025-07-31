const { pool } = require('../config/database');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const ChartJSNodeCanvas = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');

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

    // Enhanced export reports with Excel, PDF with charts, and CSV
    static async exportReport(req, res) {
        try {
            const { type, report, startDate, endDate, includeCharts } = req.query;
            let data = [];
            let chartData = null;
            
            // Fetch the relevant report data
            switch (report) {
                case 'task-stats':
                    data = [await ReportsController.taskStatsData(startDate, endDate)];
                    break;
                case 'user-productivity':
                    data = await ReportsController.userProductivityData(startDate, endDate);
                    break;
                case 'time-tracking':
                    data = await ReportsController.timeTrackingData(startDate, endDate);
                    break;
                case 'team-performance':
                    data = await ReportsController.teamPerformanceData(startDate, endDate);
                    break;
                case 'comprehensive':
                    const comprehensiveData = await ReportsController.comprehensiveReportData(startDate, endDate);
                    data = comprehensiveData.tasks;
                    chartData = comprehensiveData.charts;
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid report type' });
            }

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `${report}-${timestamp}`;

            if (type === 'csv') {
                return await ReportsController.exportCSV(res, data, filename);
            } else if (type === 'excel') {
                return await ReportsController.exportExcel(res, data, chartData, filename, report);
            } else if (type === 'pdf') {
                return await ReportsController.exportPDF(res, data, chartData, filename, report, startDate, endDate);
            } else {
                res.status(400).json({ error: 'Invalid export type. Use csv, excel, or pdf' });
            }
        } catch (error) {
            console.error('Export error:', error);
            res.status(500).json({ error: 'Failed to export report' });
        }
    }

    // Enhanced CSV export
    static async exportCSV(res, data, filename) {
        const parser = new Parser();
        const csv = parser.parse(data);
        res.header('Content-Type', 'text/csv');
        res.attachment(`${filename}.csv`);
        return res.send(csv);
    }

    // Enhanced Excel export with charts and formatting
    static async exportExcel(res, data, chartData, filename, reportType) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Report Data');
        
        if (data.length > 0) {
            // Add headers
            const headers = Object.keys(data[0]);
            worksheet.addRow(headers);
            
            // Style headers
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            
            // Add data rows
            data.forEach(row => {
                const values = headers.map(header => row[header]);
                worksheet.addRow(values);
            });
            
            // Style data rows
            for (let i = 2; i <= data.length + 1; i++) {
                const row = worksheet.getRow(i);
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            }
            
            // Auto-fit columns
            worksheet.columns.forEach((column) => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: false }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : maxLength + 2;
            });
        }
        
        // Add summary sheet if chart data exists
        if (chartData) {
            const summarySheet = workbook.addWorksheet('Summary');
            summarySheet.addRow(['Report Summary']);
            summarySheet.getCell('A1').font = { bold: true, size: 16 };
            
            if (chartData.summary) {
                Object.entries(chartData.summary).forEach(([key, value], index) => {
                    summarySheet.addRow([key.replace(/_/g, ' ').toUpperCase(), value]);
                });
            }
        }
        
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment(`${filename}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }

    // Enhanced PDF export with charts and professional formatting
    static async exportPDF(res, data, chartData, filename, reportType, startDate, endDate) {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        
        res.header('Content-Type', 'application/pdf');
        res.attachment(`${filename}.pdf`);
        doc.pipe(res);
        
        // Header
        doc.fontSize(20).text('TaskFlow Analytics Report', { align: 'center' });
        doc.fontSize(14).text(reportType.replace('-', ' ').toUpperCase(), { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        
        if (startDate || endDate) {
            doc.text(`Period: ${startDate || 'Beginning'} to ${endDate || 'Present'}`, { align: 'center' });
        }
        
        doc.moveDown(2);
        
        // Summary section
        if (chartData && chartData.summary) {
            doc.fontSize(16).text('Executive Summary', { underline: true });
            doc.moveDown();
            
            Object.entries(chartData.summary).forEach(([key, value]) => {
                doc.fontSize(12).text(`${key.replace(/_/g, ' ').toUpperCase()}: ${value}`);
            });
            
            doc.moveDown(2);
        }
        
        // Data table
        if (data.length > 0) {
            doc.fontSize(16).text('Detailed Data', { underline: true });
            doc.moveDown();
            
            const headers = Object.keys(data[0]);
            const columnWidth = (doc.page.width - 100) / headers.length;
            
            // Table headers
            let yPosition = doc.y;
            headers.forEach((header, index) => {
                doc.fontSize(10).font('Helvetica-Bold')
                   .text(header.toUpperCase(), 50 + (index * columnWidth), yPosition, {
                       width: columnWidth,
                       align: 'left'
                   });
            });
            
            yPosition += 20;
            
            // Table data
            data.slice(0, 20).forEach((row, rowIndex) => {
                if (yPosition > doc.page.height - 100) {
                    doc.addPage();
                    yPosition = 50;
                }
                
                headers.forEach((header, colIndex) => {
                    doc.fontSize(9).font('Helvetica')
                       .text(String(row[header] || ''), 50 + (colIndex * columnWidth), yPosition, {
                           width: columnWidth,
                           align: 'left'
                       });
                });
                yPosition += 15;
            });
            
            if (data.length > 20) {
                doc.moveDown().fontSize(10).text(`... and ${data.length - 20} more records`);
            }
        }
        
        // Footer
        doc.fontSize(8).text('Generated by TaskFlow Analytics Engine', {
            align: 'center',
            y: doc.page.height - 30
        });
        
        doc.end();
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

    // Get comprehensive team performance analytics
    static async getTeamPerformance(req, res) {
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
                SELECT 
                    u.id,
                    u.full_name,
                    u.username,
                    COUNT(t.id) as total_tasks,
                    COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
                    COUNT(t.id) FILTER (WHERE t.status = 'in-progress') as in_progress_tasks,
                    COUNT(t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
                    COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'completed') as overdue_tasks,
                    ROUND(COUNT(t.id) FILTER (WHERE t.status = 'completed') * 100.0 / NULLIF(COUNT(t.id), 0), 2) as completion_rate,
                    ROUND(AVG(CASE WHEN t.status = 'completed' THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 END), 2) as avg_completion_hours,
                    COALESCE(SUM(te.duration), 0) as total_time_minutes
                FROM users u
                LEFT JOIN tasks t ON t.assigned_to = u.id
                LEFT JOIN time_entries te ON te.user_id = u.id AND te.task_id = t.id
                ${where}
                GROUP BY u.id, u.full_name, u.username
                ORDER BY completion_rate DESC, completed_tasks DESC
            `, params);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching team performance:', error);
            res.status(500).json({ error: 'Failed to fetch team performance data' });
        }
    }

    // Get workload distribution across team members
    static async getWorkloadDistribution(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    u.full_name,
                    COUNT(t.id) FILTER (WHERE t.status = 'pending') as pending_workload,
                    COUNT(t.id) FILTER (WHERE t.status = 'in-progress') as active_workload,
                    COUNT(t.id) FILTER (WHERE t.priority = 'high' AND t.status != 'completed') as high_priority_tasks,
                    COUNT(t.id) FILTER (WHERE t.due_date < NOW() + INTERVAL '7 days' AND t.status != 'completed') as upcoming_deadlines
                FROM users u
                LEFT JOIN tasks t ON t.assigned_to = u.id
                GROUP BY u.id, u.full_name
                ORDER BY (pending_workload + active_workload) DESC
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching workload distribution:', error);
            res.status(500).json({ error: 'Failed to fetch workload distribution' });
        }
    }

    // Get time analytics and efficiency metrics
    static async getTimeAnalytics(req, res) {
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
                SELECT 
                    DATE(te.start_time) as date,
                    SUM(te.duration) as total_minutes,
                    COUNT(DISTINCT te.user_id) as active_users,
                    COUNT(DISTINCT te.task_id) as tasks_worked_on,
                    ROUND(AVG(te.duration), 2) as avg_session_minutes
                FROM time_entries te
                ${where}
                GROUP BY DATE(te.start_time)
                ORDER BY date DESC
                LIMIT 30
            `, params);

            res.json(result.rows.reverse());
        } catch (error) {
            console.error('Error fetching time analytics:', error);
            res.status(500).json({ error: 'Failed to fetch time analytics' });
        }
    }

    // Enhanced analytics endpoints
    static async getOverviewStats(req, res) {
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
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
                    COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tasks,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
                    COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue_tasks,
                    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 2) as avg_completion_hours,
                    ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 2) as completion_rate
                FROM tasks
                ${where}
            `, params);

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching overview stats:', error);
            res.status(500).json({ error: 'Failed to fetch overview statistics' });
        }
    }

    static async getPriorityStats(req, res) {
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
                    priority,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending
                FROM tasks
                ${where}
                GROUP BY priority
                ORDER BY 
                    CASE priority 
                        WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2
                        WHEN 'low' THEN 3
                    END
            `, params);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching priority stats:', error);
            res.status(500).json({ error: 'Failed to fetch priority statistics' });
        }
    }

    static async getCategoryStats(req, res) {
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
                    category,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 2) as completion_rate,
                    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 2) as avg_completion_hours
                FROM tasks
                ${where}
                GROUP BY category
                ORDER BY total DESC
            `, params);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching category stats:', error);
            res.status(500).json({ error: 'Failed to fetch category statistics' });
        }
    }

    static async getOverdueTasks(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    t.id, 
                    t.title, 
                    t.description,
                    t.priority,
                    t.category,
                    t.due_date,
                    t.created_at,
                    u.full_name as assigned_to_name,
                    creator.full_name as created_by_name,
                    EXTRACT(DAYS FROM (NOW() - t.due_date)) as days_overdue
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.due_date < NOW() 
                AND t.status != 'completed'
                ORDER BY t.due_date ASC
                LIMIT 20
            `);

            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching overdue tasks:', error);
            res.status(500).json({ error: 'Failed to fetch overdue tasks' });
        }
    }

    static async getCompletionTrend(req, res) {
        try {
            const { startDate, endDate } = req.query;
            let where = '';
            let params = [];
            
            if (startDate) {
                params.push(startDate);
                where += (where ? ' AND ' : 'WHERE ') + 'completed_at >= $' + params.length;
            }
            if (endDate) {
                params.push(endDate);
                where += (where ? ' AND ' : 'WHERE ') + 'completed_at <= $' + params.length;
            }

            const result = await pool.query(`
                SELECT 
                    DATE(completed_at) as date,
                    COUNT(*) as completed_tasks
                FROM tasks
                WHERE status = 'completed'
                ${where ? 'AND ' + where.replace('WHERE ', '') : ''}
                GROUP BY DATE(completed_at)
                ORDER BY date DESC
                LIMIT 30
            `, params);

            res.json(result.rows.reverse());
        } catch (error) {
            console.error('Error fetching completion trend:', error);
            res.status(500).json({ error: 'Failed to fetch completion trend' });
        }
    }

    // Get advanced export data for comprehensive reports
    static async getComprehensiveReport(req, res) {
        try {
            const { startDate, endDate, includeDetails } = req.query;
            const data = await ReportsController.comprehensiveReportData(startDate, endDate);
            
            const report = {
                ...data,
                tasks: includeDetails === 'true' ? data.tasks : [],
                generated_at: new Date().toISOString(),
                date_range: {
                    start: startDate || null,
                    end: endDate || null
                }
            };

            res.json(report);
        } catch (error) {
            console.error('Error generating comprehensive report:', error);
            res.status(500).json({ error: 'Failed to generate comprehensive report' });
        }
    }

    // Helper method for comprehensive report data
    static async comprehensiveReportData(startDate, endDate) {
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

        // Get comprehensive task data
        const tasks = await pool.query(`
            SELECT 
                t.id,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.category,
                t.estimated_hours,
                t.actual_hours,
                t.created_at,
                t.updated_at,
                t.due_date,
                t.completed_at,
                u.full_name as assigned_to_name,
                creator.full_name as created_by_name,
                CASE 
                    WHEN t.due_date < NOW() AND t.status != 'completed' THEN 'overdue'
                    WHEN t.due_date < NOW() + INTERVAL '7 days' AND t.status != 'completed' THEN 'due_soon'
                    ELSE 'on_track'
                END as urgency_status,
                CASE 
                    WHEN t.status = 'completed' THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600
                    ELSE NULL
                END as completion_time_hours
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            ${where}
            ORDER BY t.created_at DESC
        `, params);

        // Get summary statistics
        const summary = await pool.query(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue,
                ROUND(AVG(CASE WHEN status = 'completed' THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END), 2) as avg_completion_hours,
                ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 2) as completion_rate
            FROM tasks t
            ${where}
        `, params);

        // Get priority distribution for charts
        const priorityStats = await pool.query(`
            SELECT 
                priority,
                COUNT(*) as count
            FROM tasks t
            ${where}
            GROUP BY priority
        `, params);

        // Get category distribution
        const categoryStats = await pool.query(`
            SELECT 
                category,
                COUNT(*) as count
            FROM tasks t
            ${where}
            GROUP BY category
            ORDER BY count DESC
            LIMIT 10
        `, params);

        return {
            summary: summary.rows[0],
            tasks: tasks.rows,
            charts: {
                summary: summary.rows[0],
                priority_distribution: priorityStats.rows,
                category_distribution: categoryStats.rows
            }
        };
    }

    // Helper method for team performance data
    static async teamPerformanceData(startDate, endDate) {
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
            SELECT 
                u.id,
                u.full_name,
                u.username,
                COUNT(t.id) as total_tasks,
                COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
                COUNT(t.id) FILTER (WHERE t.status = 'in-progress') as in_progress_tasks,
                COUNT(t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
                COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status != 'completed') as overdue_tasks,
                ROUND(COUNT(t.id) FILTER (WHERE t.status = 'completed') * 100.0 / NULLIF(COUNT(t.id), 0), 2) as completion_rate,
                ROUND(AVG(CASE WHEN t.status = 'completed' THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 END), 2) as avg_completion_hours,
                COALESCE(SUM(te.duration), 0) as total_time_minutes
            FROM users u
            LEFT JOIN tasks t ON t.assigned_to = u.id
            LEFT JOIN time_entries te ON te.user_id = u.id AND te.task_id = t.id
            ${where}
            GROUP BY u.id, u.full_name, u.username
            ORDER BY completion_rate DESC, completed_tasks DESC
        `, params);

        return result.rows;
    }

    // Advanced Analytics: Predictive insights
    static async getPredictiveAnalytics(req, res) {
        try {
            // Calculate project completion predictions based on current velocity
            const velocityData = await pool.query(`
                SELECT 
                    DATE_TRUNC('week', completed_at) as week,
                    COUNT(*) as completed_tasks
                FROM tasks 
                WHERE status = 'completed' 
                AND completed_at > NOW() - INTERVAL '8 weeks'
                GROUP BY DATE_TRUNC('week', completed_at)
                ORDER BY week
            `);

            // Calculate burndown rate
            const burndownData = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
                    COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tasks,
                    AVG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('week', created_at)) as avg_weekly_creation
                FROM tasks
                WHERE created_at > NOW() - INTERVAL '8 weeks'
                GROUP BY DATE_TRUNC('week', created_at)
                ORDER BY DATE_TRUNC('week', created_at) DESC
                LIMIT 1
            `);

            // Calculate team efficiency trends
            const efficiencyTrend = await pool.query(`
                SELECT 
                    DATE_TRUNC('week', completed_at) as week,
                    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_hours,
                    COUNT(*) as completed_tasks
                FROM tasks 
                WHERE status = 'completed' 
                AND completed_at > NOW() - INTERVAL '12 weeks'
                GROUP BY DATE_TRUNC('week', completed_at)
                ORDER BY week
            `);

            // Project completion forecast
            const currentVelocity = velocityData.rows.length > 0 
                ? velocityData.rows.reduce((sum, week) => sum + parseInt(week.completed_tasks), 0) / velocityData.rows.length
                : 0;

            const remainingTasks = burndownData.rows[0]?.pending_tasks + burndownData.rows[0]?.in_progress_tasks || 0;
            const estimatedWeeksToCompletion = currentVelocity > 0 ? Math.ceil(remainingTasks / currentVelocity) : null;

            res.json({
                velocity: {
                    current_weekly_velocity: Math.round(currentVelocity * 100) / 100,
                    velocity_trend: velocityData.rows,
                    remaining_tasks: remainingTasks,
                    estimated_completion_weeks: estimatedWeeksToCompletion
                },
                efficiency: {
                    trend: efficiencyTrend.rows,
                    current_avg_hours: efficiencyTrend.rows.length > 0 
                        ? Math.round(efficiencyTrend.rows[efficiencyTrend.rows.length - 1].avg_completion_hours * 100) / 100
                        : null
                }
            });
        } catch (error) {
            console.error('Error fetching predictive analytics:', error);
            res.status(500).json({ error: 'Failed to fetch predictive analytics' });
        }
    }

    // Real-time dashboard metrics
    static async getRealTimeDashboard(req, res) {
        try {
            const [
                quickStats,
                recentActivity,
                upcomingDeadlines,
                teamStatus
            ] = await Promise.all([
                // Quick overview stats
                pool.query(`
                    SELECT 
                        COUNT(*) as total_tasks,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed_today,
                        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
                        COUNT(*) FILTER (WHERE due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND status != 'completed') as due_this_week
                    FROM tasks 
                    WHERE DATE(created_at) = CURRENT_DATE OR status IN ('in-progress', 'pending')
                `),
                
                // Recent activity (last 24 hours)
                pool.query(`
                    SELECT 
                        t.id,
                        t.title,
                        t.status,
                        t.updated_at,
                        u.full_name as assigned_to_name
                    FROM tasks t
                    LEFT JOIN users u ON t.assigned_to = u.id
                    WHERE t.updated_at > NOW() - INTERVAL '24 hours'
                    ORDER BY t.updated_at DESC
                    LIMIT 10
                `),
                
                // Upcoming deadlines
                pool.query(`
                    SELECT 
                        t.id,
                        t.title,
                        t.due_date,
                        t.priority,
                        u.full_name as assigned_to_name,
                        EXTRACT(DAYS FROM (t.due_date - NOW())) as days_until_due
                    FROM tasks t
                    LEFT JOIN users u ON t.assigned_to = u.id
                    WHERE t.due_date BETWEEN NOW() AND NOW() + INTERVAL '14 days'
                    AND t.status != 'completed'
                    ORDER BY t.due_date ASC
                    LIMIT 10
                `),
                
                // Team member status
                pool.query(`
                    SELECT 
                        u.full_name,
                        COUNT(t.id) FILTER (WHERE t.status = 'in-progress') as active_tasks,
                        COUNT(t.id) FILTER (WHERE t.status = 'completed' AND DATE(t.completed_at) = CURRENT_DATE) as completed_today
                    FROM users u
                    LEFT JOIN tasks t ON t.assigned_to = u.id
                    GROUP BY u.id, u.full_name
                    ORDER BY active_tasks DESC
                `)
            ]);

            res.json({
                overview: quickStats.rows[0],
                recent_activity: recentActivity.rows,
                upcoming_deadlines: upcomingDeadlines.rows,
                team_status: teamStatus.rows,
                last_updated: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching real-time dashboard:', error);
            res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    }
}

module.exports = ReportsController; 