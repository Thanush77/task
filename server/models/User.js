const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.email = data.email;
        this.fullName = data.full_name;
        this.avatarUrl = data.avatar_url;
        this.role = data.role;
        this.isActive = data.is_active;
        this.lastLogin = data.last_login;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    static async findById(id) {
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE id = $1',
                [id]
            );
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Error finding user by ID: ${error.message}`);
        }
    }

    static async findByUsername(username) {
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE username = $1 OR email = $1',
                [username]
            );
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Error finding user by username: ${error.message}`);
        }
    }

    static async findByEmail(email) {
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            return result.rows.length > 0 ? new User(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Error finding user by email: ${error.message}`);
        }
    }

    static async create(userData) {
        try {
            const { username, email, password, fullName, role = 'user' } = userData;
            
            // Hash password
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            const result = await pool.query(
                `INSERT INTO users (username, email, password_hash, full_name, role) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING *`,
                [username, email, passwordHash, fullName, role]
            );

            return new User(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Username or email already exists');
            }
            throw new Error(`Error creating user: ${error.message}`);
        }
    }

    static async findAll(options = {}) {
        try {
            const { limit, offset, isActive } = options;
            
            let query = 'SELECT id, username, email, full_name, avatar_url, role, is_active, created_at FROM users';
            const params = [];
            
            if (isActive !== undefined) {
                query += ' WHERE is_active = $1';
                params.push(isActive);
            }
            
            query += ' ORDER BY full_name';
            
            if (limit) {
                query += ` LIMIT ${limit}`;
            }
            
            if (offset) {
                query += ` OFFSET ${offset}`;
            }

            const result = await pool.query(query, params);
            return result.rows.map(row => new User(row));
        } catch (error) {
            throw new Error(`Error finding users: ${error.message}`);
        }
    }

    async update(updateData) {
        try {
            const allowedFields = ['username', 'email', 'full_name', 'avatar_url', 'role', 'is_active'];
            const updates = [];
            const values = [];
            let paramCount = 1;

            for (const [key, value] of Object.entries(updateData)) {
                const dbField = key === 'fullName' ? 'full_name' : 
                               key === 'avatarUrl' ? 'avatar_url' :
                               key === 'isActive' ? 'is_active' : key;
                
                if (allowedFields.includes(dbField)) {
                    updates.push(`${dbField} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            }

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(this.id);
            const query = `
                UPDATE users 
                SET ${updates.join(', ')} 
                WHERE id = $${paramCount} 
                RETURNING *
            `;

            const result = await pool.query(query, values);
            
            if (result.rows.length > 0) {
                Object.assign(this, result.rows[0]);
                return this;
            }
            
            throw new Error('User not found');
        } catch (error) {
            throw new Error(`Error updating user: ${error.message}`);
        }
    }

    async updateLastLogin() {
        try {
            await pool.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [this.id]
            );
            this.lastLogin = new Date();
        } catch (error) {
            throw new Error(`Error updating last login: ${error.message}`);
        }
    }

    async verifyPassword(password) {
        try {
            const result = await pool.query(
                'SELECT password_hash FROM users WHERE id = $1',
                [this.id]
            );
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            return bcrypt.compare(password, result.rows[0].password_hash);
        } catch (error) {
            throw new Error(`Error verifying password: ${error.message}`);
        }
    }

    async changePassword(newPassword) {
        try {
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(newPassword, saltRounds);
            
            await pool.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [passwordHash, this.id]
            );
        } catch (error) {
            throw new Error(`Error changing password: ${error.message}`);
        }
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            fullName: this.fullName,
            avatarUrl: this.avatarUrl,
            role: this.role,
            isActive: this.isActive,
            lastLogin: this.lastLogin,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = User;