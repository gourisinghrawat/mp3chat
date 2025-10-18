require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');

const app = express();
const connectDB = require('./database/config/database');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

connectDB();

const meetingRoutes = require('./backend/routes/meetingRoutes');
app.use('/api/meetings', meetingRoutes);

app.get('/:meetingId([A-Z0-9]{8})', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Create HTTP server (for cloud deployment without SSL)
const expressServer = http.createServer(app);

// Configure CORS origins based on environment
const getAllowedOrigins = () => {
    const origins = [];
    
    // Production/Cloud platform domain
    if (process.env.VERCEL_URL) {
        origins.push(`https://${process.env.VERCEL_URL}`);
    }
    
    if (process.env.RENDER_EXTERNAL_URL) {
        origins.push(process.env.RENDER_EXTERNAL_URL);
    }
    
    // Custom domain if provided
    if (process.env.APP_URL) {
        origins.push(process.env.APP_URL);
    }
    
    // Local development
    if (process.env.NODE_ENV !== 'production') {
        origins.push('https://localhost:8181');
        origins.push('http://localhost:8181');
        origins.push('https://localhost:3000');
        origins.push('http://localhost:3000');
    }
    
    console.log('[CORS] Allowed origins:', origins);
    return origins.length > 0 ? origins : '*';
};

const io = socketio(expressServer, {
    cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true
    }
});

const handleSocketEvents = require('./backend/socket/socketEvents');
handleSocketEvents(io);

// Initialize reminder service for email notifications
if (process.env.ENABLE_EMAILS === 'true') {
    const { initReminderService } = require('./backend/utils/reminderService');
    initReminderService();
    console.log('[EMAIL] Reminder service initialized');
} else {
    console.log('[INFO] Email notifications disabled (set ENABLE_EMAILS=true in .env)');
}

const PORT = process.env.PORT || 8181;
expressServer.listen(PORT, () => {
    console.log(`\n[SERVER] Running on http://localhost:${PORT}`);
    console.log(`[FRONTEND] Served from: ./frontend`);
    console.log(`[SOCKET.IO] Ready for connections`);
    console.log(`[ENV] Node Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    expressServer.close(() => {
        console.log('HTTP server closed');
    });
});
