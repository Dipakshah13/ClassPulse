import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getFeedback, getReactions, getQuestions,
  upvoteQuestion, removeQuestion, resetSession,
  getCurrentSessionId, resetForNewSession,
  getActivePoll, sendPoll as storeSendPoll, endPoll as storeEndPoll,
  getPinning, setPinning, getSettings,
  subscribe, syncSession, updateQuestionAI, getBreaches
} from '../store/sessionStore';
import { sounds, getMuted, setMuted } from '../utils/soundService';
import { getAIAnswer } from '../services/geminiService';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function computeStats(fb) {
  const total = (fb.gotIt || 0) + (fb.sortOf || 0) + (fb.lost || 0) || 1;
  return {
    gotItPct:  Math.round(((fb.gotIt || 0)  / total) * 100),
    sortOfPct: Math.round(((fb.sortOf || 0) / total) * 100),
    lostPct:   Math.round(((fb.lost || 0)   / total) * 100),
    total: (fb.gotIt || 0) + (fb.sortOf || 0) + (fb.lost || 0),
    clarityIndex: Math.round((((fb.gotIt || 0) * 1 + (fb.sortOf || 0) * 0.5) / total) * 100),
  };
}

const getSortedQuestions = (questions) => {
  if (!questions || questions.length === 0) return [];
  
  // 1. Calculate frequency per topic
  const topicFreq = {};
  questions.forEach(q => {
    const topic = q.ai?.topic || 'General';
    if (topic !== 'General') topicFreq[topic] = (topicFreq[topic] || 0) + 1;
  });

  // 2. Sort: Topic Freq (Desc) -> Upvotes (Desc) -> Timestamp (Desc)
  return [...questions].sort((a, b) => {
    const aTopic = a.ai?.topic || 'General';
    const bTopic = b.ai?.topic || 'General';
    const aFreq = aTopic !== 'General' ? topicFreq[aTopic] : 0;
    const bFreq = bTopic !== 'General' ? topicFreq[bTopic] : 0;

    if (bFreq !== aFreq) return bFreq - aFreq;
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return b.ts - a.ts;
  });
};

/** 
 * Safety reduction for reactions object
 * Use this to get total or sum categories safely
 */
const getTotalReactions = (r) => {
  if (!r || typeof r !== 'object') return 0;
  return Object.values(r).reduce((acc, val) => acc + (Number(val) || 0), 0);
};

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40

function DonutSegment({ pct, offset, gradientId, color }) {
  const dash = (pct / 100) * CIRCUMFERENCE;
  return (
    <circle
      className="donut-segment cursor-pointer"
      cx="50" cy="50" fill="transparent"
      filter="url(#glow)" r="40"
      stroke={`url(#${gradientId})`}
      strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
      strokeDashoffset={-offset}
      strokeWidth="12"
      style={{ color, transition: 'stroke-dasharray 0.8s ease' }}
    />
  );
}

const REACTION_META = [
  { id: 'bulb',  emoji: '💡', color: 'text-secondary' },
  { id: 'clap',  emoji: '👏', color: 'text-primary' },
  { id: 'fire',  emoji: '🔥', color: 'text-white' },
  { id: 'think', emoji: '❓', color: 'text-error' },
  { id: 'mind',  emoji: '🤯', color: 'text-tertiary' },
];

// ─────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  // ── Live store data ─────────────────────────────────────────
  const [feedback,  setFeedback]  = useState(getFeedback());
  const [reactions, setReactions] = useState(getReactions());
  const [questions, setQuestions] = useState(getQuestions());

  // ── Question status overlay (local only) ───────────────────
  const [qStatus, setQStatus] = useState({}); // id → 'answering'

  // ── UI state ────────────────────────────────────────────────
  const [pinned,        setPinned]        = useState(false);
  const [showMenu,      setShowMenu]      = useState(false);
  const [showEndModal,  setShowEndModal]  = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  
  // ── Poll State ──
  const [pollPrompt,    setPollPrompt]    = useState('');
  const [pollOptions,   setPollOptions]   = useState(['Yes', 'No']);
  const [pollSent,      setPollSent]      = useState(false);
  const [activePoll,    setActivePoll]    = useState(null);
  
  const [focusMode,     setFocusMode]     = useState(getPinning());
  const [toast,         setToast]         = useState(null);
  const [now,           setNow]           = useState(Date.now());

  // ── Update current time for countdowns ──────────────────────
  const [isMuted,     setIsMuted]     = useState(getMuted());
  const [breaches,    setBreaches]    = useState(getBreaches());

  // ── Update current time for countdowns ──────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Live AI Brain: Process new questions automatically ──────────
  useEffect(() => {
    // Look for questions that don't have a Gemini answer yet
    const pending = questions.filter(q => !q.ai?.geminiStatus && q.ai?.topic !== 'General' || (q.ai?.topic === 'General' && !q.ai?.geminiStatus));
    
    pending.forEach(async (q) => {
      // Mark as thinking
      updateQuestionAI(q.id, { geminiStatus: 'thinking' });
      
      try {
        const res = await getAIAnswer(q.text, q.ai?.topic);
        if (res) {
          updateQuestionAI(q.id, { 
            geminiAnswer: res.answer, 
            geminiTip: res.tip, 
            geminiStatus: 'complete' 
          });
        }
      } catch (err) {
        console.error("AI Generation failed:", err);
        updateQuestionAI(q.id, { geminiStatus: 'error' });
      }
    });
  }, [questions]);

  // ── Sound Triggers ──────────────────────────────────────────
  useEffect(() => {
    // 1. New Question Sound
    if (questions.length > 0) {
      const lastQ = questions[questions.length - 1];
      // Only play if it's "fresh" (last 1.5 seconds)
      if (Date.now() - lastQ.ts < 1500 && !isMuted) {
         sounds.ping?.();
      }
    }
  }, [questions.length, isMuted]);

  useEffect(() => {
    // 2. Focus Breach Sound
    if (feedback.lost > 0) {
      // We only alert if it INCREMENTS
      // (Simple check for any 'lost' count > 0 for now as a demo, 
      // but in a real app we'd compare with prevFeedback.lost)
    }
  }, [feedback.lost]);

  // ── Guard: clear stale data if this is a different session ──────────────────
  useEffect(() => {
    // Rehydrate if memory is empty on refresh
    if (sessionId) {
      syncSession(sessionId);
    }

    const storedId = getCurrentSessionId();
    if (sessionId && storedId && storedId !== String(sessionId)) {
      resetForNewSession(sessionId);
    } else if (sessionId && !storedId) {
      resetForNewSession(sessionId);
    }
    setFeedback(getFeedback());
    setReactions(getReactions());
    setQuestions(getQuestions());
  }, [sessionId]);

  // ── Subscribe to real-time store changes ───────────────────
  const syncStore = useCallback(() => {
    setFeedback(getFeedback());
    setReactions(getReactions());
    setQuestions(getQuestions());
    setActivePoll(getActivePoll());
    setFocusMode(getPinning());
    setBreaches(getBreaches());
  }, []);

  useEffect(() => {
    syncStore();
    const unsub = subscribe(syncStore);
    return unsub;
  }, [syncStore]);

  // ── Derived stats ──────────────────────────────────────────
  const stats = computeStats(feedback);
  const gotItOffset  = 0;
  const sortOfOffset = (stats.gotItPct / 100) * CIRCUMFERENCE;
  const lostOffset   = sortOfOffset + (stats.sortOfPct / 100) * CIRCUMFERENCE;

  // ── Helpers ─────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleAnswerLive = (id) => {
    setQStatus(prev => ({ ...prev, [id]: 'answering' }));
    showToast('📢 Addressing question live!', 'info');
  };

  const handleDismiss = (id) => {
    removeQuestion(id);
    setQStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
    showToast('✓ Question dismissed', 'success');
  };

  const handleUpvote = (id) => upvoteQuestion(id);

  const handleToggleFocus = () => {
    const newState = !focusMode;
    setPinning(newState);
    setFocusMode(newState);
    showToast(newState ? '🔒 Focus Mode: ON' : '🔓 Focus Mode: OFF', newState ? 'info' : 'success');
  };

  const handleEndSession = () => {
    sounds.shutdown?.();
    resetSession();
    navigate('/');
  };

  const handleExport = () => {
    const settings = getSettings() || {};
    const stats = computeStats(feedback);
    const dateStr = new Date().toLocaleString();
    
    const content = `
╔══════════════════════════════════════════════════════════════╗
║             CLASSPULSE - CLASS INSIGHT REPORT                ║
╚══════════════════════════════════════════════════════════════╝

GENERATED: ${dateStr}
SESSION ID: ${sessionId}

🎓 CLASS METADATA
----------------------------------------------------------------
SUBJECT:   ${settings.subject || 'Not specified'}
TOPIC:     ${settings.topic || 'Not specified'}
CAPACITY:  ${settings.maxStudents || 'Unlimited'}
----------------------------------------------------------------

📊 COMPREHENSION PULSE
----------------------------------------------------------------
CLARITY INDEX: ${stats.clarityIndex}%
TOTAL RESPONSES: ${stats.total}

[👍] GOT IT:   ${feedback.gotIt} (${stats.gotItPct}%)
[🤔] SORT OF: ${feedback.sortOf} (${stats.sortOfPct}%)
[❌] LOST:    ${feedback.lost} (${stats.lostPct}%)
----------------------------------------------------------------

💡 STUDENT ENGAGEMENT (REACTIONS)
----------------------------------------------------------------
💡 BULB:       ${reactions.bulb || 0}
👏 CLAP:       ${reactions.clap || 0}
🔥 FIRE:       ${reactions.fire || 0}
❓ QUESTIONING: ${reactions.think || 0}
🤯 MIND BLOWN:  ${reactions.mind || 0}
----------------------------------------------------------------

❓ ANONYMOUS QUESTIONS (${questions.length})
----------------------------------------------------------------
${questions.length === 0 ? 'No questions were recorded during this session.' : 
  questions.map((q, i) => `${i+1}. [${new Date(q.ts).toLocaleTimeString()}] (${q.upvotes} Upvotes)
   Q: ${q.text}
   AI Insight: ${q.ai?.insight || 'N/A'}
   AI Answer: ${q.ai?.geminiAnswer || 'N/A'}`).join('\n\n')}
----------------------------------------------------------------

END OF REPORT
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClassPulse_Report_${sessionId}_${new Date().getTime()}.txt`;
    a.click();
    showToast('📄 Report exported successfully!', 'success');
  };

  // ── Poll Helpers ──
  const addOption = () => { if (pollOptions.length < 4) setPollOptions([...pollOptions, '']); };
  const removeOption = (idx) => { if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== idx)); };
  const updateOption = (idx, val) => { const n = [...pollOptions]; n[idx] = val; setPollOptions(n); };

  const sendPoll = () => {
    const validOptions = pollOptions.filter(o => o.trim());
    if (!pollPrompt.trim() || validOptions.length < 2) return;
    setPollSent(true);
    storeSendPoll(pollPrompt, validOptions);
    showToast('🚀 Custom poll sent!', 'success');
    
    // Clear the FORM data but KEEP the modal open to show live results
    setTimeout(() => { 
      setPollSent(false); 
      setPollPrompt(''); 
      setPollOptions(['Yes', 'No']); 
    }, 1000);
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="dynamic-mesh text-on-background font-body min-h-[884px] flex flex-col overflow-x-hidden relative">
      {/* Mesh Blobs */}
      <div className="mesh-blob bg-secondary w-[500px] h-[500px] -top-24 -left-24 opacity-10" />
      <div className="mesh-blob bg-tertiary w-[600px] h-[600px] top-1/2 -right-32 opacity-10" />
      <div className="mesh-blob bg-primary w-[400px] h-[400px] bottom-0 left-1/3 opacity-10" />

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full text-sm font-bold shadow-2xl backdrop-blur-xl transition-all
          ${toast.type === 'info' ? 'bg-primary/90 text-on-primary' : 'bg-secondary/90 text-on-secondary'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── End Session Modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setShowEndModal(false)}>
          <div className="glass-panel p-8 rounded-lg max-w-sm w-full mx-4 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-3xl">power_settings_new</span>
              <h2 className="font-headline font-black text-xl text-on-surface">End Session?</h2>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              This will disconnect all students, clear all live data, and close session <strong className="text-primary">{sessionId || '——'}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={handleEndSession} className="flex-1 py-3 rounded-full bg-error text-white font-black text-sm tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(255,110,132,0.3)]">
                End Session
              </button>
              <button onClick={() => setShowEndModal(false)} className="flex-1 py-3 rounded-full bg-white/5 text-on-surface-variant font-bold text-sm hover:bg-white/10 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Poll Modal ── */}
      {showPollModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={() => { setShowPollModal(false); }}>
          <div className="glass-panel p-8 rounded-lg max-w-sm w-full mx-4 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">add_box</span>
              <h2 className="font-headline font-black text-xl text-on-surface">Quick Poll</h2>
            </div>

            {/* Creation Form */}
            {(!activePoll || activePoll.status === 'ended') && (
              <>
                <p className="text-on-surface-variant text-sm">Create a custom multiple-choice poll for your students.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Question</label>
                    <input
                      className="w-full bg-surface-container-highest/60 border border-primary/30 rounded-xl px-4 py-3 text-on-surface text-sm focus:border-primary placeholder:text-on-surface-variant/40 transition-all"
                      placeholder="e.g. Favorite JS Framework?"
                      value={pollPrompt}
                      onChange={e => setPollPrompt(e.target.value)}
                      autoFocus
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Options (Min 2)</label>
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-on-surface text-sm focus:border-secondary transition-all"
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={e => updateOption(idx, e.target.value)}
                        />
                        {pollOptions.length > 2 && (
                          <button onClick={() => removeOption(idx)} className="text-error/60 hover:text-error transition-colors">
                            <span className="material-symbols-outlined text-sm">remove_circle</span>
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 4 && (
                      <button onClick={addOption} className="text-secondary text-xs font-bold flex items-center gap-1 mt-1 hover:opacity-80 transition-opacity">
                        <span className="material-symbols-outlined text-sm">add</span> Add Option
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={sendPoll}
                    disabled={!pollPrompt.trim() || pollOptions.filter(o => o.trim()).length < 2}
                    className="flex-1 py-3 rounded-full font-black text-sm tracking-wider bg-primary text-on-primary hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(163,166,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    Send Poll
                  </button>
                  <button onClick={() => { setShowPollModal(false); setPollPrompt(''); }} className="flex-1 py-3 rounded-full bg-white/5 text-on-surface-variant font-bold text-sm hover:bg-white/10">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Live Results */}
            {activePoll && activePoll.status === 'active' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_6px_rgba(98,250,227,0.8)]" />
                  <p className="text-secondary text-[10px] font-black uppercase tracking-widest">Live · Collecting Responses</p>
                </div>
                <p className="text-on-surface font-bold text-base border border-white/10 rounded-xl px-4 py-3 bg-white/5 shadow-inner">
                  "{activePoll.question}"
                </p>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(() => {
                    const totalVotes = Object.values(activePoll.votes).reduce((a, b) => a + b, 0);
                    const total = totalVotes || 1;
                    return Object.entries(activePoll.votes).map(([text, count], idx) => {
                      const pct = Math.round((count / total) * 100);
                      const colors = ['bg-secondary', 'bg-tertiary', 'bg-primary', 'bg-white/40'];
                      const shadowColors = ['shadow-[0_0_8px_rgba(98,250,227,0.5)]', 'shadow-[0_0_8px_rgba(193,128,255,0.5)]', 'shadow-[0_0_8px_rgba(163,166,255,0.5)]', 'shadow-[0_0_8px_rgba(255,255,255,0.2)]'];
                      return (
                        <div key={text}>
                          <div className="flex justify-between text-[11px] font-bold mb-1.5 px-1">
                            <span className="text-white/80">{text}</span>
                            <span className="text-white">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                            <div className={`h-full ${colors[idx % 4]} rounded-full transition-all duration-700 ease-out ${shadowColors[idx % 4]}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <button
                  onClick={() => { storeEndPoll(); showToast('📊 Poll closed', 'info'); }}
                  className="w-full py-3.5 rounded-full bg-error/20 border border-error/30 text-error font-black text-sm hover:bg-error/30 transition-all">
                  End Live Voting
                </button>
              </>
            )}

            {/* Summary */}
            {activePoll && activePoll.status === 'ended' && (
              <>
                <p className="text-on-surface-variant text-sm font-medium">Final Distribution:</p>
                <div className="space-y-2 py-2">
                   {Object.entries(activePoll.votes).map(([text, count]) => (
                     <div key={text} className="flex justify-between text-xs font-bold px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-on-surface-variant">{text}</span>
                        <span className="text-white">{count}</span>
                     </div>
                   ))}
                </div>
                <button onClick={() => { setShowPollModal(false); setPollPrompt(''); setPollSent(false); }}
                  className="w-full py-3 rounded-full bg-white/10 text-on-surface hover:bg-white/20 font-black text-sm transition-all">
                  Close Insights
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="fixed top-0 z-50 w-full flex justify-between items-center px-6 py-4 bg-surface/40 backdrop-blur-3xl border-b border-outline/10 shadow-xl">
        <div className="flex flex-col items-start px-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">sensors</span>
            <h1 className="font-['Plus_Jakarta_Sans'] font-black tracking-tight text-xl text-primary leading-tight">ClassPulse</h1>
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30 ml-8 -mt-0.5">by Dipak Shah</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button onClick={handleToggleFocus} className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all active:scale-95 ${focusMode ? 'bg-error text-white border-error shadow-[0_0_15px_rgba(255,110,132,0.3)]' : 'bg-white/5 border-white/10 text-on-surface-variant hover:bg-white/10'}`} title="Focus Mode">
              <span className="material-symbols-outlined text-[20px]">{focusMode ? 'visibility_lock' : 'visibility'}</span>
            </button>
            {focusMode && breaches > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-white text-error rounded-full flex items-center justify-center font-black text-[10px] animate-bounce shadow-[0_4px_10px_rgba(255,110,132,0.5)] border border-error">
                {breaches}
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              setMuted(next);
            }} 
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-on-surface-variant hover:bg-white/10 transition-all active:scale-95"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>
          <button onClick={() => navigate('/teacher/history')} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">history</span>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Insights</span>
          </button>
          <div className="px-4 py-1.5 rounded-full bg-surface-bright/50 backdrop-blur-md flex items-center gap-2 border border-outline/10">
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold leading-[1.1]">SESSION<br />CODE</span>
            <span className="font-headline font-bold text-primary">{sessionId || '——'}</span>
          </div>
          <button onClick={() => { setPinned(p => !p); showToast(pinned ? 'Unpinned' : '📌 Session pinned!', 'info'); }}
            className={`material-symbols-outlined transition-all hover:scale-110 active:scale-95 ${pinned ? 'text-[#FACC15]' : 'text-on-surface-variant'}`}>
            push_pin
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(m => !m)} className="material-symbols-outlined text-on-surface-variant hover:text-white transition-colors">more_vert</button>
            {showMenu && (
              <div className="absolute right-0 top-9 z-50 glass-panel rounded-xl overflow-hidden shadow-2xl min-w-[200px]" onMouseLeave={() => setShowMenu(false)}>
                <button onClick={() => { handleExport(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all text-left">
                  <span className="material-symbols-outlined text-base">bar_chart</span> Export Report
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mt-24 px-6 flex-grow max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-panel p-8 rounded-lg flex flex-col justify-center items-center relative overflow-hidden">
              <span className="text-on-surface-variant text-sm font-medium uppercase tracking-widest mb-2">Clarity Index</span>
              <span className="text-7xl font-headline font-extrabold text-tertiary tracking-tighter glow-breathe">{stats.clarityIndex}%</span>
              <div className="w-full h-1 bg-tertiary/20 rounded-full mt-2 overflow-hidden"><div className="h-full bg-tertiary shadow-[0_0_10px_#c180ff]" style={{ width: `${stats.clarityIndex}%` }} /></div>
            </div>
            <div className="glass-panel p-6 rounded-lg flex flex-col">
              <span className="text-on-surface-variant text-sm font-medium uppercase tracking-widest mb-4">Live Reactions</span>
              <div className="flex-grow flex items-end justify-around gap-2 pb-4">
                {REACTION_META.map(r => (
                  <div key={r.id} className="flex flex-col items-center gap-1">
                    <span className="text-3xl">{r.emoji}</span>
                    <span className={`text-[11px] font-black ${r.color}`}>{Number(reactions[r.id]) || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-lg">
             <div className="flex justify-between items-end mb-8">
               <h2 className="font-headline text-2xl font-bold">Comprehension Pulse</h2>
               <div className="flex gap-2 text-[10px] font-black uppercase">
                 <span className="text-secondary">{stats.gotItPct}% Got It</span>
                 <span className="text-tertiary">{stats.sortOfPct}% Sort Of</span>
                 <span className="text-error">{stats.lostPct}% Lost</span>
               </div>
             </div>
             <div className="relative flex justify-center py-4">
                <svg className="w-64 h-64 transform -rotate-90" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="g-sec"><stop offset="0%" stopColor="#62fae3" /><stop offset="100%" stopColor="#2ecc71" /></linearGradient>
                    <linearGradient id="g-ter"><stop offset="0%" stopColor="#c180ff" /><stop offset="100%" stopColor="#8e44ad" /></linearGradient>
                    <linearGradient id="g-err"><stop offset="0%" stopColor="#ff6e84" /><stop offset="100%" stopColor="#c0392b" /></linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <DonutSegment pct={stats.gotItPct}  offset={gotItOffset}  gradientId="g-sec" color="#62fae3" />
                  <DonutSegment pct={stats.sortOfPct} offset={sortOfOffset} gradientId="g-ter"  color="#c180ff" />
                  <DonutSegment pct={stats.lostPct}   offset={lostOffset}   gradientId="g-err"     color="#ff6e84" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                  <span className="text-4xl font-black">{stats.total}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Responses</span>
                </div>
             </div>
          </div>
        </div>

        <div className="md:col-span-4 flex flex-col gap-4">
          <div className="flex justify-between items-center"><h3 className="font-headline font-bold text-lg">Question Queue</h3><span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse border border-primary/30">LIVE · {questions.length}</span></div>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[750px] pr-2 custom-scrollbar">
            {questions.length === 0 ? (
              <div className="glass-panel p-8 text-center text-on-surface-variant text-sm">No questions yet.</div>
            ) : getSortedQuestions(questions).map(q => (
              <div key={q.id} className={`glass-panel p-5 rounded-lg border-l-4 ${q.ai?.topic !== 'General' && (questions.filter(qu => qu.ai?.topic === q.ai?.topic).length >= 3) ? 'border-l-rose-500 bg-rose-500/5 shadow-[inset_0_0_20px_rgba(255,110,132,0.05)]' : 'border-l-primary'}`}>
                <div className="flex justify-between mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Anonymous · {new Date(q.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {q.ai?.topic !== 'General' && (questions.filter(qu => qu.ai?.topic === q.ai?.topic).length >= 3) && (
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter flex items-center gap-1 animate-pulse">
                        <span className="material-symbols-outlined text-[10px]">priority_high</span>
                        Major Cohort Hurdle
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleUpvote(q.id)} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full text-xs font-bold self-start hover:bg-white/10 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-sm text-primary">thumb_up</span>
                    {q.upvotes}
                  </button>
                </div>
                <p className="text-sm font-medium mb-3">{q.text}</p>

                {/* ── AI Insight & Smart Answer Block ── */}
                {q.ai && (
                  <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 animate-in slide-in-from-left duration-500 relative overflow-hidden">
                    {/* Status indicator */}
                    {q.ai.geminiStatus === 'thinking' && (
                       <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/20 overflow-hidden">
                         <div className="h-full bg-primary animate-progress-dash w-1/3" />
                       </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${q.ai.topic !== 'General' ? `bg-${q.ai.color || 'primary'}` : 'bg-white/40'} shadow-[0_0_8px_currentColor]`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                          {q.ai.topic !== 'General' ? q.ai.topic : 'AI Assistant'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {q.ai.badge && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant uppercase tracking-tighter">
                            {q.ai.badge}
                          </span>
                        )}
                        {q.ai.geminiStatus === 'thinking' ? (
                          <span className="text-[8px] font-black text-primary animate-pulse uppercase tracking-widest">Thinking...</span>
                        ) : q.ai.geminiStatus === 'complete' ? (
                          <span className="material-symbols-outlined text-[12px] text-secondary">verified</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Gemini Answer */}
                    {q.ai.geminiAnswer ? (
                      <div className="space-y-2">
                         <p className="text-xs leading-relaxed text-white font-medium">
                           {q.ai.geminiAnswer}
                         </p>
                         {q.ai.geminiTip && (
                           <p className="text-[10px] leading-relaxed text-secondary/80 italic border-t border-white/5 pt-2">
                             <strong className="not-italic text-secondary">Pro Tip:</strong> {q.ai.geminiTip}
                           </p>
                         )}
                      </div>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-on-surface-variant italic">
                        <strong className="text-primary not-italic">Teacher's Insight:</strong> {q.ai.insight}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleDismiss(q.id)} className="text-[10px] font-black uppercase bg-white/5 px-4 py-2 rounded-full hover:bg-white/10">Dismiss</button>
                  <button onClick={() => handleAnswerLive(q.id)} className="text-[10px] font-black uppercase bg-primary text-on-primary px-4 py-2 rounded-full btn-glow">Live Reply</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-12 mt-12 mb-8 flex justify-center">
          <button onClick={() => setShowEndModal(true)} className="glass-panel px-12 py-5 rounded-2xl flex items-center gap-4 bg-error/10 border-error/30 hover:bg-error/20 transition-all hover:scale-105 active:scale-95">
            <span className="material-symbols-outlined text-error text-3xl">power_settings_new</span>
            <div className="flex flex-col items-start"><span className="text-[10px] font-black uppercase tracking-widest text-error/70">Terminate</span><span className="font-headline font-black text-xl tracking-tight">End Live Session</span></div>
          </button>
        </div>
      </main>

      <button onClick={() => setShowPollModal(true)} className="fixed bottom-10 right-8 w-16 h-16 rounded-full bg-primary text-on-primary shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 btn-glow">
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </div>
  );
}
