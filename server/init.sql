-- This file is used by Docker to initialize the database
-- It's automatically executed when the PostgreSQL container starts for the first time

-- Create additional extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create additional indexes for text search (optional)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_title_gin ON tasks USING gin(to_tsvector('english', title));
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_description_gin ON tasks USING gin(to_tsvector('english', description));

-- Insert some sample data (optional, for development)
-- INSERT INTO users (username, email, password_hash, full_name, role) VALUES 
-- ('admin', 'admin@taskflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMYWdRhUz6kWq5m', 'Administrator', 'admin'),
-- ('john_doe', 'john@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMYWdRhUz6kWq5m', 'John Doe', 'user'),
-- ('jane_smith', 'jane@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVMYWdRhUz6kWq5m', 'Jane Smith', 'user');

-- Password for all sample users is: 'password123'