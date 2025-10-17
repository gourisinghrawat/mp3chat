
function setupSocketListeners() {
    socket.on('meetingJoined', async ({ participants, meetingId }) => {
        console.log('Joined meeting:', meetingId);
        await showCallScreen();
        updateParticipantsList(participants);
        
        // If there are other participants, initiate calls to them
        const otherParticipants = participants.filter(p => p.userName !== userName);
        for (const participant of otherParticipants) {
            await call(participant.userName);
        }
    });

    socket.on('meetingError', (error) => {
        alert(error.message);
    });

    socket.on('newParticipant', async ({ participant }) => {
        console.log('New participant joined:', participant);
        // The new participant will initiate the call to existing participants
    });

    socket.on('participantLeft', ({ userName: leftUserName }) => {
        console.log('Participant left:', leftUserName);
        if (peerConnections[leftUserName]) {
            peerConnections[leftUserName].close();
            delete peerConnections[leftUserName];
        }
        const videoEl = document.querySelector(`#remote-video-${leftUserName}`);
        if (videoEl && videoEl.parentElement) {
            videoEl.parentElement.remove();
        }
    });

    socket.on('participantsUpdate', ({ participants }) => {
        updateParticipantsList(participants);
    });

    socket.on('newOffer', async (offerObj) => {
        console.log('Received offer from:', offerObj.offererUserName);
        await answerOffer(offerObj);
    });

    socket.on('answerResponse', offerObj => {
        console.log('Received answer from:', offerObj.answererUserName);
        addAnswer(offerObj);
    });

    socket.on('receivedIceCandidateFromServer', ({ iceCandidate, remoteUserName }) => {
        addNewIceCandidate(iceCandidate, remoteUserName);
    });

    socket.on('chatMessage', (messageData) => {
        displayChatMessage({
            senderName: messageData.senderName,
            message: messageData.message,
            timestamp: messageData.timestamp,
            isOwn: false
        });
    });

    socket.on('mediaStateChanged', ({ userName: remoteUserName, isVideoEnabled, isAudioEnabled }) => {
        console.log(`Media state changed for ${remoteUserName}: video=${isVideoEnabled}, audio=${isAudioEnabled}`);
        updateParticipantMediaState(remoteUserName, isVideoEnabled, isAudioEnabled);
    });

    socket.on('screenSharingStarted', ({ userName: sharerUserName, displayName: sharerDisplayName }) => {
        console.log(`${sharerDisplayName} started screen sharing`);
        displayChatMessage({
            senderName: 'System',
            message: `${sharerDisplayName} started sharing their screen`,
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    socket.on('screenSharingStopped', ({ userName: sharerUserName, displayName: sharerDisplayName }) => {
        console.log(`${sharerDisplayName} stopped screen sharing`);
        
        // Remove the shared screen video
        const screenVideoEl = document.querySelector(`#screen-share-${sharerUserName}`);
        if (screenVideoEl && screenVideoEl.parentElement) {
            screenVideoEl.parentElement.remove();
        }
        
        displayChatMessage({
            senderName: 'System',
            message: `${sharerDisplayName} stopped sharing their screen`,
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    // Handle screen share offer
    socket.on('screenShareOffer', async (offerObj) => {
        console.log('Received screen share offer from:', offerObj.sharerUserName);
        await answerScreenShareOffer(offerObj);
    });

    // Handle screen share answer
    socket.on('screenShareAnswer', async (answerObj) => {
        console.log('Received screen share answer from:', answerObj.answererUserName);
        const pc = screenPeerConnections[answerObj.answererUserName];
        if (pc) {
            await pc.setRemoteDescription(answerObj.answer);
            // Add any queued ICE candidates
            if (answerObj.iceCandidates) {
                answerObj.iceCandidates.forEach(candidate => {
                    pc.addIceCandidate(candidate);
                });
            }
        }
    });

    // Handle screen share ICE candidates
    socket.on('screenShareIceCandidate', ({ iceCandidate, fromUserName }) => {
        const pc = screenPeerConnections[fromUserName];
        if (pc) {
            pc.addIceCandidate(iceCandidate);
        }
    });
}

async function answerScreenShareOffer(offerObj) {
    const { sharerUserName, sharerDisplayName, offer } = offerObj;
    
    // Create peer connection for receiving screen share
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    screenPeerConnections[sharerUserName] = peerConnection;

    // Create or get remote screen video element
    let remoteScreenEl = document.querySelector(`#screen-share-${sharerUserName}`);
    if (!remoteScreenEl) {
        remoteScreenEl = document.createElement('video');
        remoteScreenEl.id = `screen-share-${sharerUserName}`;
        remoteScreenEl.className = 'video-player screen-share-video';
        remoteScreenEl.autoplay = true;
        remoteScreenEl.playsinline = true;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper screen-share-wrapper';
        wrapper.innerHTML = `<div class="video-label">${sharerDisplayName}'s Screen</div>`;
        wrapper.appendChild(remoteScreenEl);
        remoteVideosContainer.appendChild(wrapper);
    }

    const remoteStream = new MediaStream();
    remoteScreenEl.srcObject = remoteStream;

    peerConnection.addEventListener('track', e => {
        console.log("Got screen share track");
        e.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track, remoteStream);
        });
    });

    peerConnection.addEventListener('icecandidate', e => {
        if (e.candidate) {
            socket.emit('sendScreenShareIceCandidate', {
                iceCandidate: e.candidate,
                targetUserName: sharerUserName,
                meetingId: currentMeetingId,
                fromUserName: userName
            });
        }
    });

    // Set remote description and create answer
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer back
    socket.emit('screenShareAnswer', {
        answer,
        sharerUserName,
        answererUserName: userName,
        meetingId: currentMeetingId
    });
}

function updateParticipantMediaState(remoteUserName, isVideoEnabled, isAudioEnabled) {
    const videoEl = document.querySelector(`#remote-video-${remoteUserName}`);
    if (videoEl && videoEl.parentElement) {
        const wrapper = videoEl.parentElement;
        let statusDiv = wrapper.querySelector('.media-status');
        
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.className = 'media-status';
            wrapper.appendChild(statusDiv);
        }
        
        let statusText = '';
        if (!isVideoEnabled) statusText += '<i class="bi bi-camera-video-off-fill"></i> ';
        if (!isAudioEnabled) statusText += '<i class="bi bi-mic-mute-fill"></i>';
        
        statusDiv.innerHTML = statusText;
        statusDiv.style.display = (!isVideoEnabled || !isAudioEnabled) ? 'block' : 'none';
    }
}