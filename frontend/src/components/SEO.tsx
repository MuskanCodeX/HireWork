import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    canonical?: string;
    type?: string;
    image?: string;
}

export const SEO = ({
    title = 'HIREWORK - Where Talent Meets Opportunity',
    description = 'Connect with top freelancers and businesses on HIREWORK. Post projects, place bids, and build your digital future.',
    canonical = 'https://hirework-freelance-platform.vercel.app',
    type = 'website',
    image = '/og-image.jpg'
}: SEOProps) => {
    const siteTitle = title.includes('HIREWORK') ? title : `${title} | HIREWORK`;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{siteTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonical} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={siteTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:url" content={canonical} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={siteTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
};
