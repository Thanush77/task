const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class AuditService {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
    }

    async ensureLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    async logAction(action, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            pid: process.pid,
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            // Log to database
            await this.logToDatabase(logEntry);
            
            // Log to file
            await this.logToFile(logEntry);
            
        } catch (error) {
            console.error('Audit logging failed:', error);
            // Fallback to console
            console.log('AUDIT:', JSON.stringify(logEntry));
        }
    }

    async logToDatabase(logEntry) {
        const query = `
            INSERT INTO audit_logs (timestamp, action, details, user_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        const values = [
            logEntry.timestamp,
            logEntry.action,
            JSON.stringify(logEntry.details),
            logEntry.details.userId || null,
            logEntry.details.ipAddress || null,
            logEntry.details.userAgent || null
        ];

        await pool.query(query, values);
    }

    async logToFile(logEntry) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `audit-${date}.log`);
        
        const logLine = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(logFile, logLine);
    }

    // Specific audit methods for different actions
    async logUserAction(userId, action, details = {}, req = null) {
        const auditDetails = {
            userId,
            ...details
        };

        if (req) {
            auditDetails.ipAddress = req.ip || req.connection.remoteAddress;
            auditDetails.userAgent = req.get('User-Agent');
            auditDetails.endpoint = req.originalUrl;
            auditDetails.method = req.method;
        }

        await this.logAction(action, auditDetails);
    }

    async logAuthentication(userId, action, success, details = {}, req = null) {
        await this.logUserAction(userId, `auth.${action}`, {
            success,
            ...details
        }, req);
    }

    async logTaskAction(userId, taskId, action, details = {}, req = null) {
        await this.logUserAction(userId, `task.${action}`, {
            taskId,
            ...details
        }, req);
    }

    async logFileAction(userId, fileId, action, details = {}, req = null) {
        await this.logUserAction(userId, `file.${action}`, {
            fileId,
            ...details
        }, req);
    }

    async logSecurityEvent(event, details = {}, req = null) {
        const auditDetails = {
            severity: details.severity || 'medium',
            ...details
        };

        if (req) {
            auditDetails.ipAddress = req.ip || req.connection.remoteAddress;
            auditDetails.userAgent = req.get('User-Agent');
            auditDetails.endpoint = req.originalUrl;
        }

        await this.logAction(`security.${event}`, auditDetails);
    }

    async logSystemEvent(event, details = {}) {
        await this.logAction(`system.${event}`, details);
    }

    // Query audit logs
    async getAuditLogs(filters = {}) {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const values = [];
        let paramCount = 0;

        // Add filters
        if (filters.userId) {
            query += ` AND user_id = $${++paramCount}`;
            values.push(filters.userId);
        }

        if (filters.action) {
            query += ` AND action LIKE $${++paramCount}`;
            values.push(`%${filters.action}%`);
        }

        if (filters.startDate) {
            query += ` AND timestamp >= $${++paramCount}`;
            values.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND timestamp <= $${++paramCount}`;
            values.push(filters.endDate);
        }

        if (filters.ipAddress) {
            query += ` AND ip_address = $${++paramCount}`;
            values.push(filters.ipAddress);
        }

        // Add ordering and limiting
        query += ' ORDER BY timestamp DESC';
        
        if (filters.limit) {
            query += ` LIMIT $${++paramCount}`;
            values.push(filters.limit);
        }

        if (filters.offset) {
            query += ` OFFSET $${++paramCount}`;
            values.push(filters.offset);
        }

        const result = await pool.query(query, values);
        return result.rows;
    }

    // Security analytics
    async getSecurityAnalytics(timeRange = '24h') {
        const timeCondition = this.getTimeCondition(timeRange);
        
        const queries = {
            failedLogins: `
                SELECT COUNT(*) as count
                FROM audit_logs 
                WHERE action = 'auth.login' 
                AND details->>'success' = 'false'
                AND ${timeCondition}
            `,
            suspiciousIPs: `
                SELECT ip_address, COUNT(*) as attempts
                FROM audit_logs 
                WHERE action LIKE 'security.%'
                AND ${timeCondition}
                GROUP BY ip_address
                ORDER BY attempts DESC
                LIMIT 10
            `,
            mostActiveUsers: `
                SELECT user_id, COUNT(*) as actions
                FROM audit_logs 
                WHERE user_id IS NOT NULL
                AND ${timeCondition}
                GROUP BY user_id
                ORDER BY actions DESC
                LIMIT 10
            `,
            topActions: `
                SELECT action, COUNT(*) as count
                FROM audit_logs 
                WHERE ${timeCondition}
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            `
        };

        const results = {};
        
        for (const [key, query] of Object.entries(queries)) {
            try {
                const result = await pool.query(query);
                results[key] = result.rows;
            } catch (error) {
                console.error(`Failed to execute analytics query ${key}:`, error);
                results[key] = [];
            }
        }

        return results;
    }

    getTimeCondition(timeRange) {
        const conditions = {
            '1h': "timestamp >= NOW() - INTERVAL '1 hour'",
            '24h': "timestamp >= NOW() - INTERVAL '24 hours'",
            '7d': "timestamp >= NOW() - INTERVAL '7 days'",
            '30d': "timestamp >= NOW() - INTERVAL '30 days'"
        };

        return conditions[timeRange] || conditions['24h'];
    }

    // Clean up old logs
    async cleanupOldLogs(days = 90) {
        try {
            const query = `
                DELETE FROM audit_logs 
                WHERE timestamp < NOW() - INTERVAL '${days} days'
            `;
            
            const result = await pool.query(query);
            console.log(`🧹 Cleaned up ${result.rowCount} old audit log entries`);
            
            // Also clean up old log files
            await this.cleanupOldLogFiles(days);
            
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    async cleanupOldLogFiles(days = 90) {
        try {
            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            for (const file of files) {
                if (file.startsWith('audit-') && file.endsWith('.log')) {
                    const dateStr = file.substring(6, 16); // Extract date from filename
                    const fileDate = new Date(dateStr);
                    
                    if (fileDate < cutoffDate) {
                        await fs.unlink(path.join(this.logDir, file));
                        console.log(`🧹 Deleted old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old log files:', error);
        }
    }
}

module.exports = new AuditService();