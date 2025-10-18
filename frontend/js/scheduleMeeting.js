// ============================================
// Schedule Meeting Functionality
// ============================================

// Navigation between screens
document.getElementById('schedule-meeting-btn')?.addEventListener('click', () => {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('schedule-meeting-screen').style.display = 'block';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('meeting-date').value = today;
    
    // Set default time to next hour
    const now = new Date();
    const nextHour = new Date(now.setHours(now.getHours() + 1));
    const hours = String(nextHour.getHours()).padStart(2, '0');
    const minutes = '00';
    document.getElementById('meeting-time').value = `${hours}:${minutes}`;
    
    // Pre-fill name if available
    const displayName = document.getElementById('display-name').value;
    if (displayName) {
        document.getElementById('host-name').value = displayName;
    }
});

document.getElementById('my-meetings-btn')?.addEventListener('click', () => {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('my-meetings-screen').style.display = 'block';
});

document.getElementById('back-to-home-schedule')?.addEventListener('click', () => {
    document.getElementById('schedule-meeting-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'block';
});

document.getElementById('back-to-home-meetings')?.addEventListener('click', () => {
    document.getElementById('my-meetings-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'block';
});

// Schedule Meeting Form Submission
document.getElementById('schedule-meeting-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Scheduling...';
    submitBtn.disabled = true;
    
    try {
        // Get form data
        const title = document.getElementById('meeting-title').value;
        const description = document.getElementById('meeting-description').value;
        const hostName = document.getElementById('host-name').value;
        const hostEmail = document.getElementById('host-email').value;
        const date = document.getElementById('meeting-date').value;
        const time = document.getElementById('meeting-time').value;
        const duration = parseInt(document.getElementById('meeting-duration').value);
        
        // Combine date and time
        const scheduledTime = new Date(`${date}T${time}`).toISOString();
        
        // Get settings
        const settings = {
            waitingRoomEnabled: document.getElementById('schedule-waiting-room').checked,
            allowParticipantAudio: document.getElementById('schedule-allow-audio').checked,
            allowParticipantVideo: document.getElementById('schedule-allow-video').checked,
            allowParticipantScreenShare: document.getElementById('schedule-allow-screenshare').checked,
            emailReminders: document.getElementById('schedule-email-reminders').checked
        };
        
        // Get participants
        const participantEmails = document.getElementById('participant-emails').value;
        const participants = participantEmails
            ? participantEmails.split(',').map(email => ({
                email: email.trim(),
                name: '',
                status: 'invited'
              }))
            : [];
        
        // Make API request
        const response = await fetch('/api/meetings/schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description,
                hostName,
                hostEmail,
                scheduledTime,
                duration,
                participants,
                settings
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show success modal with meeting link
            showMeetingLinkModal(data.meeting);
            
            // Reset form
            document.getElementById('schedule-meeting-form').reset();
            
            // Show success message
            showNotification('Meeting scheduled successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to schedule meeting');
        }
    } catch (error) {
        console.error('Error scheduling meeting:', error);
        showNotification('Error scheduling meeting: ' + error.message, 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// Load My Meetings
document.getElementById('load-my-meetings')?.addEventListener('click', async () => {
    const email = document.getElementById('user-email-filter').value.trim();
    
    if (!email) {
        showNotification('Please enter your email', 'warning');
        return;
    }
    
    const loadingDiv = document.getElementById('meetings-loading');
    const meetingsList = document.getElementById('meetings-list');
    
    loadingDiv.style.display = 'block';
    meetingsList.innerHTML = '';
    
    try {
        const response = await fetch(`/api/meetings/user/${encodeURIComponent(email)}`);
        const data = await response.json();
        
        if (data.success) {
            displayMeetings(data.meetings);
            
            // Store email for future use
            localStorage.setItem('userEmail', email);
        } else {
            throw new Error(data.error || 'Failed to load meetings');
        }
    } catch (error) {
        console.error('Error loading meetings:', error);
        meetingsList.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Error loading meetings: ${error.message}
            </div>
        `;
    } finally {
        loadingDiv.style.display = 'none';
    }
});

// Display meetings list
function displayMeetings(meetings) {
    const meetingsList = document.getElementById('meetings-list');
    
    if (meetings.length === 0) {
        meetingsList.innerHTML = `
            <div class="no-meetings-message">
                <i class="bi bi-calendar-x"></i>
                <h5>No Scheduled Meetings</h5>
                <p>You don't have any upcoming scheduled meetings.</p>
                <button class="btn btn-primary mt-3" onclick="document.getElementById('back-to-home-meetings').click(); document.getElementById('schedule-meeting-btn').click();">
                    <i class="bi bi-calendar-plus"></i> Schedule a Meeting
                </button>
            </div>
        `;
        return;
    }
    
    meetingsList.innerHTML = meetings.map(meeting => {
        const scheduledDate = new Date(meeting.scheduledTime);
        const now = new Date();
        const isUpcoming = scheduledDate > now;
        const meetingLink = `${window.location.origin}/${meeting.meetingId}`;
        
        return `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h5 class="meeting-title">${escapeHtml(meeting.title)}</h5>
                    <span class="meeting-status ${meeting.status}">${meeting.status.toUpperCase()}</span>
                </div>
                
                ${meeting.description ? `
                    <div class="meeting-description">
                        <i class="bi bi-info-circle"></i> ${escapeHtml(meeting.description)}
                    </div>
                ` : ''}
                
                <div class="meeting-details">
                    <div class="meeting-detail-item">
                        <i class="bi bi-calendar-event"></i>
                        <span>${scheduledDate.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        })}</span>
                    </div>
                    <div class="meeting-detail-item">
                        <i class="bi bi-clock"></i>
                        <span>${scheduledDate.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}</span>
                    </div>
                    <div class="meeting-detail-item">
                        <i class="bi bi-hourglass"></i>
                        <span>${meeting.duration} minutes</span>
                    </div>
                    <div class="meeting-detail-item">
                        <i class="bi bi-person"></i>
                        <span>${escapeHtml(meeting.hostName)}</span>
                    </div>
                </div>
                
                <div class="meeting-link">
                    <small class="text-muted d-block mb-1">Meeting Link:</small>
                    <div class="d-flex align-items-center gap-2">
                        <code class="meeting-link-text flex-grow-1">${meetingLink}</code>
                        <button class="btn btn-sm btn-outline-primary" onclick="copyToClipboard('${meetingLink}')">
                            <i class="bi bi-clipboard"></i> Copy
                        </button>
                    </div>
                </div>
                
                <div class="meeting-actions">
                    ${isUpcoming && meeting.status === 'scheduled' ? `
                        <button class="btn btn-success" onclick="joinScheduledMeeting('${meeting.meetingId}')">
                            <i class="bi bi-box-arrow-in-right"></i> Join Meeting
                        </button>
                        <button class="btn btn-primary" onclick="startScheduledMeeting('${meeting.meetingId}')">
                            <i class="bi bi-play-circle"></i> Start Meeting
                        </button>
                        <button class="btn btn-warning" onclick="editMeeting('${meeting.meetingId}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-danger" onclick="cancelMeeting('${meeting.meetingId}')">
                            <i class="bi bi-x-circle"></i> Cancel
                        </button>
                    ` : ''}
                    ${meeting.status === 'completed' ? `
                        <button class="btn btn-info" onclick="viewMeetingHistory('${meeting.meetingId}')">
                            <i class="bi bi-clock-history"></i> View History
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Show meeting link modal after scheduling
function showMeetingLinkModal(meeting) {
    const meetingLink = `${window.location.origin}/${meeting.meetingId}`;
    
    const modal = document.createElement('div');
    modal.className = 'meeting-link-modal';
    modal.innerHTML = `
        <div class="meeting-link-modal-content">
            <h4><i class="bi bi-check-circle-fill"></i> Meeting Scheduled Successfully!</h4>
            <p><strong>Title:</strong> ${escapeHtml(meeting.title)}</p>
            <p><strong>Date:</strong> ${new Date(meeting.scheduledTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</p>
            <p><strong>Time:</strong> ${new Date(meeting.scheduledTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
            <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
            
            <div class="meeting-link-box">
                <strong>Meeting Link:</strong>
                <div class="meeting-link-url">${meetingLink}</div>
            </div>
            
            <div class="d-flex gap-2">
                <button class="btn btn-primary flex-grow-1" onclick="copyToClipboard('${meetingLink}'); this.innerHTML='<i class=\\'bi bi-check\\' ></i> Copied!'">
                    <i class="bi bi-clipboard"></i> Copy Link
                </button>
                <button class="btn btn-outline-secondary" onclick="this.closest('.meeting-link-modal').remove()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Join scheduled meeting
function joinScheduledMeeting(meetingId) {
    // Store the meeting ID and navigate to home to enter email
    sessionStorage.setItem('autoJoinMeeting', meetingId);
    window.location.href = `/`;
}

// Start scheduled meeting
async function startScheduledMeeting(meetingId) {
    try {
        // Update meeting status to ongoing
        const response = await fetch(`/api/meetings/${meetingId}/start`, {
            method: 'PATCH'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store meeting ID and mark as host
            sessionStorage.setItem('autoJoinMeeting', meetingId);
            sessionStorage.setItem('isHost', 'true');
            // Navigate to home page to enter email and join
            window.location.href = `/`;
        } else {
            throw new Error(data.error || 'Failed to start meeting');
        }
    } catch (error) {
        console.error('Error starting meeting:', error);
        showNotification('Error starting meeting: ' + error.message, 'danger');
    }
}

// Cancel meeting
async function cancelMeeting(meetingId) {
    if (!confirm('Are you sure you want to cancel this meeting?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/meetings/${meetingId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Meeting cancelled successfully', 'success');
            // Reload meetings
            document.getElementById('load-my-meetings').click();
        } else {
            throw new Error(data.error || 'Failed to cancel meeting');
        }
    } catch (error) {
        console.error('Error cancelling meeting:', error);
        showNotification('Error cancelling meeting: ' + error.message, 'danger');
    }
}

// Edit meeting
function editMeeting(meetingId) {
    showNotification('Edit functionality coming soon!', 'info');
    // TODO: Implement edit functionality
}

// View meeting history
async function viewMeetingHistory(meetingId) {
    try {
        const response = await fetch(`/api/meetings/${meetingId}/history`);
        const data = await response.json();
        
        if (data.success) {
            // Display history in modal or new screen
            console.log('Meeting history:', data.history);
            showNotification('Meeting history feature coming soon!', 'info');
        } else {
            throw new Error(data.error || 'No history found');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Error loading meeting history', 'warning');
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Link copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy link', 'danger');
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load saved email on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
        document.getElementById('user-email-filter').value = savedEmail;
    }
});
