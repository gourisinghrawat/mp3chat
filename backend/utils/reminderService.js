const cron = require('node-cron');
const Meeting = require('../../database/models/Meeting');
const { sendMeetingReminder } = require('./emailService');

// Track which meetings we've already sent reminders for
const sentReminders = new Set();

// Function to check for meetings starting in 15 minutes and send reminders
const checkUpcomingMeetings = async () => {
    try {
        const now = new Date();
        const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
        const sixteenMinutesFromNow = new Date(now.getTime() + 16 * 60000);
        
        // Find meetings scheduled between 15-16 minutes from now
        const upcomingMeetings = await Meeting.find({
            scheduledTime: {
                $gte: fifteenMinutesFromNow,
                $lt: sixteenMinutesFromNow
            },
            status: 'scheduled',
            emailReminders: true // Only send if email reminders are enabled
        });
        
        console.log(`[REMINDER] Checking for upcoming meetings... Found: ${upcomingMeetings.length}`);
        
        for (const meeting of upcomingMeetings) {
            // Check if we've already sent a reminder for this meeting
            if (sentReminders.has(meeting.meetingId)) {
                console.log(`[REMINDER] Already sent for meeting: ${meeting.meetingId}`);
                continue;
            }
            
            console.log(`[REMINDER] Sending reminder for meeting: ${meeting.title} (${meeting.meetingId})`);
            
            const meetingLink = `${process.env.APP_URL || 'https://localhost:8181'}/${meeting.meetingId}`;
            const result = await sendMeetingReminder(meeting, meetingLink);
            
            if (result.success) {
                sentReminders.add(meeting.meetingId);
                console.log(`[REMINDER] Sent successfully for meeting: ${meeting.meetingId}`);
            } else {
                console.error(`[REMINDER ERROR] Failed to send reminder for meeting: ${meeting.meetingId}`, result.error);
            }
        }
    } catch (error) {
        console.error('[REMINDER ERROR] Error checking upcoming meetings:', error);
    }
};

// Clean up old entries from sentReminders set (meetings from more than 24 hours ago)
const cleanupSentReminders = () => {
    console.log(`[REMINDER] Cleaning up old reminder entries... Current size: ${sentReminders.size}`);
    // In production, you'd want to store this in database with timestamps
    // For now, we'll just clear it daily
    sentReminders.clear();
    console.log('[REMINDER] Cache cleared');
};

// Initialize the reminder service
const initReminderService = () => {
    console.log('[REMINDER] Initializing Meeting Reminder Service...');
    
    // Check for upcoming meetings every minute
    // Cron format: second minute hour day month weekday
    cron.schedule('* * * * *', () => {
        checkUpcomingMeetings();
    });
    
    console.log('[REMINDER] Service started - checking every minute');
    
    // Clean up sentReminders cache every day at midnight
    cron.schedule('0 0 * * *', () => {
        cleanupSentReminders();
    });
    
    console.log('[REMINDER] Cleanup scheduled - runs daily at midnight');
};

module.exports = {
    initReminderService,
    checkUpcomingMeetings
};
