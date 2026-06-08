const mongoose = require('mongoose');

// Import Mongoose Models
const User = require('./User');
const Project = require('./Project');
const Message = require('./Message');
const Contract = require('./Contract');
const Referral = require('./Referral');
const Review = require('./Review');
const Report = require('./Report');
const ActivityLog = require('./ActivityLog');
const Settings = require('./Settings');
const VerificationRequest = require('./VerificationRequest');
const Notification = require('./Notification');
const Otp = require('./Otp');
const Portfolio = require('./Portfolio');
const PushSubscription = require('./PushSubscription');
const Gig = require('./Gig');
const GigOrder = require('./GigOrder');

let reconnectTimer = null;
const RECONNECT_DELAY_MS = Number(process.env.DB_RECONNECT_DELAY_MS || 10000);
const shouldExitOnDbFailure = process.env.EXIT_ON_DB_FAILURE === 'true';

const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectDB();
    }, RECONNECT_DELAY_MS);
};

const connectDB = async () => {
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        return;
    }

    try {
        console.log("Connecting to MongoDB...");
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 20,
            minPoolSize: 5,
            socketTimeoutMS: 45000,
            maxIdleTimeMS: 30000
        });
        console.log(`MongoDB Connected: ${conn.connection.host} (Pool: 5-20)`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        if (process.env.NODE_ENV === 'production' && shouldExitOnDbFailure) {
            console.error('FATAL: Cannot start in production without database. Exiting.');
            process.exit(1);
        }
        console.log('Server continuing in degraded mode. Will retry DB connection...');
        scheduleReconnect();
    }
};

mongoose.connection.on('disconnected', () => {
    console.error('MongoDB disconnected. Reconnecting...');
    scheduleReconnect();
});

mongoose.connection.on('error', (err) => {
    console.error(`MongoDB runtime error: ${err.message}`);
});

module.exports = {
    connectDB,
    users: User,
    projects: Project,
    messages: Message,
    contracts: Contract,
    referrals: Referral,
    reviews: Review,
    reports: Report,
    activityLogs: ActivityLog,
    settings: Settings,
    verificationRequests: VerificationRequest,
    notifications: Notification,
    otps: Otp,
    portfolios: Portfolio,
    pushSubscriptions: PushSubscription,
    gigs: Gig,
    gigOrders: GigOrder
};
