const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const sendEmail = require('../utils/emailService');

const ALERT_EMAIL = (process.env.ALERT_EMAIL || 'alerts@hirework.in').trim();
const CLIENT_URL = (process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app').replace(/\/$/, '');
const HEALTH_URL = process.env.MONITOR_HEALTH_URL || `${CLIENT_URL}/api/health/deep`;
const TIMEOUT_MS = Math.max(5000, Number(process.env.MONITOR_TIMEOUT_MS || 10000));
const stateFile = path.join(__dirname, '..', 'data', 'monitor-state.json');

const readState = () => {
    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch (_) {
        return { failing: false };
    }
};

const writeState = (state) => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

const sendStatusEmail = async ({ subject, lines }) => {
    if (!ALERT_EMAIL) return;
    await sendEmail({
        email: ALERT_EMAIL,
        subject,
        message: lines.join('\n'),
        html: `<div style="font-family:Arial,sans-serif;background:#020617;color:#e5e7eb;padding:24px;"><div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,0.18);border-radius:18px;padding:24px;"><h2 style="margin-top:0;color:#f8fafc;">${subject}</h2><div>${lines.map((line) => `<p style="line-height:1.7;color:#cbd5e1;">${line}</p>`).join('')}</div></div></div>`
    });
};

const run = async () => {
    const previous = readState();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(HEALTH_URL, { signal: controller.signal });
        const body = await res.json();
        clearTimeout(timeout);

        if (!res.ok || !body.ok) {
            const nextState = {
                failing: true,
                lastFailureAt: new Date().toISOString(),
                reason: `Health endpoint failed with status ${res.status}`
            };
            writeState(nextState);
            if (!previous.failing) {
                await sendStatusEmail({
                    subject: 'HIREWORK ALERT: Health check failed',
                    lines: [
                        `Health URL: ${HEALTH_URL}`,
                        `HTTP status: ${res.status}`,
                        `Database state: ${body.database?.state || 'unknown'}`,
                        `Heap usage: ${body.memory?.heapUsagePercent || 'n/a'}%`
                    ]
                });
            }
            process.exitCode = 1;
            return;
        }

        writeState({
            failing: false,
            lastSuccessAt: new Date().toISOString(),
            reason: ''
        });

        if (previous.failing) {
            await sendStatusEmail({
                subject: 'HIREWORK RECOVERY: Health check is back to normal',
                lines: [
                    `Health URL: ${HEALTH_URL}`,
                    `Database state: ${body.database?.state || 'unknown'}`,
                    `Heap usage: ${body.memory?.heapUsagePercent || 'n/a'}%`,
                    `App uptime: ${body.app?.uptimeSeconds || 'n/a'} seconds`
                ]
            });
        }
    } catch (error) {
        clearTimeout(timeout);
        writeState({
            failing: true,
            lastFailureAt: new Date().toISOString(),
            reason: error.message
        });
        if (!previous.failing) {
            await sendStatusEmail({
                subject: 'HIREWORK ALERT: Health monitor could not reach website',
                lines: [
                    `Health URL: ${HEALTH_URL}`,
                    `Error: ${error.message}`
                ]
            });
        }
        process.exitCode = 1;
    }
};

run();
