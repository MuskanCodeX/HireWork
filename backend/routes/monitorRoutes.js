const express = require('express');
const mongoose = require('mongoose');
const { getHealthSnapshot } = require('../utils/monitoring');
const { warningSystem } = require('../utils/chatModeration');

const router = express.Router();

router.get('/health', (req, res) => {
    const snapshot = getHealthSnapshot({
        diagnostics: {
            activeHandles: typeof process._getActiveHandles === 'function' ? process._getActiveHandles().length : null,
            activeRequests: typeof process._getActiveRequests === 'function' ? process._getActiveRequests().length : null,
            chatWarningsTracked: warningSystem?.warnings?.size || 0
        }
    });
    const statusCode = snapshot.ok ? 200 : 503;
    res.status(statusCode).json(snapshot);
});

router.get('/health/deep', async (req, res) => {
    const snapshot = getHealthSnapshot();
    const response = {
        ...snapshot,
        checks: {
            databasePing: false,
            latencyMs: null
        }
    };

    try {
        if (mongoose.connection.readyState === 1) {
            const startedAt = Date.now();
            await mongoose.connection.db.admin().ping();
            response.checks.databasePing = true;
            response.checks.latencyMs = Date.now() - startedAt;
        }
    } catch (error) {
        response.ok = false;
        response.checks.error = error.message;
    }

    res.status(response.ok ? 200 : 503).json(response);
});

module.exports = router;
