'use strict';
const express = require('express');
const { connect } = require('../db');
const { render, esc, money, dateFmt, productCard, stars } = require('../lib/layout');
const { requireAuth, flash } = require('../middleware');
const Q = require('../lib/queries');
const config = require('../lib/config');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

const dashNav = (active) => `
  <nav class="dash-nav">
    <a href="/account" class="${active === 'overview' ? 'is-active' : ''}">Overview</a>
    <a href="/account/orders" class="${active === 'orders' ? 'is-active' : ''}">Orders &amp; invoices</a>
    <a href="/account/coupons" class="${active === 'coupons' ? 'is-active' : ''}">My coupons</a>
    <a href="/account/favorites" class="${active === 'favorites' ? 'is-active' : ''}">Saved products</a>
    <a href="/account/brand" class="${active === 'brand' ? 'is-active' : ''}">Brand projects</a>
    <a href="/account/settings" class="${active === 'settings' ? 'is-active' : ''}">Settings</a>
    ${req_dashSeller(active)}
  </nav>`;
function req_dashSeller() { return ''; }

router.get('/account', requireAuth, (req, res) => {
  const db = connect();
  const orders = Q.ordersForUser(req.user.id);
  const spent = orders.filter(o => o.status !== 'cancelled').reduce((n, o) => n + o.total, 0);
  const claims = Q.claimsForUser(req.user.id);
  const favCount = db.prepare('SELECT count(*) AS n FROM favorites WHERE user_id = ?').get(req.user.id).n;
  const brandCount = db.prepare('SELECT count(*) AS n FROM brand_projects WHERE user_id = ?').get(req.user.id).n;
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const flashMsg = res.locals.flash;

  res.send(view(req, res, {
    title: 'My account',
    body: `
    ${flashMsg ? `<div class="flash flash-${esc(flashMsg.type)}" role="status">${esc(flashMsg.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div>
        <p class="eyebrow">My account</p>
        <h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Sawubona, ${esc(req.user.name.split(' ')[0])}.</h1>
        <p class="lede" style="margin-top:6px">${esc(req.user.email)} · ${esc(req.user.region || 'Eswatini')} · ${esc(req.user.role)}</p>
      </div><div class="btn-row"><a class="btn btn-dark" href="/shop">Shop the market</a>${req.seller ? '<a class="btn btn-ghost" href="/seller">Seller dashboard</a>' : '<a class="btn btn-ghost" href="/sell">Start selling</a>'}</div></div>

      <div class="kpi-grid">
        <div class="kpi"><span>Orders placed</span><b>${orders.length}</b><small>${activeOrders.length} in progress</small></div>
        <div class="kpi"><span>Total spent</span><b>${money(spent)}</b><small>incl. delivery</small></div>
        <div class="kpi"><span>Coupons</span><b>${claims.filter(c => c.status !== 'watching').length}</b><small>${claims.filter(c => c.status === 'watching').length} in progress</small></div>
        <div class="kpi"><span>Saved items</span><b>${favCount}</b><small>${brandCount} brand projects</small></div>
      </div>

      <div class="dash">
        ${dashNav('overview')}
        <div style="display:grid;gap:18px;min-width:0">
          <div class="panel">
            <div class="panel-head"><h3>Recent orders</h3><a class="link-more" href="/account/orders" style="font-size:13px">All orders →</a></div>
            ${orders.length ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Order</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>${orders.slice(0, 5).map(o => `<tr>
                <td><b>${esc(o.code)}</b></td><td>${dateFmt(o.created_at)}</td><td>${o.item_count}</td>
                <td class="num">${money(o.total)}</td>
                <td><span class="status status-${esc(o.status)}">${esc(o.status.replace('_', ' '))}</span></td>
                <td><a class="btn btn-ghost btn-sm" href="/orders/${encodeURIComponent(o.code)}">View</a></td>
              </tr>`).join('')}</tbody>
            </table></div>` : `<div class="panel-body"><p class="small muted">No orders yet. <a href="/shop" style="color:var(--leaf);font-weight:600">Start shopping →</a></p></div>`}
          </div>

          ${claims.length ? `<div class="panel">
            <div class="panel-head"><h3>Coupons ready</h3><a class="link-more" href="/account/coupons" style="font-size:13px">Manage →</a></div>
            <div class="panel-body" style="display:grid;gap:10px">
              ${claims.slice(0, 3).map(c => `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
                <div><b style="font-size:13.5px">${esc(c.title)}</b><div class="tiny muted">${c.status === 'earned' ? `Ready · min ${money(c.min_subtotal)}` : esc(c.status)}</div></div>
                <div style="display:flex;gap:6px;align-items:center"><span class="coupon-code" style="padding:5px 9px;font-size:11px">${esc(c.code)}</span><button class="btn btn-ghost btn-sm" data-copy="${esc(c.code)}">Copy</button></div>
              </div>`).join('')}
            </div>
          </div>` : ''}

          <div class="panel" style="padding:22px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap">
            <div><b style="font-size:15px">Start your own food brand</b><p class="small muted" style="margin-top:4px;max-width:52ch">ALZY Brand Studio designs, prints and fills own-brand packaging — from 500-jar honey runs to hot sauce launches.</p></div>
            <a class="btn btn-dark" href="/brand-studio">Open Brand Studio</a>
          </div>
        </div>
      </div>
    </div>`
  }));
});

router.get('/account/orders', requireAuth, (req, res) => {
  const orders = Q.ordersForUser(req.user.id);
  res.send(view(req, res, {
    title: 'My orders',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Orders</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Orders &amp; invoices</h1><p class="lede" style="margin-top:6px">${orders.length} order${orders.length === 1 ? '' : 's'} · every order includes a VAT-style invoice.</p></div></div>
      <div class="dash">${dashNav('orders')}
        <div class="panel" style="min-width:0">
          ${orders.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Order</th><th>Placed</th><th>Region</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
            <tbody>${orders.map(o => `<tr>
              <td><b>${esc(o.code)}</b><div class="tiny muted">${o.item_count} items</div></td>
              <td>${dateFmt(o.created_at)}</td><td>${esc(o.delivery_region)}</td>
              <td class="num">${money(o.total)}</td>
              <td><span class="status status-${esc(o.payment_status === 'on_delivery' ? 'pending' : o.payment_status)}">${esc(o.payment_status.replace('_', ' '))}</span></td>
              <td><span class="status status-${esc(o.status)}">${esc(o.status.replace('_', ' '))}</span></td>
              <td><a class="btn btn-ghost btn-sm" href="/orders/${encodeURIComponent(o.code)}">View</a></td>
            </tr>`).join('')}</tbody>
          </table></div>` : `<div class="panel-body"><p class="small muted">No orders yet.</p></div>`}
        </div>
      </div>
    </div>`
  }));
});

router.get('/orders/:code', requireAuth, (req, res) => {
  const order = Q.orderByCode(req.params.code, req.user.id);
  if (!order) return res.status(404).send(render({ title: 'Order not found', user: req.user, body: '<div class="wrap section"><h1>Order not found</h1><p class="lede">We could not find that order on your account.</p></div>' }));
  const isNew = req.query.new === '1';
  const steps = [
    { key: 'paid', label: 'Order placed', detail: 'We received your order and notified the sellers.' },
    { key: 'processing', label: 'Packing & grading', detail: 'Sellers are packing your items and confirming grades.' },
    { key: 'dispatched', label: 'Out for delivery', detail: 'ALZY logistics has collected the goods.' },
    { key: 'delivered', label: 'Delivered', detail: 'Confirm quality within 24 hours to release payment.' }
  ];
  const rank = { awaiting_payment: 0, paid: 0, processing: 1, dispatched: 2, delivered: 3, cancelled: -1 };
  const current = rank[order.status] ?? 0;

  res.send(view(req, res, {
    title: `Order ${order.code}`,
    body: `
    ${isNew ? `<div class="flash flash-success" role="status">Order confirmed — ${esc(order.code)}. Your sellers have been notified.<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <div class="wrap" style="padding:24px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account/orders">Orders</a><span>/</span><span>${esc(order.code)}</span></nav>
      <div class="section-head">
        <div>
          <h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Order ${esc(order.code)}</h1>
          <p class="lede" style="margin-top:6px">Placed ${dateFmt(order.created_at)} · ${esc(order.delivery_region)} · ${esc(order.payment_method)}</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="window.print()">Print invoice</button>
          ${order.status === 'delivered' ? '' : `<form method="post" action="/orders/${encodeURIComponent(order.code)}/cancel"><button class="btn btn-danger" type="submit">Cancel order</button></form>`}
        </div>
      </div>

      <div class="cart-shell">
        <div style="display:grid;gap:18px">
          <div class="panel" style="padding:22px">
            <h3 style="font-size:15px;margin-bottom:18px">Tracking</h3>
            <div class="timeline">
              ${steps.map((s, i) => `
                <div class="tl-item ${i < current ? 'done' : i === current ? 'current' : ''}">
                  <div><div class="tl-dot"></div>${i < steps.length - 1 ? '<div class="tl-line"></div>' : ''}</div>
                  <div class="tl-body"><b>${s.label}</b><span>${s.detail}</span></div>
                </div>`).join('')}
            </div>
            ${order.logistics ? `<div class="note" style="margin-top:6px">Carrier: <b style="color:var(--ink)">${esc(order.logistics.carrier)}</b> · ${esc(order.logistics.region)} · ${order.logistics.km} km · coordination fee ${money(order.logistics.fee)}${order.logistics.scheduled_for ? ` · scheduled ${dateFmt(order.logistics.scheduled_for)}` : ''}</div>` : ''}
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Items (${order.items.length})</h3><span class="small muted">${new Set(order.items.map(i => i.seller_id)).size} seller(s)</span></div>
            <div class="panel-body" style="display:grid;gap:14px">
              ${order.items.map(it => `
                <div style="display:flex;gap:12px;align-items:center">
                  <img src="/art/product/${encodeURIComponent(it.vessel || 'crate')}/${encodeURIComponent(it.hue || 'green')}/${encodeURIComponent(it.icon || 'leaf')}?label=ALZY" alt="" width="54" height="54" style="border-radius:12px;flex:0 0 54px">
                  <div style="flex:1;min-width:0">
                    <a href="/product/${encodeURIComponent(it.slug || '')}" style="font-size:13.5px;font-weight:600">${esc(it.name)}</a>
                    <div class="tiny muted">${esc(it.seller_name || '')} · ${it.qty} × ${money(it.unit_price)} per ${esc(it.unit)}</div>
                    ${it.discount ? `<div class="tiny" style="color:var(--leaf);font-weight:600">Coupon saved ${money(it.discount)}</div>` : ''}
                  </div>
                  <b class="mono small">${money(it.line_total - it.discount)}</b>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <aside>
          <div class="summary-card">
            <h3 style="font-size:16px;margin-bottom:14px">Invoice</h3>
            <div class="sum-row"><span>Subtotal</span><span class="mono">${money(order.subtotal)}</span></div>
            ${order.discount_total ? `<div class="sum-row discount"><span>Coupons ${order.coupon_codes ? esc(JSON.parse(order.coupon_codes).join(', ')) : ''}</span><span class="mono">−${money(order.discount_total)}</span></div>` : ''}
            <div class="sum-row"><span>Delivery coordination</span><span class="mono">${money(order.delivery_fee)}</span></div>
            <div class="sum-row total"><span>Total</span><span class="mono">${money(order.total)}</span></div>
            <div class="divider"></div>
            <table class="spec-table">
              <tr><td>Payment method</td><td>${esc(order.payment_method)}</td></tr>
              <tr><td>Payment status</td><td>${esc(order.payment_status.replace('_', ' '))}</td></tr>
              <tr><td>Reference</td><td>${esc(order.payment_ref || '—')}</td></tr>
              <tr><td>Deliver to</td><td style="max-width:200px">${esc(order.delivery_address)}</td></tr>
              <tr><td>Phone</td><td>${esc(order.delivery_phone || '—')}</td></tr>
              <tr><td>Marketplace commission</td><td>${money(order.commission_total)}</td></tr>
            </table>
            <a class="btn btn-ghost btn-block" href="/account/orders" style="margin-top:14px">Back to orders</a>
          </div>
        </aside>
      </div>
    </div>`
  }));
});

router.post('/orders/:code/cancel', requireAuth, (req, res) => {
  const db = connect();
  const order = db.prepare('SELECT * FROM orders WHERE code = ? AND user_id = ?').get(req.params.code, req.user.id);
  if (!order) { flash(res, 'error', 'Order not found.'); return res.redirect('/account/orders'); }
  if (['dispatched', 'delivered'].includes(order.status)) { flash(res, 'error', 'This order has already been dispatched and cannot be cancelled online. Please contact support.'); return res.redirect('/orders/' + order.code); }
  db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id = ?").run(order.id);
  db.prepare("UPDATE order_items SET status='cancelled' WHERE order_id = ?").run(order.id);
  for (const it of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)) {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.qty, it.product_id);
  }
  db.prepare("UPDATE logistics SET status='scheduled' WHERE order_id = ?").run(order.id);
  db.prepare("UPDATE orders SET payment_status = CASE WHEN payment_status='paid' THEN 'refunded' ELSE payment_status END WHERE id = ?").run(order.id);
  flash(res, 'success', `Order ${order.code} cancelled. Any payment will be refunded to the original method.`);
  res.redirect('/orders/' + order.code);
});

/* ---------------- favorites ---------------- */
router.get('/account/favorites', requireAuth, (req, res) => {
  const db = connect();
  const rows = db.prepare('SELECT product_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const items = rows.length ? Q.productList({ ids: rows.map(r => r.product_id), limit: 60 }).items : [];
  res.send(view(req, res, {
    title: 'Saved products',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Saved</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Saved products</h1><p class="lede" style="margin-top:6px">${items.length} item${items.length === 1 ? '' : 's'} you are watching.</p></div></div>
      <div class="dash">${dashNav('favorites')}
        <div>${items.length ? `<div class="grid cols-3">${items.map(p => productCard(p)).join('')}</div>` :
          `<div class="empty"><div class="empty-art">♥</div><h3>Nothing saved yet</h3><p>Tap the heart on any listing to keep an eye on price and stock.</p><a class="btn btn-dark" href="/shop">Browse the market</a></div>`}</div>
      </div>
    </div>`
  }));
});

router.post('/api/favorites', requireAuth, (req, res) => {
  const db = connect();
  const pid = Number((req.body || {}).product_id);
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(pid);
  if (!p) return res.status(404).json({ error: 'Listing not found.' });
  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, pid);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.id, pid);
    return res.json({ ok: true, favorited: false });
  }
  db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?,?)').run(req.user.id, pid);
  res.json({ ok: true, favorited: true });
});

/* ---------------- settings ---------------- */
router.get('/account/settings', requireAuth, (req, res) => {
  res.send(view(req, res, {
    title: 'Account settings',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Settings</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Settings</h1></div></div>
      <div class="dash">${dashNav('settings')}
        <div style="display:grid;gap:18px;max-width:560px">
          <form class="panel" style="padding:22px" method="post" action="/account/settings">
            <h3 style="font-size:15px;margin-bottom:16px">Profile</h3>
            <div class="field"><label for="name">Name</label><input id="name" name="name" value="${esc(req.user.name)}" required></div>
            <div class="field-row">
              <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value="${esc(req.user.phone || '')}"></div>
              <div class="field"><label for="region">Region</label>
                <select id="region" name="region">${config.deliveryRegions.map(r => `<option ${r.name === req.user.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}<option ${req.user.region === 'Other' ? 'selected' : ''}>Other</option></select>
              </div>
            </div>
            <div class="field"><label>Email</label><input value="${esc(req.user.email)}" disabled></div>
            <button class="btn btn-dark" type="submit">Save changes</button>
          </form>
          <div class="panel" style="padding:22px">
            <h3 style="font-size:15px;margin-bottom:10px">Account</h3>
            <p class="small muted">Role: <b style="color:var(--ink)">${esc(req.user.role)}</b></p>
            <p class="small muted" style="margin-top:6px">Seller store: ${req.seller ? `<a href="/seller" style="color:var(--leaf);font-weight:600">${esc(req.seller.name)}</a>` : `<a href="/sell" style="color:var(--leaf);font-weight:600">Become a seller</a>`}</p>
            <form method="post" action="/logout" style="margin-top:16px"><button class="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </div>
        </div>
      </div>
    </div>`
  }));
});

router.post('/account/settings', requireAuth, (req, res) => {
  const { name, phone, region } = req.body || {};
  if (!name || !String(name).trim()) { flash(res, 'error', 'Name cannot be empty.'); return res.redirect('/account/settings'); }
  connect().prepare('UPDATE users SET name=?, phone=?, region=? WHERE id=?')
    .run(String(name).trim().slice(0, 80), String(phone || '').slice(0, 40), String(region || '').slice(0, 60), req.user.id);
  flash(res, 'success', 'Profile updated.');
  res.redirect('/account/settings');
});

/* ---------------- brand studio ---------------- */
router.get('/brand-studio', (req, res) => {
  const db = connect();
  const projects = req.user ? db.prepare('SELECT * FROM brand_projects WHERE user_id = ? ORDER BY id DESC').all(req.user.id) : [];
  const vessels = [
    { id: 'bottle', label: 'Glass bottle', desc: 'Sauces, juices, oils — 250ml to 1L' },
    { id: 'jar', label: 'Glass jar', desc: 'Honey, jam, spices, pickles' },
    { id: 'pouch', label: 'Stand-up pouch', desc: 'Spices, grains, coffee, snacks' },
    { id: 'bag', label: 'Kraft bag', desc: 'Flour, meal, dry goods' },
    { id: 'box', label: 'Carton box', desc: 'Retail multipacks & gift sets' }
  ];
  res.send(view(req, res, {
    title: 'ALZY Brand Studio — launch your own food brand',
    body: `
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Brand Studio</span></nav>
        <div class="split" style="margin-top:10px">
          <div>
            <p class="eyebrow">ALZY Brand Studio</p>
            <h1 class="hero-title" style="font-size:clamp(32px,4.4vw,54px);max-width:20ch">Your name.<br>Your label.<br><em>Our supply chain.</em></h1>
            <p class="lede">Most farmers and food entrepreneurs lose margin selling someone else's brand. ALZY Brand Studio designs your label, sources the glass, plastic or pouches, fills and seals your product — then lists it on ALZY under your name.</p>
            <div class="feature-list">
              <div class="feature-item"><span class="fi-ico">1</span><div><h4>Pick your vessel</h4><p>Bottle, jar, pouch, bag or box — from 300 units.</p></div></div>
              <div class="feature-item"><span class="fi-ico">2</span><div><h4>We design &amp; print</h4><p>Label artwork, print and compliance text included.</p></div></div>
              <div class="feature-item"><span class="fi-ico">3</span><div><h4>We fill &amp; deliver</h4><p>Co-packed at a certified kitchen, then listed on ALZY.</p></div></div>
            </div>
            <div class="stats-band" style="grid-template-columns:repeat(3,1fr);margin-top:28px">
              <div class="stat-card"><b>E2,500</b><span>setup fee</span></div>
              <div class="stat-card"><b>E1.80</b><span>per filled unit</span></div>
              <div class="stat-card"><b>300</b><span>minimum units</span></div>
            </div>
          </div>
          <div class="panel" style="padding:26px">
            <h3 style="font-size:17px;margin-bottom:4px">Start a brand project</h3>
            <p class="small muted" style="margin-bottom:18px">We reply with a quote within 2 working days.</p>
            ${req.user ? `
            <form method="post" action="/brand-studio">
              <div class="field"><label for="brand_name">Brand name</label><input id="brand_name" name="brand_name" required placeholder="e.g. Thandi's Kitchen"></div>
              <div class="field-row">
                <div class="field"><label for="product_type">Product</label><input id="product_type" name="product_type" placeholder="Hot sauce, honey, spices…" required></div>
                <div class="field"><label for="quantity">Units</label><input id="quantity" name="quantity" type="number" min="300" step="50" value="500"></div>
              </div>
              <div class="field"><label for="vessel">Packaging</label>
                <select id="vessel" name="vessel">${vessels.map(v => `<option value="${v.id}">${v.label} — ${v.desc}</option>`).join('')}</select>
              </div>
              <div class="field"><label for="colorway">Colour direction</label><input id="colorway" name="colorway" placeholder="Deep red & cream, minimal…"></div>
              <div class="field"><label for="notes">Anything else?</label><textarea id="notes" name="notes" rows="3" placeholder="Where you sell, certifications, timelines…"></textarea></div>
              <button class="btn btn-dark btn-block" type="submit">Request a quote</button>
            </form>` : `
            <div class="empty" style="padding:32px 16px">
              <h3>Sign in to start</h3><p>Brand projects are saved to your ALZY account.</p>
              <a class="btn btn-dark" href="/login?next=/brand-studio">Sign in or join free</a>
            </div>`}
          </div>
        </div>

        ${projects.length ? `<section class="section tight" style="padding-bottom:0"><div class="section-head"><div><h2 style="font-size:26px">Your brand projects</h2></div></div>
          <div class="grid cols-3">${projects.map(p => `
            <div class="panel" style="padding:20px">
              <div class="tag-row"><span class="pill pill-soft">${esc(p.status)}</span><span class="pill pill-quiet">${esc(p.quantity)} units</span></div>
              <h3 style="font-size:17px;margin:10px 0 4px">${esc(p.brand_name)}</h3>
              <p class="small muted">${esc(p.product_type || '')} · ${esc(p.vessel || 'bottle')} packaging</p>
              <table class="spec-table" style="margin-top:10px">
                <tr><td>Setup</td><td>${money(p.setup_fee)}</td></tr>
                <tr><td>Per unit</td><td>${money(p.unit_price)}</td></tr>
                <tr><td>Estimate</td><td>${money(p.setup_fee + p.unit_price * p.quantity)}</td></tr>
              </table>
            </div>`).join('')}</div></section>` : ''}
      </div>
    </section>`
  }));
});

router.post('/brand-studio', requireAuth, (req, res) => {
  const { brand_name, product_type, quantity, vessel, colorway, notes } = req.body || {};
  if (!brand_name || !String(brand_name).trim()) { flash(res, 'error', 'Please give your brand a name.'); return res.redirect('/brand-studio'); }
  const db = connect();
  const qty = Math.max(300, Number(quantity) || 500);
  const info = db.prepare(`INSERT INTO brand_projects (user_id,brand_name,product_type,vessel,colorway,quantity,unit_price,setup_fee,notes,status)
    VALUES (?,?,?,?,?,?,?,?,?,'brief')`).run(req.user.id, String(brand_name).trim().slice(0, 60), String(product_type || '').slice(0, 60),
    String(vessel || 'bottle').slice(0, 20), String(colorway || '').slice(0, 60), qty, config.revenue.brandStudio.perUnit, config.revenue.brandStudio.setup, String(notes || '').slice(0, 500));
  db.prepare("INSERT INTO revenue_ledger (kind,ref_type,ref_id,amount,note) VALUES ('brand','project',?,0,?)")
    .run(info.lastInsertRowid, `Brand Studio brief — ${String(brand_name).trim().slice(0, 60)}`);
  flash(res, 'success', 'Brand project started — we will send a quote within 2 working days.');
  res.redirect('/brand-studio');
});

router.get('/account/brand', requireAuth, (req, res) => {
  const projects = connect().prepare('SELECT * FROM brand_projects WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.send(view(req, res, {
    title: 'My brand projects',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Brand projects</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">Brand projects</h1><p class="lede" style="margin-top:6px">Own-brand packaging from ALZY Brand Studio.</p></div><a class="btn btn-dark" href="/brand-studio">New project</a></div>
      <div class="dash">${dashNav('brand')}
        <div>${projects.length ? `<div class="grid cols-3">${projects.map(p => `
          <div class="panel" style="padding:20px">
            <div class="tag-row"><span class="pill pill-soft">${esc(p.status)}</span><span class="pill pill-quiet">${esc(p.quantity)} units</span></div>
            <h3 style="font-size:17px;margin:10px 0 4px">${esc(p.brand_name)}</h3>
            <p class="small muted">${esc(p.product_type || '')} · ${esc(p.vessel || 'bottle')}</p>
            <table class="spec-table" style="margin-top:10px">
              <tr><td>Per unit</td><td>${money(p.unit_price)}</td></tr>
              <tr><td>Estimate</td><td>${money(p.setup_fee + p.unit_price * p.quantity)}</td></tr>
              <tr><td>Requested</td><td>${dateFmt(p.created_at)}</td></tr>
            </table>
          </div>`).join('')}</div>` : `<div class="empty"><h3>No brand projects yet</h3><p>Launch your own labelled product with ALZY Brand Studio.</p><a class="btn btn-dark" href="/brand-studio">Start a project</a></div>`}</div>
      </div>
    </div>`
  }));
});

/* ---------------- become a seller ---------------- */
router.get('/sell', (req, res) => {
  res.send(view(req, res, {
    title: 'Sell on ALZY — reach the whole country',
    body: `
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Sell on ALZY</span></nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">Sell on ALZY</p>
            <h1 class="hero-title" style="font-size:clamp(34px,5vw,64px)">Your harvest.<br>The whole country.</h1>
            <p class="lede">Farmers, processors, packaging suppliers and agricultural suppliers — list produce, quantities, prices and harvest dates. Reach supermarkets, restaurants, wholesalers and families in one place.</p>
          </div>
          <div class="btn-row">
            <a class="btn btn-dark btn-lg" href="${req.user ? '/seller' : '/register'}">${req.user ? 'Open seller dashboard' : 'Create seller account'}</a>
          </div>
        </div>

        <div class="stats-band" style="margin-bottom:44px">
          <div class="stat-card"><b>E0</b><span>listing fees — ever</span></div>
          <div class="stat-card"><b>4%</b><span>commission on Pro</span></div>
          <div class="stat-card"><b>E150</b><span>7-day featured listing</span></div>
          <div class="stat-card"><b>Weekly</b><span>payouts via MoMo or EFT</span></div>
        </div>

        <div class="section-head" id="plans"><div><h2>Supplier subscriptions</h2><p class="lede" style="margin-top:6px">Start free. Upgrade when volume makes it worthwhile — lower commission pays for itself fast.</p></div></div>
        <div class="price-grid">
          ${Object.entries(config.revenue.subscriptions).map(([key, plan], i) => `
            <div class="price-card ${key === 'growth' ? 'popular' : ''}">
              <div><h3>${plan.label}</h3><p class="small muted">${key === 'free' ? 'For new growers testing the market' : key === 'growth' ? 'For regular weekly supply' : 'For wholesalers & processors'}</p></div>
              <div class="price-amount">${plan.price === 0 ? 'E0' : money(plan.price)}<small> /month</small></div>
              <div class="kpi" style="padding:12px 14px"><span>Commission</span><b style="font-size:20px">${Math.round(plan.commission * 100)}%</b></div>
              <ul class="price-feats">${plan.features.map(f => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>${esc(f)}</li>`).join('')}</ul>
              <a class="btn ${key === 'growth' ? 'btn-dark' : 'btn-ghost'} btn-block" href="${req.user ? '/seller/subscription' : '/register'}" style="margin-top:auto">${key === 'free' ? 'Start free' : 'Choose ' + plan.label}</a>
            </div>`).join('')}
        </div>

        <div class="section-head" id="featured" style="margin-top:64px"><div><h2>Featured listings</h2><p class="lede" style="margin-top:6px">E150 buys seven days at the top of the homepage, department pages and search results.</p></div></div>
        <div class="panel" style="padding:26px;display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:center">
          <div>
            <h3 style="font-size:20px;margin-bottom:8px">Get seen first</h3>
            <p class="small muted" style="line-height:1.65">Featured listings carry a gold badge and appear in the “Promoted by our sellers” rail on the homepage, plus priority in search. Ideal for harvest season launches, seasonal fruit or new packaging lines.</p>
            <div class="btn-row" style="margin-top:18px"><a class="btn btn-dark" href="${req.user ? '/seller/featured' : '/register'}">Feature a listing — E150</a></div>
          </div>
          <div class="panel" style="padding:18px;background:var(--paper-2)">
            <div class="tag-row"><span class="pill pill-featured">Featured</span><span class="pill pill-quiet">7 days</span></div>
            <b style="display:block;margin-top:12px;font-size:16px">What you get</b>
            <div class="price-feats" style="margin-top:8px">
              <li style="display:flex;gap:8px;font-size:13px;list-style:none"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--leaf)" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>Homepage promoted rail</li>
              <li style="display:flex;gap:8px;font-size:13px;list-style:none"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--leaf)" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>Priority search placement</li>
              <li style="display:flex;gap:8px;font-size:13px;list-style:none"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--leaf)" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>Gold “Featured” badge on the card</li>
              <li style="display:flex;gap:8px;font-size:13px;list-style:none"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--leaf)" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>Included in the featured coupon rail</li>
            </div>
          </div>
        </div>

        <div class="section-head" style="margin-top:64px"><div><h2>How selling works</h2></div></div>
        <div class="grid cols-4">
          ${[['1 · List', 'Add produce, quantity, price per unit and your next harvest date. Bulk and single-unit listings both supported.'],
             ['2 · Get orders', 'Buyers order in cartons or single units. You see every order in the seller dashboard.'],
             ['3 · Pack & hand over', 'Pack to grade. ALZY logistics collects, or the buyer collects from you — free.'],
             ['4 · Get paid', 'Weekly payouts by MoMo Business or EFT, minus commission and coordination fees.']]
            .map(([t, d]) => `<div class="panel" style="padding:22px"><b style="font-size:15px">${t}</b><p class="small muted" style="margin-top:8px;line-height:1.6">${d}</p></div>`).join('')}
        </div>
      </div>
    </section>`
  }));
});

module.exports = router;
