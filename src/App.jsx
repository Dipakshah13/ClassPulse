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

import { useEffect } from 'react';
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
const TeacherRoute = ({ children }) => {
  const auth = JSON.parse(localStorage.getItem('cp_instructor_auth') || '{}');
  if (!auth.authenticated) {
    return <InstructorLogin />; // Force login if not authorized
  }
  return children;
};

function App() {
  useEffect(() => {
    // Restore session on load (especially useful for OAuth redirects)
    const restoreSession = async () => {
      const { session } = await getCurrentSession();
      if (session && session.user) {
        // Sync our local auth state
        localStorage.setItem('cp_instructor_auth', JSON.stringify({
          authenticated: true,
          user: {
            email: session.user.email,
            id: session.user.id
          }
        }));
        
        // IMPORTANT: Inject the teacher ID into the global session store for cloud sync
        const { setTeacherId } = await import('./store/sessionStore');
        setTeacherId(session.user.id);
      }
    };
    restoreSession();
  }, []);

  return (
    <div className="bg-surface text-on-surface font-body min-h-[884px] selection:bg-primary/30 mesh-bg relative overflow-x-hidden">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/session/:sessionId" element={<SessionLayout />} />
          <Route path="/teacher" element={<InstructorLogin />} />
          <Route path="/teacher/config" element={<TeacherRoute><TeacherConfig /></TeacherRoute>} />
          <Route path="/teacher/live" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
          <Route path="/teacher/history" element={<TeacherRoute><TeacherHistory /></TeacherRoute>} />
          <Route path="/teacher/:sessionId" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
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
