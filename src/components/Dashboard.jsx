import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { incrementFeedback, incrementReaction, addQuestion, updateQuestionAI, getActivePoll, voteOnPoll, getPinning, getSettings, getCurrentSessionId, subscribe, incrementBreaches } from '../store/sessionStore';
import { getAIAnswer } from '../services/geminiService';
import { sounds, getMuted } from '../utils/soundService';

const EMOJIS = [
  { key: 'bulb', emoji: '💡' },
  { key: 'clap', emoji: '👏' },
  { key: 'fire', emoji: '🔥' },
  { key: 'think', emoji: '❓' },
  { key: 'mind', emoji: '🤯' },
];

// ── Geofencing Helpers ──────────────────────────────────────────────────
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

const Dashboard = () => {
  const { sessionId } = useParams();
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);
  const [reactionFlash, setReactionFlash] = useState(null);
  const [poll, setPoll] = useState(null);
  const [voted, setVoted] = useState(false); // track if user already voted
  const [isPinned, setIsPinned] = useState(false);
  const [focusLost, setFocusLost] = useState(false);
  const [needsLockIn, setNeedsLockIn] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [sessionSettings, setSessionSettings] = useState({ geofencing: false, hotspot: false, originLocation: null, networkSignature: null });
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null); // 'distance' | 'denied' | 'network'
  const [hasOverride, setHasOverride] = useState(false);
  const [lastCheckedSettings, setLastCheckedSettings] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(!!document.fullscreenElement);

  // ── Sync states from store ──────────────────────────────────────────────────
  useEffect(() => {
    let prevId = getCurrentSessionId();

    const sync = () => {
      const currentId = getCurrentSessionId();
      
      // Auto-join if URL sessionId doesn't match store (important for initial direct join)
      if (sessionId && currentId !== sessionId) {
        localStorage.setItem('cp_session_id', sessionId);
        // Clear old local volatile data to prevent spillover from older sessions
        localStorage.removeItem('cp_feedback');
        localStorage.removeItem('cp_reactions');
        localStorage.removeItem('cp_questions');
        
        // Auditory confirmation
        sounds.join();
      }

      // 1. Session Status
      if (prevId && !currentId) {
        setIsEnded(true);
      }
      prevId = currentId;

      // 2. Settings
      const settings = getSettings();
      setSessionSettings(settings);

      // 3. Poll
      const active = getActivePoll();
      setPoll(active);
      if (active && active.id !== poll?.id) setVoted(false);

      // 4. Pinning
      const pinned = getPinning();
      setIsPinned(pinned);
      if (!pinned) {
        setFocusLost(false);
        setNeedsLockIn(false);
      }
    };
    sync();
    const unsub = subscribe(sync);
    return unsub;
  }, [poll?.id, isPinned, sessionId]);

  // ── Sound Triggers ──────────────────────────────────────────
  useEffect(() => {
    if (poll && poll.status === 'active' && !getMuted()) {
       sounds.notify();
    }
  }, [poll?.id]);

  useEffect(() => {
    if (isPinned && !getMuted()) {
      sounds.lock();
    }
  }, [isPinned]);

  // ── Geofencing & Hotspot Check ───────────────────────────────────────────
  useEffect(() => {
    if ((sessionSettings.geofencing || sessionSettings.hotspot) && !isEnded && !hasOverride) {
      setVerifyingLocation(true);
      setLocationError(null);

      const runChecks = async () => {
        // Only re-run if key settings changed or location has moved significantly
        const settingsFingerprint = JSON.stringify({
          geo: sessionSettings.geofencing,
          hot: sessionSettings.hotspot,
          loc: sessionSettings.originLocation
        });

        if (lastCheckedSettings === settingsFingerprint) {
          setVerifyingLocation(false);
          return;
        }

        // 1. Geofencing check
        if (sessionSettings.geofencing && sessionSettings.originLocation) {
          try {
            const pos = await new Promise((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
              });
            });
            const dist = getDistance(
              pos.coords.latitude, pos.coords.longitude,
              sessionSettings.originLocation.lat, sessionSettings.originLocation.lng
            );

            if (dist > 100) { // 100m limit
              setLocationError('distance');
              setVerifyingLocation(false);
              return;
            }
          } catch (err) {
            setLocationError('denied');
            setVerifyingLocation(false);
            return;
          }
        }

        // 2. Hotspot check (simulated via signature)
        if (sessionSettings.hotspot && sessionSettings.networkSignature) {
          await new Promise(r => setTimeout(r, 800)); // faster check
        }

        setLastCheckedSettings(settingsFingerprint);
        setVerifyingLocation(false);
      };

      runChecks();
    } else {
      setVerifyingLocation(false);
      setLocationError(null);
    }
  }, [sessionSettings.geofencing, sessionSettings.hotspot, sessionSettings.originLocation, isEnded, hasOverride]);

  // ── Visibility Detection (Anti-Tab Switch) ──────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (isPinned && document.visibilityState === 'hidden') {
        setFocusLost(true);
        incrementBreaches(); // Notify teacher
      } else if (isPinned && document.visibilityState === 'visible' && focusLost) {
        // Vibrate to alert student upon return
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      }
    };
    const handleFsChange = () => {
      const currentlyFs = !!document.fullscreenElement;
      setIsFullScreen(currentlyFs);
      // If student EXITS fullscreen while teacher has pinned the class -> BREACH
      if (isPinned && !currentlyFs && !hasOverride) {
        setFocusLost(true);
        incrementBreaches(); // Notify teacher
        if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isPinned, focusLost, hasOverride]);

  // ── Send feedback to the store ──────────────────────────────────────────────
  const handleFeedback = (type) => {
    setActiveFeedback(type);
    incrementFeedback(type); // 'gotIt' | 'sortOf' | 'lost'
  };

  // ── Send emoji reaction ─────────────────────────────────────────────────────
  const handleEmoji = (key) => {
    if (isEnded) return;
    if (!getMuted()) sounds.pop();
    incrementReaction(key);
    setReactionFlash(key);
    setTimeout(() => setReactionFlash(null), 600);
  };

  // ── Send anonymous question ─────────────────────────────────────────────────
  const handleSendQuestion = async () => {
    if (!question.trim()) return;
    const questionText = question.trim();

    // 1. Save immediately → appears on teacher screen right away
    const newQ = addQuestion(questionText);
    setSent(true);
    setQuestion('');
    if (!getMuted()) sounds.success(); // Rewarding chime
    setTimeout(() => setSent(false), 3000);

    // 2. Mark as loading while Gemini is called
    updateQuestionAI(newQ.id, { geminiStatus: 'loading', geminiAnswer: null, geminiTip: null });

    // 3. Try to get AI answer
    const fetchAndUpdate = async (questionId, qText, topic) => {
      try {
        const result = await getAIAnswer(qText, topic || '');
        if (!result) return;

        if (result.rateLimited) {
          // Rate limited — tell teacher to wait, auto-retry in 75s + random jitter
          // Random jitter (0-10s) prevents multiple questions from colliding on retry
          const jitter = Math.floor(Math.random() * 10000);
          const delay = 75000 + jitter;
          const retryAt = Date.now() + delay;

          updateQuestionAI(questionId, {
            geminiStatus: 'rate_limited',
            geminiAnswer: null,
            geminiTip: null,
            retryAt
          });
          // Schedule background retry
          setTimeout(() => fetchAndUpdate(questionId, qText, topic), delay);
          return;
        }

        updateQuestionAI(questionId, {
          geminiStatus: 'done',
          geminiAnswer: result.answer,
          geminiTip: result.tip,
        });
      } catch {
        updateQuestionAI(questionId, { geminiStatus: 'error', geminiAnswer: null, geminiTip: null });
      }
    };

    await fetchAndUpdate(newQ.id, questionText, newQ.ai?.topic);
  };

  const handleLockIn = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => { });
    }
    setNeedsLockIn(false);
  };

  const handleReturn = () => {
    setFocusLost(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSendQuestion();
    }
  };

  const isActive = (type) => activeFeedback === type;

  // Derivations
  const lockedByTeacher = isPinned && !isFullScreen && !hasOverride && !focusLost;
  const mustLockIn = lockedByTeacher || needsLockIn;

  return (
    <>
      {/* ── Overlays (Placed OUTSIDE blurred main container) ── */}
      {isEnded && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-3xl animate-in fade-in duration-1000">
          <div className="flex flex-col items-center gap-8 max-w-xs text-center p-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-secondary to-tertiary animate-pulse opacity-20 blur-xl absolute inset-0" />
              <div className="w-32 h-32 rounded-full border-2 border-outline flex items-center justify-center bg-surface backdrop-blur-xl relative">
                <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
              <div className="absolute -top-2 -right-2 bg-secondary text-black px-3 py-1 rounded-full text-[10px] font-black tracking-widest shadow-xl">FINISHED</div>
            </div>

            <div className="space-y-3">
              <h1 className="font-headline font-black text-4xl text-white tracking-tight leading-tight">Session ended.</h1>
              <p className="text-on-surface-variant font-bold text-lg leading-relaxed bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">Keep learning.</p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <button
              onClick={() => window.location.href = '/'}
              className="px-10 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-xs shadow-[0_15px_40px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
              Home Screen
            </button>
          </div>
        </div>
      )}

      {(verifyingLocation || locationError) && !isEnded && !hasOverride && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-background/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-8 max-w-sm text-center px-8">

            {/* Dynamic Status Icon */}
            <div className="relative flex items-center justify-center">
              {!locationError ? (
                <>
                  <div className="absolute w-24 h-24 rounded-full border border-secondary/40 animate-ping opacity-20" />
                  <div className="w-20 h-20 rounded-full bg-secondary text-black flex items-center justify-center shadow-[0_0_50px_rgba(98,250,227,0.4)]">
                    <span className="material-symbols-outlined text-4xl animate-spin" style={{ animationDuration: '3s' }}>share_location</span>
                  </div>
                </>
              ) : (
                <div className="w-20 h-20 rounded-full bg-error text-white flex items-center justify-center shadow-[0_0_40px_rgba(255,110,132,0.4)] animate-bounce">
                  <span className="material-symbols-outlined text-4xl">location_off</span>
                </div>
              )}
            </div>

            {/* Status Text */}
            <div className="space-y-4">
              {!locationError ? (
                <>
                  <h2 className="text-secondary font-headline font-black text-2xl tracking-[0.2em] uppercase">Checking...</h2>
                  <p className="text-white/60 text-sm font-medium">Verifying Classroom Proximity & Network</p>
                </>
              ) : (
                <>
                  <h2 className="text-error font-headline font-black text-2xl tracking-[0.1em] uppercase">Access Restricted</h2>
                  <p className="text-white/70 text-sm font-medium leading-relaxed">
                    {locationError === 'distance' && "You are outside the classroom boundary (100m limit)."}
                    {locationError === 'denied' && "GPS access was denied or location data is unavailable."}
                    {locationError === 'network' && "Please connect to the local classroom hotspot to proceed."}
                  </p>
                </>
              )}
            </div>

            {/* Actions for Errors */}
            {locationError && (
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                  Retry Verification
                </button>
                <button
                  onClick={() => setHasOverride(true)}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold uppercase tracking-widest text-[10px] hover:text-white hover:bg-white/10 transition-all">
                  Manual Override (Bypass)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {focusLost && (
        <div className="fixed inset-0 z-[195] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-8 text-center">
          <div className="flex flex-col items-center gap-6 max-w-xs animate-shake">
            <div className="w-24 h-24 rounded-full bg-error/20 flex items-center justify-center border-2 border-error/40 mb-2 shadow-[0_0_50px_rgba(255,110,132,0.4)]">
              <span className="material-symbols-outlined text-error text-7xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>dangerous</span>
            </div>
            <h1 className="font-headline font-black text-5xl text-error leading-tight tracking-tighter">GET BACK!</h1>
            <p className="text-white font-bold text-lg leading-tight uppercase tracking-widest opacity-80">Focus Breach Detected</p>
            <p className="text-white/40 font-medium text-sm">The instructor has been notified that you switched tabs while Focus Mode was active.</p>
            <button
              onClick={() => {
                handleLockIn();
                handleReturn();
                if (navigator.vibrate) navigator.vibrate(200);
              }}
              className="mt-4 px-12 py-4 rounded-full bg-error text-white font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,110,132,0.3)]">
              Restore Focus
            </button>
          </div>
        </div>
      )}

      {/* The actual focus requirement state */}
      {mustLockIn && !isEnded && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-primary p-8 text-center text-on-surface">
          <div className="flex flex-col items-center gap-6 max-w-xs transition-all text-background">
            <span className="material-symbols-outlined text-6xl animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h1 className="font-headline font-black text-3xl leading-tight">Class Locked!</h1>
            <p className="font-bold opacity-80 leading-relaxed">The teacher has enabled Focus Mode. Lock-in to stay synchronized.</p>
            <button onClick={handleLockIn} className="w-full py-4 rounded-2xl bg-background text-on-surface font-black uppercase tracking-widest active:scale-95 transition-all">
              Lock in
            </button>
          </div>
        </div>
      )}

      <main className={`pt-24 pb-36 px-6 max-w-md mx-auto flex flex-col gap-6 min-h-[884px] transition-all duration-700
        ${(focusLost || verifyingLocation || isEnded || mustLockIn) ? 'blur-3xl scale-[0.98] pointer-events-none opacity-40' : ''}`}>


        {/* Status Indicator (Floating Dock) */}
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-md">
          <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-white/5">
            <div className="flex flex-col">
              <span className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(98,250,227,0.8)]" />
                Live Session
              </span>
              <h2 className="text-white font-headline font-black text-xs tracking-tight">#{sessionId} · FEEDBACK</h2>
            </div>
            <div className="flex items-center gap-2">
              {sessionSettings.hotspot && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary" title="P2P Enabled">
                  <span className="material-symbols-outlined text-[16px]">wifi_tethering</span>
                </div>
              )}
              {sessionSettings.geofencing && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 border border-secondary/20 text-secondary" title="Location Verified">
                  <span className="material-symbols-outlined text-[16px]">share_location</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Live Poll Banner (appears when teacher sends a poll) ── */}
        {poll && poll.status === 'active' && (
          <div className="glass-card rounded-2xl p-5 border border-primary/40 shadow-[0_0_25px_rgba(163,166,255,0.15)] animate-pulse-once">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_rgba(163,166,255,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">📊 Live Poll from Teacher</span>
            </div>
            <p className="text-on-surface font-bold text-base mb-4 leading-snug">"{poll.question}"</p>
            {!voted ? (
              <div className="flex flex-col gap-2">
                {poll.options && poll.options.map((opt, idx) => {
                  const colors = [
                    'bg-secondary/20 border-secondary/40 text-secondary shadow-[0_0_12px_rgba(98,250,227,0.2)]',
                    'bg-tertiary/20 border-tertiary/40 text-tertiary shadow-[0_0_12px_rgba(193,128,255,0.2)]',
                    'bg-primary/20 border-primary/40 text-primary shadow-[0_0_12px_rgba(163,166,255,0.2)]',
                    'bg-white/5 border-white/20 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                  ];
                  return (
                    <button
                      key={idx}
                      onClick={() => { voteOnPoll(opt); setVoted(true); }}
                      className={`w-full py-3.5 rounded-2xl border font-black text-sm hover:scale-[1.02] active:scale-95 transition-all ${colors[idx % 4]}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3 rounded-full bg-secondary/10 border border-secondary/20">
                <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-secondary font-bold text-sm">Vote received! ✓</span>
              </div>
            )}
          </div>
        )}

        {poll && poll.status === 'ended' && (
          <div className="glass-card rounded-2xl p-4 border border-white/10 opacity-60">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">📊 Poll Ended</p>
            <p className="text-on-surface text-sm font-medium">"{poll.question}"</p>
          </div>
        )}

        {/* Feedback buttons */}
        <div className={`flex flex-col gap-4 ${focusLost ? 'pointer-events-none' : ''}`}>
          {/* GOT IT */}
          <button
            onClick={() => handleFeedback('gotIt')}
            className={`emerald-glass btn-wow h-40 rounded-3xl flex items-center justify-between px-8 group relative overflow-hidden
            ${isActive('gotIt') ? 'ring-2 ring-emerald-400 scale-[1.02] shadow-[0_0_40px_rgba(16,185,129,0.3)] luminous-pulse' : 'opacity-80 hover:opacity-100 hover:scale-[1.01]'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-start text-left z-10 w-full">
              <span className="text-emerald-400 font-headline font-black text-4xl tracking-tighter mb-1">GOT IT</span>
              <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-widest">
                {isActive('gotIt') ? '✓ Synchronized' : 'High Clarity'}
              </p>
            </div>
            <div className={`flex-shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-500
            ${isActive('gotIt') ? 'bg-emerald-500 text-black border-emerald-400 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 group-hover:scale-110'}`}>
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: `'FILL' ${isActive('gotIt') ? 1 : 0}` }}>check_circle</span>
            </div>
          </button>

          {/* SORT OF */}
          <button
            onClick={() => handleFeedback('sortOf')}
            className={`amber-glass btn-wow h-40 rounded-3xl flex items-center justify-between px-8 group relative overflow-hidden
            ${isActive('sortOf') ? 'ring-2 ring-amber-400 scale-[1.02] shadow-[0_0_40px_rgba(245,158,11,0.3)] luminous-pulse' : 'opacity-80 hover:opacity-100 hover:scale-[1.01]'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-start text-left z-10 w-full">
              <span className="text-amber-400 font-headline font-black text-4xl tracking-tighter mb-1">SORT OF</span>
              <p className="text-amber-400/60 text-xs font-bold uppercase tracking-widest">
                {isActive('sortOf') ? '✓ Noted' : 'Partial Understanding'}
              </p>
            </div>
            <div className={`flex-shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-500
            ${isActive('sortOf') ? 'bg-amber-500 text-black border-amber-400 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 group-hover:scale-110'}`}>
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: `'FILL' ${isActive('sortOf') ? 1 : 0}` }}>help_center</span>
            </div>
          </button>

          {/* LOST */}
          <button
            onClick={() => handleFeedback('lost')}
            className={`rose-glass btn-wow h-40 rounded-3xl flex items-center justify-between px-8 group relative overflow-hidden
            ${isActive('lost') ? 'ring-2 ring-rose-400 scale-[1.02] shadow-[0_0_40px_rgba(244,63,94,0.3)] luminous-pulse' : 'opacity-80 hover:opacity-100 hover:scale-[1.01]'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-start text-left z-10 w-full">
              <span className="text-rose-400 font-headline font-black text-4xl tracking-tighter mb-1">LOST</span>
              <p className="text-rose-400/60 text-xs font-bold uppercase tracking-widest">
                {isActive('lost') ? '✓ Alerted Teacher' : 'Requires Re-explanation'}
              </p>
            </div>
            <div className={`flex-shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center border transition-all duration-500
            ${isActive('lost') ? 'bg-rose-500 text-white border-rose-400 scale-110 shadow-[0_0_20px_rgba(244,63,94,0.5)]' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 group-hover:scale-110'}`}>
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: `'FILL' ${isActive('lost') ? 1 : 0}` }}>warning</span>
            </div>
          </button>
        </div>

        {/* Emoji Reaction Bar (Integrated Shell) */}
        <div className={`reaction-dock rounded-3xl px-2 py-2 flex items-center justify-around shadow-2xl ${focusLost ? 'pointer-events-none opacity-20' : ''}`}>
          {EMOJIS.map(({ key, emoji }) => (
            <button
              key={key}
              onClick={() => handleEmoji(key)}
              className={`w-14 h-14 flex items-center justify-center text-3xl rounded-2xl transition-all duration-150
                ${reactionFlash === key ? 'emoji-active bg-white/10' : 'hover:bg-white/5 active:scale-110'}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Ask a Question (Pro Console) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-2">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>message</span>
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-white/60">Anonymous Console</h3>
          </div>

          <div className="glass-panel border-white/10 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-focus-within:bg-primary/20 transition-all" />

            {sent ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center animate-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-2 border border-secondary/30">
                  <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <p className="text-secondary font-black text-lg tracking-tight">Transmission Sent</p>
                <p className="text-on-surface-variant text-xs font-medium px-4">Your anonymous query has been broadcasted to the instructor.</p>
              </div>
            ) : (
              <>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-background/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none shadow-inner"
                  placeholder="Ask what's on your mind..."
                  rows="3"
                />
                <button
                  onClick={handleSendQuestion}
                  disabled={!question.trim()}
                  className="w-full h-14 bg-primary text-black font-headline font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(163,166,255,0.3)] hover:shadow-[0_15px_40px_rgba(163,166,255,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                >
                  <span>Broadcast Question</span>
                  <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">send</span>
                </button>
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="material-symbols-outlined text-[12px] text-white/30">visibility_off</span>
                  <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">End-to-End Anonymous</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Focus Mode Card */}
        <div className={`mt-4 p-4 border border-primary/20 rounded-lg bg-primary/5 flex items-start gap-4 ${mustLockIn ? 'blur-sm' : ''}`}>
          <span className="material-symbols-outlined text-primary mt-1">visibility_lock</span>
          <div>
            <h4 className="text-on-surface font-bold text-sm">STAY FOCUSED</h4>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              External notifications are muted. Tap to exit focus mode if required.
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;
