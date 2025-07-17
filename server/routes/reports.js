const express = require('express');
const ReportsController = require('../controllers/reportsController');
const router = express.Router();

// Existing routes
router.get('/task-stats', ReportsController.taskStats);
router.get('/user-productivity', ReportsController.userProductivity);
router.get('/time-tracking', ReportsController.timeTracking);
router.get('/export', ReportsController.exportReport);

// Enhanced analytics routes
router.get('/overview-stats', ReportsController.getOverviewStats);
router.get('/priority-stats', ReportsController.getPriorityStats);
router.get('/category-stats', ReportsController.getCategoryStats);
router.get('/overdue-tasks', ReportsController.getOverdueTasks);
router.get('/completion-trend', ReportsController.getCompletionTrend);

module.exports = router; 