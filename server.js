/**
 * CrowdSense AI — Main Server
 *
 * Production-ready Express server with:
 * - CORS support
 * - Security headers
 * - Request logging
 * - Static file serving (frontend)
 * - Graceful startup & shutdown
 * - Cloud Run compatible (PORT env var)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeState } = require('./services/crowdService');
const apiRoutes = require('./api/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & Middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : (process.env.NODE_ENV === 'production' ? false : '*'),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${new Date().toISOString()}] ${req.method} ${req.path} → ${status} (${duration}ms)\x1b[0m`);
  });
  next();
});

// ── Static Frontend ───────────────────────────────────────────────────────────
const clientDistPath = path.join(__dirname, 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDistPath, 'index.html'));

if (hasClientBuild) {
  app.use(express.static(clientDistPath));
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// ── SPA Fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found', path: req.path });
  }

  if (!hasClientBuild) {
    return res.status(503).json({
      error: 'Client build missing',
      message: 'Run npm run build in the client folder before starting the server.',
    });
  }

  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({
    error: 'Unexpected server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again',
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log('\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[36m║      🏟️  CrowdSense AI v1.0.0           ║\x1b[0m');
    console.log('\x1b[36m╚══════════════════════════════════════════╝\x1b[0m');

    // Initialize crowd simulation engine
    console.log('[Startup] Initializing crowd simulation engine...');
    await initializeState();

    const server = app.listen(PORT, () => {
      console.log(`\n\x1b[32m✅ Server running at http://localhost:${PORT}\x1b[0m`);
      console.log(`\x1b[32m✅ API ready at http://localhost:${PORT}/api/v1\x1b[0m`);
      console.log(`\x1b[32m✅ UI mode: ${hasClientBuild ? 'React client build' : 'Build required'}\x1b[0m`);
      console.log(`\x1b[32m✅ Stadium: ${process.env.STADIUM_NAME || 'Kishan Sports Arena'}\x1b[0m\n`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[Shutdown] Server closed. Goodbye! 👋');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Startup] Fatal error:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app; // for testing
