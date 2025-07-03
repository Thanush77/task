const express = require('express');
const ReportsController = require('../controllers/reportsController');
const router = express.Router();

router.get('/task-stats', ReportsController.taskStats);
router.get('/user-productivity', ReportsController.userProductivity);
router.get('/time-tracking', ReportsController.timeTracking);
router.get('/export', ReportsController.exportReport);

module.exports = router; 