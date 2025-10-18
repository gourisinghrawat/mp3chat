const mongoose = require('mongoose');

const meetingHistorySchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true,
        index: true
    },
    participants: [{
        userName: String,
        displayName: String,
        joinedAt: Date,
        leftAt: Date,
        duration: Number // in seconds
    }],
    chat: [{
        sender: String,
        message: String,
        timestamp: Date
    }],
    events: [{
        type: {
            type: String,
            enum: ['joined', 'left', 'muted', 'unmuted', 'videoOn', 'videoOff', 'screenShareStarted', 'screenShareStopped', 'handRaised', 'handLowered', 'madeCoHost', 'removed']
        },
        userName: String,
        displayName: String,
        timestamp: Date,
        details: mongoose.Schema.Types.Mixed
    }],
    recording: {
        isRecorded: {
            type: Boolean,
            default: false
        },
        recordingUrl: String,
        recordingSize: Number // in bytes
    },
    statistics: {
        totalParticipants: Number,
        maxConcurrentParticipants: Number,
        totalDuration: Number, // in seconds
        totalMessages: Number
    }
}, {
    timestamps: true
});

meetingHistorySchema.index({ meetingId: 1, createdAt: -1 });

module.exports = mongoose.model('MeetingHistory', meetingHistorySchema);
