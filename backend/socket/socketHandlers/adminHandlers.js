// Admin and permission management handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Admin: Make someone a co-host
    socket.on('makeCoHost', ({ meetingId, userName: userToPromote }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || !requester.isAdmin) {
            socket.emit('error', { message: 'Only admin can assign co-hosts' });
            return;
        }

        const user = meeting.participants.find(p => p.userName === userToPromote);
        if (!user) return;

        user.isCoHost = true;
        user.permissions.canScreenShare = true;
        meeting.coHosts.push(userToPromote);

        io.to(user.socketId).emit('promotedToCoHost', {
            permissions: user.permissions
        });

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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can manage permissions' });
            return;
        }

        const user = meeting.participants.find(p => p.userName === targetUser);
        if (!user) return;

        user.permissions = { ...user.permissions, ...permissions };

        io.to(user.socketId).emit('permissionsUpdated', {
            permissions: user.permissions
        });

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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) {
            socket.emit('error', { message: 'Only admin or co-hosts can remove participants' });
            return;
        }

        const userToRemove = meeting.participants.find(p => p.userName === targetUser);
        if (!userToRemove || userToRemove.isAdmin) return;

        console.log(`Removing ${userToRemove.displayName} from meeting ${meetingId}`);

        meeting.participants = meeting.participants.filter(p => p.userName !== targetUser);
        meeting.coHosts = meeting.coHosts.filter(u => u !== targetUser);

        io.to(userToRemove.socketId).emit('removedFromMeeting', {
            message: 'You have been removed from the meeting by the host'
        });

        const removedSocketData = connectedSockets.get(userToRemove.socketId);
        if (removedSocketData) {
            removedSocketData.meetingId = null;
        }

        const removedSocket = io.sockets.sockets.get(userToRemove.socketId);
        if (removedSocket) {
            removedSocket.leave(meetingId);
        }

        socket.to(meetingId).emit('participantLeft', { userName: targetUser });
        socket.to(meetingId).emit('participantUpdate', {
            participants: meeting.participants
        });

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

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        meeting.settings.waitingRoomEnabled = enabled;
        console.log(`Waiting room ${enabled ? 'enabled' : 'disabled'} for meeting ${meetingId}`);
    });

    // Get meeting settings
    socket.on('getSettings', ({ meetingId }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        socket.emit('settingsUpdate', meeting.settings);
    });

    // Update default permissions
    socket.on('updateDefaultPermissions', ({ meetingId, permissions }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || (!requester.isAdmin && !requester.isCoHost)) return;

        meeting.settings.defaultPermissions = {
            canUnmute: permissions.canUnmute !== undefined ? permissions.canUnmute : true,
            canVideo: permissions.canVideo !== undefined ? permissions.canVideo : true,
            canScreenShare: permissions.canScreenShare !== undefined ? permissions.canScreenShare : false
        };
        
        console.log(`Default permissions updated for meeting ${meetingId}:`, meeting.settings.defaultPermissions);
    });

    // Apply permissions to all current participants
    socket.on('applyPermissionsToAll', ({ meetingId, permissions }) => {
        const meeting = meetings.get(meetingId);
        const socketData = connectedSockets.get(socket.id);
        
        if (!meeting || !socketData || socketData.meetingId !== meetingId) return;

        const requester = meeting.participants.find(p => p.socketId === socket.id);
        if (!requester || !requester.isAdmin) return;

        meeting.participants.forEach(participant => {
            if (!participant.isAdmin && !participant.isCoHost) {
                participant.permissions.canUnmute = permissions.canUnmute;
                participant.permissions.canVideo = permissions.canVideo;
                participant.permissions.canScreenShare = permissions.canScreenShare;
                
                io.to(participant.socketId).emit('permissionsUpdated', {
                    permissions: participant.permissions
                });
            }
        });

        io.to(meetingId).emit('participantsUpdate', {
            participants: meeting.participants
        });

        socket.emit('permissionsAppliedToAll');
        
        console.log(`Permissions applied to all participants in meeting ${meetingId}`);
    });
};
