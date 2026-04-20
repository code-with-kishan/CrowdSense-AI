/**
 * API Routes — Express Router (Enhanced)
 *
 * RESTful endpoints for CrowdSense AI.
 * All routes versioned under /api/v1/
 */

const express = require('express');
const router = express.Router();

const crowdService = require('../services/crowdService');
const queueService = require('../services/queueService');
const routingService = require('../services/routingService');
const assistantService = require('../services/assistantService');
const virtualQueueService = require('../services/virtualQueueService');
const notificationService = require('../services/notificationService');

// ── Middleware ─────────────────────────────────────────────────────────────────
function validateQuery(req, res, next) {
  const { from, sessionId } = req.query;
  if (from && !/^[a-z0-9_]+$/.test(from)) {
    return res.status(400).json({ error: 'Invalid "from" parameter' });
  }
  if (sessionId && !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[API Error] ${req.method} ${req.path}:`, err.message);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      });
    });
  };
}

// ── Health Check ───────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const geminiConfigured = !!(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_'));
  const firebaseConfigured = !!(process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_PROJECT_ID.includes('your-'));
  const secretManagerConfigured = !!process.env.GEMINI_API_KEY_SECRET;

  res.json({
    status: 'ok',
    service: 'CrowdSense AI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    geminiConfigured,
    firebaseConfigured,
    googleServices: {
      cloudRun: true,
      geminiApi: geminiConfigured,
      firebase: firebaseConfigured,
      secretManager: secretManagerConfigured,
    },
  });
});

// ── Crowd Routes ───────────────────────────────────────────────────────────────
router.get('/crowd', asyncHandler(async (req, res) => {
  const state = await crowdService.getState();
  res.json({ success: true, data: state });
}));

router.get('/crowd/summary', asyncHandler(async (req, res) => {
  const summary = await crowdService.getSummary();
  res.json({ success: true, data: summary });
}));

router.get('/crowd/alerts', asyncHandler(async (req, res) => {
  const alerts = await crowdService.getAlerts();
  res.json({ success: true, data: alerts, count: alerts.length });
}));

router.get('/crowd/zones/:type', asyncHandler(async (req, res) => {
  const validTypes = ['gate', 'concourse', 'food', 'restroom'];
  const { type } = req.params;

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid zone type. Valid: ${validTypes.join(', ')}` });
  }

  const zones = await crowdService.getEnrichedZones(type);
  res.json({ success: true, data: zones, type });
}));

// ── Queue Routes ───────────────────────────────────────────────────────────────
router.get('/queue', asyncHandler(async (req, res) => {
  const summary = await queueService.getQueueSummary();
  res.json({ success: true, data: summary });
}));

router.get('/queue/gates', asyncHandler(async (req, res) => {
  const data = await queueService.getGateQueue();
  res.json({ success: true, data });
}));

router.get('/queue/food', asyncHandler(async (req, res) => {
  const data = await queueService.getFoodCourtQueue();
  res.json({ success: true, data });
}));

// ── Virtual Queue Routes ──────────────────────────────────────────────────────
router.post('/queue/join', asyncHandler(async (req, res) => {
  const { zoneId, userId } = req.body;

  if (!zoneId) {
    return res.status(400).json({ error: 'zoneId is required' });
  }
  if (!userId || typeof userId !== 'string' || userId.length > 64) {
    return res.status(400).json({ error: 'Valid userId is required' });
  }

  const result = await virtualQueueService.joinQueue(zoneId, userId);

  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  res.json({ success: true, data: result });
}));

router.get('/queue/ticket/:ticketId', asyncHandler(async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId || !/^TKT-\d+$/.test(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket ID format' });
  }

  const result = await virtualQueueService.getTicketStatus(ticketId);

  if (result.error) {
    return res.status(result.status || 404).json({ error: result.error });
  }

  res.json({ success: true, data: result });
}));

router.get('/queue/virtual', asyncHandler(async (req, res) => {
  const overview = await virtualQueueService.getQueueOverview();
  res.json({ success: true, data: overview });
}));

// ── Routing Routes ─────────────────────────────────────────────────────────────
router.get('/routing/entry', validateQuery, asyncHandler(async (req, res) => {
  const from = req.query.from || 'parking_north';
  const route = await routingService.getSmartEntryRoute(from);
  res.json({ success: true, data: route });
}));

router.get('/routing/gate/:gateId', validateQuery, asyncHandler(async (req, res) => {
  const from = req.query.from || 'parking_north';
  const { gateId } = req.params;

  if (!/^(gate_[1-6]|[1-6]|[a-fA-F])$/.test(gateId)) {
    return res.status(400).json({ error: 'Invalid gateId' });
  }

  const route = await routingService.getGateRoute(from, req.params.gateId);
  res.json({ success: true, data: route });
}));

router.get('/routing/food', validateQuery, asyncHandler(async (req, res) => {
  const from = req.query.from || 'concourse_n';
  const data = await routingService.getNearestFood(from);
  res.json({ success: true, data: data.slice(0, 4) });
}));

router.get('/routing/restroom', validateQuery, asyncHandler(async (req, res) => {
  const from = req.query.from || 'concourse_n';
  const data = await routingService.getNearestRestroom(from);
  res.json({ success: true, data: data.slice(0, 4) });
}));

router.get('/routing/exit', validateQuery, asyncHandler(async (req, res) => {
  const from = req.query.from || 'concourse_n';
  const data = await routingService.getExitStrategy(from);
  res.json({ success: true, data });
}));

router.get('/routing/emergency', asyncHandler(async (req, res) => {
  const from = req.query.from || 'concourse_n';
  const exits = routingService.getEmergencyExits(from);
  res.json({ success: true, data: exits });
}));

// ── Map / Zone Coordinates for Frontend ───────────────────────────────────────
router.get('/map/zones', asyncHandler(async (req, res) => {
  const zones = await crowdService.getEnrichedZones();

  // Stadium zone positions for SVG heatmap rendering (normalized 0-100 coordinate space)
  const ZONE_POSITIONS = {
    gate_1: { x: 50, y: 5, w: 16, h: 8, section: 'north' },
    gate_2: { x: 50, y: 87, w: 16, h: 8, section: 'south' },
    gate_3: { x: 92, y: 50, w: 8, h: 16, section: 'east' },
    gate_4: { x: 0, y: 50, w: 8, h: 16, section: 'west' },
    gate_5: { x: 30, y: 5, w: 12, h: 8, section: 'north' },
    gate_6: { x: 70, y: 87, w: 12, h: 8, section: 'south' },
    concourse_n: { x: 25, y: 15, w: 50, h: 10, section: 'north' },
    concourse_s: { x: 25, y: 75, w: 50, h: 10, section: 'south' },
    concourse_e: { x: 78, y: 25, w: 10, h: 50, section: 'east' },
    concourse_w: { x: 12, y: 25, w: 10, h: 50, section: 'west' },
    food_1: { x: 20, y: 28, w: 12, h: 10, section: 'north' },
    food_2: { x: 72, y: 28, w: 12, h: 10, section: 'east' },
    food_3: { x: 20, y: 62, w: 12, h: 10, section: 'south' },
    food_4: { x: 72, y: 62, w: 12, h: 10, section: 'west' },
    restroom_n: { x: 42, y: 18, w: 8, h: 6, section: 'north' },
    restroom_s: { x: 50, y: 76, w: 8, h: 6, section: 'south' },
    restroom_e: { x: 82, y: 42, w: 6, h: 8, section: 'east' },
    restroom_w: { x: 12, y: 50, w: 6, h: 8, section: 'west' },
  };

  const mapData = zones.map((zone) => ({
    ...zone,
    position: ZONE_POSITIONS[zone.id] || { x: 50, y: 50, w: 10, h: 10 },
  }));

  res.json({ success: true, data: mapData });
}));

// ── Notification Routes ───────────────────────────────────────────────────────
router.get('/notifications', asyncHandler(async (req, res) => {
  const userId = req.query.userId || null;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const notifications = await notificationService.getNotifications(userId, limit);
  res.json({ success: true, data: notifications, count: notifications.length });
}));

router.get('/notifications/summary', asyncHandler(async (req, res) => {
  const summary = await notificationService.getNotificationSummary();
  res.json({ success: true, data: summary });
}));

router.post('/notifications/subscribe', asyncHandler(async (req, res) => {
  const { userId, preferences } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const result = notificationService.subscribe(userId, preferences || {});
  res.json({ success: true, data: result });
}));

// ── Assistant Routes ───────────────────────────────────────────────────────────
router.post('/assistant/chat', asyncHandler(async (req, res) => {
  const { message, sessionId, location } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const result = await assistantService.chat(
    message,
    sessionId || 'default',
    location || 'concourse_n'
  );

  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  res.json({ success: true, data: result });
}));

router.post('/assistant/reset', asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const result = assistantService.clearSession(sessionId || 'default');
  res.json({ success: true, data: result });
}));

// ── 404 ────────────────────────────────────────────────────────────────────────
router.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

module.exports = router;
