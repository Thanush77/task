const { pool } = require('../config/database');

// Global test setup
beforeAll(async () => {
    // Database setup for tests
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = 'taskflow_test';
    
    console.log('Setting up test environment...');
});

afterAll(async () => {
    // Clean up after all tests
    await pool.end();
    console.log('Test environment cleaned up.');
});

// Clean database before each test
beforeEach(async () => {
    if (process.env.NODE_ENV === 'test') {
        // Clean up test data
        await pool.query('TRUNCATE users, tasks, task_tags, time_entries RESTART IDENTITY CASCADE');
    }
});
