import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = React.lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const PostProject = React.lazy(() => import('./pages/PostProject').then(m => ({ default: m.PostProject })));
const ProjectList = React.lazy(() => import('./pages/ProjectList').then(m => ({ default: m.ProjectList })));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const Inbox = React.lazy(() => import('./pages/Inbox').then(m => ({ default: m.Inbox })));
const Chat = React.lazy(() => import('./pages/Chat').then(m => ({ default: m.Chat })));
const Help = React.lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));
const ContractDashboard = React.lazy(() => import('./pages/ContractDashboard').then(m => ({ default: m.ContractDashboard })));
const MyProjects = React.lazy(() => import('./pages/MyProjects').then(m => ({ default: m.MyProjects })));
const About = React.lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const MembershipPage = React.lazy(() => import('./pages/MembershipPage').then(m => ({ default: m.MembershipPage })));
const ReferralPage = React.lazy(() => import('./pages/ReferralPage').then(m => ({ default: m.ReferralPage })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const Learn = React.lazy(() => import('./pages/Learn').then(m => ({ default: m.Learn })));
const LearnArticle = React.lazy(() => import('./pages/LearnArticle').then(m => ({ default: m.LearnArticle })));
const GigMarketplace = React.lazy(() => import('./pages/GigMarketplace'));
const CreateGig = React.lazy(() => import('./pages/CreateGig'));
const GigDetail = React.lazy(() => import('./pages/GigDetail'));
const MyGigs = React.lazy(() => import('./pages/MyGigs'));

const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminProjects = React.lazy(() => import('./pages/admin/AdminProjects').then(m => ({ default: m.AdminProjects })));
const AdminReports = React.lazy(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminVerifications = React.lazy(() => import('./pages/admin/AdminVerifications').then(m => ({ default: m.AdminVerifications })));
const AdminDisputes = React.lazy(() => import('./pages/admin/AdminDisputes').then(m => ({ default: m.AdminDisputes })));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminLearn = React.lazy(() => import('./pages/admin/AdminLearn').then(m => ({ default: m.AdminLearn })));
const AdminPortfolio = React.lazy(() => import('./pages/admin/AdminPortfolio').then(m => ({ default: m.AdminPortfolio })));
const AdminGigs = React.lazy(() => import('./pages/admin/AdminGigs').then(m => ({ default: m.AdminGigs })));

import { HelmetProvider } from 'react-helmet-async';
import { AIChatbot } from './ai/AIChatbot';

// Added missing imports
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { API_BASE } from './config';
import { Navbar } from './components/Navbar';
import { GlobalCallOverlay } from './components/GlobalCallOverlay';
import { AdminRoute } from './components/AdminRoute';
import { MaintenancePage } from './pages/MaintenancePage';
import { AdminLayout } from './layouts/AdminLayout';

// Catches auth_data from Google redirect flow and logs the user in
function AuthRedirectHandler() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const exchangeAttempted = React.useRef(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');

    if (authCode && !exchangeAttempted.current) {
      exchangeAttempted.current = true; // Prevent React StrictMode double-fire

      fetch(`${API_BASE}/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode })
      })
        .then(res => res.json())
        .then(data => {
          // Clear URL right away to prevent sharing/history leaks
          window.history.replaceState({}, document.title, '/');

          if (data && data.token) {
            login(data);
            navigate('/', { replace: true });
          } else {
            console.error('Exchange payload missing token:', data);
            navigate('/login?error=Invalid_Exchange', { replace: true });
          }
        })
        .catch(err => {
          console.error('Failed to exchange Google auth_code', err);
          navigate('/login?error=Server_Error', { replace: true });
        });
    }
  }, [login, navigate]);

  return null;
}

function MaintenanceChecker({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePathChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/admin'];
  const isPublicPath = publicPaths.some(p => currentPath === p || currentPath.startsWith(p + '/') || currentPath.startsWith('/api/'));

  useEffect(() => {
    const checkMaintenance = async () => {
      if (user?.role === 'admin') {
        setIsMaintenance(false);
        setLoading(false);
        return;
      }

      if (isPublicPath) {
        setIsMaintenance(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/settings/maintenance`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          setIsMaintenance(data.maintenanceMode === true);
        }
      } catch (e) {
        console.error('Failed to check maintenance status:', e);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenance();
  }, [user?.role, isPublicPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (isMaintenance) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

const FallbackLoading = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
  </div>
);

import { ToastBar, Toaster } from 'react-hot-toast';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <Router>
              <AuthRedirectHandler />
              <MaintenanceChecker>
                <div className="min-h-screen bg-gray-950">
                  {/* Global call overlay — always mounted, outside routes */}
                  <GlobalCallOverlay />
                  <Toaster
                    position="top-center"
                    gutter={14}
                    containerClassName="app-toast-container"
                    toastOptions={{
                      duration: 3600,
                      className: 'app-toast-shell',
                      style: {
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        color: '#f9fafb',
                        padding: 0,
                        margin: 0,
                        maxWidth: 'min(92vw, 420px)'
                      },
                      success: {
                        duration: 3200,
                        iconTheme: { primary: '#10b981', secondary: '#ecfdf5' }
                      },
                      error: {
                        duration: 4200,
                        iconTheme: { primary: '#ef4444', secondary: '#fef2f2' }
                      }
                    }}
                  >
                    {(t) => (
                      <ToastBar toast={t}>
                        {({ icon, message }) => (
                          <div
                            className={`app-toast-card ${t.type === 'error' ? 'app-toast-card-error' : 'app-toast-card-success'} ${t.visible ? 'app-toast-enter' : 'app-toast-leave'}`}
                          >
                            <div className="app-toast-glow" />
                            <div className="app-toast-icon">{icon}</div>
                            <div className="app-toast-content">
                              <p className="app-toast-title">{t.type === 'error' ? 'Something went wrong' : 'Done'}</p>
                              <div className="app-toast-message">{message}</div>
                            </div>
                          </div>
                        )}
                      </ToastBar>
                    )}
                  </Toaster>
                  <AIChatbot />

                  <React.Suspense fallback={<FallbackLoading />}>
                    <Routes>
                      {/* Admin Routes - uses its own Layout */}
                      <Route path="/admin" element={<AdminRoute />}>
                        <Route element={<AdminLayout />}>
                          <Route index element={<AdminDashboard />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="projects" element={<AdminProjects />} />
                          <Route path="reports" element={<AdminReports />} />
                          <Route path="verifications" element={<AdminVerifications />} />
                          <Route path="disputes" element={<AdminDisputes />} />
                          <Route path="settings" element={<AdminSettings />} />
                          <Route path="learn" element={<AdminLearn />} />
                          <Route path="portfolio" element={<AdminPortfolio />} />
                          <Route path="gigs" element={<AdminGigs />} />
                        </Route>
                      </Route>

                      {/* Main App Routes - uses normal layout styling */}
                      <Route element={<><Navbar /><Outlet /></>}>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/post-project" element={<PostProject />} />
                        <Route path="/projects" element={<ProjectList />} />
                        <Route path="/projects/:id" element={<ProjectDetail />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/profile/:id" element={<ProfilePage />} />
                        <Route path="/inbox" element={<Inbox />} />
                        <Route path="/messages/:userId" element={<Chat />} />
                        <Route path="/help" element={<Help />} />
                        <Route path="/contract" element={<ContractDashboard />} />
                        <Route path="/my-projects" element={<MyProjects />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/membership" element={<MembershipPage />} />
                        <Route path="/referral" element={<ReferralPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy" element={<PrivacyPolicy />} />
                        <Route path="/learn" element={<Learn />} />
                        <Route path="/learn/:slug" element={<LearnArticle />} />
                        <Route path="/learn/*" element={<LearnArticle />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        {/* Gig Marketplace */}
                        <Route path="/gigs" element={<GigMarketplace />} />
                        <Route path="/gigs/create" element={<CreateGig />} />
                        <Route path="/gigs/my-gigs" element={<MyGigs />} />
                        <Route path="/gigs/:id" element={<GigDetail />} />
                      </Route>
                    </Routes>
                  </React.Suspense>
                </div>
              </MaintenanceChecker>
            </Router>
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
