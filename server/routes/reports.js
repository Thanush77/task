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

// Advanced analytics routes
router.get('/team-performance', ReportsController.getTeamPerformance);
router.get('/workload-distribution', ReportsController.getWorkloadDistribution);
router.get('/time-analytics', ReportsController.getTimeAnalytics);
router.get('/comprehensive', ReportsController.getComprehensiveReport);

// New advanced analytics endpoints
router.get('/predictive-analytics', ReportsController.getPredictiveAnalytics);
router.get('/real-time-dashboard', ReportsController.getRealTimeDashboard);

module.exports = router; 