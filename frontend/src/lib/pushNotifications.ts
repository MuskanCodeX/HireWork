import { API_BASE, VAPID_PUBLIC_KEY } from '../config';

const isPushSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!isPushSupported()) return null;
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    try {
        return await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
        console.error('[Push] Failed to register service worker:', err);
        return null;
    }
};

const sendSubscriptionToServer = async (token: string, body: unknown) => {
    await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });
};

export const subscribeToPush = async (token: string) => {
    if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser.');
    if (!VAPID_PUBLIC_KEY) throw new Error('Push notifications are disabled on this deployment.');

    const registration = await getRegistration();
    if (!registration) throw new Error('Unable to register service worker.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Push notifications require notification permission.');
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
        await sendSubscriptionToServer(token, { ...existing.toJSON(), userAgent: navigator.userAgent, platform: navigator.platform });
        return existing;
    }

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    await sendSubscriptionToServer(token, { ...subscription.toJSON(), userAgent: navigator.userAgent, platform: navigator.platform });
    return subscription;
};

export const unsubscribeFromPush = async (token: string) => {
    if (!isPushSupported()) return;
    const registration = await getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    try {
        await fetch(`${API_BASE}/push/unsubscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
    } catch (err) {
        console.warn('[Push] Failed to notify server about unsubscribe:', err);
    }

    try {
        await subscription.unsubscribe();
    } catch (err) {
        console.warn('[Push] Failed to unsubscribe locally:', err);
    }
};

export { isPushSupported };
