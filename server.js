
const fs = require('fs');
const https = require('https')
const express = require('express');
const path = require('path');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname))

// Serve index.html for meeting ID routes (e.g., /ABC123XY)
app.get('/:meetingId([A-Z0-9]{8})', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//we need a key and cert to run https
//we generated them with mkcert
// $ mkcert create-ca
// $ mkcert create-cert
const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');

//we changed our express setup so we can use https
//pass the key and cert to createServer on https
const expressServer = https.createServer({key, cert}, app);
//create our socket.io server... it will listen to our express port
const io = socketio(expressServer,{
    cors: {
        origin: [
            "https://localhost",
            'https://172.22.240.1'
        ],
        methods: ["GET", "POST"]
    }
});
expressServer.listen(8181);

// Store meetings and their participants
const meetings = new Map();
// meetingId => { 
//   admin: userName,
//   coHosts: [userName],
//   participants: [{userName, socketId, displayName, isAdmin, isCoHost, permissions: {canUnmute, canVideo, canScreenShare}}],
//   waitingRoom: [{userName, socketId, displayName}],
//   offers: {}, 
//   screenSharer: null,
//   settings: { waitingRoomEnabled: true }
// }

const connectedSockets = new Map();
// socketId => {userName, displayName, meetingId, isInWaitingRoom}

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
                waitingRoomEnabled: true
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
    socket.on('joinMeeting', ({ meetingId, displayName }) => {
        if (!meetings.has(meetingId)) {
            socket.emit('meetingError', { message: 'Meeting not found' });
            return;
        }

        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        socketData.meetingId = meetingId;

        // Check if waiting room is enabled
        if (meeting.settings.waitingRoomEnabled && meeting.admin !== userName) {
            // Add to waiting room
            meeting.waitingRoom.push({
                userName,
                socketId: socket.id,
                displayName
            });
            socketData.isInWaitingRoom = true;

            socket.emit('waitingRoomJoined', { meetingId });
            console.log(`${displayName} is in waiting room for meeting ${meetingId}`);

            // Notify admin about new person in waiting room
            const adminParticipant = meeting.participants.find(p => p.isAdmin);
            if (adminParticipant) {
                io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                    waitingRoom: meeting.waitingRoom
                });
            }
        } else {
            // Direct join (admin or waiting room disabled)
            meeting.participants.push({
                userName,
                socketId: socket.id,
                displayName,
                isAdmin: false,
                isCoHost: false,
                handRaised: false,
                permissions: {
                    canUnmute: true,
                    canVideo: true,
                    canScreenShare: false
                }
            });

            socket.join(meetingId);
            console.log(`${displayName} joined meeting ${meetingId}`);

            // Notify existing participants
            socket.to(meetingId).emit('newParticipant', {
                participant: { userName, displayName }
            });

            // Send current participants to the new joiner
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

            // Update all participants
            io.to(meetingId).emit('participantsUpdate', { 
                participants: meeting.participants 
            });
        }
    });

    // Handle new offer
    socket.on('newOffer', ({ offer, targetUserName, meetingId }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) {
            return;
        }

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const targetParticipant = meeting.participants.find(p => p.userName === targetUserName);
        if (!targetParticipant) return;

        // Store offer
        const offerKey = `${userName}-${targetUserName}`;
        if (!meeting.offers[offerKey]) {
            meeting.offers[offerKey] = {
                offererUserName: userName,
                offererDisplayName: socketData.displayName,
                offer: offer,
                offerIceCandidates: [],
                answererUserName: targetUserName,
                answer: null,
                answererIceCandidates: []
            };
        }

        // Send offer to target
        io.to(targetParticipant.socketId).emit('newOffer', meeting.offers[offerKey]);
    })

    // Handle answer
    socket.on('newAnswer', (offerObj, ackFunction) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData) return;

        const meeting = meetings.get(socketData.meetingId);
        if (!meeting) return;

        const offerKey = `${offerObj.offererUserName}-${userName}`;
        const offerToUpdate = meeting.offers[offerKey];
        
        if (!offerToUpdate) {
            console.log("No OfferToUpdate");
            return;
        }

        const offererParticipant = meeting.participants.find(p => p.userName === offerObj.offererUserName);
        if (!offererParticipant) {
            console.log("No matching socket");
            return;
        }

        // Send back ICE candidates
        ackFunction(offerToUpdate.offerIceCandidates);
        
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;
        offerToUpdate.answererDisplayName = socketData.displayName;

        // Send answer to offerer
        io.to(offererParticipant.socketId).emit('answerResponse', offerToUpdate);
    })

    // Handle ICE candidates
    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate, remoteUserName, meetingId } = iceCandidateObj;
        const socketData = connectedSockets.get(socket.id);
        
        if (!socketData || socketData.meetingId !== meetingId) return;

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const offerKey = didIOffer ? 
            `${iceUserName}-${remoteUserName}` : 
            `${remoteUserName}-${iceUserName}`;
        
        const offerInOffers = meeting.offers[offerKey];
        if (!offerInOffers) return;

        if (didIOffer) {
            offerInOffers.offerIceCandidates.push(iceCandidate);
            if (offerInOffers.answererUserName) {
                const socketToSendTo = meeting.participants.find(p => p.userName === offerInOffers.answererUserName);
                if (socketToSendTo) {
                    io.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', {
                        iceCandidate,
                        remoteUserName: iceUserName
                    });
                }
            }
        } else {
            offerInOffers.answererIceCandidates.push(iceCandidate);
            const socketToSendTo = meeting.participants.find(p => p.userName === offerInOffers.offererUserName);
            if (socketToSendTo) {
                io.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', {
                    iceCandidate,
                    remoteUserName: iceUserName
                });
            }
        }
    });

    // Handle chat messages
    socket.on('chatMessage', ({ meetingId, message, senderName, timestamp }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        // Broadcast message to all other participants in the meeting
        socket.to(meetingId).emit('chatMessage', {
            senderName,
            message,
            timestamp
        });
    });

    // Handle media state changes (audio/video toggle)
    socket.on('mediaStateChanged', ({ meetingId, userName, isVideoEnabled, isAudioEnabled }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        // Broadcast media state change to all other participants
        socket.to(meetingId).emit('mediaStateChanged', {
            userName,
            isVideoEnabled,
            isAudioEnabled
        });
    });

    // Handle screen share request
    socket.on('requestScreenShare', ({ meetingId, userName }, ackFunction) => {
        const meeting = meetings.get(meetingId);
        if (!meeting) {
            ackFunction(false);
            return;
        }

        // Check if someone else is already sharing
        if (meeting.screenSharer && meeting.screenSharer !== userName) {
            ackFunction(false);
            return;
        }

        // Grant permission
        meeting.screenSharer = userName;
        ackFunction(true);
    });

    // Handle screen sharing started
    socket.on('screenSharingStarted', ({ meetingId, userName, displayName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        // Notify all other participants
        socket.to(meetingId).emit('screenSharingStarted', {
            userName,
            displayName
        });
    });

    // Handle stop screen share
    socket.on('stopScreenShare', ({ meetingId, userName }) => {
        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        // Clear screen sharer if it's the current user
        if (meeting.screenSharer === userName) {
            meeting.screenSharer = null;
        }
    });

    // Handle screen sharing stopped
    socket.on('screenSharingStopped', ({ meetingId, userName, displayName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        // Notify all other participants
        socket.to(meetingId).emit('screenSharingStopped', {
            userName,
            displayName
        });
    });

    // Admin: Force stop screen sharing
    socket.on('forceStopScreenShare', ({ meetingId, userName: targetUser }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can stop screen sharing' });
            return;
        }

        // Find target user
        const userToStop = meeting.participants.find(p => p.userName === targetUser);
        if (!userToStop) return;

        console.log(`Admin/Co-Host forcing stop screen share for ${userToStop.displayName}`);

        // Clear screen sharer
        if (meeting.screenSharer === targetUser) {
            meeting.screenSharer = null;
        }

        // Notify the user to stop sharing
        io.to(userToStop.socketId).emit('forceStopScreenShare', {
            message: 'Host has stopped your screen sharing'
        });

        // Notify all participants that screen sharing stopped
        io.to(meetingId).emit('screenSharingStopped', {
            userName: targetUser,
            displayName: userToStop.displayName
        });
    });

    // Handle screen share offer
    socket.on('screenShareOffer', ({ offer, targetUserName, meetingId, sharerUserName, sharerDisplayName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const targetParticipant = meeting.participants.find(p => p.userName === targetUserName);
        if (!targetParticipant) return;

        // Forward offer to target participant
        io.to(targetParticipant.socketId).emit('screenShareOffer', {
            offer,
            sharerUserName,
            sharerDisplayName
        });
    });

    // Handle screen share answer
    socket.on('screenShareAnswer', ({ answer, sharerUserName, answererUserName, meetingId }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const sharerParticipant = meeting.participants.find(p => p.userName === sharerUserName);
        if (!sharerParticipant) return;

        // Forward answer to sharer
        io.to(sharerParticipant.socketId).emit('screenShareAnswer', {
            answer,
            answererUserName
        });
    });

    // Handle screen share ICE candidates
    socket.on('sendScreenShareIceCandidate', ({ iceCandidate, targetUserName, meetingId, fromUserName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const targetParticipant = meeting.participants.find(p => p.userName === targetUserName);
        if (!targetParticipant) return;

        // Forward ICE candidate
        io.to(targetParticipant.socketId).emit('screenShareIceCandidate', {
            iceCandidate,
            fromUserName
        });
    });

    // Get participants for screen sharing
    socket.on('getParticipants', ({ meetingId }, ackFunction) => {
        const meeting = meetings.get(meetingId);
        if (!meeting) {
            ackFunction({ participants: [] });
            return;
        }
        ackFunction({ participants: meeting.participants });
    });

    // Admin: Admit user from waiting room
    socket.on('admitFromWaitingRoom', ({ meetingId, userName: userToAdmit }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can admit users' });
            return;
        }

        // Find user in waiting room
        const userIndex = meeting.waitingRoom.findIndex(u => u.userName === userToAdmit);
        if (userIndex === -1) return;

        const user = meeting.waitingRoom[userIndex];
        meeting.waitingRoom.splice(userIndex, 1);

        // Add to participants
        meeting.participants.push({
            userName: user.userName,
            socketId: user.socketId,
            displayName: user.displayName,
            isAdmin: false,
            isCoHost: false,
            handRaised: false,
            permissions: {
                canUnmute: true,
                canVideo: true,
                canScreenShare: false
            }
        });

        const userSocketData = connectedSockets.get(user.socketId);
        if (userSocketData) {
            userSocketData.isInWaitingRoom = false;
        }

        io.to(user.socketId).emit('admittedToMeeting', {
            participants: meeting.participants,
            meetingId,
            isAdmin: false,
            permissions: {
                canUnmute: true,
                canVideo: true,
                canScreenShare: false
            }
        });

        // Let them join the room
        const userSocket = io.sockets.sockets.get(user.socketId);
        if (userSocket) {
            userSocket.join(meetingId);
        }

        // Notify all participants
        socket.to(meetingId).emit('newParticipant', {
            participant: { userName: user.userName, displayName: user.displayName }
        });

        io.to(meetingId).emit('participantsUpdate', { 
            participants: meeting.participants 
        });

        // Update waiting room for admin
        const adminParticipant = meeting.participants.find(p => p.isAdmin);
        if (adminParticipant) {
            io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                waitingRoom: meeting.waitingRoom
            });
        }
    });

    // Admin: Deny user from waiting room
    socket.on('denyFromWaitingRoom', ({ meetingId, userName: userToDeny }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        // Find user in waiting room
        const userIndex = meeting.waitingRoom.findIndex(u => u.userName === userToDeny);
        if (userIndex === -1) return;

        const user = meeting.waitingRoom[userIndex];
        meeting.waitingRoom.splice(userIndex, 1);

        // Notify user they were denied
        io.to(user.socketId).emit('deniedEntry', { message: 'The host denied your entry to the meeting' });

        // Update waiting room for admin
        const adminParticipant = meeting.participants.find(p => p.isAdmin);
        if (adminParticipant) {
            io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                waitingRoom: meeting.waitingRoom
            });
        }

        // Disconnect the denied user
        const userSocket = io.sockets.sockets.get(user.socketId);
        if (userSocket) {
            userSocket.disconnect();
        }
    });

    // Admin: Make someone a co-host
    socket.on('makeCoHost', ({ meetingId, userName: userToPromote }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || !requester.isAdmin) {
            socket.emit('error', { message: 'Only admin can assign co-hosts' });
            return;
        }

        // Find user in participants
        const user = meeting.participants.find(p => p.userName === userToPromote);
        if (!user) return;

        user.isCoHost = true;
        user.permissions.canScreenShare = true;
        meeting.coHosts.push(userToPromote);

        // Notify the promoted user
        io.to(user.socketId).emit('promotedToCoHost', {
            permissions: user.permissions
        });

        // Notify all participants
        io.to(meetingId).emit('participantsUpdate', { 
            participants: meeting.participants 
        });

        console.log(`${user.displayName} promoted to co-host in meeting ${meetingId}`);
    });

    // Admin: Update user permissions
    socket.on('updateUserPermissions', ({ meetingId, userName: targetUser, permissions }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can manage permissions' });
            return;
        }

        // Find target user
        const user = meeting.participants.find(p => p.userName === targetUser);
        if (!user) return;

        // Update permissions
        user.permissions = { ...user.permissions, ...permissions };

        // Notify the user
        io.to(user.socketId).emit('permissionsUpdated', {
            permissions: user.permissions
        });

        // Notify all participants about the update
        io.to(meetingId).emit('participantsUpdate', { 
            participants: meeting.participants 
        });

        console.log(`Permissions updated for ${user.displayName} in meeting ${meetingId}`);
    });

    // Admin: Remove participant from meeting
    socket.on('removeParticipant', ({ meetingId, userName: targetUser }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can remove participants' });
            return;
        }

        // Find target user
        const userToRemove = meeting.participants.find(p => p.userName === targetUser);
        if (!userToRemove || userToRemove.isAdmin) {
            // Cannot remove admin
            return;
        }

        console.log(`Removing ${userToRemove.displayName} from meeting ${meetingId}`);

        // Remove from participants list
        meeting.participants = meeting.participants.filter(p => p.userName !== targetUser);

        // Remove from co-hosts if applicable
        meeting.coHosts = meeting.coHosts.filter(u => u !== targetUser);

        // Notify the removed user
        io.to(userToRemove.socketId).emit('removedFromMeeting', {
            message: 'You have been removed from the meeting by the host'
        });

        // Update socket data
        const removedSocketData = connectedSockets.get(userToRemove.socketId);
        if (removedSocketData) {
            removedSocketData.meetingId = null;
        }

        // Leave socket room
        const removedSocket = io.sockets.sockets.get(userToRemove.socketId);
        if (removedSocket) {
            removedSocket.leave(meetingId);
        }

        // Notify other participants
        socket.to(meetingId).emit('participantLeft', { userName: targetUser });
        socket.to(meetingId).emit('participantUpdate', {
            participants: meeting.participants
        });

        // Update waiting room list for admin/co-hosts
        meeting.participants.filter(p => p.isAdmin || p.isCoHost).forEach(admin => {
            io.to(admin.socketId).emit('waitingRoomUpdate', {
                waitingRoom: meeting.waitingRoom
            });
        });
    });

    // Admin: Toggle waiting room
    socket.on('toggleWaitingRoom', ({ meetingId, enabled }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || !requester.isAdmin) return;

        meeting.settings.waitingRoomEnabled = enabled;
        console.log(`Waiting room ${enabled ? 'enabled' : 'disabled'} for meeting ${meetingId}`);
    });

    // Raise/lower hand
    socket.on('raiseHand', ({ meetingId, raised }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const participant = meeting.participants.find(p => p.socketId === socket.id);
        if (participant) {
            participant.handRaised = raised;
            
            // Notify all participants about hand raise status
            io.to(meetingId).emit('participantsUpdate', {
                participants: meeting.participants
            });
            
            console.log(`${participant.displayName} ${raised ? 'raised' : 'lowered'} hand in meeting ${meetingId}`);
        }
    });

    // Admin: Lower someone's hand
    socket.on('lowerHand', ({ meetingId, userName: targetUserName }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        // Check if requester is admin or co-host
        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        const participant = meeting.participants.find(p => p.userName === targetUserName);
        if (participant) {
            participant.handRaised = false;
            
            // Notify all participants
            io.to(meetingId).emit('participantsUpdate', {
                participants: meeting.participants
            });
            
            // Notify the user whose hand was lowered
            io.to(participant.socketId).emit('handLowered');
            
            console.log(`${requester.displayName} lowered ${participant.displayName}'s hand in meeting ${meetingId}`);
        }
    });

    // Handle leave meeting
    socket.on('leaveMeeting', ({ meetingId }) => {
        handleDisconnect(socket, meetingId);
    });

    socket.on('disconnect', () => {
        const socketData = connectedSockets.get(socket.id);
        if (socketData && socketData.meetingId) {
            handleDisconnect(socket, socketData.meetingId);
        }
        connectedSockets.delete(socket.id);
    });
});

function handleDisconnect(socket, meetingId) {
    const meeting = meetings.get(meetingId);
    if (!meeting) return;

    const socketData = connectedSockets.get(socket.id);
    if (!socketData) return;

    // Check if user was in waiting room
    if (socketData.isInWaitingRoom) {
        meeting.waitingRoom = meeting.waitingRoom.filter(u => u.socketId !== socket.id);
        
        // Update waiting room for admin
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

    // Check if the leaving user is admin
    const wasAdmin = meeting.admin === socketData.userName;

    // Remove participant
    meeting.participants = meeting.participants.filter(p => p.socketId !== socket.id);

    // If admin left and there are still participants, assign new admin
    if (wasAdmin && meeting.participants.length > 0) {
        // Make the first co-host admin, or first participant
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

    // Notify other participants
    socket.to(meetingId).emit('participantLeft', { userName: socketData.userName });
    
    // Update participants list
    io.to(meetingId).emit('participantsUpdate', { 
        participants: meeting.participants 
    });

    // Clean up meeting if empty
    if (meeting.participants.length === 0) {
        meetings.delete(meetingId);
        console.log(`Meeting ${meetingId} deleted (no participants)`);
    }
}