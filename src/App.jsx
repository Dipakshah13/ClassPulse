import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import BottomNav from './components/BottomNav';
import Landing from './pages/Landing';
import TeacherDashboard from './pages/TeacherDashboard';
import InstructorLogin from './pages/InstructorLogin';
import TeacherConfig from './pages/TeacherConfig';
import TeacherHistory from './pages/TeacherHistory';

import { getCurrentSession } from './services/classPulseAuth';

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
  if (!auth?.authenticated) {
    return <Navigate to="/teacher" replace />; // Redirect to login if not authorized
  }
  return children;
};

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('cp_instructor_auth');
    return stored ? JSON.parse(stored) : { authenticated: false };
  });

  const handleManualAuth = (user) => {
    const authData = { authenticated: true, user };
    setAuth(authData);
    localStorage.setItem('cp_instructor_auth', JSON.stringify(authData));
  };

  const handleLogout = () => {
    localStorage.removeItem('cp_instructor_auth');
    setAuth({ authenticated: false });
  };

  useEffect(() => {
    // Restore session on load (especially useful for OAuth redirects)
    const restoreSession = async () => {
      const { session } = await getCurrentSession();
      if (session && session.user) {
        // Sync our local auth state
        const authData = {
          authenticated: true,
          user: {
            email: session.user.email,
            id: session.user.id
          }
        };
        setAuth(authData);
        localStorage.setItem('cp_instructor_auth', JSON.stringify(authData));
        
        // IMPORTANT: Inject the teacher ID into the global session store for cloud sync
        const { setTeacherId } = await import('./store/sessionStore');
        setTeacherId(session.user.id);
      }
    };
    restoreSession();
  }, []);

  return (
    <div className="bg-surface text-on-surface font-body min-h-[100dvh] selection:bg-primary/30 mesh-bg relative overflow-x-hidden">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/session/:sessionId" element={<SessionLayout />} />
          <Route path="/teacher" element={<InstructorLogin onAuthSuccess={handleManualAuth} />} />
          <Route path="/teacher/config" element={<TeacherRoute auth={auth}><TeacherConfig onLogout={handleLogout} /></TeacherRoute>} />
          <Route path="/teacher/live" element={<TeacherRoute auth={auth}><TeacherDashboard onLogout={handleLogout} /></TeacherRoute>} />
          <Route path="/teacher/history" element={<TeacherRoute auth={auth}><TeacherHistory onLogout={handleLogout} /></TeacherRoute>} />
          <Route path="/teacher/:sessionId" element={<TeacherRoute auth={auth}><TeacherDashboard onLogout={handleLogout} /></TeacherRoute>} />
        </Routes>
      </BrowserRouter>
      {/* Global Footer Credit */}
      <footer className="w-full py-6 flex justify-center items-center opacity-70 select-none pointer-events-none mt-auto">
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
