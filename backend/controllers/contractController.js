const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { contracts, projects, users } = require('../models/db');
const { logActivity } = require('../utils/activityLogger');
const { pushNotification } = require('../utils/notificationPusher');
const { rewardReferralBonusesForCompletedContract } = require('../utils/referralRewards');
const { detectOutsideCommunication, WARNING_MESSAGE } = require('../utils/sanitization');
const { clearUserWarnings, clearProjectAwardCache } = require('../utils/chatModeration');
const { screenAgreementContent } = require('../utils/aiAssistant');
const sendEmail = require('../utils/emailService');
const { buildAgreementEmail } = require('../utils/emailTemplates');
const { trackProjectAchievements, trackEarningsAchievements } = require('../utils/achievementTracker');

const buildIdVariants = (id) => {
    const variants = [];
    if (!id) return variants;
    const str = typeof id === 'string' ? id : id.toString();
    variants.push(str, id);
    if (mongoose.Types.ObjectId.isValid(str)) {
        variants.push(new mongoose.Types.ObjectId(str));
    }
    return variants;
};

const buildStatusEvent = (status, label, actor = {}) => {
    let actorRole = actor.role || 'system';
    if (actorRole === 'admin') {
        actorRole = 'system';
    }
    return {
        status,
        label,
        actorId: actor._id || null,
        actorName: actor.name || actor.userName || null,
        actorRole,
        createdAt: new Date()
    };
};

const appendStatusHistory = async (contractId, event) => {
    if (!contractId || !event) return;
    try {
        await contracts.updateOne({ _id: contractId }, { $push: { statusHistory: event } });
    } catch (err) {
        console.warn('[CONTRACT] Failed to append status history:', err.message);
    }
};


// Multer config for payment proof images
const proofsDir = path.join(__dirname, '../uploads/proofs');
try { if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true }); } catch (e) { console.error('Could not create uploads/proofs:', e.message); }

const proofStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, proofsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const proofUpload = multer({
    storage: proofStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = /image|pdf/.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image or PDF files allowed'));
    },
});

/**
 * Generate the full agreement text that will be verified in case of disputes
 */
const generateAgreementFullText = (projectTitle, totalAmount, milestones, projectDescription, projectRules, projectTimeline, additionalTerms, employerName, freelancerName) => {
    let agreementText = `PROJECT AGREEMENT\n`;
    agreementText += `=================\n\n`;
    agreementText += `Project: ${projectTitle}\n`;
    agreementText += `Employer: ${employerName}\n`;
    agreementText += `Freelancer: ${freelancerName}\n`;
    agreementText += `Total Amount: ₹${totalAmount}\n\n`;

    if (projectDescription) {
        agreementText += `PROJECT DESCRIPTION & REQUIREMENTS\n`;
        agreementText += `----------------------------------\n${projectDescription}\n\n`;
    }

    agreementText += `PAYMENT MILESTONES (${milestones.length} Parts)\n`;
    agreementText += `--------------------------------\n`;
    milestones.forEach((m, i) => {
        agreementText += `${i + 1}. ${m.title}: ₹${m.amount}\n`;
    });

    if (projectRules) {
        agreementText += `\nPROJECT RULES & TERMS\n`;
        agreementText += `--------------------\n${projectRules}\n`;
    }

    if (projectTimeline) {
        agreementText += `\nTIMELINE & DEADLINES\n`;
        agreementText += `-------------------\n${projectTimeline}\n`;
    }

    if (additionalTerms) {
        agreementText += `\nADDITIONAL TERMS\n`;
        agreementText += `----------------\n${additionalTerms}\n`;
    }

    agreementText += `\n---\n`;
    agreementText += `This agreement is legally binding. In case of any dispute, only the details mentioned in this agreement will be considered for resolution. Both parties agree to the terms stated above.\n`;
    agreementText += `Generated on: ${new Date().toISOString()}\n`;

    return agreementText;
};

/**
 * POST /api/contracts
 * Employer sends an agreement proposal to freelancer (no credits deducted yet).
 * Freelancer must accept for the contract to become active.
 */
const createContract = async (req, res) => {
    const { projectId, freelancerId, freelancerName, amount, milestones, projectDescription, projectRules, projectTimeline, additionalTerms } = req.body;

    if (!projectId || !freelancerId || !freelancerName || !amount) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check for outside communication attempts in all text fields
    const fieldsToCheck = [
        { value: projectDescription, name: 'Project Description' },
        { value: projectRules, name: 'Project Rules' },
        { value: projectTimeline, name: 'Project Timeline' },
        { value: additionalTerms, name: 'Additional Terms' },
    ];

    for (const field of fieldsToCheck) {
        if (field.value) {
            const check = detectOutsideCommunication(field.value);
            if (check) {
                return res.status(400).json({ 
                    message: WARNING_MESSAGE,
                    warning: true,
                    detectedType: check.type,
                    label: check.label
                });
            }
        }
    }

    // Also check milestone titles
    if (milestones && Array.isArray(milestones)) {
        for (const milestone of milestones) {
            if (milestone.title) {
                const check = detectOutsideCommunication(milestone.title);
                if (check) {
                    return res.status(400).json({ 
                        message: WARNING_MESSAGE,
                        warning: true,
                        detectedType: check.type,
                        label: check.label
                    });
                }
            }
        }
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: 'Contract amount must be a positive number' });
    }
    
    if (numAmount > 10000000) {
        return res.status(400).json({ message: 'Contract amount cannot exceed ₹1,00,00,000' });
    }

    // [SECURITY] Validate text field lengths
    if (projectDescription && (typeof projectDescription !== 'string' || projectDescription.length > 5000)) {
        return res.status(400).json({ message: 'Project description must be less than 5000 characters' });
    }
    if (projectRules && (typeof projectRules !== 'string' || projectRules.length > 3000)) {
        return res.status(400).json({ message: 'Project rules must be less than 3000 characters' });
    }
    if (projectTimeline && (typeof projectTimeline !== 'string' || projectTimeline.length > 2000)) {
        return res.status(400).json({ message: 'Project timeline must be less than 2000 characters' });
    }
    if (additionalTerms && (typeof additionalTerms !== 'string' || additionalTerms.length > 2000)) {
        return res.status(400).json({ message: 'Additional terms must be less than 2000 characters' });
    }

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
        return res.status(400).json({ message: 'At least one milestone is required' });
    }

    // Prevent self-awarding trap
    if (freelancerId.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot send an agreement to yourself' });
    }

    const project = await projects.findOne({ _id: projectId });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!project.user || project.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the project owner can send an agreement' });
    }
    if (project.status === 'awarded') {
        return res.status(400).json({ message: 'Project already awarded to another freelancer' });
    }

    // Check if there's already a pending agreement for this project
    const existingPendingContract = await contracts.findOne({
        projectId,
        agreementStatus: 'pending'
    });
    if (existingPendingContract) {
        return res.status(400).json({ message: 'There is already a pending agreement for this project. Wait for the freelancer to respond.' });
    }

    // Prevent Silent Contract Kidnapping / Credit Siphoning
    const bidMatch = project.bids && project.bids.find(b => b.userId && b.userId.toString() === freelancerId.toString());
    if (!bidMatch) {
        return res.status(400).json({ message: 'This freelancer has not formally placed a bid on your project' });
    }
    const resolvedFreelancerName = bidMatch.userName || freelancerName || 'Freelancer';

    const freelancerUser = await users.findOne({ _id: { $in: buildIdVariants(freelancerId) } });
    if (!freelancerUser) {
        return res.status(404).json({ message: 'Freelancer account not found' });
    }

    let validMilestones = true;
    const formattedMilestones = milestones.map((m, i) => {
        const mAmount = Number(m.amount);
        if (isNaN(mAmount) || mAmount <= 0) validMilestones = false;
        
        // [SECURITY] Validate milestone amount limits
        if (mAmount > 10000000) {
            validMilestones = false;
        }

        // [SECURITY] Sanitize milestone title
        const sanitizedTitle = typeof m.title === 'string' ? m.title.trim().slice(0, 200) : `Part ${i + 1}`;

        return {
            index: i,
            title: sanitizedTitle,
            amount: Math.round(mAmount * 100) / 100, // Round to 2 decimal places
            status: 'pending',
            taskDoneByEmployer: false,
            taskDoneByFreelancer: false,
            taskConfirmed: false,
            paidNote: '',
            proofImage: null,
            paidAt: null,
            confirmedAt: null,
            dueDate: m.dueDate || ''
        };
    });

    if (!validMilestones) {
        return res.status(400).json({ message: 'All milestone amounts must be valid positive numbers (max ₹1,00,00,000)' });
    }

    // [SECURITY] Validate total contract amount
    const totalMilestoneAmount = formattedMilestones.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(totalMilestoneAmount - numAmount) > 1) {
        return res.status(400).json({ message: 'Total milestone amounts must equal contract amount' });
    }

    const aiScreening = await screenAgreementContent({
        projectTitle: project.title,
        projectDescription,
        projectRules,
        projectTimeline,
        additionalTerms,
        milestones
    });

    if (aiScreening && (aiScreening.blocked || aiScreening.severity === 'block')) {
        return res.status(400).json({
            message: 'AI detected risky agreement text. Please clarify milestones or remove sensitive content.',
            warning: true,
            aiWarning: aiScreening
        });
    }

    const contractId = new mongoose.Types.ObjectId();

    // Create pending agreement (no credits deducted yet, project stays open)
    let contract;
    try {
        contract = await contracts.create({
            _id: contractId,
            projectId,
            projectTitle: project.title,
            employerId: req.user._id,
            employerName: req.user.name,
            freelancerId: freelancerUser._id,
            freelancerName: resolvedFreelancerName,
            amount: numAmount,
            milestones: formattedMilestones,
            projectDescription: projectDescription || '',
            projectRules: projectRules || '',
            projectTimeline: projectTimeline || '',
            additionalTerms: additionalTerms || '',
            agreementFullText: generateAgreementFullText(project.title, numAmount, formattedMilestones, projectDescription, projectRules, projectTimeline, additionalTerms, req.user.name, resolvedFreelancerName),
            agreementAiSummary: aiScreening ? { ...aiScreening, checkedAt: new Date() } : undefined,
            status: 'active', // keeping status active but agreementStatus is pending
            agreementStatus: 'pending', // waiting for freelancer to accept
            statusHistory: [
                buildStatusEvent('drafted', 'Agreement drafted', req.user),
                buildStatusEvent('sent', 'Agreement sent to freelancer', req.user)
            ],
            thread: [],
            threadLocked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    } catch (err) {
        throw err;
    }

    // Update project to track pending agreement (but keep status open)
    await projects.updateOne(
        { _id: projectId },
        {
            $set: {
                pendingAgreementTo: freelancerUser._id,
                pendingAgreementToName: resolvedFreelancerName,
                pendingContractId: contractId
            }
        }
    );

    // Log activity
    await logActivity(req.user._id, req.user.name, req.user.role, 'sent_agreement', `Sent agreement proposal to ${resolvedFreelancerName} for project: ${project.title}`, contract._id);

    // Notify Freelancer
    await pushNotification(
        freelancerUser._id,
        'info',
        'New Agreement Received',
        `${req.user.name} has sent you an agreement for "${project.title}". Please review and accept or cancel.`,
        '/contract'
    );

    if (freelancerUser.email) {
        const { subject, message, html } = buildAgreementEmail({
            freelancerName: freelancerUser.name || resolvedFreelancerName,
            senderName: req.user.name,
            projectTitle: project.title,
            amount: numAmount,
            milestones: formattedMilestones
        });
        sendEmail({
            email: freelancerUser.email,
            subject,
            message,
            html
        }).catch(err => console.warn('[EMAIL] Agreement notification failed:', err.message));
    }

    const payload = contract.toObject ? contract.toObject() : contract;
    res.status(201).json({
        ...payload,
        message: 'Agreement sent! The freelancer needs to accept it for the project to start.',
        aiWarning: aiScreening && aiScreening.severity === 'warn' ? aiScreening : undefined
    });
};

/**
 * GET /api/contracts
 * Returns all agreements where the logged-in user is employer OR freelancer.
 */
const getMyContracts = async (req, res) => {
    const userId = req.user._id;
    const myContracts = await contracts.find({
        $or: [{ employerId: userId }, { freelancerId: userId }]
    }).sort({ updatedAt: -1 });

    const projectIds = myContracts.map(c => c.projectId);

    // Find which of these projects still exist
    const existingProjects = await projects.find({ _id: { $in: projectIds } }).select('_id');
    const existingProjectIds = new Set(existingProjects.map(p => p._id.toString()));

    const validContracts = myContracts.filter(c => existingProjectIds.has(c.projectId.toString()));

    // Auto-cleanup orphaned contracts silently in background
    const orphanedIds = myContracts.filter(c => !existingProjectIds.has(c.projectId.toString())).map(c => c._id);
    if (orphanedIds.length > 0) {
        try {
            contracts.deleteMany({ _id: { $in: orphanedIds } }).catch(e => console.error("Auto-cleanup error:", e));
        } catch (e) {
            console.error(e);
        }
    }

    res.status(200).json(validContracts);
};

/**
 * GET /api/contracts/:id
 */
const getContractById = async (req, res) => {
    const contract = await contracts.findOne({ _id: req.params.id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    // Check if the parent project still exists
    const { projects } = require('../models/db');
    const projectExists = await projects.exists({ _id: contract.projectId });
    if (!projectExists) {
        // Auto-cleanup
        contracts.deleteOne({ _id: contract._id }).catch(e => console.error("Auto-cleanup error:", e));
        return res.status(404).json({ message: 'Agreement not found (Project was deleted)' });
    }

    if (contract.employerId.toString() !== req.user._id.toString() && contract.freelancerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this agreement' });
    }
    res.status(200).json(contract);
};

const getAgreementThread = async (req, res) => {
    const contract = await contracts.findOne({ _id: req.params.id }).select('thread threadLocked agreementStatus employerId freelancerId');
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    const isParticipant = contract.employerId.toString() === req.user._id.toString() || contract.freelancerId.toString() === req.user._id.toString();
    if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this agreement thread' });
    }

    res.status(200).json({
        thread: contract.thread || [],
        threadLocked: contract.threadLocked || contract.agreementStatus !== 'pending'
    });
};

const addAgreementThreadMessage = async (req, res) => {
    const { message } = req.body || {};
    if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const contract = await contracts.findOne({ _id: req.params.id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    const isFreelancer = contract.freelancerId.toString() === req.user._id.toString();
    const isEmployer = contract.employerId.toString() === req.user._id.toString();
    if (!isFreelancer && !isEmployer) {
        return res.status(403).json({ message: 'Not authorized to comment on this agreement' });
    }

    if (contract.threadLocked || contract.agreementStatus !== 'pending') {
        return res.status(400).json({ message: 'Agreement thread is locked. Please use regular chat for new messages.' });
    }

    const comment = {
        userId: req.user._id,
        userName: req.user.name,
        role: isEmployer ? 'employer' : 'freelancer',
        message: message.trim(),
        createdAt: new Date()
    };

    await contracts.updateOne({ _id: contract._id }, { $push: { thread: comment }, $set: { updatedAt: new Date() } });

    const targetUserId = isEmployer ? contract.freelancerId : contract.employerId;
    await pushNotification(
        targetUserId,
        'info',
        'Agreement Comment',
        `${req.user.name} commented on the agreement for "${contract.projectTitle}".`,
        '/contract'
    );

    const updated = await contracts.findOne({ _id: contract._id }).select('thread threadLocked');
    res.status(201).json({ thread: updated.thread, threadLocked: updated.threadLocked });
};

/**
 * PATCH /api/contracts/:id/milestone/:milestoneIndex/task-done
 * Either party marks the task as completed on their end.
 * When BOTH confirm → taskConfirmed = true → client can pay.
 */
const confirmTaskDone = async (req, res) => {
    const { id, milestoneIndex } = req.params;
    const mIdx = Number(milestoneIndex);

    const contract = await contracts.findOne({ _id: id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    if (contract.employerId.toString() !== req.user._id.toString() && contract.freelancerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
    }
    // Only allow milestones on accepted agreements
    if (contract.agreementStatus !== 'accepted') {
        return res.status(400).json({ message: 'Cannot modify milestones on a pending or cancelled agreement' });
    }
    if (contract.status !== 'active') {
        return res.status(400).json({ message: `Cannot modify a milestone while the agreement is ${contract.status}` });
    }
    if (!contract.milestones || mIdx < 0 || mIdx >= contract.milestones.length) {
        return res.status(400).json({ message: 'Invalid milestone index' });
    }

    const milestoneRaw = contract.milestones[mIdx];
    const milestone = milestoneRaw && typeof milestoneRaw.toObject === 'function' ? milestoneRaw.toObject() : { ...milestoneRaw };
    const milestoneStatus = milestone.status || 'pending';

    if (milestoneStatus !== 'pending') {
        return res.status(400).json({ message: `Cannot confirm task on a milestone that is already ${milestoneStatus}` });
    }

    const updateField = contract.employerId.toString() === req.user._id.toString() ? `milestones.${mIdx}.taskDoneByEmployer` : `milestones.${mIdx}.taskDoneByFreelancer`;

    // Data Race Fix: Atomically set the specific user's confirmation flag
    await contracts.updateOne(
        { _id: id },
        { $set: { [updateField]: true, updatedAt: new Date() } }
    );

    // Re-fetch to atomically check the state combined
    const updatedContract = await contracts.findOne({ _id: id });
    const updatedMilestone = updatedContract.milestones[mIdx];

    if (updatedMilestone.taskDoneByEmployer && updatedMilestone.taskDoneByFreelancer && !updatedMilestone.taskConfirmed) {
        await contracts.updateOne(
            { _id: id, [`milestones.${mIdx}.taskConfirmed`]: false },
            { $set: { [`milestones.${mIdx}.taskConfirmed`]: true } }
        );
    }

    const finalContract = await contracts.findOne({ _id: id });

    // Notify the other party
    const targetUserId = req.user._id.toString() === finalContract.employerId.toString() ? finalContract.freelancerId : finalContract.employerId;
    await pushNotification(
        targetUserId,
        'info',
        'Milestone Task Update',
        `${req.user.name} has marked their task as done for milestone "${milestone.title}".`,
        '/contract'
    );

    res.status(200).json(finalContract);
};

/**
 * PATCH /api/contracts/:id/milestone/:milestoneIndex/paid
 * Client marks a milestone as paid. Accepts multipart/form-data with optional proof image.
 * Fields: note (text), proofImage (file)
 */
const markMilestonePaid = async (req, res) => {
    const { id, milestoneIndex } = req.params;
    const mIdx = Number(milestoneIndex);

    const contract = await contracts.findOne({ _id: id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    if (contract.employerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the client can mark payment as sent' });
    }
    if (contract.agreementStatus !== 'accepted') {
        return res.status(400).json({ message: 'Cannot modify milestones on a pending or cancelled agreement' });
    }
    if (contract.status !== 'active') {
        return res.status(400).json({ message: `Cannot modify a milestone while the agreement is ${contract.status}` });
    }
    if (!contract.milestones || mIdx < 0 || mIdx >= contract.milestones.length) {
        return res.status(400).json({ message: 'Invalid milestone index' });
    }

    const milestone = contract.milestones[mIdx];
    const mStatus = milestone.status || 'pending';
    if (mStatus !== 'pending') {
        return res.status(400).json({ message: `Milestone already ${mStatus}` });
    }
    if (!milestone.taskConfirmed) {
        return res.status(400).json({ message: 'Both parties must confirm task completion before payment' });
    }

    const proofImageUrl = req.file ? `/uploads/proofs/${req.file.filename}` : null;

    // Data Race Fix: Use atomic $set on the specific milestone array index
    await contracts.updateOne(
        { _id: id },
        {
            $set: {
                [`milestones.${mIdx}.status`]: 'paid',
                [`milestones.${mIdx}.paidNote`]: req.body.note || '',
                [`milestones.${mIdx}.proofImage`]: proofImageUrl,
                [`milestones.${mIdx}.paidAt`]: new Date(),
                updatedAt: new Date()
            }
        }
    );

    const updatedContract = await contracts.findOne({ _id: id });

    // Notify the freelancer that money is sent
    await pushNotification(
        contract.freelancerId,
        'success',
        'Payment Sent',
        `${req.user.name} has sent the payment for milestone "${milestone.title}". Please confirm receipt.`,
        '/contract'
    );

    res.status(200).json(updatedContract);
};

/**
 * PATCH /api/contracts/:id/milestone/:milestoneIndex/confirm
 * Freelancer confirms they received payment for this milestone.
 */
const confirmMilestoneReceived = async (req, res) => {
    const { id, milestoneIndex } = req.params;
    const mIdx = Number(milestoneIndex);

    const contract = await contracts.findOne({ _id: id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    if (contract.freelancerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the freelancer can confirm receipt' });
    }
    if (contract.agreementStatus !== 'accepted') {
        return res.status(400).json({ message: 'Cannot modify milestones on a pending or cancelled agreement' });
    }
    if (contract.status !== 'active') {
        return res.status(400).json({ message: `Cannot modify a milestone while the agreement is ${contract.status}` });
    }
    if (!contract.milestones || mIdx < 0 || mIdx >= contract.milestones.length) {
        return res.status(400).json({ message: 'Invalid milestone index' });
    }

    const milestone = contract.milestones[mIdx];
    const mStatus = milestone.status || 'pending';
    if (mStatus !== 'paid') {
        return res.status(400).json({ message: 'Client has not marked this milestone as paid yet' });
    }

    // Data Race Fix: Atomic update
    await contracts.updateOne(
        { _id: id },
        {
            $set: {
                [`milestones.${mIdx}.status`]: 'confirmed',
                [`milestones.${mIdx}.confirmedAt`]: new Date(),
                updatedAt: new Date()
            }
        }
    );

    const updatedContract = await contracts.findOne({ _id: id });

    await logActivity(req.user._id, req.user.name, req.user.role, 'milestone_confirmed', `Confirmed payment received for milestone ${milestoneIndex}`, contract._id);

    // Notify Employer
    await pushNotification(
        contract.employerId,
        'success',
        'Payment Confirmed',
        `${req.user.name} confirmed receiving payment for milestone "${milestone.title}".`,
        '/contract'
    );

    // If all milestones confirmed → agreement completed
    const allConfirmed = updatedContract.milestones.every(m => m.status === 'confirmed');
    if (allConfirmed) {
        const completionTimestamp = new Date();
        // [SECURITY] Atomic state transition to prevent double rewards if multiple milestones confirm at once
        const updateResult = await contracts.updateOne(
            { _id: id, status: { $ne: 'completed' } },
            { $set: { status: 'completed', completedAt: completionTimestamp } }
        );

        if (updateResult.modifiedCount > 0) {
            updatedContract.status = 'completed';

            // Reflect completion on the underlying project for dashboards/My Projects views
            if (contract.projectId) {
                await projects.updateOne(
                    { _id: contract.projectId },
                    { $set: { status: 'completed', completedAt: completionTimestamp } }
                );
            }

            // Notify both parties of completion
            await pushNotification(
                contract.employerId,
                'success',
                'Contract Completed',
                `All milestones for "${contract.projectTitle}" are complete! You can now leave a review.`,
                '/contract'
            );
            await pushNotification(
                contract.freelancerId,
                'success',
                'Contract Completed',
                `All milestones for "${contract.projectTitle}" are complete! You can now leave a review.`,
                '/contract'
            );

            // Referral reward logic for first completed contract (works for both roles).
            try {
                const completedContract = await contracts.findOne({ _id: updatedContract._id });
                await rewardReferralBonusesForCompletedContract(completedContract);
            } catch (refErr) {
                console.error('Referral reward error:', refErr);
            }

            // Track achievements for project completion
            try {
                // Update freelancer's completed project count
                const freelancer = await users.findById(contract.freelancerId);
                if (freelancer) {
                    const completedCount = (freelancer.completedProjects || 0) + 1;
                    await users.updateOne(
                        { _id: contract.freelancerId },
                        { $set: { completedProjects: completedCount } }
                    );
                    await trackProjectAchievements(contract.freelancerId, completedCount);
                }

                // Track earnings achievements for freelancer
                if (contract.finalAmount && contract.finalAmount > 0) {
                    const freelancerUser = await users.findById(contract.freelancerId);
                    if (freelancerUser) {
                        const newTotalEarnings = (freelancerUser.totalEarnings || 0) + contract.finalAmount;
                        await trackEarningsAchievements(contract.freelancerId, newTotalEarnings);
                    }
                }
            } catch (achievementErr) {
                console.error('[Achievement] Error tracking completion achievements:', achievementErr.message);
            }
        }
    }

    res.status(200).json(updatedContract);
};

/**
 * PATCH /api/contracts/:id/dispute
 * Either party can raise a dispute.
 */
const raiseDispute = async (req, res) => {
    const contract = await contracts.findOne({ _id: req.params.id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    if (contract.employerId.toString() !== req.user._id.toString() && contract.freelancerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
    }

    if (contract.status === 'completed' || contract.status === 'disputed' || contract.status === 'cancelled') {
        return res.status(400).json({ message: `Cannot dispute an agreement that is already ${contract.status}` });
    }

    const { reason, type, milestoneIndex } = req.body || {};
    const cleanedReason = typeof reason === 'string' ? reason.trim() : '';
    const disputeType = typeof type === 'string' && type.trim() ? type.trim() : 'general';
    const evidenceImageUrl = req.file ? `/uploads/proofs/${req.file.filename}` : null;

    let parsedMilestoneIndex = null;
    if (milestoneIndex !== undefined && milestoneIndex !== null && milestoneIndex !== '') {
        parsedMilestoneIndex = Number(milestoneIndex);
        if (!Number.isInteger(parsedMilestoneIndex) || parsedMilestoneIndex < 0 || parsedMilestoneIndex >= contract.milestones.length) {
            return res.status(400).json({ message: 'Invalid milestone index for dispute' });
        }
    }

    const raisedByRole = contract.employerId.toString() === req.user._id.toString() ? 'employer' : 'freelancer';
    const safeReason = cleanedReason || 'Dispute raised without a written reason.';

    // Fixed race condition causing data clobbering when disputing concurrently with milestone updates
    const updateResult = await contracts.updateOne(
        { _id: contract._id, status: { $nin: ['completed', 'disputed'] } },
        {
            $set: {
                status: 'disputed',
                dispute: {
                    raisedById: req.user._id,
                    raisedByName: req.user.name,
                    raisedByRole,
                    type: disputeType,
                    reason: safeReason,
                    milestoneIndex: parsedMilestoneIndex,
                    evidenceImage: evidenceImageUrl,
                    createdAt: new Date()
                },
                disputeResolution: null,
                updatedAt: new Date()
            }
        }
    );

    if (updateResult.modifiedCount === 0) {
        return res.status(400).json({ message: 'Agreement state changed before dispute could be raised.' });
    }

    const updatedContract = await contracts.findOne({ _id: contract._id });

    await logActivity(
        req.user._id,
        req.user.name,
        req.user.role,
        'raised_dispute',
        `Raised a dispute on contract "${contract.projectTitle}"`,
        contract._id
    );

    const targetUserId = raisedByRole === 'employer' ? contract.freelancerId : contract.employerId;
    await pushNotification(
        targetUserId,
        'warning',
        'Contract Disputed',
        `${req.user.name} raised a dispute on "${contract.projectTitle}". Admin review has been requested.`,
        '/contract'
    );

    res.status(200).json(updatedContract);
};

/**
 * POST /api/contracts/:id/respond
 * Freelancer responds to an agreement: accepts or cancels.
 * Employer can also cancel the agreement before freelancer accepts.
 * If accepted: credits deducted from both, project awarded.
 * If cancelled: agreement cancelled, no credits deducted, project stays open, freelancer can bid again.
 */
const respondToAgreement = async (req, res) => {
    const { action } = req.body; // 'accept' or 'cancel'

    if (!action || !['accept', 'cancel'].includes(action)) {
        return res.status(400).json({ message: 'Action must be either "accept" or "cancel"' });
    }

    const contract = await contracts.findOne({ _id: req.params.id });
    if (!contract) return res.status(404).json({ message: 'Agreement not found' });

    const isFreelancer = contract.freelancerId.toString() === req.user._id.toString();
    const isEmployer = contract.employerId.toString() === req.user._id.toString();

    // Only freelancer can accept, but both can cancel
    if (action === 'accept') {
        if (!isFreelancer) {
            return res.status(403).json({ message: 'Only the freelancer can accept this agreement' });
        }
    } else if (action === 'cancel') {
        if (!isFreelancer && !isEmployer) {
            return res.status(403).json({ message: 'Only the freelancer or employer can cancel this agreement' });
        }
    }

    // Can only respond to pending agreements
    if (contract.agreementStatus !== 'pending') {
        return res.status(400).json({ message: `This agreement has already been ${contract.agreementStatus}` });
    }

    // Additional check: verify project still has this as pending agreement
    const project = await projects.findOne({ _id: contract.projectId });
    if (!project) {
        await contracts.updateOne({ _id: contract._id }, { $set: { agreementStatus: 'cancelled' } });
        return res.status(404).json({ message: 'Project not found' });
    }

    // Check if this contract is still the pending agreement in the project
    if (project.pendingContractId && project.pendingContractId.toString() !== contract._id.toString()) {
        await contracts.updateOne({ _id: contract._id }, { $set: { agreementStatus: 'cancelled' } });
        return res.status(400).json({ message: 'This agreement is no longer valid. A newer agreement has been sent.' });
    }

    if (action === 'cancel') {
        // Cancel agreement - no credits deducted
        await contracts.updateOne(
            { _id: contract._id },
            { $set: { agreementStatus: 'cancelled', status: 'cancelled', threadLocked: true, updatedAt: new Date() }, $push: { statusHistory: buildStatusEvent('cancelled', 'Agreement cancelled', req.user) } }
        );

        // Clear pending agreement from project
        await projects.updateOne(
            { _id: contract.projectId },
            { $unset: { pendingAgreementTo: '', pendingAgreementToName: '', pendingContractId: '' } }
        );

        const cancelledBy = isFreelancer ? 'freelancer' : 'employer';
        await logActivity(req.user._id, req.user.name, req.user.role, 'cancelled_agreement', `Cancelled agreement for project: ${contract.projectTitle} (by ${cancelledBy})`, contract._id);

        // Notify the other party
        const notifyUserId = isFreelancer ? contract.employerId : contract.freelancerId;
        const notifyUserName = isFreelancer ? contract.employerName : contract.freelancerName;
        await pushNotification(
            notifyUserId,
            'info',
            'Agreement Cancelled',
            `${req.user.name} has cancelled the agreement for "${contract.projectTitle}". You can now bid on this project again.`,
            `/projects/${contract.projectId}`
        );

        return res.status(200).json({ message: `Agreement cancelled by ${cancelledBy}. No credits were deducted. The freelancer can now bid on this project again.` });
    }

    // ACTION = ACCEPT
    // Deduct credits from both parties using atomic operations
    const employerIdVariants = buildIdVariants(contract.employerId);
    const freelancerIdVariants = buildIdVariants(contract.freelancerId);
    const CREDIT_COST = 1;

    // [SECURITY] Use atomic update with findOneAndUpdate for better race condition protection
    // First check both users have enough credits
    const [employerUser, freelancerUser] = await Promise.all([
        users.findOne({ _id: { $in: employerIdVariants } }),
        users.findOne({ _id: { $in: freelancerIdVariants } })
    ]);

    if (!employerUser || !freelancerUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    if ((employerUser.credits || 0) < CREDIT_COST) {
        return res.status(402).json({
            needsCredits: true,
            party: 'employer',
            message: 'The client does not have enough credits. Please wait for them to add credits.'
        });
    }

    if ((freelancerUser.credits || 0) < CREDIT_COST) {
        return res.status(402).json({
            needsCredits: true,
            party: 'freelancer',
            message: 'You need at least 1 credit to accept this agreement. Please buy credits first.'
        });
    }

    // Re-verify contract is still pending (prevent race conditions)
    const currentContract = await contracts.findById(contract._id);
    if (!currentContract || currentContract.agreementStatus !== 'pending') {
        return res.status(400).json({ message: `This agreement has already been ${currentContract?.agreementStatus || 'cancelled'}` });
    }

    // Atomically deduct credits using findOneAndUpdate for each user
    const [empResult, freeResult] = await Promise.all([
        users.findOneAndUpdate(
            { _id: { $in: employerIdVariants }, credits: { $gte: CREDIT_COST } },
            { $inc: { credits: -CREDIT_COST } },
            { new: true }
        ),
        users.findOneAndUpdate(
            { _id: { $in: freelancerIdVariants }, credits: { $gte: CREDIT_COST } },
            { $inc: { credits: -CREDIT_COST } },
            { new: true }
        )
    ]);

    if (!empResult || !freeResult) {
        // Rollback if either failed
        if (empResult) {
            await users.updateOne({ _id: { $in: employerIdVariants } }, { $inc: { credits: CREDIT_COST } });
        }
        return res.status(402).json({
            needsCredits: true,
            message: 'Transaction failed due to insufficient credits. Please try again.'
        });
    }

    // Mark agreement as accepted
    await contracts.updateOne(
        { _id: contract._id },
        {
            $set: { agreementStatus: 'accepted', status: 'active', threadLocked: true, updatedAt: new Date() },
            $push: { statusHistory: buildStatusEvent('accepted', 'Agreement accepted by freelancer', req.user) }
        }
    );

    // Update project to awarded
    await projects.updateOne(
        { _id: contract.projectId },
        {
            $set: {
                status: 'awarded',
                awardedTo: contract.freelancerId,
                awardedToName: contract.freelancerName,
                contractId: contract._id
            },
            $unset: { pendingAgreementTo: '', pendingAgreementToName: '', pendingContractId: '' }
        }
    );

    // Clear chat moderation warnings for both parties (project awarded)
    const employerIdStr = contract.employerId.toString();
    const freelancerIdStr = contract.freelancerId.toString();
    clearUserWarnings(employerIdStr);
    clearUserWarnings(freelancerIdStr);
    clearProjectAwardCache(contract.projectId.toString());

    await logActivity(req.user._id, req.user.name, req.user.role, 'accepted_agreement', `Accepted agreement for project: ${contract.projectTitle}`, contract._id);

    // Notify employer
    await pushNotification(
        contract.employerId,
        'success',
        'Agreement Accepted',
        `${req.user.name} has accepted the agreement for "${contract.projectTitle}". The project is now underway!`,
        '/contract'
    );

    // Get updated credit balances
    const [employerAfter, freelancerAfter] = await Promise.all([
        users.findOne({ _id: { $in: employerIdVariants } }),
        users.findOne({ _id: { $in: freelancerIdVariants } })
    ]);

    // Emit socket events for credit updates
    try {
        const { getIo } = require('../socket');
        const io = getIo();
        if (employerAfter) {
            io.to(employerAfter._id.toString()).emit('credits_updated', employerAfter.credits);
        }
        if (freelancerAfter) {
            io.to(freelancerAfter._id.toString()).emit('credits_updated', freelancerAfter.credits);
        }
    } catch (e) {
        console.error('Socket error emitting credits_updated:', e);
    }

    const updatedContract = await contracts.findOne({ _id: contract._id });
    const payload = updatedContract.toObject ? updatedContract.toObject() : updatedContract;

    res.status(200).json({
        ...payload,
        employerCredits: employerAfter?.credits,
        freelancerCredits: freelancerAfter?.credits,
        message: 'Agreement accepted! Project awarded. Credits have been deducted from both parties.'
    });
};

module.exports = {
    createContract,
    getMyContracts,
    getContractById,
    getAgreementThread,
    addAgreementThreadMessage,
    confirmTaskDone,
    markMilestonePaid,
    confirmMilestoneReceived,
    raiseDispute,
    respondToAgreement,
    proofUpload,
};
