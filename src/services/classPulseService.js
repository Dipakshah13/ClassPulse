import { encryptData } from './cryptoService';
import { classPulse } from './classPulseAuth'; // Reusing the initialized client

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
    const { error: sessionError } = await classPulse.database
      .from('class_sessions')
      .insert({
        session_code: sessionData.id,
        subject: await safeEncrypt(sessionData.settings?.subject || 'Unnamed'),
        topic: await safeEncrypt(sessionData.settings?.topic || 'N/A'),
        max_students: String(sessionData.settings?.maxStudents || 'unlimited'),
        origin_lat: sessionData.settings?.originLocation?.lat,
        origin_lng: sessionData.settings?.originLocation?.lng,
        vault_sync_enabled: !!sessionData.settings?.vaultSync,
        is_encrypted: !!vaultKey,
        teacher_id: teacherId
      });
    if (sessionError) console.error('Session master sync failed:', sessionError);

    // 2. Sync Final Metrics (gotIt, sortOf, lost)
    await classPulse.database.from('class_metrics').insert({
      session_id: sessionData.id,
      teacher_id: teacherId,
      got_it: sessionData.feedback.gotIt || 0,
      sort_of: sessionData.feedback.sortOf || 0,
      lost: sessionData.feedback.lost || 0
    });

    // 3. Sync Final Reaction Snapshot
    await classPulse.database.from('class_reactions').insert({
      session_id: sessionData.id,
      teacher_id: teacherId,
      bulb: sessionData.reactions.bulb || 0,
      clap: sessionData.reactions.clap || 0,
      fire: sessionData.reactions.fire || 0,
      think: sessionData.reactions.think || 0,
      mind: sessionData.reactions.mind || 0
    });

    // 4. Sync Final Poll Result
    if (sessionData.poll && (sessionData.poll.question || sessionData.poll.prompt)) {
      await classPulse.database.from('class_polls').insert({
        session_id: sessionData.id,
        teacher_id: teacherId,
        prompt: await safeEncrypt(sessionData.poll.question || sessionData.poll.prompt),
        results: sessionData.poll.votes || sessionData.poll.results || { yes: 0, no: 0 },
        is_encrypted: !!vaultKey
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

      await classPulse.database.from('class_questions').insert(questionsPayload);
    }

    console.log(`✅ Total Sync Complete for Session #${sessionData.id}`);
    return { success: true };
  } catch (error) {
    console.error('❌ ClassPulse Error:', error);
    return { success: false, error };
  }
}
/**
 * Real-time event propagation (Cross-device)
 * Sends a single interaction (feedback/reaction/question) to the cloud relay.
 */
export async function sendLiveEvent(sessionId, type, data) {
  if (!CLASSPULSE_URL || !ANON_KEY) return;
  
  try {
    let table = '';
    let body = { session_id: sessionId };

    if (type === 'feedback') {
      table = 'class_metrics';
      body = { ...body, got_it: data === 'got_it' ? 1 : 0, sort_of: data === 'sort_of' ? 1 : 0, lost: data === 'lost' ? 1 : 0 };
    } else if (type === 'reaction') {
      table = 'class_reactions';
      body = { ...body, bulb: data === 'bulb' ? 1 : 0, clap: data === 'clap' ? 1 : 0, fire: data === 'fire' ? 1 : 0, think: data === 'think' ? 1 : 0, mind: data === 'mind' ? 1 : 0 };
    } else if (type === 'question') {
      table = 'class_questions';
      body = { ...body, text: data, upvotes: 0 };
    }

    if (table) {
      await classPulse.database.from(table).insert(body);
    }
  } catch (e) {
    console.error('Failed to send live pulse:', e);
  }
}

/**
 * Retrieves the aggregated live state for a session.
 * Used by the teacher to sync data across different devices.
 */
export async function fetchLiveState(sessionId) {
  if (!CLASSPULSE_URL || !ANON_KEY) return null;

  try {
    // Parallel fetch using the SDK
    const [metricsRes, reactionsRes, questionsRes] = await Promise.all([
      classPulse.database.from('class_metrics').select('*').eq('session_id', sessionId),
      classPulse.database.from('class_reactions').select('*').eq('session_id', sessionId),
      classPulse.database.from('class_questions').select('*').eq('session_id', sessionId).order('id', { ascending: false })
    ]);

    const metricsData = metricsRes.data || [];
    const reactionsData = reactionsRes.data || [];
    const questionsData = questionsRes.data || [];

    // Aggregate Metrics
    const feedback = metricsData.reduce((acc, m) => ({
      gotIt: acc.gotIt + (m.got_it || 0),
      sortOf: acc.sortOf + (m.sort_of || 0),
      lost: acc.lost + (m.lost || 0)
    }), { gotIt: 0, sortOf: 0, lost: 0 });

    // Aggregate Reactions
    const reactions = reactionsData.reduce((acc, r) => ({
      bulb: acc.bulb + (r.bulb || 0),
      clap: acc.clap + (r.clap || 0),
      fire: acc.fire + (r.fire || 0),
      think: acc.think + (r.think || 0),
      mind: acc.mind + (r.mind || 0)
    }), { bulb: 0, clap: 0, fire: 0, think: 0, mind: 0 });

    return { feedback, reactions, questions: questionsData };
  } catch (e) {
    console.error('Failed to fetch cloud pulse:', e);
    return null;
  }
}
