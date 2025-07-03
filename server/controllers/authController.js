const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validateEmail, validatePassword, sanitizeInput } = require('../utils/helpers');

class AuthController {
    static async register(req, res) {
        try {
            const { username, email, password, fullName } = req.body;

            // Input validation
            if (!username || !email || !password || !fullName) {
                return res.status(400).json({ 
                    error: 'All fields are required',
                    required: ['username', 'email', 'password', 'fullName']
                });
            }

            // Validate email format
            if (!validateEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Validate password strength
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                return res.status(400).json({ 
                    error: 'Password does not meet requirements',
                    requirements: passwordValidation.requirements
                });
            }

            // Sanitize inputs
            const sanitizedData = {
                username: sanitizeInput(username),
                email: sanitizeInput(email.toLowerCase()),
                password,
                fullName: sanitizeInput(fullName)
            };

            // Check if user already exists
            const existingUser = await User.findByUsername(sanitizedData.username);
            if (existingUser) {
                return res.status(400).json({ error: 'Username or email already exists' });
            }

            const existingEmail = await User.findByEmail(sanitizedData.email);
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            // Create user
            const user = await User.create(sanitizedData);

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Update last login
            await user.updateLastLogin();

            res.status(201).json({
                message: 'User registered successfully',
                token,
                user: user.toJSON()
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ 
                error: error.message.includes('already exists') ? error.message : 'Registration failed'
            });
        }
    }

    static async login(req, res) {
        try {
            const { username, password } = req.body;

            // Input validation
            if (!username || !password) {
                return res.status(400).json({ 
                    error: 'Username and password are required' 
                });
            }

            // Find user
            const user = await User.findByUsername(sanitizeInput(username));
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if account is active
            if (!user.isActive) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            // Verify password
            const isValidPassword = await user.verifyPassword(password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Update last login
            await user.updateLastLogin();

            res.json({
                message: 'Login successful',
                token,
                user: user.toJSON()
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }

    static async refreshToken(req, res) {
        try {
            const { user } = req; // From auth middleware

            // Generate new token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                message: 'Token refreshed successfully',
                token
            });
        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({ error: 'Token refresh failed' });
        }
    }

    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                user: user.toJSON()
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }

    static async updateProfile(req, res) {
        try {
            const { fullName, email } = req.body;
            const user = await User.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updateData = {};
            
            if (fullName) {
                updateData.fullName = sanitizeInput(fullName);
            }
            
            if (email) {
                if (!validateEmail(email)) {
                    return res.status(400).json({ error: 'Invalid email format' });
                }
                updateData.email = sanitizeInput(email.toLowerCase());
            }

            const updatedUser = await user.update(updateData);

            res.json({
                message: 'Profile updated successfully',
                user: updatedUser.toJSON()
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }

    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ 
                    error: 'Current password and new password are required' 
                });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Verify current password
            const isValidPassword = await user.verifyPassword(currentPassword);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            // Validate new password
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return res.status(400).json({ 
                    error: 'New password does not meet requirements',
                    requirements: passwordValidation.requirements
                });
            }

            // Change password
            await user.changePassword(newPassword);

            res.json({
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Failed to change password' });
        }
    }
}

module.exports = AuthController;