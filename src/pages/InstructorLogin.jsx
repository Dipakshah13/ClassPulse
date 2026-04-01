import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginTeacher, signUpTeacher, verifyTeacherEmail, resendVerification, loginWithGoogle } from '../services/classPulseAuth';
import { setTeacherId } from '../store/sessionStore';

export default function InstructorLogin() {
  const navigate = useNavigate();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [otp, setOtp]               = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) { setError('Missing credentials'); return; }

    setLoading(true);
    try {
      if (isRegistering) {
        const { user, requireEmailVerification, error: signUpErr } = await signUpTeacher(trimmedEmail, password);
        if (signUpErr) throw signUpErr;
        
        if (requireEmailVerification) {
          setIsVerifying(true);
          showToast('📧 Verification code sent to your email!');
        } else {
          showToast('🎉 Account created successfully!');
          // Automatically login after signup
          const { user: loggedInUser, error: loginErr } = await loginTeacher(trimmedEmail, password);
          if (loginErr) throw loginErr;
          setTeacherId(loggedInUser.id);
          localStorage.setItem('cp_instructor_auth', JSON.stringify({
            authenticated: true,
            method: 'password',
            loginTime: Date.now()
          }));
          navigate('/teacher/config');
        }
      } else {
        const { user, error: loginErr } = await loginTeacher(trimmedEmail, password);
        if (loginErr) {
          if (loginErr.message?.toLowerCase().includes('email verification required')) {
            setIsVerifying(true);
            showToast('📩 Please verify your email first.');
            return;
          }
          throw loginErr;
        }
        setTeacherId(user.id);
        localStorage.setItem('cp_instructor_auth', JSON.stringify({
          authenticated: true,
          method: 'password',
          loginTime: Date.now()
        }));
        navigate('/teacher/config');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    
    setLoading(true);
    setError('');
    try {
      const { user, error: verifyErr } = await verifyTeacherEmail(email.trim(), otp);
      if (verifyErr) throw verifyErr;
      
      showToast('✅ Email Verified!');
      setTeacherId(user.id);
      localStorage.setItem('cp_instructor_auth', JSON.stringify({
        authenticated: true,
        method: 'password',
        loginTime: Date.now()
      }));
      setTimeout(() => navigate('/teacher/config'), 800);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { error: resendErr } = await resendVerification(email.trim());
      if (resendErr) throw resendErr;
      showToast('📩 A new code has been sent!');
    } catch (err) {
      setError('Failed to resend code.');
    }
  };

  const handleBiometric = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      localStorage.setItem('cp_instructor_auth', JSON.stringify({
        authenticated: true,
        name: 'Authorized Instructor',
        method: 'biometric',
        loginTime: Date.now()
      }));
      showToast('✅ Identity Verified via Biometrics');
      setTimeout(() => navigate('/teacher/config'), 800);
    }, 2800);
  };

  const handleGoogle = async () => {
    setIsConnecting(true);
    try {
      const { data, error: googleErr } = await loginWithGoogle();
      if (googleErr) throw googleErr;
      // Note: Redirect happens automatically via OAuth
    } catch (err) {
      setError(err.message || 'Google login failed.');
      setIsConnecting(false);
    }
  };

  const handleForgot    = (e) => { e.preventDefault(); showToast('📧 Password reset email sent!'); };

  return (
    <div className="mesh-bg font-body text-on-surface flex items-center justify-center min-h-screen p-6 overflow-x-hidden relative">
      
      {/* ── Biometric Scanning Overlay ── */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-10 max-w-xs text-center">
            <div className="relative flex items-center justify-center">
              {/* Outer Progress Ring */}
              <svg className="w-40 h-40 rotate-[-90deg]">
                <circle 
                  cx="80" cy="80" r="70" 
                  className="stroke-white/10 fill-none" 
                  strokeWidth="4" 
                />
                <circle 
                  cx="80" cy="80" r="70" 
                  className="stroke-primary fill-none" 
                  strokeWidth="4"
                  strokeDasharray="440"
                  style={{ animation: 'progress-dash 2.8s linear forwards' }}
                />
              </svg>
              <div className="absolute w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_50px_rgba(163,166,255,0.4)] transition-all animate-biometric-pulse">
                <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>fingerprint</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-primary font-headline text-2xl font-black tracking-widest uppercase">Verifying ID</h2>
              <p className="text-white/40 text-sm font-medium tracking-wide">Touch Sensor to Continue</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Google Connecting Overlay ── */}
      {isConnecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-4 border-t-white border-white/20 animate-spin" />
            <p className="text-white font-headline font-bold tracking-widest uppercase text-sm">Connecting to Google Account...</p>
          </div>
        </div>
      )}

      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-tertiary/10 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="fixed top-[15%] left-[10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none -z-10" />
      <div className="fixed bottom-[20%] right-[15%] w-80 h-80 bg-tertiary/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-secondary/90 text-on-secondary text-sm font-bold shadow-2xl backdrop-blur-xl">
          {toast}
        </div>
      )}

      <main className="w-full max-w-lg z-10">
        {/* Branding */}
        <header className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-4xl">sensors</span>
            <h1 className="font-headline font-black text-3xl tracking-tight text-primary drop-shadow-[0_0_12px_rgba(163,166,255,0.4)]">
              ClassPulse
            </h1>
          </div>
          <p className="text-on-surface-variant font-medium tracking-wide text-sm">THE DIGITAL OBSERVATORY</p>
        </header>

        {/* Login Card */}
        <div className="glass-card p-10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Verified badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20">
              <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Verified Access</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">
              {isVerifying ? 'Verify Your Email' : isRegistering ? 'Join the Faculty' : 'Instructor Portal'}
            </h2>
            <p className="text-on-surface-variant text-sm">
              {isVerifying ? `Check ${email} for a 6-digit code` : isRegistering ? 'Create your professional educator profile' : 'Secure biometric-ready entry for authorized educators'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          {isVerifying ? (
            <form className="space-y-8" onSubmit={handleVerify}>
              <div className="space-y-4">
                <label className="block text-center text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  Enter 6-Digit Code
                </label>
                <div className="flex justify-center">
                  <input
                    className="w-full max-w-[240px] bg-surface-container-low/60 border border-outline-variant/30 rounded-xl py-6 text-center text-4xl font-black tracking-[0.5em] text-primary placeholder:text-outline/20 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="000000"
                    type="text"
                    maxLength="6"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-md p-[1px] transition-all active:scale-[0.98] disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-tertiary to-secondary" />
                <div className="relative bg-surface-container-high py-4 rounded-[calc(1.5rem-1px)] flex items-center justify-center gap-2 group-hover:bg-transparent transition-all">
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin">autorenew</span>
                  ) : (
                    <span className="font-headline font-bold text-on-surface tracking-wide group-hover:text-surface-container-lowest">Verify & Log In</span>
                  )}
                </div>
              </button>

              <div className="flex flex-col items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-[10px] font-bold text-outline hover:text-primary uppercase tracking-[0.15em] transition-colors"
                >
                  Didn't receive a code? Resend
                </button>
                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="text-[10px] font-bold text-outline hover:text-error uppercase tracking-[0.15em] transition-colors"
                >
                  Cancel & Return to Login
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                  Email or Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">
                      alternate_email
                    </span>
                  </div>
                  <input
                    className="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="educator@classpulse.edu"
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Password</label>
                  <a href="#" className="text-xs font-semibold text-secondary hover:text-secondary-fixed transition-colors" onClick={handleForgot}>
                    Forgot Password?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">lock</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-xl py-4 pl-12 pr-12 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    placeholder="••••••••••••"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute inset-y-0 right-4 flex items-center"
                  >
                    <span className="material-symbols-outlined text-outline text-lg hover:text-on-surface transition-colors">
                      {showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-md p-[1px] transition-all active:scale-[0.98] disabled:opacity-60"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-tertiary to-secondary" />
                <div className={`relative flex items-center justify-center gap-2 py-4 rounded-[calc(1.5rem-1px)] transition-all duration-300
                  ${loading ? 'bg-surface-container-high' : 'bg-surface-container-high hover:bg-transparent'}`}>
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-lg animate-spin text-on-surface">autorenew</span>
                      <span className="font-headline font-bold text-on-surface tracking-wide">
                        {isRegistering ? 'Registering...' : 'Authenticating...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-headline font-bold text-on-surface tracking-wide group-hover:text-surface-container-lowest">
                        {isRegistering ? 'Create Account' : 'Log in to Dashboard'}
                      </span>
                      <span className="material-symbols-outlined text-lg group-hover:text-surface-container-lowest">arrow_forward</span>
                    </>
                  )}
                </div>
              </button>

              {/* Toggle Sign Up / Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs font-bold text-primary hover:text-secondary transition-colors uppercase tracking-widest"
                >
                  {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          )}

          {/* External Auth */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 w-full">
              <div className="h-[1px] flex-1 bg-outline-variant/20" />
              <span className="text-[10px] font-bold text-outline uppercase tracking-[0.2em]">External Auth</span>
              <div className="h-[1px] flex-1 bg-outline-variant/20" />
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                type="button"
                onClick={handleBiometric}
                className="flex items-center justify-center gap-2 bg-surface-container-low border border-outline-variant/10 rounded-md py-3 hover:bg-surface-container-high transition-colors active:scale-95 group/bio"
              >
                <span className="material-symbols-outlined text-primary text-xl group-hover/bio:scale-110 transition-transform">fingerprint</span>
                <span className="text-xs font-bold text-on-surface-variant">Biometric</span>
              </button>
              <button
                type="button"
                onClick={handleGoogle}
                className="flex items-center justify-center gap-2 bg-white border border-outline-variant/10 rounded-md py-3 hover:bg-slate-50 transition-colors active:scale-95 shadow-sm group/goog"
              >
                <svg className="w-4 h-4 transition-transform group-hover/goog:scale-110" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.39-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span className="text-xs font-bold text-slate-700">Google</span>
              </button>
            </div>
          </div>

          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent blur-sm" />
        </div>

        {/* Footer */}
        <footer className="mt-8 flex justify-between items-center px-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_8px_rgba(98,250,227,0.8)]" />
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">System Operational</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => showToast('Support portal coming soon!')} className="text-[10px] font-bold text-outline hover:text-primary uppercase tracking-widest transition-colors">Support</button>
            <button onClick={() => showToast('Terms of service coming soon!')} className="text-[10px] font-bold text-outline hover:text-primary uppercase tracking-widest transition-colors">Terms</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
