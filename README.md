# Video Call Meeting Platform

A comprehensive WebRTC-based video conferencing application with real-time communication, meeting scheduling, and advanced collaboration features.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v14+-green.svg)
![Socket.io](https://img.shields.io/badge/socket.io-v4.6.2-orange.svg)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Features

### Real-Time Video Conferencing
- **Peer-to-Peer Video/Audio Calls**: WebRTC-based video and audio streaming with multiple participants
- **Screen Sharing**: Share your screen with all meeting participants
- **Media Controls**: Toggle camera and microphone on/off in real-time
- **Dynamic Video Grid**: Responsive layout that adapts to the number of participants
- **Media State Synchronization**: Real-time updates when participants toggle their audio/video

### Meeting Management
- **Instant Meetings**: Create and join meetings instantly with auto-generated meeting IDs
- **Schedule Meetings**: Plan meetings in advance with date, time, and duration
- **Meeting Dashboard**: View all your scheduled and ongoing meetings
- **Meeting History**: Track completed meetings with detailed logs
- **Meeting Status Tracking**: Monitor meetings through scheduled, ongoing, completed, and cancelled states

### Participant Management
- **Waiting Room**: Optional waiting room for enhanced security
- **Admit/Deny Controls**: Host can admit or deny participants from waiting room
- **Co-Host Assignment**: Promote participants to co-host with elevated permissions
- **Remove Participants**: Hosts and co-hosts can remove disruptive participants
- **Participant List**: View all active participants with their status
- **Real-time Participant Updates**: See when users join, leave, or change their media state

### Access Control & Permissions
- **Role-Based Access**: Admin, Co-Host, and Participant roles with different privileges
- **Granular Permissions**: Control individual participant abilities (audio, video, screen share)
- **Default Permission Settings**: Set default permissions for new participants
- **Bulk Permission Management**: Apply permissions to all participants at once
- **Admin Transfer**: Automatic admin transfer when the host leaves

### Communication Features
- **Real-Time Chat**: Text messaging with all participants during the meeting
- **Raise Hand**: Participants can raise/lower their hand to get attention
- **Chat Notifications**: Visual badges for unread messages
- **Message History**: Full chat history preserved during the meeting session

### Email & Notifications
- **Meeting Invitations**: Automated email invites with calendar attachments (.ics files)
- **Schedule Confirmations**: Host receives confirmation emails with meeting details
- **Meeting Reminders**: Automatic email reminders 15 minutes before meeting start
- **Cancellation Notifications**: Email alerts when meetings are cancelled
- **Calendar Integration**: iCal format for Google Calendar, Outlook, and other calendar apps

### Meeting Settings
- **Waiting Room Toggle**: Enable/disable waiting room during active meetings
- **Default Permissions Configuration**: Set audio, video, and screen share defaults
- **Meeting Duration**: Configurable meeting duration (default 60 minutes)
- **Email Reminder Settings**: Toggle automated reminder emails
- **Recording Settings**: Meeting recording configuration (future feature)

### User Interface
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Bootstrap 5**: Modern, clean UI with Bootstrap components
- **Bootstrap Icons**: Rich icon set for better visual communication
- **Dark Mode Support**: Eye-friendly interface for different lighting conditions
- **Meeting Link Sharing**: Easy copy-to-clipboard meeting link sharing

### Real-Time Updates
- **Socket.io Integration**: WebSocket-based real-time bidirectional communication
- **Live Participant Count**: Real-time participant counter
- **Waiting Room Counter**: Live count of users waiting to join
- **Connection Status**: Visual indicators for connection quality
- **Automatic Reconnection**: Handles network interruptions gracefully

### Database & Persistence
- **MongoDB Integration**: Persistent storage for meetings and history
- **Meeting Records**: Store all meeting details and metadata
- **Meeting History**: Complete audit trail of past meetings
- **Participant Tracking**: Log all participants who joined meetings
- **User Meeting Queries**: Retrieve meetings by user email (host or participant)

### Security Features
- **Password-Protected Meetings**: Optional password protection for sensitive meetings
- **Meeting ID Generation**: Secure random meeting ID generation
- **Waiting Room**: Prevent unauthorized access with host approval
- **HTTPS/SSL Support**: Secure communication with SSL certificates (mkcert)
- **Authentication**: Socket.io authentication for connection validation

### Additional Features
- **Meeting ID Input**: Join meetings by entering meeting ID
- **Display Name Configuration**: Set display name before joining
- **Email Requirement**: Email validation for scheduled meetings
- **Meeting Link Generation**: Shareable meeting URLs
- **Automatic Cleanup**: Remove empty meetings from memory
- **Cron Job Scheduling**: Automated reminder service with node-cron

## Tech Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional event-based communication
- **MongoDB**: NoSQL database for data persistence
- **Mongoose**: MongoDB object modeling
- **Nodemailer**: Email sending service
- **iCal Generator**: Calendar invite generation
- **Node-Cron**: Task scheduling for reminders
- **dotenv**: Environment variable management

### Frontend
- **HTML5**: Markup language
- **CSS3**: Styling with custom styles
- **JavaScript (ES6+)**: Client-side scripting
- **Bootstrap 5**: CSS framework for responsive design
- **Bootstrap Icons**: Icon library
- **WebRTC**: Real-time communication protocol

### Security
- **HTTPS**: Secure HTTP with SSL/TLS
- **mkcert**: Local certificate generation for development

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Gmail account (for email notifications)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/video-call-meeting.git
   cd video-call-meeting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate SSL certificates** (for local development)
   ```bash
   npx mkcert create-ca
   npx mkcert create-cert
   ```

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database for the application

5. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (see Configuration section)

6. **Start the server**
   ```bash
   npm start
   ```

7. **Access the application**
   - Open browser and navigate to `https://localhost:8181`

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/videocall
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/videocall

# Application URL
APP_URL=https://localhost:8181

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
ENABLE_EMAILS=true

# Server Configuration
PORT=8181
NODE_ENV=development
```

### Gmail App Password Setup
1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account Settings > Security > 2-Step Verification
3. Scroll to "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in `EMAIL_APP_PASSWORD`

## Usage

### Creating an Instant Meeting
1. Open the application in your browser
2. Enter your display name and email
3. Click "Create Instant Meeting"
4. Share the meeting link or meeting ID with participants

### Scheduling a Meeting
1. Click "Schedule Meeting" on the home screen
2. Fill in meeting details:
   - Title and description
   - Your name and email
   - Date, time, and duration
   - Participant emails (comma-separated)
   - Configure meeting settings
3. Click "Schedule Meeting"
4. Invitations will be sent automatically

### Joining a Meeting
1. Enter your display name and email
2. Enter the meeting ID in the input field
3. Click "Join Meeting"
4. Wait for host approval if waiting room is enabled

### Host Controls (During Meeting)
- **Waiting Room**: Admit or deny participants
- **Make Co-Host**: Promote participants to co-host
- **Remove Participant**: Remove disruptive users
- **Manage Permissions**: Control who can unmute, use video, or screen share
- **Settings**: Access meeting settings to configure defaults
- **Lower Hand**: Lower raised hands of participants

### Participant Controls
- **Audio/Video Toggle**: Mute/unmute or turn camera on/off
- **Screen Share**: Share your screen (if permitted)
- **Raise Hand**: Signal the host for attention
- **Chat**: Send text messages to all participants
- **Leave Meeting**: Exit the current meeting

## API Documentation

### REST API Endpoints

#### Schedule a Meeting
```http
POST /api/meetings/schedule
Content-Type: application/json

{
  "title": "Team Standup",
  "description": "Daily standup meeting",
  "hostName": "John Doe",
  "hostEmail": "john@example.com",
  "scheduledTime": "2025-10-27T10:00:00Z",
  "duration": 30,
  "participants": [
    {
      "email": "user1@example.com",
      "name": "User One"
    }
  ],
  "settings": {
    "waitingRoomEnabled": true,
    "emailReminders": true
  }
}
```

#### Get User's Meetings
```http
GET /api/meetings/user/:email
```

#### Get Meeting Details
```http
GET /api/meetings/:meetingId
```

#### Update Meeting
```http
PUT /api/meetings/:meetingId
Content-Type: application/json

{
  "title": "Updated Title",
  "scheduledTime": "2025-10-27T11:00:00Z"
}
```

#### Cancel Meeting
```http
DELETE /api/meetings/:meetingId
```

#### Start Meeting
```http
PATCH /api/meetings/:meetingId/start
```

#### End Meeting
```http
PATCH /api/meetings/:meetingId/end
```

### Socket.io Events

#### Client → Server Events
- `createMeeting`: Create a new meeting
- `joinMeeting`: Join an existing meeting
- `leaveMeeting`: Leave the current meeting
- `newOffer`: Send WebRTC offer
- `newAnswer`: Send WebRTC answer
- `sendIceCandidateToSignalingServer`: Exchange ICE candidates
- `chatMessage`: Send chat message
- `mediaStateChanged`: Update audio/video state
- `screenSharingStarted`: Start screen sharing
- `screenSharingStopped`: Stop screen sharing
- `raiseHand`: Raise/lower hand
- `admitFromWaitingRoom`: Admit user (admin only)
- `denyFromWaitingRoom`: Deny user (admin only)
- `makeCoHost`: Promote to co-host (admin only)
- `removeParticipant`: Remove participant (admin/co-host)
- `updateUserPermissions`: Update permissions (admin/co-host)
- `toggleWaitingRoom`: Enable/disable waiting room
- `updateDefaultPermissions`: Set default permissions

#### Server → Client Events
- `meetingJoined`: Confirmed meeting join
- `meetingError`: Error occurred
- `waitingRoomJoined`: Added to waiting room
- `admittedToMeeting`: Admitted from waiting room
- `deniedEntry`: Entry denied
- `newParticipant`: New participant joined
- `participantLeft`: Participant left
- `participantsUpdate`: Participant list updated
- `chatMessage`: New chat message
- `mediaStateChanged`: Participant media state changed
- `screenSharingStarted`: Screen sharing started
- `screenSharingStopped`: Screen sharing stopped
- `promotedToCoHost`: Promoted to co-host
- `promotedToAdmin`: Promoted to admin
- `permissionsUpdated`: Your permissions changed
- `removedFromMeeting`: Removed from meeting
- `handLowered`: Hand lowered by host
- `waitingRoomUpdate`: Waiting room list updated

## Project Structure

```
connect/
│
├── backend/
│   ├── server.js                      # Main server file with Socket.io
│   ├── controllers/
│   │   └── meetingController.js       # Meeting CRUD operations
│   ├── routes/
│   │   └── meetingRoutes.js          # API route definitions
│   ├── socket/
│   │   ├── socketEvents.js           # Socket event handlers
│   │   └── socketHandlers/
│   │       ├── adminHandlers.js      # Admin-specific handlers
│   │       ├── chatMediaHandlers.js  # Chat and media handlers
│   │       ├── raiseHandHandlers.js  # Raise hand feature
│   │       ├── screenShareHandlers.js # Screen sharing logic
│   │       ├── waitingRoomHandlers.js # Waiting room logic
│   │       └── webrtcHandlers.js     # WebRTC signaling
│   └── utils/
│       ├── emailService.js           # Email sending service
│       ├── helpers.js                # Utility functions
│       └── reminderService.js        # Cron job for reminders
│
├── database/
│   ├── config/
│   │   └── database.js               # MongoDB configuration
│   └── models/
│       ├── Meeting.js                # Meeting schema
│       └── MeetingHistory.js         # Meeting history schema
│
├── frontend/
│   ├── index.html                    # Main HTML file
│   ├── css/
│   │   └── styles.css                # Custom styles
│   └── js/
│       ├── scripts.js                # Main JavaScript logic
│       ├── scheduleMeeting.js        # Scheduling functionality
│       └── socketListeners.js        # Socket event listeners
│
├── api/
│   └── index.js                      # Vercel serverless API
│
├── cert.key                          # SSL certificate key
├── cert.crt                          # SSL certificate
├── ca.key                            # Certificate authority key
├── ca.crt                            # Certificate authority cert
├── package.json                      # Node.js dependencies
├── .env                              # Environment variables (create this)
├── vercel.json                       # Vercel deployment config
└── README.md                         # This file
```

## Development

### Running in Development Mode
```bash
npm start
```

### Testing Database Connection
```bash
node test-db.js
```

### Adding Test Meetings
```bash
node add-test-meetings.js
```

### Testing Scheduled Meetings
```bash
node test-scheduled-meetings.js
```

## Deployment

### Vercel Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Configure `vercel.json` for your environment
3. Deploy: `vercel --prod`

### Environment Variables for Production
Ensure all environment variables are set in your production environment:
- `MONGODB_URI`
- `EMAIL_USER`
- `EMAIL_APP_PASSWORD`
- `APP_URL`
- `ENABLE_EMAILS`

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Author

**Gouri Singh Rawat**

## Acknowledgments

- WebRTC for real-time communication
- Socket.io for WebSocket implementation
- MongoDB for database solutions
- Nodemailer for email functionality
- Bootstrap team for the UI framework

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Star this repository if you find it helpful!**
