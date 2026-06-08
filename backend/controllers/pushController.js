const { pushSubscriptions, users } = require('../models/db');
const { sendWebPush, isWebPushEnabled } = require('../utils/webPush');

const sanitizeSubscription = (body = {}) => {
    const endpoint = String(body.endpoint || '').trim();
    const expirationTime = body.expirationTime ? new Date(body.expirationTime) : null;
    const keys = body.keys || {};
    const p256dh = String(keys.p256dh || '').trim();
    const auth = String(keys.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
        return null;
    }
    return {
        endpoint,
        expirationTime: expirationTime && !Number.isNaN(expirationTime.getTime()) ? expirationTime : null,
        keys: { p256dh, auth }
    };
};

const registerPushSubscription = async (req, res) => {
    if (!isWebPushEnabled()) {
        return res.status(503).json({ message: 'Push notifications are disabled on this server.' });
    }

    const subscription = sanitizeSubscription(req.body);
    if (!subscription) {
        return res.status(400).json({ message: 'Invalid subscription payload' });
    }

    const metadata = {
        userAgent: String(req.body.userAgent || req.headers['user-agent'] || ''),
        platform: String(req.body.platform || 'web')
    };

    await pushSubscriptions.updateOne(
        { userId: req.user._id, endpoint: subscription.endpoint },
        { $set: { ...subscription, userId: req.user._id, ...metadata } },
        { upsert: true }
    );

    await users.updateOne({ _id: req.user._id }, { $set: { pushOptIn: true } });

    res.status(201).json({ message: 'Subscription saved' });
};

const unregisterPushSubscription = async (req, res) => {
    const endpoint = String(req.body?.endpoint || req.query.endpoint || '').trim();
    if (!endpoint) {
        return res.status(400).json({ message: 'Endpoint is required to unsubscribe' });
    }

    await pushSubscriptions.deleteOne({ userId: req.user._id, endpoint });
    const remaining = await pushSubscriptions.countDocuments({ userId: req.user._id });
    if (remaining === 0) {
        await users.updateOne({ _id: req.user._id }, { $set: { pushOptIn: false } });
    }

    res.json({ message: 'Subscription removed' });
};

const sendTestPush = async (req, res) => {
    if (!isWebPushEnabled()) {
        return res.status(503).json({ message: 'Push notifications are disabled on this server.' });
    }
    const subs = await pushSubscriptions.find({ userId: req.user._id }).lean();
    if (!subs.length) {
        return res.status(404).json({ message: 'No active subscriptions found' });
    }

    const payload = JSON.stringify({
        title: 'HIREWORK Alerts',
        message: 'Push notifications are active on this device.',
        link: '/notifications',
        type: 'info'
    });

    let delivered = 0;
    for (const sub of subs) {
        try {
            await sendWebPush({ endpoint: sub.endpoint, expirationTime: sub.expirationTime, keys: sub.keys }, payload);
            delivered += 1;
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                await pushSubscriptions.deleteOne({ _id: sub._id });
            }
            console.warn('[WebPush] Test delivery failed:', err.message);
        }
    }

    res.json({ message: 'Test notification dispatched', delivered });
};

module.exports = {
    registerPushSubscription,
    unregisterPushSubscription,
    sendTestPush
};
