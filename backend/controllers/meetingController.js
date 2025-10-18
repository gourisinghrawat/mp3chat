const Meeting = require('../../database/models/Meeting');
const MeetingHistory = require('../../database/models/MeetingHistory');
const { generateMeetingId } = require('../utils/helpers');
const { sendScheduleConfirmation, sendParticipantInvitations, sendCancellationNotification } = require('../utils/emailService');

// Schedule a new meeting
exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, description, hostName, hostEmail, scheduledTime, duration, participants, settings } = req.body;
        
        const meetingId = generateMeetingId();
        
        const meeting = new Meeting({
            meetingId,
            title,
            description,
            hostName,
            hostEmail,
            scheduledTime,
            duration: duration || 60,
            participants: participants || [],
            settings: settings || {}
        });
        
        await meeting.save();
        console.log(`[MEETING] Scheduled: ${meetingId} by ${hostName}`);
        
        // Send email notifications if enabled
        const meetingLink = `${process.env.APP_URL || 'https://localhost:8181'}/${meetingId}`;
        
        if (process.env.ENABLE_EMAILS === 'true') {
            console.log('[EMAIL] Sending notifications...');
            
            // Send confirmation email to host
            sendScheduleConfirmation(meeting, meetingLink)
                .then(result => {
                    if (result.success) {
                        console.log(`[EMAIL] Confirmation sent to host: ${hostEmail}`);
                    }
                })
                .catch(err => console.error('[EMAIL ERROR] Failed to send confirmation:', err));
            
            // Send invitations to participants
            if (participants && participants.length > 0) {
                sendParticipantInvitations(meeting, meetingLink)
                    .then(result => {
                        if (result.success) {
                            console.log(`[EMAIL] Invitations sent to ${result.sent} participants`);
                        }
                    })
                    .catch(err => console.error('[EMAIL ERROR] Failed to send invitations:', err));
            }
        } else {
            console.log('[INFO] Email notifications disabled (set ENABLE_EMAILS=true in .env)');
        }
        
        res.json({
            success: true,
            meeting: {
                meetingId: meeting.meetingId,
                title: meeting.title,
                scheduledTime: meeting.scheduledTime,
                duration: meeting.duration
            }
        });
    } catch (error) {
        console.error('Error scheduling meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get scheduled meetings for a user
exports.getUserMeetings = async (req, res) => {
    try {
        const { email } = req.params;
        const meetings = await Meeting.find({
            $or: [
                { hostEmail: email },
                { 'participants.email': email }
            ],
            status: { $in: ['scheduled', 'ongoing'] },
            scheduledTime: { $gte: new Date() }
        }).sort({ scheduledTime: 1 });
        
        res.json({ success: true, meetings });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all scheduled meetings
exports.getAllMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find({
            status: 'scheduled',
            scheduledTime: { $gte: new Date() }
        }).sort({ scheduledTime: 1 }).limit(50);
        
        res.json({ success: true, meetings });
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get meeting details by ID
exports.getMeetingById = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOne({ meetingId });
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        res.json({ success: true, meeting });
    } catch (error) {
        console.error('Error fetching meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update meeting
exports.updateMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const updates = req.body;
        
        const meeting = await Meeting.findOneAndUpdate(
            { meetingId },
            updates,
            { new: true, runValidators: true }
        );
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        res.json({ success: true, meeting });
    } catch (error) {
        console.error('Error updating meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Cancel meeting
exports.cancelMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOneAndUpdate(
            { meetingId },
            { status: 'cancelled' },
            { new: true }
        );
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        // Send cancellation emails if enabled
        if (process.env.ENABLE_EMAILS === 'true') {
            console.log('[EMAIL] Sending cancellation notifications...');
            const meetingLink = `${process.env.APP_URL || 'https://localhost:8181'}/${meetingId}`;
            
            sendCancellationNotification(meeting, meetingLink)
                .then(result => {
                    if (result.success) {
                        console.log(`[EMAIL] Cancellation emails sent to ${result.recipients} recipient(s)`);
                    }
                })
                .catch(err => console.error('[EMAIL ERROR] Failed to send cancellation emails:', err));
        }
        
        res.json({ success: true, message: 'Meeting cancelled', meeting });
    } catch (error) {
        console.error('Error cancelling meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Start meeting (update status to ongoing)
exports.startMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOneAndUpdate(
            { meetingId },
            { 
                status: 'ongoing',
                actualStartTime: new Date()
            },
            { new: true }
        );
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        console.log(`▶️ Meeting started: ${meetingId}`);
        res.json({ success: true, meeting });
    } catch (error) {
        console.error('Error starting meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// End meeting (update status to completed)
exports.endMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const meeting = await Meeting.findOneAndUpdate(
            { meetingId },
            { 
                status: 'completed',
                actualEndTime: new Date()
            },
            { new: true }
        );
        
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }
        
        console.log(`⏹️ Meeting ended: ${meetingId}`);
        res.json({ success: true, meeting });
    } catch (error) {
        console.error('Error ending meeting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get meeting history
exports.getMeetingHistory = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const history = await MeetingHistory.findOne({ meetingId });
        
        if (!history) {
            return res.status(404).json({ success: false, error: 'Meeting history not found' });
        }
        
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error fetching meeting history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Save meeting history
exports.saveMeetingHistory = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const historyData = req.body;
        
        const history = new MeetingHistory({
            meetingId,
            ...historyData
        });
        
        await history.save();
        console.log(`[HISTORY] Meeting history saved: ${meetingId}`);
        
        res.json({ success: true, history });
    } catch (error) {
        console.error('Error saving meeting history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
