'use strict';
/** Dynamic SVG artwork endpoints — keeps every image local & instant. */
const express = require('express');
const { productArt, categoryArt, sellerLogo, heroArt } = require('../lib/art');
const { connect } = require('../db');

const router = express.Router();
const HOUR = 60 * 60 * 24 * 7;

router.get('/product/:vessel/:hue/:icon?', (req, res) => {
  const { vessel, hue, icon } = req.params;
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(productArt({
    vessel, hue, icon,
    label: String(req.query.label || 'ALZY').slice(0, 22),
    sub: String(req.query.sub || '').slice(0, 18)
  }));
});

router.get('/category/:slug', (req, res) => {
  const db = connect();
  const c = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(categoryArt(req.params.slug, c ? c.icon : 'leaf', c ? c.hue : 'green'));
});

router.get('/seller/:slug', (req, res) => {
  const db = connect();
  const s = db.prepare('SELECT * FROM sellers WHERE slug = ?').get(req.params.slug);
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(sellerLogo(s ? s.name : req.params.slug, s ? s.hue : 'green'));
});

router.get('/hero/:variant?', (req, res) => {
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(heroArt(req.params.variant === 'b' ? 'b' : 'a'));
});

/** Coupon tile art: bold value + play glyph. */
router.get('/coupon/:id', (req, res) => {
  const db = connect();
  const c = db.prepare(`SELECT cp.*, s.hue AS seller_hue FROM coupons cp LEFT JOIN sellers s ON s.id = cp.seller_id WHERE cp.id = ?`).get(req.params.id);
  const hue = (c && c.seller_hue) || 'gold';
  const value = c ? (c.type === 'percent' ? `${c.value}% OFF` : `E${Math.round(c.value / 100)} OFF`) : 'DEAL';
  const palettes = {
    green: ['#0f3d2a', '#2f8f57', '#cdee8d'], gold: ['#3d2a02', '#b8862a', '#f6d998'],
    red: ['#3a0f09', '#bf4a2f', '#f6c3b6'], blue: ['#0a2238', '#2f6ea8', '#bcd9f2'],
    teal: ['#052a26', '#2a8b81', '#b7e3de'], violet: ['#251343', '#6b4ba8', '#d5c9f2'],
    rose: ['#3a0f1f', '#b84b7f', '#f5c4d8'], orange: ['#3a1d04', '#cf7124', '#f7d2a8'],
    lime: ['#1e3a08', '#77ae2c', '#dff5b3'], sand: ['#33260f', '#a8863f', '#ecd7ae'],
    cocoa: ['#2b160a', '#7a4a2c', '#dcc0a6'], pink: ['#3a1226', '#b84b7f', '#f6c6da'],
    smoke: ['#1c1c1c', '#4b5a68', '#cbd5dc'], blue2: ['#0a2238', '#2f6ea8', '#bcd9f2']
  };
  const [dark, mid, light] = palettes[hue] || palettes.green;
  const title = String((c && c.title) || 'ALZY coupon').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])).slice(0, 46);
  const dur = c && c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : '';
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <circle cx="540" cy="60" r="140" fill="${light}" opacity=".16"/>
    <circle cx="90" cy="330" r="120" fill="${light}" opacity=".1"/>
    <g stroke="${light}" stroke-width="1" opacity=".18" fill="none">
      <path d="M0 300c120-60 220-60 320 0s200 40 320-20"/><path d="M0 330c140-50 240-40 340 10s180 20 300-30"/>
    </g>
    <text x="48" y="92" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="4" fill="${light}" opacity=".8">ALZY COUPON</text>
    <text x="48" y="196" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="82" font-weight="800" letter-spacing="-3" fill="#fff">${value}</text>
    <text x="50" y="238" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="18" font-weight="500" fill="${light}" opacity=".9">${title}</text>

  </svg>`);
});

/* placeholder used by lifestyle tiles */
router.get('/tile/:kind', (req, res) => {
  const kind = req.params.kind;
  const ART = {
    produce: ['#e8f2dd', '#8bbf3f', 'Fresh from Eswatini farms', 'M1 520c180-70 330-80 480-30s240 20 380-40'],
    wholesale: ['#e6eee9', '#2f8f57', 'Wholesale volumes, fair prices', 'M1 500c200-40 340 10 520 40s200-10 340-60'],
    grocery: ['#fdf1d9', '#e8b33a', 'Your monthly grocery, sorted', 'M1 540c160-90 360-70 500-10s260 10 360-50'],
    packaging: ['#e7eef5', '#2f6ea8', 'Bottles, bags & covers', 'M1 530c190-50 300 30 470 20s260-70 380-50']
  };
  const [bg, mid, label, wave] = ART[kind] || ART.produce;
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', `public, max-age=${HOUR}`);
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="900" height="600">
    <rect width="900" height="600" fill="${bg}"/>
    <circle cx="740" cy="120" r="150" fill="${mid}" opacity=".22"/>
    <circle cx="180" cy="470" r="190" fill="${mid}" opacity=".14"/>
    <path d="${wave}" stroke="${mid}" stroke-width="2" fill="none" opacity=".35"/>
    <path d="M0 560c200-60 380-40 520 10s240 30 380-10v40H0Z" fill="${mid}" opacity=".22"/>
    <text x="60" y="300" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" font-size="42" font-weight="700" letter-spacing="-1.4" fill="${mid}">${label.split(',')[0]}</text>
  </svg>`);
});

module.exports = router;
