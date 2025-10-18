// WebRTC signaling handlers
module.exports = (socket, io, meetings, connectedSockets) => {
    // Handle new offer
    socket.on('newOffer', ({ offer, targetUserName, meetingId }) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData || socketData.meetingId !== meetingId) return;

        const meeting = meetings.get(meetingId);
        if (!meeting) return;

        const targetParticipant = meeting.participants.find(p => p.userName === targetUserName);
        if (!targetParticipant) return;

        const userName = socketData.userName;
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

        io.to(targetParticipant.socketId).emit('newOffer', meeting.offers[offerKey]);
    });

    // Handle answer
    socket.on('newAnswer', (offerObj, ackFunction) => {
        const socketData = connectedSockets.get(socket.id);
        if (!socketData) return;

        const meeting = meetings.get(socketData.meetingId);
        if (!meeting) return;

        const userName = socketData.userName;
        const offerKey = `${offerObj.offererUserName}-${userName}`;
        const offerToUpdate = meeting.offers[offerKey];
        
        if (!offerToUpdate) return;

        const offererParticipant = meeting.participants.find(p => p.userName === offerObj.offererUserName);
        if (!offererParticipant) return;

        ackFunction(offerToUpdate.offerIceCandidates);
        
        offerToUpdate.answer = offerObj.answer;
        offerToUpdate.answererUserName = userName;
        offerToUpdate.answererDisplayName = socketData.displayName;

        io.to(offererParticipant.socketId).emit('answerResponse', offerToUpdate);
    });

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
};
