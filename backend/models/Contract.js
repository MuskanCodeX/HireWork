const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
    index: { type: Number, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'pending' }, // pending, paid, confirmed
    taskDoneByEmployer: { type: Boolean, default: false },
    taskDoneByFreelancer: { type: Boolean, default: false },
    taskConfirmed: { type: Boolean, default: false },
    paidNote: { type: String, default: '' },
    proofImage: { type: String, default: null },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    dueDate: { type: String, default: '' }
});

const disputeSchema = new mongoose.Schema({
    raisedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    raisedByName: { type: String, required: true },
    raisedByRole: { type: String, enum: ['employer', 'freelancer'], required: true },
    type: { type: String, default: 'general' }, // general, payment_not_received, delivery_issue, quality_issue, other
    reason: { type: String, default: '' },
    milestoneIndex: { type: Number, default: null },
    evidenceImage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const disputeResolutionSchema = new mongoose.Schema({
    outcome: { type: String, enum: ['refund_employer', 'pay_freelancer'], required: true },
    verificationChecklist: [{ type: String }],
    verificationNotes: { type: String, default: '' },
    resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedByName: { type: String, required: true },
    resolvedAt: { type: Date, default: Date.now }
}, { _id: false });

const agreementThreadSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    role: { type: String, enum: ['employer', 'freelancer'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const statusEventSchema = new mongoose.Schema({
    status: { type: String, required: true },
    label: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    actorRole: { type: String, enum: ['employer', 'freelancer', 'system'], default: 'system' },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const contractSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    projectTitle: { type: String, required: true },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employerName: { type: String, required: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    freelancerName: { type: String, required: true },
    amount: { type: Number, required: true },
    milestones: [milestoneSchema],

    // Agreement details - clear project description, rules, timeline, and terms
    projectDescription: { type: String, default: '' }, // Full description: what client wants + what freelancer must do
    projectRules: { type: String, default: '' }, // Rules and terms client wants freelancer to follow
    projectTimeline: { type: String, default: '' }, // Timeline and deadlines
    additionalTerms: { type: String, default: '' }, // Any additional terms/details

    // Full agreement text that will be verified in disputes
    agreementFullText: { type: String, default: '' },
    agreementAiSummary: {
        score: { type: Number, default: 0 },
        severity: { type: String, default: 'low' },
        verdict: { type: String, default: 'clear' },
        flags: { type: [String], default: [] },
        notes: { type: String, default: '' },
        provider: { type: String, default: '' },
        checkedAt: { type: Date }
    },

    status: { type: String, default: 'active' }, // active, completed, disputed, cancelled
    agreementStatus: { type: String, default: 'pending' }, // pending (waiting freelancer), accepted, cancelled
    dispute: { type: disputeSchema, default: null },
    disputeResolution: { type: disputeResolutionSchema, default: null },
    reviewedByEmployer: { type: Boolean, default: false },
    reviewedByFreelancer: { type: Boolean, default: false },
    statusHistory: { type: [statusEventSchema], default: [] },
    thread: { type: [agreementThreadSchema], default: [] },
    threadLocked: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Indexes for getMyProjects and getContracts queries
contractSchema.index({ employerId: 1 });
contractSchema.index({ freelancerId: 1 });
contractSchema.index({ projectId: 1 });
contractSchema.index({ status: 1, employerId: 1 });
contractSchema.index({ status: 1, freelancerId: 1 });

module.exports = mongoose.model('Contract', contractSchema);

