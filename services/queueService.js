/**
 * Queue Service — Intelligent Wait Time Prediction
 *
 * Predicts queue wait times using:
 * - Current crowd density
 * - Zone throughput capacity
 * - Match phase multipliers
 * - Historical flow patterns
 */

const { getEnrichedZones } = require('./crowdService');

// Average throughput: people processed per minute per zone type
const THROUGHPUT = {
  gate: 300,      // people/min at peak processing
  food: 50,       // orders/min
  restroom: 120,  // people/cycle
  concourse: 999, // essentially unlimited (no queue)
};

/**
 * Calculate wait time in minutes for a given zone.
 * Formula: waitTime = (currentPeople / throughput) minutes
 */
function calculateWaitTime(zone) {
  const throughput = THROUGHPUT[zone.type] || 100;
  const rawWait = (zone.currentPeople / throughput);

  // Apply density bonus — congestion compounds wait time
  const congestionFactor = 1 + zone.crowdDensity * 2;
  const waitMinutes = Math.round(rawWait * congestionFactor * 10) / 10;

  return Math.max(0, Math.min(waitMinutes, 90)); // Cap at 90 min
}

/**
 * Get wait times for all food courts, ranked best-first.
 */
async function getFoodCourtQueue() {
  const zones = await getEnrichedZones('food');

  return zones
    .map((zone) => ({
      ...zone,
      waitMinutes: calculateWaitTime(zone),
      estimatedServiceTime: Math.round(Math.random() * 3 + 2), // 2–5 min service
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes);
}

/**
 * Get wait times for all gates, ranked best-first.
 */
async function getGateQueue() {
  const zones = await getEnrichedZones('gate');

  return zones
    .map((zone) => ({
      ...zone,
      waitMinutes: calculateWaitTime(zone),
      processingSpeed: zone.crowdDensity < 0.4 ? 'Fast' : zone.crowdDensity < 0.7 ? 'Normal' : 'Slow',
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes);
}

/**
 * Get wait times for restrooms.
 */
async function getRestroomQueue() {
  const zones = await getEnrichedZones('restroom');

  return zones
    .map((zone) => ({
      ...zone,
      waitMinutes: calculateWaitTime(zone),
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes);
}

/**
 * Predict future wait time using simple linear projection.
 * Projects 15 minutes into the future based on current trend.
 */
function predictFutureWait(currentWait, crowdDensity, matchPhase) {
  const trends = {
    half_time: 1.8,    // Surge
    pre_match: 1.5,
    post_match: 1.6,
    gates_open: 1.4,
    first_half: 0.7,   // Declining (people settled)
    second_half: 0.8,
    post_event: 0.5,
    pre_event: 0.9,
  };

  const trendFactor = trends[matchPhase] || 1.0;
  const predicted = currentWait * trendFactor;
  return parseFloat(Math.min(predicted, 90).toFixed(1));
}

/**
 * Full queue dashboard summary.
 */
async function getQueueSummary() {
  const [gates, food, restrooms] = await Promise.all([
    getGateQueue(),
    getFoodCourtQueue(),
    getRestroomQueue(),
  ]);

  return {
    gates: gates.slice(0, 6),
    food: food.slice(0, 4),
    restrooms: restrooms.slice(0, 4),
    bestGate: gates[0] || null,
    bestFood: food[0] || null,
    bestRestroom: restrooms[0] || null,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  calculateWaitTime,
  getFoodCourtQueue,
  getGateQueue,
  getRestroomQueue,
  predictFutureWait,
  getQueueSummary,
};
