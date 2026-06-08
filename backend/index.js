const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { initSocket } = require('./socket');
const compression = require('compression');
const { ALERT_EMAIL, getHealthSnapshot, getMemorySummary, sendMonitoringAlert } = require('./utils/monitoring');

dotenv.config();

// Trim global environment variables to prevent lookup errors (e.g., from cPanel/Vercel/Manual edits)
if (process.env.CLIENT_URL) process.env.CLIENT_URL = process.env.CLIENT_URL.trim();
if (process.env.JWT_SECRET) process.env.JWT_SECRET = process.env.JWT_SECRET.trim();
if (process.env.SMTP_HOST) process.env.SMTP_HOST = process.env.SMTP_HOST.trim();
if (process.env.SMTP_USER) process.env.SMTP_USER = process.env.SMTP_USER.trim();
if (process.env.SMTP_PASS) process.env.SMTP_PASS = process.env.SMTP_PASS.trim();
if (process.env.SMTP_PORT) process.env.SMTP_PORT = process.env.SMTP_PORT.trim();

// --- GLOBAL LOG REDIRECTOR (For cPanel/Production Debugging) ---
const serverLogFile = path.join(__dirname, 'server_logs.txt');
const stream = fs.createWriteStream(serverLogFile, { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;

const writeToLogFile = (type, args) => {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)).join(' ');
  stream.write(`[${timestamp}] [${type}] ${message}\n`);
};

console.log = (...args) => {
  writeToLogFile('INFO', args);
  originalLog.apply(console, args);
};

console.error = (...args) => {
  writeToLogFile('ERROR', args);
  originalError.apply(console, args);
};
// -------------------------------------------------------------

// --- STARTUP LOGGER ---
const logFile = path.join(__dirname, 'startup.log');
// Cap log files at 5MB to prevent disk exhaustion
try {
  const maxLogSize = 5 * 1024 * 1024;
  [logFile, serverLogFile].forEach(f => {
    try { if (fs.existsSync(f) && fs.statSync(f).size > maxLogSize) fs.writeFileSync(f, '[LOG TRUNCATED]\n'); } catch (e) { }
  });
} catch (e) { }
const log = (msg) => {
  const timestamp = new Date().toISOString();
  fs.appendFile(logFile, `[${timestamp}] ${msg}\n`, () => { });
  originalLog(`[STARTUP] ${msg}`);
};

const sendCriticalAlert = (payload) => {
  setImmediate(async () => {
    try {
      await sendMonitoringAlert(payload);
    } catch (alertErr) {
      originalError('[MONITOR ALERT ERROR]', alertErr.message);
    }
  });
};

log("--- SERVER STARTING ---");

process.on('uncaughtException', (err) => {
  const crashMsg = `[${new Date().toISOString()}] CRITICAL UNCAUGHT EXCEPTION: ${err.stack}\n`;
  try { fs.appendFileSync(path.join(__dirname, 'crash.log'), crashMsg); } catch (e) { }
  console.error(crashMsg);
  sendCriticalAlert({
    key: `uncaught:${err.message}`,
    subject: 'HIREWORK ALERT: Uncaught exception',
    intro: 'The backend hit an uncaught exception.',
    details: [
      `Message: ${err.message}`,
      `Alert email: ${ALERT_EMAIL || 'not configured'}`,
      `Environment: ${process.env.NODE_ENV || 'development'}`
    ],
    cooldownMs: 15 * 60 * 1000
  });
  if (process.env.EXIT_ON_UNCAUGHT === 'true') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  const crashMsg = `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason?.stack || reason}\n`;
  try { fs.appendFileSync(path.join(__dirname, 'crash.log'), crashMsg); } catch (e) { }
  console.error(crashMsg);
  sendCriticalAlert({
    key: `rejection:${reason?.message || reason}`,
    subject: 'HIREWORK ALERT: Unhandled promise rejection',
    intro: 'The backend hit an unhandled promise rejection.',
    details: [
      `Reason: ${reason?.message || reason}`,
      `Environment: ${process.env.NODE_ENV || 'development'}`
    ],
    cooldownMs: 15 * 60 * 1000
  });
  if (process.env.EXIT_ON_UNCAUGHT === 'true') {
    process.exit(1);
  }
});
// ----------------------

// --- STARTUP ENV VALIDATION ---
// Keep only hard requirements fatal. Optional features (Google/Razorpay/SMTP)
// should not crash the entire API process on shared hosting.
const requiredCoreEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const optionalFeatureEnvVars = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

const missingCoreVars = requiredCoreEnvVars.filter(v => !process.env[v]);
if (missingCoreVars.length > 0) {
  const msg = `FATAL: Missing required environment variables: ${missingCoreVars.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    try { fs.appendFileSync(path.join(__dirname, 'crash.log'), `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
    console.error(msg);
    process.exit(1);
  } else {
    console.error(`[WARNING] ${msg} - continuing in dev mode`);
  }
}

const missingOptionalVars = optionalFeatureEnvVars.filter(v => !process.env[v]);
if (missingOptionalVars.length > 0) {
  console.error(`[WARNING] Optional feature env vars missing: ${missingOptionalVars.join(', ')}. Related features may be disabled.`);
}
// ---

const rateLimit = require('express-rate-limit');


const app = express();
const server = http.createServer(app);

// [PERFORMANCE] Keep-alive for better connection handling
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// [PERFORMANCE] Hosting memory monitoring (alerts on system usage)
const HOST_MEMORY_WARNING_THRESHOLD = Math.min(99, Math.max(10, Number(process.env.HOST_MEMORY_THRESHOLD || 80))); // percent
let lastHostMemoryWarningAt = 0;
const HOST_MEMORY_CHECK_INTERVAL_MS = Math.max(60_000, Number(process.env.HOST_MEMORY_INTERVAL_MS || 60_000));
const MEMORY_REPORT_INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.MEMORY_REPORT_INTERVAL_MS || 30 * 60 * 1000));
setInterval(() => {
  const used = getMemorySummary();
  const systemUsagePercent = Number(used.systemUsagePercent || 0);
  if (systemUsagePercent < HOST_MEMORY_WARNING_THRESHOLD) {
    return;
  }
  const now = Date.now();
  if (now - lastHostMemoryWarningAt < 10 * 60 * 1000) {
    return;
  }
  lastHostMemoryWarningAt = now;
  console.warn(
    `[HOST MEMORY] High usage detected: system=${systemUsagePercent}% free=${used.systemFreeMb}MB rss=${used.rssMb}MB heap=${used.heapUsedMb}/${used.heapTotalMb}MB external=${used.externalMb}MB`
  );
  sendCriticalAlert({
    key: 'host-memory-high',
    subject: 'HIREWORK ALERT: Hosting memory usage is high',
    intro: 'The server is consuming an unusually high percentage of host memory.',
    details: [
      `System usage: ${systemUsagePercent}%`,
      `System free memory: ${used.systemFreeMb} MB`,
      `Resident set size: ${used.rssMb} MB`,
      `Heap usage: ${used.heapUsedMb}/${used.heapTotalMb} MB`,
      `External memory: ${used.externalMb} MB`
    ],
    cooldownMs: 6 * 60 * 60 * 1000
  });
}, HOST_MEMORY_CHECK_INTERVAL_MS);

setInterval(() => {
  const used = getMemorySummary();
  console.log(
    `[HOST MEMORY SNAPSHOT] system=${used.systemUsagePercent}% free=${used.systemFreeMb}MB rss=${used.rssMb}MB heap=${used.heapUsedMb}/${used.heapTotalMb}MB external=${used.externalMb}MB arrayBuffers=${used.arrayBuffersMb}MB`
  );
}, MEMORY_REPORT_INTERVAL_MS);

const socketToggleRaw = String(process.env.ENABLE_SOCKET_IO || '').trim().toLowerCase();
const enableSocketIO = socketToggleRaw === '' ? true : ['1', 'true', 'yes', 'on'].includes(socketToggleRaw);
if (enableSocketIO) {
  initSocket(server);
  log('Socket.IO enabled');
} else {
  log('Socket.IO disabled (set ENABLE_SOCKET_IO=true to enable)');
}

const PORT = process.env.PORT || 5000;
log(`Port identified: ${PORT}`);

const dbModels = require('./models/db');
const { connectDB } = dbModels;
const settingsModel = dbModels.settings;
log("Attempting to connect to DB...");
connectDB().then(() => log("DB Step finished (check models/db logs for success/fail)"));

mongoose.connection.on('disconnected', () => {
  sendCriticalAlert({
    key: 'db-disconnected',
    subject: 'HIREWORK ALERT: MongoDB disconnected',
    intro: 'The app lost its MongoDB connection.',
    details: [
      `Server time: ${new Date().toISOString()}`,
      `Client URL: ${(process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app').trim()}`
    ],
    cooldownMs: 30 * 60 * 1000
  });
});

mongoose.connection.on('error', (err) => {
  sendCriticalAlert({
    key: `db-error:${err.message}`,
    subject: 'HIREWORK ALERT: MongoDB error',
    intro: 'MongoDB reported a runtime error.',
    details: [
      `Error: ${err.message}`
    ],
    cooldownMs: 30 * 60 * 1000
  });
});

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://accounts.google.com", "https://apis.google.com", "https://static.cloudflareinsights.com"],
      "frame-src": ["'self'", "https://api.razorpay.com", "https://tds.razorpay.com", "https://accounts.google.com", "https://*.google.com"],
      "connect-src": ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com", "https://*.razorpay.com", "https://accounts.google.com", "https://oauth2.googleapis.com", "https://www.googleapis.com", "https://cloudflareinsights.com"],
      "img-src": ["'self'", "data:", "https://*.razorpay.com", "https://*.googleusercontent.com", "https://lh3.googleusercontent.com"],
    },
  },
}));
log("Helmet middleware loaded");

// Compress responses (if compression package is available)
if (compression) {
  app.use(compression());
  log("Compression middleware loaded");
}

app.set('trust proxy', 1); // Crucial for cPanel/Passenger to see real user IPs

// Global rate limiter: 2000 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 2000 : 10000,
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 10000, // Reduced from 200 to 10 in production
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for OTP sending (prevent email enumeration)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Very strict in production
  message: { message: 'Too many OTP requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for payment/credit endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  message: { message: 'Too many payment attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Build CORS allowlist from env (supports comma-separated domains)
const corsOrigins = (process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app')
  .split(',')
  .map(u => (u || '').trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  corsOrigins.push(
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5000',
    'http://localhost:5001'
  );
}

// Add common production variations
corsOrigins.push('https://hirework-freelance-platform.vercel.app', 'https://hirework-freelance-platform.vercel.app');

const finalOrigins = [...new Set(corsOrigins)].filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  console.log('[Startup DEBUG] Final CORS Origins:', finalOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      finalOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Blocked by CORS: ${origin}`));
  },
  credentials: true,
}));

// [PERFORMANCE] Compression for faster response (helps with slow I/O)
app.use(compression({
  level: 6,
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

const { notFound, errorHandler, requestLogger } = require('./middleware/errorMiddleware');
const { sanitizeInput } = require('./utils/sanitization');
const { ipMiddleware } = require('./middleware/ipMiddleware');
const { registrationIpLimiter, paymentIpLimiter } = require('./middleware/ipRateLimiter');

app.use(requestLogger);
app.use(ipMiddleware);
app.use(express.json({ limit: '10kb', strict: false }));
app.use(express.urlencoded({ extended: true, limit: '10kb', parameterLimit: 50 }));

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query && Object.keys(req.query).length > 0) {
    req.query = sanitizeInput(req.query);
  }
  next();
});

// HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.protocol === 'https') return next();
    res.redirect(`https://${req.hostname}${req.url}`);
  });
}

app.use('/api', globalLimiter);

const maintenanceCache = {
  enabled: false,
  endTime: null,
  whatsappLink: 'https://wa.me/91',
  instagramLink: 'https://instagram.com/hirework.in',
  lastCheckedAt: 0,
  inFlight: null
};
const MAINTENANCE_CACHE_MS = 15000;
const parseMaintenanceFlag = (value) => value === true || value === 'true' || value === 1 || value === '1';

const isStaticAssetPath = (reqPath = '') => {
  if (!reqPath) return false;
  if (reqPath.startsWith('/assets/')) return true;
  if (reqPath.startsWith('/uploads/')) return true;
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|map|txt|xml)$/i.test(reqPath);
};

const shouldBypassMaintenance = (reqPath = '') => {
  if (!reqPath) return false;
  if (reqPath.startsWith('/api/admin')) return true;
  if (reqPath === '/api/auth/login' || reqPath === '/api/auth/me' || reqPath === '/api/auth/exchange') return true;
  if (reqPath.startsWith('/admin')) return true;
  if (reqPath.startsWith('/api/debug-server')) return true;
  if (isStaticAssetPath(reqPath)) return true;
  return false;
};

const readMaintenanceMode = async () => {
  const now = Date.now();
  if (maintenanceCache.inFlight) return maintenanceCache.inFlight;
  if (now - maintenanceCache.lastCheckedAt < MAINTENANCE_CACHE_MS) {
    return maintenanceCache.enabled;
  }

  maintenanceCache.inFlight = (async () => {
    try {
      if (!settingsModel || mongoose.connection.readyState !== 1) {
        maintenanceCache.enabled = false;
      } else {
        const siteSettings = await Promise.race([
          settingsModel.findOne().select('maintenanceMode maintenanceEndTime whatsappLink instagramLink').maxTimeMS(1000).lean(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('maintenance check timeout')), 1200))
        ]);
        maintenanceCache.enabled = parseMaintenanceFlag(siteSettings?.maintenanceMode);
        maintenanceCache.endTime = siteSettings?.maintenanceEndTime ? new Date(siteSettings.maintenanceEndTime).getTime() : null;
        maintenanceCache.whatsappLink = siteSettings?.whatsappLink || 'https://wa.me/91';
        maintenanceCache.instagramLink = siteSettings?.instagramLink || 'https://instagram.com/hirework.in';
      }
    } catch (err) {
      maintenanceCache.enabled = false;
    } finally {
      maintenanceCache.lastCheckedAt = Date.now();
      const enabled = maintenanceCache.enabled;
      maintenanceCache.inFlight = null;
      return enabled;
    }
  })();

  return maintenanceCache.inFlight;
};

// Maintenance page HTML generator with countdown and social links

const getMaintenanceHtml = (endTime, whatsappLink, instagramLink) => {
  const endTimeMs = endTime ? new Date(endTime).getTime() : null;
  const hasCountdown = endTimeMs && endTimeMs > Date.now();

  const waLink = whatsappLink || 'https://wa.me/91';
  const igLink = instagramLink || 'https://instagram.com/hirework.in';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We'll Be Back | HIREWORK</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #10b981;
      --primary-glow: rgba(16, 185, 129, 0.4);
      --secondary: #06b6d4;
      --dark: #030712;
      --dark-card: rgba(17, 24, 39, 0.85);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--dark);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    
    .bg-effects {
      position: fixed;
      inset: 0;
      overflow: hidden;
      z-index: 0;
    }
    
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      animation: float 20s ease-in-out infinite;
    }
    
    .orb-1 {
      width: 600px;
      height: 600px;
      background: var(--primary-glow);
      top: -200px;
      right: -100px;
      animation-delay: 0s;
    }
    
    .orb-2 {
      width: 400px;
      height: 400px;
      background: rgba(6, 182, 212, 0.3);
      bottom: -100px;
      left: -100px;
      animation-delay: -7s;
    }
    
    .orb-3 {
      width: 300px;
      height: 300px;
      background: rgba(139, 92, 246, 0.2);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: -14s;
    }
    
    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(30px, -30px) scale(1.05); }
      50% { transform: translate(-20px, 20px) scale(0.95); }
      75% { transform: translate(20px, 30px) scale(1.02); }
    }
    
    .grid-bg {
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 60px 60px;
      z-index: 1;
    }
    
    .container {
      position: relative;
      z-index: 10;
      text-align: center;
      padding: 2rem;
      max-width: 800px;
      width: 100%;
    }
    
    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
      margin-bottom: 3rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 100px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
      animation: pulse-badge 3s ease-in-out infinite;
    }
    
    .status-dot {
      width: 10px;
      height: 10px;
      background: var(--primary);
      border-radius: 50%;
      animation: pulse-dot 2s ease-in-out infinite;
      box-shadow: 0 0 20px var(--primary-glow);
    }
    
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.7; }
    }
    
    @keyframes pulse-badge {
      0%, 100% { border-color: rgba(255,255,255,0.1); }
      50% { border-color: rgba(16, 185, 129, 0.3); }
    }
    
    .title {
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 800;
      color: var(--text);
      line-height: 1.1;
      margin-bottom: 1.5rem;
      letter-spacing: -0.03em;
    }
    
    .title span {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .description {
      font-size: 1.25rem;
      color: var(--text-muted);
      line-height: 1.7;
      max-width: 540px;
      margin: 0 auto 2rem;
    }
    
    .countdown-container {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    
    .countdown-box {
      background: var(--dark-card);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      min-width: 100px;
      backdrop-filter: blur(20px);
    }
    
    .countdown-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1;
    }
    
    .countdown-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 0.5rem;
    }
    
    .eta-box {
      display: inline-flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 2rem;
      background: var(--dark-card);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      backdrop-filter: blur(20px);
      margin-bottom: 2rem;
    }
    
    .eta-icon {
      width: 44px;
      height: 44px;
      background: rgba(16, 185, 129, 0.15);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .eta-icon svg {
      width: 22px;
      height: 22px;
      stroke: var(--primary);
    }
    
    .eta-text {
      text-align: left;
    }
    
    .eta-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    
    .eta-value {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text);
    }
    
    .social-links {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 2rem;
    }
    
    .social-link {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.3s ease;
    }
    
    .social-link:hover {
      background: rgba(16, 185, 129, 0.15);
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-3px);
    }
    
    .social-link svg {
      width: 22px;
      height: 22px;
    }
    
    .footer {
      margin-top: 3rem;
      font-size: 0.875rem;
      color: rgba(255,255,255,0.3);
    }
    
    .footer a {
      color: var(--primary);
      text-decoration: none;
    }
    
    .gear-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      opacity: 0.15;
      z-index: 5;
    }
    
    .gear {
      width: 80px;
      height: 80px;
      border: 4px solid var(--primary);
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @media (max-width: 640px) {
      .orb-1 { width: 300px; height: 300px; }
      .orb-2 { width: 200px; height: 200px; }
      .orb-3 { width: 150px; height: 150px; }
      .countdown-box { min-width: 70px; padding: 1rem; }
      .countdown-value { font-size: 1.75rem; }
    }
  </style>
</head>
<body>
  <div class="bg-effects">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>
  <div class="grid-bg"></div>
  
  <div class="container">
    <div class="logo">
      <div class="logo-icon">⚡</div>
      HIREWORK
    </div>
    
    <div class="status-badge">
      <span class="status-dot"></span>
      Under Maintenance
    </div>
    
    <h1 class="title">
      We'll Be <span>Back Soon</span>
    </h1>
    
    <p class="description">
      We're currently performing scheduled maintenance to improve our platform's performance and reliability. 
      Thank you for your patience!
    </p>
    
    ${hasCountdown ? `
    <div class="countdown-container" id="countdown">
      <div class="countdown-box">
        <div class="countdown-value" id="days">00</div>
        <div class="countdown-label">Days</div>
      </div>
      <div class="countdown-box">
        <div class="countdown-value" id="hours">00</div>
        <div class="countdown-label">Hours</div>
      </div>
      <div class="countdown-box">
        <div class="countdown-value" id="minutes">00</div>
        <div class="countdown-label">Minutes</div>
      </div>
      <div class="countdown-box">
        <div class="countdown-value" id="seconds">00</div>
        <div class="countdown-label">Seconds</div>
      </div>
    </div>
    ` : `
    <div class="eta-box">
      <div class="eta-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="eta-text">
        <div class="eta-label">Estimated Time</div>
        <div class="eta-value">A few minutes</div>
      </div>
    </div>
    `}
    
    <div class="social-links">
      <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="social-link" title="Chat on WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
      <a href="${igLink}" target="_blank" rel="noopener noreferrer" class="social-link" title="Follow on Instagram">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      </a>
    </div>
    
    <div class="footer">
      Need urgent help? <a href="mailto:support@hirework.in">Contact Support</a>
    </div>
  </div>
  
  <div class="gear-container">
    <div class="gear"></div>
  </div>
  
  ${hasCountdown ? `
  <script>
    const endTime = ${endTimeMs};
    
    function updateCountdown() {
      const now = Date.now();
      const diff = endTime - now;
      
      if (diff <= 0) {
        document.getElementById('countdown').innerHTML = '<div class="eta-box"><div class="eta-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div><div class="eta-text"><div class="eta-label">Status</div><div class="eta-value">We\'re Back!</div></div></div>';
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      document.getElementById('days').textContent = String(days).padStart(2, '0');
      document.getElementById('hours').textContent = String(hours).padStart(2, '0');
      document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
      document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
  </script>
  ` : ''}
</body>
</html>`;
};

app.use(async (req, res, next) => {
  try {
    const reqPath = (req.path || '').toString();
    if (shouldBypassMaintenance(reqPath)) return next();

    const maintenanceEnabled = await readMaintenanceMode();
    if (!maintenanceEnabled) return next();

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (reqPath.startsWith('/api/')) {
      return res.status(503).json({
        maintenanceMode: true,
        message: 'Platform is under maintenance. Please try again in some time.'
      });
    }

    // For non-API requests, redirect to home which will show maintenance page via React
    return res.redirect('/?maintenance=true');
  } catch (err) {
    return next();
  }
});

app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));
app.use('/uploads', async (req, res, next) => {
  // Block direct access to sensitive files (KYC docs, proofs, messages)
  const sensitivePattern = /^\/?(kyc-|proofs\/|msg-)/i;
  if (sensitivePattern.test(req.path)) {
    // Require auth token (header or query token for <img>/<a> access)
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : '';
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required to access this file' });
    }
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // If KYC doc, verify user is admin
      if (/^\/?kyc-/.test(req.path)) {
        const mongoose = require('mongoose');
        const User = mongoose.model('User');
        const reqUser = await User.findById(decoded.id || decoded._id);
        if (!reqUser || reqUser.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden: Admin access required for KYC documents' });
        }
      }
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.get('/api', (req, res) => {
  res.send('HIREWORK API is running');
});

// Public real-time platform statistics endpoint
app.get('/api/public-stats', async (req, res) => {
  try {
    const User = require('./models/User');
    const Project = require('./models/Project');
    const Contract = require('./models/Contract');
    const Review = require('./models/Review');

    const [freelancerCount, projectCount, contracts, reviews] = await Promise.all([
      User.countDocuments({ role: 'freelancer', status: 'active' }),
      Project.countDocuments(),
      Contract.find({ status: 'completed' }).select('totalBudget').lean().catch(() => []),
      Review.find({}).select('rating').lean().catch(() => [])
    ]);

    const realPaidOut = contracts && contracts.length > 0
      ? contracts.reduce((acc, c) => acc + (c.totalBudget || 0), 0)
      : 0;

    const avgRating = reviews && reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length)
      : 4.9;

    const satisfaction = Math.min(100, Math.round((avgRating / 5) * 100));

    res.json({
      activeFreelancers: freelancerCount || 0,
      projectsPosted: projectCount || 0,
      paidToFreelancers: realPaidOut,
      satisfactionRate: satisfaction || 98
    });
  } catch (err) {
    res.json({
      activeFreelancers: 0,
      projectsPosted: 0,
      paidToFreelancers: 0,
      satisfactionRate: 98
    });
  }
});

app.use('/api', require('./routes/monitorRoutes'));

// ─── Gig / Gig Order routes ─────────────────────────────────────────────
const gigRoutes = require('./routes/gigRoutes');
app.use('/api/gigs', gigRoutes);

// ─── Auto-expire gig orders (every 6 hours) ─────────────────────────────
const { expireOldOrders } = require('./controllers/gigController');
expireOldOrders(); // run on startup
setInterval(expireOldOrders, 6 * 60 * 60 * 1000);
// ────────────────────────────────────────────────────────────────────────


const readFileTail = (filePath, maxBytes = 64 * 1024) => {
  try {
    if (!fs.existsSync(filePath)) return 'No logs found';
    const stat = fs.statSync(filePath);
    if (!stat.size) return '';

    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);
    return buffer.toString('utf8');
  } catch (err) {
    return `Unable to read file tail: ${err.message}`;
  }
};

// --- DEBUG ROUTE (Only enabled with explicit env flag AND in development) ---
// [SECURITY FIX] Completely disabled in production regardless of env variable
const enableDebugRoute = process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_ROUTE === 'true';

if (enableDebugRoute) {
  app.all(['/api/debug-server', '/api/debug-server/:pass', '/api/debug-server/auth/:pass'], async (req, res) => {
    const fullUrl = (req.originalUrl || req.url || '').toString();
    const pass = (req.params.pass || req.query.pass || '').toString();
    const debugPass = process.env.DEBUG_ROUTE_PASS || '';
    const hasPass = debugPass && (fullUrl.includes(debugPass) || pass.includes(debugPass));
    const includeDetails = ['1', 'true', 'yes'].includes(String(req.query.details || '').toLowerCase());
    const includeLogs = String(req.query.logs || '1') !== '0';
    const projectDetailLimit = Math.min(200, Math.max(10, Number(req.query.projectLimit || 50)));

    console.log(`[Debug Dashboard] Access attempt. URL: "${fullUrl}", Params: ${JSON.stringify(req.params)}, Query: ${JSON.stringify(req.query)}`);

    if (!hasPass) {
      return res.status(401).send(`
            <h1>Unauthorized</h1>
            <hr/>
            <p>Use: <b>/api/debug-server/1708</b></p>
        `);
    }

    try {
      const logs = includeLogs ? readFileTail(serverLogFile, 48 * 1024).split('\n').slice(-120).join('\n') : 'Skipped (logs=0)';
      const crash = includeLogs ? readFileTail(path.join(__dirname, 'crash.log'), 48 * 1024).split('\n').slice(-80).join('\n') : 'Skipped (logs=0)';

      let dbStatus = 'Disconnected';
      let counts = {};
      try {
        const mongoose = require('mongoose');
        dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
        if (dbStatus === 'Connected') {
          const User = mongoose.model('User');
          const Project = mongoose.model('Project');
          const [userCount, projectCount, openProjectCount] = await Promise.all([
            User.countDocuments().maxTimeMS(1500),
            Project.countDocuments().maxTimeMS(1500),
            Project.countDocuments({ status: 'open' }).maxTimeMS(1500)
          ]);

          counts.users = userCount;
          counts.projects = projectCount;
          counts.openProjects = openProjectCount;

          if (includeDetails) {
            const projectDetails = await Project.find({})
              .select('_id title user awardedTo status createdAt updatedAt')
              .sort({ createdAt: -1 })
              .limit(projectDetailLimit)
              .lean()
              .maxTimeMS(2000);

            counts.projectDetails = projectDetails.map(p => ({
              id: p._id,
              title: p.title,
              user: p.user,
              awardedTo: p.awardedTo,
              status: p.status,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt
            }));
          }
        }
      } catch (dbErr) {
        dbStatus = 'Error: ' + dbErr.message;
      }

      res.setHeader('Content-Type', 'text/plain');
      res.send(`--- SERVER STATUS ---\nDB: ${dbStatus}\nCounts: ${JSON.stringify(counts, null, 2)}\nDetailsEnabled: ${includeDetails}\nLogsEnabled: ${includeLogs}\n\n--- SERVER LOGS ---\n${logs}\n\n--- CRASH LOGS ---\n${crash}`);
    } catch (e) {
      res.status(500).send('Error reading logs: ' + e.message);
    }
  });
}

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/contracts', require('./routes/contractRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/settings', paymentLimiter, require('./routes/settingsRoutes'));
app.use('/api/verification', require('./routes/verificationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));
app.use('/api/learn', require('./routes/learnRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/achievements', require('./routes/achievementRoutes'));
app.use('/api/gigs', require('./routes/gigRoutes'));

app.use('/sitemap.xml', require('./routes/sitemapRoutes'));

log(`Resolving static paths...`);

// Serve uploaded files securely
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '30d',      // Cache images for 30 days
  etag: true,
  lastModified: true
}));

const clientBuildPath = fs.existsSync(path.join(__dirname, '../frontend/dist'))
  ? path.join(__dirname, '../frontend/dist')
  : (fs.existsSync(path.join(__dirname, '../client/dist'))
      ? path.join(__dirname, '../client/dist')
      : path.join(__dirname, 'client/dist'));
log(`Static path resolved to: ${clientBuildPath}`);

app.use(express.static(clientBuildPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Return JSON 404 for unmatched API routes (before SPA catch-all)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  next();
});

// Catch-all to serve React app for any other unknown routes
app.get(/.*/, (req, res, next) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  if (req.path === '/') {
    return res.json({
      status: 'online',
      message: 'HIREWORK Freelance Marketplace API is live and healthy',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Error handler middlewares
app.use(notFound);
app.use(errorHandler);

setInterval(() => {
  try {
    const snapshot = getHealthSnapshot();
    if (snapshot.disk.supported && snapshot.disk.usagePercent >= 90) {
      sendCriticalAlert({
        key: 'disk-high',
        subject: 'HIREWORK ALERT: Disk usage is high',
        intro: 'Server disk usage crossed the alert threshold.',
        details: [
          `Disk usage: ${snapshot.disk.usagePercent}%`,
          `Free space: ${Math.round((snapshot.disk.free || 0) / 1024 / 1024 / 1024)} GB`
        ],
        cooldownMs: 12 * 60 * 60 * 1000
      });
    }
  } catch (monitorErr) {
    console.error('[MONITOR] Periodic disk check failed:', monitorErr.message);
  }
}, 10 * 60 * 1000);

// Export the wrapped server instead of 'app' for socket.io mapping
// Passenger handling: Use the port provided by the environment
log(`Attempting to bind server...`);
server.listen(PORT, () => {
  log(`SUCCESS: Server is live and listening.`);
});

// --- GRACEFUL SHUTDOWN ---
const gracefulShutdown = (signal) => {
  console.log(`[${signal}] Graceful shutdown initiated...`);
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// ---
