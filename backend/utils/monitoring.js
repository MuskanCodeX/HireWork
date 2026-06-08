const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const sendEmail = require('./emailService');

const ALERT_EMAIL = (process.env.ALERT_EMAIL || 'alerts@hirework.in').trim();
const ALERT_FROM_NAME = (process.env.ALERT_FROM_NAME || 'HIREWORK Monitor').trim();
const ALERT_COOLDOWN_MS = Math.max(60_000, Number(process.env.ALERT_COOLDOWN_MS || 30 * 60 * 1000));
const lastAlerts = new Map();

const toMb = (bytes = 0) => Number((bytes / 1024 / 1024).toFixed(1));

const getDbStateLabel = (readyState = mongoose.connection.readyState) => {
    switch (readyState) {
        case 0: return 'disconnected';
        case 1: return 'connected';
        case 2: return 'connecting';
        case 3: return 'disconnecting';
        default: return 'unknown';
    }
};

const getDiskInfo = (targetPath = __dirname) => {
    try {
        if (typeof fs.statfsSync !== 'function') {
            return { supported: false };
        }

        const stats = fs.statfsSync(path.resolve(targetPath));
        const total = Number(stats.blocks) * Number(stats.bsize);
        const free = Number(stats.bavail) * Number(stats.bsize);
        const used = Math.max(0, total - free);
        return {
            supported: true,
            total,
            free,
            used,
            usagePercent: total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0
        };
    } catch (error) {
        return { supported: false, error: error.message };
    }
};

const getMemorySummary = () => {
    const memory = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers || 0,
        rssMb: toMb(memory.rss),
        heapTotalMb: toMb(memory.heapTotal),
        heapUsedMb: toMb(memory.heapUsed),
        externalMb: toMb(memory.external),
        arrayBuffersMb: toMb(memory.arrayBuffers || 0),
        heapUsagePercent: memory.heapTotal > 0 ? Number(((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)) : 0,
        systemUsagePercent: totalMemory > 0 ? Number((((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2)) : 0,
        systemFreeMb: toMb(freeMemory),
        systemTotalMb: toMb(totalMemory)
    };
};

const getHealthSnapshot = (extra = {}) => {
    const disk = getDiskInfo(process.cwd());
    const memory = getMemorySummary();

    return {
        ok: mongoose.connection.readyState === 1,
        app: {
            env: process.env.NODE_ENV || 'development',
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            pid: process.pid,
            node: process.version
        },
        database: {
            state: getDbStateLabel(),
            readyState: mongoose.connection.readyState
        },
        memory,
        disk,
        ...extra
    };
};

const shouldSendAlert = (key, cooldownMs = ALERT_COOLDOWN_MS) => {
    const now = Date.now();
    const lastSentAt = lastAlerts.get(key) || 0;
    if (now - lastSentAt < cooldownMs) return false;
    lastAlerts.set(key, now);
    return true;
};

const sendMonitoringAlert = async ({ key, subject, intro, details = [], cooldownMs }) => {
    if (!ALERT_EMAIL) return false;
    if (!shouldSendAlert(key, cooldownMs)) return false;

    const safeDetails = details.filter(Boolean).map((item) => `<li style="margin:0 0 8px;">${item}</li>`).join('');
    const plainDetails = details.filter(Boolean).map((item) => `- ${String(item).replace(/<[^>]*>/g, '')}`).join('\n');
    const siteUrl = (process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app').trim();

    await sendEmail({
        email: ALERT_EMAIL,
        subject,
        message: `${intro}\n\n${plainDetails}\n\nCheck: ${siteUrl}`.trim(),
        html: `
        <div style="margin:0;padding:24px;background:#020617;font-family:Arial,sans-serif;color:#e5e7eb;">
          <div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,0.18);border-radius:22px;overflow:hidden;">
            <div style="padding:24px 28px;background:linear-gradient(135deg, rgba(239,68,68,0.22), rgba(245,158,11,0.16));border-bottom:1px solid rgba(148,163,184,0.14);">
              <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fca5a5;font-weight:700;">${ALERT_FROM_NAME}</div>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#f8fafc;">${subject}</h1>
            </div>
            <div style="padding:24px 28px;">
              <p style="margin:0 0 18px;line-height:1.7;color:#cbd5e1;">${intro}</p>
              ${safeDetails ? `<ul style="margin:0 0 22px;padding-left:18px;color:#cbd5e1;line-height:1.7;">${safeDetails}</ul>` : ''}
              <a href="${siteUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#10b981;color:#052e16;text-decoration:none;font-weight:700;">Open Website</a>
            </div>
          </div>
        </div>`
    });

    return true;
};

module.exports = {
    ALERT_EMAIL,
    getDbStateLabel,
    getDiskInfo,
    getMemorySummary,
    getHealthSnapshot,
    sendMonitoringAlert,
    shouldSendAlert
};
