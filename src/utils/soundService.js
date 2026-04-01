/**
 * soundService.js - Professional Web Audio API Oscillator Tones
 * ─────────────────────────────────────────────────────────────
 * Zero-asset, zero-latency UI sounds for ClassPulse.
 */

let isMuted = localStorage.getItem('cp_muted') === 'true';

export const setMuted = (muted) => {
  isMuted = muted;
  localStorage.setItem('cp_muted', muted);
};

export const getMuted = () => isMuted;

const playTone = (freqs, type = 'sine', duration = 0.1, volume = 0.1) => {
  if (isMuted) return;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, ctx.currentTime);
  masterGain.connect(ctx.destination);

  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(f, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  });
};

export const sounds = {
  // Soft digital "ding" for new questions
  ping: () => playTone([880, 1320], 'sine', 0.15, 0.05),

  // Quick "success" pop for votes
  pop: () => playTone([440, 880], 'sine', 0.08, 0.08),

  // Mechanical "click" for focus lock
  lock: () => playTone([200, 150], 'square', 0.05, 0.02),

  // Urgent but subtle "warning" for breaches
  alert: () => {
    playTone([440, 330], 'triangle', 0.2, 0.06);
    setTimeout(() => playTone([440, 330], 'triangle', 0.2, 0.06), 150);
  },

  // Professional chimes for session transitions
  startup: () => {
    playTone([440, 554.37, 659.25], 'sine', 0.2, 0.05); // A Major triad
  },
  shutdown: () => {
    playTone([659.25, 554.37, 440], 'sine', 0.3, 0.05); // Falling triad
  },
  join: () => {
    playTone([880, 1174.66], 'sine', 0.1, 0.05); // High fourth jump
  }
};
