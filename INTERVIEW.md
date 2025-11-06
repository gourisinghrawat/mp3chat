# Full Stack Developer Interview Guide - Video Call Meeting Platform

## Table of Contents
1. [How to Explain Your Project](#how-to-explain-your-project)
2. [Project Overview](#project-overview)
3. [Architecture & Design Patterns](#architecture--design-patterns)
4. [Backend Deep Dive](#backend-deep-dive)
5. [Frontend Deep Dive](#frontend-deep-dive)
6. [WebRTC Implementation](#webrtc-implementation)
7. [Real-Time Communication](#real-time-communication)
8. [Database & Data Models](#database--data-models)
9. [Authentication & Security](#authentication--security)
10. [Email Service & Notifications](#email-service--notifications)
11. [Deployment & DevOps](#deployment--devops)
12. [Common Interview Questions & Answers](#common-interview-questions--answers)

---

## How to Explain Your Project

### The STAR Method Framework

**S**ituation → **T**ask → **A**ction → **R**esult

Use this framework to structure your explanation in a compelling way.

---

### 1. The 30-Second Elevator Pitch

**Use when**: "Tell me about yourself" or "Walk me through your resume"

**Template:**
> "I built a **real-time video conferencing platform** similar to Zoom, using **Node.js, WebRTC, and Socket.io**. It supports **multi-party video calls, screen sharing, chat, and meeting scheduling**. The challenging part was implementing **WebRTC peer-to-peer connections with a signaling server** and managing **real-time state synchronization** across multiple clients. The project handles **concurrent users, waiting rooms, and granular permission controls** for meeting hosts."

**Key Points to Hit:**
- ✅ What it is (video conferencing platform)
- ✅ Key technologies (Node.js, WebRTC, Socket.io)
- ✅ Main features (video, screen share, chat, scheduling)
- ✅ Technical challenge (WebRTC, real-time sync)
- ✅ Scale/complexity (concurrent users, permissions)

---

### 2. The 2-Minute Overview

**Use when**: "Tell me more about your project"

**Script:**

> **[WHAT - 15 seconds]**
> "I developed a full-stack video conferencing application that allows users to create instant meetings or schedule them in advance, similar to Zoom or Google Meet."
>
> **[WHY - 15 seconds]**
> "I built this to solve the problem of expensive video conferencing tools and to learn how peer-to-peer real-time communication works at a deep technical level."
>
> **[HOW - Technical Stack - 30 seconds]**
> "On the **backend**, I used **Node.js with Express** for the REST API and **Socket.io** for WebSocket connections. For **real-time video**, I implemented **WebRTC** which creates peer-to-peer connections between browsers. The **signaling server** handles the initial handshake using Socket.io. For **data persistence**, I used **MongoDB** to store meeting schedules, and I integrated **Nodemailer with Node-Cron** to send automated email reminders 15 minutes before meetings start."
>
> **[KEY FEATURES - 30 seconds]**
> "The platform supports **multi-party video calls with up to 10+ participants**, **screen sharing** (with single-sharer enforcement), **real-time chat**, **waiting rooms** for security, and **role-based permissions**. Hosts can control who can unmute, share video, or share their screen. I also implemented **meeting scheduling** with calendar invites in iCal format that work with Google Calendar and Outlook."
>
> **[CHALLENGES - 30 seconds]**
> "The biggest challenge was managing **WebRTC peer connections** - each participant needs a separate connection to every other participant, which is an **N×(N-1) mesh topology**. I had to handle **ICE candidate exchanges**, **SDP offer/answer negotiations**, and **connection state management**. Another challenge was ensuring **only one person could screen share at a time**, which I solved using a **server-side mutex pattern**."

---

### 3. The 5-Minute Deep Dive

**Use when**: "Walk me through the technical architecture"

**Structure:**

#### Part 1: High-Level Architecture (60 seconds)

> "The application follows a **client-server architecture** with three main components:
> 
> **1. Client (Browser)**: Built with vanilla JavaScript, uses WebRTC APIs for media capture and peer connections, and Socket.io client for signaling.
> 
> **2. Server (Node.js)**: Runs an Express server with Socket.io for WebSocket communication. It acts as a signaling server for WebRTC and handles REST API endpoints for meeting CRUD operations.
> 
> **3. Database (MongoDB)**: Stores scheduled meetings, meeting history, and participant information.
> 
> The communication flow works like this: Clients connect via WebSocket for real-time events, the server facilitates WebRTC signaling, and then peers connect directly to each other for media streams."

#### Part 2: WebRTC Implementation (90 seconds)

> "For the **video calling**, I implemented WebRTC which is peer-to-peer, meaning video doesn't go through the server - it goes directly between browsers.
> 
> Here's how a connection is established:
> 
> **1. User A** creates an **RTCPeerConnection** object and generates an **SDP offer** describing their media capabilities.
> 
> **2.** This offer is sent to the **signaling server** (Socket.io) which forwards it to **User B**.
> 
> **3. User B** creates their own peer connection, sets the remote description to User A's offer, and generates an **SDP answer**.
> 
> **4.** The answer is sent back through the signaling server to User A.
> 
> **5.** Both peers exchange **ICE candidates** - these are network addresses where they can be reached (local IPs, public IPs from STUN servers).
> 
> **6.** Once candidates are exchanged, a **direct P2P connection** is established and media flows.
> 
> In a meeting with **3 people**, each person maintains **2 peer connections** (mesh topology). With 10 people, each maintains 9 connections. This scales to about 10-15 participants before you'd need an SFU (Selective Forwarding Unit)."

#### Part 3: Key Features Implementation (90 seconds)

> "For **screen sharing**, I use the `getDisplayMedia()` API instead of `getUserMedia()`. The key challenge was ensuring only one person shares at a time. I solved this with a **server-side mutex** - the server stores `meeting.screenSharer = userName`. When someone requests to share, the server checks if this is `null`. If yes, they get permission; if no, they're rejected. When sharing stops, it's set back to `null`.
> 
> For the **waiting room**, when a user joins, I check if waiting room is enabled. If yes, they're added to a `waitingRoom` array instead of the `participants` array. The admin sees a notification and can admit or deny them. When admitted, they're moved from waiting room to participants and join the Socket.io room.
> 
> For **permissions**, each participant has a `permissions` object with `canUnmute`, `canVideo`, and `canScreenShare` flags. The UI disables buttons based on these flags, and the server validates actions. Admins can update permissions in real-time.
> 
> For **email reminders**, I use Node-Cron to run a job every minute that queries MongoDB for meetings starting in 15-16 minutes. If found and not already sent, it sends emails to the host and all participants using Nodemailer, then marks it as sent in an in-memory Set."

#### Part 4: Challenges & Solutions (60 seconds)

> "**Challenge 1**: Managing state across multiple clients. Solution: I use Socket.io rooms for efficient broadcasting and maintain meeting state in a Map on the server.
> 
> **Challenge 2**: Preventing duplicate reminders after server restart. Current solution uses an in-memory Set, but production would use a database flag.
> 
> **Challenge 3**: Handling disconnections gracefully. Solution: When admin disconnects, I automatically promote the first co-host or first participant to admin.
> 
> **Challenge 4**: Memory leaks from peer connections. Solution: I properly close connections and clean up event listeners when users leave.
> 
> **Challenge 5**: Security - initially had no auth. Added Socket.io authentication and HTTPS. Production would need JWT tokens and rate limiting."

---

### 4. Common Follow-Up Questions & Answers

#### Q: "Why did you choose this tech stack?"

**Answer:**
> "I chose **Node.js** because it's event-driven and handles concurrent WebSocket connections efficiently. **Socket.io** because it provides automatic reconnection, rooms for broadcasting, and fallback to polling if WebSocket fails. **MongoDB** for its flexible schema - meeting settings can vary and NoSQL handles that well. **WebRTC** was the only choice for peer-to-peer video - it's a web standard and doesn't require server relay for media. I used **vanilla JavaScript** on frontend to understand the fundamentals before using frameworks."

#### Q: "What would you do differently?"

**Answer:**
> "**1. State Management**: Move from in-memory Map to Redis for horizontal scaling and persistence.
> 
> **2. Architecture**: Implement an SFU (Selective Forwarding Unit) for better scalability beyond 10 users.
> 
> **3. Security**: Add JWT authentication, rate limiting, input sanitization, and possibly end-to-end encryption for chat.
> 
> **4. Frontend**: Use React or Vue for better state management and component reusability.
> 
> **5. Testing**: Add unit tests with Jest, integration tests, and E2E tests with Playwright.
> 
> **6. Monitoring**: Add logging with Winston, error tracking with Sentry, and performance monitoring."

#### Q: "How does this scale?"

**Answer:**
> "**Current limitations**:
> - In-memory state (lost on restart, single server)
> - Mesh topology (scales to ~10 users)
> - No load balancing
> 
> **Scaling solutions**:
> 
> **1. Horizontal Scaling**: Use Redis for shared state and Socket.io Redis adapter to sync across servers.
> 
> **2. Media Server**: Switch from mesh to SFU topology - server receives all streams and forwards to participants. This scales to 100+ users.
> 
> **3. Database**: Add read replicas, implement caching with Redis.
> 
> **4. CDN**: Serve static assets from CDN.
> 
> **5. Microservices**: Split into separate services - signaling server, meeting service, email service.
> 
> With these changes, the system could handle thousands of concurrent meetings."

#### Q: "What was the hardest part?"

**Answer:**
> "The hardest part was **debugging WebRTC connection failures**. Unlike HTTP where you get clear error messages, WebRTC can fail silently or with cryptic errors. Issues include:
> 
> - **ICE candidates not exchanging**: Had to add proper error handling and logging.
> - **Symmetric NAT issues**: Some networks block P2P, needed TURN server.
> - **Timing issues**: Race conditions when ICE candidates arrive before remote description is set.
> - **Connection state management**: Tracking which connections are active, failed, or closed.
> 
> I solved this by:
> - Adding comprehensive logging at each step
> - Implementing connection state listeners
> - Using Chrome's `chrome://webrtc-internals` for debugging
> - Properly sequencing the offer/answer/ICE candidate flow"

#### Q: "How do you handle errors?"

**Answer:**
> "**Client-side**:
> - Try-catch blocks around async operations
> - User-friendly error messages (not technical jargon)
> - Fallback UI if camera/mic access denied
> - Reconnection logic for Socket.io disconnections
> 
> **Server-side**:
> - Error middleware in Express
> - Validation of incoming data
> - Database connection error handling
> - Socket event error handling
> 
> **Example**: If `getUserMedia()` fails, I show a modal explaining they need to grant camera/mic permissions, with browser-specific instructions.
> 
> **Production improvements**: Would add centralized error logging (Sentry), retry logic with exponential backoff, and graceful degradation (e.g., audio-only if video fails)."

---

### 5. The Demo Walkthrough

**Use when**: "Can you show me how it works?"

**Script:**

> **[Home Screen - 15 seconds]**
> "This is the landing page. Users enter their name and email, then can either create an instant meeting, join with a meeting ID, or schedule a meeting for later."
>
> **[Create Meeting - 30 seconds]**
> "When I click Create Meeting, it generates an 8-character meeting ID, opens the video call screen, and starts my camera. You can see my video here. The meeting URL updates so I can share this link."
>
> **[Join Another User - 30 seconds]**
> "Let me open an incognito window to simulate another user joining. They enter the meeting ID, and since waiting room is enabled, they go to the waiting room. Back in the host view, I see a notification with their name. I can admit or deny them. Let me admit them..."
>
> **[Video Call - 30 seconds]**
> "Now we have a peer-to-peer connection. Both videos are showing. I can toggle my audio and video with these controls. The chat button opens the sidebar where we can send messages in real-time."
>
> **[Screen Share - 30 seconds]**
> "When I click Share Screen, the browser asks what to share - I'll share this tab. Now the other participant sees my screen. Notice the button changed to 'Stop Sharing'. Only one person can share at a time - if the other user tries, they get an error."
>
> **[Host Controls - 30 seconds]**
> "As the host, I have admin controls. In the People tab, I can see all participants. I can make someone a co-host, remove them from the meeting, or manage their permissions - like disabling their ability to unmute or share screen."
>
> **[Schedule Meeting - 30 seconds]**
> "Going back to the home screen, the Schedule Meeting feature lets me set a date, time, and duration. I can add participant emails, configure settings like waiting room and permissions. When I schedule it, everyone gets an email with a calendar invite (.ics file) and a meeting link. 15 minutes before the meeting, automated reminders are sent."

---

### 6. Project Highlights to Memorize

**Technical Complexity:**
- ✅ Full-stack (frontend, backend, database)
- ✅ Real-time (WebSocket, WebRTC)
- ✅ Peer-to-peer networking
- ✅ Distributed state management
- ✅ Asynchronous operations
- ✅ Email automation with cron jobs

**Features Implemented:**
- ✅ Multi-party video calls (10+ users)
- ✅ Screen sharing with mutex lock
- ✅ Real-time text chat
- ✅ Waiting room with admit/deny
- ✅ Role-based permissions (admin, co-host, participant)
- ✅ Meeting scheduling with MongoDB
- ✅ Email notifications with calendar invites
- ✅ Automated reminders (Node-Cron)
- ✅ Meeting history and analytics

**Code Metrics:**
- 📁 15+ files across backend and frontend
- 📝 2000+ lines of code
- 🏗️ 5 design patterns implemented
- 🗄️ 2 database models
- 🔌 20+ Socket.io events
- 🌐 8+ REST API endpoints

---

### 7. Confidence Boosters - What Makes Your Project Strong

**1. It's a Real Product**: Not a todo app or blog - it's a complex, production-like application.

**2. Modern Technologies**: Uses industry-standard tools (WebRTC, Socket.io, MongoDB).

**3. Solves Real Problems**: 
   - Concurrent user management
   - Real-time synchronization
   - Peer-to-peer networking
   - State consistency

**4. Demonstrates Full-Stack Skills**:
   - Frontend: DOM manipulation, async JS, WebRTC APIs
   - Backend: REST API, WebSockets, authentication
   - Database: Schema design, queries, indexing
   - DevOps: Environment variables, deployment

**5. Shows Problem-Solving**:
   - Single screen share enforcement
   - Waiting room implementation
   - Permission management
   - Email reminder system

---

### 8. What NOT to Say

❌ "It's just a simple video calling app"
✅ "It's a full-stack real-time communication platform with peer-to-peer WebRTC"

❌ "I followed a tutorial"
✅ "I researched WebRTC documentation and implemented the signaling server from scratch"

❌ "I'm not sure how it works"
✅ "Let me walk you through the architecture..."

❌ "There are some bugs"
✅ "Here are the current limitations and how I'd improve them in production"

❌ "I only know the frontend/backend"
✅ "I built the entire stack - let me explain both sides"

---

### 9. Practice Script - Put It All Together

**Opening (When they ask "Tell me about your project"):**

> "I built a real-time video conferencing platform from scratch using Node.js, WebRTC, and Socket.io. It's a full-stack application that supports multi-party video calls, screen sharing, chat, and meeting scheduling - similar to Zoom but with more granular control over participant permissions.
>
> On the technical side, I implemented WebRTC for peer-to-peer video streaming, which means video doesn't go through the server - it goes directly between browsers after an initial handshake. The server uses Socket.io for the signaling process and to maintain real-time state synchronization.
>
> Some interesting challenges I solved include ensuring only one person can screen share at a time using a server-side mutex, implementing a waiting room feature for security, and building an automated email reminder system with Node-Cron that sends notifications 15 minutes before scheduled meetings.
>
> Would you like me to walk through the architecture, demo the features, or dive into a specific technical aspect?"

**This gives them control to ask what interests them most.**

---

### 10. Final Tips

**1. Know Your Audience**:
   - **Technical interviewer**: Focus on architecture, algorithms, design patterns
   - **Non-technical interviewer**: Focus on features, user experience, problem solved
   - **Hiring manager**: Focus on impact, scalability, business value

**2. Use the Right Terminology**:
   - Don't just say "video calling" → say "WebRTC peer-to-peer connections"
   - Don't just say "notifications" → say "event-driven real-time updates via WebSocket"
   - Don't just say "database" → say "MongoDB with indexed queries"

**3. Connect to Job Requirements**:
   - Job mentions "real-time applications" → emphasize Socket.io experience
   - Job mentions "scalability" → discuss how you'd scale with Redis/SFU
   - Job mentions "frontend" → talk about state management, DOM manipulation
   - Job mentions "backend" → talk about REST API, WebSocket events, database design

**4. Be Honest About Limitations**:
   - Shows maturity and self-awareness
   - Opens discussion about improvements
   - Demonstrates you think about production considerations

**5. Have Metrics Ready**:
   - "Supports 10+ concurrent users per meeting"
   - "Sub-100ms latency for chat messages"
   - "15-minute advance notice for scheduled meetings"
   - "Automated daily cleanup job at midnight"

---

### Quick Reference Card

**What**: Video conferencing platform  
**Technologies**: Node.js, Express, Socket.io, WebRTC, MongoDB, Nodemailer, Node-Cron  
**Features**: Multi-party calls, screen share, chat, waiting room, permissions, scheduling, email reminders  
**Challenges**: WebRTC signaling, state sync, single screen share, permission management  
**Scale**: 10+ users, mesh topology, can scale to SFU  
**Lines of Code**: 2000+  
**Time to Build**: [Your actual time]  

**Memorize this and you can answer any "explain your project" question!**

---

## Project Overview

### What is this project?
A **full-stack WebRTC video conferencing platform** similar to Zoom/Google Meet, built with Node.js, Express, Socket.io, MongoDB, and vanilla JavaScript. It supports real-time video/audio calls, screen sharing, chat, meeting scheduling, waiting rooms, and participant management.

### Key Technologies Used
- **Backend**: Node.js, Express.js, Socket.io, MongoDB (Mongoose)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Bootstrap 5
- **Real-Time**: WebRTC for peer-to-peer video/audio, Socket.io for signaling
- **Database**: MongoDB with Mongoose ODM
- **Email**: Nodemailer with iCal-Generator for calendar invites
- **Scheduling**: Node-Cron for automated reminders
- **Security**: HTTPS with mkcert, Socket.io authentication

### Problem Solved
Traditional video conferencing solutions are either expensive or lack customization. This platform provides:
- **Free & Open Source** alternative
- **Customizable** meeting controls
- **Scheduled meetings** with email notifications
- **Granular permissions** for participants
- **Waiting room** for security

---

## Architecture & Design Patterns

### System Architecture
```
Client (Browser)
    ↓ ↑
WebSocket Connection (Socket.io)
    ↓ ↑
Express Server (Node.js)
    ↓ ↑
MongoDB Database
```

### Design Patterns Used

#### 1. **MVC Pattern (Model-View-Controller)**
- **Model**: MongoDB schemas (`Meeting.js`, `MeetingHistory.js`)
- **View**: HTML templates with Bootstrap
- **Controller**: Route controllers (`meetingController.js`)

#### 2. **Observer Pattern**
- Socket.io event listeners observe and react to events
- Real-time updates propagate to all connected clients
- Example: When user joins, all participants get notified

#### 3. **Singleton Pattern**
- Single Socket.io instance shared across the application
- Single database connection instance
- Single email transporter instance

#### 4. **Factory Pattern**
- Peer connection factory creates RTCPeerConnection objects
- Meeting ID generation factory
- Email template factory

#### 5. **Pub/Sub (Publisher-Subscriber)**
- Socket.io rooms act as channels
- Clients subscribe to meeting rooms
- Events published to specific rooms

---

## Backend Deep Dive

### Server Architecture

#### Main Server (`backend/server.js`)
```javascript
// Key responsibilities:
1. Express server initialization
2. HTTPS/SSL certificate setup
3. Socket.io server creation
4. MongoDB connection
5. REST API routes
6. WebSocket event handling
7. Meeting state management
```

**Important Functions:**

##### 1. Meeting State Management
```javascript
// In-memory meeting storage
const meetings = new Map();
// Structure:
{
  meetingId: {
    admin: userName,
    coHosts: [userName],
    participants: [{
      userName, socketId, displayName,
      isAdmin, isCoHost, handRaised,
      permissions: { canUnmute, canVideo, canScreenShare }
    }],
    waitingRoom: [{userName, socketId, displayName}],
    offers: {}, // WebRTC offers/answers
    screenSharer: null,
    settings: {
      waitingRoomEnabled: true,
      defaultPermissions: {...}
    }
  }
}
```

**Why Map instead of Object?**
- Better performance for frequent additions/deletions
- Preserves insertion order
- Better iteration methods
- Key can be any data type

##### 2. Connected Sockets Management
```javascript
const connectedSockets = new Map();
// Structure:
{
  socketId: {
    userName,
    displayName,
    meetingId,
    isInWaitingRoom
  }
}
```

**Purpose**: Track socket metadata for quick lookups

##### 3. Meeting ID Generation
```javascript
function generateMeetingId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}
```

**Breakdown**:
- `Math.random()` → 0.123456789
- `.toString(36)` → converts to base-36 (0-9, a-z)
- `.substring(2, 10)` → takes 8 characters
- `.toUpperCase()` → converts to uppercase
- **Result**: 8-character alphanumeric ID (e.g., "ABC123XY")

### REST API Endpoints

#### POST `/api/meetings/schedule`
**Purpose**: Schedule a new meeting

**Request Body**:
```json
{
  "title": "Team Standup",
  "description": "Daily standup",
  "hostName": "John Doe",
  "hostEmail": "john@example.com",
  "scheduledTime": "2025-11-05T10:00:00Z",
  "duration": 30,
  "participants": [
    {"email": "user@example.com", "name": "User"}
  ],
  "settings": {
    "waitingRoomEnabled": true,
    "emailReminders": true
  }
}
```

**Process Flow**:
1. Generate unique meeting ID
2. Create Meeting document in MongoDB
3. Send confirmation email to host (if enabled)
4. Send invitations to participants with .ics calendar files
5. Return meeting details

**Key Code**:
```javascript
const meeting = new Meeting({
    meetingId: generateMeetingId(),
    title, description, hostName, hostEmail,
    scheduledTime, duration, participants, settings
});
await meeting.save();
```

#### GET `/api/meetings/user/:email`
**Purpose**: Get all meetings for a specific user

**Query Logic**:
```javascript
Meeting.find({
    $or: [
        { hostEmail: email },           // Meetings I'm hosting
        { 'participants.email': email }  // Meetings I'm invited to
    ],
    status: { $in: ['scheduled', 'ongoing'] },
    scheduledTime: { $gte: new Date() }  // Future meetings only
}).sort({ scheduledTime: 1 });
```

### Socket.io Event Handlers

#### Connection Flow
```javascript
io.on('connection', (socket) => {
    // 1. Extract auth data
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;
    const displayName = socket.handshake.auth.displayName;
    
    // 2. Validate password
    if (password !== "x") {
        socket.disconnect(true);
        return;
    }
    
    // 3. Store socket metadata
    connectedSockets.set(socket.id, { userName, displayName, meetingId: null });
    
    // 4. Register event handlers
    socket.on('createMeeting', ...);
    socket.on('joinMeeting', ...);
    // ... more handlers
});
```

#### Create Meeting Handler
```javascript
socket.on('createMeeting', ({ meetingId, displayName }) => {
    // 1. Validate meeting ID doesn't exist
    if (meetings.has(meetingId)) {
        socket.emit('meetingError', { message: 'Meeting ID already exists' });
        return;
    }
    
    // 2. Initialize meeting state
    meetings.set(meetingId, {
        admin: userName,
        coHosts: [],
        participants: [{
            userName, socketId: socket.id, displayName,
            isAdmin: true, isCoHost: false, handRaised: false,
            permissions: { canUnmute: true, canVideo: true, canScreenShare: true }
        }],
        waitingRoom: [],
        offers: {},
        screenSharer: null,
        settings: { waitingRoomEnabled: true, defaultPermissions: {...} }
    });
    
    // 3. Join socket room
    socket.join(meetingId);
    
    // 4. Notify client
    socket.emit('meetingJoined', {
        participants: meetings.get(meetingId).participants,
        meetingId,
        isAdmin: true,
        permissions: { canUnmute: true, canVideo: true, canScreenShare: true }
    });
});
```

**Why Socket Rooms?**
- Efficient broadcasting to specific meeting participants
- Built-in Socket.io feature
- Automatic cleanup when sockets disconnect

#### Join Meeting Handler (with Waiting Room Logic)
```javascript
socket.on('joinMeeting', ({ meetingId, displayName }) => {
    const meeting = meetings.get(meetingId);
    
    // Check if waiting room is enabled AND user is not admin
    if (meeting.settings.waitingRoomEnabled && meeting.admin !== userName) {
        // Add to waiting room
        meeting.waitingRoom.push({ userName, socketId: socket.id, displayName });
        socketData.isInWaitingRoom = true;
        
        // Notify user they're in waiting room
        socket.emit('waitingRoomJoined', { meetingId });
        
        // Notify admin about new waiting user
        const adminParticipant = meeting.participants.find(p => p.isAdmin);
        io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
            waitingRoom: meeting.waitingRoom
        });
    } else {
        // Direct join - add to participants
        meeting.participants.push({
            userName, socketId: socket.id, displayName,
            isAdmin: false, isCoHost: false, handRaised: false,
            permissions: meeting.settings.defaultPermissions
        });
        
        socket.join(meetingId);
        
        // Notify existing participants
        socket.to(meetingId).emit('newParticipant', {
            participant: { userName, displayName }
        });
        
        // Send current participants to new joiner
        socket.emit('meetingJoined', {
            participants: meeting.participants,
            meetingId, isAdmin: false,
            permissions: meeting.settings.defaultPermissions
        });
    }
});
```

---

## Frontend Deep Dive

### Client-Side Architecture

#### State Management
```javascript
// Global state variables
let userName = null;              // Unique user identifier
let displayName = null;           // User's display name
let currentMeetingId = null;      // Current meeting ID
let isAdmin = false;              // Is current user admin?
let isCoHost = false;             // Is current user co-host?
let userPermissions = {           // Current user permissions
    canUnmute: true,
    canVideo: true,
    canScreenShare: false
};
let localStream;                  // User's camera/mic stream
let peerConnections = {};         // Map of peer connections
let screenStream = null;          // Screen sharing stream
let screenPeerConnections = {};   // Screen sharing peer connections
```

#### Socket Connection Initialization
```javascript
function initializeSocket() {
    userName = "user-" + Math.floor(Math.random() * 100000);
    
    // Auto-detect socket URL (works locally and on deployed server)
    const socketUrl = window.location.origin;
    
    socket = io.connect(socketUrl, {
        auth: {
            userName,
            password: "x",
            displayName
        }
    });
    
    setupSocketListeners();
}
```

**Why Auto-detect URL?**
- Works on localhost, Render, Vercel, etc.
- No hardcoded URLs
- Portable across environments

#### WebRTC Stream Handling

##### Get User Media
```javascript
async function getUserMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Display local video
        addLocalVideo(localStream);
        
        return localStream;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera/microphone');
    }
}
```

**Audio Constraints Explained**:
- `echoCancellation`: Removes echo from audio
- `noiseSuppression`: Filters background noise
- `autoGainControl`: Normalizes audio levels

##### Add Video to Grid
```javascript
function addVideoStream(stream, userName, displayName, isLocal = false) {
    // Create video element
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${userName}`;
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    
    if (isLocal) {
        video.muted = true; // Mute local video to prevent echo
    }
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'video-label';
    nameLabel.textContent = displayName + (isLocal ? ' (You)' : '');
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(nameLabel);
    videoGrid.appendChild(videoContainer);
}
```

### Media Controls

#### Toggle Audio
```javascript
document.querySelector('#toggle-audio').addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            
            // Update UI
            const btn = document.querySelector('#toggle-audio');
            const icon = btn.querySelector('i');
            if (isAudioEnabled) {
                icon.className = 'bi bi-mic-fill';
                btn.querySelector('.control-label').textContent = 'Mute';
            } else {
                icon.className = 'bi bi-mic-mute-fill';
                btn.querySelector('.control-label').textContent = 'Unmute';
            }
            
            // Notify other participants
            socket.emit('mediaStateChanged', {
                meetingId: currentMeetingId,
                userName,
                isAudioEnabled,
                isVideoEnabled
            });
        }
    }
});
```

**How it works**:
1. Get audio track from stream
2. Toggle `enabled` property (doesn't remove track)
3. Update UI to reflect state
4. Broadcast state to other users via Socket.io

#### Toggle Video
```javascript
document.querySelector('#toggle-video').addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoEnabled = !isVideoEnabled;
            videoTrack.enabled = isVideoEnabled;
            
            // Update UI
            const btn = document.querySelector('#toggle-video');
            const icon = btn.querySelector('i');
            if (isVideoEnabled) {
                icon.className = 'bi bi-camera-video-fill';
                btn.querySelector('.control-label').textContent = 'Stop video';
            } else {
                icon.className = 'bi bi-camera-video-off-fill';
                btn.querySelector('.control-label').textContent = 'Start video';
            }
            
            // Notify other participants
            socket.emit('mediaStateChanged', {
                meetingId: currentMeetingId,
                userName,
                isAudioEnabled,
                isVideoEnabled
            });
        }
    }
});
```

---

## WebRTC Implementation

### What is WebRTC?
**WebRTC (Web Real-Time Communication)** is a technology that enables peer-to-peer audio, video, and data sharing between browsers without requiring plugins or third-party software.

### WebRTC Architecture in This Project

```
Peer A (Browser)          Signaling Server (Socket.io)          Peer B (Browser)
     |                              |                                  |
     |------- Offer SDP ----------->|                                  |
     |                              |------- Offer SDP -------------->|
     |                              |                                  |
     |                              |<------ Answer SDP --------------|
     |<------ Answer SDP -----------|                                  |
     |                              |                                  |
     |<==================== ICE Candidates Exchange ==================>|
     |                              |                                  |
     |<==================== Direct P2P Connection ====================>|
     |                   (Video/Audio/Data)                            |
```

### Key WebRTC Components

#### 1. RTCPeerConnection
```javascript
const peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
};

const peerConnection = new RTCPeerConnection(peerConfiguration);
```

**What are ICE Servers?**
- **STUN (Session Traversal Utilities for NAT)**: Discovers public IP address
- **TURN (Traversal Using Relays around NAT)**: Relays traffic if P2P fails (not used here for cost reasons)

#### 2. Creating an Offer (Initiator)
```javascript
async function call(targetUserName) {
    // 1. Create peer connection
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    peerConnections[targetUserName] = peerConnection;
    
    // 2. Add local stream to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // 3. Handle incoming remote stream
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addVideoStream(remoteStream, targetUserName, displayName);
    };
    
    // 4. Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('sendIceCandidateToSignalingServer', {
                didIOffer: true,
                iceUserName: userName,
                iceCandidate: event.candidate,
                remoteUserName: targetUserName,
                meetingId: currentMeetingId
            });
        }
    };
    
    // 5. Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('newOffer', {
        offer,
        targetUserName,
        meetingId: currentMeetingId
    });
}
```

**Step-by-Step Breakdown**:
1. **Create RTCPeerConnection**: Establishes WebRTC connection object
2. **Add Tracks**: Add local audio/video to connection
3. **ontrack Handler**: Receives remote stream when available
4. **onicecandidate Handler**: Sends network candidates to other peer
5. **Create Offer**: Generate SDP (Session Description Protocol) offer
6. **Set Local Description**: Apply offer locally
7. **Send Offer**: Send to other peer via signaling server

#### 3. Answering an Offer (Receiver)
```javascript
socket.on('newOffer', async (offerObj) => {
    const { offererUserName, offer } = offerObj;
    
    // 1. Create peer connection
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    peerConnections[offererUserName] = peerConnection;
    
    // 2. Add local stream
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // 3. Handle remote stream
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addVideoStream(remoteStream, offererUserName, offerObj.offererDisplayName);
    };
    
    // 4. Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('sendIceCandidateToSignalingServer', {
                didIOffer: false,
                iceUserName: userName,
                iceCandidate: event.candidate,
                remoteUserName: offererUserName,
                meetingId: currentMeetingId
            });
        }
    };
    
    // 5. Set remote description (offer)
    await peerConnection.setRemoteDescription(offer);
    
    // 6. Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // 7. Send answer back
    socket.emit('newAnswer', {
        answer,
        offererUserName
    }, (iceCandidates) => {
        // 8. Add queued ICE candidates
        iceCandidates.forEach(candidate => {
            peerConnection.addIceCandidate(candidate);
        });
    });
});
```

#### 4. ICE Candidate Exchange
```javascript
// Receive ICE candidate from other peer
socket.on('receivedIceCandidateFromServer', async ({ iceCandidate, remoteUserName }) => {
    const peerConnection = peerConnections[remoteUserName];
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(iceCandidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
});
```

**What are ICE Candidates?**
- Network addresses (IP + port combinations) where peer can be reached
- Includes local, reflexive (public), and relay addresses
- Both peers exchange candidates until connection is established

### Screen Sharing Implementation

#### Start Screen Share
```javascript
async function startScreenShare() {
    try {
        // 1. Request screen share permission
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always'  // Show cursor in screen share
            },
            audio: false  // Usually don't share system audio
        });
        
        // 2. Request permission from server
        socket.emit('requestScreenShare', {
            meetingId: currentMeetingId,
            userName
        }, async (granted) => {
            if (!granted) {
                alert('Someone else is already sharing screen');
                screenStream.getTracks().forEach(track => track.stop());
                return;
            }
            
            // 3. Notify participants
            socket.emit('screenSharingStarted', {
                meetingId: currentMeetingId,
                userName,
                displayName
            });
            
            // 4. Create peer connections for screen share
            currentParticipants.forEach(participant => {
                if (participant.userName !== userName) {
                    createScreenShareConnection(participant.userName);
                }
            });
            
            // 5. Handle screen share stop
            screenStream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };
            
            isScreenSharing = true;
        });
    } catch (error) {
        console.error('Error sharing screen:', error);
    }
}
```

**Key Differences from Camera Share**:
- Uses `getDisplayMedia()` instead of `getUserMedia()`
- Separate peer connections (`screenPeerConnections`)
- Single sharer at a time (enforced by server)
- Auto-stops when user clicks browser's "Stop sharing" button

---

## Real-Time Communication

### Socket.io vs WebSocket

**Why Socket.io over plain WebSocket?**
1. **Automatic Reconnection**: Handles network interruptions
2. **Rooms & Namespaces**: Built-in grouping mechanism
3. **Fallback Support**: Falls back to polling if WebSocket unavailable
4. **Event-Based**: Easier than message parsing
5. **Acknowledgements**: Request-response pattern support

### Socket.io Rooms

```javascript
// Join a room
socket.join(meetingId);

// Leave a room
socket.leave(meetingId);

// Emit to a room (exclude sender)
socket.to(meetingId).emit('newParticipant', data);

// Emit to a room (include sender)
io.to(meetingId).emit('participantsUpdate', data);

// Emit to specific socket
io.to(socketId).emit('admittedToMeeting', data);
```

### Chat Implementation

#### Send Message (Client)
```javascript
document.querySelector('#send-message').addEventListener('click', () => {
    const input = document.querySelector('#chat-input');
    const message = input.value.trim();
    
    if (message && currentMeetingId) {
        // 1. Display locally
        addChatMessage(displayName, message, new Date(), true);
        
        // 2. Send to server
        socket.emit('chatMessage', {
            meetingId: currentMeetingId,
            message,
            senderName: displayName,
            timestamp: new Date()
        });
        
        input.value = '';
    }
});
```

#### Receive Message (Client)
```javascript
socket.on('chatMessage', ({ senderName, message, timestamp }) => {
    addChatMessage(senderName, message, timestamp, false);
    
    // Show notification if chat is closed
    if (!isChatOpen) {
        unreadMessages++;
        document.querySelector('#chat-badge').textContent = unreadMessages;
        document.querySelector('#chat-badge').style.display = 'block';
    }
});
```

#### Broadcast Message (Server)
```javascript
socket.on('chatMessage', ({ meetingId, message, senderName, timestamp }) => {
    const socketData = connectedSockets.get(socket.id);
    if (!socketData || socketData.meetingId !== meetingId) return;
    
    // Broadcast to all OTHER participants in the meeting
    socket.to(meetingId).emit('chatMessage', {
        senderName,
        message,
        timestamp
    });
});
```

**Why not broadcast to sender?**
- Sender already displays message locally (for instant feedback)
- Avoids duplicate messages
- Better UX (no lag)

---

## Database & Data Models

### MongoDB Schema Design

#### Meeting Model
```javascript
const meetingSchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true,
        unique: true,
        index: true  // Index for fast lookups
    },
    title: {
        type: String,
        required: true
    },
    description: String,
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
        type: Number,  // in minutes
        default: 60
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
        allowParticipantAudio: Boolean,
        allowParticipantVideo: Boolean,
        allowParticipantScreenShare: Boolean,
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
    timestamps: true  // Adds createdAt and updatedAt
});

// Compound index for efficient queries
meetingSchema.index({ scheduledTime: 1, status: 1 });
meetingSchema.index({ hostEmail: 1 });
```

**Why These Indexes?**
1. `meetingId`: Unique identifier, frequently queried
2. `{ scheduledTime: 1, status: 1 }`: For finding upcoming/ongoing meetings
3. `hostEmail`: For finding user's hosted meetings

#### MeetingHistory Model
```javascript
const meetingHistorySchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true,
        unique: true
    },
    participants: [{
        userName: String,
        displayName: String,
        joinedAt: Date,
        leftAt: Date,
        duration: Number  // in seconds
    }],
    chatHistory: [{
        senderName: String,
        message: String,
        timestamp: Date
    }],
    duration: Number,  // Total meeting duration in minutes
    startedAt: Date,
    endedAt: Date
}, {
    timestamps: true
});
```

### Database Queries

#### Find User's Upcoming Meetings
```javascript
const meetings = await Meeting.find({
    $or: [
        { hostEmail: email },
        { 'participants.email': email }
    ],
    status: { $in: ['scheduled', 'ongoing'] },
    scheduledTime: { $gte: new Date() }
}).sort({ scheduledTime: 1 });
```

**Query Breakdown**:
- `$or`: Matches if ANY condition is true
- `'participants.email'`: Dot notation to query nested array
- `$in`: Matches if value is in array
- `$gte`: Greater than or equal to
- `.sort()`: Ascending order by scheduledTime

---

## Authentication & Security

### Socket.io Authentication

#### Client-Side
```javascript
socket = io.connect(socketUrl, {
    auth: {
        userName: "user-12345",
        password: "x",
        displayName: "John Doe"
    }
});
```

#### Server-Side Validation
```javascript
io.on('connection', (socket) => {
    const { userName, password, displayName } = socket.handshake.auth;
    
    // Validate password
    if (password !== "x") {
        socket.disconnect(true);
        return;
    }
    
    // Continue with connection...
});
```

**Production Improvements**:
- Use JWT (JSON Web Tokens) instead of plain password
- Store hashed passwords in database
- Implement session management
- Add rate limiting

### HTTPS/SSL

#### Certificate Generation (Development)
```bash
npx mkcert create-ca
npx mkcert create-cert
```

#### Server Configuration
```javascript
const fs = require('fs');
const https = require('https');

const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

const expressServer = https.createServer({ key, cert }, app);
```

**Why HTTPS is Required**:
- WebRTC requires secure context (HTTPS or localhost)
- Browsers block `getUserMedia()` on HTTP
- Protects data in transit

### Security Measures Implemented

1. **Waiting Room**: Prevents unauthorized access
2. **Password Protection**: Basic authentication (can be enhanced)
3. **HTTPS**: Encrypted communication
4. **Socket Authentication**: Validates connections
5. **Meeting ID Validation**: Checks meeting existence before join
6. **Role-Based Access**: Admin/Co-host/Participant permissions
7. **XSS Protection**: Input sanitization (should be enhanced)

**Security Improvements Needed**:
- Add CSRF tokens
- Implement JWT authentication
- Add rate limiting
- Sanitize user inputs
- Add meeting passwords
- Implement end-to-end encryption for chat

---

## Email Service & Notifications

### Nodemailer Setup

```javascript
const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
};
```

**Why Gmail App Password?**
- Gmail doesn't allow login with regular password in apps
- App passwords are 16-character tokens
- More secure than storing actual password

### Calendar Invite Generation

```javascript
const ical = require('ical-generator').default;

const generateCalendarInvite = (meeting, meetingLink) => {
    const calendar = ical({ name: 'Video Call Meeting' });
    
    const startTime = new Date(meeting.scheduledTime);
    const endTime = new Date(startTime.getTime() + meeting.duration * 60000);
    
    calendar.createEvent({
        start: startTime,
        end: endTime,
        summary: meeting.title,
        description: `${meeting.description}\n\nJoin: ${meetingLink}`,
        location: meetingLink,
        url: meetingLink,
        organizer: {
            name: meeting.hostName,
            email: meeting.hostEmail
        },
        attendees: meeting.participants.map(p => ({
            name: p.name || p.email,
            email: p.email,
            rsvp: true,
            status: 'NEEDS-ACTION'
        }))
    });
    
    return calendar.toString();
};
```

**iCal Format Benefits**:
- Compatible with Google Calendar, Outlook, Apple Calendar
- Auto-adds to user's calendar
- Includes meeting details and link
- Sends RSVP requests

---

### Automated Email Reminder System - Complete Deep Dive

#### System Architecture

```
Server Starts
     ↓
Initialize Reminder Service
     ↓
Node-Cron Scheduler (runs every minute)
     ↓
Query MongoDB for upcoming meetings
     ↓
Filter meetings starting in 15-16 minutes
     ↓
Check if reminder already sent (sentReminders Set)
     ↓
Send email to host + participants
     ↓
Mark as sent (add to Set)
     ↓
[Repeat every minute]
```

#### 1. **Reminder Service Initialization**

```javascript
// backend/utils/reminderService.js

const cron = require('node-cron');
const Meeting = require('../../database/models/Meeting');
const { sendMeetingReminder } = require('./emailService');

// Track which meetings we've already sent reminders for
const sentReminders = new Set();

// Initialize the reminder service when server starts
const initReminderService = () => {
    console.log('[REMINDER] Initializing Meeting Reminder Service...');
    
    // Schedule to run every minute
    cron.schedule('* * * * *', () => {
        checkUpcomingMeetings();
    });
    
    console.log('[REMINDER] Service started - checking every minute');
    
    // Clean up cache every day at midnight
    cron.schedule('0 0 * * *', () => {
        cleanupSentReminders();
    });
    
    console.log('[REMINDER] Cleanup scheduled - runs daily at midnight');
};

module.exports = { initReminderService };
```

**Called in server.js:**
```javascript
// backend/server.js

const { initReminderService } = require('./utils/reminderService');

// After MongoDB connection
connectDB();

// Start reminder service
if (process.env.ENABLE_EMAILS === 'true') {
    initReminderService();
    console.log('✅ Email reminder service started');
}
```

#### 2. **The Cron Job - Every Minute Check**

```javascript
// backend/utils/reminderService.js

const checkUpcomingMeetings = async () => {
    try {
        // STEP 1: Calculate time window
        const now = new Date();
        const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
        const sixteenMinutesFromNow = new Date(now.getTime() + 16 * 60000);
        
        // STEP 2: Query database for meetings in this window
        const upcomingMeetings = await Meeting.find({
            scheduledTime: {
                $gte: fifteenMinutesFromNow,  // Greater than or equal to 15 min
                $lt: sixteenMinutesFromNow    // Less than 16 min
            },
            status: 'scheduled',               // Only scheduled meetings
            'settings.emailReminders': true    // Only if reminders enabled
        });
        
        console.log(`[REMINDER] Checking... Found: ${upcomingMeetings.length} meetings`);
        
        // STEP 3: Process each meeting
        for (const meeting of upcomingMeetings) {
            // Check if we already sent reminder for this meeting
            if (sentReminders.has(meeting.meetingId)) {
                console.log(`[REMINDER] Already sent for: ${meeting.meetingId}`);
                continue;
            }
            
            console.log(`[REMINDER] Sending for: ${meeting.title} (${meeting.meetingId})`);
            
            // STEP 4: Generate meeting link
            const meetingLink = `${process.env.APP_URL}/${meeting.meetingId}`;
            
            // STEP 5: Send reminder email
            const result = await sendMeetingReminder(meeting, meetingLink);
            
            if (result.success) {
                // STEP 6: Mark as sent
                sentReminders.add(meeting.meetingId);
                console.log(`[REMINDER] ✅ Sent successfully: ${meeting.meetingId}`);
            } else {
                console.error(`[REMINDER] ❌ Failed: ${meeting.meetingId}`, result.error);
            }
        }
    } catch (error) {
        console.error('[REMINDER ERROR]', error);
    }
};
```

**Why 15-16 minute window?**
- Cron runs every minute
- Each run checks meetings starting between 15-16 minutes from now
- Ensures reminder sent exactly 15 minutes before
- 1-minute window prevents missing meetings

**Example Timeline:**
```
10:00 AM - Cron checks: meetings scheduled 10:15-10:16
10:01 AM - Cron checks: meetings scheduled 10:16-10:17
10:02 AM - Cron checks: meetings scheduled 10:17-10:18
...
Meeting scheduled at 10:15 AM → Reminder sent at 10:00 AM
```

#### 3. **Preventing Duplicate Reminders**

```javascript
// In-memory Set to track sent reminders
const sentReminders = new Set();

// Before sending
if (sentReminders.has(meeting.meetingId)) {
    console.log('Already sent');
    continue;
}

// After successful send
sentReminders.add(meeting.meetingId);
```

**Why use a Set?**
- O(1) lookup time (very fast)
- No duplicates automatically
- Simple add/has operations
- Memory efficient

**Potential Issue:**
- Set resets when server restarts
- Could send duplicate if server restarts within 15 minutes of meeting

**Production Solution:**
```javascript
// Store in database instead
await Meeting.updateOne(
    { meetingId },
    { reminderSent: true, reminderSentAt: new Date() }
);

// Query with additional filter
const upcomingMeetings = await Meeting.find({
    scheduledTime: { $gte: fifteenMin, $lt: sixteenMin },
    status: 'scheduled',
    'settings.emailReminders': true,
    reminderSent: { $ne: true }  // Not sent yet
});
```

#### 4. **Daily Cleanup Job**

```javascript
const cleanupSentReminders = () => {
    console.log(`[REMINDER] Cleaning up... Current size: ${sentReminders.size}`);
    sentReminders.clear();
    console.log('[REMINDER] Cache cleared');
};

// Runs at midnight every day
cron.schedule('0 0 * * *', () => {
    cleanupSentReminders();
});
```

**Why cleanup?**
- Prevents Set from growing indefinitely
- Meetings from yesterday no longer needed
- Frees memory
- Runs daily at 00:00:00

#### 5. **Sending Reminder Emails**

```javascript
// backend/utils/emailService.js

const sendMeetingReminder = async (meeting, meetingLink) => {
    const transporter = createTransporter();
    const scheduledDate = new Date(meeting.scheduledTime);
    
    // EMAIL 1: Send to host
    const hostMailOptions = {
        from: {
            name: 'Video Call App',
            address: process.env.EMAIL_USER
        },
        to: meeting.hostEmail,
        subject: `⏰ Reminder: "${meeting.title}" starts in 15 minutes`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                              color: white; padding: 30px; text-align: center; }
                    .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; 
                                 padding: 20px; margin: 20px 0; }
                    .button { display: inline-block; padding: 15px 40px; 
                              background: #28a745; color: white; 
                              text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏰ Meeting Starting Soon!</h1>
                    </div>
                    <div class="alert-box">
                        <h2>📢 Your meeting starts in 15 minutes!</h2>
                        <p><strong>${meeting.title}</strong></p>
                        <p>🕐 ${scheduledDate.toLocaleTimeString()}</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="${meetingLink}" class="button">🚀 Start Meeting Now</a>
                    </div>
                    <p><strong>As the host, you can:</strong></p>
                    <ul>
                        <li>Start the meeting early</li>
                        <li>Admit participants from waiting room</li>
                        <li>Manage participant permissions</li>
                    </ul>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        // Send to host
        await transporter.sendMail(hostMailOptions);
        console.log(`⏰ Reminder sent to host: ${meeting.hostEmail}`);
        
        // EMAIL 2: Send to all participants
        if (meeting.participants && meeting.participants.length > 0) {
            for (const participant of meeting.participants) {
                const participantMailOptions = {
                    ...hostMailOptions,
                    to: participant.email,
                    html: hostMailOptions.html
                        .replace('As the host, you can:', 'Quick reminders:')
                        .replace(/<li>Start.*?<\/li>.*?<\/li>.*?<\/li>/s, 
                                '<li>Join a few minutes early</li>' +
                                '<li>Test your audio/video</li>' +
                                '<li>Host will admit you from waiting room</li>')
                        .replace('Start Meeting Now', 'Join Meeting Now')
                };
                
                await transporter.sendMail(participantMailOptions);
                console.log(`⏰ Reminder sent to: ${participant.email}`);
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending reminder:', error);
        return { success: false, error: error.message };
    }
};
```

#### 6. **Complete Flow Diagram**

```
Server Start (8:00 AM)
     ↓
Initialize Reminder Service
     ↓
┌─────────────────────────────────────┐
│  Cron Job (Every Minute)           │
│                                     │
│  8:00 AM → Check meetings 8:15-8:16│
│  8:01 AM → Check meetings 8:16-8:17│
│  8:02 AM → Check meetings 8:17-8:18│
│  ...                                │
│  9:45 AM → Check meetings 10:00-10:01│ ← Meeting found!
│                                     │
└─────────────────────────────────────┘
     ↓
Query MongoDB
     ↓
Found: Meeting at 10:00 AM
     ↓
Check sentReminders Set
     ↓
Not sent yet ✓
     ↓
Generate meeting link
     ↓
Send email to host
     ↓
Send email to participants
     ↓
Add to sentReminders Set
     ↓
9:46 AM → Check meetings 10:01-10:02 (different window)
```

#### 7. **MongoDB Query Breakdown**

```javascript
await Meeting.find({
    scheduledTime: {
        $gte: new Date(now.getTime() + 15 * 60000),  // >= 15 min from now
        $lt: new Date(now.getTime() + 16 * 60000)    // < 16 min from now
    },
    status: 'scheduled',              // Not ongoing, completed, or cancelled
    'settings.emailReminders': true   // User opted in for reminders
});
```

**Query Explanation:**
1. `$gte` (greater than or equal): Meetings starting at or after 15 minutes
2. `$lt` (less than): Meetings starting before 16 minutes
3. **Result**: Meetings starting in exactly 15-16 minute window
4. `status: 'scheduled'`: Skip ongoing/completed meetings
5. `'settings.emailReminders': true`: Only if user wants reminders

**Example Data:**
```javascript
// Current time: 10:00 AM
// Query finds meetings between 10:15:00 AM and 10:15:59 AM

Meeting 1: scheduledTime = 10:15:30 AM → ✓ Found (send reminder)
Meeting 2: scheduledTime = 10:16:30 AM → ✗ Not found (too late)
Meeting 3: scheduledTime = 10:14:30 AM → ✗ Not found (too early)
Meeting 4: scheduledTime = 10:15:45 AM → ✓ Found (send reminder)
```

#### 8. **Error Handling & Edge Cases**

```javascript
// 1. Email service fails
try {
    await transporter.sendMail(mailOptions);
} catch (error) {
    console.error('Failed to send email:', error);
    // Don't add to sentReminders - will retry next minute
    return { success: false, error: error.message };
}

// 2. MongoDB connection lost
try {
    const meetings = await Meeting.find({...});
} catch (error) {
    console.error('Database error:', error);
    // Service will retry next minute
    return;
}

// 3. Meeting cancelled after reminder sent
// Check status before sending
if (meeting.status !== 'scheduled') {
    console.log('Meeting cancelled, skipping reminder');
    continue;
}

// 4. Email disabled in .env
if (process.env.ENABLE_EMAILS !== 'true') {
    console.log('Email service disabled');
    return;
}
```

#### 9. **Performance Considerations**

**Current Load:**
```javascript
// Every minute:
// - 1 MongoDB query (with index on scheduledTime + status)
// - Usually 0-5 results
// - 0-5 emails sent
// Very low load
```

**With 1000 meetings per day:**
```javascript
// Spread over 24 hours = ~41 per hour
// = ~0.68 per minute
// Still very low load
```

**Optimization with Index:**
```javascript
// In Meeting.js model
meetingSchema.index({ 
    scheduledTime: 1, 
    status: 1, 
    'settings.emailReminders': 1 
});

// Query becomes O(log n) instead of O(n)
```

#### 10. **Testing the Reminder Service**

```javascript
// Test script: test-reminders.js

const { initReminderService } = require('./backend/utils/reminderService');
const connectDB = require('./database/config/database');
const Meeting = require('./database/models/Meeting');

async function testReminders() {
    await connectDB();
    
    // Create a test meeting 15 minutes from now
    const testMeeting = new Meeting({
        meetingId: 'TEST1234',
        title: 'Test Meeting',
        hostName: 'Test Host',
        hostEmail: 'test@example.com',
        scheduledTime: new Date(Date.now() + 15 * 60000), // 15 min from now
        duration: 30,
        settings: {
            emailReminders: true
        }
    });
    
    await testMeeting.save();
    console.log('Test meeting created');
    
    // Start reminder service
    initReminderService();
    
    // Wait and check logs
    console.log('Reminder service running... Check logs in 1 minute');
}

testReminders();
```

**Run test:**
```bash
node test-reminders.js
```

---

### Cron Schedule Format - Deep Dive

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7) (Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common Schedules:**
```javascript
'* * * * *'        // Every minute
'*/5 * * * *'      // Every 5 minutes
'0 * * * *'        // Every hour at minute 0
'0 0 * * *'        // Every day at midnight
'0 9 * * *'        // Every day at 9:00 AM
'0 9 * * 1'        // Every Monday at 9:00 AM
'0 9 1 * *'        // First day of month at 9:00 AM
'0 0 1 1 *'        // January 1st at midnight
'*/15 9-17 * * *'  // Every 15 min between 9 AM - 5 PM
```

**Our Usage:**
```javascript
cron.schedule('* * * * *', checkUpcomingMeetings);  // Check every minute
cron.schedule('0 0 * * *', cleanupSentReminders);   // Cleanup at midnight
```

---

## Deployment & DevOps

### Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/videocall

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-char-app-password
ENABLE_EMAILS=true

# Application
APP_URL=https://your-app.com
PORT=8181
NODE_ENV=production
```

### Deployment Platforms

#### 1. Render.com (Current)
**Pros**:
- Free tier available
- Auto-deploy from GitHub
- Built-in HTTPS
- WebSocket support
- Environment variables

**Configuration**:
```yaml
# render.yaml
services:
  - type: web
    name: video-call-app
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: EMAIL_USER
        sync: false
```

#### 2. Vercel
**Pros**:
- Global CDN
- Serverless functions
- Zero config

**Cons**:
- Serverless doesn't support WebSockets natively
- Need separate Socket.io server

**Configuration**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.js"
    }
  ]
}
```

### Performance Optimizations

1. **Connection Pooling**: MongoDB connection reuse
2. **Gzip Compression**: Compress responses
3. **CDN for Static Files**: Use Bootstrap from CDN
4. **Lazy Loading**: Load videos only when visible
5. **Debouncing**: Limit event emissions
6. **Memory Cleanup**: Remove empty meetings from Map

---

## Common Interview Questions & Answers

### 1. **Explain the difference between WebRTC and WebSockets**

**Answer**:
- **WebSocket**: Bi-directional communication protocol between client and server
  - Used for: Signaling, chat, notifications
  - Always goes through server
  
- **WebRTC**: Peer-to-peer communication protocol
  - Used for: Video, audio, data streaming
  - Direct connection between browsers (after signaling)
  - Lower latency, no server relay for media

**In this project**:
- WebSocket (Socket.io): Signaling, chat, participant updates
- WebRTC: Video/audio streams between participants

### 2. **How does the signaling server work?**

**Answer**:
The signaling server (Socket.io) facilitates WebRTC connection establishment:

1. **Peer A** creates an offer (SDP) describing their media capabilities
2. **Signaling server** forwards offer to **Peer B**
3. **Peer B** creates an answer (SDP) and sends back
4. **Both peers** exchange ICE candidates (network addresses)
5. **Direct P2P connection** established (server no longer involved)

The server stores offers temporarily:
```javascript
meeting.offers[`userA-userB`] = {
    offer: sdp,
    answer: null,
    offerIceCandidates: [],
    answererIceCandidates: []
}
```

### 3. **Why use Map instead of Object for storing meetings?**

**Answer**:
```javascript
// Object
const meetings = {};
meetings[id] = data;

// Map
const meetings = new Map();
meetings.set(id, data);
```

**Map Advantages**:
1. **Performance**: Faster for frequent additions/deletions
2. **Key Types**: Can use any data type as key (not just strings)
3. **Iteration**: Built-in `.forEach()`, `.keys()`, `.values()`
4. **Size**: Built-in `.size` property
5. **Ordered**: Maintains insertion order
6. **Cleaner API**: `.set()`, `.get()`, `.has()`, `.delete()`

### 4. **How do you handle user disconnections?**

**Answer**:
```javascript
socket.on('disconnect', () => {
    const socketData = connectedSockets.get(socket.id);
    if (socketData && socketData.meetingId) {
        handleDisconnect(socket, socketData.meetingId);
    }
    connectedSockets.delete(socket.id);
});

function handleDisconnect(socket, meetingId) {
    const meeting = meetings.get(meetingId);
    
    // 1. Remove from participants
    meeting.participants = meeting.participants.filter(
        p => p.socketId !== socket.id
    );
    
    // 2. If admin left, transfer to co-host or first participant
    if (wasAdmin && meeting.participants.length > 0) {
        const newAdmin = meeting.coHosts.length > 0 
            ? meeting.participants.find(p => p.isCoHost)
            : meeting.participants[0];
        newAdmin.isAdmin = true;
    }
    
    // 3. Notify other participants
    socket.to(meetingId).emit('participantLeft', { userName });
    
    // 4. Cleanup empty meetings
    if (meeting.participants.length === 0) {
        meetings.delete(meetingId);
    }
}
```

### 5. **Explain the waiting room implementation**

**Answer**:
```javascript
// 1. User joins meeting
socket.on('joinMeeting', ({ meetingId, displayName }) => {
    const meeting = meetings.get(meetingId);
    
    // 2. Check if waiting room enabled AND not admin
    if (meeting.settings.waitingRoomEnabled && meeting.admin !== userName) {
        // Add to waiting room (not participants)
        meeting.waitingRoom.push({ userName, socketId, displayName });
        
        // Notify user
        socket.emit('waitingRoomJoined', { meetingId });
        
        // Notify admin
        const admin = meeting.participants.find(p => p.isAdmin);
        io.to(admin.socketId).emit('waitingRoomUpdate', {
            waitingRoom: meeting.waitingRoom
        });
    } else {
        // Direct join
        meeting.participants.push({...});
        socket.join(meetingId);
    }
});

// 3. Admin admits user
socket.on('admitFromWaitingRoom', ({ meetingId, userName }) => {
    const userIndex = meeting.waitingRoom.findIndex(u => u.userName === userName);
    const user = meeting.waitingRoom[userIndex];
    
    // Remove from waiting room
    meeting.waitingRoom.splice(userIndex, 1);
    
    // Add to participants
    meeting.participants.push({...});
    
    // Join socket room
    io.sockets.sockets.get(user.socketId).join(meetingId);
    
    // Notify user
    io.to(user.socketId).emit('admittedToMeeting', {...});
});
```

### 6. **How do permissions work?**

**Answer**:
Each participant has granular permissions:
```javascript
participant.permissions = {
    canUnmute: true,    // Can enable microphone
    canVideo: true,     // Can enable camera
    canScreenShare: false  // Can share screen
}
```

**Permission Enforcement**:
- **Client-side**: UI disabled/enabled based on permissions
- **Server-side**: Validates actions (future enhancement)

**Default Permissions**:
```javascript
meeting.settings.defaultPermissions = {
    canUnmute: true,
    canVideo: true,
    canScreenShare: false
};
```

Applied to new participants when they join.

### 7. **Explain the MongoDB query for user meetings**

**Answer**:
```javascript
Meeting.find({
    $or: [
        { hostEmail: email },           // I'm the host
        { 'participants.email': email }  // I'm a participant
    ],
    status: { $in: ['scheduled', 'ongoing'] },  // Active meetings
    scheduledTime: { $gte: new Date() }         // Future meetings
}).sort({ scheduledTime: 1 });  // Earliest first
```

**Breakdown**:
- `$or`: Match if EITHER condition is true
- `'participants.email'`: Query nested field in array
- `$in`: Value in array
- `$gte`: Greater than or equal
- `.sort({ field: 1 })`: 1 = ascending, -1 = descending

### 8. **How does screen sharing differ from camera sharing?**

**Answer**:

| Aspect | Camera Share | Screen Share |
|--------|-------------|--------------|
| API | `getUserMedia()` | `getDisplayMedia()` |
| Multiple Users | All can share | Only one at a time |
| Peer Connections | `peerConnections{}` | `screenPeerConnections{}` |
| Server Permission | Not required | Required (prevents multiple) |
| Stop Event | Manual button | Button OR browser stop button |

**Code Difference**:
```javascript
// Camera
const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
});

// Screen
const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: 'always' },
    audio: false
});
```

### 9. **What happens when admin leaves the meeting?**

**Answer**:
```javascript
// 1. Detect admin left
const wasAdmin = meeting.admin === socketData.userName;

// 2. If participants remain, assign new admin
if (wasAdmin && meeting.participants.length > 0) {
    // Priority: Co-host > First participant
    const newAdmin = meeting.coHosts.length > 0 
        ? meeting.participants.find(p => p.isCoHost)
        : meeting.participants[0];
    
    // 3. Update meeting state
    meeting.admin = newAdmin.userName;
    newAdmin.isAdmin = true;
    newAdmin.permissions.canScreenShare = true;
    
    // 4. Notify new admin
    io.to(newAdmin.socketId).emit('promotedToAdmin', {
        permissions: newAdmin.permissions
    });
}

// 5. If no participants, delete meeting
if (meeting.participants.length === 0) {
    meetings.delete(meetingId);
}
```

### 10. **How do you handle scaling this application?**

**Answer**:
**Current Limitations**:
- In-memory meeting storage (lost on restart)
- Single server (no horizontal scaling)
- No load balancing

**Solutions for Scaling**:

1. **Redis for State Management**:
```javascript
// Store meetings in Redis instead of Map
const redis = require('redis');
const client = redis.createClient();

// Set meeting
await client.set(`meeting:${meetingId}`, JSON.stringify(meetingData));

// Get meeting
const data = await client.get(`meeting:${meetingId}`);
const meeting = JSON.parse(data);
```

2. **Socket.io Redis Adapter**:
```javascript
const { createAdapter } = require('@socket.io/redis-adapter');

const pubClient = redis.createClient();
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```
This allows Socket.io to work across multiple servers.

3. **Database Session Storage**:
- Store active meetings in MongoDB
- Update on every state change
- Restore on server restart

4. **Load Balancing**:
```
Users → Load Balancer → [Server 1, Server 2, Server 3]
                              ↓
                          Shared Redis
```

5. **Media Server (SFU - Selective Forwarding Unit)**:
- Current: Mesh topology (everyone connects to everyone)
- Scaled: SFU (everyone connects to server, server forwards)
- Examples: Jitsi, Mediasoup, Janus

**Mesh vs SFU**:
```
Mesh (Current):
- 3 participants = 6 connections (3 x 2)
- 10 participants = 90 connections (10 x 9)
- Client bandwidth = (n-1) uploads + (n-1) downloads

SFU (Scaled):
- 3 participants = 3 connections
- 10 participants = 10 connections
- Server handles routing
```

---

## Performance & Optimization Questions

### 11. **How do you optimize video quality vs bandwidth?**

**Answer**:
```javascript
// Adaptive bitrate based on network
const constraints = {
    video: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
    }
};

// Monitor connection quality
peerConnection.getStats().then(stats => {
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            const packetsLost = report.packetsLost;
            const jitter = report.jitter;
            
            // Adjust quality based on metrics
            if (packetsLost > threshold) {
                reduceVideoQuality();
            }
        }
    });
});
```

### 12. **How do you prevent memory leaks?**

**Answer**:
1. **Clean up peer connections**:
```javascript
function closePeerConnection(userName) {
    if (peerConnections[userName]) {
        peerConnections[userName].close();
        delete peerConnections[userName];
    }
}
```

2. **Remove event listeners**:
```javascript
socket.off('participantLeft');
video.removeEventListener('click', handler);
```

3. **Stop media tracks**:
```javascript
localStream.getTracks().forEach(track => track.stop());
```

4. **Clear intervals/timeouts**:
```javascript
clearInterval(intervalId);
clearTimeout(timeoutId);
```

5. **Delete meeting when empty**:
```javascript
if (meeting.participants.length === 0) {
    meetings.delete(meetingId);
}
```

---

## Best Practices Demonstrated

1. **Separation of Concerns**: Routes, controllers, models, utils separated
2. **Error Handling**: Try-catch blocks, error events
3. **Validation**: Input validation, meeting existence checks
4. **Scalable Architecture**: Modular handler files
5. **Code Reusability**: Helper functions, utilities
6. **Documentation**: Comments explaining complex logic
7. **Environment Variables**: Sensitive data in .env
8. **Async/Await**: Modern promise handling
9. **Event-Driven**: Socket.io event handlers
10. **RESTful API**: Standard HTTP methods and status codes

---

## Technical Depth Summary

**You should be able to explain**:
- How WebRTC peer connections work
- The signaling process with Socket.io
- ICE candidate exchange
- SDP offer/answer mechanism
- MongoDB queries with operators
- Socket.io rooms and broadcasting
- Email service with Nodemailer
- Cron job scheduling
- State management (in-memory vs database)
- Authentication flow
- Permission system
- Waiting room logic
- Screen sharing implementation
- Admin/co-host role management
- Error handling strategies
- Performance optimization
- Scaling challenges and solutions

**Good luck with your interview!**
