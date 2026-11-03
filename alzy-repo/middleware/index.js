'use strict';
const config = require('../lib/config');
const { fmt, short } = require('../lib/money');
const { connect } = require('../db');

/** Attach req.user (from session cookie) to every request. */
function sessionMiddleware(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies.alzy_sid;
  if (token) {
    const db = connect();
    const row = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.region, s.expires_at
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(token);
    if (row) {
      req.user = row;
      const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(row.id);
      req.seller = seller || null;
    } else {
      res.clearCookie('alzy_sid');
    }
  }
  res.locals.user = req.user;
  res.locals.seller = req.seller || null;
  next();
}

/** Expose helpers + global data to every view. */
function viewMiddleware(req, res, next) {
  const db = connect();
  res.locals.fmt = fmt;
  res.locals.short = short;
  res.locals.config = config;
  res.locals.categories = db.prepare('SELECT * FROM categories ORDER BY sort, name').all();
  res.locals.cartCount = 0;
  res.locals.currentPath = req.path;
  res.locals.query = req.query || {};
  if (req.user) {
    res.locals.cartCount = require('../lib/cartcookie').countFromCookie(req);
  }
  res.locals.flash = null;
  const flash = req.cookies.alzy_flash;
  if (flash) {
    try { res.locals.flash = JSON.parse(decodeURIComponent(flash)); } catch { /* ignore */ }
    res.clearCookie('alzy_flash');
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in to continue.' });
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireSeller(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in to continue.' });
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  if (req.user.role !== 'admin' && !req.seller) {
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Seller account required.' });
    return res.redirect('/sell');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Admin only.' });
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function flash(res, type, message) {
  res.cookie('alzy_flash', encodeURIComponent(JSON.stringify({ type, message })), { maxAge: 15000, httpOnly: false, sameSite: 'lax' });
}

module.exports = { sessionMiddleware, viewMiddleware, requireAuth, requireSeller, requireAdmin, flash };
