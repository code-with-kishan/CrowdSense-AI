/**
 * API Tests — CrowdSense AI
 *
 * Verifies all core endpoints respond correctly.
 * Run with: npm test
 */

const http = require('http');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0;
let failed = 0;
const results = [];

// ── Test Utilities ─────────────────────────────────────────────────────────────
async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', test: testName });
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${testName}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', test: testName, detail });
    console.log(`  \x1b[31m✘ FAIL\x1b[0m ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Test Suites ────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n\x1b[36m══════════════════════════════════════════\x1b[0m');
  console.log('\x1b[36m       🧪 CrowdSense AI — API Tests       \x1b[0m');
  console.log('\x1b[36m══════════════════════════════════════════\x1b[0m\n');

  // ── 1. Health Check ──────────────────────────────────────────────────────────
  console.log('\x1b[33m[Suite 1] Health & Status\x1b[0m');
  try {
    const res = await request('GET', '/api/v1/health');
    assert(res.status === 200, 'GET /health returns 200');
    assert(res.body.status === 'ok', 'Health status is "ok"');
    assert(typeof res.body.uptime === 'number', 'Uptime is a number');
    assert(res.body.version === '1.0.0', 'Version is 1.0.0');
  } catch (e) {
    assert(false, 'Health check reachable', e.message);
  }

  // ── 2. Crowd Data ────────────────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 2] Crowd Service\x1b[0m');
  try {
    const summary = await request('GET', '/api/v1/crowd/summary');
    assert(summary.status === 200, 'GET /crowd/summary returns 200');
    assert(summary.body.success === true, 'Success flag is true');
    assert(typeof summary.body.data.matchPhase === 'string', 'Match phase is present');
    assert(typeof summary.body.data.totalAttendance === 'number', 'Total attendance is a number');

    const alerts = await request('GET', '/api/v1/crowd/alerts');
    assert(alerts.status === 200, 'GET /crowd/alerts returns 200');
    assert(Array.isArray(alerts.body.data), 'Alerts is an array');

    const gates = await request('GET', '/api/v1/crowd/zones/gate');
    assert(gates.status === 200, 'GET /crowd/zones/gate returns 200');
    assert(Array.isArray(gates.body.data), 'Gate zones is an array');
    assert(gates.body.data.length === 6, 'Returns 6 gates');
    assert(gates.body.data[0].crowdDensity !== undefined, 'Gates have crowdDensity');
    assert(gates.body.data[0].score !== undefined, 'Gates have score');

    const invalid = await request('GET', '/api/v1/crowd/zones/invalid');
    assert(invalid.status === 400, 'Invalid zone type returns 400');
  } catch (e) {
    assert(false, 'Crowd service reachable', e.message);
  }

  // ── 3. Queue Service ─────────────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 3] Queue Service\x1b[0m');
  try {
    const queue = await request('GET', '/api/v1/queue');
    assert(queue.status === 200, 'GET /queue returns 200');
    assert(queue.body.data.bestGate !== null, 'Best gate recommendation exists');
    assert(queue.body.data.bestFood !== null, 'Best food recommendation exists');
    assert(typeof queue.body.data.gates[0].waitMinutes === 'number', 'Gate wait times are numbers');
  } catch (e) {
    assert(false, 'Queue service reachable', e.message);
  }

  // ── 4. Routing Service ───────────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 4] Routing Service\x1b[0m');
  try {
    const entry = await request('GET', '/api/v1/routing/entry');
    assert(entry.status === 200, 'GET /routing/entry returns 200');
    assert(entry.body.data.recommendedGate !== null, 'Recommended gate exists');
    assert(Array.isArray(entry.body.data.route.steps), 'Route steps is an array');
    assert(typeof entry.body.data.reasoning === 'string', 'Reasoning is provided');

    const food = await request('GET', '/api/v1/routing/food?from=concourse_n');
    assert(food.status === 200, 'GET /routing/food returns 200');
    assert(food.body.data.length > 0, 'Food routes are returned');

    const emergency = await request('GET', '/api/v1/routing/emergency');
    assert(emergency.status === 200, 'GET /routing/emergency returns 200');
    assert(emergency.body.data.length === 4, 'All 4 emergency exits returned');
  } catch (e) {
    assert(false, 'Routing service reachable', e.message);
  }

  // ── 5. Assistant Service ─────────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 5] AI Assistant\x1b[0m');
  try {
    const chat = await request('POST', '/api/v1/assistant/chat', {
      message: 'Which gate should I enter from?',
      sessionId: 'test_session',
    });
    assert(chat.status === 200, 'POST /assistant/chat returns 200');
    assert(typeof chat.body.data.response === 'string', 'Response is a string');
    assert(chat.body.data.response.length > 10, 'Response has meaningful content');
    assert(chat.body.data.intent === 'NAVIGATION', 'Intent correctly classified as NAVIGATION');

    const foodChat = await request('POST', '/api/v1/assistant/chat', {
      message: 'I am hungry, where can I eat?',
      sessionId: 'test_session',
    });
    assert(foodChat.status === 200, 'Food query returns 200');
    assert(foodChat.body.data.intent === 'FOOD', 'Intent correctly classified as FOOD');

    const emergency = await request('POST', '/api/v1/assistant/chat', {
      message: 'Emergency! Medical help needed!',
      sessionId: 'test_emergency',
    });
    assert(emergency.status === 200, 'Emergency query returns 200');
    assert(emergency.body.data.intent === 'EMERGENCY', 'Intent correctly classified as EMERGENCY');

    const emptyMsg = await request('POST', '/api/v1/assistant/chat', { message: '' });
    assert(emptyMsg.status === 400, 'Empty message returns 400');

    const reset = await request('POST', '/api/v1/assistant/reset', { sessionId: 'test_session' });
    assert(reset.status === 200, 'Session reset returns 200');
    assert(reset.body.data.cleared === true, 'Session cleared confirmed');
  } catch (e) {
    assert(false, 'Assistant service reachable', e.message);
  }

  // ── 6. Decision Engine Logic ─────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 6] Decision Engine\x1b[0m');
  try {
    const { computeScore, classifyLevel, rankLocations } = require('../utils/decisionEngine');

    const score = computeScore(0.5, 15, 0.3);
    assert(score > 0 && score < 1, 'Score is in [0, 1] range');
    assert(Math.abs(score - (0.5 * 0.5 + 0.25 * 0.3 + 0.3 * 0.2)) < 0.01, 'Score formula is correct');

    const low = classifyLevel(0.1);
    assert(low.level === 'low', 'Score 0.1 = low congestion');

    const critical = classifyLevel(0.9);
    assert(critical.level === 'critical', 'Score 0.9 = critical congestion');

    const locations = [
      { id: 'a', name: 'Zone A', crowdDensity: 0.8, queueMinutes: 30 },
      { id: 'b', name: 'Zone B', crowdDensity: 0.2, queueMinutes: 5 },
    ];
    const ranked = rankLocations(locations);
    assert(ranked[0].id === 'b', 'Least crowded zone ranks first');
  } catch (e) {
    assert(false, 'Decision engine logic', e.message);
  }

  // ── 7. Context Analyzer ──────────────────────────────────────────────────────
  console.log('\n\x1b[33m[Suite 7] Context Analyzer\x1b[0m');
  try {
    const { analyzeIntent } = require('../utils/contextAnalyzer');

    const nav = analyzeIntent('Where is the nearest gate?');
    assert(nav.intent === 'NAVIGATION', 'Gate query → NAVIGATION');

    const food = analyzeIntent('I want to eat something');
    assert(food.intent === 'FOOD', 'Eat query → FOOD');

    const sos = analyzeIntent('emergency help hurt');
    assert(sos.intent === 'EMERGENCY', 'Emergency keywords → EMERGENCY');

    const exit = analyzeIntent('How do I exit the stadium?');
    assert(exit.intent === 'EXIT', 'Exit query → EXIT');
  } catch (e) {
    assert(false, 'Context analyzer logic', e.message);
  }

  // ── Results Summary ──────────────────────────────────────────────────────────
  console.log('\n\x1b[36m══════════════════════════════════════════\x1b[0m');
  const total = passed + failed;
  const pct = Math.round((passed / total) * 100);
  console.log(`\x1b[36m  Results: ${passed}/${total} tests passed (${pct}%)  \x1b[0m`);
  if (failed > 0) {
    console.log(`  \x1b[31m${failed} test(s) FAILED\x1b[0m`);
  } else {
    console.log(`  \x1b[32m✅ All tests passed!\x1b[0m`);
  }
  console.log('\x1b[36m══════════════════════════════════════════\x1b[0m\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Start server briefly for integration tests, then run
const app = require('../server');
setTimeout(runTests, 1500); // Give server 1.5s to start
