require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { projects } = require('../models/db');

async function migrate() {
    console.log('Starting Project Slug Migration...');
    try {
        const docs = await projects.find({ slug: { $exists: false } });
        console.log(`Found ${docs.length} projects without a slug.`);

        let count = 0;
        for (const doc of docs) {
            let baseSlug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            if (!baseSlug) baseSlug = 'project';

            let slug = baseSlug;
            let existingSlug = await projects.findOne({ slug });

            // Handle duplicates gracefully during migration
            while (existingSlug) {
                const shortId = Math.random().toString(36).substring(2, 8);
                slug = `${baseSlug}-${shortId}`;
                existingSlug = await projects.findOne({ slug });
            }

            doc.slug = slug;
            await doc.save();
            console.log(`Updated project: ${doc._id} -> ${slug}`);
            count++;
        }

        console.log(`Migration completed successfully. Updated ${count} projects.`);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
