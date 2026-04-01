/**
 * geminiService.js
 * ─────────────────────────────────────────────────────────────
 * Calls Google Gemini 1.5 Flash / 2.0 Flash to generate a real
 * AI answer for a student question, formatted for the teacher.
 *
 * Rate limit strategy:
 *   - Try each model once (no blocking sleep in API calls)
 *   - If ALL models return 429, return { rateLimited: true }
 *   - Let the caller (Dashboard.jsx) schedule a background retry
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';

// Models to try in order (same quota bucket, but different availability windows)
const MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

// ─────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────
function buildPrompt(question, topic) {
  return `You are a classroom teaching assistant. Help the teacher respond to a live student question.

Student asked: "${question}"${topic && topic !== 'General' ? `\nTopic context: ${topic}` : ''}

Give:
1. A concise, accurate answer in 2-4 sentences the teacher can say aloud.
2. One quick teaching tip (optional but helpful).

Plain text only. No markdown. Format exactly as:
ANSWER: [answer text]
TEACHING TIP: [tip text]`;
}

// ─────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────
function parse(raw) {
  const aMatch = raw.match(/ANSWER:\s*([\s\S]*?)(?=TEACHING TIP:|$)/i);
  const tMatch = raw.match(/TEACHING TIP:\s*([\s\S]*?)$/i);
  return {
    answer: aMatch ? aMatch[1].trim() : raw.trim(),
    tip:    tMatch ? tMatch[1].trim() : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
/**
 * @returns {Promise<
 *   { answer: string, tip: string|null } |
 *   { rateLimited: true } |
 *   null
 * >}
 */
export async function getAIAnswer(question, topic = '') {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    return {
      answer: 'Add VITE_GEMINI_API_KEY to your .env file. Get a free key at aistudio.google.com/app/apikey',
      tip: null,
    };
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: buildPrompt(question, topic) }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 280, topP: 0.9 },
  });

  let allResultsWere429 = true;
  let encounteredValidModel = false;

  for (const model of MODELS) {
    try {
      const res = await fetch(`${BASE}/${model}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      // 1. If 404, this model is invalid for this key/region → try next automatically
      if (res.status === 404) {
        console.warn(`[Gemini] ${model} not available (404), skipping...`);
        continue;
      }

      // If we got here, the model identifier is valid (exists)
      encounteredValidModel = true;

      // 2. If 429, this model is rate-limited → try next immediately
      if (res.status === 429) {
        console.warn(`[Gemini] ${model} rate-limited (429)`);
        continue;
      }

      // If we got here, we have a non-429 response from a valid model
      allResultsWere429 = false;

      // 3. Handle other errors
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`[Gemini] ${model} error ${res.status}:`, err);
        return { answer: `AI technical error (${res.status}). Try refreshing the page.`, tip: null };
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { answer: 'AI returned an empty response.', tip: null };

      return parse(text); // ✅ Success!
    } catch (err) {
      console.error(`[Gemini] network error during ${model}:`, err);
      // Network errors are catastrophic, stop loop
      return { answer: 'Network error. Please check your internet connection.', tip: null };
    }
  }

  // Final check:
  // If we found valid models but ALL returned 429:
  if (encounteredValidModel && allResultsWere429) {
    return { rateLimited: true };
  }

  return { 
    answer: encounteredValidModel 
      ? 'All AI models are busy. Please try again in a few seconds.' 
      : 'No compatible AI models found for your API key. Please check your Gemini API settings.', 
    tip: null 
  };
}
