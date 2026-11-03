'use strict';
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const test = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return test.length === expected.length && crypto.timingSafeEqual(test, expected);
  } catch { return false; }
}

const newToken = () => crypto.randomBytes(32).toString('hex');
const orderCode = () => 'ALZ-' + crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
const couponCode = (prefix = 'ALZY') => `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/** Very small in-memory rate limiter (per IP+route) to protect auth & coupon APIs. */
const buckets = new Map();
function rateLimit(key, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) buckets.clear();
  return b.count <= limit;
}

module.exports = { hashPassword, verifyPassword, newToken, orderCode, couponCode, rateLimit };
