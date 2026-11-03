'use strict';
const { connect } = require('../db');

const BASE = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.kind AS category_kind,
         s.name AS seller_name, s.slug AS seller_slug, s.verified AS seller_verified,
         s.rating AS seller_rating, s.rating_count AS seller_rating_count, s.plan AS seller_plan, s.kind AS seller_kind,
         (SELECT id FROM coupons WHERE product_id = p.id AND kind = 'video' AND active = 1 LIMIT 1) AS video_coupon_id,
         (SELECT id FROM coupons WHERE seller_id = s.id AND kind = 'video' AND active = 1 LIMIT 1) AS seller_video_coupon_id,
         (SELECT count(*) FROM reviews r WHERE r.product_id = p.id) AS review_count,
         (SELECT avg(rating) FROM reviews r WHERE r.product_id = p.id) AS review_avg
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN sellers s ON s.id = p.seller_id
`;

const TAB_CATEGORIES = {
  produce: ['fresh-vegetables', 'fruits'],
  meat: ['meat-poultry', 'fish-seafood'],
  pantry: ['grains-cereals', 'dairy-eggs', 'sauces-condiments', 'spices-seasonings', 'beverages-drinks', 'processed-foods', 'honey-preserves'],
  packaging: ['packaging-glass', 'packaging-plastic', 'bags-wraps', 'private-label'],
  supplies: ['farm-supplies']
};

/** Flexible product search used by /shop and rails. */
function productList(opts = {}) {
  const db = connect();
  const where = ["p.status = 'active'"];
  const args = [];

  if (opts.q) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR s.name LIKE ? OR c.name LIKE ?)');
    const like = `%${opts.q}%`;
    args.push(like, like, like, like);
  }
  if (opts.category) { where.push('c.slug = ?'); args.push(opts.category); }
  if (opts.seller) { where.push('s.slug = ?'); args.push(opts.seller); }
  if (opts.sellerId) { where.push('s.id = ?'); args.push(opts.sellerId); }
  if (opts.tab && TAB_CATEGORIES[opts.tab]) {
    where.push(`c.slug IN (${TAB_CATEGORIES[opts.tab].map(() => '?').join(',')})`);
    args.push(...TAB_CATEGORIES[opts.tab]);
  }
  if (opts.min != null && opts.min !== '') { where.push('p.price >= ?'); args.push(Math.round(Number(opts.min) * 100)); }
  if (opts.max != null && opts.max !== '') { where.push('p.price <= ?'); args.push(Math.round(Number(opts.max) * 100)); }
  if (opts.deals) where.push('p.compare_price IS NOT NULL AND p.compare_price > p.price');
  if (opts.featured) where.push('p.featured = 1');
  if (opts.couponOnly) where.push("EXISTS (SELECT 1 FROM coupons c2 WHERE c2.kind = 'video' AND c2.active = 1 AND (c2.product_id = p.id OR c2.seller_id = s.id))");
  if (opts.moqLte) { where.push('p.moq <= ?'); args.push(Number(opts.moqLte)); }
  if (opts.budget) { where.push('p.price <= ?'); args.push(Math.round(Number(opts.budget) * 100)); }
  if (opts.ids && opts.ids.length) {
    where.push(`p.id IN (${opts.ids.map(() => '?').join(',')})`);
    args.push(...opts.ids);
  }

  const sortMap = {
    relevance: 'p.featured DESC, p.id DESC',
    newest: 'p.created_at DESC, p.id DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    discount: '((p.compare_price - p.price) * 1.0 / NULLIF(p.compare_price,0)) DESC, p.featured DESC',
    rating: 's.rating DESC, s.rating_count DESC',
    featured: 'p.featured DESC, p.featured_until DESC, p.id DESC'
  };
  const order = sortMap[opts.sort] || sortMap.relevance;
  const limit = Math.min(Number(opts.limit || 48), 200);
  const offset = Math.max(Number(opts.offset || 0), 0);

  const sql = `${BASE} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const items = db.prepare(sql).all(...args, limit, offset);
  const countSql = `SELECT count(*) AS n FROM products p JOIN categories c ON c.id = p.category_id JOIN sellers s ON s.id = p.seller_id WHERE ${where.join(' AND ')}`;
  const total = db.prepare(countSql).get(...args).n;
  return { items, total, limit, offset };
}

function productBySlug(slug) {
  const db = connect();
  return db.prepare(`${BASE} WHERE p.slug = ?`).get(slug);
}

function productById(id) {
  const db = connect();
  return db.prepare(`${BASE} WHERE p.id = ?`).get(id);
}

function relatedProducts(p, limit = 4) {
  const db = connect();
  return db.prepare(`${BASE} WHERE p.category_id = ? AND p.id != ? AND p.status='active' ORDER BY p.featured DESC, p.id DESC LIMIT ?`)
    .all(p.category_id, p.id, limit);
}

function categoriesWithCounts() {
  const db = connect();
  return db.prepare(`
    SELECT c.*, (
      SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active'
    ) AS count
    FROM categories c ORDER BY c.sort, c.name`).all();
}

function sellerBySlug(slug) {
  const db = connect();
  return db.prepare(`
    SELECT s.*,
      (SELECT count(*) FROM products p WHERE p.seller_id = s.id AND p.status='active') AS product_count,
      (SELECT count(*) FROM order_items oi WHERE oi.seller_id = s.id) AS total_lines,
      (SELECT coalesce(sum(oi.line_total),0) FROM order_items oi WHERE oi.seller_id = s.id) AS gmv
    FROM sellers s WHERE s.slug = ?`).get(slug);
}

function topSellers(limit = 8) {
  const db = connect();
  return db.prepare(`
    SELECT s.*, (SELECT count(*) FROM products p WHERE p.seller_id = s.id AND p.status='active') AS product_count
    FROM sellers s ORDER BY s.verified DESC, s.rating DESC, s.rating_count DESC LIMIT ?`).all(limit);
}

/** Video coupons, optionally scoped by product/seller */
function videoCoupons({ productId, sellerId, limit = 12 } = {}) {
  const db = connect();
  let sql = `
    SELECT cp.*, s.name AS seller_name, s.slug AS seller_slug, p.name AS product_name, p.slug AS product_slug
    FROM coupons cp
    LEFT JOIN sellers s ON s.id = cp.seller_id
    LEFT JOIN products p ON p.id = cp.product_id
    WHERE cp.kind = 'video' AND cp.active = 1 AND cp.uses < cp.max_uses
      AND (cp.expires_at IS NULL OR cp.expires_at > date('now'))`;
  const args = [];
  if (productId) { sql += ' AND (cp.product_id = ? OR cp.seller_id = (SELECT seller_id FROM products WHERE id = ?))'; args.push(productId, productId); }
  if (sellerId) { sql += ' AND cp.seller_id = ?'; args.push(sellerId); }
  sql += ' ORDER BY cp.created_at DESC LIMIT ?';
  args.push(limit);
  return db.prepare(sql).all(...args);
}

/** Coupon for a product (direct or via seller) shown on the product page. */
function couponForProduct(p) {
  const db = connect();
  return db.prepare(`
    SELECT * FROM coupons WHERE kind='video' AND active=1 AND (product_id = ? OR (seller_id = ? AND product_id IS NULL))
    ORDER BY product_id DESC LIMIT 1`).get(p.id, p.seller_id);
}

function claimsForUser(userId) {
  const db = connect();
  return db.prepare(`
    SELECT cc.*, cp.code, cp.title, cp.description, cp.type, cp.value, cp.min_subtotal, cp.expires_at, cp.kind,
           s.name AS seller_name, s.slug AS seller_slug
    FROM coupon_claims cc JOIN coupons cp ON cp.id = cc.coupon_id
    LEFT JOIN sellers s ON s.id = cp.seller_id
    WHERE cc.user_id = ? ORDER BY CASE cc.status WHEN 'earned' THEN 0 WHEN 'watching' THEN 1 ELSE 2 END, cc.id DESC`).all(userId);
}

function claimFor(userId, couponId) {
  const db = connect();
  return db.prepare('SELECT * FROM coupon_claims WHERE user_id = ? AND coupon_id = ?').get(userId, couponId);
}

function ordersForUser(userId) {
  const db = connect();
  return db.prepare(`
    SELECT o.*, (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC`).all(userId);
}

function orderByCode(code, userId = null) {
  const db = connect();
  const o = userId
    ? db.prepare('SELECT * FROM orders WHERE code = ? AND user_id = ?').get(code, userId)
    : db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
  if (!o) return null;
  o.items = db.prepare(`
    SELECT oi.*, p.slug, p.vessel, p.hue, p.icon, c.name AS category_name, s.name AS seller_name, s.slug AS seller_slug
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN sellers s ON s.id = oi.seller_id
    WHERE oi.order_id = ?`).all(o.id);
  o.logistics = db.prepare('SELECT * FROM logistics WHERE order_id = ?').get(o.id);
  o.payment = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC').get(o.id);
  return o;
}

function revenueSummary() {
  const db = connect();
  const byKind = db.prepare('SELECT kind, coalesce(sum(amount),0) AS total, count(*) AS n FROM revenue_ledger GROUP BY kind').all();
  const totalRevenue = byKind.reduce((n, k) => n + k.total, 0);
  const gmv = db.prepare("SELECT coalesce(sum(subtotal - discount_total),0) AS gmv, count(*) AS orders FROM orders WHERE status != 'cancelled'").get();
  const last30 = db.prepare("SELECT coalesce(sum(amount),0) AS total FROM revenue_ledger WHERE created_at >= datetime('now','-30 day')").get().total;
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month, coalesce(sum(amount),0) AS total
    FROM revenue_ledger GROUP BY month ORDER BY month DESC LIMIT 6`).all().reverse();
  return {
    byKind, totalRevenue, last30, monthly,
    gmv: gmv.gmv, orderCount: gmv.orders,
    takeRate: gmv.gmv > 0 ? totalRevenue / gmv.gmv : 0
  };
}

module.exports = {
  productList, productBySlug, productById, relatedProducts, categoriesWithCounts,
  sellerBySlug, topSellers, videoCoupons, couponForProduct, claimsForUser, claimFor,
  ordersForUser, orderByCode, revenueSummary, TAB_CATEGORIES, BASE
};
