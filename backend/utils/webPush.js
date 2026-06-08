const webPush = require('web-push');

const PUBLIC_KEY = process.env.WEB_PUSH_PUBLIC_KEY;
const PRIVATE_KEY = process.env.WEB_PUSH_PRIVATE_KEY;
const CONTACT_EMAIL = process.env.WEB_PUSH_CONTACT_EMAIL || 'hello@hirework-freelance-platform.vercel.app';

let configured = false;

if (PUBLIC_KEY && PRIVATE_KEY) {
    try {
        webPush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, PUBLIC_KEY, PRIVATE_KEY);
        configured = true;
        console.log('[WebPush] VAPID keys loaded, push delivery enabled.');
    } catch (err) {
        configured = false;
        console.error('[WebPush] Failed to configure VAPID keys:', err.message);
    }
} else {
    console.warn('[WebPush] Missing VAPID keys, web push disabled.');
}

const sendWebPush = async (subscription, payload) => {
    if (!configured) return;
    return webPush.sendNotification(subscription, payload, { TTL: 60 });
};

const isWebPushEnabled = () => configured;

module.exports = {
    sendWebPush,
    isWebPushEnabled
};
