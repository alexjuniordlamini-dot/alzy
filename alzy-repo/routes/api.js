'use strict';
/** Small public API surface (mounted at /api). Domain APIs live in their routers. */
const express = require('express');
const { connect } = require('../db');
const Q = require('../lib/queries');
const config = require('../lib/config');

const router = express.Router();

router.get('/health', (req, res) => {
  const db = connect();
  const products = db.prepare("SELECT count(*) AS n FROM products WHERE status='active'").get().n;
  res.json({ ok: true, app: 'ALZY', version: '1.0.0', products, currency: config.currency.code, time: new Date().toISOString() });
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ items: [] });
  const { items } = Q.productList({ q, limit: 8 });
  res.json({
    items: items.map(p => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, unit: p.unit, seller: p.seller_name }))
  });
});

router.get('/categories', (req, res) => {
  res.json(Q.categoriesWithCounts());
});

module.exports = router;
