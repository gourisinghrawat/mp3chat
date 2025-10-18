// Raise hand handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Raise/lower hand
    socket.on('raiseHand', ({ meetingId, raised }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const participant = meeting.participants.find(p => p.socketId === socket.id);
        if (participant) {
            participant.handRaised = raised;
            
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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        const participant = meeting.participants.find(p => p.userName === targetUserName);
        if (participant) {
            participant.handRaised = false;
            
            io.to(meetingId).emit('participantsUpdate', {
                participants: meeting.participants
            });
            
            io.to(participant.socketId).emit('handLowered');
            
            console.log(`${requester.displayName} lowered ${participant.displayName}'s hand in meeting ${meetingId}`);
        }
    });
};
