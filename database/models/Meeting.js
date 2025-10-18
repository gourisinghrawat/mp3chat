const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    hostName: {
        type: String,
        required: true
    },
    hostEmail: {
        type: String,
        required: true
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number, // in minutes
        default: 60
    },
    password: {
        type: String,
        default: null
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrence: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly'
        },
        interval: {
            type: Number,
            default: 1
        },
        endDate: Date
    },
    participants: [{
        email: String,
        name: String,
        status: {
            type: String,
            enum: ['invited', 'accepted', 'declined'],
            default: 'invited'
        }
    }],
    settings: {
        waitingRoomEnabled: {
            type: Boolean,
            default: true
        },
        allowParticipantAudio: {
            type: Boolean,
            default: true
        },
        allowParticipantVideo: {
            type: Boolean,
            default: true
        },
        allowParticipantScreenShare: {
            type: Boolean,
            default: false
        },
        recordMeeting: {
            type: Boolean,
            default: false
        },
        emailReminders: {
            type: Boolean,
            default: true
        }
    },
    status: {
        type: String,
        enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    actualStartTime: Date,
    actualEndTime: Date
}, {
    timestamps: true // adds createdAt and updatedAt
});

// Index for faster queries
meetingSchema.index({ scheduledTime: 1, status: 1 });
meetingSchema.index({ hostEmail: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
