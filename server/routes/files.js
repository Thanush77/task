const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { upload, uploadDir } = require('../middleware/uploadMiddleware');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

// Upload files
router.post('/upload', authenticateToken, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { taskId } = req.body;
        const uploadedFiles = [];

        for (const file of req.files) {
            // Save file info to database
            const query = `
                INSERT INTO task_attachments (task_id, filename, original_name, file_path, file_size, mime_type, uploaded_by, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING *
            `;

            const values = [
                taskId || null,
                file.filename,
                file.originalname,
                file.path,
                file.size,
                file.mimetype,
                req.user.id
            ];

            const result = await pool.query(query, values);
            const uploadedFile = {
                id: result.rows[0].id,
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                uploadedAt: result.rows[0].created_at
            };
            
            uploadedFiles.push(uploadedFile);
            
            // Emit real-time update via WebSocket
            const io = req.app.get('io');
            if (io && taskId) {
                io.to(`task-${taskId}`).emit('file-uploaded', { 
                    file: uploadedFile,
                    uploadedBy: {
                        id: req.user.id,
                        username: req.user.username
                    }
                });
            }
        }

        res.json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('File upload error:', error);
        
        // Clean up uploaded files if database insertion fails
        if (req.files) {
            for (const file of req.files) {
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    console.error('Failed to delete file:', unlinkError);
                }
            }
        }
        
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Get file by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        
        if (isNaN(fileId)) {
            return res.status(400).json({ error: 'Invalid file ID' });
        }

        const query = `
            SELECT * FROM task_attachments 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [fileId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = result.rows[0];
        
        // Check if file exists on disk
        try {
            await fs.access(file.file_path);
        } catch (error) {
            return res.status(404).json({ error: 'File not found on disk' });
        }

        res.sendFile(path.resolve(file.file_path));
    } catch (error) {
        console.error('File retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve file' });
    }
});

// Get files for a specific task
router.get('/task/:taskId', authenticateToken, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        
        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }

        const query = `
            SELECT 
                ta.id,
                ta.filename,
                ta.original_name,
                ta.file_size,
                ta.mime_type,
                ta.created_at,
                u.username as uploaded_by_username,
                u.full_name as uploaded_by_name
            FROM task_attachments ta
            JOIN users u ON ta.uploaded_by = u.id
            WHERE ta.task_id = $1
            ORDER BY ta.created_at DESC
        `;
        
        const result = await pool.query(query, [taskId]);
        
        res.json({
            files: result.rows.map(file => ({
                id: file.id,
                filename: file.filename,
                originalName: file.original_name,
                size: file.file_size,
                type: file.mime_type,
                uploadedAt: file.created_at,
                uploadedBy: {
                    username: file.uploaded_by_username,
                    fullName: file.uploaded_by_name
                }
            }))
        });
    } catch (error) {
        console.error('Get task files error:', error);
        res.status(500).json({ error: 'Failed to retrieve task files' });
    }
});

// Delete file
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        
        if (isNaN(fileId)) {
            return res.status(400).json({ error: 'Invalid file ID' });
        }

        const query = `
            SELECT * FROM task_attachments 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [fileId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = result.rows[0];
        
        // Check if user has permission to delete (only uploader or task creator/assignee)
        if (file.uploaded_by !== req.user.id) {
            // Additional check: is user the task creator or assignee?
            const taskQuery = `
                SELECT created_by, assigned_to FROM tasks WHERE id = $1
            `;
            const taskResult = await pool.query(taskQuery, [file.task_id]);
            
            if (taskResult.rows.length === 0 || 
                (taskResult.rows[0].created_by !== req.user.id && 
                 taskResult.rows[0].assigned_to !== req.user.id)) {
                return res.status(403).json({ error: 'Permission denied' });
            }
        }

        // Delete file from database
        const deleteQuery = `
            DELETE FROM task_attachments WHERE id = $1
        `;
        await pool.query(deleteQuery, [fileId]);

        // Delete file from disk
        try {
            await fs.unlink(file.file_path);
        } catch (unlinkError) {
            console.error('Failed to delete file from disk:', unlinkError);
            // Continue even if file deletion fails
        }

        // Emit real-time update via WebSocket
        const io = req.app.get('io');
        if (io && file.task_id) {
            io.to(`task-${file.task_id}`).emit('file-deleted', { 
                fileId: fileId,
                filename: file.original_name 
            });
        }

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('File deletion error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Get all files uploaded by user
router.get('/user/uploads', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                ta.id,
                ta.filename,
                ta.original_name,
                ta.file_size,
                ta.mime_type,
                ta.created_at,
                ta.task_id,
                t.title as task_title
            FROM task_attachments ta
            LEFT JOIN tasks t ON ta.task_id = t.id
            WHERE ta.uploaded_by = $1
            ORDER BY ta.created_at DESC
        `;
        
        const result = await pool.query(query, [req.user.id]);
        
        res.json({
            files: result.rows.map(file => ({
                id: file.id,
                filename: file.filename,
                originalName: file.original_name,
                size: file.file_size,
                type: file.mime_type,
                uploadedAt: file.created_at,
                task: file.task_id ? {
                    id: file.task_id,
                    title: file.task_title
                } : null
            }))
        });
    } catch (error) {
        console.error('Get user uploads error:', error);
        res.status(500).json({ error: 'Failed to retrieve user uploads' });
    }
});

module.exports = router;