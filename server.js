
const fs = require('fs');
const https = require('https')
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname))

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
// meetingId => { participants: [{userName, socketId, displayName}], offers: {}, screenSharer: null }

const connectedSockets = new Map();
// socketId => {userName, displayName, meetingId}

io.on('connection', (socket) => {
    console.log("Someone has connected");
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;
    const displayName = socket.handshake.auth.displayName;

    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    connectedSockets.set(socket.id, { userName, displayName, meetingId: null });

    // Create a new meeting
    socket.on('createMeeting', ({ meetingId, displayName }) => {
        if (meetings.has(meetingId)) {
            socket.emit('meetingError', { message: 'Meeting ID already exists' });
            return;
        }

        meetings.set(meetingId, {
            participants: [{
                userName,
                socketId: socket.id,
                displayName
            }],
            offers: {},
            screenSharer: null
        });

        const socketData = connectedSockets.get(socket.id);
        socketData.meetingId = meetingId;

        socket.join(meetingId);
        console.log(`Meeting ${meetingId} created by ${displayName}`);
        
        socket.emit('meetingJoined', { 
            participants: meetings.get(meetingId).participants,
            meetingId 
        });
    });

    // Join an existing meeting
    socket.on('joinMeeting', ({ meetingId, displayName }) => {
        if (!meetings.has(meetingId)) {
            socket.emit('meetingError', { message: 'Meeting not found' });
            return;
        }

        const meeting = meetings.get(meetingId);
        meeting.participants.push({
            userName,
            socketId: socket.id,
            displayName
        });

        const socketData = connectedSockets.get(socket.id);
        socketData.meetingId = meetingId;

        socket.join(meetingId);
        console.log(`${displayName} joined meeting ${meetingId}`);

        // Notify existing participants
        socket.to(meetingId).emit('newParticipant', {
            participant: { userName, displayName }
        });

        // Send current participants to the new joiner
        socket.emit('meetingJoined', { 
            participants: meeting.participants,
            meetingId 
        });

        // Update all participants
        io.to(meetingId).emit('participantsUpdate', { 
            participants: meeting.participants 
        });
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

    // Clear screen sharer if this user was sharing
    if (meeting.screenSharer === socketData.userName) {
        meeting.screenSharer = null;
        socket.to(meetingId).emit('screenSharingStopped', {
            userName: socketData.userName,
            displayName: socketData.displayName
        });
    }

    // Remove participant
    meeting.participants = meeting.participants.filter(p => p.socketId !== socket.id);

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