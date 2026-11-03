'use strict';
const express = require('express');
const { connect } = require('../db');
const { render, esc } = require('../lib/layout');
const { requireAuth } = require('../middleware');

const router = express.Router();

const cartCookie = require('../lib/cartcookie');
const readCart = (req) => cartCookie.read(req);
const writeCart = (res, cart) => cartCookie.write(res, cart);

function hydrate(req) {
  const db = connect();
  const cart = readCart(req);
  const items = [];
  for (const line of cart) {
    const p = db.prepare(`
      SELECT p.*, c.name AS category_name, s.name AS seller_name, s.slug AS seller_slug, s.plan AS seller_plan
      FROM products p JOIN categories c ON c.id = p.category_id JOIN sellers s ON s.id = p.seller_id
      WHERE p.id = ? AND p.status = 'active'`).get(line.pid);
    if (!p) continue;
    const qty = Math.max(p.moq, line.qty);
    items.push({
      product_id: p.id, name: p.name, slug: p.slug, price: p.price, unit: p.unit, moq: p.moq, step: p.step,
      qty, stock: p.stock, seller_name: p.seller_name, seller_id: p.seller_id, seller_plan: p.seller_plan,
      category_name: p.category_name, vessel: p.vessel, hue: p.hue, icon: p.icon,
      line_total: p.price * qty
    });
  }
  const subtotal = items.reduce((n, i) => n + i.line_total, 0);
  const count = items.reduce((n, i) => n + i.qty, 0);
  return { items, subtotal, count };
}

router.get('/cart', (req, res) => {
  const cart = hydrate(req);
  const db = connect();
  const deals = db.prepare("SELECT id,code,title,type,value,min_subtotal FROM coupons WHERE active=1 AND kind='promo' ORDER BY value DESC LIMIT 4").all();
  res.send(render({
    title: 'Your cart', user: req.user, seller: req.seller, cartCount: cart.count, currentPath: '/cart',
    body: `
    <div class="wrap" style="padding-top:28px;padding-bottom:72px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Cart</span></nav>
      <h1 class="page-title" style="margin-bottom:8px">Your cart</h1>
      <p class="lede" style="margin-bottom:32px">${cart.count ? `${cart.count} item${cart.count > 1 ? 's' : ''} from ${new Set(cart.items.map(i => i.seller_id)).size} seller${new Set(cart.items.map(i => i.seller_id)).size > 1 ? 's' : ''}. One checkout, one coordinated delivery.` : 'Nothing here yet — the whole market is waiting.'}</p>
      <div class="cart-shell" data-cart-root>
        <div data-cart-lines>
          ${cart.items.map(it => `
          <div class="cart-line" data-line="${it.product_id}">
            <img src="/art/product/${encodeURIComponent(it.vessel)}/${encodeURIComponent(it.hue)}/${encodeURIComponent(it.icon)}?label=${encodeURIComponent(it.category_name)}" alt="${esc(it.name)}">
            <div>
              <a href="/product/${encodeURIComponent(it.slug)}" style="font-weight:600;font-size:14.5px">${esc(it.name)}</a>
              <div class="small muted" style="margin-top:2px">${esc(it.seller_name)} · ${(it.price / 100).toLocaleString('en-SZ', { style: 'currency', currency: 'SZL' })} / ${esc(it.unit)}</div>
              <div class="tag-row" style="margin-top:8px">
                <div class="qty-stepper">
                  <button type="button" data-cart-dec="${it.product_id}" aria-label="Decrease">−</button>
                  <input type="number" value="${it.qty}" min="${it.moq}" step="${it.step}" data-cart-qty="${it.product_id}" aria-label="Quantity">
                  <button type="button" data-cart-inc="${it.product_id}" aria-label="Increase">+</button>
                </div>
                <button class="btn btn-ghost btn-sm" data-cart-remove="${it.product_id}">Remove</button>
              </div>
            </div>
            <div style="text-align:right">
              <b class="mono">E${(it.line_total / 100).toFixed(2)}</b>
              <div class="tiny muted">${it.qty} × E${(it.price / 100).toFixed(2)}</div>
            </div>
          </div>`).join('') || `
          <div class="empty">
            <div class="empty-art"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg></div>
            <h3>Your cart is empty</h3><p>Browse today's deals — from a single jar to a whole pallet.</p>
            <a class="btn btn-dark" href="/shop">Start shopping</a>
          </div>`}
        </div>
        <div>
          <div class="summary-card" data-cart-summary>
            ${cart.count ? `
              <h3 style="font-size:16px;margin-bottom:14px">Order summary</h3>
              <div class="sum-row"><span>Subtotal (${cart.count} items)</span><span class="mono">E${(cart.subtotal / 100).toFixed(2)}</span></div>
              <div class="sum-row"><span>VAT</span><span class="tiny muted">Included</span></div>
              <div class="sum-row"><span>Delivery</span><span class="tiny muted">Calculated at checkout</span></div>
              <div class="sum-row total"><span>Subtotal</span><span class="mono">E${(cart.subtotal / 100).toFixed(2)}</span></div>
              <a class="btn btn-dark btn-block" href="/checkout" style="margin-top:16px">Checkout · E${(cart.subtotal / 100).toFixed(2)}</a>
              <p class="tiny muted" style="margin-top:12px;text-align:center">Delivery coordination from E45 · Mbabane base</p>` : ''}
          </div>
          ${deals.length ? `<div class="panel" style="margin-top:16px;padding:16px">
            <h4 style="font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Coupons you can use</h4>
            ${deals.map(d => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.5px">
              <div><b>${esc(d.code)}</b><div class="tiny muted">${esc(d.title)}</div></div>
              <button class="btn btn-ghost btn-sm" data-copy="${esc(d.code)}" style="align-self:center">Copy</button>
            </div>`).join('')}
            <a class="link-more" href="/coupons" style="margin-top:12px;font-size:13px">Watch videos to unlock more →</a>
          </div>` : ''}
        </div>
      </div>
    </div>`
  }));
});

/* ---------------- cart API ---------------- */
router.post('/api/cart', requireAuth, (req, res) => {
  const db = connect();
  const { product_id, qty = 1 } = req.body || {};
  const p = db.prepare("SELECT * FROM products WHERE id = ? AND status='active'").get(Number(product_id));
  if (!p) return res.status(404).json({ error: 'That listing is no longer available.' });
  const cart = readCart(req);
  const existing = cart.find(c => c.pid === p.id);
  if (existing) existing.qty = Math.max(p.moq, existing.qty + Math.max(1, Math.floor(Number(qty) || 1)));
  else cart.push({ pid: p.id, qty: Math.max(p.moq, Math.floor(Number(qty) || 1)) });
  const clipped = cart.find(c => c.pid === p.id);
  if (clipped.qty > p.stock) return res.status(400).json({ error: `Only ${p.stock} ${p.unit}${p.stock === 1 ? '' : 's'} available.` });
  writeCart(res, cart);
  const fresh = hydrate({ cookies: { alzy_cart: cartCookie.encode(cart) } });
  res.json({ ok: true, count: fresh.count, subtotal: fresh.subtotal, message: `${p.name} added to cart` });
});

router.patch('/api/cart/update', requireAuth, (req, res) => {
  const db = connect();
  const { product_id, qty } = req.body || {};
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(product_id));
  if (!p) return res.status(404).json({ error: 'Listing not found.' });
  const cart = readCart(req);
  const line = cart.find(c => c.pid === p.id);
  if (!line) return res.status(404).json({ error: 'That item is not in your cart.' });
  const nextQty = Math.max(p.moq, Math.floor(Number(qty) || p.moq));
  if (nextQty > p.stock) return res.status(400).json({ error: `Only ${p.stock} ${p.unit}${p.stock === 1 ? '' : 's'} available.` });
  line.qty = nextQty;
  writeCart(res, cart);
  const fresh = hydrate({ cookies: { alzy_cart: cartCookie.encode(cart) } });
  res.json({ ok: true, count: fresh.count, subtotal: fresh.subtotal });
});

router.delete('/api/cart', requireAuth, (req, res) => {
  const { product_id } = req.body || {};
  const cart = readCart(req).filter(c => c.pid !== Number(product_id));
  writeCart(res, cart);
  const fresh = hydrate({ cookies: { alzy_cart: cartCookie.encode(cart) } });
  res.json({ ok: true, count: fresh.count, subtotal: fresh.subtotal });
});

router.get('/api/cart', requireAuth, (req, res) => {
  res.json(hydrate(req));
});

module.exports = router;
module.exports.readCart = readCart;
module.exports.hydrate = hydrate;
