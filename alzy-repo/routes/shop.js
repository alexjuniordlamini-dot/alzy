'use strict';
const express = require('express');
const { connect } = require('../db');
const { render, productCard, stars, emptyState, esc, money, dateFmt, errorPage } = require('../lib/layout');
const Q = require('../lib/queries');
const config = require('../lib/config');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts,
  user: req.user,
  seller: req.seller,
  cartCount: res.locals.cartCount,
  currentPath: req.path
});

/* ------------------------------------------------------------ home */
router.get('/', (req, res) => {
  const db = connect();
  const cats = Q.categoriesWithCounts();
  const deals = Q.productList({ deals: true, sort: 'discount', limit: 8 }).items;
  const featured = Q.productList({ featured: true, sort: 'featured', limit: 8 }).items;
  const groceries = Q.productList({ tab: 'pantry', sort: 'relevance', limit: 12 }).items;
  const packaging = Q.productList({ tab: 'packaging', sort: 'relevance', limit: 4 }).items;
  const meat = Q.productList({ tab: 'meat', sort: 'relevance', limit: 4 }).items;
  const produce = Q.productList({ tab: 'produce', sort: 'relevance', limit: 4 }).items;
  const sellers = Q.topSellers(6);
  const videos = Q.videoCoupons({ limit: 3 });
  const stats = db.prepare(`
    SELECT (SELECT count(*) FROM products WHERE status='active') AS products,
           (SELECT count(*) FROM sellers) AS sellers,
           (SELECT count(*) FROM orders) AS orders,
           (SELECT coalesce(sum(subtotal - discount_total),0) FROM orders WHERE status != 'cancelled') AS gmv`).get();
  const regions = [...new Set(db.prepare('SELECT DISTINCT region FROM products WHERE region IS NOT NULL').all().map(r => r.region))].sort();
  const flash = res.locals.flash;

  const catIcon = (c) => `<span class="cat-ico" style="background:var(--paper-3)"><img src="/art/category/${encodeURIComponent(c.slug)}" alt="" width="46" height="46" style="border-radius:12px"></span>`;

  res.send(view(req, res, {
    title: 'Farm-fresh food & wholesale, direct from Eswatini',
    bodyClass: 'page-home',
    body: `
    ${flash ? `<div class="flash flash-${esc(flash.type)}" role="status">${esc(flash.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <section class="hero">
      <div class="hero-bg"><img src="/images/hero-eswatini.jpg" alt="Smallholder farmers harvesting vegetables in the Eswatini highveld at golden hour" width="1600" height="900" fetchpriority="high"></div>
      <div class="hero-inner">
        <p class="eyebrow">Eswatini’s agriculture &amp; food marketplace</p>
        <h1 class="hero-title">The whole harvest.<br><em>One fair market.</em></h1>
        <p class="hero-lede">Buy a single jar or a whole pallet — straight from Eswatini farmers, processors and suppliers. Supermarkets, restaurants, wholesalers and families, all shopping the same honest prices.</p>
        <form class="hero-search" action="/shop" method="get" role="search">
          <div class="search-shell">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#5c6f64" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
            <input type="search" name="q" placeholder="Search tomatoes, maize meal, 500ml bottles, honey…" aria-label="Search the marketplace">
            <div class="select-wrap">
              <select name="tab" aria-label="Department">
                <option value="">All departments</option>
                <option value="produce">Fresh produce</option>
                <option value="meat">Meat &amp; fish</option>
                <option value="pantry">Pantry &amp; groceries</option>
                <option value="packaging">Packaging</option>
                <option value="supplies">Farm supplies</option>
              </select>
            </div>
            <button class="btn btn-primary" type="submit">Search</button>
          </div>
        </form>
        <div class="search-suggestions">
          <a href="/shop?deals=1">Today’s deals</a>
          <a href="/shop?coupon_only=1">Coupon-only prices</a>
          <a href="/shop?tab=meat">Meat &amp; poultry</a>
          <a href="/groceries">Groceries under budget</a>
          <a href="/shop?tab=packaging">Glass &amp; plastic</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><b>${stats.products}</b><span>live listings</span></div>
          <div class="hero-stat"><b>${stats.sellers}</b><span>farms &amp; suppliers</span></div>
          <div class="hero-stat"><b>${regions.length}</b><span>Eswatini regions</span></div>
          <div class="hero-stat"><b>${Math.round((stats.gmv || 0) / 100).toLocaleString('en-SZ')}</b><span>emalangeni traded</span></div>
        </div>
      </div>
    </section>

    <section class="trust">
      <div class="wrap trust-row">
        <span class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> Verified farms &amp; suppliers</span>
        <span class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> One jar or one pallet</span>
        <span class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> MoMo, card, EFT or cash</span>
        <span class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> Cold-chain logistics</span>
        <span class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> Coupon-only deals</span>
      </div>
    </section>

    <section class="section tight">
      <div class="wrap">
        <div class="section-head">
          <div><h2>Shop by department</h2></div>
          <a class="link-more" href="/shop">All ${stats.products} listings <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="cat-rail">
          ${cats.map(c => `<a class="cat-chip" href="/shop?category=${encodeURIComponent(c.slug)}">${catIcon(c)}<span>${esc(c.name)}</span></a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section tight" style="padding-top:8px">
      <div class="wrap">
        <div class="stats-band">
          <a class="stat-card" href="/groceries">
            <div class="eyebrow" style="margin-bottom:10px">Households</div>
            <b style="font-size:22px">Monthly groceries</b>
            <span>Fill the month from E300 — lowest verified prices.</span>
          </a>
          <a class="stat-card" href="/wholesale">
            <div class="eyebrow" style="margin-bottom:10px">Companies</div>
            <b style="font-size:22px">Wholesale &amp; bulk</b>
            <span>Supermarkets, restaurants, processors, wholesalers.</span>
          </a>
          <a class="stat-card" href="/packaging">
            <div class="eyebrow" style="margin-bottom:10px">Packaging</div>
            <b style="font-size:22px">Glass, plastic &amp; bags</b>
            <span>Bottles, jars, punnets, kraft bags, covers.</span>
          </a>
          <a class="stat-card" href="/brand-studio">
            <div class="eyebrow" style="margin-bottom:10px">Own brand</div>
            <b style="font-size:22px">Brand Studio</b>
            <span>Your label, our fill line, from 300 units.</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="eyebrow">Coupon-only discounts</p>
            <h2>Prices you have to unlock.</h2>
            <p class="lede">These deals aren’t automatic. Open a listing, watch the supplier’s video to the very end inside ALZY, and your coupon is generated instantly — then it’s yours to spend.</p>
          </div>
          <a class="link-more" href="/coupons">How coupons work <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="coupon-grid four">
          <div class="coupon" style="background:linear-gradient(160deg,#0f3d2a,#184b32);color:#fff;justify-content:space-between">
            <div class="coupon-body" style="gap:12px;padding:24px">
              <span class="pill" style="background:rgba(255,255,255,.14);color:#dff5b3">Watch → earn → save</span>
              <h3 style="font-size:23px;color:#fff;letter-spacing:-.03em">The price is locked behind a video.</h3>
              <p class="small" style="color:#b9ccbf;line-height:1.6">Open the listing, watch the seller's video to the very end without leaving ALZY, like it — and the coupon lands on your account automatically.</p>
              <div class="btn-row" style="margin-top:4px"><a class="btn btn-lime btn-sm" href="/coupons">See all coupon deals</a></div>
            </div>
            <div style="padding:0 24px 24px">
              <div style="display:flex;gap:8px;align-items:center;font-size:11.5px;color:#9db8a6">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg> Real YouTube player embedded in ALZY
              </div>
            </div>
          </div>
          ${videos.map(v => `
            <a class="coupon" href="/coupons/${v.id}">
              <div class="coupon-media">
                <img src="/art/coupon/${v.id}" alt="${esc(v.title)}" loading="lazy">
                <div class="coupon-play"><span><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5l11 7-11 7V5Z"/></svg></span></div>
                <span class="coupon-duration">${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</span>
              </div>
              <div class="coupon-body">
                <span class="pill pill-soft">Watch to unlock</span>
                <strong style="font-size:15.5px;letter-spacing:-.015em">${esc(v.title)}</strong>
                <span class="small muted">${esc(v.seller_name || 'ALZY marketplace')} · ${v.uses} of ${v.max_uses} claimed</span>
              </div>
            </a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <p class="eyebrow">Supplier-led savings</p>
            <h2>Today’s best value.</h2>
            <p class="lede">Straight price cuts from farmers and suppliers — no coupon needed.</p>
          </div>
          <a class="link-more" href="/shop?deals=1">All deals <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="grid cols-4">${deals.slice(0, 8).map(p => productCard(p)).join('')}</div>
      </div>
    </section>

    <section class="section tight">
      <div class="wrap">
        <div class="tile-grid">
          <a class="tile" href="/shop?tab=produce">
            <img class="tile-bg" src="/images/tile-produce.jpg" alt="Freshly harvested Eswatini vegetables" loading="lazy">
            <div><h3>Fresh from the farm</h3><p>Vegetables, fruit and herbs harvested this week — with harvest dates on every listing.</p><span class="tile-cta">Shop produce <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>
          </a>
          <a class="tile" href="/wholesale">
            <img class="tile-bg" src="/images/tile-wholesale.jpg" alt="Wholesale cold-room with stacked produce crates" loading="lazy">
            <div><h3>Wholesale</h3><p>Carton, pallet and carcass pricing for supermarkets, restaurants and processors.</p><span class="tile-cta">Buy bulk <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>
          </a>
          <a class="tile" href="/packaging">
            <img class="tile-bg" src="/images/tile-packaging.jpg" alt="Glass jars, bottles and kraft bags" loading="lazy">
            <div><h3>Packaging</h3><p>Glass, plastic, paper bags and covers — low minimums for new brands.</p><span class="tile-cta">Browse packaging <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>
          </a>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <div class="split">
          <div>
            <p class="eyebrow">Monthly groceries</p>
            <h2 class="page-title">Do the month’s food shop<br>without overspending.</h2>
            <p class="lede">Tell ALZY your budget and household size. We build a basket from the cheapest verified pantry, meat and produce listings — the same wholesale prices supermarkets buy at.</p>
            <div class="feature-list">
              <div class="feature-item"><span class="fi-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M6 6l1.5 13h9L18 6M9 10v5M15 10v5"/></svg></span><div><h4>Set your budget, get a basket</h4><p>From E500 to E5,000 — we fill your month with the best value in the market.</p></div></div>
              <div class="feature-item"><span class="fi-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 5 5L20 7"/></svg></span><div><h4>Only verified, graded stock</h4><p>Every seller is checked for food safety and honest grading before listing.</p></div></div>
              <div class="feature-item"><span class="fi-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="13" height="9" rx="2"/><path d="M15 10h4l3 3v3h-7v-6Z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg></span><div><h4>One delivery, coordinated</h4><p>Multiple sellers, one ALZY delivery run. Distance-based coordination, not surprise fees.</p></div></div>
            </div>
            <div class="btn-row" style="margin-top:28px">
              <a class="btn btn-primary" href="/groceries">Build my grocery basket</a>
              <a class="btn btn-ghost" href="/coupons">See coupon deals</a>
            </div>
          </div>
          <div class="split-art"><img src="/images/tile-grocery.jpg" alt="A monthly grocery haul laid out on a kitchen counter" width="1200" height="900" loading="lazy"></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div><p class="eyebrow">Featured listings</p><h2>Promoted by our sellers.</h2><p class="lede">Featured placements put a farm or supplier in front of thousands of buyers.</p></div>
          <a class="link-more" href="/sell#featured">Feature your listing <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="grid cols-4">${featured.slice(0, 8).map(p => productCard(p)).join('')}</div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <div class="section-head">
          <div><p class="eyebrow">Pantry &amp; groceries</p><h2>Stock the cupboard.</h2></div>
          <a class="link-more" href="/groceries">Build a basket <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
        <div class="grid cols-4">${groceries.slice(0, 8).map(p => productCard(p)).join('')}</div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head"><div><p class="eyebrow">Meet the market</p><h2>Farms and suppliers you can trust.</h2></div><a class="link-more" href="/shop?seller_sort=1">All sellers <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
        <div class="grid cols-3">
          ${sellers.map(s => `
            <a class="panel" href="/seller/${encodeURIComponent(s.slug)}" style="padding:20px;display:flex;gap:14px;align-items:start">
              <img src="/art/seller/${encodeURIComponent(s.slug)}" alt="" width="56" height="56" style="border-radius:14px;width:56px;height:56px">
              <div style="min-width:0">
                <div style="display:flex;align-items:center;gap:5px"><b style="font-size:14.5px">${esc(s.name)}</b>${s.verified ? '<svg viewBox="0 0 24 24" width="12" height="12" style="color:var(--leaf)" aria-label="Verified"><path d="m12 2 2.4 2.2 3.2-.4 1 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-1 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-1-3.1L2.5 15.6l1-3.1-1-3.1 2.9-1.5 1-3.1 3.2.4Z" fill="currentColor"/><path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</div>
                <div class="small muted" style="margin:2px 0 6px">${esc(s.tagline || '')}</div>
                <div class="tag-row"><span class="pill pill-quiet">${esc(s.region)}</span><span class="pill pill-quiet">${s.product_count} listings</span></div>
                <div style="margin-top:8px">${stars(s.rating, s.rating_count)}</div>
              </div>
            </a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section dark">
      <div class="wrap">
        <div class="split">
          <div>
            <p class="eyebrow" style="color:var(--lime)">For farmers &amp; suppliers</p>
            <h2 class="page-title">Sell to the whole country.<br>Keep more of every sale.</h2>
            <p class="lede">List your harvest in minutes. Reach supermarkets, restaurants, wholesalers and families across Eswatini. Commissions start at 4% on the Pro plan.</p>
            <div class="hero-stats" style="margin-top:32px">
              <div class="hero-stat"><b>4%</b><span>lowest commission</span></div>
              <div class="hero-stat"><b>0</b><span>listing fees</span></div>
              <div class="hero-stat"><b>7 days</b><span>featured rotation</span></div>
            </div>
            <div class="btn-row" style="margin-top:32px">
              <a class="btn btn-lime" href="/sell">Start selling on ALZY</a>
              <a class="btn btn-outline-white" href="/about#pricing">See fees</a>
            </div>
          </div>
          <div class="split-art photo">
            <img src="/images/tile-wholesale.jpg" alt="Wholesale cold room stocked with produce" width="1200" height="900" loading="lazy">
          </div>
        </div>
      </div>
    </section>

    <section class="section tight">
      <div class="wrap">
        <div class="stats-band">
          <div class="stat-card"><b>${stats.orders}</b><span>orders coordinated</span></div>
          <div class="stat-card"><b>${money(Math.round(stats.gmv))}</b><span>goods traded on ALZY</span></div>
          <div class="stat-card"><b>${stats.sellers}</b><span>farms, processors &amp; suppliers</span></div>
          <div class="stat-card"><b>${regions.length}</b><span>regions with delivery</span></div>
        </div>
      </div>
    </section>
    `
  }));
});

/* ------------------------------------------------------------ shop */
function priceRange(min, max, step = 1) {
  return { min, max, step };
}

router.get('/shop', (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page || 1));
  const limit = 24;
  const opts = {
    q: (q.q || '').trim() || undefined,
    category: q.category || undefined,
    tab: q.tab || undefined,
    seller: q.seller || undefined,
    min: q.min, max: q.max,
    deals: q.deals === '1' || q.deals === 'on',
    featured: q.featured === '1',
    couponOnly: q.coupon_only === '1',
    budget: q.budget,
    moqLte: q.moq_small ? 1 : undefined,
    sort: q.sort || 'relevance',
    limit, offset: (page - 1) * limit
  };
  const { items, total } = Q.productList(opts);
  const cats = Q.categoriesWithCounts();
  const db = connect();
  const regions = db.prepare("SELECT region, count(*) AS n FROM products WHERE region IS NOT NULL AND status='active' GROUP BY region ORDER BY n DESC").all();
  const activeCat = cats.find(c => c.slug === q.category);
  const pages = Math.ceil(total / limit);
  const flash = res.locals.flash;

  const qs = (over = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...q, ...over }).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) p.set(k, v); });
    return '/shop?' + p.toString();
  };

  res.send(view(req, res, {
    title: activeCat ? `${activeCat.name} — ALZY marketplace` : (q.q ? `Search: ${q.q}` : 'Shop the marketplace'),
    body: `
    ${flash ? `<div class="flash flash-${esc(flash.type)}" role="status">${esc(flash.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span>${activeCat ? `<a href="/shop">Shop</a><span>/</span><span>${esc(activeCat.name)}</span>` : '<span>Shop</span>'}${q.q ? `<span>/</span><span>“${esc(q.q)}”</span>` : ''}</nav>
      <div class="section-head" style="margin-bottom:20px">
        <div>
          <h1 class="page-title">${activeCat ? esc(activeCat.name) : q.q ? `Results for “${esc(q.q)}”` : 'The whole market'}</h1>
          <p class="lede">${total.toLocaleString()} listings from verified Eswatini farms, processors and suppliers. Single units or bulk — filter it your way.</p>
        </div>
      </div>
      <div class="shop-bar">
        <div class="tabs">
          <a class="tab ${!q.tab ? 'is-active' : ''}" href="${qs({ tab: '', category: '', page: '' })}">All</a>
          <a class="tab ${q.tab === 'produce' ? 'is-active' : ''}" href="${qs({ tab: 'produce', category: '', page: '' })}">Fresh produce</a>
          <a class="tab ${q.tab === 'meat' ? 'is-active' : ''}" href="${qs({ tab: 'meat', category: '', page: '' })}">Meat &amp; fish</a>
          <a class="tab ${q.tab === 'pantry' ? 'is-active' : ''}" href="${qs({ tab: 'pantry', category: '', page: '' })}">Pantry</a>
          <a class="tab ${q.tab === 'packaging' ? 'is-active' : ''}" href="${qs({ tab: 'packaging', category: '', page: '' })}">Packaging</a>
          <a class="tab ${q.tab === 'supplies' ? 'is-active' : ''}" href="${qs({ tab: 'supplies', category: '', page: '' })}">Farm supplies</a>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <span class="result-count">${total.toLocaleString()} results</span>
          <form method="get" action="/shop">
            ${Object.entries(q).filter(([k]) => k !== 'sort' && k !== 'page').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
            <select class="sort-select" name="sort" data-autosubmit aria-label="Sort by">
              ${[['relevance', 'Best match'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['discount', 'Biggest discount'], ['rating', 'Top rated sellers'], ['newest', 'Newest']]
                .map(([v, l]) => `<option value="${v}" ${opts.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </form>
        </div>
      </div>

      <div class="shop-shell">
        <aside class="filters">
          <div class="filter-group">
            <h4>Department</h4>
            <div class="filter-list">
              <a href="${qs({ category: '', tab: '', page: '' })}" class="${!q.category && !q.tab ? 'is-active' : ''}">All departments<span>${cats.reduce((n, c) => n + c.count, 0)}</span></a>
              ${cats.map(c => `<a href="${qs({ category: c.slug, tab: '', page: '' })}" class="${q.category === c.slug ? 'is-active' : ''}">${esc(c.name)}<span>${c.count}</span></a>`).join('')}
            </div>
          </div>
          <div class="filter-group">
            <h4>Offers</h4>
            <a class="check" href="${qs({ deals: q.deals === '1' ? '' : '1', page: '' })}">
              <input type="checkbox" ${q.deals === '1' ? 'checked' : ''} tabindex="-1"> Discounted listings
            </a>
            <a class="check" href="${qs({ coupon_only: q.coupon_only === '1' ? '' : '1', page: '' })}">
              <input type="checkbox" ${q.coupon_only === '1' ? 'checked' : ''} tabindex="-1"> Coupon video deals only
            </a>
            <a class="check" href="${qs({ featured: q.featured === '1' ? '' : '1', page: '' })}">
              <input type="checkbox" ${q.featured === '1' ? 'checked' : ''} tabindex="-1"> Featured sellers
            </a>
          </div>
          <div class="filter-group">
            <h4>Price (E)</h4>
            <form method="get" action="/shop" style="display:grid;gap:8px">
              ${Object.entries(q).filter(([k]) => !['min', 'max', 'page'].includes(k)).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
              <div class="price-inputs">
                <input type="number" name="min" placeholder="Min" value="${esc(q.min || '')}" min="0" step="1">
                <span class="muted tiny">to</span>
                <input type="number" name="max" placeholder="Max" value="${esc(q.max || '')}" min="0" step="1">
              </div>
              <div class="tag-row">
                <a class="pill pill-quiet" href="${qs({ min: '0', max: '50', page: '' })}">Under E50</a>
                <a class="pill pill-quiet" href="${qs({ min: '50', max: '200', page: '' })}">E50–200</a>
                <a class="pill pill-quiet" href="${qs({ min: '200', max: '800', page: '' })}">E200–800</a>
                <a class="pill pill-quiet" href="${qs({ min: '800', max: '', page: '' })}">E800+</a>
              </div>
              <button class="btn btn-ghost btn-sm" type="submit">Apply price</button>
            </form>
          </div>
          <div class="filter-group">
            <h4>Region</h4>
            <div class="filter-list">
              ${regions.map(r => `<span class="small" style="padding:5px 10px;display:flex;justify-content:space-between"><span>${esc(r.region)}</span><span class="muted-2">${r.n}</span></span>`).join('')}
            </div>
          </div>
          <div class="filter-group">
            <div class="note">“Bulk” listings have minimum order quantities. Small households can still buy single units from <a href="/shop?moq_small=1" style="color:var(--leaf);font-weight:600">listings with no minimum</a>.</div>
          </div>
        </aside>

        <div>
          ${items.length ? `<div class="grid cols-3">${items.map(p => productCard(p)).join('')}</div>` :
            emptyState({ title: 'Nothing matched that', message: 'Try a wider price range, another department, or search a different word.', action: 'Clear filters', href: '/shop' })}
          ${pages > 1 ? `
          <div class="btn-row center" style="margin-top:36px;justify-content:center">
            ${page > 1 ? `<a class="btn btn-ghost" href="${qs({ page: page - 1 })}">← Previous</a>` : ''}
            <span class="small muted">Page ${page} of ${pages}</span>
            ${page < pages ? `<a class="btn btn-ghost" href="${qs({ page: page + 1 })}">Next →</a>` : ''}
          </div>` : ''}
        </div>
      </div>
      <div style="height:64px"></div>
    </div>`
  }));
});

/* ------------------------------------------------------------ product */
router.get('/product/:slug', (req, res) => {
  const p = Q.productBySlug(req.params.slug);
  if (!p) return res.status(404).send(errorPage({ user: req.user, title: 'Listing not found', code: '404', message: 'This listing may have sold out or been removed.' }));
  const db = connect();
  const related = Q.relatedProducts(p, 4);
  const coupon = Q.couponForProduct(p);
  const claim = req.user && coupon ? Q.claimFor(req.user.id, coupon.id) : null;
  const reviews = db.prepare(`SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 8`).all(p.id);
  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(p.seller_id);
  const isFav = req.user ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, p.id) : false;
  const discount = p.compare_price && p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const flash = res.locals.flash;
  const sellerOther = Q.productList({ sellerId: p.seller_id, limit: 4 }).items.filter(x => x.id !== p.id);

  const stockLabel = p.stock > 100 ? 'In stock' : p.stock > 20 ? `Only ${p.stock} left` : p.stock > 0 ? `Low stock — ${p.stock} left` : 'Sold out';

  res.send(view(req, res, {
    title: `${p.name} — ${p.seller_name}`,
    description: p.description,
    body: `
    ${flash ? `<div class="flash flash-${esc(flash.type)}" role="status">${esc(flash.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <div class="wrap" data-product-page>
      <nav class="breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span>
        <a href="/shop?category=${encodeURIComponent(p.category_slug)}">${esc(p.category_name)}</a><span>/</span><span>${esc(p.name)}</span>
      </nav>

      <div class="pdp">
        <div>
          <div class="pdp-media">
            <img src="/art/product/${encodeURIComponent(p.vessel)}/${encodeURIComponent(p.hue)}/${encodeURIComponent(p.icon)}?label=${encodeURIComponent(p.category_name)}" alt="${esc(p.name)}" width="640" height="640" fetchpriority="high">
          </div>
          <div class="pdp-thumbs">
            <button class="is-active" aria-label="Main image"><img src="/art/product/${encodeURIComponent(p.vessel)}/${encodeURIComponent(p.hue)}/${encodeURIComponent(p.icon)}?label=ALZY" alt=""></button>
            <button aria-label="Seller image"><img src="/art/seller/${encodeURIComponent(p.seller_slug)}" alt=""></button>
            <button aria-label="Category image"><img src="/art/category/${encodeURIComponent(p.category_slug)}" alt=""></button>
          </div>

          <div class="tabs-line" style="margin-top:36px">
            <button class="is-active" data-pdp-tab="about">About this listing</button>
            <button data-pdp-tab="seller">Seller</button>
            <button data-pdp-tab="reviews">Reviews (${reviews.length})</button>
          </div>

          <div data-pdp-panel="about">
            <p class="lede" style="margin-top:0">${esc(p.description || '')}</p>
            <table class="spec-table" style="margin-top:24px">
              <tr><td>Unit</td><td>${esc(p.unit)}</td></tr>
              <tr><td>Minimum order</td><td>${p.moq} ${esc(p.unit)}${p.moq > 1 ? 's' : ''}</td></tr>
              ${p.harvest_date ? `<tr><td>Harvest date</td><td>${dateFmt(p.harvest_date)}</td></tr>` : ''}
              <tr><td>Dispatch region</td><td>${esc(p.region || 'Eswatini')}</td></tr>
              <tr><td>Category</td><td>${esc(p.category_name)}</td></tr>
              <tr><td>Stock</td><td>${p.stock} ${esc(p.unit)}${p.stock === 1 ? '' : 's'} available</td></tr>
              <tr><td>Cold chain</td><td>${['meat-poultry', 'fish-seafood', 'dairy-eggs'].includes(p.category_slug) ? 'Yes — refrigerated delivery' : 'Ambient delivery'}</td></tr>
              <tr><td>Commission tier</td><td>${esc(config.revenue.subscriptions[p.seller_plan]?.label || 'Starter')} seller</td></tr>
            </table>
          </div>

          <div data-pdp-panel="seller" hidden>
            <div class="seller-line" style="margin-bottom:18px">
              <img src="/art/seller/${encodeURIComponent(p.seller_slug)}" alt="">
              <div style="flex:1">
                <b>${esc(seller.name)}</b>
                <div class="small muted">${esc(seller.tagline || '')}</div>
                ${stars(seller.rating, seller.rating_count)}
              </div>
              <a class="btn btn-ghost btn-sm" href="/seller/${encodeURIComponent(seller.slug)}">Visit store</a>
            </div>
            <p class="small muted" style="line-height:1.65">${esc(seller.description || '')}</p>
            <div class="tag-row" style="margin-top:14px">
              <span class="pill pill-quiet">${esc(seller.region)}</span>
              <span class="pill pill-quiet">Since ${esc(seller.since)}</span>
              ${seller.verified ? '<span class="pill pill-soft">Verified seller</span>' : ''}
              <span class="pill pill-quiet">${esc(config.revenue.subscriptions[seller.plan]?.label || 'Starter')} plan</span>
            </div>
            ${req.user ? `<form method="post" action="/messages/start" style="margin-top:20px;display:grid;gap:10px;max-width:520px">
              <input type="hidden" name="product_id" value="${p.id}">
              <input type="hidden" name="seller_id" value="${p.seller_id}">
              <div class="field"><label for="msg">Message the seller</label><textarea id="msg" name="body" rows="3" placeholder="Hi ${esc(seller.name.split(' ')[0])}, I'd like to ask about…" required></textarea></div>
              <button class="btn btn-dark btn-sm" type="submit" style="justify-self:start">Send message</button>
            </form>` : `<a class="btn btn-dark btn-sm" style="margin-top:18px" href="/login?next=${encodeURIComponent(req.originalUrl)}">Sign in to message this seller</a>`}
          </div>

          <div data-pdp-panel="reviews" hidden>
            ${reviews.length ? reviews.map(r => `
              <div class="review">
                <div class="review-head"><div style="display:flex;gap:10px;align-items:center"><span class="avatar">${esc(r.user_name.slice(0, 2).toUpperCase())}</span><b>${esc(r.user_name)}</b></div>${stars(r.rating)}</div>
                <p class="small muted" style="margin-top:6px">${esc(r.comment || '')}</p>
              </div>`).join('') : '<p class="muted small">No reviews yet — be the first after your delivery.</p>'}
          </div>
        </div>

        <aside class="pdp-buy">
          <div class="tag-row" style="margin-bottom:12px">
            ${p.featured ? '<span class="pill pill-featured">Featured listing</span>' : ''}
            ${discount ? `<span class="pill pill-deal">−${discount}%</span>` : ''}
            <span class="pill pill-quiet">${esc(stockLabel)}</span>
          </div>
          <h1 class="page-title" style="font-size:clamp(26px,3vw,36px)">${esc(p.name)}</h1>
          <div style="display:flex;align-items:center;gap:12px;margin:14px 0 18px">
            ${stars(seller.rating, seller.rating_count)}
            <a class="small" style="color:var(--leaf);font-weight:600" href="/seller/${encodeURIComponent(seller.slug)}">${esc(p.seller_name)}</a>
            ${p.seller_verified ? '<span class="pill pill-soft">Verified</span>' : ''}
          </div>
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <span class="price-big">${money(p.price)}</span>
            <span class="pc-unit" style="font-size:13px">per ${esc(p.unit)}</span>
            ${p.compare_price ? `<s style="font-size:16px">${money(p.compare_price)}</s>` : ''}
          </div>
          ${discount ? `<div style="margin-top:8px"><span class="save-badge">You save ${money(p.compare_price - p.price)} (${discount}%)</span></div>` : ''}

          ${coupon ? `
          <div class="reveal-card" style="margin:20px 0;text-align:left">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span class="pill pill-lime">Coupon-only price</span>
              ${claim && claim.status !== 'watching' ? '<span class="pill pill-soft">Coupon unlocked</span>' : ''}
            </div>
            <b style="font-size:15px">${esc(coupon.title)}</b>
            <p class="small" style="color:var(--green-2);margin-top:6px;opacity:.85">${esc(coupon.description || '')}</p>
            ${claim && claim.status !== 'watching'
              ? `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="coupon-code">${esc(coupon.code)}</span><button class="btn btn-ghost btn-sm" data-copy="${esc(coupon.code)}">Copy</button></div>
                 <p class="tiny" style="margin-top:8px;opacity:.75">Use it at checkout. ${claim.status === 'used' ? 'Already used once.' : 'Valid on your next order.'}</p>`
              : `<a class="btn btn-primary btn-sm" style="margin-top:12px" href="/coupons/${coupon.id}">${claim ? 'Continue watching' : 'Watch video & get coupon'} · ${Math.floor(coupon.duration / 60)}:${String(coupon.duration % 60).padStart(2, '0')}</a>
                 <p class="tiny" style="margin-top:8px;opacity:.75">Watch the whole video here on ALZY to generate your coupon automatically.</p>`}
          </div>` : ''}

          <div class="buy-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div>
                <div class="tiny muted" style="margin-bottom:6px">Quantity (${esc(p.unit)}${p.moq > 1 ? `s, min ${p.moq}` : ''})</div>
                <div class="qty-stepper" data-stepper>
                  <button type="button" data-dec aria-label="Decrease">−</button>
                  <input type="number" value="${p.moq}" min="${p.moq}" step="${p.step}" data-qty-input aria-label="Quantity">
                  <button type="button" data-inc aria-label="Increase">+</button>
                </div>
              </div>
              <div style="text-align:right">
                <div class="tiny muted">Bulk? From ${p.moq} ${esc(p.unit)}${p.moq > 1 ? 's' : ''}</div>
                <b class="mono" style="font-size:18px">${money(p.price * p.moq)}</b>
              </div>
            </div>
            <div class="btn-row" style="margin-top:16px">
              <button class="btn btn-dark btn-lg" style="flex:1" data-add="${p.id}" data-use-qty ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Sold out' : 'Add to cart'}</button>
              <button class="fav-btn" style="position:static;width:48px;height:48px;border:1px solid var(--line);background:#fff;${isFav ? 'color:var(--clay)' : ''}" data-fav="${p.id}" aria-label="Save this listing" aria-pressed="${isFav}">
                <svg viewBox="0 0 24 24" width="19" height="19" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20.5S3.8 15 3.8 9.4A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.2 3.2C20.2 15 12 20.5 12 20.5Z"/></svg>
              </button>
            </div>
            <div style="display:grid;gap:9px;margin-top:18px">
              <div class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 5 5L20 7"/></svg> Coordinated delivery from ${esc(p.region || 'Eswatini')}</div>
              <div class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 5 5L20 7"/></svg> Pay by MoMo, card, EFT or cash on delivery</div>
              <div class="trust-item"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 5 5L20 7"/></svg> Quality checked on delivery — report within 24h</div>
            </div>
          </div>

          <div class="note" style="margin-top:14px">
            <b style="color:var(--ink)">Selling here?</b> ALZY takes ${Math.round((config.revenue.commissionByTier[seller.plan] || 0.06) * 100)}% commission on this seller’s plan. <a href="/sell#pricing" style="color:var(--leaf);font-weight:600">See plans</a>
          </div>
        </aside>
      </div>

      <section class="section tight" style="margin-top:40px">
        <div class="section-head"><div><h2 style="font-size:26px">More from ${esc(seller.name)}</h2></div><a class="link-more" href="/seller/${encodeURIComponent(seller.slug)}">Visit store</a></div>
        <div class="grid cols-4">${sellerOther.map(x => productCard(x)).join('')}</div>
      </section>

      <section class="section tight" style="padding-bottom:80px">
        <div class="section-head"><div><h2 style="font-size:26px">Buyers also considered</h2></div></div>
        <div class="grid cols-4">${related.map(x => productCard(x)).join('')}</div>
      </section>
    </div>

    <div class="buybar">
      <div class="price">${money(p.price)}</div>
      <button class="btn btn-dark" data-add="${p.id}">Add to cart</button>
    </div>`
  }));
});

/* ------------------------------------------------------------ seller storefront */
router.get('/seller/:slug', (req, res) => {
  const seller = Q.sellerBySlug(req.params.slug);
  if (!seller) return res.status(404).send(errorPage({ user: req.user, title: 'Seller not found', code: '404', message: 'That store does not exist.' }));
  const products = Q.productList({ seller: seller.slug, limit: 60 }).items;
  const db = connect();
  const reviews = db.prepare(`
    SELECT r.*, u.name AS user_name, p.name AS product_name FROM reviews r
    JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id
    WHERE p.seller_id = ? ORDER BY r.created_at DESC LIMIT 6`).all(seller.id);
  const coupon = db.prepare("SELECT * FROM coupons WHERE seller_id = ? AND kind='video' AND active=1 LIMIT 1").get(seller.id);

  res.send(view(req, res, {
    title: `${seller.name} — ALZY seller`,
    body: `
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop">Shop</a><span>/</span><span>${esc(seller.name)}</span></nav>
      <div class="panel" style="padding:clamp(20px,3vw,34px);margin-bottom:32px">
        <div style="display:flex;gap:20px;align-items:start;flex-wrap:wrap">
          <img src="/art/seller/${encodeURIComponent(seller.slug)}" alt="" width="88" height="88" style="width:88px;height:88px;border-radius:22px">
          <div style="flex:1;min-width:260px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <h1 class="page-title" style="font-size:clamp(24px,3vw,34px)">${esc(seller.name)}</h1>
              ${seller.verified ? '<span class="pill pill-soft">Verified</span>' : ''}
              <span class="pill pill-quiet">${esc(seller.kind === 'farm' ? 'Farm' : seller.kind === 'packaging' ? 'Packaging' : seller.kind === 'processor' ? 'Processor' : 'Supplier')}</span>
            </div>
            <p class="lede" style="margin-top:8px;font-size:15px">${esc(seller.tagline || '')}</p>
            <div style="display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap">
              ${stars(seller.rating, seller.rating_count)}<span class="small muted">${esc(seller.region)} · Since ${esc(seller.since)}</span>
            </div>
          </div>
          <div style="display:grid;gap:8px;min-width:180px">
            <div class="stat-card" style="padding:14px 18px"><b style="font-size:22px">${seller.product_count}</b><span>live listings</span></div>
            <div class="stat-card" style="padding:14px 18px"><b style="font-size:22px">${money(seller.gmv)}</b><span>traded on ALZY</span></div>
          </div>
        </div>
        <p class="small muted" style="margin-top:20px;max-width:80ch;line-height:1.65">${esc(seller.description || '')}</p>
        ${coupon ? `<a class="btn btn-primary btn-sm" style="margin-top:18px" href="/coupons/${coupon.id}">Watch &amp; unlock ${coupon.type === 'percent' ? coupon.value + '% off' : money(coupon.value) + ' off'} this store</a>` : ''}
      </div>

      <div class="section-head"><div><h2 style="font-size:26px">Listings</h2></div><span class="small muted">${products.length} products · bulk &amp; single units</span></div>
      <div class="grid cols-4" style="padding-bottom:64px">${products.map(p => productCard(p)).join('')}</div>

      ${reviews.length ? `<section class="section tight" style="padding-bottom:80px"><div class="section-head"><div><h2 style="font-size:24px">Buyer reviews</h2></div></div>
        <div class="grid cols-2">${reviews.map(r => `<div class="panel" style="padding:18px"><div class="review-head"><b>${esc(r.user_name)}</b>${stars(r.rating)}</div><p class="small muted">${esc(r.comment || '')}</p><span class="tiny muted">${esc(r.product_name)}</span></div>`).join('')}</div>
      </section>` : ''}
    </div>`
  }));
});

/* ------------------------------------------------------------ grocery builder */
router.get('/groceries', (req, res) => {
  const budget = Math.max(300, Number(req.query.budget || 1500));
  const size = req.query.size || '4';
  const db = connect();

  // Build a basket: cheapest-per-unit staples spread across departments.
  const plan = [
    { slug: 'grains-cereals', want: 3, label: 'Staples' },
    { slug: 'meat-poultry', want: 2, label: 'Protein' },
    { slug: 'fresh-vegetables', want: 3, label: 'Vegetables' },
    { slug: 'fruits', want: 1, label: 'Fruit' },
    { slug: 'dairy-eggs', want: 1, label: 'Dairy & eggs' },
    { slug: 'sauces-condiments', want: 1, label: 'Sauces' },
    { slug: 'beverages-drinks', want: 1, label: 'Drinks' },
    { slug: 'honey-preserves', want: 1, label: 'Preserves' },
    { slug: 'processed-foods', want: 1, label: 'Pantry' }
  ];
  let remaining = Math.round(budget * 100);
  const basket = [];
  for (const step of plan) {
    const options = Q.productList({ category: step.slug, sort: 'price_asc', limit: 8 }).items;
    let picked = 0;
    for (const p of options) {
      if (picked >= step.want || remaining < p.price) continue;
      const qty = Math.max(p.moq, 1);
      const cost = p.price * qty;
      if (cost > remaining) continue;
      basket.push({ p, qty, label: step.label });
      remaining -= cost; picked++;
    }
  }
  const total = basket.reduce((n, b) => n + b.p.price * b.qty, 0);
  const marketEstimate = Math.round(total * 1.28);
  const saved = marketEstimate - total;

  res.send(view(req, res, {
    title: 'Monthly grocery basket — shop a whole month on a budget',
    body: `
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Monthly groceries</span></nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">Grocery basket builder</p>
            <h1 class="page-title">Your month of food, on budget.</h1>
            <p class="lede">We build a basket from the cheapest verified staples, protein, produce and pantry lines in the market. Adjust your budget — the basket rebuilds instantly.</p>
          </div>
        </div>

        <form method="get" action="/groceries" class="panel" style="padding:22px;display:grid;gap:16px;margin-bottom:28px">
          <div class="field-row">
            <div class="field">
              <label for="budget">Monthly food budget — <b id="budgetLabel">E${budget.toLocaleString('en-SZ')}</b></label>
              <input id="budget" type="range" name="budget" min="300" max="8000" step="100" value="${budget}" style="accent-color:var(--green)"
                oninput="document.getElementById('budgetLabel').textContent='E'+Number(this.value).toLocaleString('en-SZ')">
              <div class="hint">From E300 to E8,000</div>
            </div>
            <div class="field">
              <label for="size">Household size</label>
              <select id="size" name="size">
                ${[['1', '1 person'], ['2', '2 people'], ['4', '3–4 people'], ['6', '5–6 people'], ['9', '7+ / extended family']]
                  .map(([v, l]) => `<option value="${v}" ${size === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              <div class="hint">Bigger households get more staple lines</div>
            </div>
          </div>
          <div class="btn-row"><button class="btn btn-primary" type="submit">Rebuild my basket</button>
          <button class="btn btn-ghost" type="button" id="addAllBtn">Add whole basket to cart</button></div>
        </form>

        <div class="kpi-grid">
          <div class="kpi"><span>Basket cost</span><b>${money(total)}</b><small>${basket.length} lines</small></div>
          <div class="kpi"><span>Typical supermarket</span><b>${money(marketEstimate)}</b><small style="color:var(--muted)">estimated retail</small></div>
          <div class="kpi"><span>You save</span><b style="color:var(--leaf)">${money(saved)}</b><small>${Math.round((saved / marketEstimate) * 100)}% lower</small></div>
          <div class="kpi"><span>Budget left</span><b>${money(Math.max(0, remaining))}</b><small>${remaining > 10000 ? 'room for treats' : 'tightly allocated'}</small></div>
        </div>

        ${basket.length ? `<div class="grid cols-4" data-basket>${basket.map(b => productCard(b.p)).join('')}</div>` :
          emptyState({ title: 'Raise your budget a little', message: 'At this budget we could not fill a balanced basket. Try E800 or more.', action: 'Try E1,500', href: '/groceries?budget=1500' })}

        <div class="note" style="margin-top:28px;display:flex;gap:14px;align-items:start;flex-wrap:wrap;justify-content:space-between">
          <div style="max-width:70ch"><b style="color:var(--ink)">How this works.</b> The builder picks the lowest price-per-unit listing in each department and fills your budget with volume lines — the same approach wholesalers use. Add coupons at checkout to save more. Prices update with each new listing; delivery is coordinated across sellers.</div>
          <a class="btn btn-ghost btn-sm" href="/coupons">Stack a coupon on top</a>
        </div>
      </div>
    </section>
    <script type="application/json" id="basketData">${JSON.stringify(basket.map(b => ({ id: b.p.id, qty: b.qty })))}</script>
    <script src="/js/groceries.js" defer></script>`
  }));
});

/* ------------------------------------------------------------ wholesale */
router.get('/wholesale', (req, res) => {
  const bulk = Q.productList({ tab: 'wholesale', sort: 'price_desc', limit: 12 }).items;
  const meat = Q.productList({ category: 'meat-poultry', sort: 'price_desc', limit: 8 }).items;
  const pantry = Q.productList({ category: 'grains-cereals', sort: 'price_desc', limit: 8 }).items;
  res.send(view(req, res, {
    title: 'Wholesale — bulk food supply for supermarkets, restaurants & processors',
    body: `
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Wholesale</span></nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">For companies &amp; bulk buyers</p>
            <h1 class="page-title">Buy the way businesses buy.</h1>
            <p class="lede">Carcass quarters, 25kg bags, cartons and pallets. Negotiate volume terms, get one coordinated delivery and a single invoice per order — even when goods come from several sellers.</p>
          </div>
          <div class="tags"><span class="pill pill-soft">VAT invoices</span> <span class="pill pill-soft">Standing orders</span> <span class="pill pill-soft">Cold chain</span></div>
        </div>
        <div class="stats-band" style="margin-bottom:36px">
          <div class="stat-card"><b>6%</b><span>default marketplace commission</span></div>
          <div class="stat-card"><b>E45+</b><span>logistics coordination from Mbabane</span></div>
          <div class="stat-card"><b>2</b><span>weekly consolidated runs per region</span></div>
          <div class="stat-card"><b>E2,500+</b><span>orders qualify for BULK250 coupon</span></div>
        </div>
        <div class="section-head"><div><h2 style="font-size:28px">Bulk staples &amp; cases</h2></div><a class="link-more" href="/shop?min=800&sort=price_desc">All wholesale-priced</a></div>
        <div class="grid cols-4">${bulk.map(p => productCard(p)).join('')}</div>
        <div class="section-head" style="margin-top:48px"><div><h2 style="font-size:28px">Meat &amp; poultry at scale</h2></div></div>
        <div class="grid cols-4">${meat.map(p => productCard(p)).join('')}</div>
        <div class="section-head" style="margin-top:48px"><div><h2 style="font-size:28px">Grain, flour &amp; milled staples</h2></div></div>
        <div class="grid cols-4">${pantry.map(p => productCard(p)).join('')}</div>
        <div style="height:64px"></div>
      </div>
    </section>`
  }));
});

/* ------------------------------------------------------------ packaging & brand studio */
router.get('/packaging', (req, res) => {
  const glass = Q.productList({ category: 'packaging-glass', limit: 8 }).items;
  const plastic = Q.productList({ category: 'packaging-plastic', limit: 8 }).items;
  const bags = Q.productList({ category: 'bags-wraps', limit: 8 }).items;
  const label = Q.productList({ category: 'private-label', limit: 4 }).items;
  res.send(view(req, res, {
    title: 'Packaging — glass, plastic, bags & own-brand packaging',
    body: `
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Packaging</span></nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">Packaging &amp; private label</p>
            <h1 class="page-title">Everything you need to bottle, jar, wrap and brand.</h1>
            <p class="lede">Glass bottles and jars, PET and HDPE, punnets, buckets, takeaway boxes, kraft bags, cling film and covers — with low minimums so a new food brand can start small.</p>
          </div>
          <a class="btn btn-dark" href="/brand-studio">Start my own brand</a>
        </div>
        <div class="section-head"><div><h2 style="font-size:28px">Glass jars &amp; bottles</h2></div><a class="link-more" href="/shop?category=packaging-glass">All glass</a></div>
        <div class="grid cols-4">${glass.map(p => productCard(p)).join('')}</div>
        <div class="section-head" style="margin-top:48px"><div><h2 style="font-size:28px">Plastic containers &amp; bottles</h2></div><a class="link-more" href="/shop?category=packaging-plastic">All plastic</a></div>
        <div class="grid cols-4">${plastic.map(p => productCard(p)).join('')}</div>
        <div class="section-head" style="margin-top:48px"><div><h2 style="font-size:28px">Bags, wraps &amp; covers</h2></div><a class="link-more" href="/shop?category=bags-wraps">All bags</a></div>
        <div class="grid cols-4">${bags.map(p => productCard(p)).join('')}</div>
        <div class="section-head" style="margin-top:48px"><div><h2 style="font-size:28px">Private label services</h2></div><a class="link-more" href="/brand-studio">Brand Studio</a></div>
        <div class="grid cols-4">${label.map(p => productCard(p)).join('')}</div>
        <div style="height:64px"></div>
      </div>
    </section>`
  }));
});

/* ------------------------------------------------------------ about */
router.get('/about', (req, res) => {
  res.send(view(req, res, {
    title: 'About ALZY — how the marketplace works and how it earns',
    body: `
    <section class="section tight">
      <div class="wrap narrow">
        <p class="eyebrow">About ALZY</p>
        <h1 class="page-title">A fairer food market for Eswatini.</h1>
        <p class="lede">ALZY connects farmers directly with supermarkets, restaurants, wholesalers, food processors, agricultural suppliers and individual buyers. Farmers advertise produce, quantities, prices and harvest dates. Buyers place single-unit or bulk orders. ALZY coordinates the delivery.</p>
      </div>
    </section>
    <section class="section alt" id="how-it-works">
      <div class="wrap">
        <div class="section-head"><div><p class="eyebrow">How it works</p><h2>Four steps, no middlemen.</h2></div></div>
        <div class="grid cols-4">
          ${[['List', 'Farmers and suppliers publish produce, quantities, prices and harvest dates.'],
             ['Discover', 'Buyers browse departments, filter by price or budget and unlock coupon deals.'],
             ['Order', 'Single units or wholesale volumes — with one cart across many sellers.'],
             ['Deliver', 'ALZY logistics coordinates a single route, cold chain included where needed.']]
            .map(([t, d], i) => `<div class="panel" style="padding:24px"><div style="font-size:12px;font-weight:700;color:var(--leaf);letter-spacing:.1em">STEP ${i + 1}</div><h3 style="font-size:19px;margin:8px 0 6px">${t}</h3><p class="small muted" style="line-height:1.6">${d}</p></div>`).join('')}
        </div>
      </div>
    </section>
    <section class="section" id="pricing">
      <div class="wrap">
        <div class="section-head"><div><p class="eyebrow">How ALZY earns</p><h2>Transparent revenue, from four lines.</h2><p class="lede">No listing fees, no surprises. Sellers keep the rest.</p></div></div>
        <div class="grid cols-2">
          <div class="panel" style="padding:26px"><span class="pill pill-soft">01</span><h3 style="font-size:21px;margin:10px 0 8px">Transaction commission</h3><p class="small muted">6% on the goods subtotal by default — 8% on Starter, 6% on Growth and 4% on Pro. Charged per seller line so multi-seller orders settle fairly.</p><div class="kpi" style="margin-top:16px"><span>Commission range</span><b>4–8%</b><small>per completed order</small></div></div>
          <div class="panel" style="padding:26px"><span class="pill pill-soft">02</span><h3 style="font-size:21px;margin:10px 0 8px">Supplier subscriptions</h3><p class="small muted">Monthly plans for suppliers who want unlimited listings, verification, campaign tools and lower commission.</p><div class="kpi" style="margin-top:16px"><span>Plans</span><b>E0 – E799</b><small>per month</small></div></div>
          <div class="panel" style="padding:26px"><span class="pill pill-soft">03</span><h3 style="font-size:21px;margin:10px 0 8px">Featured agricultural listings</h3><p class="small muted">E150 buys seven days of promoted placement on the homepage, department pages and search results.</p><div class="kpi" style="margin-top:16px"><span>Price</span><b>E150 / 7 days</b><small>per listing</small></div></div>
          <div class="panel" style="padding:26px"><span class="pill pill-soft">04</span><h3 style="font-size:21px;margin:10px 0 8px">Logistics coordination</h3><p class="small muted">E45 base plus E2.50/km beyond 10km, with a 1% coordination surcharge on bulk orders over E5,000. Pickup is free.</p><div class="kpi" style="margin-top:16px"><span>From</span><b>E45</b><small>per delivery route</small></div></div>
        </div>
        <div class="note" style="margin-top:22px">ALZY also earns on <b style="color:var(--ink)">Brand Studio</b> projects — own-brand packaging setup and per-unit filling for farmers and food entrepreneurs.</div>
      </div>
    </section>
    <section class="section alt" id="logistics">
      <div class="wrap">
        <div class="split">
          <div>
            <p class="eyebrow">Logistics</p>
            <h2 class="page-title">One coordinated run, not five failed pickups.</h2>
            <p class="lede">ALZY groups items by region and dispatch day, assigns a carrier and tracks the route. Cold-chain lines are separated. Rural pickups can be grouped into co-op consolidation points.</p>
          </div>
          <div class="panel" style="padding:24px">
            <h4 style="font-size:14px;margin-bottom:14px">Delivery regions &amp; distance</h4>
            <table class="spec-table">${config.deliveryRegions.map(r => `<tr><td>${esc(r.name)}</td><td>${r.km === 0 ? 'Base (E45)' : `${r.km} km`}</td></tr>`).join('')}</table>
          </div>
        </div>
      </div>
    </section>
    <section class="section" id="contact">
      <div class="wrap narrow center">
        <p class="eyebrow">Contact</p>
        <h2 class="page-title">Talk to the ALZY team.</h2>
        <p class="lede" style="margin-inline:auto">Mbabane, Eswatini · hello@alzy.co.sz · +268 7600 0000</p>
        <div class="btn-row center" style="margin-top:26px"><a class="btn btn-dark" href="/sell">Become a seller</a><a class="btn btn-ghost" href="/shop">Browse the market</a></div>
      </div>
    </section>`
  }));
});

module.exports = router;
