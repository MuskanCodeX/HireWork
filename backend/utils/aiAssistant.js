const fetch = require('node-fetch');

const AI_API_KEY = process.env.AI_ASSISTANT_API_KEY || '';
const AI_BASE_URL = process.env.AI_ASSISTANT_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_ASSISTANT_MODEL || 'gpt-4o-mini';
const WARN_THRESHOLD = Number(process.env.AI_SCREEN_WARN_THRESHOLD || 45);
const BLOCK_THRESHOLD = Number(process.env.AI_SCREEN_BLOCK_THRESHOLD || 75);
const SUPPORT_EMAIL = 'support@hirework.in';
const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP || 'https://wa.me/910000000000';

const CHATBOT_KNOWLEDGE_BASE = [
    {
        patterns: [/who\s+is\s+the\s+founder/i, /who\s+founded/i, /founder\b/i, /ceo\b/i],
        answer: {
            response: 'HIREWORK was founded in 2026 by an elite engineering and product team to democratize freelancing and empower digital talent across India.',
            suggestedActions: ['Open About Page', 'How does HIREWORK work?', 'How do I contact support?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/what\s+is\s+HIREWORK/i, /about\s+HIREWORK/i, /what\s+does\s+HIREWORK\s+do/i],
        answer: {
            response: 'HIREWORK is an India-based freelancing marketplace that connects freelancers and employers with secure contracts, chat, video calls, and milestone-based payments.',
            suggestedActions: ['How do I post a project?', 'How do I bid on a project?', 'Is HIREWORK free to use?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/who\s+can\s+join/i, /can\s+i\s+join/i, /who\s+can\s+use\s+HIREWORK/i],
        answer: {
            response: 'Freelancers such as developers, designers, writers, marketers, and other skilled professionals can join. Businesses and individuals looking to hire can join as employers.',
            suggestedActions: ['Create an account', 'How do I post a project?', 'How do I bid on a project?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/how\s+do\s+i\s+post\s+a\s+project/i, /post\s+(a\s+)?project/i, /create\s+(a\s+)?project/i],
        answer: {
            response: 'Sign up as an employer, open Post Job in the navigation, then add your project title, description, and budget before submitting.',
            suggestedActions: ['Post Project', 'How do I bid on a project?', 'How does payment protection work?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/how\s+do\s+i\s+bid/i, /bid\s+on\s+a\s+project/i, /apply\s+to\s+jobs/i],
        answer: {
            response: 'Sign up as a freelancer, browse projects, open the project you want, and submit your bid amount with a proposal.',
            suggestedActions: ['Browse Projects', 'Tips for getting hired', 'How does payment protection work?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/messaging/i, /message\s+users/i, /chat\s+work/i, /how\s+does\s+chat\s+work/i],
        answer: {
            response: 'You can message users from their profile or from a project page. HIREWORK chat also supports files and images.',
            suggestedActions: ['Open Inbox', 'Is there a file size limit?', 'How does payment protection work?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/file\s+size/i, /attachment\s+limit/i, /upload\s+limit/i],
        answer: {
            response: 'The chat attachment limit is 10 MB.',
            suggestedActions: ['How does messaging work?', 'How do I update my profile?', 'Contact Support'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/update\s+my\s+profile/i, /edit\s+profile/i, /change\s+my\s+profile/i],
        answer: {
            response: 'Go to your Profile page and use Edit Profile to update your name, bio, skills, and hourly rate.',
            suggestedActions: ['Open Profile', 'How to get verified', 'How do I bid on a project?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/payment\s+protection/i, /how\s+do\s+payments\s+work/i, /payments\s+secured/i, /escrow/i],
        answer: {
            response: 'HIREWORK uses milestone-based payment protection. Payment is created when a bid is awarded, the freelancer works and submits delivery, and the employer releases payment after approval.',
            suggestedActions: ['How do I post a project?', 'How do I bid on a project?', 'Contact Support'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/free\s+to\s+use/i, /is\s+HIREWORK\s+free/i, /signup\s+fee/i, /hidden\s+fees/i],
        answer: {
            response: 'Yes. HIREWORK is free to sign up and use, with zero signup fees. The platform also offers free usage and premium membership options with different limits and benefits.',
            suggestedActions: ['Membership plans', 'How do I post a project?', 'How do I bid on a project?'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/how\s+to\s+get\s+verified/i, /get\s+verified/i, /verification/i, /aadhaar/i, /phone\s+verification/i],
        answer: {
            response: 'You can request verification from your Profile page. HIREWORK uses identity checks such as Aadhaar or phone verification, and admins review pending verification requests before approval.',
            suggestedActions: ['Open Profile', 'Membership plans', 'Contact Support'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/membership/i, /badge/i, /pro\s+plan/i, /expert\s+plan/i],
        answer: {
            response: 'HIREWORK offers Pro and Expert memberships. These plans add badges and extra platform benefits such as more visibility and plan-specific limits.',
            suggestedActions: ['Open Membership Page', 'How to get verified', 'Credits'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/credits/i, /buy\s+more\s+credits/i],
        answer: {
            response: 'HIREWORK uses credits for some platform actions. You can check your credits in the navigation or membership-related sections and purchase more from the available credit packs.',
            suggestedActions: ['Open Membership Page', 'How do payments work?', 'Contact Support'],
            needsHumanSupport: false,
        },
    },
    {
        patterns: [/contact\s+support/i, /support\s+email/i, /help\s+email/i, /whatsapp/i, /contact\b/i],
        answer: {
            response: `You can contact HIREWORK support at ${SUPPORT_EMAIL} or via WhatsApp at ${SUPPORT_WHATSAPP}.`,
            suggestedActions: ['Visit Help Center', 'Email Support', 'Chat on WhatsApp'],
            needsHumanSupport: false,
        },
    },
];

const formatKnowledgeBaseForPrompt = () => CHATBOT_KNOWLEDGE_BASE.map((entry) => `- ${entry.answer.response}`).join('\n');

const getKnowledgeBaseAnswer = (userMessage = '') => {
    const normalized = String(userMessage || '').trim();
    if (!normalized) return null;

    const matchedEntry = CHATBOT_KNOWLEDGE_BASE.find((entry) => entry.patterns.some((pattern) => pattern.test(normalized)));
    return matchedEntry ? matchedEntry.answer : null;
};

const aiEnabled = () => true; // Always enabled (uses free text.pollinations.ai fallback if no key)

const extractJson = (text) => {
    if (!text) return null;

    // 1. Easy case: Clean JSON
    try {
        return JSON.parse(text);
    } catch (err) {
        // Continue to fallback
    }

    // 2. Medium case: Wrapped in markdown ```json ... ```
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        try {
            return JSON.parse(markdownMatch[1]);
        } catch (e) {
            // Continue
        }
    }

    // 3. Hard case: Try to find a loose object { ... }
    const looseMatch = text.match(/\{[\s\S]*\}/);
    if (looseMatch) {
        try {
            return JSON.parse(looseMatch[0]);
        } catch (e) {
            return null;
        }
    }

    return null;
};

const callChat = async (messages, { temperature = 0.4, maxTokens = 800 } = {}) => {
    const usePollinations = !AI_API_KEY;

    let url = `${AI_BASE_URL}/chat/completions`;
    let headers = { 'Content-Type': 'application/json' };
    let body = {
        model: AI_MODEL,
        temperature,
        max_tokens: maxTokens,
        messages
    };

    if (usePollinations) {
        url = 'https://text.pollinations.ai/';
        body = {
            messages,
            jsonMode: true,
            model: 'openai'
        };
    } else {
        headers.Authorization = `Bearer ${AI_API_KEY}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`AI request failed (${response.status}): ${errBody}`);
    }

    if (usePollinations) {
        let text = await response.text();
        // Strip pollination's injected deprecation warning that breaks JSON
        text = text.split('⚠️')[0].trim();
        // If it was valid JSON before the warning was tacked on, ensure it closes
        if (text.startsWith('{') && !text.endsWith('}')) text += '}';
        return { text, usage: null, model: 'pollinations' };
    } else {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        return {
            text,
            usage: data?.usage || null,
            model: data?.model || AI_MODEL
        };
    }
};

const fallbackBidSuggestion = (project = {}, user = {}, tone = 'professional') => {
    const username = user?.name || 'Experienced freelancer';
    const projectTitle = project?.title || 'your project';
    const description = project?.description || '';
    const introTone = {
        professional: `Hello ${project?.userName || 'there'},`,
        confident: `Hi ${project?.userName || 'team'},`,
        friendly: `Hey ${project?.userName || 'team'}!`
    };
    const paragraph = `My name is ${username} and I have successfully delivered multiple projects similar to "${projectTitle}". ${description.length > 160 ? 'I recently completed a comparable engagement and can bring that proven process here.' : 'I understand the scope and can translate your brief into a shippable solution quickly.'}`;
    return {
        proposal: `${introTone[tone] || introTone.professional}\n\n${paragraph}\n\nHere is how I plan to execute:\n• Clarify final requirements and success metrics\n• Deliver iterative builds with checkpoint demos\n• Wrap up with QA, documentation, and knowledge transfer\n\nLooking forward to collaborating on this!`,
        hook: 'Tailored execution plan ready in 24 hours',
        milestones: [
            'Discovery & final requirements alignment',
            'First working version / demo',
            'Polish, QA, and handover'
        ],
        nextSteps: ['Share any reference links or assets', 'Kick off a quick call to confirm scope']
    };
};

const generateBidSuggestion = async ({ project, user, tone = 'professional', length = 'medium' }) => {
    const lengthMapping = {
        short: '180-220 words',
        medium: '250-350 words',
        long: '400-500 words'
    };

    const safeProject = project || {};
    const safeUser = user || {};

    try {
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Proposal Copilot. Craft actionable, trustworthy freelance bids. Always respond with JSON: {"proposal": string, "hook": string, "milestones": string[], "nextSteps": string[] }'
            },
            {
                role: 'user',
                content: `Project title: ${safeProject.title || 'Untitled'}\nDescription: ${safeProject.description || ''}\nBudget: ₹${safeProject.budget || 'N/A'}\nClient name: ${safeProject.userName || 'client'}\nFreelancer: ${safeUser.name || 'Experienced freelancer'}\nTone: ${tone}\nTarget length: ${lengthMapping[length] || lengthMapping.medium}`
            }
        ], { temperature: 0.55, maxTokens: 700 });

        const parsed = extractJson(text);
        if (parsed && parsed.proposal) {
            return parsed;
        }
        return fallbackBidSuggestion(safeProject, safeUser, tone);
    } catch (err) {
        console.warn('[AI] Bid suggestion fallback triggered:', err.message);
        return fallbackBidSuggestion(safeProject, safeUser, tone);
    }
};

const heuristicsScreen = ({ title = '', description = '' }) => {
    const text = `${title}\n${description}`.toLowerCase();
    const issues = [];
    const addIssue = (label, weight) => issues.push({ label, weight });

    if (/passport|pan card|aadhaar|ssn|social security/.test(text)) {
        addIssue('Requests for IDs / personal documents', 25);
    }
    if (/crypto|bitcoin|usdt|wallet/.test(text)) {
        addIssue('Mentions crypto payouts', 20);
    }
    if (/telegram|whatsapp|signal|instagram/.test(text)) {
        addIssue('Attempts to move off-platform', 20);
    }
    if (/adult|explicit|nsfw/.test(text)) {
        addIssue('Potential adult content', 20);
    }
    if (/loan|investment scheme|double your money/.test(text)) {
        addIssue('Possible scam wording', 25);
    }

    const score = Math.min(100, issues.reduce((sum, issue) => sum + issue.weight, 0));
    const severity = score >= BLOCK_THRESHOLD ? 'block' : score >= WARN_THRESHOLD ? 'warn' : 'low';
    const blocked = severity === 'block';
    const flags = issues.map(issue => issue.label);
    const verdict = blocked ? 'high_risk' : severity === 'warn' ? 'needs_review' : 'clear';

    return {
        score,
        severity,
        verdict,
        blocked,
        flags,
        reason: flags.length ? flags.join('; ') : 'No issues detected by heuristic scan',
        provider: 'heuristic'
    };
};

const screenProjectContent = async ({ title, description }) => {
    const base = heuristicsScreen({ title, description });
    if (!aiEnabled()) {
        return base;
    }

    try {
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Trust & Safety. Evaluate the project for scams, off-platform contact, document requests, or adult/violent topics.\nReturn JSON strictly: {"score": 0-100, "verdict": "clear"|"needs_review"|"high_risk", "flags": [strings], "notes": "string", "blocked": boolean}.\nCRITICAL: The `score` represents **RISK**. 0 means perfectly safe. 100 means extreme violation. Only flag if there are definitive violations.'
            },
            {
                role: 'user',
                content: `Project title: ${title}\nProject description: ${description}`
            }
        ], { temperature: 0.2, maxTokens: 300 });

        const parsed = extractJson(text) || {};
        const score = Number(parsed.score ?? base.score ?? 0);
        const severity = score >= BLOCK_THRESHOLD ? 'block' : score >= WARN_THRESHOLD ? 'warn' : 'low';
        return {
            score,
            severity,
            verdict: parsed.verdict || (severity === 'block' ? 'high_risk' : severity === 'warn' ? 'needs_review' : 'clear'),
            blocked: typeof parsed.blocked === 'boolean' ? parsed.blocked : score >= BLOCK_THRESHOLD,
            flags: Array.isArray(parsed.flags) ? parsed.flags : base.flags,
            notes: parsed.notes || base.reason,
            provider: 'ai'
        };
    } catch (err) {
        console.warn('[AI] Project screening fallback triggered:', err.message);
        return base;
    }
};

const buildAgreementSummaryText = ({ projectDescription = '', projectRules = '', projectTimeline = '', additionalTerms = '', milestones = [] }) => {
    const milestoneText = milestones.map((m, idx) => `${idx + 1}. ${m.title || 'Milestone'} - ₹${m.amount || 0}${m.dueDate ? ` (Due: ${m.dueDate})` : ''}`).join('\n');
    return [projectDescription, projectRules, projectTimeline, additionalTerms, milestoneText].filter(Boolean).join('\n');
};

const screenAgreementContent = async ({ projectTitle = '', projectDescription = '', projectRules = '', projectTimeline = '', additionalTerms = '', milestones = [] }) => {
    const combined = buildAgreementSummaryText({ projectDescription, projectRules, projectTimeline, additionalTerms, milestones });
    const heuristic = heuristicsScreen({ title: projectTitle, description: combined });

    const flags = [...heuristic.flags];
    let score = heuristic.score || 0;

    const missingTimeline = !projectTimeline && !milestones.some(m => /day|week|month|\d{1,2}\s?(day|week|month)/i.test(m.title || '') || /\d/.test(m.dueDate || ''));
    if (missingTimeline) {
        flags.push('Timeline missing');
        score += 12;
    }

    const vagueMilestones = milestones.filter((m) => !m.title || m.title.trim().split(' ').length < 2);
    if (vagueMilestones.length) {
        flags.push('Milestones need clearer deliverables');
        score += 8;
    }

    const severity = score >= BLOCK_THRESHOLD ? 'block' : score >= WARN_THRESHOLD ? 'warn' : 'low';
    const base = {
        score,
        severity,
        verdict: severity === 'block' ? 'high_risk' : severity === 'warn' ? 'needs_review' : 'clear',
        blocked: severity === 'block',
        flags,
        notes: flags.length ? flags.join('; ') : 'No issues detected by heuristic scan',
        provider: 'heuristic'
    };

    if (!aiEnabled()) {
        return base;
    }

    try {
        const milestonePrompt = milestones.map((m, idx) => `${idx + 1}. ${m.title || 'Milestone'} - ₹${m.amount || 0}${m.dueDate ? ` (Due ${m.dueDate})` : ''}`).join('\n');
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Agreement Copilot. Evaluate for missing timelines, vague deliverables, or off-platform contact.\nReturn JSON strictly: {"score": 0-100, "verdict": "clear"|"needs_review"|"high_risk", "flags": [strings], "notes": "string", "blocked": boolean}.\nCRITICAL: The `score` represents **RISK**. 0 means perfectly safe. 100 means extreme violation. Only flag if there are definitive violations.'
            },
            {
                role: 'user',
                content: `Project: ${projectTitle}\nDescription: ${projectDescription}\nRules: ${projectRules}\nTimeline: ${projectTimeline || 'not provided'}\nExtra Terms: ${additionalTerms}\nMilestones:\n${milestonePrompt || 'N/A'}`
            }
        ], { temperature: 0.2, maxTokens: 350 });

        const parsed = extractJson(text) || {};
        const mergedFlags = Array.isArray(parsed.flags) && parsed.flags.length ? parsed.flags : flags;
        const mergedScore = Number.isFinite(parsed.score) ? parsed.score : score;
        const mergedSeverity = mergedScore >= BLOCK_THRESHOLD ? 'block' : mergedScore >= WARN_THRESHOLD ? 'warn' : 'low';
        return {
            score: mergedScore,
            severity: mergedSeverity,
            verdict: parsed.verdict || (mergedSeverity === 'block' ? 'high_risk' : mergedSeverity === 'warn' ? 'needs_review' : 'clear'),
            blocked: typeof parsed.blocked === 'boolean' ? parsed.blocked : mergedSeverity === 'block',
            flags: mergedFlags,
            notes: parsed.notes || base.notes,
            provider: 'ai'
        };
    } catch (err) {
        console.warn('[AI] Agreement screening fallback triggered:', err.message);
        return base;
    }
};

// 1. Unified Project Enhancer
const enhanceProjectDetails = async ({ title, description, budget }) => {
    const fallback = {
        title: title || 'Untitled Project',
        description: description || 'Please provide more details.'
    };

    if (!aiEnabled()) return fallback;

    try {
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Project Enhancer. Take rough project inputs and return a highly professional, attractive title and a detailed markdown description. The description MUST include clear sections for Objectives, Deliverables, and a dedicated "Timeline & Milestones" section with estimated time/cost breakdowns. NEVER generate or include fake email addresses, phone numbers, or links in your output. Return JSON ONLY: {"title": string, "description": string}'
            },
            {
                role: 'user',
                content: `Rough Title: ${title}\nRough Description: ${description}\nBudget: ₹${budget || 'Not specified'}\n\nEnhance this into a professional project posting.`
            }
        ], { temperature: 0.6, maxTokens: 1200 });

        const parsed = extractJson(text);
        if (parsed && parsed.title && parsed.description) {
            return parsed;
        }
        return fallback;
    } catch (err) {
        console.warn('[AI] Enhance project fallback:', err.message);
        return fallback;
    }
};

// 3. Calculate smart pricing recommendations
const calculateSmartPricing = async ({ projectTitle, projectDescription, userSkills = [], userExperience = '', marketData = {} }) => {
    const fallback = {
        recommendedBid: marketData.averageBid || 5000,
        minBid: marketData.minBid || 3000,
        maxBid: marketData.maxBid || 10000,
        confidence: 'low',
        reasoning: 'Based on typical project pricing. No market data available.',
        competitiveRange: { low: 3000, high: 7000 }
    };

    if (!aiEnabled()) return fallback;

    try {
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Pricing Strategist. Analyze projects and suggest competitive bid amounts in INR. Return JSON: {"recommendedBid": number, "minBid": number, "maxBid": number, "confidence": "low|medium|high", "reasoning": string, "competitiveRange": {"low": number, "high": number}}'
            },
            {
                role: 'user',
                content: `Project: ${projectTitle}\nDescription: ${projectDescription}\nFreelancer Skills: ${userSkills.join(', ') || 'Not specified'}\nExperience: ${userExperience || 'Not specified'}\nMarket Average: ₹${marketData.averageBid || 'Unknown'}\n\nSuggest optimal bid amount to be competitive yet profitable.`
            }
        ], { temperature: 0.3, maxTokens: 500 });

        const parsed = extractJson(text);
        if (parsed && parsed.recommendedBid) {
            return parsed;
        }
        return fallback;
    } catch (err) {
        console.warn('[AI] Smart pricing fallback:', err.message);
        return fallback;
    }
};

// 4. Score bid quality before submission
const scoreBidQuality = async ({ proposal, projectTitle, projectDescription, bidAmount, projectBudget }) => {
    const fallback = {
        score: 50,
        grade: 'C',
        strengths: [],
        improvements: ['Add more specific details about your approach', 'Include relevant experience examples', 'Break down your methodology'],
        verdict: 'average'
    };

    if (!aiEnabled()) return fallback;

    try {
        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Bid Quality Analyzer. Score proposals 0-100 and provide actionable feedback. Return JSON: {"score": number, "grade": "A|B|C|D|F", "strengths": string[], "improvements": string[], "verdict": "excellent|good|average|poor"}'
            },
            {
                role: 'user',
                content: `Project: ${projectTitle}\nDescription: ${projectDescription}\nBid Amount: ₹${bidAmount} (Budget: ₹${projectBudget})\n\nProposal:\n${proposal}\n\nAnalyze bid quality focusing on: relevance, professionalism, clarity, value proposition, and addressing client needs.`
            }
        ], { temperature: 0.3, maxTokens: 600 });

        const parsed = extractJson(text);
        if (parsed && typeof parsed.score === 'number') {
            return parsed;
        }
        return fallback;
    } catch (err) {
        console.warn('[AI] Bid quality scoring fallback:', err.message);
        return fallback;
    }
};

// 5. Match freelancers to project (AI-powered recommendation)
const matchFreelancersToProject = async ({ projectTitle, projectDescription, projectBudget, requiredSkills = [], freelancers = [] }) => {
    // Fallback: Simple skill matching
    const fallback = freelancers.map(freelancer => {
        const skillMatch = requiredSkills.filter(skill =>
            freelancer.skills.some(fSkill => fSkill.toLowerCase().includes(skill.toLowerCase()))
        ).length;
        const matchScore = requiredSkills.length > 0 ? (skillMatch / requiredSkills.length) * 100 : 50;

        return {
            userId: freelancer._id,
            userName: freelancer.name,
            matchScore: Math.min(100, matchScore + (freelancer.trustScore || 0) / 10),
            reasoning: skillMatch > 0 ? `Matches ${skillMatch}/${requiredSkills.length} required skills` : 'General match',
            confidence: 'low'
        };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);

    if (!aiEnabled() || freelancers.length === 0) return fallback;

    try {
        const freelancerData = freelancers.slice(0, 20).map(f => ({
            id: f._id.toString(),
            name: f.name,
            skills: f.skills,
            hourlyRate: f.hourlyRate,
            experience: f.experience,
            avgRating: f.avgRating,
            trustScore: f.trustScore,
            completedProjects: f.completedProjects || 0
        }));

        const { text } = await callChat([
            {
                role: 'system',
                content: 'You are HIREWORK Matching Engine. Score freelancers 0-100 for project fit. Return JSON: {"matches": [{"userId": string, "matchScore": number, "reasoning": string, "confidence": "low|medium|high"}]}'
            },
            {
                role: 'user',
                content: `Project: ${projectTitle}\nDescription: ${projectDescription}\nBudget: ₹${projectBudget}\nRequired Skills: ${requiredSkills.join(', ') || 'Not specified'}\n\nFreelancers:\n${JSON.stringify(freelancerData, null, 2)}\n\nRank top 10 freelancers by fit, considering skills, experience, ratings, and budget alignment.`
            }
        ], { temperature: 0.4, maxTokens: 1200 });

        const parsed = extractJson(text);
        if (parsed && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
            return parsed.matches.slice(0, 10);
        }
        return fallback;
    } catch (err) {
        console.warn('[AI] Freelancer matching fallback:', err.message);
        return fallback;
    }
};

// 6. Chatbot for platform assistance
const generateChatbotResponse = async ({ userMessage, conversationHistory = [], userContext = {} }) => {
    const fallback = {
        response: `I'm here to help with verified HIREWORK platform questions. If you need direct help, contact support at ${SUPPORT_EMAIL}.`,
        suggestedActions: ['Visit Help Center', 'Contact Support', 'Open About Page'],
        needsHumanSupport: false
    };

    if (!aiEnabled()) return fallback;

    const knowledgeBaseAnswer = getKnowledgeBaseAnswer(userMessage);
    if (knowledgeBaseAnswer) {
        return knowledgeBaseAnswer;
    }

    try {
        const contextInfo = `User Role: ${userContext.role || 'unknown'}\nUser Status: ${userContext.status || 'active'}\nVerified: ${userContext.isEmailVerified ? 'Yes' : 'No'}`;
        const platformFacts = formatKnowledgeBaseForPrompt();

        const messages = [
            {
                role: 'system',
                content: `You are HIREWORK Support Assistant. Answer only with verified information from the platform facts below. Never invent names, policies, prices, emails, or company facts. If the answer is not clearly supported by the facts, say you do not have verified information and ask the user to contact support. Be concise, friendly, and actionable. Return JSON: {"response": string, "suggestedActions": string[], "needsHumanSupport": boolean}\n\nVerified platform facts:\n${platformFacts}`
            },
            ...conversationHistory.slice(-4).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: 'user',
                content: `${contextInfo}\n\nUser Question: ${userMessage}`
            }
        ];

        const { text } = await callChat(messages, { temperature: 0.6, maxTokens: 500 });

        const parsed = extractJson(text);
        if (parsed && parsed.response) {
            return parsed;
        }
        return fallback;
    } catch (err) {
        console.warn('[AI] Chatbot response fallback:', err.message);
        return fallback;
    }
};

module.exports = {
    aiEnabled,
    callChat,
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
};
