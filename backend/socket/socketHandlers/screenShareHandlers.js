// Screen share handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Handle screen share request
    socket.on('requestScreenShare', ({ meetingId, userName }, ackFunction) => {
        const meeting = meetings.get(meetingId);
        if (!meeting) {
            ackFunction(false);
            return;
        }

        if (meeting.screenSharer && meeting.screenSharer !== userName) {
            ackFunction(false);
            return;
        }

        meeting.screenSharer = userName;
        ackFunction(true);
    });

    // Handle screen sharing started
    socket.on('screenSharingStarted', ({ meetingId, userName, displayName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        socket.to(meetingId).emit('screenSharingStarted', {
            userName,
            displayName
        });
    });

    // Handle stop screen share
    socket.on('stopScreenShare', ({ meetingId, userName }) => {
        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        if (meeting.screenSharer === userName) {
            meeting.screenSharer = null;
        }
    });

    // Handle screen sharing stopped
    socket.on('screenSharingStopped', ({ meetingId, userName, displayName }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can stop screen sharing' });
            return;
        }

        const userToStop = meeting.participants.find(p => p.userName === targetUser);
        if (!userToStop) return;

        console.log(`Admin/Co-Host forcing stop screen share for ${userToStop.displayName}`);

        if (meeting.screenSharer === targetUser) {
            meeting.screenSharer = null;
        }

        io.to(userToStop.socketId).emit('forceStopScreenShare', {
            message: 'Host has stopped your screen sharing'
        });

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
};
