import { Link } from 'react-router-dom';

export const TermsPage = () => {
    return (
        <div className="min-h-screen bg-gray-950 pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
                <div className="mb-10 border-b border-gray-800 pb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">Terms & Conditions</h1>
                        <p className="text-emerald-400 font-medium">Effective Date: March 7, 2026</p>
                    </div>
                    <span className="hidden sm:inline-flex bg-gray-800 text-gray-400 px-4 py-1.5 rounded-full text-sm font-semibold border border-gray-700">
                        Legal Agreement
                    </span>
                </div>

                <div className="prose prose-invert max-w-none text-gray-300 space-y-8">
                    <p className="text-lg leading-relaxed text-gray-400">
                        Welcome to <strong className="text-white">HIREWORK</strong>. These Terms and Conditions constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and HIREWORK ("we", "us", or "our"), concerning your access to and use of our platform. By accessing or using our services, you expressly agree to comply with and be bound by the following terms. <strong className="text-emerald-400">If you do not agree with all of these terms, you are expressly prohibited from using the platform and must discontinue use immediately.</strong>
                    </p>

                    {/* Important Bid Purchases Disclaimer - Placed prominently */}
                    <section className="bg-gradient-to-r from-red-900/20 to-amber-900/20 rounded-2xl p-6 border-l-4 border-l-red-500 border-y border-r border-gray-800/50 shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">⚠️</span>
                            <h2 className="text-xl font-bold text-red-400 m-0">Bid Purchases & Refunds Policy</h2>
                        </div>
                        <p className="font-medium text-gray-200 leading-relaxed text-sm lg:text-base">
                            Any and all actions related to the purchasing of bids on the HIREWORK platform are <strong className="text-white underline decoration-red-500 underline-offset-4">strictly irreversible and absolutely non-refundable.</strong> Under no circumstances—including but not limited to accidental purchases, dissatisfaction with the platform, project cancellations, or account termination—will bid purchases be refunded. By initiating a purchase, you acknowledge and accept this unalterable condition.
                        </p>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">01</span>
                            User Accounts & Registration
                        </h2>
                        <ul className="space-y-3 list-none ml-2">
                            <li className="flex gap-3">
                                <span className="text-emerald-400 mt-1">▹</span>
                                <div><strong className="text-white">Eligibility:</strong> You must be at least 18 years of age (or the age of legal majority in your jurisdiction) to register an account and utilize this platform.</div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-emerald-400 mt-1">▹</span>
                                <div><strong className="text-white">Accuracy of Information:</strong> You agree to provide true, accurate, current, and complete information during the registration process and to promptly update such information to keep it accurate.</div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-emerald-400 mt-1">▹</span>
                                <div><strong className="text-white">Account Security:</strong> You are solely responsible for maintaining the strict confidentiality of your account credentials (passwords, tokens). We establish security measures, but you bear responsibility for any activity that occurs under your account.</div>
                            </li>
                        </ul>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">02</span>
                            Nature of the Service
                        </h2>
                        <p className="mb-4">
                            HIREWORK is a digital introductory marketplace that connects <strong className="text-white">Clients</strong> (individuals or entities seeking services) with <strong className="text-white">Freelancers</strong> (independent contractors providing services).
                        </p>
                        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl text-sm leading-relaxed">
                            We act strictly and exclusively as a <em>platform facilitator</em>. We do not employ freelancers, nor are we a party to, or a third-party beneficiary of, the independent contracts formed explicitly between Clients and Freelancers. HIREWORK does not direct, control, or guarantee the quality, timing, or legality of the services delivered.
                        </div>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">03</span>
                            Zero-Commission & Payment Liability Model
                        </h2>
                        <ul className="space-y-3 list-none ml-2">
                            <li className="flex items-center gap-3"><span className="text-emerald-400">✓</span> <span><strong>No Platform Fees:</strong> HIREWORK currently operates on a zero-commission model. We do not charge percentage-based fees for project postings or successful completions.</span></li>
                            <li className="flex items-center gap-3"><span className="text-amber-400">⚠️</span> <span className="text-gray-200"><strong>No Escrow Service Provider:</strong> We currently do not provide an escrow or guaranteed payment protection service.</span></li>
                            <li className="flex items-start gap-3 mt-2">
                                <span className="text-emerald-400 mt-1">▹</span>
                                <span><strong>Direct Transactions Liability:</strong> All primary project payments are handled <em>directly</em> (peer-to-peer) between the Client and the Freelancer (e.g., via UPI, bank transfer). HIREWORK is not legally or financially responsible for processing, holding, tracking, or securing these payments. Users assume all risk associated with direct financial transactions.</span>
                            </li>
                        </ul>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">04</span>
                            Acceptable User Conduct
                        </h2>
                        <p className="mb-4">To maintain the professional integrity of our community, users strictly agree <strong className="text-red-400">NOT</strong> to:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-gray-900 px-4 py-3 rounded-lg border border-gray-800 text-sm flex items-center gap-2">
                                <span className="text-red-500">✗</span> Post fraudulent, illegal, or misleading content.
                            </div>
                            <div className="bg-gray-900 px-4 py-3 rounded-lg border border-gray-800 text-sm flex items-center gap-2">
                                <span className="text-red-500">✗</span> Harass, intimidate, or spam other users.
                            </div>
                            <div className="bg-gray-900 px-4 py-3 rounded-lg border border-gray-800 text-sm flex items-center gap-2">
                                <span className="text-red-500">✗</span> Attempt to bypass platform communication tools.
                            </div>
                            <div className="bg-gray-900 px-4 py-3 rounded-lg border border-gray-800 text-sm flex items-center gap-2">
                                <span className="text-red-500">✗</span> Scrape, data-mine, or reverse engineer the platform.
                            </div>
                        </div>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">05</span>
                            Intellectual Property Rights
                        </h2>
                        <p className="mb-3">
                            All proprietary content, branding, logos, graphics, and underlying software code related to HIREWORK remain the exclusive intellectual property of the platform owner.
                        </p>
                        <p>
                            Users independently retain full ownership rights to the original content they upload, such as portfolio pieces, distinct project descriptions, and delivered work products, granting HIREWORK only a necessary license to display such content on the platform to facilitate operations.
                        </p>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">06</span>
                            Limitation of Liability
                        </h2>
                        <p className="mb-2">To the maximum extent permitted by applicable law, HIREWORK and its proprietors shall <strong className="text-white">NOT</strong> be liable for:</p>
                        <ul className="list-disc list-inside space-y-2 text-gray-400 ml-2">
                            <li>Financial losses, unpaid invoices, or contractual disputes arising between users.</li>
                            <li>Deficiencies in the quality, accuracy, or timeline of work delivered by freelancers.</li>
                            <li>Incidental data breaches, server downtime, or technical service interruptions.</li>
                            <li>Any direct, indirect, punitive, incidental, or consequential damages whatsoever arising out of or connected with the use or inability to use the platform.</li>
                        </ul>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">07</span>
                            Account Suspension & Termination
                        </h2>
                        <p>
                            We reserve the absolute right, at our sole discretion, to suspend, disable, or indefinitely terminate any account that violates these terms, engages in fraudulent behavior, or acts in a manner deemed harmful to the HIREWORK community ecosystem, without prior notice or liability.
                        </p>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">08</span>
                            Governing Law & Dispute Resolution
                        </h2>
                        <p>
                            These terms, and any dispute arising from the use of the HIREWORK platform, shall be governed by and construed in accordance with the laws of <strong className="text-white">India</strong>. Any legal actions or proceedings shall be subject to the exclusive jurisdiction of the competent courts located in <strong className="text-emerald-400">West Godavari, Andhra Pradesh</strong>.
                        </p>
                    </section>

                    <section className="bg-gray-800/30 rounded-2xl p-6 border border-gray-800/50">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <span className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg text-sm">09</span>
                            Modifications to Terms
                        </h2>
                        <p>
                            HIREWORK reserves the right to modify, alter, or update these terms at any time at our discretion. We will indicate the date of the most recent updates at the top of this page. Your continued use of the platform after such modifications are posted constitutes binding acceptance of the revised terms.
                        </p>
                    </section>

                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-gray-800">
                        <p className="text-gray-500 text-sm italic">
                            By continuing to use HIREWORK, I acknowledge I have read and agree to these Terms and Conditions.
                        </p>
                        <Link to="/" className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap">
                            Return Home
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
};

