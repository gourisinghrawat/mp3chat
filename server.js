require('dotenv').config();

const fs = require('fs');
const https = require('https');
const express = require('express');
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

// Create server based on environment
let expressServer;
const http = require('http');

if (process.env.NODE_ENV === 'production') {
    // Production: Use HTTP (Render handles HTTPS)
    expressServer = http.createServer(app);
    console.log('[SERVER] Running in production mode (HTTP - Render provides HTTPS)');
} else {
    // Development: Use HTTPS with local certificates
    const key = fs.readFileSync('cert.key');
    const cert = fs.readFileSync('cert.crt');
    expressServer = https.createServer({ key, cert }, app);
    console.log('[SERVER] Running in development mode (HTTPS with local certs)');
}

const io = socketio(expressServer, {
    cors: {
        origin: process.env.FRONTEND_URL || [
            "https://localhost:8181",
            "https://172.22.240.1:8181"
        ],
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
    console.log(`\n[SERVER] Running on https://localhost:${PORT}`);
    console.log(`[FRONTEND] Served from: ./frontend`);
    console.log(`[SOCKET.IO] Ready for connections\n`);
});