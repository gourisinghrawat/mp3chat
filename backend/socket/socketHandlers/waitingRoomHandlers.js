// Waiting room handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Admin: Admit user from waiting room
    socket.on('admitFromWaitingRoom', ({ meetingId, userName: userToAdmit }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can admit users' });
            return;
        }

        const userIndex = meeting.waitingRoom.findIndex(u => u.userName === userToAdmit);
        if (userIndex === -1) return;

        const user = meeting.waitingRoom[userIndex];
        meeting.waitingRoom.splice(userIndex, 1);

        const defaultPerms = meeting.settings.defaultPermissions || {
            canUnmute: true,
            canVideo: true,
            canScreenShare: false
        };
        
        meeting.participants.push({
            userName: user.userName,
            socketId: user.socketId,
            displayName: user.displayName,
            isAdmin: false,
            isCoHost: false,
            handRaised: false,
            permissions: {
                canUnmute: defaultPerms.canUnmute,
                canVideo: defaultPerms.canVideo,
                canScreenShare: defaultPerms.canScreenShare
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

        const userSocket = io.sockets.sockets.get(user.socketId);
        if (userSocket) {
            userSocket.join(meetingId);
        }

        socket.to(meetingId).emit('newParticipant', {
            participant: { userName: user.userName, displayName: user.displayName }
        });

        io.to(meetingId).emit('participantsUpdate', { 
            participants: meeting.participants 
        });

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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        const userIndex = meeting.waitingRoom.findIndex(u => u.userName === userToDeny);
        if (userIndex === -1) return;

        const user = meeting.waitingRoom[userIndex];
        meeting.waitingRoom.splice(userIndex, 1);

        io.to(user.socketId).emit('deniedEntry', { message: 'The host denied your entry to the meeting' });

        const adminParticipant = meeting.participants.find(p => p.isAdmin);
        if (adminParticipant) {
            io.to(adminParticipant.socketId).emit('waitingRoomUpdate', {
                waitingRoom: meeting.waitingRoom
            });
        }

        const userSocket = io.sockets.sockets.get(user.socketId);
        if (userSocket) {
            userSocket.disconnect();
        }
    });
};
