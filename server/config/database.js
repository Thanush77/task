const { Pool } = require('pg');

// Debug environment variables (don't log password in production)
console.log('📊 Database Config:');
console.log('- Host:', process.env.DB_HOST);
console.log('- Database:', process.env.DB_NAME);
console.log('- User:', process.env.DB_USER);
console.log('- Port:', process.env.DB_PORT);
console.log('- Password length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'undefined');

// AWS RDS requires SSL connection
const sslConfig = process.env.DB_HOST && process.env.DB_HOST.includes('rds.amazonaws.com') 
    ? {
        rejectUnauthorized: false, // AWS RDS uses self-signed certificates
        ssl: true
      }
    : process.env.NODE_ENV === 'production' 
    ? {
        rejectUnauthorized: false
      }
      
    : false;

const pool = new Pool({
    user: String(process.env.DB_USER || ''),
    host: String(process.env.DB_HOST || ''),
    database: String(process.env.DB_NAME || ''),
    password: String(process.env.DB_PASSWORD || ''),
    port: Number(process.env.DB_PORT) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig
});

// Test database connection
pool.on('connect', () => {
    console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
    process.exit(-1);
});

const initDatabase = async () => {
    try {
        // Test connection
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('📅 Database connection successful:', result.rows[0].now);
        client.release();

        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                avatar_url VARCHAR(255),
                role VARCHAR(20) DEFAULT 'user',
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'critical')),
                category VARCHAR(50) DEFAULT 'general',
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
                estimated_hours DECIMAL(5,2) DEFAULT 1.0 CHECK (estimated_hours > 0),
                actual_hours DECIMAL(5,2) DEFAULT 0 CHECK (actual_hours >= 0),
                start_date TIMESTAMP,
                due_date TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_dates CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
            )
        `);

        // Create task_tags table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_tags (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                tag VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(task_id, tag)
            )
        `);

        // Create time_entries table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS time_entries (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                duration INTEGER CHECK (duration > 0), -- in minutes
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_time_entry CHECK (end_time IS NULL OR end_time > start_time)
            )
        `);

        // Create task_attachments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_attachments (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create audit_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create task_assignments table for tracking assignment history
        await pool.query(`
            CREATE TABLE IF NOT EXISTS task_assignments (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assigned_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_current BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
            CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
            CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
            CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
            CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);
            CREATE INDEX IF NOT EXISTS idx_task_assignments_is_current ON task_assignments(is_current);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        `);

        // Create updated_at trigger function
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Create triggers for updated_at
        await pool.query(`
            DROP TRIGGER IF EXISTS update_users_updated_at ON users;
            CREATE TRIGGER update_users_updated_at 
                BEFORE UPDATE ON users 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
            DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
            CREATE TRIGGER update_tasks_updated_at 
                BEFORE UPDATE ON tasks 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
            DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
            CREATE TRIGGER update_time_entries_updated_at 
                BEFORE UPDATE ON time_entries 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
            DROP TRIGGER IF EXISTS update_task_attachments_updated_at ON task_attachments;
            CREATE TRIGGER update_task_attachments_updated_at 
                BEFORE UPDATE ON task_attachments 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);

        console.log('📋 Database tables and indexes created successfully');
        
        // Run migration to populate existing task assignments
        try {
            await pool.query(`
                INSERT INTO task_assignments (task_id, assigned_to, assigned_by, assigned_at, is_current)
                SELECT 
                    t.id as task_id,
                    t.assigned_to,
                    COALESCE(t.created_by, t.assigned_to) as assigned_by,
                    t.created_at as assigned_at,
                    true as is_current
                FROM tasks t
                WHERE t.assigned_to IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM task_assignments ta 
                    WHERE ta.task_id = t.id 
                    AND ta.assigned_to = t.assigned_to 
                    AND ta.is_current = true
                )
            `);
            console.log('📋 Task assignments populated successfully');
        } catch (error) {
            // This is expected to fail if data already exists, which is fine
            console.log('📋 Task assignments already populated or migration not needed');
        }
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
};

module.exports = { pool, initDatabase };