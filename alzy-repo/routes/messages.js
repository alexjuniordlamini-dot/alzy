'use strict';
const express = require('express');
const { connect } = require('../db');
const { render, esc, timeAgo } = require('../lib/layout');
const { requireAuth, flash } = require('../middleware');

const router = express.Router();

const view = (req, res, opts) => render({
  ...opts, user: req.user, seller: req.seller, cartCount: res.locals.cartCount, currentPath: req.path
});

/** threads where the user is the buyer, or the seller owning the thread */
function threadsFor(user, seller) {
  const db = connect();
  if (seller) {
    return db.prepare(`
      SELECT t.*, u.name AS buyer_name, p.name AS product_name, s.name AS seller_name,
        (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
        (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_at
      FROM threads t JOIN users u ON u.id = t.buyer_id LEFT JOIN products p ON p.id = t.product_id
      LEFT JOIN sellers s ON s.id = t.seller_id
      WHERE t.buyer_id = ? OR t.seller_id = ? ORDER BY coalesce(last_at, t.created_at) DESC`).all(user.id, seller.id);
  }
  return db.prepare(`
    SELECT t.*, u.name AS buyer_name, p.name AS product_name, s.name AS seller_name,
      (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
      (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_at
    FROM threads t JOIN users u ON u.id = t.buyer_id LEFT JOIN products p ON p.id = t.product_id
    LEFT JOIN sellers s ON s.id = t.seller_id
    WHERE t.buyer_id = ? ORDER BY coalesce(last_at, t.created_at) DESC`).all(user.id);
}

router.get('/messages', requireAuth, (req, res) => {
  const threads = threadsFor(req.user, req.seller);
  res.send(view(req, res, {
    title: 'Messages',
    body: `
    <div class="wrap" style="padding:28px 0 80px">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/account">Account</a><span>/</span><span>Messages</span></nav>
      <div class="section-head"><div><h1 class="page-title" style="font-size:clamp(26px,3.6vw,40px)">Messages</h1><p class="lede" style="margin-top:6px">Negotiate bulk terms, ask about harvests, arrange collection.</p></div></div>
      <div class="panel">
        ${threads.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>With</th><th>About</th><th>Last message</th><th></th></tr></thead>
          <tbody>${threads.map(t => `<tr>
            <td><b>${esc(req.seller && t.seller_id === req.seller.id ? t.buyer_name : (t.seller_name || 'Seller'))}</b></td>
            <td>${esc(t.product_name || t.subject || '—')}</td>
            <td class="small muted" style="max-width:340px">${esc((t.last_body || '').slice(0, 100))}${(t.last_body || '').length > 100 ? '…' : ''}<div class="tiny">${timeAgo(t.last_at || t.created_at)}</div></td>
            <td><a class="btn btn-ghost btn-sm" href="/messages/${t.id}">Open</a></td>
          </tr>`).join('')}</tbody></table></div>` :
          `<div class="panel-body"><p class="small muted">No conversations yet. Open any listing and use “Message the seller”.</p></div>`}
      </div>
    </div>`
  }));
});

router.post('/messages/start', requireAuth, (req, res) => {
  const db = connect();
  const productId = Number((req.body || {}).product_id);
  const body = String((req.body || {}).body || '').trim().slice(0, 2000);
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!p) { flash(res, 'error', 'Listing not found.'); return res.redirect('/shop'); }
  if (!body) { flash(res, 'error', 'Write a message first.'); return res.redirect('/product/' + p.slug); }
  if (p.seller_id === (req.seller ? req.seller.id : -1)) { flash(res, 'error', 'You cannot message your own listing.'); return res.redirect('/product/' + p.slug); }

  let thread = db.prepare('SELECT * FROM threads WHERE product_id = ? AND buyer_id = ? AND seller_id = ?').get(p.id, req.user.id, p.seller_id);
  if (!thread) {
    const info = db.prepare('INSERT INTO threads (product_id,buyer_id,seller_id,subject) VALUES (?,?,?,?)')
      .run(p.id, req.user.id, p.seller_id, `Enquiry: ${p.name}`);
    thread = { id: info.lastInsertRowid };
  }
  db.prepare('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)').run(thread.id, req.user.id, body);
  flash(res, 'success', 'Message sent to the seller.');
  res.redirect('/messages/' + thread.id);
});

router.get('/messages/:id', requireAuth, (req, res) => {
  const db = connect();
  const t = db.prepare(`
    SELECT t.*, u.name AS buyer_name, p.name AS product_name, p.slug AS product_slug, s.name AS seller_name, s.slug AS seller_slug, s.user_id AS seller_user_id
    FROM threads t JOIN users u ON u.id = t.buyer_id
    LEFT JOIN products p ON p.id = t.product_id LEFT JOIN sellers s ON s.id = t.seller_id
    WHERE t.id = ?`).get(Number(req.params.id));
  const isBuyer = t && t.buyer_id === req.user.id;
  const isSeller = t && ((req.seller && t.seller_id === req.seller.id) || (t.seller_user_id && t.seller_user_id === req.user.id));
  if (!t || (!isBuyer && !isSeller && req.user.role !== 'admin')) {
    flash(res, 'error', 'Conversation not found.');
    return res.redirect('/messages');
  }
  const msgs = db.prepare('SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.thread_id = ? ORDER BY m.id ASC').all(t.id);
  db.prepare('UPDATE messages SET read_at = datetime(\'now\') WHERE thread_id = ? AND sender_id != ? AND read_at IS NULL').run(t.id, req.user.id);

  res.send(view(req, res, {
    title: `Conversation — ${t.product_name || 'Seller'}`,
    body: `
    <div class="wrap" style="padding:28px 0 80px;max-width:900px;margin-inline:auto">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/messages">Messages</a><span>/</span><span>${esc(t.product_name || 'Conversation')}</span></nav>
      <div class="panel" style="padding:22px;margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <img src="/art/seller/${encodeURIComponent(t.seller_slug || 'alzy')}" alt="" width="46" height="46" style="border-radius:12px">
        <div style="flex:1">
          <b style="font-size:15px">${esc(t.product_name || 'Direct message')}</b>
          <div class="small muted">${isBuyer ? `To ${esc(t.seller_name || 'seller')}` : `From ${esc(t.buyer_name)}`} · ${esc(t.subject || '')}</div>
        </div>
        ${t.product_slug ? `<a class="btn btn-ghost btn-sm" href="/product/${encodeURIComponent(t.product_slug)}">View listing</a>` : ''}
      </div>
      <div class="panel" style="padding:22px;display:grid;gap:14px">
        ${msgs.map(m => {
          const mine = m.sender_id === req.user.id;
          return `<div style="display:flex;${mine ? 'justify-content:flex-end' : ''}">
            <div style="max-width:78%;background:${mine ? 'var(--green)' : 'var(--paper-2)'};color:${mine ? '#fff' : 'var(--ink)'};padding:12px 16px;border-radius:16px;${mine ? 'border-bottom-right-radius:5px' : 'border-bottom-left-radius:5px'};border:1px solid ${mine ? 'transparent' : 'var(--line-2)'}">
              <div class="tiny" style="opacity:.65;margin-bottom:4px">${esc(m.sender_name)} · ${timeAgo(m.created_at)}</div>
              <div style="font-size:13.8px;line-height:1.55;white-space:pre-wrap">${esc(m.body)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <form method="post" action="/messages/${t.id}" class="panel" style="padding:16px;margin-top:14px;display:grid;gap:10px">
        <div class="field" style="margin:0"><label for="body">Reply</label><textarea id="body" name="body" rows="3" required placeholder="Ask about volume, grading, delivery windows…"></textarea></div>
        <button class="btn btn-dark" type="submit" style="justify-self:start">Send reply</button>
      </form>
    </div>`
  }));
});

router.post('/messages/:id', requireAuth, (req, res) => {
  const db = connect();
  const t = db.prepare('SELECT * FROM threads WHERE id = ?').get(Number(req.params.id));
  const isBuyer = t && t.buyer_id === req.user.id;
  const isSeller = t && req.seller && t.seller_id === req.seller.id;
  if (!t || (!isBuyer && !isSeller)) { flash(res, 'error', 'Conversation not found.'); return res.redirect('/messages'); }
  const body = String((req.body || {}).body || '').trim().slice(0, 2000);
  if (!body) { flash(res, 'error', 'Write a message first.'); return res.redirect('/messages/' + t.id); }
  db.prepare('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)').run(t.id, req.user.id, body);
  res.redirect('/messages/' + t.id);
});

module.exports = router;
