import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const TeacherRoute = ({ children, auth }) => {
  if (!auth.authenticated) {
    return <Navigate to="/teacher" replace />;
  }
  return children;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [auth, setAuth] = useState({ authenticated: false });

  useEffect(() => {
    // Restore session on load (especially useful for OAuth redirects)
    const restoreSession = async () => {
      // 1. Safety Timeout to ensure UI always unlocks
      const unlockTimer = setTimeout(() => setIsInitializing(false), 3000);

      try {
        const { session, error } = await getCurrentSession();
        
        // Handle 401/Unauthorized proactively
        if (error?.status === 401 || error?.statusCode === 401) {
          localStorage.removeItem('cp_instructor_auth');
          setAuth({ authenticated: false });
          return;
        }

        if (session && session.user) {
          const authData = {
            authenticated: true,
            user: {
              email: session.user.email,
              id: session.user.id
            }
          };
          setAuth(authData);
        } else {
          // Fallback only if local data is complete AND fresh-ish
          const stored = localStorage.getItem('cp_instructor_auth');
          const localAuth = stored ? JSON.parse(stored) : null;
          if (localAuth?.authenticated && localAuth?.user) {
            setAuth(localAuth);
          } else if (localAuth?.authenticated) {
            localStorage.removeItem('cp_instructor_auth');
          }
        }
      } catch (err) {
        console.error("Session restoration failed:", err);
      } finally {
        clearTimeout(unlockTimer);
        // Minimal aesthetic delay
        setTimeout(() => setIsInitializing(false), 600);
      }
    };
    restoreSession();
  }, []);

  // Sync side effects whenever auth changes
  useEffect(() => {
    if (auth.authenticated && auth.user) {
      localStorage.setItem('cp_instructor_auth', JSON.stringify(auth));
      // Async sync of teacher ID to store
      import('./store/sessionStore').then(({ setTeacherId }) => {
        setTeacherId(auth.user.id);
      }).catch(err => console.error("Store sync failed:", err));
    }
  }, [auth]);

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
          <Route path="/teacher" element={auth.authenticated ? <Navigate to="/teacher/config" replace /> : <InstructorLogin onAuthSuccess={handleManualAuth} />} />
          <Route path="/teacher/config" element={<TeacherRoute auth={auth}><TeacherConfig /></TeacherRoute>} />
          <Route path="/teacher/live" element={<TeacherRoute auth={auth}><TeacherDashboard /></TeacherRoute>} />
          <Route path="/teacher/history" element={<TeacherRoute auth={auth}><TeacherHistory /></TeacherRoute>} />
          <Route path="/teacher/:sessionId" element={<TeacherRoute auth={auth}><TeacherDashboard /></TeacherRoute>} />
        </Routes>
      </BrowserRouter>
      {/* Global Footer Credit */}
      <footer className="w-full py-8 flex justify-center items-center border-t border-white/5 mt-auto select-none">
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40 text-center flex flex-col sm:flex-row items-center gap-2">
          <span>Designed & Developed by</span>
          <span className="text-primary font-black drop-shadow-[0_0_10px_rgba(163,166,255,0.6)] px-2 py-0.5 rounded bg-primary/5 border border-primary/10">Dipak Shah</span>
        </p>
      </footer>

      {/* Subtle Background Atmospheric Elements */}
      <div className="fixed top-1/4 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-1/4 -left-20 w-64 h-64 bg-secondary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
    </div>
  );
}

export default App;
