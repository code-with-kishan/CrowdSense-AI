/**
 * Crowd Service — Stateful Real-Time Simulation Engine
 *
 * Simulates crowd density across all stadium zones using a
 * continuous, time-aware model. Data evolves naturally and
 * NEVER resets randomly — changes are driven by time progression
 * and match phases.
 *
 * Zones: Gates (1–6), Concourses (N/S/E/W), Food Courts (1–4), Restrooms
 */

const { db } = require('../config/firebaseConfig');
const { computeScore, classifyLevel, getPeakFactor, generateAlerts } = require('../utils/decisionEngine');

const STADIUM_CAPACITY = parseInt(process.env.STADIUM_CAPACITY) || 60000;
const COLLECTION = 'stadiumState';

// ── Initial zone definitions ──────────────────────────────────────────────────
const INITIAL_ZONES = {
  gates: [
    { id: 'gate_1', name: 'Gate 1 – North Entry', type: 'gate', capacity: 5000, baseFlow: 0.3 },
    { id: 'gate_2', name: 'Gate 2 – South Entry', type: 'gate', capacity: 5000, baseFlow: 0.2 },
    { id: 'gate_3', name: 'Gate 3 – East Entry', type: 'gate', capacity: 4000, baseFlow: 0.25 },
    { id: 'gate_4', name: 'Gate 4 – West Entry', type: 'gate', capacity: 4000, baseFlow: 0.35 },
    { id: 'gate_5', name: 'Gate 5 – VIP North', type: 'gate', capacity: 2000, baseFlow: 0.15 },
    { id: 'gate_6', name: 'Gate 6 – VIP South', type: 'gate', capacity: 2000, baseFlow: 0.1 },
  ],
  concourses: [
    { id: 'concourse_n', name: 'North Concourse', type: 'concourse', capacity: 8000, baseFlow: 0.4 },
    { id: 'concourse_s', name: 'South Concourse', type: 'concourse', capacity: 8000, baseFlow: 0.45 },
    { id: 'concourse_e', name: 'East Concourse', type: 'concourse', capacity: 6000, baseFlow: 0.3 },
    { id: 'concourse_w', name: 'West Concourse', type: 'concourse', capacity: 6000, baseFlow: 0.35 },
  ],
  foodCourts: [
    { id: 'food_1', name: 'Food Court A – Level 1', type: 'food', capacity: 800, baseFlow: 0.5 },
    { id: 'food_2', name: 'Food Court B – Level 2', type: 'food', capacity: 600, baseFlow: 0.4 },
    { id: 'food_3', name: 'Food Court C – South Wing', type: 'food', capacity: 700, baseFlow: 0.35 },
    { id: 'food_4', name: 'Food Court D – VIP Lounge', type: 'food', capacity: 300, baseFlow: 0.2 },
  ],
  restrooms: [
    { id: 'restroom_n', name: 'Restrooms – North Block', type: 'restroom', capacity: 200, baseFlow: 0.3 },
    { id: 'restroom_s', name: 'Restrooms – South Block', type: 'restroom', capacity: 200, baseFlow: 0.35 },
    { id: 'restroom_e', name: 'Restrooms – East Block', type: 'restroom', capacity: 150, baseFlow: 0.25 },
    { id: 'restroom_w', name: 'Restrooms – West Block', type: 'restroom', capacity: 150, baseFlow: 0.2 },
  ],
};

// ── In-memory state (persistent across requests) ──────────────────────────────
let _state = null;
let _lastTick = Date.now();
const TICK_INTERVAL_MS = 30_000; // evolve every 30s

/**
 * Initialize state from Firestore (or generate fresh baseline).
 */
async function initializeState() {
  const doc = await db.collection(COLLECTION).doc('liveState').get();

  if (doc.exists && doc.data()) {
    _state = doc.data();
    console.log('[CrowdService] ✅ State restored from Firestore');
  } else {
    _state = _buildInitialState();
    await _persistState();
    console.log('[CrowdService] ✅ New state initialized');
  }
}

function _buildInitialState() {
  const allZones = {};
  const allSections = [
    ...INITIAL_ZONES.gates,
    ...INITIAL_ZONES.concourses,
    ...INITIAL_ZONES.foodCourts,
    ...INITIAL_ZONES.restrooms,
  ];

  allSections.forEach((zone) => {
    // Start with slightly randomized density around the base
    const jitter = (Math.random() - 0.5) * 0.1;
    let crowdDensity = Math.max(0, Math.min(1, zone.baseFlow + jitter));
    allZones[zone.id] = {
      ...zone,
      crowdDensity: parseFloat(crowdDensity.toFixed(3)),
      currentPeople: Math.round(crowdDensity * zone.capacity),
      lastUpdated: new Date().toISOString(),
    };
  });

  return {
    zones: allZones,
    matchPhase: _getMatchPhase(),
    totalAttendance: Math.round(STADIUM_CAPACITY * 0.75),
    stadiumName: process.env.STADIUM_NAME || 'Kishan Sports Arena',
    createdAt: new Date().toISOString(),
    lastTick: new Date().toISOString(),
  };
}

/**
 * Evolve state naturally over time — called on each tick.
 * Density changes are small ±deltas, influenced by match phase.
 */
function _evolveTick() {
  if (!_state) return;

  const phase = _getMatchPhase();
  _state.matchPhase = phase;

  Object.values(_state.zones).forEach((zone) => {
    const phaseMultiplier = _getPhaseMultiplier(phase, zone.type);
    // Small random walk within ±8% of current density
    const delta = (Math.random() - 0.5) * 0.08 * phaseMultiplier;
    let newDensity = zone.crowdDensity + delta;
    // Clamp to (base ± 0.35) to keep behavior realistic
    newDensity = Math.max(zone.baseFlow - 0.35, Math.min(zone.baseFlow + 0.50, newDensity));
    newDensity = Math.max(0.02, Math.min(0.98, newDensity));

    zone.crowdDensity = parseFloat(newDensity.toFixed(3));
    zone.currentPeople = Math.round(newDensity * zone.capacity);
    zone.lastUpdated = new Date().toISOString();
  });

  _state.lastTick = new Date().toISOString();
  _persistState(); // async, non-blocking
}

function _getMatchPhase() {
  const hour = new Date().getHours();
  if (hour < 16) return 'pre_event';
  if (hour < 18) return 'gates_open';
  if (hour < 19) return 'pre_match';
  if (hour < 20) return 'first_half';
  if (hour >= 20 && hour < 20.5) return 'half_time';
  if (hour < 22) return 'second_half';
  if (hour < 23) return 'post_match';
  return 'post_event';
}

function _getPhaseMultiplier(phase, zoneType) {
  const multipliers = {
    pre_event: { gate: 0.3, concourse: 0.2, food: 0.4, restroom: 0.2 },
    gates_open: { gate: 1.5, concourse: 1.0, food: 0.8, restroom: 0.6 },
    pre_match: { gate: 2.0, concourse: 1.5, food: 1.2, restroom: 0.8 },
    first_half: { gate: 0.3, concourse: 0.4, food: 1.5, restroom: 1.0 },
    half_time: { gate: 0.2, concourse: 1.8, food: 2.5, restroom: 2.0 },
    second_half: { gate: 0.2, concourse: 0.4, food: 1.8, restroom: 1.2 },
    post_match: { gate: 2.5, concourse: 2.0, food: 0.5, restroom: 1.5 },
    post_event: { gate: 0.5, concourse: 0.3, food: 0.2, restroom: 0.3 },
  };
  return multipliers[phase]?.[zoneType] ?? 1.0;
}

async function _persistState() {
  try {
    await db.collection(COLLECTION).doc('liveState').set(_state);
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Get the current full state, evolving if the tick interval has passed.
 */
async function getState() {
  if (!_state) await initializeState();

  const now = Date.now();
  if (now - _lastTick >= TICK_INTERVAL_MS) {
    _evolveTick();
    _lastTick = now;
  }

  return _state;
}

/**
 * Get enriched zone data with scores and classifications.
 */
async function getEnrichedZones(type = null) {
  const state = await getState();
  const peakFactor = getPeakFactor();

  let zones = Object.values(state.zones);
  if (type) zones = zones.filter((z) => z.type === type);

  return zones.map((zone) => {
    // Estimate queue time from density (higher density → longer wait)
    const queueMinutes = Math.round(zone.crowdDensity * 45);
    const score = computeScore(zone.crowdDensity, queueMinutes, peakFactor);
    const classification = classifyLevel(score);
    return {
      ...zone,
      queueMinutes,
      score,
      peakFactor,
      ...classification,
    };
  });
}

/**
 * Get ranked gates (best entry recommendation first).
 */
async function getRankedGates() {
  const zones = await getEnrichedZones('gate');
  return zones.sort((a, b) => a.score - b.score);
}

/**
 * Get system-wide alerts.
 */
async function getAlerts() {
  const zones = await getEnrichedZones();
  return generateAlerts(zones);
}

/**
 * Public summary for dashboard.
 */
async function getSummary() {
  const state = await getState();
  const zones = await getEnrichedZones();
  const alerts = generateAlerts(zones);

  const avgDensity = zones.reduce((s, z) => s + z.crowdDensity, 0) / zones.length;

  return {
    stadiumName: state.stadiumName,
    matchPhase: state.matchPhase,
    totalAttendance: state.totalAttendance,
    averageDensity: parseFloat(avgDensity.toFixed(3)),
    totalZones: zones.length,
    alertCount: alerts.length,
    alerts,
    lastUpdated: state.lastTick,
  };
}

module.exports = {
  initializeState,
  getState,
  getEnrichedZones,
  getRankedGates,
  getAlerts,
  getSummary,
};
