const { notifications, pushSubscriptions } = require('../models/db');
const { getIo } = require('../socket');
const { sendWebPush, isWebPushEnabled } = require('./webPush');

/**
 * Creates a notification in the database and pushes it in real-time if the user is online.
 * 
 * @param {string} userId - ID of the user receiving the notification
 * @param {string} type - 'success', 'info', 'warning'
 * @param {string} title - Short title for the notification
 * @param {string} message - Detail message body
 * @param {string} link - Optional URL string (e.g. '/dashboard')
 */
const pushNotification = async (userId, type, title, message, link = '') => {
    try {
        // 1. Save to DB
        const notification = await notifications.create({
            userId,
            type,
            title,
            message,
            link,
            read: false,
            createdAt: new Date()
        });

        // 2. Emit real-time socket event if possible
        try {
            const io = getIo();
            // In socket.js, we registered mapping, but io.sockets normally isn't easily searchable by our custom `userSocketMap`.
            // The cleanest way is to emit to a room if we joined the user to a room of their own ID, OR expose the map.
            // Let's emit to the user's specific room. Wait, socket.js currently uses `userSocketMap` internally.
            // Let's standardise: if we emit, we need that map. 
            // Better yet, in socket.js let's make users join a room named after their userId: `socket.join(userId.toString())`
            io.to(userId.toString()).emit('new_notification', notification);
        } catch (socketError) {
            console.warn('[Notifications] Socket io not available or failed to emit:', socketError.message);
        }

        // 3. Fire Web Push notifications if enabled
        if (isWebPushEnabled()) {
            try {
                const subscriptions = await pushSubscriptions.find({ userId }).lean();
                if (subscriptions.length) {
                    const payload = JSON.stringify({
                        title,
                        message,
                        link,
                        type
                    });
                    await Promise.all(subscriptions.map(async (sub) => {
                        try {
                            await sendWebPush({ endpoint: sub.endpoint, expirationTime: sub.expirationTime, keys: sub.keys }, payload);
                        } catch (err) {
                            if (err.statusCode === 404 || err.statusCode === 410) {
                                await pushSubscriptions.deleteOne({ _id: sub._id });
                            }
                            console.warn('[Notifications] Web push delivery failed:', err.message);
                        }
                    }));
                }
            } catch (pushErr) {
                console.warn('[Notifications] Web push skipped:', pushErr.message);
            }
        }

        return notification;
    } catch (dbError) {
        console.error('[Notifications] Failed to save notification to DB:', dbError);
    }
};

module.exports = { pushNotification };
