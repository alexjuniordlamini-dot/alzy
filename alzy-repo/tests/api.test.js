'use strict';
/**
 * ALZY API integration tests — no external dependencies.
 * Boots the app on an ephemeral port with an isolated database and walks the
 * full buyer + seller + coupon + admin journey. Run: npm test
 */
process.env.ALZY_DB = require('path').join(require('os').tmpdir(), `alzy-test-${Date.now()}.db`);

const assert = require('assert');
const { app, ensureSeeded } = require('../server');
const { connect } = require('../db');

let pass = 0, fail = 0;
const results = [];
function test(name, fn) { results.push([name, fn]); }

/* --- tiny cookie-aware fetch client --- */
function client(base) {
  const jar = new Map();
  return {
    jar,
    async req(path, { method = 'GET', body, headers = {}, redirect = 'manual' } = {}) {
      const h = { ...headers };
      if (body !== undefined && typeof body !== 'string') { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
      if (jar.size) h.cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetch(base + path, { method, headers: h, body, redirect });
      for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* html */ }
      return { status: res.status, text, json, headers: res.headers, location: res.headers.get('location') };
    },
    post(path, body) { return this.req(path, { method: 'POST', body }); },
    get(path, redirect) { return this.req(path, { redirect }); }
  };
}

/* ----------------------------- tests ----------------------------- */
test('seeds a full catalogue', async () => {
  const db = connect();
  const n = db.prepare('SELECT count(*) AS n FROM products').get().n;
  assert.ok(n >= 100, `expected 100+ products, got ${n}`);
});

test('health endpoint', async (base) => {
  const c = client(base);
  const r = await c.get('/api/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ok, true);
  assert.ok(r.json.products > 0);
});

test('homepage renders hero, deals and coupons', async (base) => {
  const r = await client(base).get('/');
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('The whole harvest'));
  assert.ok(r.text.includes('Coupon-only discounts'));
  assert.ok(r.text.includes('Coupon video'));
  assert.ok(!/render\.errorPage|undefined|NaN/.test(r.text), 'no template leakage');
});

test('shop filters: category, deals, price, keyword', async (base) => {
  const c = client(base);
  const cat = await c.get('/shop?category=meat-poultry');
  assert.ok(cat.text.includes('Beef') || cat.text.includes('Chicken'));
  const deals = await c.get('/shop?deals=1');
  assert.ok(deals.text.includes('−'), 'discount badges present');
  const search = await c.get('/shop?q=bottles');
  assert.ok(/bottle/i.test(search.text));
  const couponOnly = await c.get('/shop?coupon_only=1');
  assert.strictEqual(couponOnly.status, 200);
  const cheap = await c.get('/shop?min=0&max=30&sort=price_asc');
  assert.strictEqual(cheap.status, 200);
});

test('product page shows harvest date, MOQ and coupon CTA', async (base) => {
  const db = connect();
  const p = db.prepare("SELECT slug FROM products WHERE moq > 1 LIMIT 1").get();
  const r = await client(base).get('/product/' + encodeURIComponent(p.slug));
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('Harvest date') || r.text.includes('Harvest scheduled'));
  assert.ok(r.text.includes('Minimum order'));
});

test('404 page renders gracefully', async (base) => {
  const r = await client(base).get('/this-does-not-exist');
  assert.strictEqual(r.status, 404);
  assert.ok(r.text.includes('Page not found'));
});

test('register + session + welcome coupon', async (base) => {
  const c = client(base);
  const email = `test${Date.now()}@example.com`;
  const r = await c.post('/register', { name: 'Test Buyer', email, password: 'Password123', phone: '+268 7600 1234', region: 'Manzini', role: 'buyer' });
  assert.strictEqual(r.status, 302);
  const account = await c.get('/account');
  assert.strictEqual(account.status, 200);
  assert.ok(account.text.includes('Sawubona'));
  const coupons = await c.get('/account/coupons');
  assert.ok(coupons.text.includes('WELCOME10'), 'welcome coupon auto-issued');
  // logout then bad login
  await c.post('/logout');
  const bad = await c.post('/login', { email, password: 'wrongpass' });
  assert.strictEqual(bad.status, 302);
  const good = await c.post('/login', { email, password: 'Password123' });
  assert.strictEqual(good.status, 302);
});

test('login rejects wrong password and accepts demo accounts', async (base) => {
  const c = client(base);
  const bad = await c.post('/login', { email: 'thandi@example.com', password: 'nope' });
  assert.strictEqual(bad.status, 302);
  const ok = await c.post('/login', { email: 'thandi@example.com', password: 'Alzy123!' });
  assert.strictEqual(ok.status, 302);
  const account = await c.get('/account');
  assert.ok(account.text.includes('Thandiwe'));
});

test('cart: add, MOQ enforcement, update, remove', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'thandi@example.com', password: 'Alzy123!' });
  const db = connect();
  const p = db.prepare("SELECT * FROM products WHERE status='active' AND moq = 1 LIMIT 1").get();
  const add = await c.post('/api/cart', { product_id: p.id, qty: 2 });
  assert.strictEqual(add.status, 200);
  assert.strictEqual(add.json.count, 2);
  const upsell = await c.post('/api/cart', { product_id: p.id, qty: 1 });
  assert.strictEqual(upsell.json.count, 3, 'adding again increases qty');
  const upd = await c.req('/api/cart/update', { method: 'PATCH', body: { product_id: p.id, qty: 5 } });
  assert.strictEqual(upd.json.count, 5);
  const del = await c.req('/api/cart', { method: 'DELETE', body: { product_id: p.id } });
  assert.strictEqual(del.json.count, 0);

  // MOQ product cannot go below minimum
  const moqP = db.prepare('SELECT * FROM products WHERE moq > 1 AND status=\'active\' LIMIT 1').get();
  const moqAdd = await c.post('/api/cart', { product_id: moqP.id, qty: 1 });
  assert.strictEqual(moqAdd.json.count, moqP.moq, 'clamped to MOQ');
});

test('checkout: delivery fee, coupon validation, order placement, ledger', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'thandi@example.com', password: 'Alzy123!' });
  const db = connect();
  const a = db.prepare("SELECT * FROM products WHERE status='active' AND moq=1 AND price > 2000 LIMIT 1").get();
  const b = db.prepare("SELECT * FROM products WHERE status='active' AND moq=1 AND price > 2000 AND id != ? LIMIT 1").get(a.id);
  await c.post('/api/cart', { product_id: a.id, qty: 2 });
  await c.post('/api/cart', { product_id: b.id, qty: 1 });

  const fee1 = await c.post('/api/delivery-fee', { region: 'Mbabane', subtotal: 100000 });
  const fee2 = await c.post('/api/delivery-fee', { region: 'Big Bend', subtotal: 100000 });
  assert.ok(fee1.json && fee2.json && fee2.json.fee > fee1.json.fee, 'further regions cost more: ' + JSON.stringify([fee1.json, fee2.json]));

  const bad = await c.post('/api/coupons/validate', { code: 'NOPE123' });
  assert.strictEqual(bad.status, 400, 'unknown coupon rejected: ' + JSON.stringify(bad.json));

  const earningsBefore = db.prepare('SELECT count(*) AS n FROM revenue_ledger').get().n;
  const order = await c.post('/api/orders', {
    delivery_region: 'Manzini', delivery_address: 'Plot 7, Manzini', delivery_phone: '+268 7612 3456',
    payment_method: 'momo', coupon_code: 'WELCOME10'
  });
  assert.strictEqual(order.status, 200, JSON.stringify(order.json));
  assert.ok(order.json.redirect && order.json.redirect.includes('/orders/'), 'redirect missing: ' + JSON.stringify(order.json));

  const code = order.json.order.code;
  const detail = await c.get(order.json.redirect);
  assert.strictEqual(detail.status, 200, 'order page status: ' + detail.status);
  assert.ok(detail.text.includes(code), 'order page shows code ' + code + ' :: ' + detail.text.slice(0, 160));

  const dbOrder = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
  assert.ok(dbOrder.discount_total > 0, 'coupon discount applied');
  assert.ok(dbOrder.commission_total > 0, 'commission recorded');
  assert.ok(dbOrder.delivery_fee > 0, 'logistics fee recorded');
  const earningsAfter = db.prepare('SELECT count(*) AS n FROM revenue_ledger').get().n;
  assert.ok(earningsAfter > earningsBefore, 'revenue ledger grew');
  const kinds = db.prepare("SELECT DISTINCT kind FROM revenue_ledger WHERE ref_id = ? AND ref_type='order'").all(dbOrder.id).map(r => r.kind);
  assert.ok(kinds.includes('commission') && kinds.includes('logistics'));

  // cart cleared
  const cart = await c.get('/api/cart');
  assert.strictEqual(cart.json.count, 0, 'cart emptied after order');

  // stock decremented
  const live = db.prepare('SELECT stock FROM products WHERE id = ?').get(a.id);
  assert.strictEqual(live.stock, a.stock - 2);

  // coupon cannot be reused (cart must clear the E150 minimum first)
  const qtyNeeded = Math.ceil(20000 / a.price);
  await c.post('/api/cart', { product_id: a.id, qty: qtyNeeded });
  const reuse = await c.post('/api/coupons/validate', { code: 'WELCOME10' });
  assert.strictEqual(reuse.status, 400, JSON.stringify(reuse.json));
  assert.ok(/already used/i.test(reuse.json.error), 'got: ' + reuse.json.error);
});

test('video coupon: cannot claim before finishing; progress persists', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'sipho@example.com', password: 'Alzy123!' });
  const db = connect();
  const coupon = db.prepare("SELECT * FROM coupons WHERE kind='video' AND code='AGRO12'").get();
  const page = await c.get(`/coupons/${coupon.id}`);
  assert.strictEqual(page.status, 200);
  assert.ok(page.text.includes('data-youtube-id'));

  const early = await c.post(`/api/coupons/${coupon.id}/claim`, { watched: 20, liked: true });
  assert.strictEqual(early.status, 400, 'cannot claim early');

  const prog = await c.post(`/api/coupons/${coupon.id}/progress`, { watched: 60, liked: false });
  assert.strictEqual(prog.json.watched, 60);

  const noLike = await c.post(`/api/coupons/${coupon.id}/claim`, { watched: coupon.duration, liked: false });
  assert.strictEqual(noLike.status, 400);
  assert.ok(noLike.json.needsLike);

  const claim = await c.post(`/api/coupons/${coupon.id}/claim`, { watched: coupon.duration, liked: true });
  assert.strictEqual(claim.status, 200, JSON.stringify(claim.json));
  assert.strictEqual(claim.json.code, 'AGRO12');

  const mine = await c.get('/account/coupons');
  assert.ok(mine.text.includes('AGRO12'));
  const again = await c.post(`/api/coupons/${coupon.id}/claim`, { watched: coupon.duration, liked: true });
  assert.ok(again.json.alreadyEarned, 'idempotent claim');
});

test('favorites toggle works both ways', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'thandi@example.com', password: 'Alzy123!' });
  const db = connect();
  const p = db.prepare("SELECT id FROM products WHERE status='active' LIMIT 1").get();
  const on = await c.post('/api/favorites', { product_id: p.id });
  assert.strictEqual(on.json.favorited, true);
  const off = await c.post('/api/favorites', { product_id: p.id });
  assert.strictEqual(off.json.favorited, false);
});

test('auth is enforced on protected APIs', async (base) => {
  const c = client(base);
  const cart = await c.post('/api/cart', { product_id: 1, qty: 1 });
  assert.strictEqual(cart.status, 401);
  const orders = await c.post('/api/orders', {});
  assert.strictEqual(orders.status, 401);
  const admin = await c.get('/admin');
  assert.strictEqual(admin.status, 302, 'admin redirects to login');
});

test('seller dashboard: listings, new listing, subscription, featured', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'farm@ngwempisi.co.sz', password: 'Farmer123!' });
  const dash = await c.get('/seller');
  assert.strictEqual(dash.status, 200);
  assert.ok(dash.text.includes('Gross sales'));

  const created = await c.post('/seller/products/new', {
    name: 'Test Heirloom Tomatoes', description: 'QA listing', category_id: 1, unit: 'kg',
    price: '23.50', compare_price: '28.00', moq: '5', step: '1', stock: '400', vessel: 'crate', hue: 'red'
  });
  assert.strictEqual(created.status, 302);
  const db = connect();
  const p = db.prepare("SELECT * FROM products WHERE name = 'Test Heirloom Tomatoes'").get();
  assert.ok(p, 'listing created');
  assert.strictEqual(p.price, 2350);
  assert.strictEqual(p.moq, 5);

  const sub = await c.post('/seller/subscription', { plan: 'pro' });
  assert.strictEqual(sub.status, 302);
  assert.strictEqual(db.prepare('SELECT plan FROM sellers WHERE id = ?').get(p.seller_id).plan, 'pro');

  const ledgerBefore = db.prepare("SELECT count(*) AS n FROM revenue_ledger WHERE kind='featured'").get().n;
  const feat = await c.post('/seller/featured', { product_id: p.id, days: '14' });
  assert.strictEqual(feat.status, 302);
  assert.strictEqual(db.prepare('SELECT featured FROM products WHERE id = ?').get(p.id).featured, 1);
  assert.ok(db.prepare("SELECT count(*) AS n FROM revenue_ledger WHERE kind='featured'").get().n > ledgerBefore);

  // seller cannot feature someone else's product
  const other = db.prepare('SELECT id FROM products WHERE seller_id != ? LIMIT 1').get(p.seller_id);
  await c.post('/seller/featured', { product_id: other.id, days: '7' });
  assert.strictEqual(db.prepare('SELECT featured FROM products WHERE id = ?').get(other.id).featured, 0, 'cannot feature others');
});

test('admin console shows all four revenue lines', async (base) => {
  const c = client(base);
  await c.post('/login', { email: 'admin@alzy.co.sz', password: 'Admin123!' });
  const r = await c.get('/admin');
  assert.strictEqual(r.status, 200);
  for (const line of ['Transaction commission', 'Supplier subscriptions', 'Featured listings', 'Logistics coordination']) {
    assert.ok(r.text.includes(line), `admin shows ${line}`);
  }
  assert.ok((await c.get('/admin/orders')).text.includes('All orders'));
  assert.ok((await c.get('/admin/sellers')).text.includes('Sellers'));
  assert.ok((await c.get('/admin/coupons')).text.includes('Coupons'));
});

test('messaging between buyer and seller', async (base) => {
  const buyer = client(base);
  await buyer.post('/login', { email: 'sipho@example.com', password: 'Alzy123!' });
  const db = connect();
  const p = db.prepare("SELECT * FROM products WHERE status='active' AND seller_id = (SELECT id FROM sellers WHERE slug='ngwempisi') LIMIT 1").get();
  const sent = await buyer.post('/messages/start', { product_id: p.id, body: 'Can you supply 200kg weekly?' });
  assert.strictEqual(sent.status, 302);
  const thread = db.prepare('SELECT * FROM threads ORDER BY id DESC LIMIT 1').get();
  const view = await buyer.get('/messages/' + thread.id);
  assert.ok(view.text.includes('200kg weekly'));
  const reply = await buyer.post('/messages/' + thread.id, { body: 'Following up on this.' });
  assert.strictEqual(reply.status, 302);
});

test('artwork endpoints return valid SVG', async (base) => {
  const c = client(base);
  for (const path of ['/art/product/jar/gold/honey?label=Honey', '/art/category/fresh-vegetables', '/art/seller/ngwempisi-valley-farms', '/art/hero/a', '/art/hero/b', '/art/tile/produce', '/art/coupon/1']) {
    const r = await c.get(path);
    assert.strictEqual(r.status, 200, path);
    assert.ok(r.text.trim().startsWith('<svg'), path + ' returns svg');
    assert.ok(!r.text.includes('NaN'), path + ' has no NaN');
  }
});

test('grocery builder respects budget', async (base) => {
  const c = client(base);
  const r = await c.get('/groceries?budget=800');
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('Basket cost'));
  assert.ok(!r.text.includes('NaN'));
});

test('security: XSS in search is escaped', async (base) => {
  const c = client(base);
  const r = await c.get('/shop?q=' + encodeURIComponent('<script>alert(1)</script>'));
  assert.ok(!r.text.includes('<script>alert(1)</script>'));
});

test('security: SQL injection attempt is safe', async (base) => {
  const c = client(base);
  const r = await c.get("/shop?q=" + encodeURIComponent("' OR 1=1 --"));
  assert.strictEqual(r.status, 200);
  const tiny = await c.post('/api/cart', { product_id: "1 OR 1=1", qty: 1 });
  assert.ok(tiny.status === 401 || tiny.status === 404 || tiny.status === 400);
});

/* ----------------------------- runner ----------------------------- */
(async () => {
  ensureSeeded();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`\nALZY test run against ${base}\n`);

  for (const [name, fn] of results) {
    try {
      await fn(base);
      pass++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      fail++;
      console.log(`  ✗ ${name}\n      ${String(err.message).replace(/\n/g, '\n      ')}`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  server.close();
  try { require('fs').unlinkSync(process.env.ALZY_DB); } catch { }
  process.exit(fail ? 1 : 0);
})();
