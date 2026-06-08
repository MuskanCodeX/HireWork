const { sendMonitoringAlert } = require('../utils/monitoring');

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;

    // Detailed logging for production debugging
    console.error(`[ErrorHandler DEBUG] Error on ${req.method} ${req.url}:`, {
        message: err.message,
        stack: err.stack,
        statusCode
    });

    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
        statusCode = 404;
        message = 'Resource not found';
    }

    if (statusCode >= 500) {
        setImmediate(async () => {
            try {
                await sendMonitoringAlert({
                    key: `http-500:${req.method}:${req.route?.path || req.path || req.originalUrl}`,
                    subject: 'HIREWORK ALERT: Server error response',
                    intro: 'An API request ended with a server-side error.',
                    details: [
                        `Route: ${req.method} ${req.originalUrl}`,
                        `Message: ${message}`,
                        `Status: ${statusCode}`
                    ],
                    cooldownMs: 20 * 60 * 1000
                });
            } catch (alertErr) {
                console.error('[ErrorHandler ALERT] Failed to send monitoring email:', alertErr.message);
            }
        });
    }

    res.status(statusCode).json({
        message,
        stack: err.stack, // [TEMPORARY DEBUG] Expose stack to client
    });
};

const requestLogger = (req, res, next) => {
    const shouldLogRequests =
        process.env.REQUEST_LOGS === 'true' || process.env.NODE_ENV !== 'production';

    // Socket handshake/poll paths are very chatty; skip unless explicitly forced.
    const isSocketPath = typeof req.path === 'string' && req.path.startsWith('/socket.io/');

    if (shouldLogRequests && !isSocketPath) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
};

module.exports = { notFound, errorHandler, requestLogger };
