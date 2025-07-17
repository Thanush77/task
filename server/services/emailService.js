const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    async sendEmail(options) {
        const mailOptions = {
            from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            throw error;
        }
    }

    async sendTaskAssignmentEmail(task, assignedUser, assignedByUser) {
        const subject = `New Task Assigned: ${task.title}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">📋 New Task Assigned</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                    <h2 style="color: #333; margin-top: 0;">Hello ${assignedUser.full_name || assignedUser.username},</h2>
                    
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        You have been assigned a new task by <strong>${assignedByUser.full_name || assignedByUser.username}</strong>.
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                        <h3 style="color: #333; margin-top: 0; font-size: 18px;">${task.title}</h3>
                        ${task.description ? `<p style="color: #666; margin: 10px 0;">${task.description}</p>` : ''}
                        
                        <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Priority:</strong> 
                                <span style="background: ${this.getPriorityColor(task.priority)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                                    ${task.priority}
                                </span>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Category:</strong> 
                                <span style="background: #e9ecef; color: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                    ${task.category}
                                </span>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap;">
                            ${task.due_date ? `
                                <div style="flex: 1; min-width: 200px;">
                                    <strong style="color: #333;">Due Date:</strong> 
                                    <span style="color: #dc3545;">${new Date(task.due_date).toLocaleDateString()}</span>
                                </div>
                            ` : ''}
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Estimated Time:</strong> 
                                <span style="color: #666;">${task.estimated_hours || 1} hours</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" 
                           style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            View Task in TaskFlow
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 14px;">
                        <p>This is an automated notification from TaskFlow. Please don't reply to this email.</p>
                        <p>If you have any questions, please contact your team administrator.</p>
                    </div>
                </div>
            </div>
        `;

        return this.sendEmail({
            to: assignedUser.email,
            subject,
            html
        });
    }

    async sendTaskDueDateReminderEmail(task, user) {
        const dueDate = new Date(task.due_date);
        const now = new Date();
        const isOverdue = dueDate < now;
        const timeDiff = Math.abs(dueDate - now);
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        const subject = isOverdue 
            ? `⚠️ Overdue Task: ${task.title}`
            : `📅 Task Due Soon: ${task.title}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: ${isOverdue ? '#dc3545' : '#ffc107'}; color: white; padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">
                        ${isOverdue ? '⚠️ Task Overdue' : '📅 Task Due Soon'}
                    </h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                    <h2 style="color: #333; margin-top: 0;">Hello ${user.full_name || user.username},</h2>
                    
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        ${isOverdue 
                            ? `Your task is <strong>overdue by ${daysDiff} day${daysDiff > 1 ? 's' : ''}</strong>. Please complete it as soon as possible.`
                            : `Your task is due in <strong>${daysDiff} day${daysDiff > 1 ? 's' : ''}</strong>. Please make sure to complete it on time.`
                        }
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isOverdue ? '#dc3545' : '#ffc107'};">
                        <h3 style="color: #333; margin-top: 0; font-size: 18px;">${task.title}</h3>
                        ${task.description ? `<p style="color: #666; margin: 10px 0;">${task.description}</p>` : ''}
                        
                        <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Due Date:</strong> 
                                <span style="color: ${isOverdue ? '#dc3545' : '#ffc107'}; font-weight: bold;">
                                    ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString()}
                                </span>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Priority:</strong> 
                                <span style="background: ${this.getPriorityColor(task.priority)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                                    ${task.priority}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" 
                           style="background: ${isOverdue ? '#dc3545' : '#ffc107'}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            ${isOverdue ? 'Complete Task Now' : 'View Task'}
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 14px;">
                        <p>This is an automated reminder from TaskFlow. Please don't reply to this email.</p>
                        <p>To stop receiving these reminders, please complete the task or contact your administrator.</p>
                    </div>
                </div>
            </div>
        `;

        return this.sendEmail({
            to: user.email,
            subject,
            html
        });
    }

    async sendTaskCompletionEmail(task, completedByUser, taskCreator) {
        const subject = `✅ Task Completed: ${task.title}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #28a745; color: white; padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">✅ Task Completed</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                    <h2 style="color: #333; margin-top: 0;">Hello ${taskCreator.full_name || taskCreator.username},</h2>
                    
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        Great news! The task you assigned has been completed by <strong>${completedByUser.full_name || completedByUser.username}</strong>.
                    </p>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #333; margin-top: 0; font-size: 18px;">${task.title}</h3>
                        ${task.description ? `<p style="color: #666; margin: 10px 0;">${task.description}</p>` : ''}
                        
                        <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Completed By:</strong> 
                                <span style="color: #28a745; font-weight: bold;">${completedByUser.full_name || completedByUser.username}</span>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <strong style="color: #333;">Completed At:</strong> 
                                <span style="color: #666;">${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" 
                           style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            View in TaskFlow
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 14px;">
                        <p>This is an automated notification from TaskFlow. Please don't reply to this email.</p>
                    </div>
                </div>
            </div>
        `;

        return this.sendEmail({
            to: taskCreator.email,
            subject,
            html
        });
    }

    async sendDailyTaskSummaryEmail(user, tasks) {
        const overdueTasks = tasks.filter(task => {
            const dueDate = new Date(task.due_date);
            return dueDate < new Date() && task.status !== 'completed';
        });

        const dueTodayTasks = tasks.filter(task => {
            const dueDate = new Date(task.due_date);
            const today = new Date();
            return dueDate.toDateString() === today.toDateString() && task.status !== 'completed';
        });

        const subject = `📊 Daily Task Summary - ${overdueTasks.length} overdue, ${dueTodayTasks.length} due today`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">📊 Daily Task Summary</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString()}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                    <h2 style="color: #333; margin-top: 0;">Hello ${user.full_name || user.username},</h2>
                    
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        Here's your daily task summary for today:
                    </p>
                    
                    <!-- Overdue Tasks -->
                    ${overdueTasks.length > 0 ? `
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <h3 style="color: #dc3545; margin-top: 0; font-size: 18px;">⚠️ Overdue Tasks (${overdueTasks.length})</h3>
                            ${overdueTasks.map(task => `
                                <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                                    <strong style="color: #333;">${task.title}</strong>
                                    <div style="color: #666; font-size: 14px;">Due: ${new Date(task.due_date).toLocaleDateString()}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <!-- Due Today Tasks -->
                    ${dueTodayTasks.length > 0 ? `
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <h3 style="color: #ffc107; margin-top: 0; font-size: 18px;">📅 Due Today (${dueTodayTasks.length})</h3>
                            ${dueTodayTasks.map(task => `
                                <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                                    <strong style="color: #333;">${task.title}</strong>
                                    <div style="color: #666; font-size: 14px;">Priority: ${task.priority}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <!-- Summary Stats -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0;">
                        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef;">
                            <div style="font-size: 24px; font-weight: bold; color: #333;">${tasks.length}</div>
                            <div style="color: #666; font-size: 14px;">Total Tasks</div>
                        </div>
                        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef;">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${tasks.filter(t => t.status === 'completed').length}</div>
                            <div style="color: #666; font-size: 14px;">Completed</div>
                        </div>
                        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef;">
                            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${overdueTasks.length}</div>
                            <div style="color: #666; font-size: 14px;">Overdue</div>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" 
                           style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            View All Tasks
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 14px;">
                        <p>This is an automated daily summary from TaskFlow. You can adjust your email preferences in your profile settings.</p>
                    </div>
                </div>
            </div>
        `;

        return this.sendEmail({
            to: user.email,
            subject,
            html
        });
    }

    getPriorityColor(priority) {
        switch (priority) {
            case 'critical': return '#9c27b0';
            case 'high': return '#dc3545';
            case 'medium': return '#ffc107';
            case 'low': return '#28a745';
            case 'lowest': return '#17a2b8';
            default: return '#6c757d';
        }
    }

    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('✅ Email service is ready');
            return true;
        } catch (error) {
            console.error('❌ Email service failed:', error);
            return false;
        }
    }
}

module.exports = new EmailService();