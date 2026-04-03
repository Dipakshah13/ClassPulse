import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '']);
  const inputsRef = useRef([]);

  useEffect(() => {
    const inputs = inputsRef.current;
    inputs.forEach((input, index) => {
      if (!input) return;
      const onInput = (e) => {
        const val = e.target.value;
        const newCode = [...code];
        newCode[index] = val;
        setCode(newCode);
        if (val.length === 1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      };
      const onKeyDown = (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          inputs[index - 1].focus();
        }
      };
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKeyDown);
      return () => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeyDown);
      };
    });
  }, [code]);

  const handleConnect = () => {
    const sessionPin = code.join('');
    if (sessionPin.length === 4) {
      navigate(`/session/${sessionPin}`);
    } else {
      alert("Please enter a 4-digit code.");
    }
  };

  return (
    <>
      {/* Top Navigation Shell */}
      <header className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-outline/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center justify-between px-6 h-20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary drop-shadow-[0_0_8px_rgba(163,166,255,0.6)]">sensors</span>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_10px_rgba(163,166,255,0.4)] font-headline tracking-tight leading-tight">ClassPulse</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60 -mt-0.5 select-none drop-shadow-[0_0_5px_rgba(163,166,255,0.3)]">by Dipak Shah</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black tracking-[0.2em] text-secondary/60 uppercase">System Status</span>
            <span className="text-[11px] font-bold text-on-surface">ONLINE</span>
          </div>
          <div className="flex gap-4 items-center">
            <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-all">
              settings
            </button>
            <button 
              onClick={() => navigate('/teacher')}
              className="hidden sm:block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary transition-all">
              Instructor Portal
            </button>
            <button 
              onClick={() => navigate('/teacher')}
              className="sm:hidden material-symbols-outlined text-on-surface-variant">
              lock_person
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="relative pt-32 pb-20 px-4 max-w-4xl mx-auto flex flex-col items-center min-h-[884px]">
        {/* Hero Branding */}
        <div className="text-center mb-12 relative">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/20 blur-[80px] rounded-full"></div>
          <span className="material-symbols-outlined text-7xl mb-1 block text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary drop-shadow-[0_0_20px_rgba(163,166,255,0.6)]">sensors</span>
          <div className="flex flex-col items-center mb-6">
            <h1 className="text-lg md:text-xl font-black font-headline tracking-[0.3em] md:tracking-[0.5em] text-on-surface-variant/40 uppercase -mb-1">ClassPulse</h1>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-primary drop-shadow-[0_0_10px_rgba(163,166,255,0.5)]">by Dipak Shah</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-headline tracking-tighter text-on-surface mb-4 px-4">
            The Pulse of <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary via-primary to-tertiary">Real-Time Learning</span>
          </h1>
        </div>

        {/* Mode Selection Bento-ish Stack */}
        <div className="w-full space-y-6">
          {/* Interactive Student Join Section */}
          <div className="group w-full relative overflow-hidden transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-secondary/5 to-transparent opacity-60 transition-opacity duration-500"></div>
            <div className="relative bg-surface-container/40 backdrop-blur-2xl border border-secondary/30 rounded-lg p-8 flex flex-col items-center gap-8 shadow-[0_0_40px_rgba(98,250,227,0.15)] border-secondary/40">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold font-headline text-on-surface">Join a Session</h2>
                <p className="text-on-surface-variant text-sm">Enter the 4-digit code provided by your instructor</p>
              </div>
              <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <div className="flex gap-3 md:gap-4 justify-center">
                  {[0, 1, 2, 3].map((i) => (
                    <input 
                      key={i}
                      ref={(el) => (inputsRef.current[i] = el)}
                      className="w-12 h-16 sm:w-16 sm:h-20 md:w-20 md:h-24 bg-surface-container-highest/60 border-2 border-secondary/30 rounded-2xl text-center text-3xl sm:text-4xl font-black font-headline text-secondary focus:border-secondary transition-all selection:bg-transparent" 
                      maxLength="1" 
                      placeholder="•" 
                      type="text"
                      defaultValue={code[i]}
                    />
                  ))}
                </div>
                <button 
                  onClick={handleConnect}
                  className="w-full py-4 bg-secondary text-on-secondary rounded-full font-black text-lg tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(98,250,227,0.3)]"
                >
                  CONNECT NOW
                </button>
              </div>
            </div>
          </div>

          {/* Restricted Teacher Mode Card */}
          <button 
            onClick={() => navigate('/teacher')}
            className="group w-full text-left relative overflow-hidden transition-all duration-500 hover:bg-surface-container-highest/50 active:scale-[0.99] border-t border-[#ffffff0a]"
          >
            <div className="relative bg-surface-container/20 backdrop-blur-xl border border-outline-variant/20 rounded-lg p-6 flex flex-col md:flex-row items-center md:items-start gap-6 transition-all">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-500">
                <span className="material-symbols-outlined text-2xl text-primary/60 group-hover:text-primary transition-colors duration-500">lock</span>
              </div>
              <div className="flex-grow space-y-1 text-center md:text-left flex flex-col justify-center">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <h2 className="text-xl font-bold font-headline text-on-surface/80 group-hover:text-on-surface transition-colors">Instructor Login</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 self-center md:self-auto uppercase tracking-tighter shrink-0">AUTHORIZED PERSOONEL ONLY</span>
                </div>
                <p className="text-on-surface-variant/60 text-xs">Exclusively for educators. Unauthorized student access is prohibited.</p>
              </div>
              <div className="flex-shrink-0 hidden md:flex items-center self-center">
                <span className="material-symbols-outlined text-xl text-outline-variant group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-1">login</span>
              </div>
            </div>
          </button>
        </div>
      </main>
    </>
  );
};

export default Landing;
