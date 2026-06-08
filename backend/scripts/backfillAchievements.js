#!/usr/bin/env node

/**
 * Quick Achievement Backfill Script
 * Run this after deploying the new achievement system to populate existing user achievements
 * 
 * Usage: node scripts/backfillAchievements.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const { checkAllAchievements, checkEarlyAdopter } = require('../utils/achievementTracker');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in environment variables');
    process.exit(1);
}

const backfillAchievements = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ Connected to MongoDB');

        // Get all active users
        const users = await User.find({ status: 'active' }).lean();
        console.log(`\n📊 Found ${users.length} active users`);

        let processed = 0;
        let errors = 0;

        for (const user of users) {
            try {
                console.log(`\n🔄 Processing: ${user.name} (${user.email})`);

                // Check all achievements for this user
                const newAchievements = await checkAllAchievements(user._id);
                const completedCount = newAchievements.filter(a => a && a.isCompleted).length;

                console.log(`  ✅ ${completedCount} achievements unlocked`);
                processed++;

                // Progress indicator
                if (processed % 10 === 0) {
                    console.log(`\n📈 Progress: ${processed}/${users.length} users processed`);
                }

            } catch (err) {
                console.error(`  ❌ Error processing ${user.name}:`, err.message);
                errors++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ BACKFILL COMPLETE!');
        console.log('='.repeat(60));
        console.log(`Total Users: ${users.length}`);
        console.log(`Successfully Processed: ${processed}`);
        console.log(`Errors: ${errors}`);
        console.log('='.repeat(60));

        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        process.exit(0);

    } catch (err) {
        console.error('\n💥 Fatal Error:', err);
        process.exit(1);
    }
};

// Run the backfill
console.log('🚀 Starting Achievement Backfill...\n');
backfillAchievements();
