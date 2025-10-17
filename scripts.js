let userName = null;
let displayName = null;
let currentMeetingId = null;
const password = "x";
let socket = null;

const localVideoEl = document.querySelector('#local-video');
const remoteVideosContainer = document.querySelector('#remote-videos-container');

let localStream; //a var to hold the local video stream
let peerConnections = {}; //store multiple peer connections
let didIOffer = false;

// Media state
let isVideoEnabled = true;
let isAudioEnabled = true;
let isScreenSharing = false;
let screenStream = null;
let screenPeerConnections = {}; // Separate peer connections for screen sharing

let peerConfiguration = {
    iceServers:[
        {
            urls:[
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

// Generate unique meeting ID
function generateMeetingId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Initialize socket connection
function initializeSocket() {
    userName = "user-" + Math.floor(Math.random() * 100000);
    socket = io.connect('https://172.22.240.1:8181/', {
    // socket = io.connect('https://localhost:8181/', {
        auth: {
            userName,
            password,
            displayName
        }
    });
    
    // Setup socket listeners
    setupSocketListeners();
}

// Create a new meeting
document.querySelector('#create-meeting').addEventListener('click', async () => {
    displayName = document.querySelector('#display-name').value.trim();
    if (!displayName) {
        alert('Please enter your display name');
        return;
    }
    
    currentMeetingId = generateMeetingId();
    initializeSocket();
    
    // Wait for socket to connect
    socket.on('connect', async () => {
        socket.emit('createMeeting', { meetingId: currentMeetingId, displayName });
        await showCallScreen();
    });
});

// Join an existing meeting
document.querySelector('#join-meeting').addEventListener('click', async () => {
    displayName = document.querySelector('#display-name').value.trim();
    currentMeetingId = document.querySelector('#meeting-id-input').value.trim().toUpperCase();
    
    if (!displayName) {
        alert('Please enter your display name');
        return;
    }
    
    if (!currentMeetingId) {
        alert('Please enter a meeting ID');
        return;
    }
    
    initializeSocket();
    
    // Wait for socket to connect
    socket.on('connect', () => {
        socket.emit('joinMeeting', { meetingId: currentMeetingId, displayName });
    });
});

// Show call screen
async function showCallScreen() {
    document.querySelector('#setup-screen').style.display = 'none';
    document.querySelector('#call-screen').style.display = 'block';
    document.querySelector('#user-name').innerHTML = displayName;
    document.querySelector('#current-meeting-id').innerHTML = currentMeetingId;
    
    await fetchUserMedia();
}

// Copy meeting ID to clipboard
document.querySelector('#copy-meeting-id').addEventListener('click', () => {
    navigator.clipboard.writeText(currentMeetingId);
    alert('Meeting ID copied to clipboard!');
});

// Leave meeting
document.querySelector('#hangup').addEventListener('click', () => {
    // Stop screen sharing if active
    if (isScreenSharing) {
        stopScreenSharing();
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    
    Object.values(peerConnections).forEach(pc => {
        if (pc) pc.close();
    });
    
    if (socket) {
        socket.emit('leaveMeeting', { meetingId: currentMeetingId });
        socket.disconnect();
    }
    
    location.reload();
});

// Toggle Video
document.querySelector('#toggle-video').addEventListener('click', () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        
        const btn = document.querySelector('#toggle-video');
        if (isVideoEnabled) {
            btn.innerHTML = '<i class="bi bi-camera-video-fill"></i> Camera On';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        } else {
            btn.innerHTML = '<i class="bi bi-camera-video-off-fill"></i> Camera Off';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
        
        // Notify other participants
        socket.emit('mediaStateChanged', {
            meetingId: currentMeetingId,
            userName: userName,
            isVideoEnabled,
            isAudioEnabled
        });
    }
});

// Toggle Audio
document.querySelector('#toggle-audio').addEventListener('click', () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !isAudioEnabled;
        audioTrack.enabled = isAudioEnabled;
        
        const btn = document.querySelector('#toggle-audio');
        if (isAudioEnabled) {
            btn.innerHTML = '<i class="bi bi-mic-fill"></i> Mic On';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
        } else {
            btn.innerHTML = '<i class="bi bi-mic-mute-fill"></i> Mic Off';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
        
        // Notify other participants
        socket.emit('mediaStateChanged', {
            meetingId: currentMeetingId,
            userName: userName,
            isVideoEnabled,
            isAudioEnabled
        });
    }
});

// Screen Sharing
document.querySelector('#share-screen').addEventListener('click', async () => {
    if (isScreenSharing) {
        // Stop screen sharing
        stopScreenSharing();
    } else {
        // Start screen sharing
        await startScreenSharing();
    }
});

async function startScreenSharing() {
    try {
        // Check if someone else is already sharing
        const canShare = await socket.emitWithAck('requestScreenShare', { 
            meetingId: currentMeetingId,
            userName: userName 
        });
        
        if (!canShare) {
            alert('Someone else is already sharing their screen. Only one person can share at a time.');
            return;
        }

        // Get screen stream
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: "always"
            },
            audio: false
        });

        // Show screen in local preview
        showLocalScreenShare();

        // Create new peer connections for screen sharing to all participants
        const meeting = await socket.emitWithAck('getParticipants', { meetingId: currentMeetingId });
        const otherParticipants = meeting.participants.filter(p => p.userName !== userName);
        
        for (const participant of otherParticipants) {
            await createScreenShareConnection(participant.userName);
        }

        // Update UI
        isScreenSharing = true;
        const btn = document.querySelector('#share-screen');
        btn.innerHTML = '<i class="bi bi-stop-circle"></i> Stop Sharing';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-warning');

        // Notify others
        socket.emit('screenSharingStarted', {
            meetingId: currentMeetingId,
            userName: userName,
            displayName: displayName
        });

        // Handle when user stops sharing via browser UI
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => {
            stopScreenSharing();
        };

    } catch (err) {
        console.error('Error starting screen share:', err);
        if (err.name === 'NotAllowedError') {
            alert('Screen sharing permission denied');
        }
        // Release the screen share lock if we got it
        socket.emit('stopScreenShare', { 
            meetingId: currentMeetingId,
            userName: userName 
        });
    }
}

function showLocalScreenShare() {
    // Create a local screen preview element
    let screenPreview = document.querySelector('#local-screen-preview');
    if (!screenPreview) {
        screenPreview = document.createElement('video');
        screenPreview.id = 'local-screen-preview';
        screenPreview.className = 'video-player';
        screenPreview.autoplay = true;
        screenPreview.playsinline = true;
        screenPreview.muted = true;
        
        const wrapper = document.createElement('div');
        wrapper.id = 'local-screen-wrapper';
        wrapper.className = 'video-wrapper';
        wrapper.innerHTML = '<div class="video-label">Your Screen</div>';
        wrapper.appendChild(screenPreview);
        
        const videoWrapper = document.querySelector('#video-wrapper');
        videoWrapper.parentElement.insertBefore(wrapper, videoWrapper.nextSibling);
    }
    screenPreview.srcObject = screenStream;
}

async function createScreenShareConnection(remoteUserName) {
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    screenPeerConnections[remoteUserName] = peerConnection;

    // Add screen track to the connection
    screenStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, screenStream);
    });

    peerConnection.addEventListener('icecandidate', e => {
        if (e.candidate) {
            socket.emit('sendScreenShareIceCandidate', {
                iceCandidate: e.candidate,
                targetUserName: remoteUserName,
                meetingId: currentMeetingId,
                fromUserName: userName
            });
        }
    });

    // Create and send offer for screen share
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('screenShareOffer', {
        offer,
        targetUserName: remoteUserName,
        meetingId: currentMeetingId,
        sharerUserName: userName,
        sharerDisplayName: displayName
    });
}

function stopScreenSharing() {
    if (!isScreenSharing) return;

    // Stop screen stream
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    // Close all screen share peer connections
    Object.values(screenPeerConnections).forEach(pc => {
        if (pc) pc.close();
    });
    screenPeerConnections = {};

    // Remove local screen preview
    const screenWrapper = document.querySelector('#local-screen-wrapper');
    if (screenWrapper) {
        screenWrapper.remove();
    }

    // Update UI
    isScreenSharing = false;
    const btn = document.querySelector('#share-screen');
    btn.innerHTML = '<i class="bi bi-display"></i> Share Screen';
    btn.classList.remove('btn-warning');
    btn.classList.add('btn-success');

    // Notify server and others
    socket.emit('stopScreenShare', {
        meetingId: currentMeetingId,
        userName: userName
    });

    socket.emit('screenSharingStopped', {
        meetingId: currentMeetingId,
        userName: userName,
        displayName: displayName
    });
}

// Chat functionality
document.querySelector('#send-message').addEventListener('click', () => {
    sendChatMessage();
});

document.querySelector('#chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    const input = document.querySelector('#chat-input');
    const message = input.value.trim();
    
    if (message && socket && currentMeetingId) {
        socket.emit('chatMessage', {
            meetingId: currentMeetingId,
            message: message,
            senderName: displayName,
            timestamp: new Date().toISOString()
        });
        
        // Display own message
        displayChatMessage({
            senderName: displayName,
            message: message,
            timestamp: new Date().toISOString(),
            isOwn: true
        });
        
        input.value = '';
    }
}

function displayChatMessage({ senderName, message, timestamp, isOwn = false }) {
    const chatMessages = document.querySelector('#chat-messages');
    const messageDiv = document.createElement('div');
    const isSystem = senderName === 'System';
    messageDiv.className = `chat-message mb-3 ${isSystem ? 'system-message' : (isOwn ? 'own-message' : 'other-message')}`;
    
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <strong class="chat-sender">${senderName}</strong>
            <small class="text-muted">${time}</small>
        </div>
        <div class="chat-text">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

//when a client initiates a call or joins
const call = async (targetUserName) => {
    //peerConnection is all set with our STUN servers sent over
    await createPeerConnection(targetUserName);

    //create offer time!
    try {
        console.log("Creating offer for", targetUserName);
        const offer = await peerConnections[targetUserName].createOffer();
        await peerConnections[targetUserName].setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', { 
            offer, 
            targetUserName,
            meetingId: currentMeetingId 
        });
    } catch(err) {
        console.log(err)
    }
}

const answerOffer = async(offerObj) => {
    const { offererUserName } = offerObj;
    await createPeerConnection(offererUserName, offerObj);
    const answer = await peerConnections[offererUserName].createAnswer({});
    await peerConnections[offererUserName].setLocalDescription(answer);
    
    offerObj.answer = answer;
    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
    offerIceCandidates.forEach(c => {
        peerConnections[offererUserName].addIceCandidate(c);
        console.log("======Added Ice Candidate======");
    });
}

const addAnswer = async(offerObj) => {
    const { answererUserName } = offerObj;
    if (peerConnections[answererUserName]) {
        await peerConnections[answererUserName].setRemoteDescription(offerObj.answer);
    }
}

const fetchUserMedia = () => {
    return new Promise(async(resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localVideoEl.srcObject = stream;
            localStream = stream;    
            resolve();    
        } catch(err) {
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (remoteUserName, offerObj) => {
    return new Promise(async(resolve, reject) => {
        const peerConnection = new RTCPeerConnection(peerConfiguration);
        peerConnections[remoteUserName] = peerConnection;

        // Create or get remote video element
        let remoteVideoEl = document.querySelector(`#remote-video-${remoteUserName}`);
        if (!remoteVideoEl) {
            remoteVideoEl = document.createElement('video');
            remoteVideoEl.id = `remote-video-${remoteUserName}`;
            remoteVideoEl.className = 'video-player';
            remoteVideoEl.autoplay = true;
            remoteVideoEl.playsinline = true;
            remoteVideoEl.controls = true;
            
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.innerHTML = `<div class="video-label">${offerObj?.offererDisplayName || remoteUserName}</div>`;
            wrapper.appendChild(remoteVideoEl);
            remoteVideosContainer.appendChild(wrapper);
        }

        const remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(peerConnection.signalingState);
        });

        peerConnection.addEventListener('icecandidate', e => {
            console.log('........Ice candidate found!......');
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                    remoteUserName,
                    meetingId: currentMeetingId
                });
            }
        });
        
        peerConnection.addEventListener('track', e => {
            console.log("Got a track from the other peer!!");
            e.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track, remoteStream);
            });
        });

        if (offerObj) {
            await peerConnection.setRemoteDescription(offerObj.offer);
        }
        resolve();
    });
}

const addNewIceCandidate = (iceCandidate, remoteUserName) => {
    if (peerConnections[remoteUserName]) {
        peerConnections[remoteUserName].addIceCandidate(iceCandidate);
        console.log("======Added Ice Candidate======");
    }
}

function updateParticipantsList(participants) {
    const participantsList = document.querySelector('#participants-list');
    participantsList.innerHTML = '';
    participants.forEach(p => {
        const participantEl = document.createElement('div');
        participantEl.className = 'badge bg-info me-2 mb-2';
        participantEl.textContent = p.displayName;
        participantsList.appendChild(participantEl);
    });
}