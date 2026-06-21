
// Required frontmatter fields for any Learn Article
export interface LearnArticleFrontmatter {
    title: string;
    description?: string;
    excerpt?: string;
    category?: string;
    primaryKeyword?: string;
    publishedAt?: string;
    updatedAt?: string;
    slug: string;
    tags?: string[];
    draft?: boolean;
    readTime?: string; // Auto-calculated
}

export interface LearnArticle {
    frontmatter: LearnArticleFrontmatter;
    content: string;
    toc: { level: number; text: string; id: string }[];
}

// Calculate Read Time based on standard 200 words per minute
export function calculateReadTime(text: string): string {
    const wpm = 200;
    const words = text.trim().split(/\s+/).length;
    const time = Math.ceil(words / wpm);
    return `${time} min read`;
}

// Auto Table of Contents from headings (##, ###)
export function parseTableOfContents(markdownContent: string) {
    const toc: { level: number; text: string; id: string }[] = [];

    // Match headings starting with ## or ###
    const headingRegex = /^(#{2,3})\s+(.*)$/gm;

    let match;
    while ((match = headingRegex.exec(markdownContent)) !== null) {
        const level = match[1].length; // 2 for ##, 3 for ###
        const text = match[2];
        // Create a URL-safe ID
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        toc.push({ level, text, id });
    }

    return toc;
}

// Ensure the slug contains the primaryKeyword (SEO rule)
export function validateSlugSEO(slug: string, primaryKeyword: string): boolean {
    if (!slug || !primaryKeyword) return false;

    // Normalize both for comparison (e.g. "remote work" -> "remote-work")
    const normalizedKeyword = primaryKeyword.toLowerCase().replace(/\s+/g, '-');
    return slug.toLowerCase().includes(normalizedKeyword);
}

import { API_BASE } from '../config';

const normalizeLearnSlug = (value: string): string => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeLearnArticle = (raw: any): LearnArticle | null => {
    const frontmatter = raw?.frontmatter || {};
    const slug = normalizeLearnSlug(frontmatter.slug || '');
    if (!slug) return null;

    const safeContent = String(raw?.content || '');
    const safeToc = Array.isArray(raw?.toc) ? raw.toc : [];

    return {
        frontmatter: {
            title: String(frontmatter.title || 'Untitled'),
            description: frontmatter.description ? String(frontmatter.description) : undefined,
            excerpt: frontmatter.excerpt ? String(frontmatter.excerpt) : undefined,
            category: frontmatter.category ? String(frontmatter.category) : 'General',
            primaryKeyword: frontmatter.primaryKeyword ? String(frontmatter.primaryKeyword) : undefined,
            publishedAt: frontmatter.publishedAt ? String(frontmatter.publishedAt) : undefined,
            updatedAt: frontmatter.updatedAt ? String(frontmatter.updatedAt) : undefined,
            slug,
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map((tag: unknown) => String(tag || '').trim()).filter(Boolean) : [],
            draft: frontmatter.draft === true || frontmatter.draft === 'true',
            readTime: frontmatter.readTime ? String(frontmatter.readTime) : calculateReadTime(safeContent)
        },
        content: safeContent,
        toc: safeToc
            .map((item: any) => ({
                level: Number(item?.level || 2),
                text: String(item?.text || ''),
                id: String(item?.id || '')
            }))
            .filter((item: { level: number; text: string; id: string }) => Boolean(item.text && item.id))
    };
};

// Get all articles
export async function getAllLearnArticles(): Promise<LearnArticle[]> {
    try {
        const response = await fetch(`${API_BASE}/learn`);
        if (!response.ok) return [];
        const payload = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
            .map((item) => normalizeLearnArticle(item))
            .filter((item): item is LearnArticle => Boolean(item));
    } catch (e) {
        console.error('Error fetching learn articles:', e);
        return [];
    }
}

// Get a single article by Slug
export async function getLearnArticleBySlug(slug: string): Promise<LearnArticle | null> {
    try {
        const safeSlug = encodeURIComponent(String(slug || '').trim());
        const response = await fetch(`${API_BASE}/learn/${safeSlug}`);
        if (!response.ok) return null;
        const payload = await response.json();
        return normalizeLearnArticle(payload);
    } catch (e) {
        console.error(`Error fetching article ${slug}:`, e);
        return null;
    }
}
