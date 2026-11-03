'use strict';
const express = require('express');
const { connect } = require('../db');
const { hashPassword, verifyPassword, newToken, rateLimit } = require('../lib/auth');
const { render, esc } = require('../lib/layout');
const config = require('../lib/config');
const { flash } = require('../middleware');

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;

function setSession(res, userId) {
  const db = connect();
  const token = newToken();
  const expires = new Date(Date.now() + config.sessionDays * DAY).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').run(token, userId, expires);
  res.cookie('alzy_sid', token, { httpOnly: true, sameSite: 'lax', maxAge: config.sessionDays * DAY, path: '/' });
}

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.send(view(req, res, {
    title: 'Sign in',
    body: `
    <div class="auth-shell">
      <div class="auth-art">
        <a href="/" class="brand" style="color:#fff">ALZY</a>
        <div>
          <h2>Your whole food shop, in one market.</h2>
          <p>Track orders, unlock coupon-only prices, message farms and manage your own brand — all in one account.</p>
        </div>
        <div class="hero-stats" style="margin-top:0">
          <div class="hero-stat"><b>141</b><span>live listings</span></div>
          <div class="hero-stat"><b>18</b><span>farms &amp; suppliers</span></div>
        </div>
      </div>
      <div class="auth-form">
        <div class="auth-card">
          <h1>Welcome back</h1>
          <p class="sub">Sign in to shop, track deliveries and use your coupons.</p>
          <form method="post" action="/login" novalidate>
            <input type="hidden" name="next" value="${esc(req.query.next || '')}">
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></div>
            <button class="btn btn-dark btn-block" type="submit">Sign in</button>
          </form>
          <div class="auth-switch">New to ALZY? <a href="/register">Create a free account</a></div>
          <div class="demo-logins">
            <h4>Demo accounts — one click</h4>
            <button type="button" data-demo="thandi@example.com|Alzy123!"><span>Buyer</span><span>thandi@example.com</span></button>
            <button type="button" data-demo="farm@ngwempisi.co.sz|Farmer123!"><span>Farmer</span><span>farm@ngwempisi.co.sz</span></button>
            <button type="button" data-demo="supply@manziniwholesale.co.sz|Supplier123!"><span>Supplier</span><span>supply@manziniwholesale.co.sz</span></button>
            <button type="button" data-demo="admin@alzy.co.sz|Admin123!"><span>Admin</span><span>admin@alzy.co.sz</span></button>
          </div>
        </div>
      </div>
    </div>
    <script src="/js/demo-login.js" defer></script>`
  }));
});

router.post('/login', (req, res) => {
  if (!rateLimit('login:' + req.ip, 20, 60_000)) {
    flash(res, 'error', 'Too many attempts. Please wait a minute.');
    return res.redirect('/login');
  }
  const { email = '', password = '', next = '' } = req.body || {};
  const db = connect();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    flash(res, 'error', 'Email or password is incorrect.');
    return res.redirect('/login' + (next ? '?next=' + encodeURIComponent(next) : ''));
  }
  setSession(res, user.id);
  flash(res, 'success', `Sawubona, ${user.name.split(' ')[0]}!`);
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null;
  res.redirect(safeNext || (user.role === 'admin' ? '/admin' : '/account'));
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.send(view(req, res, {
    title: 'Create your ALZY account',
    body: `
    <div class="auth-shell">
      <div class="auth-art">
        <a href="/" class="brand" style="color:#fff">ALZY</a>
        <div>
          <h2>Join the market farmers trust.</h2>
          <p>One free account for shopping, selling and branding. No listing fees, ever.</p>
        </div>
        <div class="tag-row">
          <span class="pill" style="background:rgba(255,255,255,.12);color:#dff5b3">Buyer</span>
          <span class="pill" style="background:rgba(255,255,255,.12);color:#dff5b3">Farmer</span>
          <span class="pill" style="background:rgba(255,255,255,.12);color:#dff5b3">Supplier</span>
          <span class="pill" style="background:rgba(255,255,255,.12);color:#dff5b3">Processor</span>
        </div>
      </div>
      <div class="auth-form">
        <div class="auth-card">
          <h1>Create your account</h1>
          <p class="sub">It takes less than a minute.</p>
          <form method="post" action="/register" novalidate>
            <div class="field"><label for="name">Full name / business name</label><input id="name" name="name" required autocomplete="name" placeholder="Thandiwe Dlamini"></div>
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
            <div class="field-row">
              <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" autocomplete="tel" placeholder="+268 76 123 456"></div>
              <div class="field"><label for="region">Region</label>
                <select id="region" name="region">${config.deliveryRegions.map(r => `<option>${esc(r.name)}</option>`).join('')}<option>Other</option></select>
              </div>
            </div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters"><div class="hint">Use at least 8 characters.</div></div>
            <div class="field">
              <label for="role">I'm joining as</label>
              <select id="role" name="role">
                <option value="buyer">Buyer — individual, restaurant, supermarket or wholesaler</option>
                <option value="farmer">Farmer — sell my harvest</option>
                <option value="supplier">Supplier / processor — sell products or packaging</option>
              </select>
            </div>
            <button class="btn btn-dark btn-block" type="submit">Create free account</button>
          </form>
          <div class="auth-switch">Already have an account? <a href="/login">Sign in</a></div>
        </div>
      </div>
    </div>`
  }));
});

router.post('/register', (req, res) => {
  if (!rateLimit('register:' + req.ip, 10, 60_000)) {
    flash(res, 'error', 'Too many attempts. Please wait a minute.');
    return res.redirect('/register');
  }
  const { name = '', email = '', password = '', phone = '', region = '', role = 'buyer' } = req.body || {};
  const cleanName = String(name).trim().slice(0, 80);
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanRole = ['buyer', 'farmer', 'supplier'].includes(role) ? role : 'buyer';
  if (!cleanName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail) || String(password).length < 8) {
    flash(res, 'error', 'Please check your name, email and password (8+ characters).');
    return res.redirect('/register');
  }
  const db = connect();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail)) {
    flash(res, 'error', 'That email is already registered. Try signing in.');
    return res.redirect('/login');
  }
  const info = db.prepare('INSERT INTO users (name,email,password_hash,role,phone,region) VALUES (?,?,?,?,?,?)')
    .run(cleanName, cleanEmail, hashPassword(String(password)), cleanRole, String(phone).slice(0, 40), String(region).slice(0, 60));
  const userId = info.lastInsertRowid;

  // Welcome coupon claim, so every new buyer has something to use immediately.
  const welcome = db.prepare("SELECT id FROM coupons WHERE code = 'WELCOME10'").get();
  if (welcome) {
    db.prepare("INSERT OR IGNORE INTO coupon_claims (coupon_id,user_id,status,earned_at) VALUES (?,?,'earned',datetime('now'))").run(welcome.id, userId);
  }
  // Sellers get a starter storefront stub they can complete in the dashboard.
  if (cleanRole === 'farmer' || cleanRole === 'supplier') {
    const slugBase = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seller';
    let slug = slugBase, n = 1;
    while (db.prepare('SELECT 1 FROM sellers WHERE slug = ?').get(slug)) slug = `${slugBase}-${++n}`;
    db.prepare(`INSERT INTO sellers (user_id,kind,name,slug,tagline,description,region,hue,plan,verified,rating,rating_count,since)
      VALUES (?,?,?,?,?,?,?,?,'free',0,0,0,?)`)
      .run(userId, cleanRole === 'farmer' ? 'farm' : 'supplier', cleanName, slug,
        'New on ALZY', 'Tell buyers about your farm or business in the seller dashboard.', String(region).slice(0, 60), 'green', String(new Date().getFullYear()));
  }

  setSession(res, userId);
  flash(res, 'success', 'Welcome to ALZY! Your 10% welcome coupon is waiting in your account.');
  res.redirect(cleanRole === 'buyer' ? '/account' : '/seller');
});

router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies.alzy_sid;
  if (token) connect().prepare('DELETE FROM sessions WHERE id = ?').run(token);
  res.clearCookie('alzy_sid');
  flash(res, 'success', 'You have been signed out.');
  res.redirect('/');
});

module.exports = router;
