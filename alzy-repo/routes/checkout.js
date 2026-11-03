'use strict';
const express = require('express');
const { connect, transaction } = require('../db');
const { render, esc, money, shortMoney } = require('../lib/layout');
const { requireAuth, flash } = require('../middleware');
const { orderCode } = require('../lib/auth');
const { deliveryFee, commissionFor } = require('../lib/money');
const config = require('../lib/config');
const { hydrate } = require('./cart');
const Q = require('../lib/queries');

const router = express.Router();

/** Validate a coupon for a cart, returning discount + eligible seller/product scope. */
function validateCoupon(db, code, subtotal, userId, items) {
  const coupon = db.prepare("SELECT * FROM coupons WHERE upper(code) = upper(?) AND active = 1").get(String(code || '').trim());
  if (!coupon) return { error: 'That coupon code is not recognised.' };
  if (coupon.expires_at && new Date(coupon.expires_at + 'T23:59:59Z') < new Date()) return { error: 'That coupon has expired.' };
  if (coupon.uses >= coupon.max_uses) return { error: 'That coupon has been fully claimed.' };
  if (coupon.min_subtotal && subtotal < coupon.min_subtotal) {
    return { error: `This coupon needs a subtotal of at least ${money(coupon.min_subtotal)}.` };
  }
  // coupon must be earned (video coupons) or open promo
  if (coupon.kind === 'video' && userId) {
    const claim = db.prepare("SELECT * FROM coupon_claims WHERE coupon_id = ? AND user_id = ?").get(coupon.id, userId);
    if (!claim || claim.status === 'watching') return { error: 'Watch the full video on the coupon page to earn this coupon first.', needsWatch: true, couponId: coupon.id };
    if (claim.status === 'used') {
      const perUser = coupon.per_user || 1;
      const used = db.prepare("SELECT count(*) AS n FROM coupon_claims WHERE coupon_id = ? AND user_id = ? AND status = 'used'").get(coupon.id, userId).n;
      if (used >= perUser) return { error: 'You have already used this coupon.' };
    }
  }
  if (coupon.kind === 'promo' && userId) {
    const used = db.prepare("SELECT count(*) AS n FROM coupon_claims WHERE coupon_id = ? AND user_id = ? AND status = 'used'").get(coupon.id, userId).n;
    if (used >= (coupon.per_user || 1)) return { error: 'You have already used this coupon.' };
  }
  // eligible lines
  let eligible = items;
  if (coupon.product_id) eligible = items.filter(i => i.product_id === coupon.product_id);
  else if (coupon.seller_id) eligible = items.filter(i => i.seller_id === coupon.seller_id);
  const eligibleSubtotal = eligible.reduce((n, i) => n + i.line_total, 0);
  if (!eligible.length || eligibleSubtotal === 0) {
    return { error: 'This coupon does not apply to anything in your cart.' };
  }
  let discount = coupon.type === 'percent'
    ? Math.round(eligibleSubtotal * coupon.value / 100)
    : Math.min(coupon.value, eligibleSubtotal);
  if (coupon.type === 'percent' && coupon.value >= 100) discount = eligibleSubtotal;
  return { coupon, discount, eligibleIds: eligible.map(i => i.product_id), eligibleSubtotal };
}

router.get('/checkout', requireAuth, (req, res) => {
  const cart = hydrate(req);
  if (!cart.items.length) {
    flash(res, 'info', 'Your cart is empty — add something first.');
    return res.redirect('/cart');
  }
  const db = connect();
  const savedCoupons = Q.claimsForUser(req.user.id).filter(c => c.status !== 'watching');
  const fee = deliveryFee(req.user.region || 'Mbabane', cart.subtotal);
  const methods = config.paymentMethods;

  res.send(render({
    title: 'Checkout', user: req.user, seller: req.seller, cartCount: cart.count, currentPath: '/checkout',
    body: `
    <div class="wrap" style="padding-top:28px;padding-bottom:80px" data-checkout data-cart-subtotal="${cart.subtotal}" data-cart-fee="${fee}">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/cart">Cart</a><span>/</span><span>Checkout</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Checkout</h1><p class="lede" style="margin-top:6px">One order, ${new Set(cart.items.map(i => i.seller_id)).size} seller${new Set(cart.items.map(i => i.seller_id)).size > 1 ? 's' : ''}, one coordinated delivery.</p></div></div>

      <form id="checkoutForm" class="cart-shell" novalidate>
        <div style="display:grid;gap:18px">
          <div class="panel" style="padding:22px">
            <h3 style="font-size:16px;margin-bottom:16px">1 · Delivery details</h3>
            <div class="field-row">
              <div class="field"><label for="deliveryName">Recipient name</label><input id="deliveryName" name="delivery_name" value="${esc(req.user.name)}" required></div>
              <div class="field"><label for="deliveryPhone">Phone</label><input id="deliveryPhone" name="delivery_phone" value="${esc(req.user.phone || '')}" required placeholder="+268 76 123 456"></div>
            </div>
            <div class="field-row">
              <div class="field"><label for="deliveryRegion">Delivery region</label>
                <select id="deliveryRegion" name="delivery_region">
                  ${config.deliveryRegions.map(r => `<option value="${esc(r.name)}" ${r.name === (req.user.region || 'Mbabane') ? 'selected' : ''}>${esc(r.name)}${r.km ? ` · ${r.km} km` : ' · base'}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label for="deliveryAddress">Street address / plot</label><input id="deliveryAddress" name="delivery_address" required placeholder="Plot 42, Mbabane"></div>
            </div>
            <div class="field"><label for="notes">Order notes (optional)</label><textarea id="notes" name="notes" rows="2" placeholder="Delivery gate code, cold-chain requirements, invoice details…"></textarea></div>
          </div>

          <div class="panel" style="padding:22px">
            <h3 style="font-size:16px;margin-bottom:16px">2 · Payment method</h3>
            <div class="pay-options">
              ${methods.map((m, i) => `
                <label class="pay-option ${i === 0 ? 'is-selected' : ''}">
                  <input type="radio" name="payment_method" value="${m.id}" ${i === 0 ? 'checked' : ''}>
                  <span><b>${esc(m.label)}</b><span>${esc(m.hint)}</span></span>
                </label>`).join('')}
            </div>
            <div class="note" style="margin-top:14px">This is a demonstration marketplace — payments are simulated. No money moves and no card details are stored.</div>
          </div>

          <div class="panel" style="padding:22px">
            <h3 style="font-size:16px;margin-bottom:16px">3 · Review (${cart.count} items)</h3>
            ${cart.items.map(it => `
              <div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line-2)">
                <img src="/art/product/${encodeURIComponent(it.vessel)}/${encodeURIComponent(it.hue)}/${encodeURIComponent(it.icon)}?label=ALZY" alt="" width="46" height="46" style="border-radius:10px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:13.5px;font-weight:600">${esc(it.name)}</div>
                  <div class="tiny muted">${esc(it.seller_name)} · ${it.qty} × ${money(it.price)}</div>
                </div>
                <b class="mono small">${money(it.line_total)}</b>
              </div>`).join('')}
          </div>
        </div>

        <aside>
          <div class="summary-card">
            <h3 style="font-size:16px;margin-bottom:14px">Order summary</h3>
            <div class="sum-row"><span>Subtotal</span><span class="mono" data-subtotal>${money(cart.subtotal)}</span></div>
            <div class="sum-row discount"><span>Coupon discount</span><span class="mono" data-discount>−${money(0)}</span></div>
            <div class="sum-row"><span>Delivery coordination</span><span class="mono" data-fee>${money(fee)}</span></div>
            <div class="sum-row total"><span>Total</span><span class="mono" data-total>${money(cart.subtotal + fee)}</span></div>

            <div class="divider"></div>
            <label class="field" style="margin-bottom:8px"><span style="font-size:12.5px;font-weight:600">Coupon code</span></label>
            <div class="coupon-input">
              <input id="couponCode" placeholder="e.g. FARM15" autocomplete="off">
              <button class="btn btn-ghost btn-sm" type="button" id="applyCoupon">Apply</button>
            </div>
            <div class="applied-coupon" data-applied-coupon hidden></div>
            ${savedCoupons.length ? `<div style="margin-top:12px">
              <div class="tiny muted" style="margin-bottom:6px">Your earned coupons</div>
              <div class="tag-row">${savedCoupons.map(c => {
                const short = c.min_subtotal && cart.subtotal < c.min_subtotal;
                return `<button type="button" class="pill pill-soft${short ? ' is-locked' : ''}" data-use-coupon="${esc(c.code)}" data-min="${c.min_subtotal || 0}" style="border:0;cursor:pointer" title="${short ? `Spend ${money(c.min_subtotal)} or more to use this coupon` : 'Apply this coupon'}">${esc(c.code)} · ${c.type === 'percent' ? c.value + '%' : money(c.value)}${short ? ` · min ${shortMoney(c.min_subtotal)}` : ''}</button>`;
              }).join('')}</div>
            </div>` : `<div class="tiny muted" style="margin-top:10px"><a href="/coupons" style="color:var(--leaf);font-weight:600">Watch a video to unlock a coupon →</a></div>`}

            <button class="btn btn-dark btn-block" type="submit" id="placeOrderBtn" style="margin-top:18px">Place order securely</button>
            <p class="tiny muted" style="margin-top:12px;text-align:center">By ordering you agree to ALZY's marketplace terms. Sellers are paid after delivery is confirmed.</p>
          </div>
        </aside>
      </form>
    </div>
    <script src="/js/checkout-coupons.js" defer></script>`
  }));
});

/* ---------------- delivery fee quote ---------------- */
router.post('/api/delivery-fee', (req, res) => {
  const { region = 'Mbabane', subtotal = 0 } = req.body || {};
  const fee = deliveryFee(region, Number(subtotal) || 0);
  const r = config.deliveryRegions.find(x => x.name === region);
  res.json({ fee, km: r ? r.km : 50, region });
});

/* ---------------- coupon validation ---------------- */
router.post('/api/coupons/validate', requireAuth, (req, res) => {
  const db = connect();
  const cart = hydrate(req);
  const { code, subtotal } = req.body || {};
  if (!cart.items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  const result = validateCoupon(db, code, cart.subtotal, req.user.id, cart.items);
  if (result.error) return res.status(400).json({ error: result.error, needsWatch: !!result.needsWatch, couponId: result.couponId });
  res.json({ ok: true, code: result.coupon.code, title: result.coupon.title, discount: result.discount });
});

/* ---------------- place order ---------------- */
router.post('/api/orders', requireAuth, (req, res) => {
  const db = connect();
  const cart = hydrate(req);
  if (!cart.items.length) return res.status(400).json({ error: 'Your cart is empty.' });

  const b = req.body || {};
  const region = String(b.delivery_region || req.user.region || 'Mbabane').slice(0, 60);
  const address = String(b.delivery_address || '').trim().slice(0, 240);
  const phone = String(b.delivery_phone || '').trim().slice(0, 40);
  const name = String(b.delivery_name || req.user.name).trim().slice(0, 80);
  const method = config.paymentMethods.find(m => m.id === b.payment_method);
  if (!address) return res.status(400).json({ error: 'Please add a delivery address.' });
  if (!phone) return res.status(400).json({ error: 'Please add a contact phone number.' });
  if (!method) return res.status(400).json({ error: 'Choose a payment method.' });

  // stock check against live data
  for (const it of cart.items) {
    const live = db.prepare('SELECT stock, name, unit FROM products WHERE id = ?').get(it.product_id);
    if (!live || live.stock < it.qty) {
      return res.status(400).json({ error: `Stock changed: only ${live ? live.stock : 0} ${live ? live.unit : ''} of ${it.name} left. Please update your cart.` });
    }
  }

  let couponResult = null;
  let couponCodes = [];
  if (b.coupon_code) {
    couponResult = validateCoupon(db, b.coupon_code, cart.subtotal, req.user.id, cart.items);
    if (couponResult.error) return res.status(400).json({ error: couponResult.error });
    couponCodes = [couponResult.coupon.code];
  }

  const fee = deliveryFee(region, cart.subtotal);
  const discountTotal = couponResult ? couponResult.discount : 0;
  const total = cart.subtotal - discountTotal + fee;
  const commissionTotal = cart.items.reduce((n, i) => n + commissionFor(i.seller_plan, i.line_total), 0);

  let created;
  try {
    created = transaction(() => {
      const code = orderCode();
      const paymentStatus = method.id === 'cod' ? 'on_delivery' : 'paid';
      const orderStatus = method.id === 'cod' ? 'awaiting_payment' : 'paid';
      const info = db.prepare(`INSERT INTO orders
        (code,user_id,status,subtotal,discount_total,delivery_fee,commission_total,total,payment_method,payment_status,payment_ref,delivery_region,delivery_address,delivery_phone,notes,coupon_codes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        code, req.user.id, orderStatus, cart.subtotal, discountTotal, fee, commissionTotal, total,
        method.id, paymentStatus, 'REF-' + code, region, `${name} · ${address}`, phone,
        String(b.notes || '').slice(0, 500), couponCodes.length ? JSON.stringify(couponCodes) : null
      );
      const orderId = info.lastInsertRowid;

      // per-line discount allocation + commission
      const eligible = couponResult ? couponResult.eligibleIds : [];
      const eligibleSubtotal = couponResult ? couponResult.eligibleSubtotal : 0;
      for (const it of cart.items) {
        const share = eligible.includes(it.product_id) && eligibleSubtotal > 0
          ? Math.round(discountTotal * (it.line_total / eligibleSubtotal)) : 0;
        const commission = commissionFor(it.seller_plan, it.line_total - share);
        db.prepare(`INSERT INTO order_items (order_id,product_id,seller_id,name,unit,qty,unit_price,line_total,discount,commission,coupon_code,status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          orderId, it.product_id, it.seller_id, it.name, it.unit, it.qty, it.price, it.line_total,
          share, commission, couponResult ? couponResult.coupon.code : null, orderStatus === 'paid' ? 'processing' : 'paid'
        );
        db.prepare('UPDATE products SET stock = max(0, stock - ?) WHERE id = ?').run(it.qty, it.product_id);
        db.prepare("UPDATE sellers SET orders_count = orders_count + 1 WHERE id = ?").run(it.seller_id);
        db.prepare('INSERT INTO revenue_ledger (kind,ref_type,ref_id,seller_id,amount,note) VALUES (?,?,?,?,?,?)')
          .run('commission', 'order', orderId, it.seller_id, commission, `Commission — ${it.name}`);
      }

      db.prepare('INSERT INTO payments (order_id,user_id,method,amount,status,reference) VALUES (?,?,?,?,?,?)')
        .run(orderId, req.user.id, method.id, total, paymentStatus === 'paid' ? 'paid' : 'pending', 'REF-' + code);
      db.prepare('INSERT INTO logistics (order_id,region,km,fee,carrier,status,scheduled_for) VALUES (?,?,?,?,?,?,?)')
        .run(orderId, region, (config.deliveryRegions.find(r => r.name === region) || { km: 50 }).km, fee, 'ALZY Logistics', 'scheduled', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
      db.prepare('INSERT INTO revenue_ledger (kind,ref_type,ref_id,seller_id,amount,note) VALUES (?,?,?,?,?,?)')
        .run('logistics', 'order', orderId, null, fee, `Logistics coordination — ${region}`);

      // burn coupon
      if (couponResult) {
        const c = couponResult.coupon;
        db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').run(c.id);
        const claim = db.prepare('SELECT * FROM coupon_claims WHERE coupon_id = ? AND user_id = ?').get(c.id, req.user.id);
        if (claim) {
          db.prepare("UPDATE coupon_claims SET status = 'used', used_at = datetime('now'), order_id = ? WHERE id = ?").run(orderId, claim.id);
        } else {
          db.prepare("INSERT INTO coupon_claims (coupon_id,user_id,status,earned_at,used_at,order_id) VALUES (?,?,'used',datetime('now'),datetime('now'),?)").run(c.id, req.user.id, orderId);
        }
      }

      // clear cart
      res.cookie('alzy_cart', '[]', { maxAge: 1000, path: '/' });
      return { orderId, code };
    });
  } catch (err) {
    console.error('[ALZY order]', err);
    return res.status(500).json({ error: 'We could not place that order. Please try again.' });
  }

  res.json({ ok: true, order: { id: created.orderId, code: created.code }, redirect: `/orders/${created.code}?new=1` });
});

module.exports = router;
module.exports.validateCoupon = validateCoupon;
