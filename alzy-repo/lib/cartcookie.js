'use strict';
/**
 * Cart persistence in a single cookie: URL-encoded JSON of [{pid, qty}].
 * Decoding is centralised here so every reader behaves identically.
 */
const MAX_LINES = 60;
const MAX_QTY = 100000;

function decode(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(decodeURIComponent(value));
  } catch {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(x => x && Number.isFinite(Number(x.pid)) && Number.isFinite(Number(x.qty)))
    .map(x => ({ pid: Number(x.pid), qty: Math.max(1, Math.min(MAX_QTY, Math.floor(Number(x.qty)))) }))
    .slice(0, MAX_LINES);
}

/** The cookie value exactly as a browser sends it back (Express URL-encodes on write). */
function encode(cart) {
  return encodeURIComponent(JSON.stringify(normalize(cart)));
}

function normalize(cart) {
  return Array.isArray(cart) ? cart.slice(0, MAX_LINES) : [];
}

function read(req) {
  return decode(req.cookies && req.cookies.alzy_cart);
}

/** Express encodes cookie values itself — store plain JSON. */
function write(res, cart) {
  res.cookie('alzy_cart', JSON.stringify(normalize(cart)), {
    maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax', path: '/', httpOnly: false
  });
}

function countFromCookie(req) {
  return read(req).reduce((n, l) => n + l.qty, 0);
}

module.exports = { read, write, encode, decode, countFromCookie };
