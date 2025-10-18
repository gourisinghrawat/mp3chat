const nodemailer = require('nodemailer');
const ical = require('ical-generator').default;

// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
};

// Generate Google Calendar invite (.ics file)
const generateCalendarInvite = (meeting, meetingLink) => {
    const calendar = ical({ name: 'Video Call Meeting' });
    
    const startTime = new Date(meeting.scheduledTime);
    const endTime = new Date(startTime.getTime() + meeting.duration * 60000);
    
    calendar.createEvent({
        start: startTime,
        end: endTime,
        summary: meeting.title,
        description: `${meeting.description || ''}\n\nJoin Meeting: ${meetingLink}\n\nMeeting ID: ${meeting.meetingId}`,
        location: meetingLink,
        url: meetingLink,
        organizer: {
            name: meeting.hostName,
            email: meeting.hostEmail
        },
        attendees: meeting.participants?.map(p => ({
            name: p.name || p.email,
            email: p.email,
            rsvp: true,
            status: 'NEEDS-ACTION'
        })) || []
    });
    
    return calendar.toString();
};

// Email template: Meeting scheduled confirmation (to host)
const sendScheduleConfirmation = async (meeting, meetingLink) => {
    const transporter = createTransporter();
    const calendarInvite = generateCalendarInvite(meeting, meetingLink);
    
    const scheduledDate = new Date(meeting.scheduledTime);
    
    const mailOptions = {
        from: {
            name: 'Video Call App',
            address: process.env.EMAIL_USER
        },
        to: meeting.hostEmail,
        subject: `âœ… Meeting Scheduled: ${meeting.title}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .meeting-details { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
                    .detail-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
                    .detail-label { font-weight: bold; color: #667eea; }
                    .meeting-link { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; }
                    .meeting-link a { color: #0066cc; text-decoration: none; font-weight: bold; }
                    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                    .success-icon { font-size: 48px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="success-icon">âœ…</div>
                        <h1>Meeting Scheduled Successfully!</h1>
                    </div>
                    <div class="content">
                        <p>Hi <strong>${meeting.hostName}</strong>,</p>
                        <p>Your meeting has been scheduled successfully. Here are the details:</p>
                        
                        <div class="meeting-details">
                            <div class="detail-row">
                                <span class="detail-label">ðŸ“‹ Title:</span> ${meeting.title}
                            </div>
                            ${meeting.description ? `
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ“ Description:</span> ${meeting.description}
                                </div>
                            ` : ''}
                            <div class="detail-row">
                                <span class="detail-label">ðŸ“… Date:</span> ${scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">ðŸ• Time:</span> ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">â±ï¸ Duration:</span> ${meeting.duration} minutes
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">ðŸŽ« Meeting ID:</span> <code>${meeting.meetingId}</code>
                            </div>
                            ${meeting.participants?.length > 0 ? `
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ‘¥ Participants:</span> ${meeting.participants.length} invited
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="meeting-link">
                            <strong>ðŸ”— Meeting Link:</strong><br>
                            <a href="${meetingLink}">${meetingLink}</a>
                        </div>
                        
                        <p><strong>What's next?</strong></p>
                        <ul>
                            <li>ðŸ“§ Invitations have been sent to all participants</li>
                            <li>ðŸ“… A calendar invite is attached to this email</li>
                            <li>â° You'll receive a reminder 15 minutes before the meeting</li>
                            <li>ðŸš€ Click "Start Meeting" when ready to begin</li>
                        </ul>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${meetingLink}" class="button">Join Meeting</a>
                        </div>
                        
                        <div class="footer">
                            <p>This is an automated message from Video Call App</p>
                            <p>If you have any questions, please contact support.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
        icalEvent: {
            filename: 'meeting.ics',
            method: 'REQUEST',
            content: calendarInvite
        }
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`ðŸ“§ Schedule confirmation email sent to ${meeting.hostEmail}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('âŒ Error sending schedule confirmation email:', error);
        return { success: false, error: error.message };
    }
};

// Email template: Meeting invitation (to participants)
const sendParticipantInvitations = async (meeting, meetingLink) => {
    if (!meeting.participants || meeting.participants.length === 0) {
        console.log('â„¹ï¸ No participants to invite');
        return { success: true, sent: 0 };
    }
    
    const transporter = createTransporter();
    const calendarInvite = generateCalendarInvite(meeting, meetingLink);
    const scheduledDate = new Date(meeting.scheduledTime);
    
    const results = [];
    
    for (const participant of meeting.participants) {
        const mailOptions = {
            from: {
                name: 'Video Call App',
                address: process.env.EMAIL_USER
            },
            to: participant.email,
            subject: `ðŸ“… Meeting Invitation: ${meeting.title}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .meeting-details { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
                        .detail-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
                        .detail-label { font-weight: bold; color: #667eea; }
                        .meeting-link { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; }
                        .meeting-link a { color: #0066cc; text-decoration: none; font-weight: bold; }
                        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>ðŸ“… You're Invited to a Meeting!</h1>
                        </div>
                        <div class="content">
                            <p>Hi${participant.name ? ` <strong>${participant.name}</strong>` : ''},</p>
                            <p><strong>${meeting.hostName}</strong> has invited you to join a video call meeting.</p>
                            
                            <div class="meeting-details">
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ“‹ Title:</span> ${meeting.title}
                                </div>
                                ${meeting.description ? `
                                    <div class="detail-row">
                                        <span class="detail-label">ðŸ“ Description:</span> ${meeting.description}
                                    </div>
                                ` : ''}
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ“… Date:</span> ${scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ• Time:</span> ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">â±ï¸ Duration:</span> ${meeting.duration} minutes
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">ðŸ‘¤ Host:</span> ${meeting.hostName}
                                </div>
                            </div>
                            
                            <div class="meeting-link">
                                <strong>ðŸ”— Join Meeting:</strong><br>
                                <a href="${meetingLink}">${meetingLink}</a>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${meetingLink}" class="button">Join Meeting</a>
                            </div>
                            
                            <p><strong>ðŸ“… Add to Calendar:</strong> A calendar invite is attached to this email. Click to add this meeting to your Google Calendar, Outlook, or other calendar app.</p>
                            
                            <p><strong>â° Reminder:</strong> You'll receive a reminder 15 minutes before the meeting starts.</p>
                            
                            <div class="footer">
                                <p>This is an automated invitation from Video Call App</p>
                                <p>Meeting ID: <code>${meeting.meetingId}</code></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            icalEvent: {
                filename: 'meeting.ics',
                method: 'REQUEST',
                content: calendarInvite
            }
        };
        
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`ðŸ“§ Invitation sent to ${participant.email}`);
            results.push({ email: participant.email, success: true, messageId: info.messageId });
        } catch (error) {
            console.error(`âŒ Error sending invitation to ${participant.email}:`, error);
            results.push({ email: participant.email, success: false, error: error.message });
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`ðŸ“Š Invitations sent: ${successCount}/${meeting.participants.length}`);
    
    return { success: true, sent: successCount, total: meeting.participants.length, results };
};

// Email template: Meeting reminder (15 minutes before)
const sendMeetingReminder = async (meeting, meetingLink) => {
    const transporter = createTransporter();
    const scheduledDate = new Date(meeting.scheduledTime);
    
    // Send to host
    const hostMailOptions = {
        from: {
            name: 'Video Call App',
            address: process.env.EMAIL_USER
        },
        to: meeting.hostEmail,
        subject: `â° Reminder: Meeting "${meeting.title}" starts in 15 minutes`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .button { display: inline-block; padding: 15px 40px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; }
                    .meeting-link { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>â° Meeting Starting Soon!</h1>
                    </div>
                    <div class="content">
                        <div class="alert-box">
                            <h2 style="margin-top: 0;">ðŸ“¢ Your meeting starts in 15 minutes!</h2>
                            <p><strong>${meeting.title}</strong></p>
                            <p>ðŸ• ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        
                        <div class="meeting-link">
                            <strong>ðŸ”— Meeting Link:</strong><br>
                            <a href="${meetingLink}">${meetingLink}</a>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${meetingLink}" class="button">ðŸš€ Start Meeting Now</a>
                        </div>
                        
                        <p><strong>As the host, you can:</strong></p>
                        <ul>
                            <li>Start the meeting early</li>
                            <li>Admit participants from the waiting room</li>
                            <li>Manage participant permissions</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        await transporter.sendMail(hostMailOptions);
        console.log(`â° Reminder sent to host: ${meeting.hostEmail}`);
        
        // Send to participants
        if (meeting.participants && meeting.participants.length > 0) {
            for (const participant of meeting.participants) {
                const participantMailOptions = {
                    ...hostMailOptions,
                    to: participant.email,
                    html: hostMailOptions.html.replace('As the host, you can:', 'Quick reminders:')
                        .replace('<li>Start the meeting early</li><li>Admit participants from the waiting room</li><li>Manage participant permissions</li>', 
                                '<li>Join a few minutes early to test your audio/video</li><li>Make sure you have a stable internet connection</li><li>The host will admit you from the waiting room</li>')
                        .replace('Start Meeting Now', 'Join Meeting Now')
                };
                
                await transporter.sendMail(participantMailOptions);
                console.log(`â° Reminder sent to participant: ${participant.email}`);
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('âŒ Error sending reminder emails:', error);
        return { success: false, error: error.message };
    }
};

// Email template: Meeting cancelled
const sendCancellationNotification = async (meeting, meetingLink) => {
    const transporter = createTransporter();
    const scheduledDate = new Date(meeting.scheduledTime);
    
    const recipients = [meeting.hostEmail];
    if (meeting.participants && meeting.participants.length > 0) {
        recipients.push(...meeting.participants.map(p => p.email));
    }
    
    const mailOptions = {
        from: {
            name: 'Video Call App',
            address: process.env.EMAIL_USER
        },
        to: recipients,
        subject: `âŒ Meeting Cancelled: ${meeting.title}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .cancelled-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .meeting-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>âŒ Meeting Cancelled</h1>
                    </div>
                    <div class="content">
                        <div class="cancelled-box">
                            <h2 style="margin-top: 0; color: #721c24;">This meeting has been cancelled</h2>
                            <p><strong>${meeting.title}</strong></p>
                        </div>
                        
                        <div class="meeting-details">
                            <p><strong>Meeting Details:</strong></p>
                            <p>ðŸ“… Date: ${scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p>ðŸ• Time: ${scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p>ðŸ‘¤ Host: ${meeting.hostName}</p>
                        </div>
                        
                        <p>The meeting scheduled for the above date and time has been cancelled by the host.</p>
                        <p>Please remove this event from your calendar.</p>
                        
                        <div class="footer">
                            <p>This is an automated notification from Video Call App</p>
                            <p>Meeting ID: <code>${meeting.meetingId}</code></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`ðŸ“§ Cancellation email sent to ${recipients.length} recipient(s)`);
        return { success: true, messageId: info.messageId, recipients: recipients.length };
    } catch (error) {
        console.error('âŒ Error sending cancellation email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendScheduleConfirmation,
    sendParticipantInvitations,
    sendMeetingReminder,
    sendCancellationNotification,
    generateCalendarInvite
};

