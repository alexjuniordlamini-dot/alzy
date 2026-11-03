'use strict';
/** ALZY admin console — revenue, liquidity, orders, sellers, coupons. */
const express = require('express');
const { connect } = require('../db');
const { render, esc, money, shortMoney, dateFmt } = require('../lib/layout');
const { requireAdmin } = require('../middleware');
const Q = require('../lib/queries');
const config = require('../lib/config');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

const nav = (active) => `
  <nav class="dash-nav">
    <a href="/admin" class="${active === 'overview' ? 'is-active' : ''}">Revenue overview</a>
    <a href="/admin/orders" class="${active === 'orders' ? 'is-active' : ''}">All orders</a>
    <a href="/admin/sellers" class="${active === 'sellers' ? 'is-active' : ''}">Sellers</a>
    <a href="/admin/coupons" class="${active === 'coupons' ? 'is-active' : ''}">Coupons</a>
  </nav>`;

router.get('/admin', requireAdmin, (req, res) => {
  const db = connect();
  const rev = Q.revenueSummary();
  const kindLabel = { commission: 'Transaction commission', subscription: 'Supplier subscriptions', featured: 'Featured listings', logistics: 'Logistics coordination', brand: 'Brand Studio' };
  const maxMonth = Math.max(1, ...rev.monthly.map(m => m.total));
  const counts = db.prepare(`
    SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM sellers) AS sellers,
           (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM orders) AS orders,
           (SELECT count(*) FROM coupon_claims WHERE status != 'watching') AS earned_coupons,
           (SELECT count(*) FROM brand_projects) AS brand_projects`).get();
  const recentOrders = db.prepare(`SELECT o.*, u.name AS buyer FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8`).all();

  res.send(view(req, res, {
    title: 'Admin — revenue overview',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div><p class="eyebrow">Admin console</p><h1 class="page-title" style="font-size:clamp(28px,4vw,42px)">ALZY revenue</h1><p class="lede" style="margin-top:6px">${counts.users} users · ${counts.sellers} sellers · ${counts.products} listings · ${counts.orders} orders</p></div></div>
      <div class="kpi-grid">
        <div class="kpi"><span>Total marketplace revenue</span><b>${money(rev.totalRevenue)}</b><small>last 30 days ${money(rev.last30)}</small></div>
        <div class="kpi"><span>GMV (goods traded)</span><b>${money(rev.gmv)}</b><small>${rev.orderCount} orders</small></div>
        <div class="kpi"><span>Blended take rate</span><b>${(rev.takeRate * 100).toFixed(1)}%</b><small>revenue ÷ GMV</small></div>
        <div class="kpi"><span>Coupons earned</span><b>${counts.earned_coupons}</b><small>${counts.brand_projects} brand projects</small></div>
      </div>
      <div class="dash">${nav('overview')}
        <div style="display:grid;gap:18px;min-width:0">
          <div class="grid cols-2">
            <div class="panel">
              <div class="panel-head"><h3>Revenue by line</h3></div>
              <div class="panel-body" style="display:grid;gap:12px">
                ${rev.byKind.map(k => {
                  const pct = rev.totalRevenue ? Math.round(k.total / rev.totalRevenue * 100) : 0;
                  return `<div>
                    <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:5px"><span>${esc(kindLabel[k.kind] || k.kind)}</span><b>${money(k.total)}</b></div>
                    <div class="progress-track" style="height:6px"><div class="progress-fill" style="width:${pct}%"></div></div>
                    <div class="tiny muted" style="margin-top:3px">${k.n} entries · ${pct}% of revenue</div>
                  </div>`;
                }).join('') || '<p class="small muted">No revenue recorded yet.</p>'}
              </div>
            </div>
            <div class="panel">
              <div class="panel-head"><h3>Monthly revenue</h3></div>
              <div class="panel-body chart-space">
                <div class="bar-chart">${rev.monthly.map(m => `<div class="bar" style="height:${Math.max(4, Math.round(m.total / maxMonth * 100))}%"><b>${shortMoney(m.total)}</b><span>${esc(m.month.slice(5))}</span></div>`).join('') || '<p class="small muted">No data yet.</p>'}</div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Recent orders</h3><a class="link-more" href="/admin/orders" style="font-size:13px">All orders →</a></div>
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Order</th><th>Buyer</th><th>Goods</th><th>Commission</th><th>Logistics</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>${recentOrders.map(o => `<tr>
                <td><b>${esc(o.code)}</b></td><td>${esc(o.buyer)}</td>
                <td class="num">${money(o.subtotal - o.discount_total)}</td>
                <td class="num">${money(o.commission_total)}</td>
                <td class="num">${money(o.delivery_fee)}</td>
                <td><span class="status status-${esc(o.status)}">${esc(o.status.replace('_', ' '))}</span></td>
                <td class="small muted">${dateFmt(o.created_at)}</td>
              </tr>`).join('')}</tbody>
            </table></div>
          </div>

          <div class="panel" style="padding:22px">
            <h3 style="font-size:15px;margin-bottom:10px">Business model snapshot</h3>
            <div class="grid cols-4" style="gap:12px">
              <div class="kpi" style="padding:14px"><span>Default commission</span><b style="font-size:19px">6%</b></div>
              <div class="kpi" style="padding:14px"><span>Growth plan</span><b style="font-size:19px">${money(config.revenue.subscriptions.growth.price)}</b></div>
              <div class="kpi" style="padding:14px"><span>Featured / 7 days</span><b style="font-size:19px">${money(config.revenue.featured.price)}</b></div>
              <div class="kpi" style="padding:14px"><span>Logistics base</span><b style="font-size:19px">${money(config.revenue.logistics.baseFee)}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  }));
});

router.get('/admin/orders', requireAdmin, (req, res) => {
  const db = connect();
  const orders = db.prepare(`SELECT o.*, u.name AS buyer FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 100`).all();
  res.send(view(req, res, {
    title: 'Admin — orders',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">All orders</h1></div></div>
      <div class="dash">${nav('orders')}
        <div class="panel" style="min-width:0"><div class="table-wrap"><table class="table">
          <thead><tr><th>Order</th><th>Buyer</th><th>Region</th><th>Total</th><th>Commission</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${orders.map(o => `<tr>
            <td><b>${esc(o.code)}</b></td><td>${esc(o.buyer)}</td><td>${esc(o.delivery_region)}</td>
            <td class="num">${money(o.total)}</td><td class="num">${money(o.commission_total)}</td>
            <td class="small">${esc(o.payment_method)}</td>
            <td><span class="status status-${esc(o.status)}">${esc(o.status.replace('_', ' '))}</span></td>
            <td class="small muted">${dateFmt(o.created_at)}</td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </div>
    </div>`
  }));
});

router.get('/admin/sellers', requireAdmin, (req, res) => {
  const db = connect();
  const sellers = db.prepare(`
    SELECT s.*, (SELECT count(*) FROM products p WHERE p.seller_id = s.id) AS listings,
      (SELECT coalesce(sum(oi.line_total),0) FROM order_items oi WHERE oi.seller_id = s.id) AS gmv,
      (SELECT coalesce(sum(oi.commission),0) FROM order_items oi WHERE oi.seller_id = s.id) AS commission
    FROM sellers s ORDER BY s.plan DESC, gmv DESC`).all();
  res.send(view(req, res, {
    title: 'Admin — sellers',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Sellers</h1><p class="lede" style="margin-top:6px">${sellers.length} sellers · subscription plan sets commission.</p></div></div>
      <div class="dash">${nav('sellers')}
        <div class="panel" style="min-width:0"><div class="table-wrap"><table class="table">
          <thead><tr><th>Seller</th><th>Type</th><th>Plan</th><th>Listings</th><th>GMV</th><th>Commission earned</th><th>Rating</th></tr></thead>
          <tbody>${sellers.map(s => `<tr>
            <td><div style="display:flex;gap:10px;align-items:center"><img src="/art/seller/${encodeURIComponent(s.slug)}" alt="" width="32" height="32" style="border-radius:8px;flex:0 0 32px"><div><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.region)}</div></div></div></td>
            <td class="small">${esc(s.kind)}</td>
            <td><span class="pill ${s.plan === 'pro' ? 'pill-featured' : s.plan === 'growth' ? 'pill-soft' : 'pill-quiet'}">${esc(config.revenue.subscriptions[s.plan].label)}</span></td>
            <td class="num">${s.listings}</td><td class="num">${money(s.gmv)}</td><td class="num">${money(s.commission)}</td>
            <td class="small">${Number(s.rating).toFixed(1)} (${s.rating_count})</td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </div>
    </div>`
  }));
});

router.get('/admin/coupons', requireAdmin, (req, res) => {
  const db = connect();
  const coupons = db.prepare(`
    SELECT cp.*, s.name AS seller_name,
      (SELECT count(*) FROM coupon_claims cc WHERE cc.coupon_id = cp.id AND cc.status = 'used') AS used_count,
      (SELECT count(*) FROM coupon_claims cc WHERE cc.coupon_id = cp.id) AS claims
    FROM coupons cp LEFT JOIN sellers s ON s.id = cp.seller_id ORDER BY cp.kind DESC, cp.id DESC`).all();
  res.send(view(req, res, {
    title: 'Admin — coupons',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Coupons</h1><p class="lede" style="margin-top:6px">Video-gated coupons and open promos.</p></div></div>
      <div class="dash">${nav('coupons')}
        <div class="panel" style="min-width:0"><div class="table-wrap"><table class="table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Scope</th><th>Min spend</th><th>Claims</th><th>Used</th><th>Uses / max</th></tr></thead>
          <tbody>${coupons.map(c => `<tr>
            <td><b>${esc(c.code)}</b><div class="tiny muted">${esc(c.title)}</div></td>
            <td><span class="pill ${c.kind === 'video' ? 'pill-amber' : 'pill-soft'}">${esc(c.kind)}</span></td>
            <td class="num">${c.type === 'percent' ? c.value + '%' : money(c.value)}</td>
            <td class="small">${esc(c.seller_name || (c.product_id ? 'Product' : 'Market-wide'))}</td>
            <td class="num">${money(c.min_subtotal)}</td>
            <td class="num">${c.claims}</td><td class="num">${c.used_count}</td>
            <td class="num">${c.uses} / ${c.max_uses}</td>
          </tr>`).join('')}</tbody>
        </table></div></div>
      </div>
    </div>`
  }));
});

module.exports = router;
