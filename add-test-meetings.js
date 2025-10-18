require('dotenv').config();
const mongoose = require('mongoose');
const Meeting = require('./database/models/Meeting');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

async function addTestMeetings() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);
        
        const hostEmail = 'gourisinghrawat18@gmail.com';
        const hostName = 'Gouri Singh Rawat';
        
        // Get current date/time
        const now = new Date();
        
        // Create 5 test meetings at different times
        const testMeetings = [
            {
                meetingId: 'TEST0001',
                title: 'Team Standup Meeting',
                description: 'Daily team standup to discuss progress and blockers',
                hostName: hostName,
                hostEmail: hostEmail,
                scheduledTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
                duration: 30,
                participants: [
                    { email: 'participant1@example.com', name: 'John Doe', status: 'invited' },
                    { email: 'participant2@example.com', name: 'Jane Smith', status: 'invited' }
                ],
                settings: {
                    waitingRoomEnabled: true,
                    allowParticipantAudio: true,
                    allowParticipantVideo: true,
                    allowParticipantScreenShare: false,
                    recordMeeting: false,
                    emailReminders: true
                },
                status: 'scheduled'
            },
            {
                meetingId: 'TEST0002',
                title: 'Project Planning Session',
                description: 'Planning for Q4 2025 project roadmap',
                hostName: hostName,
                hostEmail: hostEmail,
                scheduledTime: new Date(now.getTime() + 5 * 60 * 60 * 1000), // 5 hours from now
                duration: 60,
                participants: [
                    { email: 'manager@example.com', name: 'Project Manager', status: 'invited' },
                    { email: 'dev1@example.com', name: 'Developer 1', status: 'invited' },
                    { email: 'dev2@example.com', name: 'Developer 2', status: 'invited' }
                ],
                settings: {
                    waitingRoomEnabled: true,
                    allowParticipantAudio: true,
                    allowParticipantVideo: true,
                    allowParticipantScreenShare: true,
                    recordMeeting: true,
                    emailReminders: true
                },
                status: 'scheduled'
            },
            {
                meetingId: 'TEST0003',
                title: 'Client Demo',
                description: 'Demonstrating new features to the client',
                hostName: hostName,
                hostEmail: hostEmail,
                scheduledTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow, same time
                duration: 45,
                participants: [
                    { email: 'client@example.com', name: 'Client Rep', status: 'invited' },
                    { email: 'sales@example.com', name: 'Sales Manager', status: 'invited' }
                ],
                settings: {
                    waitingRoomEnabled: true,
                    allowParticipantAudio: true,
                    allowParticipantVideo: true,
                    allowParticipantScreenShare: true,
                    recordMeeting: true,
                    emailReminders: true
                },
                status: 'scheduled'
            },
            {
                meetingId: 'TEST0004',
                title: 'Code Review Session',
                description: 'Review recent pull requests and discuss best practices',
                hostName: hostName,
                hostEmail: hostEmail,
                scheduledTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 2 days from now
                duration: 90,
                participants: [
                    { email: 'dev1@example.com', name: 'Senior Dev', status: 'invited' },
                    { email: 'dev2@example.com', name: 'Junior Dev', status: 'invited' },
                    { email: 'dev3@example.com', name: 'Mid Dev', status: 'invited' }
                ],
                settings: {
                    waitingRoomEnabled: false,
                    allowParticipantAudio: true,
                    allowParticipantVideo: true,
                    allowParticipantScreenShare: true,
                    recordMeeting: false,
                    emailReminders: true
                },
                status: 'scheduled'
            },
            {
                meetingId: 'TEST0005',
                title: 'Weekly Retrospective',
                description: 'Team retrospective - what went well, what can improve',
                hostName: hostName,
                hostEmail: hostEmail,
                scheduledTime: new Date(now.getTime() + 72 * 60 * 60 * 1000), // 3 days from now
                duration: 60,
                participants: [
                    { email: 'team1@example.com', name: 'Team Member 1', status: 'invited' },
                    { email: 'team2@example.com', name: 'Team Member 2', status: 'invited' },
                    { email: 'team3@example.com', name: 'Team Member 3', status: 'invited' },
                    { email: 'scrum@example.com', name: 'Scrum Master', status: 'invited' }
                ],
                settings: {
                    waitingRoomEnabled: true,
                    allowParticipantAudio: true,
                    allowParticipantVideo: true,
                    allowParticipantScreenShare: false,
                    recordMeeting: false,
                    emailReminders: true
                },
                status: 'scheduled'
            }
        ];
        
        console.log('\n📝 Creating test meetings...\n');
        
        for (const meetingData of testMeetings) {
            // Check if meeting already exists
            const existing = await Meeting.findOne({ meetingId: meetingData.meetingId });
            if (existing) {
                console.log(`⏭️  Skipped (already exists): ${meetingData.meetingId} - ${meetingData.title}`);
                continue;
            }
            
            const meeting = new Meeting(meetingData);
            await meeting.save();
            
            console.log(`✅ Created: ${meeting.meetingId}`);
            console.log(`   Title: ${meeting.title}`);
            console.log(`   Scheduled: ${meeting.scheduledTime.toLocaleString()}`);
            console.log(`   Duration: ${meeting.duration} minutes`);
            console.log(`   Participants: ${meeting.participants.length}`);
            console.log('');
        }
        
        // Show all meetings for this host
        console.log(`\n📋 All scheduled meetings for ${hostEmail}:\n`);
        const allMeetings = await Meeting.find({ 
            hostEmail: hostEmail, 
            status: 'scheduled' 
        }).sort({ scheduledTime: 1 });
        
        console.log(`Found ${allMeetings.length} scheduled meeting(s):\n`);
        
        allMeetings.forEach((meeting, index) => {
            const timeUntil = meeting.scheduledTime - now;
            const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            console.log(`${index + 1}. Meeting ID: ${meeting.meetingId}`);
            console.log(`   Title: ${meeting.title}`);
            console.log(`   Scheduled: ${meeting.scheduledTime.toLocaleString()}`);
            console.log(`   Time until: ${hoursUntil}h ${minutesUntil}m`);
            console.log(`   Participants: ${meeting.participants.length}`);
            console.log(`   Link: https://localhost:8181/${meeting.meetingId}`);
            console.log('');
        });
        
        console.log('✨ Test meetings added successfully!');
        console.log('\n📱 Next steps:');
        console.log('1. Go to https://localhost:8181');
        console.log('2. Click "My Meetings"');
        console.log(`3. Enter email: ${hostEmail}`);
        console.log('4. Click "Load Meetings"');
        console.log('5. You should see all these meetings!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

addTestMeetings();
