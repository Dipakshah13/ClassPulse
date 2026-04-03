import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetForNewSession } from '../store/sessionStore';
import { sounds } from '../utils/soundService';

const DURATIONS = [30, 45, 60, 90, 120];

export default function TeacherConfig() {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [subject, setSubject]       = useState('');
  const [topic, setTopic]           = useState('');
  const [maxStudents, setMaxStudents] = useState('');
  const [duration, setDuration]     = useState(30);

  // ── Toggle state ───────────────────────────────────────────────────────────
  const [geofencing, setGeofencing] = useState(true);
  const [hotspot, setHotspot]       = useState(false);
  const [vaultSync, setVaultSync]   = useState(true);

  // ── Session key / QR ──────────────────────────────────────────────────────
  const [sessionKey, setSessionKey] = useState('####');
  const [scrambling, setScrambling] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [qrSrc, setQrSrc]           = useState('');
  const [showQR, setShowQR]         = useState(false);
  const [rawCode, setRawCode]       = useState('');

  // ── Toast / error ─────────────────────────────────────────────────────────
  const [toast, setToast]           = useState('');
  const [errors, setErrors]         = useState({});
  const [launching, setLaunching]   = useState(false);

  const scrambleRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  // ── Session key scramble animation ────────────────────────────────────────
  const generateKey = () => {
    if (scrambling) return;
    setScrambling(true);
    setShowQR(false);
    setKeyRevealed(false);

    const newCode = Math.floor(1000 + Math.random() * 8999).toString();
    const chars   = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let iterations = 0;

    scrambleRef.current = setInterval(() => {
      let scrambled = '#';
      for (let i = 0; i < 4; i++) scrambled += chars[Math.floor(Math.random() * chars.length)];
      setSessionKey(scrambled);
      iterations++;
      if (iterations >= 14) {
        clearInterval(scrambleRef.current);
        const finalKey = `#${newCode}`;
        setSessionKey(finalKey);
        setRawCode(newCode);
        
        // Encode the actual join URL so the QR code is "Valid" and scans to the app
        const sessionUrl = encodeURIComponent(`${window.location.origin}/session/${newCode}`);
        setQrSrc(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${sessionUrl}&color=020617&bgcolor=ffffff&margin=10`);
        
        setScrambling(false);
        setKeyRevealed(true);
        setTimeout(() => setShowQR(true), 400);
      }
    }, 60);
  };

  useEffect(() => () => clearInterval(scrambleRef.current), []);

  const copyLink = () => {
    if (!rawCode) { showToast('Generate a session key first!'); return; }
    navigator.clipboard.writeText(`${window.location.origin}/session/${rawCode}`);
    showToast('✅ Link copied to clipboard!');
  };

  const saveQR = () => {
    if (!rawCode) { showToast('Generate a session key first!'); return; }
    const a = document.createElement('a');
    a.href = qrSrc;
    a.download = `classpulse-session-${rawCode}.png`;
    a.click();
    showToast('📥 QR Code downloading...');
  };

  // ── Validate & launch ─────────────────────────────────────────────────────
  const handleLaunch = async () => {
    const newErrors = {};
    if (!subject.trim()) newErrors.subject = 'Subject name is required.';
    if (!topic.trim())   newErrors.topic   = 'Current topic is required.';
    if (!rawCode)        newErrors.key     = 'Please generate a session code first.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;

    setLaunching(true);

    let originLocation = null;
    let networkSignature = null;

    if (geofencing) {
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true });
        });
        originLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        setLaunching(false);
        showToast('❌ Location access denied/unavailable. Geofencing disabled.');
        return;
      }
    }

    if (hotspot) {
      networkSignature = `net-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ── Clear any previous session data and set new settings ──
    resetForNewSession(rawCode, { 
      geofencing, 
      hotspot,
      vaultSync,
      subject: subject.trim(),
      topic: topic.trim(),
      maxStudents: maxStudents || 'unlimited',
      originLocation,
      networkSignature
    });

    // ── Audit feedback ──
    sounds.startup?.();

    setTimeout(() => {
      setLaunching(false);
      navigate(`/teacher/${rawCode}`);
    }, 1200);
  };

  // ── Toggle switch component ────────────────────────────────────────────────
  const Toggle = ({ on, onToggle }) => (
    <button
      onClick={onToggle}
      className={`relative inline-flex items-center w-11 h-6 rounded-full border transition-all duration-300
        ${on ? `bg-secondary/20 border-secondary/30` : 'bg-on-surface/10 border-on-surface/10'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform duration-300
        ${on ? `left-1 translate-x-5 bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.8)]` : 'left-1 translate-x-0 bg-on-surface-variant/40'}`} />
    </button>
  );

  return (
    <div className="font-body text-on-surface min-h-screen pb-32 overflow-x-hidden relative transition-colors duration-700 bg-background">
      {/* Mesh Blobs */}
      <div className="mesh-blob bg-secondary w-[500px] h-[500px] -top-24 -left-24 opacity-10" />
      <div className="mesh-blob bg-primary w-[600px] h-[600px] top-1/2 -right-32 opacity-10" />
      <div className="mesh-blob bg-tertiary w-[400px] h-[400px] bottom-0 left-1/3 opacity-10" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-primary/90 text-on-primary text-sm font-bold shadow-2xl backdrop-blur-xl transition-all">
          {toast}
        </div>
      )}

      {/* Top AppBar */}
      <header className="fixed top-0 z-50 w-full bg-surface/40 backdrop-blur-2xl border-b border-outline/10 flex justify-between items-center px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-2xl">sensors</span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_rgba(98,250,227,0.8)]" />
          </div>
          <h1 className="font-headline font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary">
            ClassPulse
          </h1>
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => navigate('/teacher/history')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">history</span>
            <span className="text-[10px] font-bold tracking-widest uppercase">History</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(98,250,227,0.8)]" />
            <span className="text-[10px] font-bold tracking-widest text-secondary/80 uppercase">Network</span>
          </div>
          <button
            onClick={() => navigate('/teacher')}
            className="text-[10px] font-bold text-outline hover:text-primary uppercase tracking-wider transition-colors"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="pt-32 px-6 max-w-xl mx-auto space-y-10">
        {/* Header */}
        <section className="space-y-2 text-center sm:text-left">
          <h2 className="font-headline text-4xl font-extrabold tracking-tight text-white">Session Config</h2>
          <p className="text-on-surface-variant text-base font-medium opacity-80">Finalize your digital classroom parameters.</p>
        </section>

        {/* Config Form */}
        <div className="space-y-6">
          <div className="lumina-card p-7 space-y-8">

            {/* Subject Name */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="font-headline text-[11px] uppercase tracking-[0.25em] text-primary font-bold ml-1">Subject Name</label>
                <span className="text-[10px] text-on-surface-variant/50 font-medium">Required</span>
              </div>
              <input
                className={`w-full h-16 px-6 rounded-2xl lumina-input text-white placeholder:text-on-surface-variant/40 font-medium text-lg transition-all duration-300
                  ${errors.subject ? 'border-error/60' : 'focus:border-primary/60 focus:ring-4 focus:ring-primary/10'}`}
                placeholder="e.g., Advanced System Architecture"
                type="text"
                value={subject}
                onChange={e => { setSubject(e.target.value); setErrors(p => ({ ...p, subject: '' })); }}
              />
              {errors.subject && <p className="text-error text-xs ml-1">{errors.subject}</p>}
            </div>

            {/* Topic */}
            <div className="space-y-3">
              <label className="font-headline text-[11px] uppercase tracking-[0.25em] text-primary font-bold ml-1">Current Topic</label>
              <input
                className={`w-full h-16 px-6 rounded-2xl lumina-input text-secondary placeholder:text-on-surface-variant/40 font-medium text-lg transition-all duration-300
                  ${errors.topic ? 'border-error/60' : 'focus:border-secondary/60 focus:ring-4 focus:ring-secondary/10'}`}
                placeholder="e.g., Distributed Ledger Implementation"
                type="text"
                value={topic}
                onChange={e => { setTopic(e.target.value); setErrors(p => ({ ...p, topic: '' })); }}
              />
              {errors.topic && <p className="text-error text-xs ml-1">{errors.topic}</p>}
            </div>

            {/* Max Students */}
            <div className="space-y-4">
              <label className="font-headline text-[11px] uppercase tracking-[0.25em] text-primary font-bold ml-1">Max Students</label>
              <input
                className="w-full h-16 px-6 rounded-2xl lumina-input text-white placeholder:text-on-surface-variant/40 font-medium text-lg focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-all duration-300"
                min="1"
                placeholder="e.g., 50"
                type="number"
                value={maxStudents}
                onChange={e => setMaxStudents(e.target.value)}
              />
            </div>

            {/* Duration Selector */}
            <div className="space-y-4">
              <label className="font-headline text-[11px] uppercase tracking-[0.25em] text-primary font-bold ml-1">Session Duration (min)</label>
              <div className="grid grid-cols-5 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10">
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`py-3.5 rounded-xl text-sm font-black transition-all duration-300 select-none
                      ${duration === d
                        ? 'bg-gradient-to-br from-primary to-primary/80 text-surface shadow-[0_0_20px_rgba(163,166,255,0.4)] ring-1 ring-white/20 scale-100'
                        : 'bg-transparent text-on-surface-variant/70 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Access Key + QR Section */}
          <section className="lumina-card p-8 text-center space-y-6 bg-gradient-to-br from-primary/10 via-transparent to-tertiary/10 border border-outline/20">
            <p className="text-secondary font-headline text-[10px] font-bold tracking-[0.3em] uppercase">Private Access Key</p>

            <div className="flex flex-col items-center gap-8">
              {/* Key display row */}
              <div className="relative flex items-center gap-4">
                <span
                  id="access-key"
                  className={`font-headline text-6xl font-extrabold tracking-tighter transition-all duration-500
                    ${keyRevealed ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]' : scrambling ? 'text-primary' : 'text-white/20'}`}
                >
                  {sessionKey}
                </span>
                <button
                  onClick={generateKey}
                  disabled={scrambling}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-50"
                  title="Regenerate Key"
                >
                  <span className={`material-symbols-outlined text-primary ${scrambling ? 'animate-spin' : ''}`}>refresh</span>
                </button>
              </div>

              {/* Reveal button → QR toggle */}
              {!showQR ? (
                <button
                  onClick={generateKey}
                  disabled={scrambling}
                  className="group relative px-10 py-4 rounded-2xl bg-white/5 border border-white/20 hover:border-primary/50 transition-all duration-300 overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-tertiary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative font-headline text-sm font-extrabold tracking-widest text-white flex items-center gap-3">
                    <span className={`material-symbols-outlined text-primary ${scrambling ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}>
                      qr_code_2
                    </span>
                    {scrambling ? 'GENERATING...' : 'REVEAL SESSION ID'}
                  </span>
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-6 animate-in fade-in duration-500">
                  <div className="relative p-6 rounded-3xl border border-white/20 shadow-[0_0_40px_rgba(163,166,255,0.15)]"
                    style={{ background: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(16px)' }}>
                    <div className="bg-white p-3 rounded-2xl shadow-inner relative">
                      <div className="relative p-1 bg-white rounded-xl shadow-lg overflow-hidden">
                        <img
                          alt="Session QR Code"
                          className="w-48 h-48 block"
                          src={qrSrc}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white p-1.5 rounded-xl shadow-md border border-slate-100">
                            <span className="material-symbols-outlined text-primary text-2xl flex items-center justify-center"
                              style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full border border-primary/30 backdrop-blur-xl"
                      style={{ background: 'rgba(30,41,59,0.4)' }}>
                      <span className="font-headline text-sm font-black tracking-widest text-white">{sessionKey}</span>
                    </div>
                  </div>

                  {/* QR Actions */}
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={saveQR}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-95"
                      style={{ background: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(16px)' }}
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      Save Asset
                    </button>
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-95"
                      style={{ background: 'rgba(30,41,59,0.4)', backdropFilter: 'blur(16px)' }}
                    >
                      <span className="material-symbols-outlined text-lg">content_copy</span>
                      Copy Link
                    </button>
                  </div>
                </div>
              )}
            </div>

            {errors.key && <p className="text-red-400 text-xs">{errors.key}</p>}
          </section>

          {/* Feature Toggles */}
          <div className="grid grid-cols-1 gap-4">
            {/* Geofencing */}
            <div className="lumina-card p-6 flex items-center gap-6 border border-secondary/20 hover:bg-white/[0.04] transition-all cursor-pointer" onClick={() => setGeofencing(g => !g)}>
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0 border border-secondary/30">
                <span className="material-symbols-outlined text-secondary text-2xl">share_location</span>
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="font-headline text-sm font-bold text-white flex items-center gap-2">
                  Geofencing
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${geofencing ? 'bg-secondary shadow-[0_0_6px_rgba(98,250,227,0.8)]' : 'bg-white/20'}`} />
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Radius restricted to <span className="text-secondary">50m</span>
                </p>
              </div>
              <Toggle on={geofencing} onToggle={() => setGeofencing(g => !g)} />
            </div>

            {/* Local Hotspot */}
            <div className="lumina-card p-6 flex items-center gap-6 border border-primary/20 hover:bg-white/[0.04] transition-all cursor-pointer" onClick={() => setHotspot(h => !h)}>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/30">
                <span className="material-symbols-outlined text-primary text-2xl">wifi_tethering</span>
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="font-headline text-sm font-bold text-white">Local Hotspot Mode</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">Enable peer-to-peer connection for students with limited internet access.</p>
              </div>
              <Toggle
                on={hotspot}
                onToggle={() => setHotspot(h => !h)}
                colorOn="bg-primary"
                shadowOn="0_0_8px_rgba(163,166,255,0.8)"
                borderOn="border-primary/30"
              />
            </div>

            {/* Vault Syncing */}
            <div className="lumina-card p-6 flex items-center gap-6 border border-tertiary/20 hover:bg-white/[0.04] transition-all cursor-pointer" onClick={() => setVaultSync(v => !v)}>
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center shrink-0 border border-tertiary/30">
                <span className={`material-symbols-outlined text-tertiary text-2xl ${vaultSync ? 'animate-spin' : ''}`}>cloud_sync</span>
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="font-headline text-sm font-bold text-white">Vault Syncing</h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  {vaultSync ? 'Encrypted backup in progress...' : 'Enable encrypted cloud backup.'}
                </p>
              </div>
              <Toggle
                on={vaultSync}
                onToggle={() => setVaultSync(v => !v)}
                colorOn="bg-tertiary"
                shadowOn="0_0_8px_rgba(193,128,255,0.8)"
                borderOn="border-tertiary/30"
              />
            </div>
          </div>

          {/* GO LIVE Button */}
          <div className="pt-6">
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="glow-button w-full h-20 rounded-3xl bg-gradient-to-r from-primary via-[#7c3aed] to-primary text-white font-headline font-extrabold text-lg tracking-[0.3em] flex items-center justify-center gap-4 shadow-[0_25px_60px_-15px_rgba(124,58,237,0.5)] hover:shadow-[0_30px_70px_-10px_rgba(124,58,237,0.7)] hover:-translate-y-1 active:translate-y-0 duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {launching ? (
                <>
                  <span className="material-symbols-outlined text-2xl animate-spin">autorenew</span>
                  LAUNCHING...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-2xl">bolt</span>
                  GO LIVE
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
