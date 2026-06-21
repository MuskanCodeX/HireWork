// Use environment variables if provided, otherwise default to relative paths in production 
// and localhost:5000 for local development. This ensures it works seamlessly anywhere.
const devHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

const rawServerUrl = import.meta.env.VITE_SERVER_URL;
const rawApiUrl = import.meta.env.VITE_API_URL;

const SERVER_BASE = (rawServerUrl && rawServerUrl.trim())
  ? rawServerUrl.trim().replace(/\/$/, '')
  : ((rawApiUrl && rawApiUrl.trim())
      ? rawApiUrl.trim().replace(/\/api\/?$/, '')
      : (import.meta.env.PROD ? '' : `http://${devHost}:5000`));

const API_BASE = (rawApiUrl && rawApiUrl.trim())
  ? rawApiUrl.trim().replace(/\/$/, '')
  : (SERVER_BASE ? `${SERVER_BASE}/api` : (import.meta.env.PROD ? '/api' : `http://${devHost}:5000/api`));

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export { API_BASE, SERVER_BASE, VAPID_PUBLIC_KEY };
