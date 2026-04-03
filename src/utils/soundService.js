/**
 * soundService.js - Professional Unique Sound Identity
 * ──────────────────────────────────────────────────
 * Distinct auditory signatures for every ClassPulse action.
 */

let ctx = null;
let masterGain = null;
let isMuted = localStorage.getItem('cp_muted') === 'true';

const initAudio = () => {
  if (ctx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  ctx = new AudioContext();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.value = 0.15;
};

const playTone = (freqs, type = 'sine', duration = 0.15, volume = 0.2) => {
  if (isMuted) return;
  initAudio();
  if (ctx.state === 'suspended') ctx.resume();

  const startTime = ctx.currentTime;
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(f, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume / freqs.length, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  });
};

export const setMuted = (muted) => {
  isMuted = muted;
  localStorage.setItem('cp_muted', muted);
};

export const getMuted = () => isMuted;

export const sounds = {
  // ❓ Question Arrived (Teacher side)
  ping: () => playTone([880, 1320], 'sine', 0.25), 

  // 🗳️ Quick Vote (Student side)
  pop: () => playTone([523], 'sine', 0.08, 0.15), 

  // 🔒 Focus Mode Locked (Student side)
  lock: () => playTone([100], 'square', 0.15, 0.1), 

  // 📊 New Poll Launched (Student side)
  notify: () => playTone([659.25, 783.99], 'sine', 0.2, 0.2), 

  // 🚀 Session Started (Teacher side)
  startup: () => playTone([523, 659, 783, 1046], 'sine', 0.6, 0.2), 

  // 🛑 Session Terminated (Both sides)
  shutdown: () => playTone([783, 659, 523, 392], 'sine', 0.5, 0.2), 

  // 👋 Student Joined (Teacher side)
  join: () => playTone([880, 987, 1174, 1318], 'sine', 0.3, 0.15), 
  
  // 🚨 Focus Breach / Students Lost (Teacher side)
  alert: () => playTone([220, 330], 'square', 0.4, 0.1),

  // ✨ Generic Success
  success: () => playTone([880, 1108, 1318, 1760], 'sine', 0.4, 0.15)
};
