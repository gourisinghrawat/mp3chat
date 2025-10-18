const mongoose = require('mongoose');

// MongoDB connection URL
// For MongoDB Atlas: Use the connection string from Atlas
// For local MongoDB: 'mongodb://localhost:27017/video-call-db'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/video-call-db';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('[DATABASE] MongoDB connected successfully');
        console.log('[DATABASE] Database:', mongoose.connection.name);
    } catch (error) {
        console.error('[DATABASE ERROR] MongoDB connection error:', error.message);
        console.log('[DATABASE INFO] Tip: Make sure your connection string is correct in .env file');
        process.exit(1); // Exit process with failure
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('[DATABASE] Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('[DATABASE ERROR] Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('📴 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
});

module.exports = connectDB;
