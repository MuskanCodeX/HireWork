const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const LEARN_CACHE_TTL_MS = Math.max(10_000, Number(process.env.LEARN_CACHE_TTL_MS || 2 * 60 * 1000));
const learnCache = {
    loadedAt: 0,
    loading: null,
    bySlug: new Map(),
    publicArticles: [],
    adminArticles: [],
};

// Auto Table of Contents from headings (##, ###)
function parseTableOfContents(markdownContent) {
    const toc = [];
    const headingRegex = /^(#{2,3})\s+(.*)$/gm;
    let match;
    while ((match = headingRegex.exec(markdownContent)) !== null) {
        const level = match[1].length;
        const text = match[2];
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        toc.push({ level, text, id });
    }
    return toc;
}

// Calculate Read Time
function calculateReadTime(text) {
    const wpm = 200;
    const words = text.trim().split(/\s+/).length;
    const time = Math.ceil(words / wpm);
    return `${time} min read`;
}

// Basic Frontmatter Parser
function parseMarkdown(rawContent) {
    const regex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = rawContent.match(regex);
    if (!match) return { data: {}, content: rawContent };

    const frontmatterRaw = match[1];
    const content = match[2];

    const data = {};
    const lines = frontmatterRaw.split(/\r?\n/);
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            // remove surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            } else if (value.startsWith('[') && value.endsWith(']')) {
                // simple array parse
                value = value.slice(1, -1).split(',').map(s => {
                    s = s.trim();
                    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                        return s.slice(1, -1);
                    }
                    return s;
                });
            } else if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            }
            data[key] = value;
        }
    }

    return { data, content };
}

// Get directory path for learn articles
const getLearnDir = () => {
    // We'll store them in a persistent folder like uploads/learn
    const dir = path.join(__dirname, '../uploads/learn');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};

const slugifyLearnSlug = (value = '') => String(value)
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeFrontmatterString = (value = '') => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

const normalizeTags = (rawTags) => {
    if (Array.isArray(rawTags)) {
        return rawTags.map(tag => String(tag || '').trim()).filter(Boolean);
    }
    if (typeof rawTags === 'string') {
        return rawTags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
    }
    return [];
};

const toDateMs = (value) => {
    const parsed = new Date(value || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const getArticleTimestamp = (frontmatter = {}) => {
    return toDateMs(frontmatter.updatedAt || frontmatter.publishedAt);
};

const isDraftArticle = (frontmatter) => frontmatter?.draft === true || frontmatter?.draft === 'true';

const cloneToc = (toc) => Array.isArray(toc) ? toc.map(item => ({ ...item })) : [];
const cloneArticle = (article) => ({
    frontmatter: { ...article.frontmatter },
    content: String(article.content || ''),
    toc: cloneToc(article.toc)
});
const cloneAdminArticle = (article) => ({
    frontmatter: { ...article.frontmatter },
    content: String(article.content || '')
});

const cleanupDuplicateLearnFiles = (learnDir, canonicalSlug, legacySlug = '') => {
    const normalizedCanonicalSlug = slugifyLearnSlug(canonicalSlug);
    const normalizedLegacySlug = slugifyLearnSlug(legacySlug);
    if (!normalizedCanonicalSlug) return;

    const files = fs.readdirSync(learnDir).filter(file => file.endsWith('.md'));
    for (const file of files) {
        const fileSlug = slugifyLearnSlug(path.basename(file, '.md'));
        if (fileSlug === normalizedCanonicalSlug) continue;

        const filePath = path.join(learnDir, file);
        let frontmatterSlug = '';
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = parseMarkdown(raw);
            frontmatterSlug = slugifyLearnSlug(parsed?.data?.slug || '');
        } catch (e) {
            frontmatterSlug = '';
        }

        const isCanonicalDuplicate = frontmatterSlug && frontmatterSlug === normalizedCanonicalSlug;
        const isLegacyDuplicate = normalizedLegacySlug
            && (fileSlug === normalizedLegacySlug || frontmatterSlug === normalizedLegacySlug);

        if (isCanonicalDuplicate || isLegacyDuplicate) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                // best-effort cleanup only
            }
        }
    }
};

const invalidateLearnCache = () => {
    learnCache.loadedAt = 0;
    learnCache.bySlug = new Map();
    learnCache.publicArticles = [];
    learnCache.adminArticles = [];
};

const loadLearnCache = async () => {
    const now = Date.now();
    if (learnCache.loadedAt && now - learnCache.loadedAt < LEARN_CACHE_TTL_MS) {
        return learnCache;
    }
    if (learnCache.loading) {
        await learnCache.loading;
        return learnCache;
    }

    learnCache.loading = (async () => {
        const learnDir = getLearnDir();
        const files = fs.readdirSync(learnDir).filter(f => f.endsWith('.md'));

        const bySlug = new Map();
        const publicBySlug = new Map();
        const adminBySlug = new Map();

        for (const file of files) {
            try {
                const filePath = path.join(learnDir, file);
                const rawContent = fs.readFileSync(filePath, 'utf8');
                const { data, content } = parseMarkdown(rawContent);
                const fileSlug = path.basename(file, '.md');
                const rawSlug = String(data.slug || fileSlug).trim();
                const normalizedSlug = slugifyLearnSlug(rawSlug);
                if (!normalizedSlug) continue;

                const description = String(data.description ?? data.excerpt ?? '').trim();
                const frontmatter = {
                    ...data,
                    title: String(data.title || fileSlug).trim() || fileSlug,
                    slug: normalizedSlug,
                    description,
                    excerpt: String(data.excerpt ?? description).trim(),
                    category: String(data.category || 'General').trim() || 'General',
                    author: String(data.author || 'Admin').trim() || 'Admin',
                    primaryKeyword: String(data.primaryKeyword || '').trim(),
                    tags: normalizeTags(data.tags),
                    publishedAt: String(data.publishedAt || new Date(0).toISOString()),
                    updatedAt: String(data.updatedAt || data.publishedAt || new Date(0).toISOString())
                };
                const article = {
                    frontmatter: {
                        ...frontmatter,
                        readTime: calculateReadTime(content)
                    },
                    content,
                    toc: parseTableOfContents(content)
                };

                bySlug.set(frontmatter.slug, article);
                if (rawSlug && rawSlug !== frontmatter.slug) {
                    bySlug.set(rawSlug, article);
                }
                const adminArticle = { frontmatter, content: String(content || '') };
                const existingAdminArticle = adminBySlug.get(frontmatter.slug);
                if (!existingAdminArticle || getArticleTimestamp(frontmatter) >= getArticleTimestamp(existingAdminArticle.frontmatter)) {
                    adminBySlug.set(frontmatter.slug, adminArticle);
                }

                if (!isDraftArticle(frontmatter)) {
                    const existingPublicArticle = publicBySlug.get(frontmatter.slug);
                    if (!existingPublicArticle || getArticleTimestamp(frontmatter) >= getArticleTimestamp(existingPublicArticle.frontmatter)) {
                        publicBySlug.set(frontmatter.slug, article);
                    }
                }
            } catch (err) {
                console.error(`Error parsing article ${file}:`, err);
            }
        }

        const publicArticles = Array.from(publicBySlug.values());
        const adminArticles = Array.from(adminBySlug.values());

        // Sort newest first
        publicArticles.sort((a, b) => getArticleTimestamp(b.frontmatter) - getArticleTimestamp(a.frontmatter));
        adminArticles.sort((a, b) => getArticleTimestamp(b.frontmatter) - getArticleTimestamp(a.frontmatter));

        learnCache.bySlug = bySlug;
        learnCache.publicArticles = publicArticles;
        learnCache.adminArticles = adminArticles;
        learnCache.loadedAt = Date.now();
    })();

    try {
        await learnCache.loading;
    } finally {
        learnCache.loading = null;
    }

    return learnCache;
};

// GET /api/learn - List all articles
router.get('/', async (req, res) => {
    try {
        const cache = await loadLearnCache();
        res.json(cache.publicArticles.map(cloneArticle));
    } catch (error) {
        console.error('Error fetching learn articles:', error);
        res.status(500).json({ message: 'Server error while fetching articles' });
    }
});

// GET /api/learn/admin - List all articles (including drafts) for admin
router.get('/admin-list', protect, admin, async (req, res) => {
    try {
        const cache = await loadLearnCache();
        res.json(cache.adminArticles.map(cloneAdminArticle));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/learn/:slug - Get single article
router.get('/:slug', async (req, res) => {
    try {
        const cache = await loadLearnCache();
        const rawSlug = String(req.params.slug || '').trim();
        let decodedSlug = rawSlug;
        try {
            decodedSlug = decodeURIComponent(rawSlug);
        } catch (e) { }
        const normalizedSlug = slugifyLearnSlug(decodedSlug);
        const article = cache.bySlug.get(rawSlug) || cache.bySlug.get(decodedSlug) || cache.bySlug.get(normalizedSlug);
        if (article) {
            return res.json(cloneArticle(article));
        }

        res.status(404).json({ message: 'Article not found' });
    } catch (error) {
        console.error('Error fetching learn article:', error);
        res.status(500).json({ message: 'Server error while fetching article' });
    }
});

// ADMIN: POST /api/learn - Create/Update article
router.post('/', protect, admin, (req, res) => {
    try {
        const {
            title,
            slug,
            content,
            category,
            author,
            excerpt,
            description,
            draft,
            publishedAt,
            primaryKeyword,
            tags,
            originalSlug
        } = req.body || {};
        const normalizedSlug = slugifyLearnSlug(slug);
        const articleContent = String(content || '');
        if (!normalizedSlug || !articleContent.trim()) {
            return res.status(400).json({ message: 'Slug and content are required' });
        }

        const learnDir = getLearnDir();
        const filePath = path.join(learnDir, `${normalizedSlug}.md`);

        let existingPublishedAt = '';
        if (fs.existsSync(filePath)) {
            try {
                const existingRaw = fs.readFileSync(filePath, 'utf8');
                const existingParsed = parseMarkdown(existingRaw);
                if (existingParsed?.data?.publishedAt) {
                    existingPublishedAt = String(existingParsed.data.publishedAt);
                }
            } catch (e) { }
        }

        const finalDescription = String(description ?? excerpt ?? '').trim();
        const finalExcerpt = String(excerpt ?? finalDescription).trim();
        const finalPublishedAt = String(publishedAt || existingPublishedAt || new Date().toISOString());
        const finalUpdatedAt = new Date().toISOString();
        const finalTags = normalizeTags(tags);
        const isDraft = draft === true || draft === 'true';

        const frontmatter = [
            '---',
            `title: "${escapeFrontmatterString(title || 'Untitled')}"`,
            `description: "${escapeFrontmatterString(finalDescription)}"`,
            `excerpt: "${escapeFrontmatterString(finalExcerpt)}"`,
            `category: "${escapeFrontmatterString(category || 'General')}"`,
            `author: "${escapeFrontmatterString(author || 'Admin')}"`,
            `primaryKeyword: "${escapeFrontmatterString(primaryKeyword || '')}"`,
            `publishedAt: "${escapeFrontmatterString(finalPublishedAt)}"`,
            `updatedAt: "${escapeFrontmatterString(finalUpdatedAt)}"`,
            `slug: "${escapeFrontmatterString(normalizedSlug)}"`,
            `tags: [${finalTags.map(tag => `"${escapeFrontmatterString(tag)}"`).join(', ')}]`,
            `draft: ${isDraft}`,
            '---',
            '',
            articleContent
        ].join('\n');

        fs.writeFileSync(filePath, frontmatter, 'utf8');

        const normalizedOriginalSlug = slugifyLearnSlug(originalSlug || '');
        if (normalizedOriginalSlug && normalizedOriginalSlug !== normalizedSlug) {
            const oldFilePath = path.join(learnDir, `${normalizedOriginalSlug}.md`);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }
        cleanupDuplicateLearnFiles(learnDir, normalizedSlug, normalizedOriginalSlug);

        invalidateLearnCache();
        res.json({ message: 'Article saved successfully', slug: normalizedSlug });
    } catch (error) {
        console.error('Error saving article:', error);
        res.status(500).json({ message: 'Server error while saving article' });
    }
});

// ADMIN: DELETE /api/learn/:slug
router.delete('/:slug', protect, admin, (req, res) => {
    try {
        const learnDir = getLearnDir();
        const normalizedSlug = slugifyLearnSlug(req.params.slug);
        if (!normalizedSlug) {
            return res.status(400).json({ message: 'Invalid slug' });
        }
        const filePath = path.join(learnDir, `${normalizedSlug}.md`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            invalidateLearnCache();
            res.json({ message: 'Article deleted successfully' });
        } else {
            res.status(404).json({ message: 'Article not found' });
        }
    } catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json({ message: 'Server error while deleting article' });
    }
});

module.exports = router;
