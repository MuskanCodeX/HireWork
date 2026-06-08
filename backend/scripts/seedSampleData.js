const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');

// Ensure Google / Cloudflare DNS resolution for SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const User = require('../models/User');
const Project = require('../models/Project');
const Gig = require('../models/Gig');
const Review = require('../models/Review');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hirework';

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas!');

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 1. Create or Update Sample Users
  console.log('Seeding Sample Users...');

  const usersData = [
    {
      name: 'HireWork Admin',
      email: 'admin@hirework.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      bio: 'HireWork Platform Administrator & Quality Specialist',
      isEmailVerified: true,
      trustScore: 100,
      credits: 1000
    },
    {
      name: 'Rahul Sharma (Client)',
      email: 'client@hirework.com',
      password: hashedPassword,
      role: 'employer',
      status: 'active',
      bio: 'Founder at NovaTech Labs. Building next-gen software and hiring elite talent.',
      isEmailVerified: true,
      isPhoneVerified: true,
      trustScore: 92,
      credits: 500,
      freePostings: 5
    },
    {
      name: 'Aarav Patel (Developer)',
      email: 'freelancer@hirework.com',
      password: hashedPassword,
      role: 'freelancer',
      status: 'active',
      bio: 'Senior Full-Stack Engineer with 6+ years experience in React, Node.js, and Cloud Infrastructure.',
      skills: ['React', 'Node.js', 'TypeScript', 'Tailwind CSS', 'MongoDB', 'Docker', 'Next.js'],
      hourlyRate: 45,
      experience: 'Senior (6+ years)',
      isEmailVerified: true,
      isPhoneVerified: true,
      badge: 'Expert',
      trustScore: 97,
      trustBadge: 'platinum',
      avgRating: 4.9,
      reviewCount: 38,
      completedProjects: 42,
      totalEarnings: 28400,
      credits: 150
    },
    {
      name: 'Priya Verma (Designer)',
      email: 'priya.dev@hirework.com',
      password: hashedPassword,
      role: 'freelancer',
      status: 'active',
      bio: 'Product Designer specializing in sleek SaaS dashboards, mobile interfaces, and design systems.',
      skills: ['UI/UX Design', 'Figma', 'Prototyping', 'Design Systems', 'Mobile App UI', 'Branding'],
      hourlyRate: 50,
      experience: 'Lead Designer (5 years)',
      isEmailVerified: true,
      isPhoneVerified: true,
      badge: 'Pro',
      trustScore: 95,
      trustBadge: 'gold',
      avgRating: 5.0,
      reviewCount: 26,
      completedProjects: 31,
      totalEarnings: 19800,
      credits: 120
    }
  ];

  const userMap = {};
  for (const u of usersData) {
    let existing = await User.findOne({ email: u.email });
    if (!existing) {
      existing = await User.create({
        ...u,
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      console.log(`Created user: ${u.email} (${u.role})`);
    } else {
      existing.password = hashedPassword;
      existing.role = u.role;
      existing.status = 'active';
      existing.name = u.name;
      existing.bio = u.bio;
      existing.skills = u.skills || [];
      existing.badge = u.badge || '';
      existing.trustScore = u.trustScore || 90;
      await existing.save();
      console.log(`Updated user: ${u.email}`);
    }
    userMap[u.email] = existing;
  }

  const client = userMap['client@hirework.com'];
  const dev = userMap['freelancer@hirework.com'];
  const designer = userMap['priya.dev@hirework.com'];

  // 2. Create Sample Projects
  console.log('Seeding Sample Projects...');
  const sampleProjects = [
    {
      user: client._id,
      userName: client.name,
      title: 'Full-Stack SaaS MVP with Next.js & Stripe Escrow Integration',
      description: 'We are seeking an experienced Full-Stack Engineer to build the core MVP for our B2B SaaS platform. Key requirements include Next.js 14 App Router, authentication, multi-tenant database design with MongoDB, and Stripe Billing webhooks.',
      budget: 2500,
      status: 'open',
      bids: [
        {
          userId: dev._id,
          userName: dev.name,
          amount: 2400,
          proposal: 'Hi Rahul, I have built 5+ SaaS platforms with Next.js and MongoDB. I can deliver a clean, tested MVP with automated CI/CD in 3 weeks.'
        }
      ]
    },
    {
      user: client._id,
      userName: client.name,
      title: 'Modern Mobile Banking & Crypto Wallet UI/UX Design in Figma',
      description: 'Looking for a talented product designer to design 25+ screens for an iOS & Android fintech wallet. Includes user onboarding, KYC flow, portfolio analytics charts, and transaction history. Design system with auto-layout required.',
      budget: 1400,
      status: 'open',
      bids: [
        {
          userId: designer._id,
          userName: designer.name,
          amount: 1350,
          proposal: 'Hello! I specialize in fintech UI/UX. I will provide an interactive Figma prototype, micro-interactions, and a component-driven design system ready for developers.'
        }
      ]
    },
    {
      user: client._id,
      userName: client.name,
      title: 'AI Customer Support Agent with LangChain and WhatsApp API',
      description: 'Need an AI developer to build an autonomous customer support bot that pulls real-time order data and answers customer queries via WhatsApp and Web Widget. Must support fallback to human agent.',
      budget: 950,
      status: 'open',
      bids: []
    },
    {
      user: client._id,
      userName: client.name,
      title: 'High-Converting Animated Landing Page with Tailwind CSS & Motion',
      description: 'Build a marketing website with fluid scroll animations, 3D tilt effects, dark mode toggle, and Lighthouse score above 95. Tech stack: React, Tailwind CSS, Framer Motion.',
      budget: 600,
      status: 'open',
      bids: []
    },
    {
      user: client._id,
      userName: client.name,
      title: 'Cross-Platform Food Delivery Mobile App in Flutter & Firebase',
      description: 'Looking for a skilled Flutter developer to build our customer ordering app with live rider tracking on Google Maps, Razorpay integration, and instant push notifications.',
      budget: 1800,
      status: 'open',
      bids: []
    },
    {
      user: client._id,
      userName: client.name,
      title: 'AI RAG Engine with LangChain, Pinecone & OpenAI Embeddings',
      description: 'We need an AI engineer to develop an enterprise Retrieval-Augmented Generation (RAG) backend that ingests PDFs, creates vector embeddings, and provides cited answers.',
      budget: 1200,
      status: 'open',
      bids: []
    },
    {
      user: client._id,
      userName: client.name,
      title: 'DevOps CI/CD Pipeline Setup on AWS with Docker & Kubernetes',
      description: 'Set up automated GitHub Actions workflows, containerize 3 microservices with Docker, and configure an EKS Kubernetes cluster with automated rolling deployments and Prometheus monitoring.',
      budget: 900,
      status: 'open',
      bids: []
    },
    {
      user: client._id,
      userName: client.name,
      title: 'Shopify Plus Custom Liquid Theme & Performance Speed Optimization',
      description: 'Optimize our high-volume D2C Shopify store. Enhance mobile UX, remove render-blocking scripts, improve Core Web Vitals to 90+, and implement custom upsell drawer.',
      budget: 750,
      status: 'open',
      bids: []
    }
  ];

  for (const p of sampleProjects) {
    const existing = await Project.findOne({ title: p.title });
    if (!existing) {
      await Project.create(p);
      console.log(`Created project: "${p.title}"`);
    }
  }

  // 3. Create Sample Gigs
  console.log('Seeding Sample Gigs...');
  const sampleGigs = [
    {
      sellerId: dev._id,
      sellerName: dev.name,
      sellerAvatar: dev.avatar || '',
      title: 'I will build a high-performance Full-Stack Web Application with React & Node.js',
      description: 'Professional full-stack web development tailored to your business needs. I write clean, modular, and well-documented TypeScript code with responsive design, secure APIs, and database indexing.',
      category: 'Web Development',
      tags: ['React', 'Node.js', 'Full Stack', 'TypeScript', 'MongoDB'],
      isActive: true,
      isApproved: true,
      approvalStatus: 'approved',
      avgRating: 4.9,
      reviewCount: 28,
      packages: {
        basic: {
          title: 'Single Page / Landing Component',
          description: '1 responsive frontend page with clean component structure and animations.',
          price: 80,
          deliveryDays: 2,
          revisions: '2',
          features: ['Responsive Design', 'Source Code Included', 'Speed Optimized']
        },
        standard: {
          title: 'Multi-Page Dynamic Web App',
          description: 'Up to 5 pages with REST API integration, state management, and form validation.',
          price: 250,
          deliveryDays: 5,
          revisions: '3',
          features: ['5 Pages', 'API Integration', 'Authentication Flow', 'Responsive Design']
        },
        premium: {
          title: 'Complete Enterprise Web Platform',
          description: 'Full-stack application with database, authentication, admin dashboard, and deployment.',
          price: 600,
          deliveryDays: 10,
          revisions: 'unlimited',
          features: ['Full Stack App', 'Database Setup', 'Admin Panel', 'Payment Gateway', 'Live Deployment']
        }
      }
    },
    {
      sellerId: designer._id,
      sellerName: designer.name,
      sellerAvatar: designer.avatar || '',
      title: 'I will design modern UI/UX for your Mobile App or Web Platform in Figma',
      description: 'Award-winning UI/UX designer ready to transform your ideas into pixel-perfect Figma screens. Includes user personas, wireframes, high-fidelity prototypes, and design tokens.',
      category: 'UI/UX Design',
      tags: ['Figma', 'UI Design', 'UX Research', 'Mobile App', 'Dashboard'],
      isActive: true,
      isApproved: true,
      approvalStatus: 'approved',
      avgRating: 5.0,
      reviewCount: 34,
      packages: {
        basic: {
          title: 'Wireframes & Concept (2 Screens)',
          description: '2 high-fidelity mobile or web screens with typography and color system.',
          price: 60,
          deliveryDays: 2,
          revisions: '2',
          features: ['2 Screens', 'Figma Source File', 'Assets Export']
        },
        standard: {
          title: 'Core App Design (6 Screens)',
          description: '6 key screens including onboarding, dashboard, details, and interactive prototype.',
          price: 200,
          deliveryDays: 4,
          revisions: '4',
          features: ['6 Screens', 'Interactive Prototype', 'Design System Kit', 'Developer Handoff']
        },
        premium: {
          title: 'Full Product Design (15 Screens)',
          description: 'Complete UI/UX system with responsive variants, micro-interactions, and component library.',
          price: 450,
          deliveryDays: 8,
          revisions: 'unlimited',
          features: ['15 Screens', 'Full Design System', 'Clickable Prototype', 'Responsive Layouts']
        }
      }
    },
    {
      sellerId: dev._id,
      sellerName: dev.name,
      sellerAvatar: dev.avatar || '',
      title: 'I will create secure REST APIs, WebSocket real-time servers, and Cloud deployments',
      description: 'Specialized backend architecture using Express, MongoDB, Redis caching, and WebSockets. Built with security best practices, JWT, input sanitization, and rate limiting.',
      category: 'Backend & APIs',
      tags: ['Express', 'Node.js', 'API', 'WebSockets', 'Database'],
      isActive: true,
      isApproved: true,
      approvalStatus: 'approved',
      avgRating: 4.8,
      reviewCount: 19,
      packages: {
        basic: {
          title: 'API Endpoint Package (3 Endpoints)',
          description: '3 CRUD endpoints with input validation and error handling.',
          price: 50,
          deliveryDays: 1,
          revisions: '1',
          features: ['3 Endpoints', 'Postman Documentation', 'Input Validation']
        },
        standard: {
          title: 'Full REST API Module',
          description: 'Complete authentication system + 10 REST endpoints with MongoDB schemas.',
          price: 180,
          deliveryDays: 4,
          revisions: '3',
          features: ['JWT Auth', '10 Endpoints', 'Database Models', 'Documentation']
        },
        premium: {
          title: 'Real-Time WebSocket & Microservice Backend',
          description: 'Full real-time system with Socket.IO, database transactions, and cloud setup.',
          price: 400,
          deliveryDays: 7,
          revisions: 'unlimited',
          features: ['WebSockets', 'Full Auth & RBAC', 'Cloud Deployment', 'Performance Optimization']
        }
      }
    }
  ];

  for (const g of sampleGigs) {
    const existing = await Gig.findOne({ title: g.title });
    if (!existing) {
      await Gig.create(g);
      console.log(`Created gig: "${g.title}"`);
    }
  }

  console.log('\n--- SEEDING COMPLETED SUCCESSFULLY! ---');
  console.log('Sample Credentials:');
  console.log('  Admin:       admin@hirework.com      / Password@123');
  console.log('  Client:      client@hirework.com     / Password@123');
  console.log('  Freelancer:  freelancer@hirework.com / Password@123');
  console.log('  Designer:    priya.dev@hirework.com  / Password@123');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});
