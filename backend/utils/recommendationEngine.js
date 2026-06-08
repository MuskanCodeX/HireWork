const fetch = require('node-fetch');

const RECOMMENDER_ENDPOINT = process.env.RECOMMENDER_ENDPOINT;
const RECOMMENDER_TOKEN = process.env.RECOMMENDER_TOKEN;

const requestRemoteRecommendations = async (payload) => {
    if (!RECOMMENDER_ENDPOINT) return [];
    try {
        const res = await fetch(RECOMMENDER_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(RECOMMENDER_TOKEN ? { Authorization: `Bearer ${RECOMMENDER_TOKEN}` } : {})
            },
            body: JSON.stringify(payload),
            timeout: 4000
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data?.recommendations)) {
            return data.recommendations
                .map((item) => ({ id: item.projectId || item.id, score: Number(item.score) || 0 }))
                .filter((item) => item.id);
        }
        return [];
    } catch (err) {
        console.warn('[RECO] Remote recommender unavailable:', err.message);
        return [];
    }
};

const buildUserVector = (user = {}) => ({
    id: user._id?.toString?.() || 'anonymous',
    role: user.role || 'freelancer',
    skills: Array.isArray(user.skills) ? user.skills : [],
    trustScore: user.trustScore || 0,
    avgRating: user.avgRating || 0,
    experience: user.experience || '',
    badges: [user.badge, user.trustBadge].filter(Boolean)
});

const scoreProjectLocally = (project, userVector) => {
    const skills = userVector.skills.map((s) => s.toLowerCase());
    const haystack = `${project.title || ''} ${project.description || ''}`.toLowerCase();
    const matches = skills.reduce((acc, skill) => (skill && haystack.includes(skill) ? acc + 1 : acc), 0);
    const freshnessBoost = Math.max(0, 1 - (Date.now() - new Date(project.createdAt || Date.now()).getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Add a small random jitter so the fallback recommendation feed 
    // doesn't look completely identical to the "New/All Projects" feed
    const randomJitter = Math.random() * 2;

    return matches * 10 + freshnessBoost * 5 + randomJitter + (project.budget || 0) / 10000;
};

const buildRecommendationPayload = (userVector, contextProjects = []) => ({
    user: userVector,
    context: contextProjects.map((project) => ({
        id: project._id?.toString?.(),
        title: project.title,
        budget: project.budget,
        tags: project.tags || [],
        description: project.description
    }))
});

module.exports = {
    requestRemoteRecommendations,
    buildUserVector,
    scoreProjectLocally,
    buildRecommendationPayload
};
