/**
 * Assistant Service — Gemini-Powered Conversational AI
 *
 * Integrates Google Gemini API for natural language understanding
 * and response generation. Falls back to a rule-based engine
 * if the API key is unavailable.
 *
 * All responses are context-aware, actionable, and human-like.
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { analyzeIntent, getResponseTone } = require('../utils/contextAnalyzer');
const { getSmartEntryRoute, getGateRoute, getNearestFood, getNearestRestroom, getEmergencyExits, getExitStrategy } = require('./routingService');
const { getSummary, getAlerts } = require('./crowdService');
const { getQueueSummary } = require('./queueService');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const STADIUM_NAME = process.env.STADIUM_NAME || 'Kishan Sports Arena';

// ── Conversation history (per session, in-memory) ─────────────────────────────
const _sessions = new Map();

function _getSession(sessionId) {
  if (!_sessions.has(sessionId)) {
    _sessions.set(sessionId, { history: [], createdAt: Date.now() });
  }
  return _sessions.get(sessionId);
}

/**
 * Build structured context payload from live stadium data.
 */
async function _buildStadiumContext() {
  const [summary, queueData, alerts] = await Promise.all([
    getSummary(),
    getQueueSummary(),
    getAlerts(),
  ]);

  return {
    stadium: summary,
    queues: {
      bestGate: queueData.bestGate
        ? `${queueData.bestGate.name} (${queueData.bestGate.waitMinutes} min wait, ${Math.round(queueData.bestGate.crowdDensity * 100)}% full)`
        : 'N/A',
      bestFood: queueData.bestFood
        ? `${queueData.bestFood.name} (${queueData.bestFood.waitMinutes} min wait)`
        : 'N/A',
      bestRestroom: queueData.bestRestroom
        ? `${queueData.bestRestroom.name} (${queueData.bestRestroom.waitMinutes} min wait)`
        : 'N/A',
    },
    activeAlerts: alerts.map((a) => a.message),
    matchPhase: summary.matchPhase,
    attendance: summary.totalAttendance,
  };
}

/**
 * Call Gemini API for response generation.
 */
async function _callGemini(userMessage, context, history, structuredData) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your_')) {
    return null; // Trigger fallback
  }

  const systemPrompt = `You are an intelligent AI assistant for ${STADIUM_NAME}, a world-class sports stadium.
Your job: help fans navigate, find food, avoid crowds, and stay safe.
Be conversational, helpful, and concise (2-3 sentences max).
Always give a specific, actionable recommendation based on the live data provided.

LIVE STADIUM DATA:
- Match Phase: ${context.matchPhase}
- Attendance: ${context.attendance?.toLocaleString()} fans
- Best Entry Gate: ${context.queues.bestGate}
- Best Food Court: ${context.queues.bestFood}
- Best Restroom: ${context.queues.bestRestroom}
- Active Alerts: ${context.activeAlerts.length > 0 ? context.activeAlerts.join('; ') : 'None'}
- Structured Recommendation Data: ${structuredData ? JSON.stringify(structuredData).slice(0, 900) : 'None'}

Rules:
- For EMERGENCY queries, always prioritize safety and direct to nearest exit
- Use specific gate names, times, and percentages from the data
- Never say "I don't know" — always make an intelligent recommendation`;

  const contents = [
    ...history.slice(-6).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 8000,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Rule-based fallback engine — thoughtful, data-driven responses.
 */
async function _fallbackResponse(intent, context, entities) {
  const { queues, matchPhase, activeAlerts } = context;
  const phaseLabels = {
    pre_event: 'before the event',
    gates_open: 'as gates are opening',
    pre_match: 'approaching match time',
    first_half: 'during the first half',
    half_time: 'at half-time',
    second_half: 'during the second half',
    post_match: 'as the match ends',
    post_event: 'after the event',
  };
  const phaseLabel = phaseLabels[matchPhase] || 'right now';

  switch (intent) {
    case 'EMERGENCY':
      return `🚨 EMERGENCY PROTOCOL ACTIVATED. Please proceed immediately to the nearest emergency exit — follow the green overhead signs. Security teams are stationed at every exit. If you need medical assistance, call stadium security at ext. 911 or alert any staff member in a yellow vest. Your safety is our top priority.`;

    case 'NAVIGATION':
      return `I recommend entering through ${queues.bestGate} — that's currently our least congested entry point ${phaseLabel}. ${activeAlerts.length > 0 ? `⚠️ Note: ${activeAlerts[0]}` : 'All other gates are operational as well.'}`;

    case 'FOOD':
      return `Your quickest food option right now is ${queues.bestFood}. With the current crowd patterns ${phaseLabel}, that's where you'll spend the least time waiting. Would you like directions to get there?`;

    case 'RESTROOM':
      return `The ${queues.bestRestroom} has the shortest wait right now. Perfect timing to go ${phaseLabel}. Head towards the nearest concourse and follow the blue restroom signs.`;

    case 'CROWD':
      return `${phaseLabel.charAt(0).toUpperCase() + phaseLabel.slice(1)}, the stadium is seeing ${context.attendance?.toLocaleString()} fans. ${activeAlerts.length > 0 ? activeAlerts[0] : 'Crowd levels are within manageable ranges across most zones.'} The best uncrowded areas are near ${queues.bestGate}.`;

    case 'EXIT':
      return `For the smoothest exit, head to ${queues.bestGate} — it's the least congested gate right now. I'd recommend leaving 10 minutes before the final whistle to beat the rush. Would you like the best route from your current location?`;

    default:
      return `Welcome to ${STADIUM_NAME}! I'm your AI stadium assistant. I can help you find the best entry gates, shortest food queues, nearest restrooms, or guide you in an emergency. What do you need?`;
  }
}

/**
 * Main chat interface — process a user message and return an intelligent response.
 */
async function chat(message, sessionId = 'default', userLocation = 'concourse_n') {
  // Input validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return { error: 'Message cannot be empty', status: 400 };
  }
  if (message.length > 500) {
    return { error: 'Message too long (max 500 characters)', status: 400 };
  }

  const trimmed = message.trim();
  const session = _getSession(sessionId);

  // Analyze intent
  const { intent, confidence, entities } = analyzeIntent(trimmed);
  const tone = getResponseTone(intent);

  // Build live context
  const context = await _buildStadiumContext();

  // Fetch relevant structured data based on intent
  let structuredData = null;
  try {
    if (intent === 'NAVIGATION') {
      structuredData = entities.gate ? await getGateRoute(userLocation, entities.gate) : await getSmartEntryRoute(userLocation);
    } else if (intent === 'FOOD') {
      structuredData = (await getNearestFood(userLocation)).slice(0, 3);
    } else if (intent === 'RESTROOM') {
      structuredData = (await getNearestRestroom(userLocation)).slice(0, 3);
    } else if (intent === 'EMERGENCY') {
      structuredData = getEmergencyExits(userLocation);
    } else if (intent === 'EXIT') {
      structuredData = await getExitStrategy(userLocation);
    }
  } catch (err) {
    console.error('[AssistantService] Structured data fetch error:', err.message);
  }

  // Try Gemini first, fall back to rule engine
  let responseText;
  let source = 'gemini';

  try {
    responseText = await _callGemini(trimmed, context, session.history, structuredData);
    if (!responseText) throw new Error('Empty Gemini response');
  } catch (err) {
    console.log('[AssistantService] Falling back to rule engine:', err.message);
    if (intent === 'NAVIGATION' && structuredData?.recommendedGate) {
      responseText = `I recommend ${structuredData.recommendedGate.name} from your current location. ${structuredData.route?.estimatedMinutes ? `It should take about ${structuredData.route.estimatedMinutes} minutes to get there.` : ''} ${structuredData.reasoning || ''}`;
    } else if (intent === 'FOOD' && Array.isArray(structuredData) && structuredData[0]) {
      const bestFood = structuredData[0];
      responseText = `The fastest option is ${bestFood.name} with an estimated ${bestFood.waitMinutes} minute wait and about ${bestFood.travelMinutes} minutes to walk there.`;
    } else if (intent === 'RESTROOM' && Array.isArray(structuredData) && structuredData[0]) {
      const bestRestroom = structuredData[0];
      responseText = `The shortest restroom wait is at ${bestRestroom.name}. It’s currently about ${bestRestroom.waitMinutes} minutes with roughly ${bestRestroom.travelMinutes} minutes of walking.`;
    } else if (intent === 'EXIT' && structuredData?.recommendedGate) {
      responseText = `For the smoothest exit, use ${structuredData.recommendedGate.name}. ${structuredData.tip || ''}`;
    } else {
      responseText = await _fallbackResponse(intent, context, entities);
    }
    source = 'rule_engine';
  }

  // Update conversation history
  session.history.push({ role: 'user', text: trimmed });
  session.history.push({ role: 'model', text: responseText });

  // Trim history to last 20 messages
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
  }

  return {
    response: responseText,
    intent,
    confidence,
    tone,
    entities,
    structuredData,
    context: {
      matchPhase: context.matchPhase,
      alertCount: context.activeAlerts.length,
    },
    source,
    sessionId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear a conversation session.
 */
function clearSession(sessionId) {
  _sessions.delete(sessionId);
  return { cleared: true, sessionId };
}

module.exports = { chat, clearSession };
