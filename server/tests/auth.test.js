const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
        test('should register a new user', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!',
                fullName: 'Test User'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.username).toBe(userData.username);
            expect(response.body.user.email).toBe(userData.email);
        });

        test('should return error for duplicate username', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!',
                fullName: 'Test User'
            };

            // Register first user
            await request(app)
                .post('/api/auth/register')
                .send(userData);

            // Try to register with same username
            const response = await request(app)
                .post('/api/auth/register')
                .send({ ...userData, email: 'different@example.com' })
                .expect(400);

            expect(response.body.error).toContain('already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        test('should login with valid credentials', async () => {
            // First register a user
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Password123!',
                fullName: 'Test User'
            };

            await request(app)
                .post('/api/auth/register')
                .send(userData);

            // Then login
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: userData.username,
                    password: userData.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
        });

        test('should return error for invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body.error).toBe('Invalid credentials');
        });
    });
});