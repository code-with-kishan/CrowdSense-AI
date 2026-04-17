/**
 * Decision Engine — Core Intelligence
 *
 * Scoring formula:
 *   score = (crowd_density * 0.5) + (queue_time * 0.3) + (peak_factor * 0.2)
 *
 * Lower score = better option for the user.
 * All inputs are normalized to [0, 1] before scoring.
 */

const WEIGHTS = {
  CROWD_DENSITY: 0.5,
  QUEUE_TIME: 0.3,
  PEAK_FACTOR: 0.2,
};

/**
 * Calculate a congestion score for a location.
 * @param {number} crowdDensity  - 0 (empty) to 1 (packed)
 * @param {number} queueMinutes  - Raw wait time in minutes
 * @param {number} peakFactor    - 0 (off-peak) to 1 (peak)
 * @returns {number} score in [0, 1] — lower is better
 */
function computeScore(crowdDensity, queueMinutes, peakFactor) {
  // Normalize queue time: assume 60 min is the maximum possible wait
  const normalizedQueue = Math.min(queueMinutes / 60, 1);

  const score =
    crowdDensity * WEIGHTS.CROWD_DENSITY +
    normalizedQueue * WEIGHTS.QUEUE_TIME +
    peakFactor * WEIGHTS.PEAK_FACTOR;

  return parseFloat(score.toFixed(4));
}

/**
 * Classify a score into a human-readable congestion level.
 */
function classifyLevel(score) {
  if (score < 0.25) return { level: 'low', label: '🟢 Low', color: '#10b981' };
  if (score < 0.5) return { level: 'moderate', label: '🟡 Moderate', color: '#f59e0b' };
  if (score < 0.75) return { level: 'high', label: '🟠 High', color: '#f97316' };
  return { level: 'critical', label: '🔴 Critical', color: '#ef4444' };
}

/**
 * Determine current peak factor based on real time of day.
 * Peak windows: pre-match (1h before kick-off), half-time, post-match.
 * For simulation we use clock hours.
 */
function getPeakFactor() {
  const hour = new Date().getHours();
  // Pre-match rush: 17:00 – 19:00
  if (hour >= 17 && hour < 19) return 0.9;
  // Match ongoing: 19:00 – 21:00
  if (hour >= 19 && hour < 21) return 0.7;
  // Half-time surge: handled dynamically by crowdService
  // Post-match exodus: 21:00 – 22:00
  if (hour >= 21 && hour < 22) return 1.0;
  // Off-peak
  if (hour >= 6 && hour < 10) return 0.3;
  if (hour >= 10 && hour < 17) return 0.4;
  return 0.2;
}

/**
 * Rank an array of locations by their computed scores.
 * @param {Array} locations - Each item must have: { id, name, crowdDensity, queueMinutes }
 * @returns {Array} sorted by score ascending (best first)
 */
function rankLocations(locations) {
  const peakFactor = getPeakFactor();

  return locations
    .map((loc) => {
      const score = computeScore(loc.crowdDensity, loc.queueMinutes, peakFactor);
      const classification = classifyLevel(score);
      return {
        ...loc,
        score,
        peakFactor,
        ...classification,
      };
    })
    .sort((a, b) => a.score - b.score);
}

/**
 * Pick the single best recommendation from a ranked list.
 */
function bestOption(rankedLocations) {
  return rankedLocations[0] || null;
}

/**
 * Generate a smart alert if any location exceeds threshold.
 */
function generateAlerts(rankedLocations) {
  const alerts = [];
  rankedLocations.forEach((loc) => {
    if (loc.level === 'critical') {
      alerts.push({
        type: 'CRITICAL',
        locationId: loc.id,
        message: `⚠️ ${loc.name} is critically congested. Avoid immediately.`,
        color: '#ef4444',
      });
    } else if (loc.level === 'high') {
      alerts.push({
        type: 'WARNING',
        locationId: loc.id,
        message: `🔶 ${loc.name} is getting crowded. Consider an alternative.`,
        color: '#f97316',
      });
    }
  });
  return alerts;
}

module.exports = {
  computeScore,
  classifyLevel,
  getPeakFactor,
  rankLocations,
  bestOption,
  generateAlerts,
  WEIGHTS,
};
