import { encryptData } from './cryptoService';

const CLASSPULSE_URL = import.meta.env.VITE_INSFORGE_URL;
const ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY;

/**
 * Robust cloud sync for ClassPulse sessions with E2EE and Teacher Ownership.
 * Captures Sessions, Questions, Metrics, Polls, and Reactions.
 */
export async function syncSessionToCloud(sessionData, vaultKey) {
  if (!CLASSPULSE_URL || !ANON_KEY) {
    console.warn('ClassPulse credentials missing. Cloud backup disabled.');
    return { success: false };
  }

  const teacherId = sessionData.teacher_id;
  if (!teacherId) {
    console.warn('⚠️ No authenticated Teacher ID. Cloud sync may fail privacy checks.');
  }

  // Encryption Helper
  const safeEncrypt = async (text) => {
    if (!vaultKey || !text) return text;
    try { return await encryptData(text, vaultKey); }
    catch (e) { return text; }
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Prefer': 'return=minimal'
    };

    // 1. Sync Session Master
    const sessionResponse = await fetch(`${CLASSPULSE_URL}/rest/v1/class_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_code: sessionData.id,
        subject: await safeEncrypt(sessionData.settings?.subject || 'Unnamed'),
        topic: await safeEncrypt(sessionData.settings?.topic || 'N/A'),
        max_students: String(sessionData.settings?.maxStudents || 'unlimited'),
        origin_lat: sessionData.settings?.originLocation?.lat,
        origin_lng: sessionData.settings?.originLocation?.lng,
        vault_sync_enabled: !!sessionData.settings?.vaultSync,
        is_encrypted: !!vaultKey,
        teacher_id: teacherId
      })
    });
    if (!sessionResponse.ok) console.error('Session master sync failed');

    // 2. Sync Final Metrics (gotIt, sortOf, lost)
    await fetch(`${CLASSPULSE_URL}/rest/v1/class_metrics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionData.id,
        teacher_id: teacherId,
        got_it: sessionData.feedback.gotIt || 0,
        sort_of: sessionData.feedback.sortOf || 0,
        lost: sessionData.feedback.lost || 0
      })
    });

    // 3. Sync Final Reaction Snapshot
    await fetch(`${CLASSPULSE_URL}/rest/v1/class_reactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionData.id,
        teacher_id: teacherId,
        bulb: sessionData.reactions.bulb || 0,
        clap: sessionData.reactions.clap || 0,
        fire: sessionData.reactions.fire || 0,
        think: sessionData.reactions.think || 0,
        mind: sessionData.reactions.mind || 0
      })
    });

    // 4. Sync Final Poll Result
    if (sessionData.poll && (sessionData.poll.question || sessionData.poll.prompt)) {
      await fetch(`${CLASSPULSE_URL}/rest/v1/class_polls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: sessionData.id,
          teacher_id: teacherId,
          prompt: await safeEncrypt(sessionData.poll.question || sessionData.poll.prompt),
          results: sessionData.poll.votes || sessionData.poll.results || { yes: 0, no: 0 },
          is_encrypted: !!vaultKey
        })
      });
    }

    // 5. Sync Questions (Bulk Encrypted)
    if (sessionData.questions && sessionData.questions.length > 0) {
      const questionsPayload = await Promise.all(sessionData.questions.map(async q => ({
        session_id: sessionData.id,
        teacher_id: teacherId,
        text: await safeEncrypt(q.text),
        upvotes: q.upvotes || 0,
        is_encrypted: !!vaultKey
      })));

      await fetch(`${CLASSPULSE_URL}/rest/v1/class_questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(questionsPayload)
      });
    }

    console.log(`✅ Total Sync Complete for Session #${sessionData.id}`);
    return { success: true };
  } catch (error) {
    console.error('❌ ClassPulse Error:', error);
    return { success: false, error };
  }
}
