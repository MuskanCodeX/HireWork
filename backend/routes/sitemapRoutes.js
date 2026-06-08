const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');

const SITEMAP_CACHE_TTL_MS = Math.max(30_000, Number(process.env.SITEMAP_CACHE_TTL_MS || 5 * 60 * 1000));
const SITEMAP_PROJECT_LIMIT = Math.max(100, Number(process.env.SITEMAP_PROJECT_LIMIT || 3000));
const SITEMAP_LEARN_LIMIT = Math.max(100, Number(process.env.SITEMAP_LEARN_LIMIT || 3000));

const sitemapCache = {
    generatedAt: 0,
    xml: '',
    inFlight: null
};

const xmlEscape = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseArticleFrontmatter = (rawContent) => {
    const regex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = rawContent.match(regex);
    if (!match) return null;

    const frontmatterRaw = match[1];
    const fields = {};
    const lines = frontmatterRaw.split(/\r?\n/);
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        fields[key] = value;
    }

    return fields;
};

const buildSitemapXml = async () => {
    const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || 'https://hirework-freelance-platform.vercel.app')
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');
    const urls = [];

    const addUrl = ({ loc, changefreq, priority, lastmod }) => {
        urls.push([
            '  <url>',
            `    <loc>${xmlEscape(loc)}</loc>`,
            changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
            Number.isFinite(priority) ? `    <priority>${priority.toFixed(1)}</priority>` : null,
            lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : null,
            '  </url>'
        ].filter(Boolean).join('\n'));
    };

    const staticRoutes = [
        { url: '/', priority: 1.0, changefreq: 'daily' },
        { url: '/projects', priority: 0.9, changefreq: 'hourly' },
        { url: '/register', priority: 0.8, changefreq: 'monthly' },
        { url: '/login', priority: 0.8, changefreq: 'monthly' },
        { url: '/about', priority: 0.7, changefreq: 'monthly' },
        { url: '/help', priority: 0.6, changefreq: 'weekly' },
        { url: '/learn', priority: 0.9, changefreq: 'daily' }
    ];
    staticRoutes.forEach(route => addUrl({ loc: `${baseUrl}${route.url}`, ...route }));

    try {
        const projects = await Project.find({ status: 'open' })
            .select('_id slug updatedAt')
            .sort({ createdAt: -1 })
            .limit(SITEMAP_PROJECT_LIMIT)
            .lean()
            .maxTimeMS(2500);

        projects.forEach(project => {
            const projectIdentifier = project.slug || project._id;
            addUrl({
                loc: `${baseUrl}/projects/${projectIdentifier}`,
                lastmod: project.updatedAt ? new Date(project.updatedAt).toISOString().split('T')[0] : null,
                changefreq: 'daily',
                priority: 0.8
            });
        });
    } catch (projectErr) {
        console.error('Sitemap project query failed:', projectErr.message);
    }

    try {
        const learnDir = path.join(__dirname, '../uploads/learn');
        if (fs.existsSync(learnDir)) {
            const files = fs.readdirSync(learnDir).filter(f => f.endsWith('.md')).slice(0, SITEMAP_LEARN_LIMIT);
            for (const file of files) {
                try {
                    const rawContent = fs.readFileSync(path.join(learnDir, file), 'utf8');
                    const fields = parseArticleFrontmatter(rawContent);
                    if (!fields?.slug) continue;
                    if (fields.draft === 'true') continue;

                    addUrl({
                        loc: `${baseUrl}/learn/${fields.slug}`,
                        lastmod: fields.updatedAt || fields.publishedAt || null,
                        changefreq: 'weekly',
                        priority: 0.8
                    });
                } catch (fileErr) {
                    console.error('Sitemap read error for file:', file, fileErr.message);
                }
            }
        }
    } catch (learnErr) {
        console.error('Sitemap learn build failed:', learnErr.message);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
};

const getSitemapXml = async () => {
    const now = Date.now();
    if (sitemapCache.xml && now - sitemapCache.generatedAt < SITEMAP_CACHE_TTL_MS) {
        return sitemapCache.xml;
    }

    if (sitemapCache.inFlight) {
        await sitemapCache.inFlight;
        return sitemapCache.xml;
    }

    sitemapCache.inFlight = (async () => {
        const xml = await buildSitemapXml();
        sitemapCache.xml = xml;
        sitemapCache.generatedAt = Date.now();
    })();

    try {
        await sitemapCache.inFlight;
    } finally {
        sitemapCache.inFlight = null;
    }

    return sitemapCache.xml;
};

router.get('/', async (req, res) => {
    try {
        const xml = await getSitemapXml();
        const maxAgeSeconds = Math.floor(SITEMAP_CACHE_TTL_MS / 1000);
        res.header('Content-Type', 'application/xml; charset=utf-8');
        res.header('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`);
        res.send(xml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        if (sitemapCache.xml) {
            res.header('Content-Type', 'application/xml; charset=utf-8');
            res.header('X-Sitemap-Stale', '1');
            return res.send(sitemapCache.xml);
        }
        res.status(500).send('Server Error generating sitemap');
    }
});

module.exports = router;
