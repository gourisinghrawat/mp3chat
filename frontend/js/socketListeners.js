
function setupSocketListeners() {
    socket.on('meetingJoined', async ({ participants, meetingId, isAdmin: adminStatus, permissions }) => {
        console.log('Joined meeting:', meetingId);
        isAdmin = adminStatus || false;
        userPermissions = permissions;
        await showCallScreen();
        updateParticipantsList(participants);
        
        // If there are other participants, initiate calls to them
        const otherParticipants = participants.filter(p => p.userName !== userName);
        for (const participant of otherParticipants) {
            await call(participant.userName);
        }
    });

    socket.on('waitingRoomJoined', ({ meetingId }) => {
        console.log('In waiting room for meeting:', meetingId);
        showWaitingRoom();
    });

    socket.on('admittedToMeeting', async ({ participants, meetingId, isAdmin: adminStatus, permissions }) => {
        console.log('Admitted to meeting:', meetingId);
        isAdmin = adminStatus || false;
        userPermissions = permissions;
        await showCallScreen();
        updateParticipantsList(participants);
        
        // Initiate calls to other participants
        const otherParticipants = participants.filter(p => p.userName !== userName);
        for (const participant of otherParticipants) {
            await call(participant.userName);
        }
    });

    socket.on('deniedEntry', ({ message }) => {
        alert(message);
        location.reload();
    });

    socket.on('waitingRoomUpdate', ({ waitingRoom }) => {
        if (isAdmin || isCoHost) {
            updateWaitingRoomList(waitingRoom);
        }
    });

    socket.on('promotedToCoHost', ({ permissions }) => {
        isCoHost = true;
        userPermissions = permissions;
        const badge = document.querySelector('#role-badge');
        badge.textContent = 'Co-Host';
        badge.className = 'badge bg-warning ms-2';
        badge.style.display = 'inline';
        // Show waiting room tab and button for co-host
        document.querySelector('#waiting-room-tab').style.display = 'block';
        document.querySelector('#toggle-waiting-room').style.display = 'flex';
        displayChatMessage({
            senderName: 'System',
            message: 'You have been promoted to Co-Host',
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    socket.on('promotedToAdmin', ({ permissions }) => {
        isAdmin = true;
        userPermissions = permissions;
        const badge = document.querySelector('#role-badge');
        badge.textContent = 'Admin';
        badge.className = 'badge bg-danger ms-2';
        badge.style.display = 'inline';
        // Show waiting room tab and button for admin
        document.querySelector('#waiting-room-tab').style.display = 'block';
        document.querySelector('#toggle-waiting-room').style.display = 'flex';
        displayChatMessage({
            senderName: 'System',
            message: 'You have been promoted to Admin',
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    socket.on('permissionsUpdated', ({ permissions }) => {
        userPermissions = permissions;
        
        // If audio permission disabled, mute the user
        if (!permissions.canUnmute && isAudioEnabled && localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = false);
            isAudioEnabled = false;
            const audioBtn = document.querySelector('#toggle-audio');
            const audioBtnIcon = audioBtn.querySelector('i');
            const audioBtnLabel = audioBtn.querySelector('.control-label');
            audioBtnIcon.className = 'bi bi-mic-mute-fill';
            audioBtnLabel.textContent = 'Unmute';
            audioBtn.classList.add('muted');
        }
        
        // If video permission disabled, turn off camera
        if (!permissions.canVideo && isVideoEnabled && localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = false);
            isVideoEnabled = false;
            const videoBtn = document.querySelector('#toggle-video');
            const videoBtnIcon = videoBtn.querySelector('i');
            const videoBtnLabel = videoBtn.querySelector('.control-label');
            videoBtnIcon.className = 'bi bi-camera-video-off-fill';
            videoBtnLabel.textContent = 'Start video';
            videoBtn.classList.add('off');
        }
        
        displayChatMessage({
            senderName: 'System',
            message: 'Your permissions have been updated',
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    socket.on('removedFromMeeting', ({ message }) => {
        alert(message);
        // Disconnect and reload
        if (socket) {
            socket.disconnect();
        }
        // Clear local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        // Reload the page to go back to setup
        window.location.reload();
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
        const videoTile = document.querySelector(`#video-tile-${leftUserName}`);
        if (videoTile) {
            videoTile.remove();
        }
    });

    socket.on('participantsUpdate', ({ participants }) => {
        updateParticipantsList(participants);
        updateHandRaisedIndicators(participants);
    });

    socket.on('handLowered', () => {
        // Admin lowered your hand
        isHandRaised = false;
        const raiseHandBtn = document.querySelector('#raise-hand');
        const icon = raiseHandBtn.querySelector('i');
        const label = raiseHandBtn.querySelector('.control-label');
        
        raiseHandBtn.classList.remove('active');
        icon.classList.remove('bi-hand-index-thumb-fill');
        icon.classList.add('bi-hand-index-thumb');
        label.textContent = 'Raise';
        
        // Update local video tile indicator
        updateLocalHandIndicator();
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
        
        // Remove the shared screen video tile
        const screenTile = document.querySelector(`#video-tile-screen-${sharerUserName}`);
        if (screenTile) {
            screenTile.remove();
        }
        
        displayChatMessage({
            senderName: 'System',
            message: `${sharerDisplayName} stopped sharing their screen`,
            timestamp: new Date().toISOString(),
            isOwn: false
        });
    });

    socket.on('forceStopScreenShare', ({ message }) => {
        alert(message);
        // Stop screen sharing if currently sharing
        if (isScreenSharing) {
            stopScreenSharing();
        }
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

    // Create screen share video tile
    const videoGrid = document.querySelector('#video-grid');
    let screenTile = document.querySelector(`#video-tile-screen-${sharerUserName}`);
    
    if (!screenTile) {
        screenTile = document.createElement('div');
        screenTile.className = 'video-tile screen-share';
        screenTile.id = `video-tile-screen-${sharerUserName}`;
        
        const remoteScreenEl = document.createElement('video');
        remoteScreenEl.id = `screen-share-${sharerUserName}`;
        remoteScreenEl.className = 'video-player';
        remoteScreenEl.autoplay = true;
        remoteScreenEl.playsinline = true;
        
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.innerHTML = `
            <div class="video-label">
                <i class="bi bi-display"></i> ${sharerDisplayName}'s Screen
            </div>
        `;
        
        screenTile.appendChild(remoteScreenEl);
        screenTile.appendChild(overlay);
        videoGrid.insertBefore(screenTile, videoGrid.firstChild);
    }
    
    const remoteScreenEl = document.querySelector(`#screen-share-${sharerUserName}`);

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
    // Update audio icon
    const audioIcon = document.querySelector(`#audio-icon-${remoteUserName}`);
    if (audioIcon) {
        audioIcon.className = isAudioEnabled ? 'video-icon bi bi-mic-fill' : 'video-icon bi bi-mic-mute-fill muted';
    }
    
    // Update video icon
    const videoIcon = document.querySelector(`#video-icon-${remoteUserName}`);
    if (videoIcon) {
        videoIcon.className = isVideoEnabled ? 'video-icon bi bi-camera-video-fill' : 'video-icon bi bi-camera-video-off-fill muted';
    }
}

// Settings event listeners
socket.on('settingsUpdate', (settings) => {
    currentMeetingSettings = settings;
    
    // Update UI toggles
    document.querySelector('#waiting-room-toggle').checked = settings.waitingRoomEnabled;
    document.querySelector('#default-audio-permission').checked = settings.defaultPermissions.canUnmute;
    document.querySelector('#default-video-permission').checked = settings.defaultPermissions.canVideo;
    document.querySelector('#default-screenshare-permission').checked = settings.defaultPermissions.canScreenShare;
});

socket.on('permissionsAppliedToAll', () => {
    alert('Permissions have been applied to all participants');
    document.querySelector('#settings-modal').style.display = 'none';
});