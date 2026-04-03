import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMuted, setMuted } from '../utils/soundService';

const Header = () => {
  const { sessionId } = useParams();
  const [isMuted, setIsMuted] = useState(getMuted());

  return (
    <header className="bg-surface/80 backdrop-blur-xl docked full-width top-0 z-50 border-b border-outline shadow-[0px_10px_20px_rgba(0,0,0,0.05)] flex justify-between items-center px-6 py-4 w-full fixed transition-colors duration-500">
      <Link to="/" className="flex flex-col items-start transition-transform active:scale-95 group flex-shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          <span className="material-symbols-outlined text-primary text-lg md:text-xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>sensors</span>
          <h1 className="font-headline font-black tracking-tight text-lg md:text-xl text-primary leading-tight">ClassPulse</h1>
        </div>
        <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary/60 ml-6 md:ml-8 -mt-1 select-none drop-shadow-[0_0_5px_rgba(163,166,255,0.3)]">by Dipak Shah</span>
      </Link>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            const next = !isMuted;
            setIsMuted(next);
            setMuted(next);
          }} 
          className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container border border-outline hover:bg-surface-container-high transition-all active:scale-90"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {isMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>

        <div className="bg-surface px-4 py-1 rounded-full border border-outline shadow-sm">
          <span className="font-headline font-bold text-primary text-xs text-center block uppercase tracking-wider leading-tight">
            PIN<br/>
            <span className="tracking-widest text-on-surface text-sm">#{sessionId || '----'}</span>
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
