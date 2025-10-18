require('dotenv').config();
const mongoose = require('mongoose');
const Meeting = require('./database/models/Meeting');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

async function testScheduledMeeting() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);
        
        // Create a test scheduled meeting
        console.log('\n📝 Creating test scheduled meeting...');
        const testMeeting = new Meeting({
            meetingId: 'TEST1234',
            title: 'Test Scheduled Meeting',
            description: 'This is a test',
            hostName: 'Test Host',
            hostEmail: 'test@example.com',
            scheduledTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            duration: 60,
            participants: [
                { email: 'participant1@example.com', name: 'Participant 1', status: 'invited' }
            ],
            settings: {
                waitingRoomEnabled: true,
                allowParticipantAudio: true,
                allowParticipantVideo: true,
                emailReminders: true
            },
            status: 'scheduled'
        });
        
        await testMeeting.save();
        console.log('✅ Test meeting saved:', testMeeting.meetingId);
        
        // Retrieve all scheduled meetings
        console.log('\n📋 Retrieving all scheduled meetings...');
        const allMeetings = await Meeting.find({ status: 'scheduled' });
        console.log(`✅ Found ${allMeetings.length} scheduled meeting(s):`);
        
        allMeetings.forEach((meeting, index) => {
            console.log(`\n${index + 1}. Meeting ID: ${meeting.meetingId}`);
            console.log(`   Title: ${meeting.title}`);
            console.log(`   Host: ${meeting.hostName} (${meeting.hostEmail})`);
            console.log(`   Scheduled: ${meeting.scheduledTime}`);
            console.log(`   Status: ${meeting.status}`);
            console.log(`   Participants: ${meeting.participants?.length || 0}`);
        });
        
        // Clean up test meeting
        console.log('\n🧹 Cleaning up test meeting...');
        await Meeting.deleteOne({ meetingId: 'TEST1234' });
        console.log('✅ Test meeting deleted');
        
        console.log('\n✨ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

testScheduledMeeting();
