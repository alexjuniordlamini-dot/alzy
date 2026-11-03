'use strict';
const express = require('express');
const { connect } = require('../db');
const { render, esc, money, dateFmt, shortMoney } = require('../lib/layout');
const { requireSeller, flash } = require('../middleware');
const config = require('../lib/config');
const { commissionFor } = require('../lib/money');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

const sellerNav = (active) => `
  <nav class="dash-nav">
    <a href="/seller" class="${active === 'overview' ? 'is-active' : ''}">Overview</a>
    <a href="/seller/products" class="${active === 'products' ? 'is-active' : ''}">My listings</a>
    <a href="/seller/orders" class="${active === 'orders' ? 'is-active' : ''}">Orders</a>
    <a href="/seller/subscription" class="${active === 'subscription' ? 'is-active' : ''}">Subscription</a>
    <a href="/seller/featured" class="${active === 'featured' ? 'is-active' : ''}">Featured listings</a>
    <a href="/seller/messages" class="${active === 'messages' ? 'is-active' : ''}">Messages</a>
  </nav>`;

function guard(req, res, next) {
  if (!req.seller && req.user && req.user.role !== 'admin') {
    flash(res, 'info', 'Create your seller storefront to access the seller dashboard.');
    return res.redirect('/sell');
  }
  if (!req.seller && req.user && req.user.role === 'admin') {
    const s = connect().prepare('SELECT * FROM sellers ORDER BY id LIMIT 1').get();
    req.seller = s;
  }
  next();
}

router.use('/seller', requireSeller, guard);

/* ---------------- overview ---------------- */
router.get('/seller', (req, res) => {
  const db = connect();
  const s = req.seller;
  const stats = db.prepare(`
    SELECT coalesce(sum(oi.line_total),0) AS gmv, coalesce(sum(oi.commission),0) AS commission,
           count(DISTINCT oi.order_id) AS orders, coalesce(sum(oi.qty),0) AS units
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ? AND o.status != 'cancelled'`).get(s.id);
  const openOrders = db.prepare(`
    SELECT count(DISTINCT o.id) AS n FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.seller_id = ? AND o.status IN ('paid','processing')`).get(s.id).n;
  const products = db.prepare('SELECT count(*) AS n, sum(CASE WHEN featured=1 THEN 1 ELSE 0 END) AS featured FROM products WHERE seller_id = ?').get(s.id);
  const recent = db.prepare(`
    SELECT o.code, o.status, o.created_at, oi.name, oi.qty, oi.unit, oi.line_total
    FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = ?
    ORDER BY o.id DESC LIMIT 8`).all(s.id);
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', o.created_at) AS month, coalesce(sum(oi.line_total),0) AS total
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ? AND o.status != 'cancelled'
    GROUP BY month ORDER BY month DESC LIMIT 6`).all(s.id).reverse();
  const maxMonth = Math.max(1, ...monthly.map(m => m.total));
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE seller_id = ? AND status='active' ORDER BY id DESC LIMIT 1").get(s.id);
  const netPayout = stats.gmv - stats.commission;

  res.send(view(req, res, {
    title: `${s.name} — seller dashboard`,
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div>
        <p class="eyebrow">Seller dashboard</p>
        <h1 class="page-title" style="font-size:clamp(28px,4vw,42px)">${esc(s.name)}</h1>
        <p class="lede" style="margin-top:6px">${esc(config.revenue.subscriptions[s.plan].label)} plan · ${Math.round(config.revenue.subscriptions[s.plan].commission * 100)}% commission · ${esc(s.region)}</p>
      </div><a class="btn btn-dark" href="/seller/products/new">+ New listing</a></div>

      <div class="kpi-grid">
        <div class="kpi"><span>Gross sales</span><b>${money(stats.gmv)}</b><small>${stats.orders} orders</small></div>
        <div class="kpi"><span>ALZY commission</span><b>${money(stats.commission)}</b><small>${stats.gmv ? Math.round(stats.commission / stats.gmv * 100) : 0}% effective</small></div>
        <div class="kpi"><span>Net payout</span><b>${money(netPayout)}</b><small>weekly MoMo / EFT</small></div>
        <div class="kpi"><span>Open orders</span><b>${openOrders}</b><small>${products.n} listings · ${products.featured || 0} featured</small></div>
      </div>

      <div class="dash">
        ${sellerNav('overview')}
        <div style="display:grid;gap:18px;min-width:0">
          <div class="panel">
            <div class="panel-head"><h3>Sales — last 6 months</h3><span class="small muted">goods value</span></div>
            <div class="panel-body chart-space">
              <div class="bar-chart">
                ${monthly.map(m => `<div class="bar" style="height:${Math.max(4, Math.round(m.total / maxMonth * 100))}%"><b>${m.total ? shortMoney(m.total) : ''}</b><span>${esc(m.month.slice(5))}</span></div>`).join('') || '<p class="small muted">No sales yet — your first listing is one click away.</p>'}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Recent order lines</h3><a class="link-more" href="/seller/orders" style="font-size:13px">All orders →</a></div>
            ${recent.length ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Order</th><th>Item</th><th>Qty</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>${recent.map(r => `<tr>
                <td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td class="num">${r.qty} ${esc(r.unit)}</td>
                <td class="num">${money(r.line_total)}</td><td><span class="status status-${esc(r.status)}">${esc(r.status.replace('_', ' '))}</span></td>
                <td class="small muted">${dateFmt(r.created_at)}</td></tr>`).join('')}</tbody></table></div>` :
              `<div class="panel-body"><p class="small muted">No orders yet.</p></div>`}
          </div>

          <div class="panel" style="padding:22px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap">
            <div><b style="font-size:15px">Subscription</b><p class="small muted" style="margin-top:4px">${subscription ? `${esc(subscription.plan)} plan · renews ${dateFmt(subscription.renews_at)}` : 'On the free Starter plan'}</p></div>
            <a class="btn btn-ghost btn-sm" href="/seller/subscription">Manage plan</a>
          </div>
        </div>
      </div>
    </div>`
  }));
});

/* ---------------- products ---------------- */
router.get('/seller/products', (req, res) => {
  const db = connect();
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.seller_id = ? ORDER BY p.id DESC`).all(req.seller.id);
  res.send(view(req, res, {
    title: 'My listings',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><span>Listings</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">My listings</h1><p class="lede" style="margin-top:6px">${products.length} listing${products.length === 1 ? '' : 's'} · publish produce, quantities, prices and harvest dates.</p></div><a class="btn btn-dark" href="/seller/products/new">+ New listing</a></div>
      <div class="dash">${sellerNav('products')}
        <div class="panel" style="min-width:0">
          ${products.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Listing</th><th>Price</th><th>Stock</th><th>Min</th><th>Harvest</th><th>Status</th><th>Featured</th><th></th></tr></thead>
            <tbody>${products.map(p => `<tr>
              <td><div style="display:flex;gap:10px;align-items:center"><img src="/art/product/${encodeURIComponent(p.vessel)}/${encodeURIComponent(p.hue)}/${encodeURIComponent(p.icon)}?label=ALZY" alt="" width="38" height="38" style="border-radius:9px;flex:0 0 38px"><div><a href="/product/${encodeURIComponent(p.slug)}" style="font-weight:600">${esc(p.name)}</a><div class="tiny muted">${esc(p.category_name)}</div></div></div></td>
              <td class="num">${money(p.price)}<div class="tiny muted">per ${esc(p.unit)}</div></td>
              <td class="num">${p.stock}</td><td class="num">${p.moq}</td>
              <td class="small">${p.harvest_date ? dateFmt(p.harvest_date) : '—'}</td>
              <td><span class="status status-${esc(p.status === 'active' ? 'active' : 'paused')}">${esc(p.status)}</span></td>
              <td>${p.featured ? `<span class="pill pill-featured">Featured</span>` : `<a class="btn btn-ghost btn-sm" href="/seller/featured?product=${p.id}">Feature</a>`}</td>
              <td><div style="display:flex;gap:4px"><a class="btn btn-ghost btn-sm" href="/seller/products/${p.id}">Edit</a>
                <form method="post" action="/seller/products/${p.id}/toggle"><button class="btn btn-ghost btn-sm" type="submit">${p.status === 'active' ? 'Pause' : 'Publish'}</button></form></div></td>
            </tr>`).join('')}</tbody></table></div>` : `<div class="panel-body"><p class="small muted">No listings yet.</p><a class="btn btn-dark btn-sm" href="/seller/products/new" style="margin-top:10px">Create your first listing</a></div>`}
        </div>
      </div>
    </div>`
  }));
});

function productForm(req, p) {
  const db = connect();
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort').all();
  const options = (list, sel) => list.map(o => `<option value="${esc(o[0])}" ${o[0] === sel ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
  return `
    <form class="panel" style="padding:24px" method="post" action="${p ? `/seller/products/${p.id}` : '/seller/products/new'}">
      <div class="field"><label for="name">Listing name</label><input id="name" name="name" required value="${esc(p ? p.name : '')}" placeholder="e.g. Roma Tomatoes"></div>
      <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3" placeholder="Variety, grade, packing, cold-chain notes…">${esc(p ? p.description || '' : '')}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="category_id">Category</label><select id="category_id" name="category_id">${options(cats.map(c => [c.id, c.name]), p ? p.category_id : '')}</select></div>
        <div class="field"><label for="unit">Unit</label>${(() => {
          const units = ['kg', 'each', 'bunch', '5kg bag', '10kg bag', '25kg bag', '50kg bag', 'box', 'crate', 'punnet', 'bottle', 'pack', 'roll', 'tray', 'project'];
          return `<input id="unit" name="unit" list="unitList" value="${esc(p ? p.unit : 'kg')}" required><datalist id="unitList">${units.map(u => `<option value="${esc(u)}">`).join('')}</datalist>`;
        })()}</div>
      </div>
      <div class="field-row">
        <div class="field"><label for="price">Price per unit (E)</label><input id="price" name="price" type="number" step="0.01" min="0.01" required value="${p ? (p.price / 100).toFixed(2) : ''}"></div>
        <div class="field"><label for="compare_price">Was-price (optional, E)</label><input id="compare_price" name="compare_price" type="number" step="0.01" min="0" value="${p && p.compare_price ? (p.compare_price / 100).toFixed(2) : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="moq">Minimum order (units)</label><input id="moq" name="moq" type="number" min="1" value="${p ? p.moq : 1}"></div>
        <div class="field"><label for="step">Order step</label><input id="step" name="step" type="number" min="1" value="${p ? p.step : 1}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="stock">Stock available</label><input id="stock" name="stock" type="number" min="0" value="${p ? p.stock : 100}"></div>
        <div class="field"><label for="harvest_date">Harvest date (optional)</label><input id="harvest_date" name="harvest_date" type="date" value="${p && p.harvest_date ? p.harvest_date : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="vessel">Art style</label><select id="vessel" name="vessel">${options(require('../lib/art').VESSEL_LIST.map(v => [v, v.charAt(0).toUpperCase() + v.slice(1)]), p ? p.vessel : 'crate')}</select></div>
        <div class="field"><label for="hue">Colour</label><select id="hue" name="hue">${options([['green', 'Green'], ['lime', 'Lime'], ['gold', 'Gold'], ['orange', 'Orange'], ['red', 'Red'], ['rose', 'Rose'], ['blue', 'Blue'], ['teal', 'Teal'], ['sand', 'Sand'], ['cocoa', 'Cocoa'], ['violet', 'Violet'], ['pink', 'Pink'], ['slate', 'Slate']], p ? p.hue : 'green')}</select></div>
      </div>
      <div class="btn-row"><button class="btn btn-dark" type="submit">${p ? 'Save changes' : 'Publish listing'}</button><a class="btn btn-ghost" href="/seller/products">Cancel</a></div>
      ${p ? '' : '<p class="tiny muted" style="margin-top:10px">Listings go live immediately. You can pause any listing at any time.</p>'}
    </form>`;
}

router.get('/seller/products/new', (req, res) => {
  res.send(view(req, res, {
    title: 'New listing',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><a href="/seller/products">Listings</a><span>/</span><span>New</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">New listing</h1><p class="lede" style="margin-top:6px">What are you selling, how much, at what price, and when do you harvest?</p></div></div>
      <div class="dash">${sellerNav('products')}<div>${productForm(req, null)}</div></div>
    </div>`
  }));
});

router.post('/seller/products/new', (req, res) => {
  const b = req.body || {};
  const db = connect();
  const price = Math.round(Number(b.price) * 100);
  const compare = b.compare_price ? Math.round(Number(b.compare_price) * 100) : null;
  if (!b.name || !price || price <= 0) { flash(res, 'error', 'Please add a name and a valid price.'); return res.redirect('/seller/products/new'); }
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(b.category_id)) || db.prepare('SELECT * FROM categories LIMIT 1').get();
  const baseSlug = String(b.name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'listing';
  let slug = baseSlug, n = 1;
  while (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) slug = `${baseSlug}-${++n}`;
  db.prepare(`INSERT INTO products (slug,seller_id,category_id,name,description,unit,price,compare_price,moq,step,stock,harvest_date,region,vessel,hue,icon,badge,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`).run(
    slug, req.seller.id, cat.id, String(b.name).slice(0, 90), String(b.description || '').slice(0, 800),
    String(b.unit || 'kg').slice(0, 24), price, compare && compare > price ? compare : null,
    Math.max(1, Number(b.moq) || 1), Math.max(1, Number(b.step) || 1), Math.max(0, Number(b.stock) || 0),
    b.harvest_date || null, req.seller.region, String(b.vessel || 'crate'), String(b.hue || 'green'), cat.icon, null
  );
  flash(res, 'success', `${b.name} is live on ALZY.`);
  res.redirect('/seller/products');
});

router.get('/seller/products/:id', (req, res) => {
  const p = connect().prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(Number(req.params.id), req.seller.id);
  if (!p) return res.redirect('/seller/products');
  res.send(view(req, res, {
    title: `Edit ${p.name}`,
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><a href="/seller/products">Listings</a><span>/</span><span>Edit</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Edit listing</h1></div><a class="btn btn-ghost" href="/product/${encodeURIComponent(p.slug)}">View on market</a></div>
      <div class="dash">${sellerNav('products')}<div>${productForm(req, p)}</div></div>
    </div>`
  }));
});

router.post('/seller/products/:id', (req, res) => {
  const db = connect();
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(Number(req.params.id), req.seller.id);
  if (!p) return res.redirect('/seller/products');
  const b = req.body || {};
  const price = Math.round(Number(b.price) * 100);
  if (!b.name || !price || price <= 0) { flash(res, 'error', 'Name and price are required.'); return res.redirect(`/seller/products/${p.id}`); }
  const compare = b.compare_price ? Math.round(Number(b.compare_price) * 100) : null;
  db.prepare(`UPDATE products SET name=?,description=?,category_id=?,unit=?,price=?,compare_price=?,moq=?,step=?,stock=?,harvest_date=?,vessel=?,hue=? WHERE id=?`)
    .run(String(b.name).slice(0, 90), String(b.description || '').slice(0, 800), Number(b.category_id) || p.category_id,
      String(b.unit || p.unit).slice(0, 24), price, compare && compare > price ? compare : null,
      Math.max(1, Number(b.moq) || 1), Math.max(1, Number(b.step) || 1), Math.max(0, Number(b.stock) || 0),
      b.harvest_date || null, String(b.vessel || p.vessel), String(b.hue || p.hue), p.id);
  flash(res, 'success', 'Listing updated.');
  res.redirect('/seller/products');
});

router.post('/seller/products/:id/toggle', (req, res) => {
  const db = connect();
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(Number(req.params.id), req.seller.id);
  if (!p) return res.redirect('/seller/products');
  db.prepare("UPDATE products SET status = ? WHERE id = ?").run(p.status === 'active' ? 'paused' : 'active', p.id);
  flash(res, 'success', `${p.name} ${p.status === 'active' ? 'paused' : 'published'}.`);
  res.redirect('/seller/products');
});

/* ---------------- orders ---------------- */
router.get('/seller/orders', (req, res) => {
  const db = connect();
  const lines = db.prepare(`
    SELECT oi.*, o.code, o.status AS order_status, o.delivery_region, o.created_at, o.delivery_address, u.name AS buyer_name
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN users u ON u.id = o.user_id
    WHERE oi.seller_id = ? ORDER BY o.id DESC`).all(req.seller.id);
  res.send(view(req, res, {
    title: 'Seller orders',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><span>Orders</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Orders</h1><p class="lede" style="margin-top:6px">Everything buyers ordered from you, across all sellers' baskets.</p></div></div>
      <div class="dash">${sellerNav('orders')}
        <div class="panel" style="min-width:0">
          ${lines.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Order</th><th>Buyer</th><th>Item</th><th>Qty</th><th>Your line value</th><th>Commission</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${lines.map(l => `<tr>
              <td><b>${esc(l.code)}</b><div class="tiny muted">${esc(l.delivery_region)}</div></td>
              <td>${esc(l.buyer_name)}</td><td>${esc(l.name)}</td><td class="num">${l.qty} ${esc(l.unit)}</td>
              <td class="num">${money(l.line_total - l.discount)}</td><td class="num" style="color:var(--muted)">−${money(l.commission)}</td>
              <td><span class="status status-${esc(l.order_status)}">${esc(l.order_status.replace('_', ' '))}</span></td>
              <td class="small muted">${dateFmt(l.created_at)}</td>
            </tr>`).join('')}</tbody></table></div>` : `<div class="panel-body"><p class="small muted">No orders yet.</p></div>`}
        </div>
      </div>
    </div>`
  }));
});

/* ---------------- subscription ---------------- */
router.get('/seller/subscription', (req, res) => {
  const db = connect();
  const s = req.seller;
  const history = db.prepare('SELECT * FROM subscriptions WHERE seller_id = ? ORDER BY id DESC').all(s.id);
  res.send(view(req, res, {
    title: 'Subscription',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><span>Subscription</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Subscription</h1><p class="lede" style="margin-top:6px">You are on the <b>${esc(config.revenue.subscriptions[s.plan].label)}</b> plan (${Math.round(config.revenue.subscriptions[s.plan].commission * 100)}% commission).</p></div></div>
      <div class="dash">${sellerNav('subscription')}
        <div style="display:grid;gap:18px;min-width:0">
          <div class="price-grid">
            ${Object.entries(config.revenue.subscriptions).map(([key, plan]) => `
              <div class="price-card ${key === s.plan ? 'popular' : ''}">
                <div><h3>${plan.label}</h3><p class="small muted">${plan.price === 0 ? 'No monthly fee' : money(plan.price) + ' / month'}</p></div>
                <div class="price-amount">${Math.round(plan.commission * 100)}%<small> commission</small></div>
                <ul class="price-feats">${plan.features.map(f => `<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>${esc(f)}</li>`).join('')}</ul>
                ${key === s.plan
                  ? '<span class="pill pill-soft" style="align-self:flex-start">Current plan</span>'
                  : `<form method="post" action="/seller/subscription"><input type="hidden" name="plan" value="${key}"><button class="btn btn-ghost btn-block" type="submit">${plan.price > config.revenue.subscriptions[s.plan].price ? 'Upgrade' : 'Switch'} to ${plan.label}</button></form>`}
              </div>`).join('')}
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Billing history</h3></div>
            ${history.length ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Plan</th><th>Price</th><th>Status</th><th>Started</th><th>Renews</th></tr></thead>
              <tbody>${history.map(h => `<tr><td>${esc(config.revenue.subscriptions[h.plan].label)}</td><td class="num">${money(h.price)}</td>
                <td><span class="status status-${esc(h.status === 'active' ? 'active' : 'expired')}">${esc(h.status)}</span></td>
                <td class="small">${dateFmt(h.started_at)}</td><td class="small">${dateFmt(h.renews_at)}</td></tr>`).join('')}</tbody>
            </table></div>` : `<div class="panel-body"><p class="small muted">No subscription payments yet — you are on the free plan.</p></div>`}
          </div>
        </div>
      </div>
    </div>`
  }));
});

router.post('/seller/subscription', (req, res) => {
  const plan = String((req.body || {}).plan || '');
  if (!config.revenue.subscriptions[plan]) { flash(res, 'error', 'Unknown plan.'); return res.redirect('/seller/subscription'); }
  const db = connect();
  const price = config.revenue.subscriptions[plan].price;
  db.prepare('UPDATE sellers SET plan = ?, plan_renews = date(\'now\', \'+30 day\') WHERE id = ?').run(plan, req.seller.id);
  db.prepare("UPDATE subscriptions SET status='expired' WHERE seller_id = ? AND status='active'").run(req.seller.id);
  const info = db.prepare("INSERT INTO subscriptions (seller_id,plan,price,status,renews_at) VALUES (?,?,?,'active',date('now','+30 day'))").run(req.seller.id, plan, price);
  if (price > 0) {
    db.prepare("INSERT INTO revenue_ledger (kind,ref_type,ref_id,seller_id,amount,note) VALUES ('subscription','subscription',?,?,?,?)")
      .run(info.lastInsertRowid, req.seller.id, price, `${config.revenue.subscriptions[plan].label} plan — monthly`);
  }
  flash(res, 'success', `You are now on the ${config.revenue.subscriptions[plan].label} plan. Commission is ${Math.round(config.revenue.subscriptions[plan].commission * 100)}%.`);
  res.redirect('/seller/subscription');
});

/* ---------------- featured listings ---------------- */
router.get('/seller/featured', (req, res) => {
  const db = connect();
  const products = db.prepare('SELECT * FROM products WHERE seller_id = ? ORDER BY id DESC').all(req.seller.id);
  const featured = products.filter(p => p.featured);
  res.send(view(req, res, {
    title: 'Featured listings',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><span>Featured</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Featured listings</h1><p class="lede" style="margin-top:6px">E150 buys seven days of promoted placement — homepage rail, department pages and priority search.</p></div></div>
      <div class="dash">${sellerNav('featured')}
        <div style="display:grid;gap:18px;min-width:0">
          <div class="panel">
            <div class="panel-head"><h3>Currently featured (${featured.length})</h3><span class="small muted">${money(config.revenue.featured.price)} per 7 days</span></div>
            ${featured.length ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Listing</th><th>Price</th><th>Featured until</th></tr></thead>
              <tbody>${featured.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${money(p.price)}</td><td>${dateFmt(p.featured_until)}</td></tr>`).join('')}</tbody>
            </table></div>` : `<div class="panel-body"><p class="small muted">No featured listings right now.</p></div>`}
          </div>
          <form class="panel" style="padding:22px" method="post" action="/seller/featured">
            <h3 style="font-size:15px;margin-bottom:14px">Feature a listing</h3>
            <div class="field"><label for="product">Listing</label>
              <select id="product" name="product_id" required>
                ${products.map(p => `<option value="${p.id}" ${String(req.query.product) === String(p.id) ? 'selected' : ''}>${esc(p.name)} — ${money(p.price)}/${esc(p.unit)}${p.featured ? ' (currently featured)' : ''}</option>`).join('') || '<option value="">Create a listing first</option>'}
              </select>
            </div>
            <div class="field"><label for="days">Duration</label><select id="days" name="days"><option value="7">7 days — E150</option><option value="14">14 days — E300</option><option value="30">30 days — E600</option></select></div>
            <div class="note" style="margin-bottom:14px">Billed to your seller account and recorded in ALZY's featured-listing revenue. Demo mode: no real charge.</div>
            <button class="btn btn-dark" type="submit" ${products.length ? '' : 'disabled'}>Purchase featured placement</button>
          </form>
        </div>
      </div>
    </div>`
  }));
});

router.post('/seller/featured', (req, res) => {
  const { product_id, days } = req.body || {};
  const db = connect();
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(Number(product_id), req.seller.id);
  if (!p) { flash(res, 'error', 'Choose one of your own listings.'); return res.redirect('/seller/featured'); }
  const d = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
  const cost = Math.round(config.revenue.featured.price * (d / 7));
  const until = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  db.prepare('UPDATE products SET featured = 1, featured_until = ? WHERE id = ?').run(until, p.id);
  db.prepare("INSERT INTO revenue_ledger (kind,ref_type,ref_id,seller_id,amount,note) VALUES ('featured','product',?,?,?,?)")
    .run(p.id, req.seller.id, cost, `Featured ${d} days — ${p.name}`);
  flash(res, 'success', `${p.name} is featured until ${until}.`);
  res.redirect('/seller/featured');
});

/* ---------------- messages (seller view) ---------------- */
router.get('/seller/messages', (req, res) => {
  const db = connect();
  const threads = db.prepare(`
    SELECT t.*, u.name AS buyer_name, p.name AS product_name,
      (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
      (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_at,
      (SELECT count(*) FROM messages m WHERE m.thread_id = t.id AND m.read_at IS NULL AND m.sender_id != ?) AS unread
    FROM threads t JOIN users u ON u.id = t.buyer_id LEFT JOIN products p ON p.id = t.product_id
    WHERE t.seller_id = ? ORDER BY last_at DESC`).all(req.seller.user_id || -1, req.seller.id);
  res.send(view(req, res, {
    title: 'Seller messages',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/seller">Seller</a><span>/</span><span>Messages</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Buyer messages</h1><p class="lede" style="margin-top:6px">Bulk enquiries, contract supply and delivery questions.</p></div></div>
      <div class="dash">${sellerNav('messages')}
        <div class="panel" style="min-width:0">
          ${threads.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Buyer</th><th>Subject</th><th>Last message</th><th>Unread</th><th></th></tr></thead>
            <tbody>${threads.map(t => `<tr>
              <td><b>${esc(t.buyer_name)}</b>${t.product_name ? `<div class="tiny muted">${esc(t.product_name)}</div>` : ''}</td>
              <td>${esc(t.subject || '—')}</td>
              <td class="small muted" style="max-width:320px">${esc((t.last_body || '').slice(0, 90))}${(t.last_body || '').length > 90 ? '…' : ''}</td>
              <td>${t.unread ? `<span class="pill pill-deal">${t.unread}</span>` : '—'}</td>
              <td><a class="btn btn-ghost btn-sm" href="/messages/${t.id}">Open</a></td>
            </tr>`).join('')}</tbody></table></div>` : `<div class="panel-body"><p class="small muted">No messages yet. Buyers can message you directly from your listings.</p></div>`}
        </div>
      </div>
    </div>`
  }));
});

module.exports = router;
