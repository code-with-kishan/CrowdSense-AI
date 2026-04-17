/**
 * CrowdSense AI — Frontend Application
 * Real-time data polling, chat UI, route display, crowd heatmap
 */

'use strict';

// ── Config ─────────────────────────────────────────────────────────────────────
const API = '/api/v1';
const POLL_INTERVAL = 30_000; // 30s refresh for crowd data
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 9);
let userLocation = 'concourse_n';
let simpleMode = false;

// ── Color helpers ───────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
  low:      { color: '#10b981', text: '🟢 Low' },
  moderate: { color: '#f59e0b', text: '🟡 Moderate' },
  high:     { color: '#f97316', text: '🔶 High' },
  critical: { color: '#ef4444', text: '🔴 Critical' },
};
function levelColor(level) { return LEVEL_COLORS[level]?.color || '#6366f1'; }
function densityToLevel(d) {
  if (d < 0.3) return 'low';
  if (d < 0.55) return 'moderate';
  if (d < 0.75) return 'high';
  return 'critical';
}

// ── DOM refs ────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  matchPhaseBadge: $('match-phase-badge'),
  matchPhaseLabel: $('match-phase-label'),
  attendanceCount:  $('attendance-count'),
  avgDensity:       $('avg-density'),
  totalZones:       $('total-zones'),
  alertCount:       $('alert-count'),
  lastUpdated:      $('last-updated'),
  gateGrid:         $('gate-grid'),
  foodList:         $('food-list'),
  restroomList:     $('restroom-list'),
  chatMessages:     $('chat-messages'),
  chatInput:        $('chat-input'),
  chatForm:         $('chat-form'),
  btnSend:          $('btn-send'),
  btnVoice:         $('btn-voice'),
  btnClearChat:     $('btn-clear-chat'),
  btnEmergency:     $('btn-emergency'),
  btnRefreshGates:  $('btn-refresh-gates'),
  alertBanner:      $('alert-banner'),
  alertText:        $('alert-text'),
  alertClose:       $('alert-close'),
  listeningIndicator: $('listening-indicator'),
  intentBadge:      $('intent-badge'),
  routeContent:     $('route-content'),
  routeTypeBadge:   $('route-type-badge'),
  scoreCard:        $('score-card'),
  scoreBreakdown:   $('score-breakdown'),
  simpleModeToggle: $('simple-mode-toggle'),
  footerTime:       $('footer-time'),
  stadiumName:      $('stadium-name'),
};

// ── Phase label mapping ─────────────────────────────────────────────────────────
const PHASE_LABELS = {
  pre_event:   'Pre-Event',
  gates_open:  'Gates Open',
  pre_match:   'Pre-Match',
  first_half:  '1st Half',
  half_time:   'Half Time ⏸️',
  second_half: '2nd Half',
  post_match:  'Post-Match',
  post_event:  'Event Ended',
};

// ══════════════════════════════════════════════════════════════════════════════
// DATA LAYER — API calls
// ══════════════════════════════════════════════════════════════════════════════

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
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

async function fetchSummary() { return apiFetch('/crowd/summary'); }
async function fetchZones(type) { return apiFetch(`/crowd/zones/${type}`); }
async function fetchQueue() { return apiFetch('/queue'); }
async function fetchAlerts() { return apiFetch('/crowd/alerts'); }
async function fetchEntryRoute() { return apiFetch('/routing/entry'); }

async function sendChat(message) {
  return apiFetch('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId: SESSION_ID, location: userLocation }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

async function refreshDashboard() {
  const [summary, gates, food, restrooms, alerts] = await Promise.all([
    fetchSummary(),
    fetchZones('gate'),
    fetchZones('food'),
    fetchZones('restroom'),
    fetchAlerts(),
  ]);

  if (summary) renderSummary(summary);
  if (gates)   renderGates(gates);
  if (food)    renderFood(food);
  if (restrooms) renderRestrooms(restrooms);
  if (alerts && alerts.length > 0) showAlert(alerts[0].message);
  else hideAlert();
}

function renderSummary(data) {
  els.matchPhaseLabel.textContent = PHASE_LABELS[data.matchPhase] || data.matchPhase;
  els.attendanceCount.textContent = (data.totalAttendance || 0).toLocaleString();
  els.avgDensity.textContent = Math.round((data.averageDensity || 0) * 100) + '%';
  els.totalZones.textContent = data.totalZones || '—';
  els.alertCount.textContent = data.alertCount || '0';

  if (data.lastUpdated) {
    const d = new Date(data.lastUpdated);
    els.lastUpdated.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (data.stadiumName) els.stadiumName.textContent = data.stadiumName;

  // Phase badge color
  const phase = data.matchPhase;
  let hue = '#6366f1';
  if (phase === 'half_time' || phase === 'post_match') hue = '#f97316';
  if (phase === 'gates_open' || phase === 'pre_match')  hue = '#f59e0b';
  els.matchPhaseBadge.style.borderColor = hue + '55';
  els.matchPhaseBadge.style.background  = hue + '18';
}

function renderGates(gates) {
  if (!gates || !gates.length) return;
  const sorted = [...gates].sort((a, b) => (a.score || 0) - (b.score || 0));

  els.gateGrid.innerHTML = sorted.map((g, i) => {
    const level = densityToLevel(g.crowdDensity);
    const color = levelColor(level);
    const pct   = Math.round(g.crowdDensity * 100);
    const wait  = g.queueMinutes ?? Math.round(g.crowdDensity * 40);
    const shortName = g.name.replace('Gate ', 'G').split('–')[0].trim();
    const isBest = i === 0;

    return `
      <div class="gate-card ${isBest ? 'best-gate' : ''}" style="--bar-color:${color};"
           title="${g.name} — ${pct}% full, ~${wait}min wait">
        ${isBest ? '<div class="best-badge">Best</div>' : ''}
        <div class="gate-name">${g.name}</div>
        <div class="gate-meta">
          <span class="gate-pct" style="color:${color}">${pct}%</span>
          <span class="gate-label" style="color:${color}">${LEVEL_COLORS[level]?.text || level}</span>
        </div>
        <div class="density-bar">
          <div class="density-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <div class="gate-wait">⏱ ~${wait} min wait</div>
      </div>`;
  }).join('');
}

function renderFood(zones) {
  if (!zones || !zones.length) return;
  const sorted = [...zones].sort((a, b) => (a.score || 0) - (b.score || 0));
  els.foodList.innerHTML = sorted.map((z, i) => {
    const level = densityToLevel(z.crowdDensity);
    const color = levelColor(level);
    const wait  = z.queueMinutes ?? Math.round(z.crowdDensity * 30);
    return `
      <div class="zone-item">
        <span class="zone-dot" style="background:${color}"></span>
        <span class="zone-name">${z.name}</span>
        <span class="zone-wait">~${wait}m</span>
        ${i === 0 ? '<span class="zone-rank">BEST</span>' : ''}
      </div>`;
  }).join('');
}

function renderRestrooms(zones) {
  if (!zones || !zones.length) return;
  const sorted = [...zones].sort((a, b) => (a.score || 0) - (b.score || 0));
  els.restroomList.innerHTML = sorted.map((z, i) => {
    const level = densityToLevel(z.crowdDensity);
    const color = levelColor(level);
    const wait  = z.queueMinutes ?? Math.round(z.crowdDensity * 15);
    return `
      <div class="zone-item">
        <span class="zone-dot" style="background:${color}"></span>
        <span class="zone-name">${z.name}</span>
        <span class="zone-wait">~${wait}m</span>
        ${i === 0 ? '<span class="zone-rank">BEST</span>' : ''}
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE PANEL RENDERERS
// ══════════════════════════════════════════════════════════════════════════════

function renderRoute(data, type = 'Entry') {
  els.routeTypeBadge.textContent = type;
  let html = '';

  if (!data) {
    html = '<div class="route-placeholder"><p>No route data available. Try again.</p></div>';
    els.routeContent.innerHTML = html;
    return;
  }

  const gate = data.recommendedGate || data;
  const route = data.route || {};
  const alts  = data.alternateGates || [];

  const score = gate.score ?? 0;
  const level = densityToLevel(gate.crowdDensity || 0);
  const color = levelColor(level);
  const pct   = Math.round((gate.crowdDensity || 0) * 100);
  const wait  = gate.queueMinutes || gate.waitMinutes || 0;

  html = `<div class="route-recommendation">
    <div class="route-hero">
      <div>
        <div class="route-hero-name">${gate.name || gate.id || 'Best Option'}</div>
        <div class="route-hero-meta" style="color:${color}">
          ${LEVEL_COLORS[level]?.text || level} · ${pct}% full · ~${wait}min wait
        </div>
      </div>
      <div class="route-hero-score">
        <span class="route-score-val" style="color:${color}">${(score * 100).toFixed(0)}</span>
        <span class="route-score-label">Score</span>
      </div>
    </div>`;

  if (route.steps && route.steps.length > 0) {
    html += `<div class="route-steps">`;
    route.steps.forEach((step) => {
      html += `<div class="route-step">
        <span class="step-num">${step.step}</span>
        <span>${step.location}</span>
      </div>`;
    });
    if (route.estimatedMinutes) {
      html += `<div class="route-step" style="color:var(--teal);font-weight:600;">
        <span class="step-num">⏱</span>
        <span>~${route.estimatedMinutes} min total travel</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (data.reasoning) {
    html += `<div class="route-reasoning">"${data.reasoning}"</div>`;
  } else if (data.tip) {
    html += `<div class="route-reasoning">"${data.tip}"</div>`;
  }

  if (alts.length > 0) {
    html += `<div class="alt-routes">` +
      alts.slice(0, 3).map((a) => {
        const al = densityToLevel(a.crowdDensity || 0);
        return `<div class="alt-route-chip" style="border-color:${levelColor(al)}22">
          <strong>${a.name?.split('–')[0] || a.id}</strong>
          <span>${Math.round((a.crowdDensity || 0) * 100)}%</span>
        </div>`;
      }).join('') + `</div>`;
  }

  html += '</div>';
  els.routeContent.innerHTML = html;

  // Render score breakdown
  if (gate.crowdDensity !== undefined) {
    renderScoreBreakdown(gate);
  }
}

function renderScoreBreakdown(gate) {
  const crowd = gate.crowdDensity || 0;
  const queue = Math.min((gate.queueMinutes || 0) / 60, 1);
  const peak  = gate.peakFactor || 0.3;

  els.scoreCard.style.display = 'block';
  els.scoreBreakdown.innerHTML = [
    { label: 'Crowd Density (×0.5)', val: crowd, weight: 0.5 },
    { label: 'Queue Time (×0.3)', val: queue, weight: 0.3 },
    { label: 'Peak Factor (×0.2)', val: peak, weight: 0.2 },
  ].map(row => {
    const contribution = row.val * row.weight;
    return `<div class="score-row">
      <span class="score-row-label">${row.label}</span>
      <div class="score-row-bar">
        <div class="score-row-fill" style="width:${row.val * 100}%;background:${levelColor(densityToLevel(row.val))};"></div>
      </div>
      <span class="score-row-val">${(contribution).toFixed(2)}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT ENGINE
// ══════════════════════════════════════════════════════════════════════════════

function addMessage(text, role = 'ai', meta = {}) {
  const msg = document.createElement('div');
  const isUser = role === 'user';
  const isEmergency = meta.intent === 'EMERGENCY';

  msg.className = `chat-msg ${role} ${isEmergency ? 'emergency' : ''}`;
  msg.setAttribute('role', 'listitem');
  msg.innerHTML = `
    <div class="msg-avatar">${isUser ? '👤' : '🤖'}</div>
    <div>
      ${!isUser && meta.intent ? `<div class="msg-intent">${meta.intent}</div>` : ''}
      <div class="msg-bubble">${escapeHtml(text)}</div>
      <div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>`;

  els.chatMessages.appendChild(msg);
  scrollToBottom();
}

function addTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'chat-msg ai typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  els.chatMessages.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function scrollToBottom() {
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

async function handleChatSubmit(messageText) {
  const text = (messageText || els.chatInput.value).trim();
  if (!text) return;

  els.chatInput.value = '';
  els.btnSend.disabled = true;
  addMessage(text, 'user');
  addTypingIndicator();

  // Show intent badge immediately from local classifier
  updateIntentBadge(text);

  const data = await sendChat(text);
  removeTypingIndicator();
  els.btnSend.disabled = false;

  if (data) {
    const responseText = simpleMode ? simplifyText(data.response) : data.response;
    addMessage(responseText, 'ai', { intent: data.intent });

    // Update intent badge with confirmed classification
    if (data.intent) {
      els.intentBadge.style.display = 'inline-block';
      els.intentBadge.textContent = data.intent;
    }

    // Show structured route data if available
    if (data.structuredData) {
      if (data.intent === 'NAVIGATION') renderRoute(data.structuredData, 'Entry');
      else if (data.intent === 'EXIT')  renderRoute(data.structuredData, 'Exit');
      else if (data.intent === 'FOOD')  renderFoodFromData(data.structuredData);
      else if (data.intent === 'EMERGENCY') renderEmergencyExits(data.structuredData);
    }
  } else {
    addMessage("I'm having trouble connecting right now. Please try again in a moment.", 'ai');
  }

  els.chatInput.focus();
}

function updateIntentBadge(text) {
  const lower = text.toLowerCase();
  let intent = 'GENERAL';
  if (/emergency|help|hurt|medical|fire|lost/.test(lower)) intent = 'EMERGENCY';
  else if (/gate|entry|enter|route|navigate|direction/.test(lower)) intent = 'NAVIGATION';
  else if (/food|eat|drink|hungry|snack/.test(lower)) intent = 'FOOD';
  else if (/exit|leave|go home|out/.test(lower)) intent = 'EXIT';
  else if (/restroom|bathroom|toilet/.test(lower)) intent = 'RESTROOM';
  else if (/crowd|busy|wait|queue|congest/.test(lower)) intent = 'CROWD';

  els.intentBadge.style.display = 'inline-block';
  els.intentBadge.textContent = intent;
}

function simplifyText(text) {
  // Simple mode: shorter sentences, no jargon
  return text.replace(/\bcongestion\b/gi, 'crowd')
             .replace(/\bcongested\b/gi, 'crowded')
             .replace(/\bnavigation\b/gi, 'directions')
             .replace(/\bfacilities\b/gi, 'places')
             .replace(/\boptimal\b/gi, 'best')
             .replace(/\bproceed\b/gi, 'go');
}

function renderFoodFromData(foodData) {
  if (!Array.isArray(foodData) || !foodData.length) return;
  const best = foodData[0];
  renderRoute({
    recommendedGate: { ...best, name: best.name || 'Best Food Court', queueMinutes: best.waitMinutes || 5 },
    route: { steps: best.route?.map((r, i) => ({ step: i + 1, location: r })) || [], estimatedMinutes: best.travelMinutes || 2 },
    reasoning: `${best.name} has the shortest wait right now — estimated ${best.totalTime || 5} minutes including travel.`,
  }, 'Food');
}

function renderEmergencyExits(exits) {
  if (!Array.isArray(exits) || !exits.length) return;
  const nearest = exits[0];
  renderRoute({
    recommendedGate: { ...nearest, name: nearest.name, crowdDensity: 0, queueMinutes: 0, score: 0 },
    route: { steps: nearest.route?.map((r, i) => ({ step: i + 1, location: r })) || [], estimatedMinutes: nearest.travelMinutes },
    reasoning: nearest.directions || 'Follow green EXIT signs immediately.',
  }, 'Emergency Exit');
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE INPUT
// ══════════════════════════════════════════════════════════════════════════════

let recognition = null;
let isListening = false;

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.btnVoice.title = 'Voice input not supported in this browser';
    els.btnVoice.style.opacity = '0.4';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    els.btnVoice.classList.add('active');
    els.listeningIndicator.style.display = 'flex';
  };
  recognition.onend = () => {
    isListening = false;
    els.btnVoice.classList.remove('active');
    els.listeningIndicator.style.display = 'none';
  };
  recognition.onerror = (e) => {
    console.warn('[Voice] Error:', e.error);
    isListening = false;
    els.btnVoice.classList.remove('active');
    els.listeningIndicator.style.display = 'none';
  };
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    els.chatInput.value = transcript;
    handleChatSubmit(transcript);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ALERTS
// ══════════════════════════════════════════════════════════════════════════════

function showAlert(msg) {
  els.alertText.textContent = msg;
  els.alertBanner.style.display = 'flex';
}
function hideAlert() {
  els.alertBanner.style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// QUICK ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

function bindQuickActions() {
  document.querySelectorAll('.qa-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // Highlight active
      document.querySelectorAll('.qa-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const query = btn.dataset.query;
      await handleChatSubmit(query);

      // Also pre-load route data for navigation/food buttons
      const id = btn.id;
      if (id === 'qa-entry') {
        const route = await fetchEntryRoute();
        if (route) renderRoute(route, 'Entry');
      }

      setTimeout(() => btn.classList.remove('active'), 3000);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════════════════════════

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateFooterTime() {
  els.footerTime.textContent = new Date().toLocaleString('en-IN', {
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Best gate badge CSS injection ─────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .gate-card.best-gate { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.07); }
  .best-badge {
    position: absolute; top: 5px; right: 6px; z-index: 1;
    font-size: 0.55rem; font-weight: 700; color: #818cf8;
    background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4);
    padding: 0.1rem 0.3rem; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em;
  }
`;
document.head.appendChild(style);

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════

async function init() {
  console.log('%c🏟️ CrowdSense AI', 'font-size:16px;font-weight:bold;color:#6366f1;');
  console.log('%cPowered by Google Gemini + Firebase', 'color:#94a3b8;');

  // Initial welcome message
  addMessage(
    `👋 Welcome to Kishan Sports Arena! I'm your AI assistant, powered by real-time crowd intelligence. \n\nI can help you find the best entry gate, shortest food queue, nearest restroom, or guide you in an emergency. What do you need?`,
    'ai'
  );

  // Load data
  await refreshDashboard();

  // Auto-load best entry route
  const entry = await fetchEntryRoute();
  if (entry) renderRoute(entry, 'Entry');

  // Bind events
  els.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleChatSubmit();
  });

  els.btnVoice.addEventListener('click', () => {
    if (!recognition) return;
    if (isListening) { recognition.stop(); }
    else { recognition.start(); }
  });

  els.btnClearChat.addEventListener('click', () => {
    els.chatMessages.innerHTML = '';
    addMessage('Chat cleared. How can I help you?', 'ai');
    fetch(`${API}/assistant/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    }).catch(() => {});
  });

  els.btnEmergency.addEventListener('click', () => {
    handleChatSubmit('Emergency! I need immediate help. What should I do?');
  });

  els.btnRefreshGates.addEventListener('click', async () => {
    els.btnRefreshGates.style.transform = 'rotate(360deg)';
    await refreshDashboard();
    setTimeout(() => { els.btnRefreshGates.style.transform = ''; }, 500);
  });

  els.alertClose.addEventListener('click', hideAlert);

  els.simpleModeToggle.addEventListener('change', (e) => {
    simpleMode = e.target.checked;
    e.target.setAttribute('aria-checked', simpleMode.toString());
  });

  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  });

  bindQuickActions();
  initVoice();

  // Footer clock
  updateFooterTime();
  setInterval(updateFooterTime, 1000);

  // Poll dashboard
  setInterval(refreshDashboard, POLL_INTERVAL);

  // Keyboard shortcut: / to focus chat
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els.chatInput) {
      e.preventDefault();
      els.chatInput.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
