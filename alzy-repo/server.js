'use strict';
/**
 * ALZY — Eswatini's agriculture & food marketplace.
 * Express server. Run with `npm start` (http://localhost:3000).
 */
const express = require('express');
const path = require('path');
const config = require('./lib/config');
const { connect, isSeeded } = require('./db');
const { sessionMiddleware, viewMiddleware } = require('./middleware');

const app = express();

/* ---------- core middleware ---------- */
app.disable('x-powered-by');
app.set('trust proxy', 1);

// tiny cookie parser (no external dependency)
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        req.cookies[k] = v;
      }
    }
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(sessionMiddleware);
app.use(viewMiddleware);

/* ---------- routes ---------- */
app.use('/art', require('./routes/art'));
app.use('/', require('./routes/shop'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/cart'));
app.use('/', require('./routes/checkout'));
app.use('/', require('./routes/coupons'));
app.use('/', require('./routes/account'));
app.use('/', require('./routes/seller'));
app.use('/', require('./routes/messages'));
app.use('/', require('./routes/admin'));
app.use('/api', require('./routes/api'));

/* ---------- 404 & errors ---------- */
app.use((req, res) => {
  const { errorPage } = require('./lib/layout');
  res.status(404).send(errorPage({
    user: req.user,
    title: 'Page not found',
    code: '404',
    message: `We couldn't find “${req.path}”. It may have been sold, moved or never existed.`
  }));
});

app.use((err, req, res, next) => {
  console.error('[ALZY]', err.stack || err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  const { errorPage } = require('./lib/layout');
  res.status(500).send(errorPage({
    user: req.user,
    title: 'Something went wrong',
    code: '500',
    message: 'Our market stall hit a snag. Please try again.'
  }));
});

/* ---------- boot ---------- */
function ensureSeeded() {
  connect();
  if (!isSeeded()) {
    console.log('[ALZY] First run — seeding marketplace data…');
    require('./db/seed');
  }
}

function boot() {
  ensureSeeded();
  const port = Number(config.port);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n  ALZY marketplace running at http://localhost:${port}\n`);
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`Port ${port} is busy. Set PORT=<other> and retry.`);
    else console.error(e);
    process.exit(1);
  });
  return server;
}

if (require.main === module) boot();

module.exports = { app, boot, ensureSeeded };
