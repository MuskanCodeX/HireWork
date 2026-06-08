const {
    generateBidSuggestion,
    screenProjectContent,
    screenAgreementContent,
    enhanceProjectDetails,
    calculateSmartPricing,
    scoreBidQuality,
    matchFreelancersToProject,
    generateChatbotResponse,
    WARN_THRESHOLD,
    BLOCK_THRESHOLD
} = require('../utils/aiAssistant');
const { projects } = require('../models/db');
const User = require('../models/User');
const Project = require('../models/Project');

const getBidSuggestion = async (req, res) => {
    const { projectId, tone = 'professional', length = 'medium' } = req.body || {};
    if (!projectId) {
        return res.status(400).json({ message: 'projectId is required' });
    }

    const project = await projects.findById(projectId).lean();
    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    const suggestion = await generateBidSuggestion({ project, user: req.user, tone, length });
    res.json({ suggestion });
};

const manualScreenProject = async (req, res) => {
    const { title, description } = req.body || {};
    if (!title || !description) {
        return res.status(400).json({ message: 'title and description are required' });
    }

    const result = await screenProjectContent({ title, description });
    res.json({
        screening: result,
        warn: result.score >= WARN_THRESHOLD,
        blocked: result.score >= BLOCK_THRESHOLD || result.blocked
    });
};

const screenAgreement = async (req, res) => {
    const { projectTitle, projectDescription, projectRules, projectTimeline, additionalTerms, milestones } = req.body || {};
    const result = await screenAgreementContent({ projectTitle, projectDescription, projectRules, projectTimeline, additionalTerms, milestones: Array.isArray(milestones) ? milestones : [] });
    res.json({
        screening: result,
        warn: result.score >= WARN_THRESHOLD,
        blocked: result.score >= BLOCK_THRESHOLD || result.blocked
    });
};

// Generate enhanced project posting from rough details
const enhanceProject = async (req, res) => {
    const { title, description, budget } = req.body || {};

    if (!title || !description) {
        return res.status(400).json({ message: 'title and description are required' });
    }

    const enhanced = await enhanceProjectDetails({
        title,
        description,
        budget
    });

    res.json({ enhanced });
};

// Get smart pricing recommendations
const getSmartPricing = async (req, res) => {
    const { projectId } = req.body || {};

    if (!projectId) {
        return res.status(400).json({ message: 'projectId is required' });
    }

    try {
        const project = await Project.findById(projectId).lean();
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Calculate market data from existing bids
        const marketData = {};
        if (project.bids && project.bids.length > 0) {
            const bidAmounts = project.bids.map(b => b.amount).filter(a => a > 0);
            if (bidAmounts.length > 0) {
                marketData.averageBid = Math.round(bidAmounts.reduce((a, b) => a + b, 0) / bidAmounts.length);
                marketData.minBid = Math.min(...bidAmounts);
                marketData.maxBid = Math.max(...bidAmounts);
            }
        }

        const pricing = await calculateSmartPricing({
            projectTitle: project.title,
            projectDescription: project.description,
            userSkills: req.user.skills || [],
            userExperience: req.user.experience || '',
            marketData
        });

        res.json({ pricing });
    } catch (err) {
        console.error('[AI] Smart pricing error:', err.message);
        res.status(500).json({ message: 'Error calculating pricing' });
    }
};

// Score bid quality before submission
const scoreBid = async (req, res) => {
    const { proposal, projectId, bidAmount } = req.body || {};

    if (!proposal || !projectId || !bidAmount) {
        return res.status(400).json({ message: 'proposal, projectId, and bidAmount are required' });
    }

    try {
        const project = await Project.findById(projectId).lean();
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const score = await scoreBidQuality({
            proposal,
            projectTitle: project.title,
            projectDescription: project.description,
            bidAmount,
            projectBudget: project.budget
        });

        res.json({ score });
    } catch (err) {
        console.error('[AI] Bid scoring error:', err.message);
        res.status(500).json({ message: 'Error scoring bid' });
    }
};

// Get AI-matched freelancers for a project
const getMatchedFreelancers = async (req, res) => {
    const { projectId, limit = 10 } = req.body || {};

    if (!projectId) {
        return res.status(400).json({ message: 'projectId is required' });
    }

    try {
        const project = await Project.findById(projectId).lean();
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Get active freelancers with good trust scores
        const freelancers = await User.find({
            role: 'freelancer',
            status: 'active',
            trustScore: { $gte: 30 }
        })
            .sort({ trustScore: -1, avgRating: -1 })
            .limit(50)
            .lean();

        const matches = await matchFreelancersToProject({
            projectTitle: project.title,
            projectDescription: project.description,
            projectBudget: project.budget,
            requiredSkills: project.requiredSkills || [],
            freelancers
        });

        res.json({ matches: matches.slice(0, limit) });
    } catch (err) {
        console.error('[AI] Freelancer matching error:', err.message);
        res.status(500).json({ message: 'Error matching freelancers' });
    }
};

// Chatbot assistant for platform help
const chatbotAssist = async (req, res) => {
    const { message, conversationHistory } = req.body || {};

    if (!message) {
        return res.status(400).json({ message: 'message is required' });
    }

    const userContext = {
        role: req.user.role,
        status: req.user.status,
        isEmailVerified: req.user.isEmailVerified,
        badge: req.user.badge
    };

    const response = await generateChatbotResponse({
        userMessage: message,
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        userContext
    });

    res.json({ response });
};

module.exports = {
    getBidSuggestion,
    manualScreenProject,
    screenAgreement,
    enhanceProject,
    getSmartPricing,
    scoreBid,
    getMatchedFreelancers,
    chatbotAssist
};
