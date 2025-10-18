const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');

// Schedule a new meeting
router.post('/schedule', meetingController.scheduleMeeting);

// Get scheduled meetings for a user
router.get('/user/:email', meetingController.getUserMeetings);

// Get all scheduled meetings
router.get('/all', meetingController.getAllMeetings);

// Get meeting details by ID
router.get('/:meetingId', meetingController.getMeetingById);

// Update meeting
router.put('/:meetingId', meetingController.updateMeeting);

// Cancel meeting
router.delete('/:meetingId', meetingController.cancelMeeting);

// Start meeting
router.patch('/:meetingId/start', meetingController.startMeeting);

// End meeting
router.patch('/:meetingId/end', meetingController.endMeeting);

// Get meeting history
router.get('/:meetingId/history', meetingController.getMeetingHistory);

// Save meeting history
router.post('/:meetingId/history', meetingController.saveMeetingHistory);

module.exports = router;
