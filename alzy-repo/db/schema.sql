-- ALZY marketplace schema (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','farmer','supplier','admin')),
  phone         TEXT,
  region        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS sellers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('farm','supplier','processor','packaging')),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  tagline      TEXT,
  description  TEXT,
  region       TEXT,
  hue          TEXT DEFAULT 'green',
  plan         TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','growth','pro')),
  plan_renews  TEXT,
  verified     INTEGER NOT NULL DEFAULT 0,
  rating       REAL NOT NULL DEFAULT 4.8,
  rating_count INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  since        TEXT DEFAULT '2024',
  payout_note  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  icon  TEXT NOT NULL DEFAULT 'leaf',
  hue   TEXT NOT NULL DEFAULT 'green',
  kind  TEXT NOT NULL DEFAULT 'food' CHECK (kind IN ('food','packaging','supplies')),
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE,
  seller_id      INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  category_id    INTEGER NOT NULL REFERENCES categories(id),
  name           TEXT NOT NULL,
  description    TEXT,
  unit           TEXT NOT NULL DEFAULT 'each',
  price          INTEGER NOT NULL,           -- cents
  compare_price  INTEGER,                    -- cents (was-price)
  moq            INTEGER NOT NULL DEFAULT 1, -- minimum order quantity
  step           INTEGER NOT NULL DEFAULT 1,
  stock          INTEGER NOT NULL DEFAULT 100,
  harvest_date   TEXT,
  region         TEXT,
  vessel         TEXT NOT NULL DEFAULT 'crate',
  hue            TEXT NOT NULL DEFAULT 'green',
  icon           TEXT NOT NULL DEFAULT 'leaf',
  badge          TEXT,
  featured       INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','soldout')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS coupons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value         INTEGER NOT NULL,            -- percent (1-100) or cents
  min_subtotal  INTEGER NOT NULL DEFAULT 0,
  product_id    INTEGER REFERENCES products(id) ON DELETE CASCADE,
  seller_id     INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'promo' CHECK (kind IN ('promo','video')),
  youtube_id    TEXT,
  video_title   TEXT,
  duration      INTEGER NOT NULL DEFAULT 0,  -- expected video length in seconds
  max_uses      INTEGER NOT NULL DEFAULT 1000,
  uses          INTEGER NOT NULL DEFAULT 0,
  per_user      INTEGER NOT NULL DEFAULT 1,
  expires_at    TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupon_claims (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id      INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'watching' CHECK (status IN ('watching','earned','used')),
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  liked          INTEGER NOT NULL DEFAULT 0,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  earned_at      TEXT,
  used_at        TEXT,
  order_id       INTEGER,
  UNIQUE (coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_claims_user ON coupon_claims(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'awaiting_payment'
                  CHECK (status IN ('awaiting_payment','paid','processing','dispatched','delivered','cancelled')),
  subtotal        INTEGER NOT NULL,
  discount_total  INTEGER NOT NULL DEFAULT 0,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  commission_total INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL,
  payment_method  TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','on_delivery','refunded')),
  payment_ref     TEXT,
  delivery_region TEXT,
  delivery_address TEXT,
  delivery_phone  TEXT,
  notes           TEXT,
  coupon_codes    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  seller_id  INTEGER NOT NULL REFERENCES sellers(id),
  name       TEXT NOT NULL,
  unit       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  discount   INTEGER NOT NULL DEFAULT 0,
  commission INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT,
  status     TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','processing','dispatched','delivered','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_seller ON order_items(seller_id);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL CHECK (plan IN ('free','growth','pro')),
  price        INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  renews_at    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  user_id    INTEGER REFERENCES users(id),
  method     TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'paid',
  reference  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logistics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  region      TEXT,
  km          INTEGER NOT NULL DEFAULT 0,
  fee         INTEGER NOT NULL DEFAULT 0,
  carrier     TEXT,
  status      TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_transit','delivered')),
  scheduled_for TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id  INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  subject    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, buyer_id, seller_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS brand_projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_name  TEXT NOT NULL,
  product_type TEXT,
  vessel      TEXT,
  colorway    TEXT,
  quantity    INTEGER NOT NULL DEFAULT 500,
  unit_price  INTEGER NOT NULL DEFAULT 180,
  setup_fee   INTEGER NOT NULL DEFAULT 250000,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'brief' CHECK (status IN ('brief','quoted','in_production','delivered')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revenue_ledger (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind      TEXT NOT NULL CHECK (kind IN ('commission','subscription','featured','logistics','brand')),
  ref_type  TEXT,
  ref_id    INTEGER,
  seller_id INTEGER,
  amount    INTEGER NOT NULL,
  note      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_kind ON revenue_ledger(kind);
