const cron = require('node-cron');
const { pool } = require('../config/database');
const emailService = require('./emailService');

class SchedulerService {
    constructor() {
        this.jobs = [];
    }

    start() {
        console.log('🕐 Starting scheduler service...');
        
        // Check for overdue tasks every hour
        const overdueJob = cron.schedule('0 * * * *', async () => {
            console.log('🔍 Checking for overdue tasks...');
            await this.checkOverdueTasks();
        });

        // Check for tasks due in 24 hours - runs every 4 hours
        const dueSoonJob = cron.schedule('0 */4 * * *', async () => {
            console.log('🔍 Checking for tasks due soon...');
            await this.checkTasksDueSoon();
        });

        // Send daily task summary at 9 AM
        const dailySummaryJob = cron.schedule('0 9 * * *', async () => {
            console.log('📊 Sending daily task summaries...');
            await this.sendDailyTaskSummaries();
        });

        // Test email service connection on startup
        this.testEmailService();

        this.jobs.push(overdueJob, dueSoonJob, dailySummaryJob);
        console.log('✅ Scheduler service started');
    }

    async testEmailService() {
        try {
            await emailService.testConnection();
        } catch (error) {
            console.error('❌ Email service test failed:', error);
        }
    }

    async checkOverdueTasks() {
        try {
            const query = `
                SELECT 
                    t.id, t.title, t.description, t.priority, t.category, t.due_date, t.created_at,
                    u.id as user_id, u.email, u.full_name, u.username
                FROM tasks t
                JOIN users u ON t.assigned_to = u.id
                WHERE t.due_date < NOW()
                AND t.status != 'completed'
                AND t.status != 'cancelled'
                AND u.email IS NOT NULL
                AND u.email != ''
            `;

            const result = await pool.query(query);
            
            console.log(`📧 Found ${result.rows.length} overdue tasks to notify`);

            for (const row of result.rows) {
                try {
                    const task = {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        priority: row.priority,
                        category: row.category,
                        due_date: row.due_date,
                        created_at: row.created_at
                    };

                    const user = {
                        id: row.user_id,
                        email: row.email,
                        full_name: row.full_name,
                        username: row.username
                    };

                    await emailService.sendTaskDueDateReminderEmail(task, user);
                    
                    // Add a small delay to avoid overwhelming the email service
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to send overdue email for task ${row.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error checking overdue tasks:', error);
        }
    }

    async checkTasksDueSoon() {
        try {
            const query = `
                SELECT 
                    t.id, t.title, t.description, t.priority, t.category, t.due_date, t.created_at,
                    u.id as user_id, u.email, u.full_name, u.username
                FROM tasks t
                JOIN users u ON t.assigned_to = u.id
                WHERE t.due_date > NOW()
                AND t.due_date <= NOW() + INTERVAL '24 hours'
                AND t.status != 'completed'
                AND t.status != 'cancelled'
                AND u.email IS NOT NULL
                AND u.email != ''
            `;

            const result = await pool.query(query);
            
            console.log(`📧 Found ${result.rows.length} tasks due soon to notify`);

            for (const row of result.rows) {
                try {
                    const task = {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        priority: row.priority,
                        category: row.category,
                        due_date: row.due_date,
                        created_at: row.created_at
                    };

                    const user = {
                        id: row.user_id,
                        email: row.email,
                        full_name: row.full_name,
                        username: row.username
                    };

                    await emailService.sendTaskDueDateReminderEmail(task, user);
                    
                    // Add a small delay to avoid overwhelming the email service
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to send due soon email for task ${row.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error checking tasks due soon:', error);
        }
    }

    async sendDailyTaskSummaries() {
        try {
            const query = `
                SELECT 
                    u.id, u.email, u.full_name, u.username,
                    json_agg(
                        json_build_object(
                            'id', t.id,
                            'title', t.title,
                            'description', t.description,
                            'priority', t.priority,
                            'category', t.category,
                            'due_date', t.due_date,
                            'status', t.status,
                            'created_at', t.created_at
                        )
                    ) as tasks
                FROM users u
                JOIN tasks t ON t.assigned_to = u.id
                WHERE u.email IS NOT NULL
                AND u.email != ''
                AND t.status != 'cancelled'
                GROUP BY u.id, u.email, u.full_name, u.username
                HAVING COUNT(t.id) > 0
            `;

            const result = await pool.query(query);
            
            console.log(`📧 Sending daily summaries to ${result.rows.length} users`);

            for (const row of result.rows) {
                try {
                    const user = {
                        id: row.id,
                        email: row.email,
                        full_name: row.full_name,
                        username: row.username
                    };

                    await emailService.sendDailyTaskSummaryEmail(user, row.tasks);
                    
                    // Add a small delay to avoid overwhelming the email service
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Failed to send daily summary to user ${row.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error sending daily task summaries:', error);
        }
    }

    stop() {
        console.log('🛑 Stopping scheduler service...');
        this.jobs.forEach(job => job.destroy());
        this.jobs = [];
        console.log('✅ Scheduler service stopped');
    }

    // Manual trigger methods for testing
    async triggerOverdueCheck() {
        console.log('🔍 Manually triggering overdue check...');
        await this.checkOverdueTasks();
    }

    async triggerDueSoonCheck() {
        console.log('🔍 Manually triggering due soon check...');
        await this.checkTasksDueSoon();
    }

    async triggerDailySummary() {
        console.log('📊 Manually triggering daily summary...');
        await this.sendDailyTaskSummaries();
    }
}

module.exports = new SchedulerService();