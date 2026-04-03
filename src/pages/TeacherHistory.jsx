import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory, getTeacherId } from '../store/sessionStore';

const TeacherHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const teacherId = getTeacherId() || 'anonymous';

  useEffect(() => {
    setHistory(getHistory(teacherId));
  }, [teacherId]);

  const calculateSuccess = (feedback) => {
    const total = (feedback.gotIt || 0) + (feedback.sortOf || 0) + (feedback.lost || 0);
    if (total === 0) return 0;
    return Math.round(((feedback.gotIt || 0) / total) * 100);
  };

  const formatDate = (ts) => {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getHurdles = (sessionQuestions) => {
    if (!sessionQuestions || sessionQuestions.length === 0) return [];
    const counts = {};
    sessionQuestions.forEach(q => {
      const topic = q.ai?.topic || 'General';
      if (topic !== 'General') {
        counts[topic] = (counts[topic] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([topic, count]) => count >= 3)
      .map(([topic, count]) => ({ topic, count }));
  };

  return (
    <div className="min-h-screen dynamic-mesh p-8 md:p-12 pb-24">
      {/* Header Area */}
      <header className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/teacher/config')}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </button>
            <h1 className="text-white font-headline font-black text-3xl tracking-tight uppercase">Session Insights Hub</h1>
          </div>
          <p className="text-on-surface-variant text-sm font-bold tracking-widest uppercase ml-13">Evidence-based classroom optimization</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="glass-panel px-6 py-3 rounded-2xl border-white/5 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">history_edu</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Sessions</span>
              <span className="text-white font-headline font-bold text-xl leading-none">{history.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto">
        {history.length === 0 ? (
          <div className="glass-panel rounded-3xl p-20 flex flex-col items-center justify-center text-center border-dashed border-white/10">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-white/20 text-5xl">monitoring</span>
            </div>
            <h2 className="text-white font-headline font-black text-2xl mb-2">No Observational Data Yet</h2>
            <p className="text-on-surface-variant max-w-xs leading-relaxed">
              Once you complete your first live session, your analytical insights will appear here automatically.
            </p>
            <button
              onClick={() => navigate('/teacher/config')}
              className="mt-8 px-10 py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              Start New Class
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {history.map((session, idx) => {
              const successRate = calculateSuccess(session.feedback);
              return (
                <div
                  key={idx}
                  className="glass-card group p-6 rounded-3xl border-white/5 hover:border-primary/20 hover:bg-white/5 transition-all duration-500 cursor-pointer relative overflow-hidden"
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />

                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex flex-col">
                      <h3 className="text-white font-headline font-black text-xl tracking-tight line-clamp-1">
                        {session.settings?.subject || 'Unnamed Subject'}
                      </h3>
                      <p className="text-primary text-[10px] font-black tracking-widest uppercase opacity-70">
                        {session.settings?.topic || 'General Session'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        {session.isSynced ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black tracking-widest uppercase">
                            <span className="material-symbols-outlined text-xs">cloud_done</span>
                            Synced
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/30 text-[9px] font-black tracking-widest uppercase">
                            <span className="material-symbols-outlined text-xs">cloud_off</span>
                            Local
                          </div>
                        )}
                        <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest uppercase">
                          ID: {session.id}
                        </div>
                      </div>
                      <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                        {formatDate(session.ts)}
                      </span>
                      {getHurdles(session.questions).length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black tracking-widest uppercase animate-pulse">
                          <span className="material-symbols-outlined text-[10px]">priority_high</span>
                          Hurdle Detected
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 relative z-10">
                    <div className="flex items-end justify-between border-b border-white/5 pb-4">
                      <div>
                        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] mb-1">Understanding</p>
                        <h3 className="text-white font-headline font-black text-4xl tracking-tighter">{successRate}%</h3>
                      </div>
                      <div className="w-16 h-16 rounded-full border-2 border-white/5 flex items-center justify-center p-1">
                        <svg className="w-full h-full transform -rotate-10">
                          {/* Background shadow circle */}
                          <circle cx="50%" cy="50%" r="40%" fill="none" strokeWidth="2" stroke="rgba(255,255,255,0.05)" />
                          {/* Success rate path */}
                          <circle
                            cx="50%" cy="50%" r="40%"
                            fill="none" strokeWidth="3"
                            stroke={successRate > 70 ? '#62fae3' : successRate > 40 ? '#a3a6ff' : '#ff6e84'}
                            strokeDasharray={`${successRate}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-primary">chat_bubble</span>
                          <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Questions</span>
                        </div>
                        <span className="text-white font-headline font-bold text-lg leading-none">{session.questions?.length || 0}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-secondary">group</span>
                          <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Capacity</span>
                        </div>
                        <span className="text-white font-headline font-bold text-lg leading-none">
                          {session.settings?.maxStudents || '∞'}
                        </span>
                      </div>
                    </div>

                    <button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] group-hover:bg-primary group-hover:text-black transition-all">
                      View Full Analytical Recap
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-6 animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] rounded-3xl p-8 overflow-y-auto relative animate-in zoom-in-95 duration-300 custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setSelectedSession(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all hover:scale-110 active:scale-95"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="mb-8 border-b border-white/10 pb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">insights</span>
                    </div>
                    <h2 className="text-white font-headline font-black text-3xl tracking-tight">
                      {selectedSession.settings?.subject || 'Session Recap'}
                    </h2>
                  </div>
                  <div className="space-y-1 ml-15">
                    <p className="text-primary text-[11px] font-black tracking-[0.2em] uppercase">
                      TOPIC: {selectedSession.settings?.topic || 'N/A'}
                    </p>
                    <p className="text-on-surface-variant text-[10px] font-black tracking-[0.2em] uppercase">
                      ID: {selectedSession.id} · {formatDate(selectedSession.ts)} · Seats: {selectedSession.settings?.maxStudents || '∞'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="glass-card rounded-2xl py-6 text-center border-emerald-500/20 bg-emerald-500/10">
                <p className="text-emerald-400 font-headline font-black text-4xl tracking-tighter">{selectedSession.feedback.gotIt}</p>
                <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Learned</p>
              </div>
              <div className="glass-card rounded-2xl py-6 text-center border-amber-500/20 bg-amber-500/10">
                <p className="text-amber-400 font-headline font-black text-4xl tracking-tighter">{selectedSession.feedback.sortOf}</p>
                <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">Uncertain</p>
              </div>
              <div className="glass-card rounded-2xl py-6 text-center border-rose-500/20 bg-rose-500/10">
                <p className="text-rose-400 font-headline font-black text-4xl tracking-tighter">{selectedSession.feedback.lost}</p>
                <p className="text-[10px] font-bold text-rose-400/60 uppercase tracking-widest">Lost</p>
              </div>
            </div>

            {/* ── Curriculum Intelligence Section ── */}
            {getHurdles(selectedSession.questions).length > 0 && (
              <div className="mb-10 space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 px-2">
                  <span className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">Curriculum Intelligence</span>
                  <div className="h-px flex-1 bg-primary/10" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {getHurdles(selectedSession.questions).map((h, i) => (
                    <div key={i} className="glass-card p-5 rounded-2xl border-rose-500/20 bg-rose-500/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-rose-400">history_edu</span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ff6e84]" />
                        <h4 className="text-rose-400 font-headline font-black text-sm tracking-tight uppercase">Topic Hurdle: {h.topic}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/20 rounded-full text-rose-300">{h.count} Questions</span>
                      </div>
                      <p className="text-on-surface-variant text-xs leading-relaxed italic pr-12">
                        <strong className="text-white not-italic">Pedagogical Advice:</strong> This topic was a major hurdle for this cohort. For your next class, consider adding more visual demos or a deeper drill-down to optimize the learning curve.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <span className="text-white/60 font-black text-[10px] uppercase tracking-[0.2em]">Anonymous Question Log</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="space-y-3">
                {selectedSession.questions.length === 0 ? (
                  <div className="p-8 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <p className="text-on-surface-variant text-sm italic">No curiosity instances were recorded during this session.</p>
                  </div>
                ) : (
                  selectedSession.questions.map((q, idx) => (
                    <div key={idx} className="bg-white/5 rounded-2xl p-5 border border-white/5 group hover:bg-white/10 transition-all">
                      <p className="text-white text-base leading-relaxed tracking-tight">"{q.text}"</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                          <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                          <span className="text-[10px] font-black text-primary">{q.upvotes}</span>
                        </div>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Authorized Query</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHistory;
