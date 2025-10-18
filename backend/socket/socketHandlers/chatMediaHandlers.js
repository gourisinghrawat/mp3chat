// Chat and media state handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Handle chat messages
    socket.on('chatMessage', ({ meetingId, message, senderName, timestamp }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

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

        socket.to(meetingId).emit('mediaStateChanged', {
            userName,
            isVideoEnabled,
            isAudioEnabled
        });
    });
};
