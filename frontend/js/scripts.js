let userName = null;
let displayName = null;
let currentMeetingId = null;
const password = "x";
let socket = null;
let isAdmin = false;
let isCoHost = false;
let userPermissions = {
    canUnmute: true,
    canVideo: true,
    canScreenShare: false
};

// Check URL for meeting ID on page load
let urlMeetingId = null;
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('meeting')) {
    urlMeetingId = urlParams.get('meeting').toUpperCase();
}
// Also check for meeting ID in path (e.g., /ABC123XY)
const pathMatch = window.location.pathname.match(/\/([A-Z0-9]{8})$/i);
if (pathMatch) {
    urlMeetingId = pathMatch[1].toUpperCase();
}

let localVideoEl = null;
const videoGrid = document.querySelector('#video-grid');

let localStream; //a var to hold the local video stream
let peerConnections = {}; //store multiple peer connections
let didIOffer = false;

// Media state
let isVideoEnabled = true;
let isAudioEnabled = true;
let isScreenSharing = false;
let screenStream = null;
let screenPeerConnections = {}; // Separate peer connections for screen sharing

// Chat notification state
let unreadMessages = 0;
let isChatOpen = false;

// Store participants for admin controls
let currentParticipants = [];

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

// Update URL with meeting ID
function updateURLWithMeetingId(meetingId) {
    const newUrl = `${window.location.origin}/${meetingId}`;
    window.history.pushState({ meetingId }, `Meeting ${meetingId}`, newUrl);
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
    
    // Update URL with meeting ID
    updateURLWithMeetingId(currentMeetingId);
    
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
    const userEmail = document.querySelector('#user-email').value.trim();
    currentMeetingId = document.querySelector('#meeting-id-input').value.trim().toUpperCase();
    
    if (!displayName) {
        alert('Please enter your display name');
        return;
    }
    
    if (!userEmail) {
        alert('Please enter your email address');
        return;
    }
    
    if (!currentMeetingId) {
        alert('Please enter a meeting ID');
        return;
    }
    
    // Check if this is a scheduled meeting and if user is the host
    try {
        const response = await fetch(`/api/meetings/${currentMeetingId}`);
        const data = await response.json();
        
        if (data.success && data.meeting) {
            const meeting = data.meeting;
            
            // Check if user is the host
            if (meeting.hostEmail.toLowerCase() === userEmail.toLowerCase()) {
                // User is the host - check meeting status
                if (meeting.status === 'scheduled') {
                    // Meeting not started yet - prompt to start
                    if (confirm(`You are the host of this meeting: "${meeting.title}"\n\nWould you like to start the meeting now?`)) {
                        // Start the meeting
                        const startResponse = await fetch(`/api/meetings/${currentMeetingId}/start`, {
                            method: 'PATCH'
                        });
                        const startData = await startResponse.json();
                        
                        if (!startData.success) {
                            alert('Failed to start meeting. Please try again.');
                            return;
                        }
                        
                        // Continue to join as host
                        isAdmin = true;
                    } else {
                        return; // Host declined to start
                    }
                } else if (meeting.status === 'completed') {
                    alert('This meeting has already ended.');
                    return;
                } else if (meeting.status === 'cancelled') {
                    alert('This meeting has been cancelled.');
                    return;
                }
                // If status is 'ongoing', host can join normally
                isAdmin = true;
            } else {
                // User is not the host - check if they're a participant
                const isParticipant = meeting.participants?.some(p => 
                    p.email.toLowerCase() === userEmail.toLowerCase()
                );
                
                if (meeting.status === 'scheduled') {
                    alert('This meeting has not started yet. Please wait for the host to start the meeting.');
                    return;
                } else if (meeting.status === 'completed') {
                    alert('This meeting has already ended.');
                    return;
                } else if (meeting.status === 'cancelled') {
                    alert('This meeting has been cancelled.');
                    return;
                }
                
                if (!isParticipant && meeting.participants && meeting.participants.length > 0) {
                    const confirmJoin = confirm('You are not listed as a participant for this meeting. Do you still want to join?');
                    if (!confirmJoin) {
                        return;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Meeting not found in database, treating as instant meeting');
        // If meeting not found, it's an instant meeting - proceed normally
    }
    
    // Update URL with meeting ID
    updateURLWithMeetingId(currentMeetingId);
    
    initializeSocket();
    
    // Wait for socket to connect
    socket.on('connect', () => {
        socket.emit('joinMeeting', { meetingId: currentMeetingId, displayName, email: userEmail });
    });
});

// Show call screen
async function showCallScreen() {
    document.querySelector('#setup-screen').style.display = 'none';
    document.querySelector('#waiting-room-screen').style.display = 'none';
    document.querySelector('#call-screen').style.display = 'flex';
    document.querySelector('#user-name-display').innerHTML = displayName;
    document.querySelector('#current-meeting-id').innerHTML = currentMeetingId;
    
    // Show settings button for admin and co-hosts
    if (isAdmin || isCoHost) {
        document.querySelector('#settings-btn').style.display = 'flex';
    }
    
    // Show role badge and waiting room tab
    if (isAdmin) {
        const badge = document.querySelector('#role-badge');
        badge.textContent = 'Admin';
        badge.className = 'badge bg-danger ms-2';
        badge.style.display = 'inline';
        // Show waiting room tab and button for admin
        document.querySelector('#waiting-room-tab').style.display = 'block';
        document.querySelector('#toggle-waiting-room').style.display = 'flex';
    } else if (isCoHost) {
        const badge = document.querySelector('#role-badge');
        badge.textContent = 'Co-Host';
        badge.className = 'badge bg-warning ms-2';
        badge.style.display = 'inline';
        // Show waiting room tab and button for co-host
        document.querySelector('#waiting-room-tab').style.display = 'block';
        document.querySelector('#toggle-waiting-room').style.display = 'flex';
    }
    
    await fetchUserMedia();
    addVideoToGrid(userName, displayName, true);
}

// Add video to grid
function addVideoToGrid(videoUserName, displayName, isLocal = false, participantData = null) {
    const videoGrid = document.querySelector('#video-grid');
    const existingTile = document.querySelector(`#video-tile-${videoUserName}`);
    
    if (existingTile) return;
    
    const videoTile = document.createElement('div');
    videoTile.className = 'video-tile';
    videoTile.id = `video-tile-${videoUserName}`;
    
    const video = document.createElement('video');
    video.id = isLocal ? 'local-video' : `remote-video-${videoUserName}`;
    video.className = 'video-player';
    video.autoplay = true;
    video.playsinline = true;
    if (isLocal) video.muted = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    
    // Check if we should show admin controls
    const showAdminControls = (isAdmin || isCoHost) && !isLocal && participantData && !participantData.isAdmin;
    
    // Determine role badge
    let roleBadge = '';
    if (isLocal) {
        if (isAdmin) {
            roleBadge = '<span class="video-role-badge admin-badge">Admin</span>';
        } else if (isCoHost) {
            roleBadge = '<span class="video-role-badge cohost-badge">Co-Host</span>';
        }
    } else if (participantData) {
        if (participantData.isAdmin) {
            roleBadge = '<span class="video-role-badge admin-badge">Admin</span>';
        } else if (participantData.isCoHost) {
            roleBadge = '<span class="video-role-badge cohost-badge">Co-Host</span>';
        }
    }
    
    // Check if hand is raised (for local or remote)
    const handRaised = isLocal ? isHandRaised : (participantData?.handRaised || false);
    
    overlay.innerHTML = `
        <div class="video-label">
            <div class="video-name-container">
                <span class="video-display-name">${displayName}${isLocal ? ' (You)' : ''}</span>
                ${roleBadge}
                ${handRaised ? '<i class="bi bi-hand-index-thumb-fill hand-raised-icon" title="Hand raised"></i>' : ''}
            </div>
            ${showAdminControls ? `
                <div class="video-admin-menu">
                    <button class="video-menu-btn" data-username="${videoUserName}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <div class="video-menu-dropdown" id="video-menu-${videoUserName}" style="display: none;">
                        ${isAdmin && participantData && !participantData.isCoHost ? `<div class="video-menu-item make-cohost-video" data-username="${videoUserName}">
                            <i class="bi bi-star-fill"></i> Make Co-Host
                        </div>` : ''}
                        ${participantData?.handRaised ? `<div class="video-menu-item lower-hand-video" data-username="${videoUserName}">
                            <i class="bi bi-hand-index-thumb"></i> Lower Hand
                        </div>` : ''}
                        <div class="video-menu-item toggle-audio-video" data-username="${videoUserName}">
                            <i class="bi bi-mic${participantData?.permissions?.canUnmute ? '-mute' : ''}"></i> 
                            ${participantData?.permissions?.canUnmute ? 'Disable' : 'Enable'} Audio
                        </div>
                        <div class="video-menu-item toggle-video-video" data-username="${videoUserName}">
                            <i class="bi bi-camera-video${participantData?.permissions?.canVideo ? '-off' : ''}"></i> 
                            ${participantData?.permissions?.canVideo ? 'Disable' : 'Enable'} Video
                        </div>
                        <div class="video-menu-item toggle-screenshare-video" data-username="${videoUserName}">
                            <i class="bi bi-display"></i> 
                            ${participantData?.permissions?.canScreenShare ? 'Disable' : 'Enable'} Screen Share
                        </div>
                        <div class="video-menu-item stop-screenshare-video" data-username="${videoUserName}">
                            <i class="bi bi-stop-circle"></i> Stop Screen Sharing
                        </div>
                        <div class="menu-divider"></div>
                        <div class="video-menu-item remove-participant-video" data-username="${videoUserName}">
                            <i class="bi bi-x-circle"></i> Remove from Meeting
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="video-controls">
            <i class="video-icon bi bi-mic-fill" id="audio-icon-${videoUserName}"></i>
            <i class="video-icon bi bi-camera-video-fill" id="video-icon-${videoUserName}"></i>
        </div>
    `;
    
    videoTile.appendChild(video);
    videoTile.appendChild(overlay);
    videoGrid.appendChild(videoTile);
    
    if (isLocal && localStream) {
        video.srcObject = localStream;
    }
    
    // Add event listeners for admin controls
    if (showAdminControls) {
        setTimeout(() => {
            const menuBtn = videoTile.querySelector('.video-menu-btn');
            if (menuBtn) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const menu = document.querySelector(`#video-menu-${videoUserName}`);
                    
                    // Close all other menus
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => {
                        if (m !== menu) m.style.display = 'none';
                    });
                    
                    // Toggle current menu
                    if (menu.style.display === 'none' || !menu.style.display) {
                        // Position menu like YouTube
                        const btnRect = menuBtn.getBoundingClientRect();
                        const menuWidth = 220;
                        const menuMaxHeight = 400;
                        
                        // Calculate position
                        let left = btnRect.right + 8; // 8px gap to the right
                        let top = btnRect.top;
                        
                        // Check if menu would go off right edge
                        if (left + menuWidth > window.innerWidth) {
                            left = btnRect.left - menuWidth - 8; // Position to the left
                        }
                        
                        // Check if menu would go off bottom edge
                        if (top + menuMaxHeight > window.innerHeight) {
                            top = Math.max(10, window.innerHeight - menuMaxHeight - 10);
                        }
                        
                        // Check if menu would go off top edge
                        if (top < 10) {
                            top = 10;
                        }
                        
                        menu.style.left = left + 'px';
                        menu.style.top = top + 'px';
                        menu.style.display = 'block';
                    } else {
                        menu.style.display = 'none';
                    }
                });
            }
            
            // Add action listeners
            videoTile.querySelectorAll('.make-cohost-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetUser = e.currentTarget.dataset.username;
                    socket.emit('makeCoHost', { meetingId: currentMeetingId, userName: targetUser });
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                });
            });
            
            videoTile.querySelectorAll('.lower-hand-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetUser = e.currentTarget.dataset.username;
                    socket.emit('lowerHand', { meetingId: currentMeetingId, userName: targetUser });
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                });
            });
            
            videoTile.querySelectorAll('.toggle-audio-video, .toggle-video-video, .toggle-screenshare-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetUser = e.currentTarget.dataset.username;
                    const permission = e.currentTarget.classList.contains('toggle-audio-video') ? 'canUnmute' :
                                      e.currentTarget.classList.contains('toggle-video-video') ? 'canVideo' : 'canScreenShare';
                    
                    const newValue = !participantData.permissions[permission];
                    
                    socket.emit('updateUserPermissions', {
                        meetingId: currentMeetingId,
                        userName: targetUser,
                        permissions: { [permission]: newValue }
                    });
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                });
            });
            
            videoTile.querySelectorAll('.stop-screenshare-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetUser = e.currentTarget.dataset.username;
                    
                    if (confirm(`Stop screen sharing for ${displayName}?`)) {
                        socket.emit('forceStopScreenShare', { meetingId: currentMeetingId, userName: targetUser });
                        document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                    }
                });
            });
            
            videoTile.querySelectorAll('.remove-participant-video').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetUser = e.currentTarget.dataset.username;
                    
                    if (confirm(`Remove ${displayName} from the meeting?`)) {
                        socket.emit('removeParticipant', { meetingId: currentMeetingId, userName: targetUser });
                        document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                    }
                });
            });
        }, 100);
    }
}

// Update video menus with current participant data
function updateVideoMenus(participants) {
    participants.forEach(participant => {
        const menu = document.querySelector(`#video-menu-${participant.userName}`);
        if (!menu) return;
        
        const isCurrentUserAdmin = isAdmin;
        const showMakeCoHost = isCurrentUserAdmin && !participant.isCoHost;
        
        // Update menu items
        menu.innerHTML = `
            ${showMakeCoHost ? `<div class="video-menu-item make-cohost-video" data-username="${participant.userName}">
                <i class="bi bi-star-fill"></i> Make Co-Host
            </div>` : ''}
            ${participant.handRaised ? `<div class="video-menu-item lower-hand-video" data-username="${participant.userName}">
                <i class="bi bi-hand-index-thumb"></i> Lower Hand
            </div>` : ''}
            <div class="video-menu-item toggle-audio-video" data-username="${participant.userName}">
                <i class="bi bi-mic${participant.permissions?.canUnmute ? '-mute' : ''}"></i> 
                ${participant.permissions?.canUnmute ? 'Disable' : 'Enable'} Audio
            </div>
            <div class="video-menu-item toggle-video-video" data-username="${participant.userName}">
                <i class="bi bi-camera-video${participant.permissions?.canVideo ? '-off' : ''}"></i> 
                ${participant.permissions?.canVideo ? 'Disable' : 'Enable'} Video
            </div>
            <div class="video-menu-item toggle-screenshare-video" data-username="${participant.userName}">
                <i class="bi bi-display"></i> 
                ${participant.permissions?.canScreenShare ? 'Disable' : 'Enable'} Screen Share
            </div>
            <div class="video-menu-item stop-screenshare-video" data-username="${participant.userName}">
                <i class="bi bi-stop-circle"></i> Stop Screen Sharing
            </div>
            <div class="menu-divider"></div>
            <div class="video-menu-item remove-participant-video" data-username="${participant.userName}">
                <i class="bi bi-x-circle"></i> Remove from Meeting
            </div>
        `;
        
        // Re-attach event listeners
        menu.querySelectorAll('.make-cohost-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUser = e.currentTarget.dataset.username;
                socket.emit('makeCoHost', { meetingId: currentMeetingId, userName: targetUser });
                document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
            });
        });
        
        menu.querySelectorAll('.lower-hand-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUser = e.currentTarget.dataset.username;
                socket.emit('lowerHand', { meetingId: currentMeetingId, userName: targetUser });
                document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
            });
        });
        
        menu.querySelectorAll('.toggle-audio-video, .toggle-video-video, .toggle-screenshare-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUser = e.currentTarget.dataset.username;
                const permission = e.currentTarget.classList.contains('toggle-audio-video') ? 'canUnmute' :
                                  e.currentTarget.classList.contains('toggle-video-video') ? 'canVideo' : 'canScreenShare';
                
                const newValue = !participant.permissions[permission];
                
                socket.emit('updateUserPermissions', {
                    meetingId: currentMeetingId,
                    userName: targetUser,
                    permissions: { [permission]: newValue }
                });
                document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
            });
        });
        
        menu.querySelectorAll('.stop-screenshare-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUser = e.currentTarget.dataset.username;
                
                if (confirm(`Stop screen sharing for ${participant.displayName}?`)) {
                    socket.emit('forceStopScreenShare', { meetingId: currentMeetingId, userName: targetUser });
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                }
            });
        });
        
        menu.querySelectorAll('.remove-participant-video').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetUser = e.currentTarget.dataset.username;
                
                if (confirm(`Remove ${participant.displayName} from the meeting?`)) {
                    socket.emit('removeParticipant', { meetingId: currentMeetingId, userName: targetUser });
                    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
                }
            });
        });
    });
}

// Update hand raised indicators on video tiles
function updateHandRaisedIndicators(participants) {
    participants.forEach(participant => {
        const videoTile = document.querySelector(`#video-tile-${participant.userName}`);
        if (!videoTile) return;
        
        const videoNameContainer = videoTile.querySelector('.video-name-container');
        if (!videoNameContainer) return;
        
        // Remove existing hand icon if present
        const existingHandIcon = videoNameContainer.querySelector('.hand-raised-icon');
        if (existingHandIcon) {
            existingHandIcon.remove();
        }
        
        // Add hand icon if hand is raised
        if (participant.handRaised) {
            const handIcon = document.createElement('i');
            handIcon.className = 'bi bi-hand-index-thumb-fill hand-raised-icon';
            handIcon.title = 'Hand raised';
            videoNameContainer.appendChild(handIcon);
        }
    });
}

// Update local user's hand raised indicator
function updateLocalHandIndicator() {
    const localTile = document.querySelector(`#video-tile-${userName}`);
    if (!localTile) return;
    
    const videoNameContainer = localTile.querySelector('.video-name-container');
    if (!videoNameContainer) return;
    
    // Remove existing hand icon if present
    const existingHandIcon = videoNameContainer.querySelector('.hand-raised-icon');
    if (existingHandIcon) {
        existingHandIcon.remove();
    }
    
    // Add hand icon if hand is raised
    if (isHandRaised) {
        const handIcon = document.createElement('i');
        handIcon.className = 'bi bi-hand-index-thumb-fill hand-raised-icon';
        handIcon.title = 'Hand raised';
        videoNameContainer.appendChild(handIcon);
    }
}

// Close video menus when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.video-menu-dropdown').forEach(m => m.style.display = 'none');
});

// Toggle chat sidebar
document.querySelector('#toggle-chat').addEventListener('click', () => {
    const sidebar = document.querySelector('#sidebar-panel');
    const wasHidden = sidebar.classList.contains('sidebar-hidden');
    sidebar.classList.toggle('sidebar-hidden');
    
    // Switch to chat tab
    if (wasHidden) {
        const chatTab = document.querySelector('#chat-tab');
        const chatContent = document.querySelector('#chat-content');
        document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        chatTab.classList.add('active');
        chatContent.classList.add('show', 'active');
        
        // Mark chat as open and clear notifications
        isChatOpen = true;
        unreadMessages = 0;
        updateChatBadge();
    } else {
        // Check if we're closing the sidebar or switching tabs
        const chatTab = document.querySelector('#chat-tab');
        if (chatTab.classList.contains('active')) {
            isChatOpen = false;
        }
    }
});

// Toggle participants sidebar
document.querySelector('#toggle-participants').addEventListener('click', () => {
    const sidebar = document.querySelector('#sidebar-panel');
    sidebar.classList.toggle('sidebar-hidden');
    
    // Mark chat as not actively viewing
    const chatTab = document.querySelector('#chat-tab');
    if (!chatTab.classList.contains('active')) {
        isChatOpen = false;
    }
    
    // Switch to participants tab
    if (!sidebar.classList.contains('sidebar-hidden')) {
        const participantsTab = document.querySelector('#participants-tab');
        const participantsContent = document.querySelector('#participants-content');
        document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        participantsTab.classList.add('active');
        participantsContent.classList.add('show', 'active');
    }
});

// Toggle waiting room sidebar
document.querySelector('#toggle-waiting-room').addEventListener('click', () => {
    const sidebar = document.querySelector('#sidebar-panel');
    sidebar.classList.toggle('sidebar-hidden');
    
    // Mark chat as not actively viewing
    isChatOpen = false;
    
    // Switch to waiting room tab
    if (!sidebar.classList.contains('sidebar-hidden')) {
        const waitingTab = document.querySelector('#waiting-room-tab');
        const waitingContent = document.querySelector('#waiting-room-content');
        document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        waitingTab.classList.add('active');
        waitingContent.classList.add('show', 'active');
    }
});

document.querySelector('#close-sidebar').addEventListener('click', () => {
    document.querySelector('#sidebar-panel').classList.add('sidebar-hidden');
    isChatOpen = false;
});

// Listen for tab changes to track if chat is open
document.querySelectorAll('.nav-link').forEach(tab => {
    tab.addEventListener('click', () => {
        const chatTab = document.querySelector('#chat-tab');
        const sidebar = document.querySelector('#sidebar-panel');
        isChatOpen = chatTab.classList.contains('active') && !sidebar.classList.contains('sidebar-hidden');
        if (isChatOpen) {
            unreadMessages = 0;
            updateChatBadge();
        }
    });
});

// Update chat badge
function updateChatBadge() {
    const badge = document.querySelector('#chat-badge');
    if (unreadMessages > 0 && !isChatOpen) {
        badge.style.display = 'flex';
        badge.textContent = '';  // Just show red dot, no number
    } else {
        badge.style.display = 'none';
    }
}

// Show waiting room
function showWaitingRoom() {
    document.querySelector('#setup-screen').style.display = 'none';
    document.querySelector('#waiting-room-screen').style.display = 'block';
    document.querySelector('#waiting-meeting-id').innerHTML = currentMeetingId;
}

// Cancel joining from waiting room
document.querySelector('#cancel-join').addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
    }
    location.reload();
});

// Copy meeting link to clipboard
document.querySelector('#copy-meeting-id').addEventListener('click', () => {
    const meetingUrl = `${window.location.origin}/${currentMeetingId}`;
    navigator.clipboard.writeText(meetingUrl);
    
    // Update button text temporarily
    const btn = document.querySelector('#copy-meeting-id');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-circle"></i>';
    btn.classList.add('btn-success');
    btn.classList.remove('btn-outline-light');
    
    setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline-light');
    }, 2000);
});

// Raise hand
let isHandRaised = false;
document.querySelector('#raise-hand').addEventListener('click', () => {
    isHandRaised = !isHandRaised;
    
    const raiseHandBtn = document.querySelector('#raise-hand');
    const icon = raiseHandBtn.querySelector('i');
    const label = raiseHandBtn.querySelector('.control-label');
    
    if (isHandRaised) {
        raiseHandBtn.classList.add('active');
        icon.classList.remove('bi-hand-index-thumb');
        icon.classList.add('bi-hand-index-thumb-fill');
        label.textContent = 'Lower';
    } else {
        raiseHandBtn.classList.remove('active');
        icon.classList.remove('bi-hand-index-thumb-fill');
        icon.classList.add('bi-hand-index-thumb');
        label.textContent = 'Raise';
    }
    
    // Update local video tile indicator
    updateLocalHandIndicator();
    
    socket.emit('raiseHand', { meetingId: currentMeetingId, raised: isHandRaised });
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
    
    // Check permission
    if (!userPermissions.canVideo && !isVideoEnabled) {
        alert('The host has not granted you permission to turn on video');
        return;
    }
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        
        const btn = document.querySelector('#toggle-video');
        if (isVideoEnabled) {
            btn.innerHTML = '<i class="bi bi-camera-video-fill"></i><span class="control-label">Stop video</span>';
            btn.classList.remove('off');
        } else {
            btn.innerHTML = '<i class="bi bi-camera-video-off-fill"></i><span class="control-label">Start video</span>';
            btn.classList.add('off');
        }
        
        // Update local video icon
        const localIcon = document.querySelector('#video-icon-local');
        if (localIcon) {
            localIcon.className = isVideoEnabled ? 'video-icon bi bi-camera-video-fill' : 'video-icon bi bi-camera-video-off-fill muted';
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
    
    // Check permission
    if (!userPermissions.canUnmute && !isAudioEnabled) {
        alert('The host has not granted you permission to unmute');
        return;
    }
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !isAudioEnabled;
        audioTrack.enabled = isAudioEnabled;
        
        const btn = document.querySelector('#toggle-audio');
        if (isAudioEnabled) {
            btn.innerHTML = '<i class="bi bi-mic-fill"></i><span class="control-label">Mute</span>';
            btn.classList.remove('muted');
        } else {
            btn.innerHTML = '<i class="bi bi-mic-mute-fill"></i><span class="control-label">Unmute</span>';
            btn.classList.add('muted');
        }
        
        // Update local audio icon
        const localIcon = document.querySelector('#audio-icon-local');
        if (localIcon) {
            localIcon.className = isAudioEnabled ? 'video-icon bi bi-mic-fill' : 'video-icon bi bi-mic-mute-fill muted';
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
    // Check permission
    if (!userPermissions.canScreenShare && !isScreenSharing) {
        alert('The host has not granted you permission to share screen');
        return;
    }
    
    if (isScreenSharing) {
        stopScreenSharing();
    } else {
        await startScreenSharing();
    }
    
    const btn = document.querySelector('#share-screen');
    if (isScreenSharing) {
        btn.innerHTML = '<i class="bi bi-stop-circle"></i><span class="control-label">Stop share</span>';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '<i class="bi bi-display"></i><span class="control-label">Share</span>';
        btn.classList.remove('active');
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
    // Create a screen share video tile
    const videoGrid = document.querySelector('#video-grid');
    let screenTile = document.querySelector('#video-tile-screen-local');
    
    if (!screenTile) {
        screenTile = document.createElement('div');
        screenTile.className = 'video-tile screen-share';
        screenTile.id = 'video-tile-screen-local';
        
        const video = document.createElement('video');
        video.id = 'local-screen-preview';
        video.className = 'video-player';
        video.autoplay = true;
        video.playsinline = true;
        video.muted = true;
        
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.innerHTML = `
            <div class="video-label">
                <i class="bi bi-display"></i> Your Screen
            </div>
        `;
        
        screenTile.appendChild(video);
        screenTile.appendChild(overlay);
        videoGrid.insertBefore(screenTile, videoGrid.firstChild);
    }
    
    const screenVideo = document.querySelector('#local-screen-preview');
    screenVideo.srcObject = screenStream;
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
    const screenTile = document.querySelector('#video-tile-screen-local');
    if (screenTile) {
        screenTile.remove();
    }

    // Update UI
    isScreenSharing = false;
    const btn = document.querySelector('#share-screen');
    btn.innerHTML = '<i class="bi bi-display"></i><span class="control-label">Share</span>';
    btn.classList.remove('active');

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
    
    // Increment unread messages if chat is not open and message is not from self
    if (!isOwn && !isChatOpen) {
        unreadMessages++;
        updateChatBadge();
    }
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
            localStream = stream;
            localVideoEl = document.querySelector('#local-video');
            if (localVideoEl) {
                localVideoEl.srcObject = stream;
            }
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

        // Create video tile if it doesn't exist
        const displayName = offerObj?.offererDisplayName || remoteUserName;
        const participantData = currentParticipants.find(p => p.userName === remoteUserName);
        addVideoToGrid(remoteUserName, displayName, false, participantData);
        
        const remoteVideoEl = document.querySelector(`#remote-video-${remoteUserName}`);
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
    const participantCount = document.querySelector('#participant-count');
    
    // Store participants globally for admin controls
    currentParticipants = participants;
    
    // Update video menus if they exist
    updateVideoMenus(participants);
    
    participantCount.textContent = participants.length;
    participantsList.innerHTML = '';
    
    participants.forEach(p => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-card';
        
        let roleText = '';
        let roleBadge = '';
        if (p.isAdmin) {
            roleText = 'Admin';
            roleBadge = '<span class="role-badge admin-badge">Admin</span>';
        } else if (p.isCoHost) {
            roleText = 'Co-Host';
            roleBadge = '<span class="role-badge cohost-badge">Co-Host</span>';
        }
        
        // Show controls for admin/co-host (but not for other admins, and not for yourself)
        const showControls = (isAdmin || isCoHost) && !p.isAdmin && p.userName !== userName;
        
        participantDiv.innerHTML = `
            <div class="participant-card-info">
                <div class="participant-avatar">
                    <i class="bi bi-person-circle"></i>
                </div>
                <div class="participant-details">
                    <span class="participant-name">
                        ${p.displayName}
                        ${p.handRaised ? '<i class="bi bi-hand-index-thumb-fill hand-raised-icon" title="Hand raised"></i>' : ''}
                    </span>
                    ${roleBadge}
                </div>
            </div>
            ${showControls ? `
                <div class="participant-menu">
                    <button class="btn-menu" data-username="${p.userName}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <div class="menu-dropdown" id="menu-${p.userName}" style="display: none;">
                        ${isAdmin && !p.isCoHost ? `<div class="menu-item make-cohost" data-username="${p.userName}">
                            <i class="bi bi-star-fill"></i> Make Co-Host
                        </div>` : ''}
                        ${p.handRaised ? `<div class="menu-item lower-hand" data-username="${p.userName}">
                            <i class="bi bi-hand-index-thumb"></i> Lower Hand
                        </div>` : ''}
                        <div class="menu-item toggle-audio" data-username="${p.userName}">
                            <i class="bi bi-mic${p.permissions?.canUnmute ? '-mute' : ''}"></i> 
                            ${p.permissions?.canUnmute ? 'Disable' : 'Enable'} Audio
                        </div>
                        <div class="menu-item toggle-video" data-username="${p.userName}">
                            <i class="bi bi-camera-video${p.permissions?.canVideo ? '-off' : ''}"></i> 
                            ${p.permissions?.canVideo ? 'Disable' : 'Enable'} Video
                        </div>
                        <div class="menu-item toggle-screenshare" data-username="${p.userName}">
                            <i class="bi bi-display"></i> 
                            ${p.permissions?.canScreenShare ? 'Disable' : 'Enable'} Screen Share
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item remove-participant" data-username="${p.userName}">
                            <i class="bi bi-x-circle"></i> Remove from Meeting
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        participantsList.appendChild(participantDiv);
    });
    
    // Add event listeners for menu buttons
    document.querySelectorAll('.btn-menu').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetUser = e.currentTarget.dataset.username;
            const menu = document.querySelector(`#menu-${targetUser}`);
            
            // Close all other menus
            document.querySelectorAll('.menu-dropdown').forEach(m => {
                if (m !== menu) m.style.display = 'none';
            });
            
            // Toggle current menu
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
    });
    
    // Close menus when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
    });
    
    // Add event listeners for admin controls
    document.querySelectorAll('.make-cohost').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetUser = e.currentTarget.dataset.username;
            socket.emit('makeCoHost', { meetingId: currentMeetingId, userName: targetUser });
            document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
        });
    });
    
    document.querySelectorAll('.lower-hand').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetUser = e.currentTarget.dataset.username;
            socket.emit('lowerHand', { meetingId: currentMeetingId, userName: targetUser });
            document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
        });
    });
    
    document.querySelectorAll('.toggle-audio, .toggle-video, .toggle-screenshare').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetUser = e.currentTarget.dataset.username;
            const permission = e.currentTarget.classList.contains('toggle-audio') ? 'canUnmute' :
                              e.currentTarget.classList.contains('toggle-video') ? 'canVideo' : 'canScreenShare';
            
            const participant = participants.find(p => p.userName === targetUser);
            const newValue = !participant.permissions[permission];
            
            socket.emit('updateUserPermissions', {
                meetingId: currentMeetingId,
                userName: targetUser,
                permissions: { [permission]: newValue }
            });
            document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
        });
    });
    
    document.querySelectorAll('.remove-participant').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetUser = e.currentTarget.dataset.username;
            const participant = participants.find(p => p.userName === targetUser);
            
            if (confirm(`Remove ${participant.displayName} from the meeting?`)) {
                socket.emit('removeParticipant', { meetingId: currentMeetingId, userName: targetUser });
                document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
            }
        });
    });
}

function updateWaitingRoomList(waitingRoom) {
    const waitingRoomList = document.querySelector('#waiting-room-list-sidebar');
    const waitingCount = document.querySelector('#waiting-count');
    const waitingRoomBadge = document.querySelector('#waiting-room-badge');
    
    waitingCount.textContent = waitingRoom.length;
    
    // Update bottom bar badge
    if (waitingRoom.length > 0) {
        const displayCount = waitingRoom.length > 9 ? '9+' : waitingRoom.length;
        waitingRoomBadge.textContent = displayCount;
        waitingRoomBadge.style.display = 'flex';
    } else {
        waitingRoomBadge.style.display = 'none';
    }
    
    // Update waiting room tab badge color
    const waitingTab = document.querySelector('#waiting-room-tab');
    if (waitingRoom.length > 0) {
        waitingTab.classList.add('has-waiting');
        // Auto-open sidebar and switch to waiting room tab if closed
        const sidebar = document.querySelector('#sidebar-panel');
        if (sidebar.classList.contains('sidebar-hidden')) {
            sidebar.classList.remove('sidebar-hidden');
            // Switch to waiting room tab
            const waitingTabButton = document.querySelector('#waiting-room-tab');
            const waitingTabContent = document.querySelector('#waiting-room-content');
            document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            waitingTabButton.classList.add('active');
            waitingTabContent.classList.add('show', 'active');
        }
    } else {
        waitingTab.classList.remove('has-waiting');
    }
    
    waitingRoomList.innerHTML = '';
    
    if (waitingRoom.length === 0) {
        waitingRoomList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-people" style="font-size: 48px; color: #ccc;"></i>
                <p class="text-muted mt-3">No one in the waiting room</p>
            </div>
        `;
        return;
    }
    
    waitingRoom.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'waiting-user-card';
        userDiv.innerHTML = `
            <div class="waiting-user-info">
                <div class="waiting-user-avatar">
                    <i class="bi bi-person-circle"></i>
                </div>
                <div class="waiting-user-details">
                    <span class="waiting-user-name">${user.displayName}</span>
                    <span class="waiting-user-status">Waiting to join...</span>
                </div>
            </div>
            <div class="waiting-user-actions">
                <button class="btn btn-sm btn-success admit-user" data-username="${user.userName}" title="Admit">
                    <i class="bi bi-check-circle"></i> Admit
                </button>
                <button class="btn btn-sm btn-danger deny-user" data-username="${user.userName}" title="Deny">
                    <i class="bi bi-x-circle"></i> Deny
                </button>
            </div>
        `;
        waitingRoomList.appendChild(userDiv);
    });
    
    // Add event listeners
    document.querySelectorAll('.admit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetUser = e.currentTarget.dataset.username;
            socket.emit('admitFromWaitingRoom', { meetingId: currentMeetingId, userName: targetUser });
        });
    });
    
    document.querySelectorAll('.deny-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetUser = e.currentTarget.dataset.username;
            socket.emit('denyFromWaitingRoom', { meetingId: currentMeetingId, userName: targetUser });
        });
    });
}

// Initialize page - check if meeting ID is in URL
window.addEventListener('DOMContentLoaded', () => {
    // Check for auto-join from scheduled meetings (this runs first)
    const autoJoinMeetingId = sessionStorage.getItem('autoJoinMeeting');
    const isHostFlag = sessionStorage.getItem('isHost');
    
    if (autoJoinMeetingId) {
        // Pre-fill the meeting ID
        document.querySelector('#meeting-id-input').value = autoJoinMeetingId;
        
        // If user was marked as host, set admin flag
        if (isHostFlag === 'true') {
            isAdmin = true;
        }
        
        // Clear session storage
        sessionStorage.removeItem('autoJoinMeeting');
        sessionStorage.removeItem('isHost');
        
        // Focus on email input
        document.querySelector('#user-email').focus();
        
        // Show a message
        setTimeout(() => {
            alert('Please enter your name and email address to join the meeting.');
        }, 300);
    } else if (urlMeetingId) {
        // Pre-fill the meeting ID input from URL
        document.querySelector('#meeting-id-input').value = urlMeetingId;
        
        // Focus on display name input
        document.querySelector('#display-name').focus();
        
        // Show a hint that user can join this meeting
        const meetingLabel = document.querySelector('label[for="meeting-id-input"]');
        if (meetingLabel) {
            meetingLabel.innerHTML = `Meeting ID <span class="text-success">(from URL)</span>`;
        }
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.meetingId) {
        // User navigated back to a meeting URL
        console.log('Navigated to meeting:', event.state.meetingId);
    } else {
        // User navigated away from meeting
        if (currentMeetingId) {
            // They were in a meeting and navigated back
            location.reload();
        }
    }
});

// Settings Modal
let currentMeetingSettings = {
    waitingRoomEnabled: true,
    defaultPermissions: {
        canUnmute: true,
        canVideo: true,
        canScreenShare: false
    }
};

// Open settings modal
document.querySelector('#settings-btn').addEventListener('click', () => {
    const modal = document.querySelector('#settings-modal');
    modal.style.display = 'block';
    
    // Load current settings from server or use defaults
    socket.emit('getSettings', { meetingId: currentMeetingId });
});

// Close settings modal
document.querySelector('#close-settings').addEventListener('click', () => {
    document.querySelector('#settings-modal').style.display = 'none';
});

// Close on overlay click
document.querySelector('.settings-overlay').addEventListener('click', () => {
    document.querySelector('#settings-modal').style.display = 'none';
});

// Waiting room toggle
document.querySelector('#waiting-room-toggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    socket.emit('toggleWaitingRoom', { meetingId: currentMeetingId, enabled });
    currentMeetingSettings.waitingRoomEnabled = enabled;
});

// Default permission toggles
document.querySelector('#default-audio-permission').addEventListener('change', (e) => {
    currentMeetingSettings.defaultPermissions.canUnmute = e.target.checked;
    socket.emit('updateDefaultPermissions', { 
        meetingId: currentMeetingId, 
        permissions: currentMeetingSettings.defaultPermissions 
    });
});

document.querySelector('#default-video-permission').addEventListener('change', (e) => {
    currentMeetingSettings.defaultPermissions.canVideo = e.target.checked;
    socket.emit('updateDefaultPermissions', { 
        meetingId: currentMeetingId, 
        permissions: currentMeetingSettings.defaultPermissions 
    });
});

document.querySelector('#default-screenshare-permission').addEventListener('change', (e) => {
    currentMeetingSettings.defaultPermissions.canScreenShare = e.target.checked;
    socket.emit('updateDefaultPermissions', { 
        meetingId: currentMeetingId, 
        permissions: currentMeetingSettings.defaultPermissions 
    });
});

// Apply permissions to all current participants
document.querySelector('#apply-permissions-all').addEventListener('click', () => {
    if (confirm('Apply these permissions to all current participants (except co-hosts)? This will override their current permissions.')) {
        socket.emit('applyPermissionsToAll', {
            meetingId: currentMeetingId,
            permissions: currentMeetingSettings.defaultPermissions
        });
    }
});