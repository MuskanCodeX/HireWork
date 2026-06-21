import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Search } from 'lucide-react';
import { getAllLearnArticles, type LearnArticle } from '../utils/markdown';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../config';
import toast from 'react-hot-toast';

const normalizeSlug = (value: string) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const Learn: React.FC = () => {
    const [articles, setArticles] = useState<LearnArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Guides',
        content: '',
        slug: '',
        primaryKeyword: '',
        tags: '',
        draft: false
    });
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.role === 'admin';

    const loadArticles = async () => {
        try {
            const data = await getAllLearnArticles();
            setArticles(data);
        } catch (error) {
            console.error("Failed to load articles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArticles();
    }, []);

    // Extract unique categories
    const categories = ['All', ...Array.from(new Set(articles.map(a => a.frontmatter.category || 'General')))];

    // Filter articles
    const filteredArticles = articles.filter(article => {
        const articleTitle = String(article.frontmatter.title || '').toLowerCase();
        const articleDescription = String(article.frontmatter.description || article.frontmatter.excerpt || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        const matchesCategory = activeCategory === 'All' || (article.frontmatter.category || 'General') === activeCategory;
        const matchesSearch = articleTitle.includes(query) || articleDescription.includes(query);
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 pt-24 pb-16">
            <Helmet>
                <title>Learn & Resources | HireWork</title>
                <meta name="description" content="Discover guides, tutorials, and career advice for modern professionals." />
            </Helmet>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header Section */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-6">
                            Learn & Grow
                        </h1>
                        <p className="text-lg text-gray-400">
                            Expert guides, tutorials, and career advice to help you succeed in the digital economy.
                        </p>
                        {isAdmin && (
                            <button
                                onClick={() => setShowAdminModal(true)}
                                className="mt-8 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                            >
                                + Create New Article
                            </button>
                        )}
                    </motion.div>
                </div>

                {/* Filters and Search */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">

                    {/* Categories */}
                    <div className="flex overflow-x-auto w-full md:w-auto pb-2 md:pb-0 gap-2 scrollbar-hide">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${activeCategory === category
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search articles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg leading-5 bg-gray-800/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-200"
                        />
                    </div>
                </div>

                {/* Article Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredArticles.map((article, index) => (
                            <motion.div
                                key={article.frontmatter.slug}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Link
                                    to={`/learn/${encodeURIComponent(article.frontmatter.slug)}`}
                                    className="group flex flex-col h-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300"
                                >
                                    <div className="p-6 flex-grow flex flex-col">
                                        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                                            <span className="bg-gray-800 text-blue-400 px-2.5 py-1 rounded-full font-medium">
                                                {article.frontmatter.category}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {article.frontmatter.readTime}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-100 mb-3 group-hover:text-blue-400 transition-colors duration-200 line-clamp-2">
                                            {article.frontmatter.title}
                                        </h3>

                                        <p className="text-gray-400 mb-6 flex-grow line-clamp-3 text-sm">
                                            {article.frontmatter.description || article.frontmatter.excerpt || 'No description available yet.'}
                                        </p>

                                        <div className="flex items-center text-sm font-medium text-blue-500 mt-auto">
                                            Read Article
                                            <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                        <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-gray-300 mb-2">No articles found</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            We couldn't find any articles matching your search criteria. Try adjusting your filters.
                        </p>
                    </div>
                )}
                {/* Admin Modal */}
                {showAdminModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Create New Article</h2>
                                <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setSaving(true);
                                try {
                                    const normalizedFormSlug = normalizeSlug(formData.slug);
                                    const res = await fetch(`${API_BASE}/learn`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${user?.token}`
                                        },
                                        body: JSON.stringify({
                                            ...formData,
                                            slug: normalizedFormSlug,
                                            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
                                        })
                                    });
                                    if (res.ok) {
                                        toast.success('Article saved!');
                                        setShowAdminModal(false);
                                        setFormData({
                                            title: '',
                                            description: '',
                                            category: 'Guides',
                                            content: '',
                                            slug: '',
                                            primaryKeyword: '',
                                            tags: '',
                                            draft: false
                                        });
                                        setLoading(true);
                                        await loadArticles();
                                    } else {
                                        const err = await res.json();
                                        toast.error(err.message);
                                    }
                                } catch (e) {
                                    toast.error('Failed to save');
                                } finally {
                                    setSaving(false);
                                }
                            }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                        <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (URL)</label>
                                        <input type="text" value={formData.slug} onChange={e => setFormData({ ...formData, slug: normalizeSlug(e.target.value) })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required placeholder="how-to-start-freelancing" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white h-20 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option>Guides</option>
                                            <option>Tutorials</option>
                                            <option>Career</option>
                                            <option>Tips</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary Keyword</label>
                                        <input type="text" value={formData.primaryKeyword} onChange={e => setFormData({ ...formData, primaryKeyword: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tags (comma separated)</label>
                                        <input type="text" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="seo, career, 2024" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Content (Markdown)</label>
                                    <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white h-64 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" required placeholder="## Introduction..." />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={formData.draft} onChange={e => setFormData({ ...formData, draft: e.target.checked })} id="draft" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                    <label htmlFor="draft" className="text-sm text-gray-400">Save as Draft</label>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-gray-800">
                                    <button type="button" onClick={() => setShowAdminModal(false)} className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">Cancel</button>
                                    <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50">
                                        {saving ? 'Saving...' : 'Publish Article'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
