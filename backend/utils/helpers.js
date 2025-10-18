// Helper function to generate meeting ID
exports.generateMeetingId = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};
