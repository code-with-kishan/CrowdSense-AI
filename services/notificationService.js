/**
 * Notification Service — Smart Alerts & Personalized Notifications
 *
 * Manages different types of notifications:
 * - Congestion alerts (auto-generated from crowd data)
 * - Gate closures / delays
 * - Virtual queue ready notifications
 * - Personalized suggestions based on user preferences
 */

const { getAlerts, getEnrichedZones, getSummary } = require('./crowdService');

// In-memory notification store
const _notifications = [];
let _notifCounter = 0;

// User notification preferences
const _subscriptions = new Map();

/**
 * Notification types and their priorities.
 */
const NOTIF_TYPES = {
  CONGESTION: { priority: 'high', icon: '⚠️', color: '#f97316' },
  GATE_CLOSURE: { priority: 'critical', icon: '🚫', color: '#ef4444' },
  GATE_DELAY: { priority: 'medium', icon: '⏱️', color: '#f59e0b' },
  QUEUE_READY: { priority: 'high', icon: '🔔', color: '#10b981' },
  SUGGESTION: { priority: 'low', icon: '💡', color: '#6366f1' },
  EMERGENCY: { priority: 'critical', icon: '🚨', color: '#ef4444' },
  INFO: { priority: 'low', icon: 'ℹ️', color: '#3b82f6' },
};

/**
 * Create a new notification.
 */
function createNotification(type, message, data = {}) {
  const config = NOTIF_TYPES[type] || NOTIF_TYPES.INFO;
  const notif = {
    id: `notif_${++_notifCounter}`,
    type,
    priority: config.priority,
    icon: config.icon,
    color: config.color,
    message,
    data,
    timestamp: new Date().toISOString(),
    read: false,
  };

  _notifications.push(notif);

  // Keep only last 100 notifications
  if (_notifications.length > 100) {
    _notifications.splice(0, _notifications.length - 100);
  }

  return notif;
}

/**
 * Generate smart notifications from current stadium state.
 */
async function generateSmartNotifications() {
  const [alerts, zones, summary] = await Promise.all([
    getAlerts(),
    getEnrichedZones(),
    getSummary(),
  ]);

  const newNotifs = [];

  // Congestion alerts
  alerts.forEach((alert) => {
    const exists = _notifications.find(
      (n) => n.type === 'CONGESTION' && n.data.locationId === alert.locationId &&
        Date.now() - new Date(n.timestamp).getTime() < 60000
    );
    if (!exists) {
      newNotifs.push(
        createNotification('CONGESTION', alert.message, {
          locationId: alert.locationId,
          severity: alert.type,
        })
      );
    }
  });

  // Simulate gate delay/closure based on extreme congestion
  zones.filter((z) => z.type === 'gate').forEach((gate) => {
    if (gate.crowdDensity > 0.9) {
      const exists = _notifications.find(
        (n) => n.type === 'GATE_CLOSURE' && n.data.gateId === gate.id &&
          Date.now() - new Date(n.timestamp).getTime() < 120000
      );
      if (!exists) {
        newNotifs.push(
          createNotification('GATE_CLOSURE',
            `🚫 ${gate.name} is temporarily restricted due to extreme congestion. Please use an alternate gate.`,
            { gateId: gate.id, density: gate.crowdDensity }
          )
        );
      }
    } else if (gate.crowdDensity > 0.75) {
      const exists = _notifications.find(
        (n) => n.type === 'GATE_DELAY' && n.data.gateId === gate.id &&
          Date.now() - new Date(n.timestamp).getTime() < 120000
      );
      if (!exists) {
        newNotifs.push(
          createNotification('GATE_DELAY',
            `⏱️ ${gate.name} is experiencing delays (~${gate.queueMinutes}min wait). Consider ${_suggestAlternateGate(gate.id, zones)}.`,
            { gateId: gate.id, waitMinutes: gate.queueMinutes }
          )
        );
      }
    }
  });

  // Match phase transitions — proactive suggestions
  const phase = summary.matchPhase;
  if (phase === 'half_time') {
    const recentHalftime = _notifications.find(
      (n) => n.type === 'SUGGESTION' && n.data.phase === 'half_time' &&
        Date.now() - new Date(n.timestamp).getTime() < 300000
    );
    if (!recentHalftime) {
      const bestFood = zones.filter((z) => z.type === 'food').sort((a, b) => a.score - b.score)[0];
      const bestRestroom = zones.filter((z) => z.type === 'restroom').sort((a, b) => a.score - b.score)[0];
      newNotifs.push(
        createNotification('SUGGESTION',
          `⏸️ Half-time! ${bestFood?.name || 'Food Court C'} has the shortest queue. ${bestRestroom?.name || 'East Restrooms'} is your best bet for restrooms.`,
          { phase: 'half_time', bestFood: bestFood?.id, bestRestroom: bestRestroom?.id }
        )
      );
    }
  }

  return newNotifs;
}

/**
 * Suggest an alternate gate when one is congested.
 */
function _suggestAlternateGate(currentGateId, zones) {
  const gates = zones
    .filter((z) => z.type === 'gate' && z.id !== currentGateId)
    .sort((a, b) => a.score - b.score);
  return gates[0] ? `using ${gates[0].name} instead` : 'an alternate gate';
}

/**
 * Subscribe a user to specific notification types.
 */
function subscribe(userId, preferences = {}) {
  _subscriptions.set(userId, {
    userId,
    types: preferences.types || ['CONGESTION', 'GATE_CLOSURE', 'QUEUE_READY', 'SUGGESTION'],
    preferredGate: preferences.preferredGate || null,
    subscribedAt: new Date().toISOString(),
  });
  return { subscribed: true, userId, preferences: _subscriptions.get(userId) };
}

/**
 * Get notifications, optionally filtered by user subscription.
 */
async function getNotifications(userId = null, limit = 20) {
  // Generate fresh notifications
  await generateSmartNotifications();

  let notifs = [..._notifications].reverse();

  // Filter by user subscription
  if (userId && _subscriptions.has(userId)) {
    const sub = _subscriptions.get(userId);
    notifs = notifs.filter((n) => sub.types.includes(n.type));
  }

  return notifs.slice(0, limit);
}

/**
 * Get notification counts by priority.
 */
async function getNotificationSummary() {
  const notifs = await getNotifications(null, 50);
  return {
    total: notifs.length,
    critical: notifs.filter((n) => n.priority === 'critical').length,
    high: notifs.filter((n) => n.priority === 'high').length,
    medium: notifs.filter((n) => n.priority === 'medium').length,
    low: notifs.filter((n) => n.priority === 'low').length,
    latest: notifs.slice(0, 5),
  };
}

module.exports = {
  createNotification,
  generateSmartNotifications,
  subscribe,
  getNotifications,
  getNotificationSummary,
  NOTIF_TYPES,
};
