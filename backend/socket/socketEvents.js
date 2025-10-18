// Socket.IO event handlers for video call meetings
const handleSocketEvents = (io) => {
    // Store meetings and their participants
    const meetings = new Map();
    const connectedSockets = new Map();

    io.on('connection', (socket) => {
        console.log("Someone has connected");
        const userName = socket.handshake.auth.userName;
        const password = socket.handshake.auth.password;
        const displayName = socket.handshake.auth.displayName;

        if (password !== "x") {
            socket.disconnect(true);
            return;
        }

        connectedSockets.set(socket.id, { userName, displayName, meetingId: null, isInWaitingRoom: false });

        // Create a new meeting
        socket.on('createMeeting', ({ meetingId, displayName }) => {
            if (meetings.has(meetingId)) {
                socket.emit('meetingError', { message: 'Meeting ID already exists' });
                return;
            }

            meetings.set(meetingId, {
                admin: userName,
                coHosts: [],
                participants: [{
                    userName,
                    socketId: socket.id,
                    displayName,
                    isAdmin: true,
                    isCoHost: false,
                    handRaised: false,
                    permissions: {
                        canUnmute: true,
                        canVideo: true,
                        canScreenShare: true
                    }
                }],
                waitingRoom: [],
                offers: {},
                screenSharer: null,
                settings: {
                    waitingRoomEnabled: true,
                    defaultPermissions: {
                        canUnmute: true,
                        canVideo: true,
                        canScreenShare: false
                    }
                }
            });

            const socketData = connectedSockets.get(socket.id);
            socketData.meetingId = meetingId;

            socket.join(meetingId);
            console.log(`Meeting ${meetingId} created by ${displayName}`);
            
            socket.emit('meetingJoined', { 
                participants: meetings.get(meetingId).participants,
                meetingId,
                isAdmin: true,
                permissions: {
                    canUnmute: true,
                    canVideo: true,
                    canScreenShare: true
                }
            });
        });

        // Join an existing meeting
        socket.on('joinMeeting', async ({ meetingId, displayName, email }) => {
            // Check if meeting exists in MongoDB (scheduled meeting)
            let scheduledMeeting = null;
            try {
                const Meeting = require('../../database/models/Meeting');
                scheduledMeeting = await Meeting.findOne({ meetingId });
            } catch (error) {
                console.error('[ERROR] Error checking scheduled meeting:', error);
            }

            // If meeting doesn't exist in memory, create it (for scheduled meetings or first join)
            if (!meetings.has(meetingId)) {
                console.log(`[MEETING] Creating meeting room for ${meetingId}`);
                
                // Get default settings from scheduled meeting or use defaults
                const defaultSettings = {
                    waitingRoomEnabled: scheduledMeeting?.settings?.waitingRoomEnabled ?? true,
                    defaultPermissions: {
                        canUnmute: scheduledMeeting?.settings?.allowParticipantAudio ?? true,
                        canVideo: scheduledMeeting?.settings?.allowParticipantVideo ?? true,
                        canScreenShare: scheduledMeeting?.settings?.allowParticipantScreenShare ?? false
                    }
                };

                meetings.set(meetingId, {
                    admin: null, // Will be set below
                    coHosts: [],
                    participants: [],
                    waitingRoom: [],
                    offers: {},
                    screenSharer: null,
                    settings: defaultSettings,
                    scheduledMeetingId: scheduledMeeting?._id || null
                });
            }

            const meeting = meetings.get(meetingId);
            const socketData = connectedSockets.get(socket.id);
            socketData.meetingId = meetingId;
            socketData.email = email;

            // Check if this user should be admin (first person or scheduled meeting host)
            let shouldBeAdmin = false;
            
            // If meeting has no admin yet or no participants, first person becomes admin
            if (!meeting.admin || meeting.participants.length === 0) {
                shouldBeAdmin = true;
                console.log(`[MEETING] ${displayName} joining as first person/admin for meeting ${meetingId}`);
            } 
            // If email is provided, check against scheduled meeting host
            else if (email && scheduledMeeting) {
                if (scheduledMeeting.hostEmail.toLowerCase() === email.toLowerCase()) {
                    shouldBeAdmin = true;
                    console.log(`[HOST VERIFIED] ${displayName} (${email}) verified as host for meeting ${meetingId}`);
                } else {
                    console.log(`[ACCESS CHECK] ${displayName} (${email}) is not the host. Host is: ${scheduledMeeting.hostEmail}`);
                }
            }

            // If user should be admin, admit them directly
            if (shouldBeAdmin) {
                // If meeting has no admin, set this user as admin
                if (!meeting.admin) {
                    meeting.admin = userName;
                }
                
                meeting.participants.push({
                    userName,
                    socketId: socket.id,
                    displayName,
                    isAdmin: true,
                    isCoHost: false,
                    handRaised: false,
                    permissions: {
                        canUnmute: true,
                        canVideo: true,
                        canScreenShare: true
                    }
                });

                socket.join(meetingId);
                console.log(`[SUCCESS] ${displayName} joined meeting ${meetingId} as ADMIN`);

                // Update scheduled meeting status to 'ongoing' when first person joins
                if (scheduledMeeting && meeting.participants.length === 1) {
                    if (scheduledMeeting.status === 'scheduled') {
                        scheduledMeeting.status = 'ongoing';
                        if (!scheduledMeeting.actualStartTime) {
                            scheduledMeeting.actualStartTime = new Date();
                        }
                        scheduledMeeting.save()
                            .then(() => {
                                console.log(`[MEETING] Status updated to 'ongoing' for ${meetingId}`);
                            })
                            .catch(err => {
                                console.error(`[ERROR] Failed to update meeting status: ${err.message}`);
                            });
                    }
                }

                socket.to(meetingId).emit('newParticipant', {
                    participant: { userName, displayName }
                });

                socket.emit('meetingJoined', { 
                    participants: meeting.participants,
                    meetingId,
                    isAdmin: true,
                    permissions: {
                        canUnmute: true,
                        canVideo: true,
                        canScreenShare: true
                    }
                });

                io.to(meetingId).emit('participantsUpdate', { 
                    participants: meeting.participants 
                });
            }
            // Check if waiting room is enabled
            else if (meeting.settings.waitingRoomEnabled) {
                meeting.waitingRoom.push({
                    userName,
                    socketId: socket.id,
                    displayName,
                    email
                });
                socketData.isInWaitingRoom = true;

                socket.emit('waitingRoomJoined', { meetingId });
                console.log(`${displayName} is in waiting room for meeting ${meetingId}`);

                const adminParticipant = meeting.participants.find(p => p.isAdmin);
                if (adminParticipant) {
                    io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                        waitingRoom: meeting.waitingRoom
                    });
                }
            } else {
                const defaultPerms = meeting.settings.defaultPermissions || {
                    canUnmute: true,
                    canVideo: true,
                    canScreenShare: false
                };
                
                meeting.participants.push({
                    userName,
                    socketId: socket.id,
                    displayName,
                    isAdmin: false,
                    isCoHost: false,
                    handRaised: false,
                    permissions: {
                        canUnmute: defaultPerms.canUnmute,
                        canVideo: defaultPerms.canVideo,
                        canScreenShare: defaultPerms.canScreenShare
                    }
                });

                socket.join(meetingId);
                console.log(`${displayName} joined meeting ${meetingId}`);

                socket.to(meetingId).emit('newParticipant', {
                    participant: { userName, displayName }
                });

                socket.emit('meetingJoined', { 
                    participants: meeting.participants,
                    meetingId,
                    isAdmin: false,
                    permissions: {
                        canUnmute: true,
                        canVideo: true,
                        canScreenShare: false
                    }
                });

                io.to(meetingId).emit('participantsUpdate', { 
                    participants: meeting.participants 
                });
            }
        });

        // WebRTC Signaling events
        require('./socketHandlers/webrtcHandlers')(socket, io, meetings, connectedSockets);
        
        // Chat and Media events
        require('./socketHandlers/chatMediaHandlers')(socket, io, meetings, connectedSockets);
        
        // Screen Share events
        require('./socketHandlers/screenShareHandlers')(socket, io, meetings, connectedSockets);
        
        // Waiting Room events
        require('./socketHandlers/waitingRoomHandlers')(socket, io, meetings, connectedSockets);
        
        // Admin/Permission events
        require('./socketHandlers/adminHandlers')(socket, io, meetings, connectedSockets);
        
        // Raise Hand events
        require('./socketHandlers/raiseHandHandlers')(socket, io, meetings, connectedSockets);

        // Handle leave meeting
        socket.on('leaveMeeting', ({ meetingId }) => {
            handleDisconnect(socket, io, meetings, connectedSockets, meetingId);
        });

        socket.on('disconnect', () => {
            const socketData = connectedSockets.get(socket.id);
            if (socketData && socketData.meetingId) {
                handleDisconnect(socket, io, meetings, connectedSockets, socketData.meetingId);
            }
            connectedSockets.delete(socket.id);
        });
    });
};

function handleDisconnect(socket, io, meetings, connectedSockets, meetingId) {
    const meeting = meetings.get(meetingId);
    if (!meeting) return;

    const socketData = connectedSockets.get(socket.id);
    if (!socketData) return;

    // Check if user was in waiting room
    if (socketData.isInWaitingRoom) {
        meeting.waitingRoom = meeting.waitingRoom.filter(u => u.socketId !== socket.id);
        
        const adminParticipant = meeting.participants.find(p => p.isAdmin);
        if (adminParticipant) {
            io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                waitingRoom: meeting.waitingRoom
            });
        }
        return;
    }

    // Clear screen sharer if this user was sharing
    if (meeting.screenSharer === socketData.userName) {
        meeting.screenSharer = null;
        socket.to(meetingId).emit('screenSharingStopped', {
            userName: socketData.userName,
            displayName: socketData.displayName
        });
    }

    const wasAdmin = meeting.admin === socketData.userName;
    meeting.participants = meeting.participants.filter(p => p.socketId !== socket.id);

    if (wasAdmin && meeting.participants.length > 0) {
        const newAdmin = meeting.coHosts.length > 0 
            ? meeting.participants.find(p => p.isCoHost)
            : meeting.participants[0];
        
        if (newAdmin) {
            meeting.admin = newAdmin.userName;
            newAdmin.isAdmin = true;
            newAdmin.permissions.canScreenShare = true;
            
            io.to(newAdmin.socketId).emit('promotedToAdmin', {
                permissions: newAdmin.permissions
            });
            
            console.log(`${newAdmin.displayName} promoted to admin in meeting ${meetingId}`);
        }
    }

    socket.to(meetingId).emit('participantLeft', { userName: socketData.userName });
    io.to(meetingId).emit('participantsUpdate', { 
        participants: meeting.participants 
    });

    if (meeting.participants.length === 0) {
        // Check if this is a scheduled meeting and update status back to 'scheduled'
        if (meeting.scheduledMeetingId) {
            const Meeting = require('../../database/models/Meeting');
            Meeting.findById(meeting.scheduledMeetingId)
                .then(scheduledMeeting => {
                    if (scheduledMeeting && scheduledMeeting.status === 'ongoing') {
                        // Reset to scheduled since no one is in the meeting
                        scheduledMeeting.status = 'scheduled';
                        scheduledMeeting.actualStartTime = null; // Clear the start time
                        scheduledMeeting.save()
                            .then(() => {
                                console.log(`[MEETING] Status reset to 'scheduled' for ${meetingId} (all participants left)`);
                            })
                            .catch(err => {
                                console.error(`[ERROR] Failed to reset meeting status: ${err.message}`);
                            });
                    }
                })
                .catch(err => {
                    console.error(`[ERROR] Error checking scheduled meeting: ${err.message}`);
                });
        }
        
        meetings.delete(meetingId);
        console.log(`[MEETING] Room deleted for ${meetingId} (no participants)`);
    }
}

module.exports = handleSocketEvents;
