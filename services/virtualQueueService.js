/**
 * Virtual Queue Service — Smart Queue Management
 *
 * Allows users to "join" a virtual queue for food courts/restrooms
 * instead of physically standing in line. Provides ticket numbers,
 * estimated wait times, and position tracking.
 */

const { getEnrichedZones } = require('./crowdService');
const { calculateWaitTime } = require('./queueService');

// In-memory queue store (per zone)
const _queues = new Map();

// Ticket counter
let _ticketCounter = 1000;

/**
 * Initialize queues for all food courts and restrooms.
 */
function _ensureQueue(zoneId) {
  if (!_queues.has(zoneId)) {
    _queues.set(zoneId, {
      tickets: [],
      served: 0,
      createdAt: Date.now(),
    });
  }
  return _queues.get(zoneId);
}

/**
 * Join a virtual queue for a specific zone.
 * @param {string} zoneId - e.g. 'food_1', 'restroom_n'
 * @param {string} userId - session or user identifier
 * @returns {object} ticket info
 */
async function joinQueue(zoneId, userId) {
  const zones = await getEnrichedZones();
  const zone = zones.find((z) => z.id === zoneId);

  if (!zone) {
    return { error: 'Zone not found', status: 404 };
  }

  if (!['food', 'restroom'].includes(zone.type)) {
    return { error: 'Virtual queue only available for food courts and restrooms', status: 400 };
  }

  const queue = _ensureQueue(zoneId);

  // Check if user already in queue
  const existing = queue.tickets.find((t) => t.userId === userId && t.status === 'waiting');
  if (existing) {
    return {
      ticketId: existing.ticketId,
      position: queue.tickets.filter((t) => t.status === 'waiting').indexOf(existing) + 1,
      estimatedWait: _estimateWait(queue, zone),
      zoneName: zone.name,
      status: 'already_in_queue',
      message: `You're already in the queue for ${zone.name}.`,
    };
  }

  // Create new ticket
  const ticketId = `TKT-${++_ticketCounter}`;
  const ticket = {
    ticketId,
    userId,
    zoneId,
    zoneName: zone.name,
    joinedAt: new Date().toISOString(),
    status: 'waiting', // waiting → ready → served → expired
    notified: false,
  };

  queue.tickets.push(ticket);

  const position = queue.tickets.filter((t) => t.status === 'waiting').length;
  const estimatedWait = _estimateWait(queue, zone);

  return {
    ticketId,
    position,
    totalInQueue: position,
    estimatedWait,
    zoneName: zone.name,
    zoneId,
    status: 'joined',
    message: `You're #${position} in line for ${zone.name}. Estimated wait: ~${estimatedWait} minutes. We'll notify you when it's your turn!`,
  };
}

/**
 * Get current status of a virtual queue ticket.
 */
async function getTicketStatus(ticketId) {
  for (const [zoneId, queue] of _queues.entries()) {
    const ticket = queue.tickets.find((t) => t.ticketId === ticketId);
    if (ticket) {
      const waitingTickets = queue.tickets.filter((t) => t.status === 'waiting');
      const position = waitingTickets.indexOf(ticket) + 1;
      const zones = await getEnrichedZones();
      const zone = zones.find((z) => z.id === zoneId);

      return {
        ...ticket,
        position: ticket.status === 'waiting' ? position : 0,
        totalInQueue: waitingTickets.length,
        estimatedWait: ticket.status === 'waiting' ? _estimateWait(queue, zone) : 0,
        isReady: ticket.status === 'ready',
      };
    }
  }
  return { error: 'Ticket not found', status: 404 };
}

/**
 * Get all active queues summary.
 */
async function getQueueOverview() {
  const zones = await getEnrichedZones();
  const overview = [];

  for (const zone of zones) {
    if (!['food', 'restroom'].includes(zone.type)) continue;
    const queue = _queues.get(zone.id);
    const waitingCount = queue
      ? queue.tickets.filter((t) => t.status === 'waiting').length
      : 0;

    overview.push({
      zoneId: zone.id,
      zoneName: zone.name,
      type: zone.type,
      physicalQueue: zone.queueMinutes,
      virtualQueue: waitingCount,
      totalWait: _estimateWait(queue, zone),
      crowdDensity: zone.crowdDensity,
      level: zone.level,
    });
  }

  return overview.sort((a, b) => a.totalWait - b.totalWait);
}

/**
 * Simulate queue progression — advance the queue.
 * Called periodically or on tick.
 */
function advanceQueues() {
  for (const [zoneId, queue] of _queues.entries()) {
    const waiting = queue.tickets.filter((t) => t.status === 'waiting');
    // Serve 1-3 people per tick
    const toServe = Math.min(waiting.length, Math.floor(Math.random() * 3) + 1);

    for (let i = 0; i < toServe; i++) {
      if (waiting[i]) {
        waiting[i].status = 'ready';
        waiting[i].notified = true;
        waiting[i].readyAt = new Date().toISOString();
        queue.served++;
      }
    }

    // Expire tickets that have been "ready" for 5+ minutes
    queue.tickets.forEach((t) => {
      if (t.status === 'ready' && t.readyAt) {
        const elapsed = Date.now() - new Date(t.readyAt).getTime();
        if (elapsed > 5 * 60 * 1000) {
          t.status = 'expired';
        }
      }
    });

    // Clean up old served/expired tickets (keep last 50)
    if (queue.tickets.length > 50) {
      queue.tickets = queue.tickets.filter(
        (t) => t.status === 'waiting' || t.status === 'ready'
      );
    }
  }
}

/**
 * Estimate wait time for a queue.
 */
function _estimateWait(queue, zone) {
  if (!queue || !zone) return 5;
  const waitingCount = queue.tickets.filter((t) => t.status === 'waiting').length;
  const baseWait = zone ? Math.round(zone.crowdDensity * 20) : 5;
  // Each person in virtual queue adds ~2 min
  return Math.max(1, baseWait + waitingCount * 2);
}

// Auto-advance queues every 30 seconds
setInterval(advanceQueues, 30000);

module.exports = {
  joinQueue,
  getTicketStatus,
  getQueueOverview,
  advanceQueues,
};
