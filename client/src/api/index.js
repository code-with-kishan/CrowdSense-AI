/**
 * API Client — Centralized data fetching for all backend endpoints.
 */

const API_BASE = '/api/v1';

function toQuery(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json.data;
  } catch (err) {
    console.error(`[API] ${path}:`, err.message);
    return null;
  }
}

// ── Crowd ──────────────────────────────────────────────────────────────────
export const fetchSummary = () => apiFetch('/crowd/summary');
export const fetchZones = (type) => apiFetch(`/crowd/zones/${type}`);
export const fetchAlerts = () => apiFetch('/crowd/alerts');

// ── Queue ──────────────────────────────────────────────────────────────────
export const fetchQueueSummary = () => apiFetch('/queue');
export const fetchVirtualQueues = () => apiFetch('/queue/virtual');

export const joinVirtualQueue = (zoneId, userId) =>
  apiFetch('/queue/join', {
    method: 'POST',
    body: JSON.stringify({ zoneId, userId }),
  });

export const fetchTicketStatus = (ticketId) =>
  apiFetch(`/queue/ticket/${ticketId}`);

// ── Routing ────────────────────────────────────────────────────────────────
export const fetchEntryRoute = (from) =>
  apiFetch(`/routing/entry${toQuery({ from })}`);
export const fetchGateRoute = (gateId, from) =>
  apiFetch(`/routing/gate/${encodeURIComponent(gateId)}${toQuery({ from })}`);
export const fetchFoodRoute = (from) =>
  apiFetch(`/routing/food${toQuery({ from })}`);
export const fetchRestroomRoute = (from) =>
  apiFetch(`/routing/restroom${toQuery({ from })}`);
export const fetchExitRoute = (from) =>
  apiFetch(`/routing/exit${toQuery({ from })}`);
export const fetchEmergencyExits = (from) =>
  apiFetch(`/routing/emergency${toQuery({ from })}`);

// ── Map ────────────────────────────────────────────────────────────────────
export const fetchMapZones = () => apiFetch('/map/zones');

// ── Notifications ──────────────────────────────────────────────────────────
export const fetchNotifications = (userId, limit = 20) =>
  apiFetch(`/notifications${toQuery({ userId, limit })}`);
export const fetchNotificationSummary = () => apiFetch('/notifications/summary');

// ── Assistant ──────────────────────────────────────────────────────────────
export const sendChat = (message, sessionId, location) =>
  apiFetch('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId, location }),
  });

export const resetChat = (sessionId) =>
  apiFetch('/assistant/reset', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });

// ── Health ──────────────────────────────────────────────────────────────────
export const fetchHealth = () => apiFetch('/health');
