import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Clock, Calendar, ArrowLeft, Tag, Briefcase, PlusCircle, UserPlus } from 'lucide-react';
import { getLearnArticleBySlug, type LearnArticle as ArticleType } from '../utils/markdown';

export const LearnArticle: React.FC = () => {
    const params = useParams<{ slug?: string; '*': string }>();
    const location = useLocation();
    const slug = React.useMemo(() => {
        const directSlug = String(params.slug || '').trim();
        if (directSlug) return directSlug;

        const wildcardSlug = String(params['*'] || '').trim();
        if (wildcardSlug) return wildcardSlug;

        return String(location.pathname || '').replace(/^\/learn\/?/i, '').replace(/^\/+|\/+$/g, '');
    }, [params, location.pathname]);
    const [article, setArticle] = useState<ArticleType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadArticle() {
            if (slug) {
                try {
                    const data = await getLearnArticleBySlug(slug);
                    setArticle(data);
                } catch (error) {
                    console.error("Failed to load article:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        }
        loadArticle();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center text-gray-300">
                <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
                <p className="mb-8">The article you're looking for doesn't exist or has been moved.</p>
                <Link to="/learn" className="text-blue-500 hover:text-blue-400 flex items-center">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learn
                </Link>
            </div>
        );
    }

    const { frontmatter, content, toc } = article;
    const articleDescription = frontmatter.description || frontmatter.excerpt || 'Learn article on HIREWORK.';
    const articleTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const publishedDateValue = frontmatter.publishedAt || frontmatter.updatedAt || new Date().toISOString();

    // JSON-LD Schema for SEO
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": frontmatter.title,
        "description": articleDescription,
        "datePublished": frontmatter.publishedAt,
        "dateModified": frontmatter.updatedAt,
        "keywords": articleTags.join(', ')
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-300 pt-24 pb-16">
            {/* Dynamic SEO Meta Tags */}
            <Helmet>
                <title>{frontmatter.title} | HireWork Learn</title>
                <meta name="description" content={articleDescription} />
                <meta name="keywords" content={articleTags.join(', ')} />
                <link rel="canonical" href={`https://hirework-freelance-platform.vercel.app/learn/${frontmatter.slug}`} />
                <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
            </Helmet>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back Link */}
                <Link to="/learn" className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors duration-200 mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to All Articles
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Main Article Content */}
                    <article className="lg:col-span-8">

                        {/* Frontmatter Header */}
                        <header className="mb-10 border-b border-gray-800 pb-10">
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-6">
                                <span className="bg-blue-900/40 text-blue-400 px-3 py-1 rounded-full font-medium border border-blue-800/50">
                                    {frontmatter.category || 'General'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(publishedDateValue).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    {frontmatter.readTime}
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-100 mb-6 leading-tight">
                                {frontmatter.title}
                            </h1>

                            <p className="text-xl text-gray-400 leading-relaxed">
                                {articleDescription}
                            </p>
                        </header>

                        {/* Markdown Body */}
                        <div className="prose prose-invert prose-lg max-w-none prose-headings:text-gray-100 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-gray-200">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeSanitize]}
                                components={{
                                    h2: ({ node, ...props }) => {
                                        const id = props.children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                                        return <h2 id={id} className="scroll-mt-24 font-bold text-3xl mt-12 mb-6" {...props} />;
                                    },
                                    h3: ({ node, ...props }) => {
                                        const id = props.children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                                        return <h3 id={id} className="scroll-mt-24 font-bold text-2xl mt-8 mb-4" {...props} />;
                                    }
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>

                        {/* Tags Bottom */}
                        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-wrap gap-2">
                            <Tag className="w-5 h-5 text-gray-500 mr-2" />
                            {articleTags.map(tag => (
                                <span key={tag} className="bg-gray-900 border border-gray-700 text-gray-300 text-sm px-3 py-1 rounded-md">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Internal Action Links Block (Appended to Every Article) */}
                        <div className="mt-16 bg-gradient-to-br from-gray-900 to-gray-800/80 border border-gray-700/50 rounded-2xl p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>

                            <h3 className="text-2xl font-bold text-white mb-2">Ready to take the next step?</h3>
                            <p className="text-gray-400 mb-8">Join thousands of professionals building the future on HireWork.</p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Link to="/projects" className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-xl transition-colors border border-gray-700 hover:border-gray-600">
                                    <Briefcase className="w-5 h-5 text-blue-400" /> Browse Jobs
                                </Link>
                                <Link to="/post-project" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                                    <PlusCircle className="w-5 h-5" /> Post Project
                                </Link>
                                <Link to="/register" className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-xl transition-colors border border-gray-700 hover:border-gray-600">
                                    <UserPlus className="w-5 h-5 text-purple-400" /> Sign Up Free
                                </Link>
                            </div>
                        </div>

                    </article>

                    {/* Sidebar - Table of Contents */}
                    <aside className="lg:col-span-4 hidden lg:block">
                        <div className="sticky top-28 bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                            <h4 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-800 pb-4">
                                On this page
                            </h4>
                            <nav className="flex flex-col gap-3">
                                {toc.length > 0 ? (
                                    toc.map((item, index) => (
                                        <a
                                            key={index}
                                            href={`#${item.id}`}
                                            className={`text-sm transition-colors duration-200 ${item.level === 3 ? 'ml-4 text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-blue-400 font-medium'
                                                }`}
                                        >
                                            {item.text}
                                        </a>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No headings found.</p>
                                )}
                            </nav>
                        </div>
                    </aside>

                </div>
            </div>
        </div>
    );
};
