import { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import { Save, Plus, Trash2, Edit, X, Eye } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import toast from 'react-hot-toast';

interface Article {
    frontmatter: {
        title: string;
        slug: string;
        category?: string;
        author?: string;
        publishedAt?: string;
        excerpt?: string;
        draft?: boolean;
    };
    content: string;
}

const normalizeSlug = (value: string) => value
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const AdminLearn = () => {
    const { user } = useAuth();
    const [articles, setArticles] = useState<Article[]>([]);
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: '',
        slug: '',
        category: 'Tutorial',
        author: 'Admin',
        excerpt: '',
        content: '',
        draft: false
    });

    useEffect(() => {
        fetchArticles();
    }, []);

    const fetchArticles = async () => {
        try {
            const res = await fetch(`${API_BASE}/learn/admin-list`, {
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.ok) setArticles(await res.json());
        } catch (error) {
            console.error("Error fetching articles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (article: Article) => {
        setEditingArticle(article);
        setForm({
            title: article.frontmatter.title,
            slug: normalizeSlug(article.frontmatter.slug || ''),
            category: article.frontmatter.category || 'Tutorial',
            author: article.frontmatter.author || 'Admin',
            excerpt: article.frontmatter.excerpt || '',
            content: article.content,
            draft: article.frontmatter.draft || false
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (slug: string) => {
        setArticleToDelete(null);
        try {
            const safeSlug = encodeURIComponent(normalizeSlug(slug));
            const res = await fetch(`${API_BASE}/learn/${safeSlug}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${user?.token}` }
            });
            if (res.ok) {
                toast.success('Article deleted');
                fetchArticles();
            }
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/learn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    ...form,
                    slug: normalizeSlug(form.slug),
                    originalSlug: editingArticle?.frontmatter?.slug || ''
                })
            });
            if (res.ok) {
                toast.success('Article saved successfully');
                setEditingArticle(null);
                setForm({ title: '', slug: '', category: 'Tutorial', author: 'Admin', excerpt: '', content: '', draft: false });
                fetchArticles();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Save failed');
            }
        } catch (error) {
            toast.error('Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">Loading articles...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Manage Learn Articles</h1>
                {!editingArticle && (
                    <button
                        onClick={() => setEditingArticle({ frontmatter: {} as any, content: '' })}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} /> New Article
                    </button>
                )}
            </div>

            {editingArticle && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10 shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                        <h2 className="text-xl font-bold text-emerald-400">
                            {form.slug ? `Editing: ${form.title}` : 'Create New Article'}
                        </h2>
                        <button onClick={() => setEditingArticle(null)} className="text-gray-500 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="input-field"
                                    placeholder="Setting Up Your Profile"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Slug (URL identifier)</label>
                                <input
                                    type="text"
                                    value={form.slug}
                                    onChange={e => setForm({ ...form, slug: normalizeSlug(e.target.value) })}
                                    className="input-field"
                                    placeholder="setup-profile"
                                    required
                                    disabled={!!editingArticle.frontmatter.slug}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Category</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    className="input-field"
                                >
                                    <option>Tutorial</option>
                                    <option>Guide</option>
                                    <option>Policy</option>
                                    <option>Safety</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Author</label>
                                <input
                                    type="text"
                                    value={form.author}
                                    onChange={e => setForm({ ...form, author: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div className="flex items-end pb-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.draft}
                                        onChange={e => setForm({ ...form, draft: e.target.checked })}
                                        className="w-5 h-5 accent-emerald-500"
                                    />
                                    <span className="text-gray-300 font-bold uppercase text-xs">Save as Draft</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Excerpt (Short Summary)</label>
                            <input
                                type="text"
                                value={form.excerpt}
                                onChange={e => setForm({ ...form, excerpt: e.target.value })}
                                className="input-field"
                                placeholder="Learn how to make your profile stand out to employers..."
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Content (Markdown)</label>
                            <textarea
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                className="input-field h-96 font-mono text-sm"
                                placeholder="# Heading&#10;&#10;Write your article content here in Markdown... "
                                required
                            />
                        </div>

                        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-800">
                            <button type="button" onClick={() => setEditingArticle(null)} className="btn-secondary">Cancel</button>
                            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                                <Save size={18} /> {saving ? 'Saving...' : 'Save Article'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {articles.map((article) => (
                    <div key={article.frontmatter.slug} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${article.frontmatter.draft ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                {article.frontmatter.draft ? <Eye size={20} className="opacity-50" /> : <Save size={20} />}
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{article.frontmatter.title}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-gray-500 text-xs">{article.frontmatter.category}</span>
                                    <span className="text-gray-700 font-black">•</span>
                                    <span className="text-gray-500 text-xs">{article.frontmatter.slug}</span>
                                    {article.frontmatter.draft && (
                                        <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-0.5 rounded border border-amber-500/20 uppercase">Draft</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(article)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 transition-colors">
                                <Edit size={18} />
                            </button>
                            <button onClick={() => setArticleToDelete(article.frontmatter.slug)} className="p-2 bg-gray-800 hover:bg-red-900/40 rounded-lg text-red-500 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
                {articles.length === 0 && !editingArticle && (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
                        <p className="text-gray-500">No articles found in uploads/learn. Start by creating one!</p>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!articleToDelete}
                title="Delete Article"
                message="Are you sure you want to delete this article? This action cannot be undone."
                confirmText="Delete"
                onConfirm={() => articleToDelete && handleDelete(articleToDelete)}
                onCancel={() => setArticleToDelete(null)}
                isDanger={true}
            />
        </div>
    );
};
