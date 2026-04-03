import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import BottomNav from './components/BottomNav';
import Landing from './pages/Landing';
import TeacherDashboard from './pages/TeacherDashboard';
import InstructorLogin from './pages/InstructorLogin';
import TeacherConfig from './pages/TeacherConfig';
import TeacherHistory from './pages/TeacherHistory';

import { useEffect, useState } from 'react';
import { getCurrentSession } from './services/classPulseAuth';

// ── System Initialization Overlay ──
const SystemInitializing = () => (
  <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-surface backdrop-blur-3xl animate-in fade-in duration-700">
    <div className="relative group">
      <div className="absolute inset-[-20px] bg-primary/20 rounded-full blur-[40px] animate-pulse group-hover:bg-primary/40 transition-all duration-1000" />
      <div className="relative flex flex-col items-center gap-6">
        <span className="material-symbols-outlined text-6xl text-primary animate-spin-slow">sensors</span>
        <div className="flex flex-col items-center">
          <h2 className="font-headline font-black text-2xl tracking-[0.2em] text-on-surface uppercase mb-2">ClassPulse</h2>
          <p className="text-on-surface-variant font-label text-[10px] font-bold tracking-[0.4em] uppercase opacity-60">Digital Observatory Initializing...</p>
        </div>
      </div>
    </div>
  </div>
);

// Container for Student Pad session route
const SessionLayout = () => {
  return (
    <>
      <Header />
      <Dashboard />
    </>
  );
};

// Security Guard for Instructor-only routes
const TeacherRoute = ({ children, auth, onLoginRedirect }) => {
  if (!auth.authenticated) {
    return <InstructorLogin onAuthSuccess={onLoginRedirect} />; // Force login if not authorized
  }
  return children;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [auth, setAuth] = useState({ authenticated: false });

  useEffect(() => {
    // Restore session on load (especially useful for OAuth redirects)
    const restoreSession = async () => {
      try {
        const { session } = await getCurrentSession();
        if (session && session.user) {
          const authData = {
            authenticated: true,
            user: {
              email: session.user.email,
              id: session.user.id
            }
          };
          // Sync our local auth state
          localStorage.setItem('cp_instructor_auth', JSON.stringify(authData));
          setAuth(authData);
          
          // IMPORTANT: Inject the teacher ID into the global session store for cloud sync
          const { setTeacherId } = await import('./store/sessionStore');
          setTeacherId(session.user.id);
        } else {
          // Check if we have a valid-ish local session but the server session is gone
          const localAuth = JSON.parse(localStorage.getItem('cp_instructor_auth') || '{}');
          if (localAuth.authenticated) {
            setAuth(localAuth);
          }
        }
      } catch (err) {
        console.error("Session restoration failed:", err);
      } finally {
        // Add a slight delay for aesthetic "smoothness"
        setTimeout(() => setIsInitializing(false), 800);
      }
    };
    restoreSession();
  }, []);

  const handleManualAuth = (userData) => {
    setAuth({
      authenticated: true,
      user: userData
    });
  };

  if (isInitializing) {
    return <SystemInitializing />;
  }

  return (
    <div className="bg-surface text-on-surface font-body min-h-[884px] selection:bg-primary/30 mesh-bg relative overflow-x-hidden">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/session/:sessionId" element={<SessionLayout />} />
          <Route path="/teacher" element={<InstructorLogin onAuthSuccess={handleManualAuth} />} />
          <Route path="/teacher/config" element={<TeacherRoute auth={auth} onLoginRedirect={handleManualAuth}><TeacherConfig /></TeacherRoute>} />
          <Route path="/teacher/live" element={<TeacherRoute auth={auth} onLoginRedirect={handleManualAuth}><TeacherDashboard /></TeacherRoute>} />
          <Route path="/teacher/history" element={<TeacherRoute auth={auth} onLoginRedirect={handleManualAuth}><TeacherHistory /></TeacherRoute>} />
          <Route path="/teacher/:sessionId" element={<TeacherRoute auth={auth} onLoginRedirect={handleManualAuth}><TeacherDashboard /></TeacherRoute>} />
        </Routes>
      </BrowserRouter>
      {/* Global Footer Credit */}
      <footer className="w-full py-6 flex justify-center items-center opacity-30 select-none pointer-events-none">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant text-center">
          Designed & Developed by <span className="text-primary font-black">Dipak Shah</span>
        </p>
      </footer>

      {/* Subtle Background Atmospheric Elements */}
      <div className="fixed top-1/4 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-1/4 -left-20 w-64 h-64 bg-secondary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
    </div>
  );
}

export default App;
