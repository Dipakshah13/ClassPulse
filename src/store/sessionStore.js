import { generateInsight } from './aiInsightEngine';
import { syncSessionToCloud } from '../services/classPulseService';

// ── Identity State ──────────────────────────────────────────
let teacherId = null; 

export const setTeacherId = (id) => { teacherId = id; };
export const getTeacherId = () => teacherId;

/**
 * sessionStore.js
 * ─────────────────────────────────────────────────
 * Shared localStorage store for real-time cross-tab
 * sync between Student Pad and Teacher Dashboard.
 *
 * Keys:
 *   cp_feedback   → { gotIt, sortOf, lost }
 *   cp_reactions  → { bulb, clap, fire, think, mind }
 *   cp_questions  → Array<{ id, text, upvotes, ts }>
 */

const KEYS = {
  FEEDBACK: 'cp_feedback',
  REACTIONS: 'cp_reactions',
  QUESTIONS: 'cp_questions',
  SESSION_ID: 'cp_session_id',
  POLL: 'cp_active_poll',   // { question, options:[], sentAt, status, votes:{} }
  PINNING: 'cp_pinning',       // Boolean: focus mode active
  SETTINGS: 'cp_settings',      // { geofencing: bool, hotspot: bool }
  THEME: 'cp_theme_mode',    // 'dark' | 'bright'
  HISTORY: 'cp_session_history', // Array<{ id, ts, feedback, reactions, questions }>
  BREACHES: 'cp_breaches',     // Number: total focus breaches
};
// ─── Feedback ───────────────────────────────────────────────────────────────
export function getFeedback() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FEEDBACK)) || { gotIt: 0, sortOf: 0, lost: 0 };
  } catch { return { gotIt: 0, sortOf: 0, lost: 0 }; }
}

export function incrementFeedback(type) {
  // type: 'gotIt' | 'sortOf' | 'lost'
  const current = getFeedback();
  current[type] = (current[type] || 0) + 1;
  localStorage.setItem(KEYS.FEEDBACK, JSON.stringify(current));
  dispatch();
}

// ─── Reactions ──────────────────────────────────────────────────────────────
export function getReactions() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.REACTIONS))
      || { bulb: 0, clap: 0, fire: 0, think: 0, mind: 0 };
  } catch { return { bulb: 0, clap: 0, fire: 0, think: 0, mind: 0 }; }
}

export function incrementReaction(key) {
  const current = getReactions();
  current[key] = (current[key] || 0) + 1;
  localStorage.setItem(KEYS.REACTIONS, JSON.stringify(current));
  dispatch();
}

// ─── Questions ──────────────────────────────────────────────────────────────
export function getQuestions() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.QUESTIONS)) || [];
  } catch { return []; }
}

export function addQuestion(text) {
  const questions = getQuestions();
  const ai = generateInsight(text.trim()); // AI insight attached here
  const newQ = {
    id: Date.now(),
    text: text.trim(),
    upvotes: 0,
    ts: new Date().toISOString(),
    ai,
  };
  questions.unshift(newQ);
  localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
  dispatch();
  return newQ;
}

export function upvoteQuestion(id) {
  const questions = getQuestions();
  const idx = questions.findIndex(q => q.id === id);
  if (idx !== -1) {
    questions[idx].upvotes = (questions[idx].upvotes || 0) + 1;
    localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
    dispatch();
  }
}

export function removeQuestion(id) {
  const questions = getQuestions().filter(q => q.id !== id);
  localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
  dispatch();
}

/**
 * Patch the ai fields of an existing question once Gemini responds.
 * Merges { geminiAnswer, geminiTip, geminiStatus } into q.ai.
 */
export function updateQuestionAI(id, aiPatch) {
  const questions = getQuestions();
  const idx = questions.findIndex(q => q.id === id);
  if (idx !== -1) {
    questions[idx].ai = { ...(questions[idx].ai || {}), ...aiPatch };
    localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
    dispatch();
  }
}

// ─── Active Poll ─────────────────────────────────────────────────────────
export function getActivePoll() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.POLL)) || null;
  } catch { return null; }
}

/** Teacher sends a quick poll to all students with custom options. */
export function sendPoll(question, options = ['Yes', 'No']) {
  const votes = {};
  options.forEach(opt => { votes[opt] = 0; });

  const poll = {
    id: Date.now(),
    question: question.trim(),
    options,
    sentAt: new Date().toISOString(),
    status: 'active',
    votes,
  };
  localStorage.setItem(KEYS.POLL, JSON.stringify(poll));
  dispatch();
  return poll;
}

/** Student votes on the active poll. */
export function voteOnPoll(choice) {
  const poll = getActivePoll();
  if (!poll || poll.status !== 'active') return;
  // Dynamic increment based on the choice text
  if (poll.votes.hasOwnProperty(choice)) {
    poll.votes[choice] = (poll.votes[choice] || 0) + 1;
    localStorage.setItem(KEYS.POLL, JSON.stringify(poll));
    dispatch();
  }
}

/** Teacher ends the poll. */
export function endPoll() {
  const poll = getActivePoll();
  if (!poll) return;
  poll.status = 'ended';
  localStorage.setItem(KEYS.POLL, JSON.stringify(poll));
  dispatch();
}

/** Clear poll entirely (e.g. on new session). */
export function clearPoll() {
  localStorage.removeItem(KEYS.POLL);
  dispatch();
}

// ─── Pinning (Focus Mode) ────────────────────────────────────────────────
export function getPinning() {
  return localStorage.getItem(KEYS.PINNING) === 'true';
}

export function setPinning(enabled) {
  localStorage.setItem(KEYS.PINNING, String(enabled));
  // Reset breaches on new sync
  if (enabled) localStorage.setItem(KEYS.BREACHES, '0');
  dispatch();
}

// ─── Breaches (Distraction Tracking) ──────────────────────────────────
export function getBreaches() {
  return Number(localStorage.getItem(KEYS.BREACHES)) || 0;
}

export function incrementBreaches() {
  const current = getBreaches();
  localStorage.setItem(KEYS.BREACHES, String(current + 1));
  dispatch();
}

// ─── Settings ───────────────────────────────────────────────────────────
export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || {
      geofencing: false,
      hotspot: false,
      vaultSync: false,
      originLocation: null, // { lat, lng }
      networkSignature: null
    };
  } catch { return { geofencing: false, hotspot: false, vaultSync: false, originLocation: null, networkSignature: null }; }
}

// ─── Theme Management ───────────────────────────────────────────────────
export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'dark';
}

export function setTheme(mode) {
  localStorage.setItem(KEYS.THEME, mode);
  dispatch();
}

// ─── Session ID helpers ───────────────────────────────────────────────────────
export function getCurrentSessionId() {
  return localStorage.getItem(KEYS.SESSION_ID) || null;
}

/**
 * Called by TeacherConfig when GO LIVE is pressed.
 * Clears all previous session data and stamps the new session ID and settings.
 */
export function resetForNewSession(newSessionId, settings = {}) {
  localStorage.removeItem(KEYS.FEEDBACK);
  localStorage.removeItem(KEYS.REACTIONS);
  localStorage.removeItem(KEYS.QUESTIONS);
  localStorage.removeItem(KEYS.POLL);
  localStorage.removeItem(KEYS.PINNING);
  localStorage.removeItem(KEYS.BREACHES);
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  if (newSessionId) localStorage.setItem(KEYS.SESSION_ID, String(newSessionId));
  dispatch();
}

/** 
 * Used on Refresh: syncs the store identity to the URL ID 
 * WITHOUT wiping the stored data.
 */
export function syncSession(sessionId) {
  if (sessionId) {
    localStorage.setItem(KEYS.SESSION_ID, String(sessionId));
    dispatch();
  }
}

// ─── History Retrieval ───────────────────────────────────────────
/**
 * Returns the history list for the current teacher.
 */
export function getHistory(teacherIdOverride = null) {
  const currentId = teacherIdOverride || getTeacherId() || 'anonymous';
  const historyKey = `cp_history_${currentId}`;
  try {
    return JSON.parse(localStorage.getItem(historyKey)) || [];
  } catch { return []; }
}

/**
 * Capture current session data and save it to history before resetting.
 * @param {string} [vaultPassword] - Optional password for Cloud E2EE.
 */
export async function archiveSession(vaultPassword = null) {
  const currentTeacherId = getTeacherId() || 'anonymous';
  const sessionData = {
    id: getCurrentSessionId(),
    ts: Date.now(),
    teacher_id: currentTeacherId,
    feedback: getFeedback(),
    reactions: getReactions(),
    questions: getQuestions(),
    poll: getActivePoll(),
    settings: getSettings(),
    ts_end: new Date().toISOString(),
    isSynced: false
  };

  const historyKey = `cp_history_${currentTeacherId}`;
  const history = JSON.parse(localStorage.getItem(historyKey)) || [];
  history.unshift(sessionData); // Newest first
  localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 50)));

  // ── Cloud Sync (ClassPulse) ──
  if (sessionData.settings?.vaultSync) {
    let vaultKey = null;
    if (vaultPassword) {
      const { deriveVaultKey } = await import('../services/cryptoService');
      vaultKey = await deriveVaultKey(vaultPassword);
    }

    // Attach current identity
    const currentTeacherId = getTeacherId();
    sessionData.teacher_id = currentTeacherId;

    syncSessionToCloud(sessionData, vaultKey)
      .then(res => {
        if (res.success) {
          // Update the specific history item to synced
          const updatedHistory = getHistory();
          if (updatedHistory[0] && updatedHistory[0].id === sessionData.id) {
            updatedHistory[0].isSynced = true;
            localStorage.setItem(KEYS.HISTORY, JSON.stringify(updatedHistory));
            dispatch();
          }
          console.log(`✅ Session #${sessionData.id} synced with E2EE and Teacher ID: ${currentTeacherId}`);
        } else {
          console.warn('⚠️ Cloud sync incomplete, kept in local vault.');
        }
      });
  }
}

// ─── Reset (end session) ──────────────────────────────────────────────────────
export function resetSession() {
  archiveSession(); // Automatically save to history before wiping
  localStorage.removeItem(KEYS.FEEDBACK);
  localStorage.removeItem(KEYS.REACTIONS);
  localStorage.removeItem(KEYS.QUESTIONS);
  localStorage.removeItem(KEYS.POLL);
  localStorage.removeItem(KEYS.PINNING);
  localStorage.removeItem(KEYS.SETTINGS);
  localStorage.removeItem(KEYS.SESSION_ID);
  dispatch();
}

// ─── Cross-tab event dispatcher ─────────────────────────────────────────────
const BUS_KEY = 'cp_bus_tick';
const subscribers = new Set();

function dispatch() {
  // Sync other tabs
  localStorage.setItem(BUS_KEY, Date.now().toString());
  // Sync current tab
  subscribers.forEach(cb => cb());
}

/**
 * Subscribe to any store change (cross-tab or same-tab).
 */
export function subscribe(callback) {
  const handler = (e) => {
    if (!e || !e.key || e.key === BUS_KEY ||
      Object.values(KEYS).includes(e.key)) {
      callback();
    }
  };
  window.addEventListener('storage', handler);
  subscribers.add(callback);
  
  return () => {
    window.removeEventListener('storage', handler);
    subscribers.delete(callback);
  };
}
