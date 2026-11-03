'use strict';
/**
 * Coupon system.
 * Video coupons are gated: the buyer must open the coupon page, let the embedded
 * YouTube player run to the end, like the video, and confirm — then a personal
 * coupon code is generated and stored on their account.
 */
const express = require('express');
const { connect } = require('../db');
const { render, esc, money, stars, productCard } = require('../lib/layout');
const { requireAuth, flash } = require('../middleware');
const { couponCode } = require('../lib/auth');
const Q = require('../lib/queries');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

/* ---------------- index ---------------- */
router.get('/coupons', (req, res) => {
  const db = connect();
  const video = Q.videoCoupons({ limit: 24 });
  const promo = db.prepare(`SELECT * FROM coupons WHERE kind='promo' AND active=1 AND uses < max_uses
    AND (expires_at IS NULL OR expires_at > date('now')) ORDER BY id`).all();
  const myClaims = req.user ? Q.claimsForUser(req.user.id) : [];
  const claimByCoupon = Object.fromEntries(myClaims.map(c => [c.coupon_id, c]));
  const flashMsg = res.locals.flash;

  res.send(view(req, res, {
    title: 'Coupons & video deals — unlock lower prices',
    body: `
    ${flashMsg ? `<div class="flash flash-${esc(flashMsg.type)}" role="status">${esc(flashMsg.message)}<button class="flash-close" aria-label="Dismiss">×</button></div>` : ''}
    <section class="section tight">
      <div class="wrap">
        <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>Coupons</span></nav>
        <div class="section-head">
          <div>
            <p class="eyebrow">Coupon-only pricing</p>
            <h1 class="page-title">Watch. Earn. Save.</h1>
            <p class="lede">Some of ALZY's lowest prices are coupon-only. Open a deal, watch the seller's video to the very end inside ALZY, tap like — and your coupon is generated instantly on your account.</p>
          </div>
          <div class="panel" style="padding:18px;max-width:320px">
            <div class="steps" style="margin:0">
              <div class="step done"><span class="dot">1</span> Open a coupon deal</div>
              <div class="step done"><span class="dot">2</span> Watch the full video (no leaving ALZY)</div>
              <div class="step done"><span class="dot">3</span> Like the video &amp; confirm</div>
              <div class="step done"><span class="dot">4</span> Coupon appears in your account</div>
            </div>
          </div>
        </div>

        ${req.user ? `<div class="panel" style="padding:18px 20px;margin-bottom:32px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div><b style="font-size:14px">Your coupons</b><div class="small muted">${myClaims.filter(c => c.status !== 'watching').length} ready to use · ${myClaims.filter(c => c.status === 'watching').length} in progress</div></div>
          <a class="btn btn-ghost btn-sm" href="/account/coupons">Open my coupons</a>
        </div>` : ''}

        <div class="section-head"><div><h2 style="font-size:28px">Video unlocks</h2><p class="lede" style="margin-top:6px">Watch to the end — the progress bar is tied to the actual video.</p></div></div>
        <div class="coupon-grid">
          ${video.map(v => {
            const claim = claimByCoupon[v.id];
            const earned = claim && claim.status !== 'watching';
            return `
            <article class="coupon ${earned ? '' : 'is-locked'}">
              <a class="coupon-media" href="/coupons/${v.id}">
                <img src="/art/coupon/${v.id}" alt="${esc(v.title)}" loading="lazy">
                <div class="coupon-play"><span><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5l11 7-11 7V5Z"/></svg></span></div>
                <span class="coupon-duration">${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</span>
              </a>
              <div class="coupon-body">
                <div class="tag-row">
                  ${earned ? '<span class="pill pill-soft">Earned</span>' : '<span class="pill pill-amber">Watch to unlock</span>'}
                  ${v.seller_name ? `<span class="pill pill-quiet">${esc(v.seller_name)}</span>` : '<span class="pill pill-quiet">Market-wide</span>'}
                </div>
                <strong style="font-size:15.5px;letter-spacing:-.015em">${esc(v.title)}</strong>
                <span class="small muted" style="line-height:1.55">${esc(v.description || '')}</span>
                <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:8px">
                  <span class="coupon-value" style="font-size:24px">${v.type === 'percent' ? v.value + '% OFF' : money(v.value) + ' OFF'}</span>
                  ${earned
                    ? `<span class="coupon-code" style="font-size:11px">${esc(v.code)}</span>`
                    : `<a class="btn btn-dark btn-sm" href="/coupons/${v.id}">${claim ? 'Continue' : 'Unlock'}</a>`}
                </div>
                <div class="tiny muted">Minimum spend ${money(v.min_subtotal)} · ${v.uses}/${v.max_uses} claimed</div>
              </div>
            </article>`;
          }).join('') || '<p class="muted">No video coupons live right now.</p>'}
        </div>

        <div class="section-head" style="margin-top:64px"><div><h2 style="font-size:28px">Open coupons</h2><p class="lede" style="margin-top:6px">No video needed — apply these at checkout.</p></div></div>
        <div class="grid cols-3">
          ${promo.map(c => `
            <div class="panel" style="padding:22px;display:flex;flex-direction:column;gap:10px">
              <div class="tag-row"><span class="pill pill-soft">${c.type === 'percent' ? c.value + '% off' : money(c.value) + ' off'}</span>${c.seller_id ? '<span class="pill pill-quiet">Seller coupon</span>' : '<span class="pill pill-quiet">Market-wide</span>'}</div>
              <b style="font-size:15.5px">${esc(c.title)}</b>
              <p class="small muted" style="line-height:1.55">${esc(c.description || '')}</p>
              <div class="coupon-code" style="align-self:flex-start">${esc(c.code)}<button class="btn btn-ghost btn-sm" data-copy="${esc(c.code)}" style="padding:2px 8px;font-size:11px">Copy</button></div>
              <div class="tiny muted" style="margin-top:auto">Min spend ${money(c.min_subtotal)} · ${c.uses}/${c.max_uses} used · expires ${esc(c.expires_at || '—')}</div>
            </div>`).join('')}
        </div>
      </div>
    </section>`
  }));
});

/* ---------------- watch & unlock ---------------- */
router.get('/coupons/:id', requireAuth, (req, res) => {
  const db = connect();
  const c = db.prepare('SELECT * FROM coupons WHERE id = ?').get(Number(req.params.id));
  if (!c || !c.active) return res.status(404).send(render({ title: 'Coupon not found', user: req.user, body: '<div class="wrap section"><h1>Coupon not found</h1><p class="lede">This coupon is no longer available.</p></div>' }));

  let claim = Q.claimFor(req.user.id, c.id);
  if (!claim) {
    db.prepare("INSERT INTO coupon_claims (coupon_id,user_id,status,watched_seconds,liked) VALUES (?,?,'watching',0,0)").run(c.id, req.user.id);
    claim = Q.claimFor(req.user.id, c.id);
  }
  const earned = claim.status !== 'watching';
  const alreadyUsed = claim.status === 'used';
  const seller = c.seller_id ? db.prepare('SELECT * FROM sellers WHERE id = ?').get(c.seller_id) : null;
  const product = c.product_id ? db.prepare('SELECT * FROM products WHERE id = ?').get(c.product_id) : null;
  const eligible = c.product_id
    ? Q.productList({ ids: [c.product_id], limit: 4 }).items
    : c.seller_id
      ? Q.productList({ sellerId: c.seller_id, limit: 4 }).items
      : Q.productList({ sort: 'discount', limit: 4 }).items;

  res.send(view(req, res, {
    title: `${c.title} — unlock your coupon`,
    scripts: ['/js/watch.js'],
    body: `
    <div class="wrap" style="padding-top:24px;padding-bottom:80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/coupons">Coupons</a><span>/</span><span>${esc(c.title)}</span></nav>
      <div class="watch-shell">
        <div>
          ${earned ? `<div class="player is-earned" id="player" style="display:grid;place-items:center;background:radial-gradient(circle at 50% 40%, #1b4a30, #08170f)">
            <div style="text-align:center;padding:28px">
              <div class="pulse" style="margin-inline:auto"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
              <b style="display:block;margin-top:12px;color:#fff;font-size:19px">${alreadyUsed ? 'You already used this coupon' : 'You earned this coupon'}</b>
              <p class="small" style="margin-top:6px;color:#b9d4c1;max-width:34ch">${alreadyUsed ? 'Each video coupon can be spent once. Watch another video for a fresh deal.' : 'The video is complete and your code is live in your account.'}</p>
              ${!alreadyUsed ? `<a class="btn btn-white btn-sm" href="/coupons" style="margin-top:14px">Browse more deals</a>` : `<a class="btn btn-white btn-sm" href="/coupons" style="margin-top:14px">Watch another video</a>`}
            </div>
          </div>` : `<div class="player" id="player" data-youtube-id="${esc(c.youtube_id || '')}" data-duration="${c.duration}" data-coupon-id="${c.id}" data-claim-status="${claim.status}">
            <div class="player-fallback" id="playerFallback">
              <div>
                <div class="pulse"><svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M8 5l11 7-11 7V5Z"/></svg></div>
                <b>Loading video…</b>
                <p class="small" style="margin-top:6px;opacity:.7">If the player does not start, use the simulated player below — the coupon flow still works.</p>
                <button class="btn btn-white btn-sm" style="margin-top:14px" id="simulatePlayer">Use simulated player</button>
              </div>
            </div>
          </div>`}

          ${earned ? '' : `<div class="watch-progress" id="watchProgress">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
              <b style="font-size:14px">Watch progress</b>
              <span class="small muted" id="progressLabel">0% of the video watched</span>
            </div>
            <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
            <div class="tiny muted" style="margin-top:8px" id="progressHint">The coupon unlocks only when the video reaches the end.</div>
          </div>`}

          <div style="margin-top:26px">
            <h1 class="page-title" style="font-size:clamp(24px,3.2vw,34px)">${esc(c.video_title || c.title)}</h1>
            <div class="tag-row" style="margin-top:12px">
              <span class="pill pill-soft">${c.type === 'percent' ? c.value + '% off' : money(c.value) + ' off'}</span>
              <span class="pill pill-quiet">Min spend ${money(c.min_subtotal)}</span>
              ${seller ? `<span class="pill pill-quiet">${esc(seller.name)}</span>` : '<span class="pill pill-quiet">Whole market</span>'}
              <span class="pill pill-quiet">${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')} video</span>
            </div>
            <p class="lede" style="margin-top:16px">${esc(c.description || '')}</p>
          </div>

          ${earned ? `
          <div class="reveal-card" style="margin-top:26px;text-align:left">
            <div class="tag-row" style="margin-bottom:8px">
              ${alreadyUsed ? '<span class="pill pill-amber">Already used</span>' : '<span class="pill pill-lime">Coupon unlocked</span>'}
            </div>
            <div class="coupon-revealed" style="margin:6px 0 4px">${esc(c.code)}</div>
            <p class="small" style="color:var(--green-2);opacity:.85">Saved to your account${alreadyUsed ? ' — you have used this one.' : ' and ready at checkout.'}</p>
            <div class="btn-row" style="margin-top:14px">
              <a class="btn btn-dark btn-sm" href="/cart">Use it in the cart</a>
              <button class="btn btn-ghost btn-sm" data-copy="${esc(c.code)}">Copy code</button>
              ${seller ? `<a class="btn btn-ghost btn-sm" href="/seller/${encodeURIComponent(seller.slug)}">Shop ${esc(seller.name)}</a>` : ''}
            </div>
          </div>` : `
          <div class="reveal-card" style="margin-top:26px;text-align:left;border-color:var(--line);background:var(--paper-2)">
            <b style="font-size:15px">Finish the video to generate your coupon</b>
            <div class="steps" id="watchSteps" style="margin-bottom:0">
              <div class="step ${claim.watched_seconds > 0 ? 'active' : 'active'}" id="stepWatch"><span class="dot">1</span> Watch to the end (${Math.max(0, Math.round(c.duration - claim.watched_seconds))}s to go)</div>
              <div class="step locked" id="stepLike"><span class="dot">2</span> Like the video</div>
              <div class="step locked" id="stepClaim"><span class="dot">3</span> Generate my coupon</div>
            </div>
            <button class="btn btn-dark btn-block" id="claimBtn" disabled style="margin-top:16px">Generate my coupon</button>
            <p class="tiny muted" style="margin-top:8px">Nothing is charged. The coupon is stored on your account and can be used once, unless stated otherwise.</p>
          </div>`}
        </div>

        <aside>
          <div class="panel" style="padding:22px">
            <h3 style="font-size:16px;margin-bottom:6px">What you get</h3>
            <div class="coupon-value">${c.type === 'percent' ? c.value + '% off' : money(c.value) + ' off'}</div>
            <p class="small muted" style="margin-top:6px">${esc(c.title)}</p>
            <table class="spec-table" style="margin-top:14px">
              <tr><td>Applies to</td><td>${product ? esc(product.name) : seller ? esc(seller.name) : 'Whole market'}</td></tr>
              <tr><td>Minimum spend</td><td>${money(c.min_subtotal)}</td></tr>
              <tr><td>Uses left</td><td>${Math.max(0, c.max_uses - c.uses)}</td></tr>
              <tr><td>Per account</td><td>${c.per_user} use${c.per_user > 1 ? 's' : ''}</td></tr>
              <tr><td>Expires</td><td>${esc(c.expires_at || 'No expiry')}</td></tr>
            </table>
          </div>
          ${seller ? `
          <div class="panel" style="padding:18px;margin-top:14px;display:flex;gap:12px;align-items:center">
            <img src="/art/seller/${encodeURIComponent(seller.slug)}" alt="" width="46" height="46" style="border-radius:12px">
            <div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(seller.name)}</b><div class="tiny muted">${esc(seller.tagline || '')}</div>${stars(seller.rating, seller.rating_count)}</div>
          </div>` : ''}
          ${eligible.length ? `<div style="margin-top:22px"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:10px">Eligible right now</h4>
            <div style="display:grid;gap:10px">${eligible.map(p => `<a href="/product/${encodeURIComponent(p.slug)}" style="display:flex;gap:10px;align-items:center;gap:12px">
              <img src="/art/product/${encodeURIComponent(p.vessel)}/${encodeURIComponent(p.hue)}/${encodeURIComponent(p.icon)}?label=ALZY" alt="" width="52" height="52" style="border-radius:10px;flex:0 0 52px">
              <div style="min-width:0"><div style="font-size:13px;font-weight:600">${esc(p.name)}</div><div class="tiny muted">${money(p.price)} / ${esc(p.unit)}</div></div>
            </a>`).join('')}</div></div>` : ''}
        </aside>
      </div>
    </div>`
  }));
});

/* ---------------- progress + claim API ---------------- */
router.post('/api/coupons/:id/progress', requireAuth, (req, res) => {
  const db = connect();
  const c = db.prepare('SELECT * FROM coupons WHERE id = ? AND active = 1').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  let claim = Q.claimFor(req.user.id, c.id);
  if (!claim) {
    db.prepare("INSERT INTO coupon_claims (coupon_id,user_id,status,watched_seconds) VALUES (?,?,'watching',0)").run(c.id, req.user.id);
    claim = Q.claimFor(req.user.id, c.id);
  }
  const watched = Math.max(0, Math.min(Number(req.body.watched || 0), c.duration || 0));
  const liked = req.body.liked ? 1 : claim.liked;
  const maxWatched = Math.max(claim.watched_seconds, Math.floor(watched));
  db.prepare('UPDATE coupon_claims SET watched_seconds = ?, liked = ? WHERE id = ?').run(maxWatched, liked, claim.id);
  res.json({ ok: true, watched: maxWatched, required: c.duration, liked: !!liked });
});

router.post('/api/coupons/:id/claim', requireAuth, (req, res) => {
  const db = connect();
  const c = db.prepare('SELECT * FROM coupons WHERE id = ? AND active = 1').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  const claim = Q.claimFor(req.user.id, c.id);
  if (!claim) return res.status(400).json({ error: 'Start the video first.' });
  if (claim.status !== 'watching') return res.json({ ok: true, alreadyEarned: true, code: c.code });

  const tolerance = 2; // seconds of rounding slack
  const watched = Number(req.body.watched || claim.watched_seconds || 0);
  const liked = req.body.liked ? 1 : claim.liked;
  if (!c.duration || watched < c.duration - tolerance) {
    return res.status(400).json({ error: 'Keep watching — the coupon unlocks at the end of the video.' });
  }
  if (!liked) return res.status(400).json({ error: 'Tap the like button on the video to finish unlocking.', needsLike: true });
  if (c.uses >= c.max_uses) return res.status(400).json({ error: 'This coupon has just been fully claimed.' });

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.prepare("UPDATE coupon_claims SET status = 'earned', watched_seconds = ?, liked = 1, earned_at = ? WHERE id = ?")
    .run(Math.floor(Number(c.duration)), now, claim.id);
  res.json({ ok: true, code: c.code, title: c.title, value: c.type === 'percent' ? `${c.value}% off` : `${money(c.value)} off` });
});

/* ---------------- account coupons ---------------- */
router.get('/account/coupons', requireAuth, (req, res) => {
  const claims = Q.claimsForUser(req.user.id);
  res.send(view(req, res, {
    title: 'My coupons',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Coupons</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(28px,4vw,44px)">My coupons</h1><p class="lede" style="margin-top:6px">Earn more by watching supplier videos — then apply codes at checkout.</p></div><a class="btn btn-dark" href="/coupons">Find more deals</a></div>
      ${claims.length ? `<div class="coupon-grid">
        ${claims.map(c => `
          <div class="coupon">
            <div class="coupon-media" style="aspect-ratio:16/7">
              <img src="/art/coupon/${c.coupon_id}" alt="">
              <div class="coupon-play" style="background:rgba(8,24,16,.15)"></div>
              <span class="coupon-duration" style="left:10px;right:auto">${esc(c.status)}</span>
            </div>
            <div class="coupon-body">
              <b style="font-size:15px">${esc(c.title)}</b>
              <span class="small muted">${esc(c.description || '')}</span>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px">
                <span class="coupon-code">${esc(c.code)}</span>
                <button class="btn btn-ghost btn-sm" data-copy="${esc(c.code)}">Copy</button>
              </div>
              <div class="tiny muted" style="margin-top:auto;padding-top:8px">
                ${c.status === 'earned' ? `Ready to use · min spend ${money(c.min_subtotal)}` :
                  c.status === 'used' ? `Used${c.used_at ? ' ' + esc(c.used_at.slice(0, 10)) : ''}` :
                  `Watching · ${c.watched_seconds}s of ${Math.round(c.watched_seconds)}s+ logged`}
              </div>
              ${c.status === 'watching' ? `<a class="btn btn-dark btn-sm" href="/coupons/${c.coupon_id}">Continue watching</a>` : '<a class="btn btn-ghost btn-sm" href="/shop">Shop with it</a>'}
            </div>
          </div>`).join('')}
      </div>` : `<div class="empty"><div class="empty-art"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="7.5" r="1.6"/></svg></div><h3>No coupons yet</h3><p>Watch a supplier video to unlock your first discount — it takes a minute.</p><a class="btn btn-dark" href="/coupons">Browse coupon deals</a></div>`}
    </div>`
  }));
});

module.exports = router;
