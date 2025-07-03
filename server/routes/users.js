const express = require('express');
const UserController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// User routes
router.get('/', UserController.getAllUsers);
router.get('/dashboard/stats', UserController.getDashboardStats);
router.get('/:id', UserController.getUserById);
router.get('/:id/tasks', UserController.getUserTasks);
router.put('/:id', UserController.updateUser);

module.exports = router;