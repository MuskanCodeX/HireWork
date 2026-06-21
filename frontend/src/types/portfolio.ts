export interface PortfolioItem {
    _id: string;
    userId: string;
    user: {
        _id: string;
        name: string;
    };
    title: string;
    description: string;
    images: string[];
    externalLink?: string;
    status: string;
    createdAt: string;
}
