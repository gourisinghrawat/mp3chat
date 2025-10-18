require('dotenv').config();
const connectDB = require('./config/database');
const Meeting = require('./models/Meeting');

async function testDatabase() {
    console.log(' Starting database test...\n');
    
    try {
        // Connect to database
        await connectDB();
        console.log('');
        
        // Create a test meeting
        console.log(' Creating test meeting...');
        const testMeeting = new Meeting({
            meetingId: 'TEST' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            title: 'Test Meeting - Database Verification',
            description: 'This is a test meeting to verify MongoDB connection',
            hostName: 'Test User',
            hostEmail: 'test@example.com',
            scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            duration: 60,
            participants: [
                { email: 'participant1@example.com', name: 'Participant One', status: 'invited' },
                { email: 'participant2@example.com', name: 'Participant Two', status: 'invited' }
            ]
        });
        
        await testMeeting.save();
        console.log(' Test meeting created successfully!');
        console.log('   Meeting ID:', testMeeting.meetingId);
        console.log('   Title:', testMeeting.title);
        console.log('   Scheduled:', testMeeting.scheduledTime.toLocaleString());
        console.log('');
        
        // Fetch the meeting back
        console.log(' Fetching the meeting from database...');
        const found = await Meeting.findOne({ meetingId: testMeeting.meetingId });
        if (found) {
            console.log(' Meeting found successfully!');
            console.log('   Host:', found.hostName);
            console.log('   Participants:', found.participants.length);
            console.log('');
        }
        
        // Update the meeting
        console.log(' Updating meeting status...');
        found.status = 'ongoing';
        found.actualStartTime = new Date();
        await found.save();
        console.log('Meeting updated successfully!');
        console.log(' Status:', found.status);
        console.log('');
        
        // Get all scheduled meetings
        console.log('Fetching all scheduled meetings...');
        const allMeetings = await Meeting.find({ status: { $in: ['scheduled', 'ongoing'] } });
        console.log('Found', allMeetings.length, 'scheduled/ongoing meeting(s)');
        console.log('');
        
        // Delete the test meeting
        console.log(' Cleaning up test data...');
        await Meeting.deleteOne({ meetingId: testMeeting.meetingId });
        console.log(' Test meeting deleted');
        console.log('');
        
        console.log(' All tests passed! Your MongoDB setup is working correctly!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Start your server: node server.js');
        console.log('2. Test API endpoints');
        console.log('3. Build frontend for scheduling meetings');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('');
        console.log('Troubleshooting tips:');
        console.log('- Check if .env file exists with correct MONGODB_URI');
        console.log('- Verify your connection string has correct username/password');
        console.log('- Make sure your IP is whitelisted in MongoDB Atlas');
        console.log('- Check internet connection');
        console.log('');
        process.exit(1);
    }
}

console.log('╔════════════════════════════════════════════════╗');
console.log('║   MongoDB Database Connection Test            ║');
console.log('╚════════════════════════════════════════════════╝');
console.log('');

testDatabase();
