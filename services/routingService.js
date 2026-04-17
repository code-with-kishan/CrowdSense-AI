/**
 * Routing Service — Smart Navigation Engine
 *
 * Simulates Google Maps routing logic for stadium navigation.
 * Provides least-congested routes between:
 *  - Entry gates → Seating sections
 *  - Current location → Food courts / Restrooms
 *  - Any zone → Emergency exits
 *
 * In production: replace _computePath with Google Maps Directions API call.
 */

const { getRankedGates, getEnrichedZones } = require('./crowdService');
const { rankLocations, bestOption } = require('../utils/decisionEngine');

const GATE_ALIASES = {
  a: 'gate_1',
  1: 'gate_1',
  b: 'gate_2',
  2: 'gate_2',
  c: 'gate_3',
  3: 'gate_3',
  d: 'gate_4',
  4: 'gate_4',
  e: 'gate_5',
  5: 'gate_5',
  f: 'gate_6',
  6: 'gate_6',
};

// ── Stadium graph (adjacency with travel times in minutes) ────────────────────
const STADIUM_GRAPH = {
  gate_1: { concourse_n: 2, concourse_e: 4, parking_north: 3 },
  gate_2: { concourse_s: 2, concourse_w: 4, parking_south: 3 },
  gate_3: { concourse_e: 2, concourse_n: 5, parking_east: 2 },
  gate_4: { concourse_w: 2, concourse_s: 5, parking_west: 2 },
  gate_5: { concourse_n: 1, vip_lounge: 2, parking_north: 2 },
  gate_6: { concourse_s: 1, vip_lounge: 2, parking_south: 2 },
  concourse_n: { gate_1: 2, gate_5: 1, concourse_e: 3, concourse_w: 3, food_1: 2, restroom_n: 1, sections_100: 3 },
  concourse_s: { gate_2: 2, gate_6: 1, concourse_e: 3, concourse_w: 3, food_3: 2, restroom_s: 1, sections_200: 3 },
  concourse_e: { gate_3: 2, concourse_n: 3, concourse_s: 3, food_2: 2, restroom_e: 1, sections_300: 3 },
  concourse_w: { gate_4: 2, concourse_n: 3, concourse_s: 3, food_4: 2, restroom_w: 1, sections_400: 3 },
  food_1: { concourse_n: 2 },
  food_2: { concourse_e: 2 },
  food_3: { concourse_s: 2 },
  food_4: { concourse_w: 2, vip_lounge: 1 },
  restroom_n: { concourse_n: 1 },
  restroom_s: { concourse_s: 1 },
  restroom_e: { concourse_e: 1 },
  restroom_w: { concourse_w: 1 },
  vip_lounge: { gate_5: 2, gate_6: 2, food_4: 1, restroom_n: 2 },
  sections_100: { concourse_n: 3 },
  sections_200: { concourse_s: 3 },
  sections_300: { concourse_e: 3 },
  sections_400: { concourse_w: 3 },
  exit_north: { concourse_n: 1, gate_1: 1, gate_5: 1 },
  exit_south: { concourse_s: 1, gate_2: 1, gate_6: 1 },
  exit_east: { concourse_e: 1, gate_3: 1 },
  exit_west: { concourse_w: 1, gate_4: 1 },
};

// Emergency exits mapped
const EMERGENCY_EXITS = [
  { id: 'exit_north', name: 'Emergency Exit North', directions: 'Follow the GREEN signs towards Gate 1.' },
  { id: 'exit_south', name: 'Emergency Exit South', directions: 'Follow the GREEN signs towards Gate 2.' },
  { id: 'exit_east', name: 'Emergency Exit East', directions: 'Follow the GREEN signs towards Gate 3.' },
  { id: 'exit_west', name: 'Emergency Exit West', directions: 'Follow the GREEN signs towards Gate 4.' },
];

// Human-readable landmark descriptions
const LANDMARK_LABELS = {
  gate_1: 'Gate 1 (North)',
  gate_2: 'Gate 2 (South)',
  gate_3: 'Gate 3 (East)',
  gate_4: 'Gate 4 (West)',
  gate_5: 'Gate 5 (VIP North)',
  gate_6: 'Gate 6 (VIP South)',
  concourse_n: 'North Concourse',
  concourse_s: 'South Concourse',
  concourse_e: 'East Concourse',
  concourse_w: 'West Concourse',
  food_1: 'Food Court A',
  food_2: 'Food Court B',
  food_3: 'Food Court C',
  food_4: 'VIP Lounge',
  restroom_n: 'North Restrooms',
  restroom_s: 'South Restrooms',
  restroom_e: 'East Restrooms',
  restroom_w: 'West Restrooms',
};

/**
 * Dijkstra shortest-path on the stadium graph.
 * In production: call Google Maps Directions API here.
 */
function _dijkstra(start, end) {
  if (!STADIUM_GRAPH[start]) return null;

  const dist = {};
  const prev = {};
  const visited = new Set();
  const queue = new Set(Object.keys(STADIUM_GRAPH));

  Object.keys(STADIUM_GRAPH).forEach((node) => (dist[node] = Infinity));
  dist[start] = 0;

  while (queue.size > 0) {
    // Pick unvisited node with smallest distance
    let u = null;
    for (const node of queue) {
      if (u === null || dist[node] < dist[u]) u = node;
    }

    if (u === end || dist[u] === Infinity) break;
    queue.delete(u);
    visited.add(u);

    const neighbors = STADIUM_GRAPH[u] || {};
    for (const [v, weight] of Object.entries(neighbors)) {
      if (visited.has(v)) continue;
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if (dist[end] === Infinity) return null;

  // Reconstruct path
  const path = [];
  let curr = end;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  return { path, totalMinutes: dist[end] };
}

function _resolveGateId(gateToken) {
  if (!gateToken) return null;

  const normalized = String(gateToken).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (GATE_ALIASES[normalized]) return GATE_ALIASES[normalized];

  const gateMatch = normalized.match(/^gate([1-6])$/);
  if (gateMatch) return `gate_${gateMatch[1]}`;

  return null;
}

function _routeScore(distanceMinutes, crowdDensity, waitMinutes) {
  return parseFloat((distanceMinutes + crowdDensity * 10 + waitMinutes * 0.5).toFixed(1));
}

function _buildRouteResult(from, gate, result) {
  const steps = result
    ? result.path.map((node, index) => ({
        step: index + 1,
        location: LANDMARK_LABELS[node] || node,
        nodeId: node,
      }))
    : [];

  return {
    recommendedGate: gate,
    route: {
      from,
      to: gate.id,
      steps,
      estimatedMinutes: result?.totalMinutes || 5,
    },
    routeScore: _routeScore(result?.totalMinutes || 5, gate.crowdDensity || 0, gate.queueMinutes || 0),
    reasoning: `Gate ${gate.name} has the lowest congestion score (${gate.score}) with a ${Math.round(gate.crowdDensity * 100)}% crowd density and approximately ${gate.queueMinutes} minute wait.`,
  };
}

/**
 * Get the recommended entry route based on crowd intelligence.
 */
async function getSmartEntryRoute(from = 'parking_north') {
  const rankedGates = await getRankedGates();
  const bestGate = rankedGates[0];

  const result = _dijkstra(from, bestGate.id);

  return {
    ..._buildRouteResult(from, bestGate, result),
    alternateGates: rankedGates.slice(1, 3),
  };
}

/**
 * Get a specific gate route from the user's current location.
 */
async function getGateRoute(from = 'parking_north', gateToken = null) {
  const rankedGates = await getRankedGates();
  const requestedGateId = _resolveGateId(gateToken);
  const targetGate = rankedGates.find((gate) => gate.id === requestedGateId) || rankedGates[0];
  const result = _dijkstra(from, targetGate.id);

  return {
    ..._buildRouteResult(from, targetGate, result),
    alternateGates: rankedGates.filter((gate) => gate.id !== targetGate.id).slice(0, 3),
  };
}

/**
 * Get the nearest/fastest food court from a given zone.
 */
async function getNearestFood(fromZone = 'concourse_n') {
  const foodZones = await getEnrichedZones('food');
  const ranked = foodZones.sort((a, b) => a.score - b.score);

  const routes = ranked.map((food) => {
    const result = _dijkstra(fromZone, food.id);
    return {
      ...food,
      route: result ? result.path.map((n) => LANDMARK_LABELS[n] || n) : [],
      travelMinutes: result?.totalMinutes || 3,
      totalTime: (result?.totalMinutes || 3) + Math.round(food.crowdDensity * 20),
      routeScore: _routeScore(result?.totalMinutes || 3, food.crowdDensity || 0, food.queueMinutes || 0),
    };
  });

  routes.sort((a, b) => a.totalTime - b.totalTime);
  return routes;
}

/**
 * Get nearest restroom from a zone.
 */
async function getNearestRestroom(fromZone = 'concourse_n') {
  const zones = await getEnrichedZones('restroom');
  const ranked = zones.sort((a, b) => a.score - b.score);

  return ranked.map((r) => {
    const result = _dijkstra(fromZone, r.id);
    return {
      ...r,
      travelMinutes: result?.totalMinutes || 2,
      route: result ? result.path.map((n) => LANDMARK_LABELS[n] || n) : [],
      routeScore: _routeScore(result?.totalMinutes || 2, r.crowdDensity || 0, r.queueMinutes || 0),
    };
  });
}

/**
 * Emergency exit routing — always provide fastest out.
 */
function getEmergencyExits(fromZone = 'concourse_n') {
  return EMERGENCY_EXITS.map((exit) => {
    const result = _dijkstra(fromZone, exit.id);
    return {
      ...exit,
      travelMinutes: result?.totalMinutes || 1,
      route: result ? result.path.map((n) => LANDMARK_LABELS[n] || n) : [],
      priority: result?.totalMinutes || 99,
      routeScore: _routeScore(result?.totalMinutes || 1, 0, 0),
    };
  }).sort((a, b) => a.priority - b.priority);
}

/**
 * Get exit strategy after match ends.
 */
async function getExitStrategy(fromZone = 'concourse_n') {
  const gates = await getRankedGates();
  const leastBusyGate = gates[0];

  const result = _dijkstra(fromZone, leastBusyGate.id);

  return {
    recommendedGate: leastBusyGate,
    route: result ? result.path.map((n) => LANDMARK_LABELS[n] || n) : [],
    estimatedMinutes: result?.totalMinutes || 5,
    routeScore: _routeScore(result?.totalMinutes || 5, leastBusyGate.crowdDensity || 0, leastBusyGate.queueMinutes || 0),
    tip: `Exit via ${leastBusyGate.name} — currently the least congested with only a ${leastBusyGate.queueMinutes}-minute wait.`,
  };
}

module.exports = {
  getSmartEntryRoute,
  getGateRoute,
  getNearestFood,
  getNearestRestroom,
  getEmergencyExits,
  getExitStrategy,
  STADIUM_GRAPH,
  LANDMARK_LABELS,
};
