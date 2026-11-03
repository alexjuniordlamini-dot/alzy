'use strict';
/**
 * ALZY server-rendered layout + shared UI components.
 * Apple-style restraint (type, whitespace, quiet motion) with
 * eBay-style marketplace density (search, filters, deal rails).
 */

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (cents) => {
  const n = Number(cents || 0) / 100;
  return 'E' + n.toLocaleString('en-SZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const shortMoney = (cents) => {
  const n = Number(cents || 0) / 100;
  if (n >= 1000000) return 'E' + (n / 1000000).toFixed(1) + 'm';
  if (n >= 10000) return 'E' + Math.round(n / 1000) + 'k';
  return 'E' + n.toLocaleString('en-SZ', { maximumFractionDigits: 0 });
};
const dateFmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return dateFmt(iso);
};

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
  <path d="M16 3c7 1 11 6 11 13 0 8-6 13-11 13S5 24 5 17C5 10 9 4 16 3Z" fill="currentColor" opacity=".14"/>
  <path d="M16 27V11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M16 15c0-4 2.5-6.5 6-7-.5 4-3 6.5-6 7Zm0 4c0-4-2.5-6.5-6-7 .5 4 3 6.5 6 7Zm0 4c0-4 2.5-6.5 6-7-.5 4-3 6.5-6 7Z" fill="currentColor"/>
</svg>`;

function nav(user, seller, cartCount, currentPath = '') {
  const active = (p) => (currentPath === p || (p !== '/' && currentPath.startsWith(p)) ? ' is-active' : '');
  return `
  <header class="nav" id="siteNav">
    <div class="nav-inner">
      <a href="/" class="brand" aria-label="ALZY home">${LOGO}<span>ALZY</span></a>
      <nav class="nav-links" aria-label="Main">
        <a href="/shop" class="${active('/shop')}">Shop all</a>
        <a href="/groceries" class="${active('/groceries')}">Monthly groceries</a>
        <a href="/wholesale" class="${active('/wholesale')}">Wholesale</a>
        <a href="/coupons" class="${active('/coupons')}">Coupons</a>
        <a href="/packaging" class="${active('/packaging')}">Packaging</a>
        <a href="/brand-studio" class="${active('/brand-studio')}">Brand Studio</a>
      </nav>
      <div class="nav-tools">
        <button class="icon-btn" id="searchToggle" aria-label="Search" aria-expanded="false">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
        </button>
        <a class="icon-btn cart-btn" href="/cart" aria-label="Cart (${cartCount} items)">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg>
          ${cartCount ? `<span class="cart-count">${cartCount}</span>` : ''}
        </a>
        ${user ? `
          <div class="account-menu">
            <button class="icon-btn avatar-btn" aria-label="Account" aria-haspopup="true" aria-expanded="false" data-menu-toggle>
              <span class="avatar">${esc(user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>
            </button>
            <div class="menu" role="menu">
              <div class="menu-head"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div>
              <a href="/account" role="menuitem">My account</a>
              <a href="/account/orders" role="menuitem">Orders &amp; invoices</a>
              <a href="/account/coupons" role="menuitem">My coupons</a>
              <a href="/account/favorites" role="menuitem">Saved products</a>
              <a href="/account/brand" role="menuitem">My brand projects</a>
              ${seller || user.role === 'admin' ? '<a href="/seller" role="menuitem">Seller dashboard</a>' : '<a href="/sell" role="menuitem">Start selling</a>'}
              ${user.role === 'admin' ? '<a href="/admin" role="menuitem">Admin console</a>' : ''}
              <form method="post" action="/logout"><button type="submit" role="menuitem" class="menu-logout">Sign out</button></form>
            </div>
          </div>` : `
          <a class="nav-signin" href="/login">Sign in</a>
          <a class="btn btn-dark btn-sm" href="/register">Join free</a>`}
      </div>
    </div>
    <div class="nav-search" id="navSearch" hidden>
      <form action="/shop" method="get" class="nav-search-form" role="search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
        <input type="search" name="q" placeholder="Search 141 products, farms, packaging…" autocomplete="off" aria-label="Search ALZY">
        <button class="btn btn-primary btn-sm" type="submit">Search</button>
      </form>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="brand">${LOGO}<span>ALZY</span></a>
        <p>Eswatini's agriculture &amp; food marketplace. Farm-fresh produce, wholesale supply, packaging and private label — one market, fair prices.</p>
        <div class="pay-chips" aria-label="Payment methods">
          <span>MTN MoMo</span><span>Eswatini Mobile</span><span>Visa</span><span>Mastercard</span><span>EFT</span><span>Cash on delivery</span>
        </div>
      </div>
      <div>
        <h4>Market</h4>
        <a href="/shop?tab=produce">Fresh produce</a>
        <a href="/shop?tab=wholesale">Wholesale</a>
        <a href="/groceries">Monthly groceries</a>
        <a href="/shop?tab=meat">Meat &amp; poultry</a>
        <a href="/shop?tab=packaging">Packaging</a>
        <a href="/coupons">Coupons &amp; deals</a>
      </div>
      <div>
        <h4>Sell on ALZY</h4>
        <a href="/sell">Become a seller</a>
        <a href="/sell#plans">Subscriptions</a>
        <a href="/brand-studio">Brand Studio</a>
        <a href="/sell#featured">Featured listings</a>
        <a href="/seller">Seller dashboard</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="/about">About ALZY</a>
        <a href="/about#how-it-works">How it works</a>
        <a href="/about#pricing">Fees &amp; commissions</a>
        <a href="/about#logistics">Logistics</a>
        <a href="/about#contact">Contact</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ALZY Marketplace (Pty) Ltd · Mbabane, Eswatini</span>
      <span class="footer-legal">Demonstration marketplace · no real payments are processed</span>
    </div>
  </footer>`;
}

function render({ title, description, body, user, seller, cartCount = 0, currentPath = '', bodyClass = '', scripts = [] }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · ALZY</title>
<meta name="description" content="${esc(description || "Eswatini's agriculture & food marketplace — farm-fresh produce, wholesale supply, packaging and private label.")}">
<meta name="theme-color" content="#0d2b1e">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/alzy.css">
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
${nav(user, seller, cartCount, currentPath)}
<main id="main">${body}</main>
${footer()}
<div class="toast-stack" id="toastStack" aria-live="polite"></div>
<script src="/js/alzy.js" defer></script>
${scripts.map(s => `<script src="${s}" defer></script>`).join('')}
</body>
</html>`;
}

function flashHtml(flash) {
  if (!flash) return '';
  return `<div class="flash flash-${esc(flash.type || 'info')}" role="status">${esc(flash.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>`;
}

function stars(rating, count) {
  const full = Math.round(Number(rating) || 0);
  const s = Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" class="${i < full ? 'star on' : 'star'}"><path d="m12 3 2.7 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.3 6.5 20.2l1.1-6.2L3 9.6l6.3-.9L12 3Z" fill="currentColor"/></svg>`).join('');
  return `<span class="stars" title="${Number(rating).toFixed(1)} out of 5">${s}${count != null ? `<span class="stars-count">${Number(rating).toFixed(1)}${count ? ` (${count})` : ''}</span>` : ''}</span>`;
}

/** Product card — the workhorse of the marketplace. */
function productCard(p, opts = {}) {
  const discount = p.compare_price && p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const hasVideoDeal = p.video_coupon_id;
  const moqNote = p.moq > 1 ? `<span class="pill pill-quiet">Min ${p.moq} ${esc(p.unit)}${p.moq > 1 ? 's' : ''}</span>` : '';
  return `
  <article class="product-card${p.featured ? ' is-featured' : ''}" data-product="${p.id}">
    <a class="pc-media" href="/product/${encodeURIComponent(p.slug)}" aria-label="${esc(p.name)}">
      <img src="/art/product/${encodeURIComponent(p.vessel)}/${encodeURIComponent(p.hue)}/${encodeURIComponent(p.icon)}?label=${encodeURIComponent(p.category_name || 'ALZY')}&sub=${encodeURIComponent(p.region || '')}" alt="${esc(p.name)}" loading="lazy" width="320" height="320">
      <span class="pc-top">
        ${p.featured ? '<span class="pill pill-featured">Featured</span>' : ''}
        ${discount ? `<span class="pill pill-deal">−${discount}%</span>` : ''}
      </span>
      ${hasVideoDeal ? '<span class="pc-video"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M8 5l11 7-11 7V5Z"/></svg> Coupon video</span>' : ''}
      <button class="fav-btn" data-fav="${p.id}" aria-label="Save ${esc(p.name)}" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20.5S3.8 15 3.8 9.4A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.2 3.2C20.2 15 12 20.5 12 20.5Z"/></svg>
      </button>
    </a>
    <div class="pc-body">
      <a class="pc-seller" href="/seller/${encodeURIComponent(p.seller_slug)}">
        ${p.seller_verified ? '<svg viewBox="0 0 24 24" width="11" height="11" class="verified" aria-label="Verified seller"><path d="m12 2 2.4 2.2 3.2-.4 1 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-1 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-1-3.1L2.5 15.6l1-3.1-1-3.1 2.9-1.5 1-3.1 3.2.4Z" fill="currentColor"/><path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        ${esc(p.seller_name || 'ALZY seller')}
      </a>
      <a class="pc-name" href="/product/${encodeURIComponent(p.slug)}">${esc(p.name)}</a>
      <div class="pc-meta">
        <span class="pc-rating">${stars(p.seller_rating || 4.8)}</span>
        <span class="pc-region">${esc(p.region || 'Eswatini')}</span>
      </div>
      ${p.harvest_date ? `<div class="pc-harvest"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg> Harvest ${dateFmt(p.harvest_date)}</div>` : ''}
      <div class="pc-price-row">
        <div class="pc-price">
          <strong>${money(p.price)}</strong><span class="pc-unit">/${esc(p.unit)}</span>
          ${p.compare_price ? `<s>${money(p.compare_price)}</s>` : ''}
        </div>
        ${moqNote}
      </div>
      <div class="pc-actions">
        ${opts.showAdd === false ? '' : `<button class="btn btn-dark btn-sm btn-add" data-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Sold out' : 'Add to cart'}</button>`}
        <a class="btn btn-ghost btn-sm" href="/product/${encodeURIComponent(p.slug)}">Details</a>
      </div>
    </div>
  </article>`;
}

function emptyState({ title, message, action, href, icon = 'leaf' }) {
  return `
  <div class="empty">
    <div class="empty-art"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21c6-2 9-7 9-14-7 0-12 3-14 9-1 3 0 5 2 6"/><path d="M5 20c2-6 6-9 11-11"/></svg></div>
    <h3>${esc(title)}</h3>
    <p>${esc(message)}</p>
    ${action ? `<a class="btn btn-dark" href="${href}">${esc(action)}</a>` : ''}
  </div>`;
}

function errorPage({ title, code, message, user }) {
  return render({
    title, user, currentPath: '',
    body: `<section class="section error-page">
      <div class="wrap narrow center">
        <p class="eyebrow">Error ${esc(code)}</p>
        <h1 class="hero-title">${esc(title)}</h1>
        <p class="lede">${esc(message)}</p>
        <div class="btn-row center">
          <a class="btn btn-dark" href="/">Back to the market</a>
          <a class="btn btn-ghost" href="/shop">Browse everything</a>
        </div>
      </div>
    </section>`
  });
}

module.exports = { render, nav, footer, flashHtml, stars, productCard, emptyState, errorPage, esc, money, shortMoney, dateFmt, timeAgo, LOGO };
