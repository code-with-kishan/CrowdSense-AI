/**
 * Context Analyzer — NLP Intent Engine
 *
 * Classifies user messages into intent categories without requiring
 * an external NLP model as a dependency. Uses weighted keyword matching
 * with contextual boosting.
 *
 * Intent Categories:
 *  - NAVIGATION  → gates, entry, directions, route, parking
 *  - FOOD        → food, eat, drink, concession, restaurant, hungry
 *  - CROWD       → crowd, busy, wait, line, congestion, packed
 *  - EMERGENCY   → emergency, help, lost, hurt, medical, fire, security
 *  - EXIT        → exit, leave, out, go home, end
 *  - RESTROOM    → restroom, bathroom, toilet, washroom
 *  - GENERAL     → catch-all
 */

const INTENT_PATTERNS = {
  EMERGENCY: {
    keywords: ['emergency', 'help', 'hurt', 'injured', 'medical', 'fire', 'security', 'lost child', 'attack', 'sos', 'danger', 'unsafe'],
    weight: 10, // Always highest priority
  },
  NAVIGATION: {
    keywords: ['gate', 'entry', 'enter', 'navigate', 'direction', 'route', 'way', 'path', 'go to', 'how do i get', 'where is', 'parking', 'seat', 'section'],
    weight: 3,
  },
  EXIT: {
    keywords: ['exit', 'leave', 'go home', 'out', 'end', 'after match', 'after game', 'shortest way out', 'quickest exit'],
    weight: 3,
  },
  FOOD: {
    keywords: ['food', 'eat', 'hungry', 'drink', 'snack', 'concession', 'restaurant', 'beverage', 'coffee', 'burger', 'pizza', 'hot dog', 'beer', 'water'],
    weight: 2,
  },
  RESTROOM: {
    keywords: ['restroom', 'bathroom', 'toilet', 'washroom', 'loo', 'wc', 'nature call'],
    weight: 2,
  },
  CROWD: {
    keywords: ['crowd', 'busy', 'wait', 'queue', 'line', 'congestion', 'packed', 'full', 'how many people', 'status', 'how crowded'],
    weight: 2,
  },
};

/**
 * Detect the primary intent of a user message.
 * @param {string} message
 * @returns {{ intent: string, confidence: number, entities: object }}
 */
function analyzeIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'GENERAL', confidence: 0, entities: {} };
  }

  const normalized = message.toLowerCase().trim();
  const scores = {};

  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    const matchedKeywords = [];

    for (const keyword of config.keywords) {
      if (normalized.includes(keyword)) {
        score += config.weight;
        matchedKeywords.push(keyword);
      }
    }

    if (score > 0) {
      scores[intent] = { score, matchedKeywords };
    }
  }

  if (Object.keys(scores).length === 0) {
    return { intent: 'GENERAL', confidence: 0.1, entities: extractEntities(normalized) };
  }

  // Pick highest scoring intent
  const best = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)[0];
  const maxPossible = INTENT_PATTERNS[best[0]].keywords.length * INTENT_PATTERNS[best[0]].weight;
  const confidence = parseFloat(Math.min(best[1].score / maxPossible, 1).toFixed(2));

  return {
    intent: best[0],
    confidence,
    matchedKeywords: best[1].matchedKeywords,
    entities: extractEntities(normalized),
  };
}

/**
 * Extract named entities: gate numbers, sections, keywords.
 */
function extractEntities(text) {
  const entities = {};

  // Gate numbers: "gate 2", "gate B"
  const gateMatch = text.match(/gate\s([a-z0-9]+)/i);
  if (gateMatch) entities.gate = gateMatch[1].toUpperCase();

  // Section numbers
  const sectionMatch = text.match(/section\s([a-z0-9]+)/i);
  if (sectionMatch) entities.section = sectionMatch[1].toUpperCase();

  // Numbers (seat/row)
  const numbers = text.match(/\b\d+\b/g);
  if (numbers) entities.numbers = numbers;

  return entities;
}

/**
 * Generate response tone based on intent.
 */
function getResponseTone(intent) {
  const tones = {
    EMERGENCY: 'urgent',
    NAVIGATION: 'helpful',
    EXIT: 'efficient',
    FOOD: 'friendly',
    RESTROOM: 'discreet',
    CROWD: 'informative',
    GENERAL: 'conversational',
  };
  return tones[intent] || 'conversational';
}

module.exports = { analyzeIntent, extractEntities, getResponseTone };
