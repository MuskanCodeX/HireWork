require('dotenv').config({ path: __dirname + '/../.env' });
const { connectDB, contracts, projects } = require('../models/db');
const mongoose = require('mongoose');

async function cleanOrphans() {
    try {
        await connectDB();
        const allContracts = await contracts.find({});
        let removed = 0;
        for (const c of allContracts) {
            const projectExists = await projects.exists({ _id: c.projectId });
            if (!projectExists) {
                await contracts.deleteOne({ _id: c._id });
                removed++;
                console.log('Removed orphaned contract:', c._id);
            }
        }
        console.log('Total orphaned contracts removed:', removed);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
cleanOrphans();
