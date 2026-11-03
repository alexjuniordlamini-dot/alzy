# ALZY — Eswatini's Agriculture & Food Marketplace

ALZY connects Eswatini farmers, processors, packaging suppliers and agricultural suppliers with
supermarkets, restaurants, wholesalers, food processors, small businesses and individual buyers —
at the same honest prices, whether you're buying a single jar or a whole pallet.

Built with **Node.js + Express 4 + better-sqlite3**, server-rendered HTML and zero-dependency
vanilla JavaScript on the client. No build step, no bundler, no cloud services. Runs offline.

---

## Quick start

```bash
cd alzy
npm install          # better-sqlite3, express, playwright (dev)
npm start            # → http://localhost:3000
```

The database seeds itself on first boot (`data/alzy.db`).

```bash
npm run dev          # node --watch
npm run seed:force   # wipe + reseed demo data
npm test             # 20 API/integration tests
npm run test:e2e     # Playwright browser run
npm start -- --port 8080
```

Environment variables: `PORT` (default `3000`), `DB_PATH` (default `data/alzy.db`).

---

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@alzy.co.sz` | `Admin123!` |
| Buyer (individual) | `thandi@example.com` | `Alzy123!` |
| Buyer (restaurant) | `orders@grillhouse.co.sz` | `Grill123!` |
| Farmer (Pro plan) | `farm@ngwempisi.co.sz` | `Farmer123!` |
| Supplier (packaging) | `supply@manziniwholesale.co.sz` | `Supplier123!` |

The login page has **one-click demo buttons** — no typing needed.

---

## What's inside

### Marketplace
- **141 seeded listings** across **16 departments** and **18 sellers** in all four regions of Eswatini.
- Every listing carries quantity, unit, price per unit, harvest date, stock, minimum order quantity
  and minimum increment — so buying **1 jar** and **500 units** both work.
- Bulk tiers, featured listings, verified badges, ratings, reviews and buyer↔seller messaging.
- Persistent cart (signed cookie), saved favourites, order history, printable invoices and live
  order tracking (placed → packing → out for delivery → delivered).

### Departments
Meat & poultry · Fish · Fresh vegetables · Fruit · Grains & cereals · Pantry staples · Spices ·
Sauces & condiments · Beverages · Processed foods · Dairy & eggs · Honey & preserves ·
**Glass jars & bottles** · **Plastic containers** · **Bags, wraps & covers** · **Private label**

### Monthly grocery basket builder (`/groceries`)
Pick a budget (E300–E6,000) and household size; ALZY assembles the cheapest verified staple lines
across departments and shows the basket cost against typical supermarket retail, the saving as a
percentage, and budget remaining. Whole basket adds to the cart in one click.

### Coupons unlocked by watching a video (`/coupons`)
The coupon engine is real, not simulated:
1. A discounted product is shown with its price **locked** behind a coupon.
2. Click it → the site explains exactly which video to watch and how.
3. The video plays in a **real YouTube IFrame API** player embedded on the page.
4. Progress is posted to the server as the video plays; the server independently knows each
   video's duration and refuses a claim before the video has been watched to the end.
5. Liking the video is required too (a like is a deliberate click, and it's recorded).
6. On completion a **unique coupon code** is generated and attached to the account.
7. It appears as a chip on `/checkout`, applies to the eligible lines, and is burned on use.

Fourteen coupons ship with the demo: 8 video-gated (`FRESH50`, `FARM15`, `GROW20`, `CHILLI10`,
`PANTRY12`, `PACK15`, `RESTAURANT8`, `AGRO12`) and 6 promo codes (`WELCOME10`, `BULK250`,
`GROCERY75`, `HONEY15`, `BRAAI20`, `MONTHLY12`). Minimum-spend rules are enforced and shown to the
buyer — a locked chip tells you exactly how much more to add.

### Brand Studio (`/brand-studio`)
Own-brand / private label creation for farmers and new food businesses: pick a vessel (bottle, jar,
pouch, kraft bag, carton), ALZY designs and prints the label, fills and seals at a certified kitchen,
then lists the product under the farmer's own name. Priced at **E2,500 setup + E1.80 per filled
unit, 300-unit minimum**, with a project tracker in the account area.

### Payments (simulated)
MTN MoMo · Eswatini Mobile Money · Visa/Mastercard · Cash on delivery · Bank transfer (EFT).
No money moves and no card details are ever stored — this is clearly labelled throughout the UI.

---

## How ALZY makes money

All four revenue lines are live, written to `revenue_ledger`, and reported on `/admin`:

| Line | Model | Where it's visible |
| --- | --- | --- |
| **Transaction commission** | 8% Free · 6% Growth · 4% Pro, charged per line | Admin revenue, seller dashboard "ALZY commission" |
| **Supplier subscriptions** | Free E0 · Growth E299/mo · Pro E799/mo | `/sell` plans, seller → Subscription |
| **Featured listings** | E150 per listing per 7 days | "Featured" gold badge, promoted rails, `/sell` |
| **Logistics coordination** | E45 base + E2.50/km beyond 10 km | Checkout summary, invoice, admin |

Plus **Brand Studio** project revenue (setup fee + per-unit filling).

Seeded demo totals: **E48,333 GMV → E34,700 marketplace revenue** across all five lines.

---

## Architecture

```
alzy/
├── server.js              Express app, middleware stack, /art router, 404 + 500
├── db/
│   ├── schema.sql         18 tables (users, sellers, categories, products, coupons,
│   │                      coupon_claims, orders, order_items, payments, logistics,
│   │                      revenue_ledger, messages, reviews, favorites, brand_projects, …)
│   ├── index.js           connection + transaction helper
│   └── seed.js            idempotent seed (--force to wipe)
├── lib/
│   ├── config.js          brand, currency, commissions, plans, regions, pricing
│   ├── art.js             offline SVG engine — 43 vessel renderers, hash-keyed variation
│   ├── layout.js          render(), nav, footer, productCard, money/date helpers
│   ├── money.js           fees, commissions, delivery pricing (all money in cents)
│   ├── auth.js            scrypt hashing, session + coupon + order code generation
│   ├── cartcookie.js      signed cart cookie codec
│   └── queries.js         DB query layer
├── middleware/index.js    session, locals, requireAuth/Seller/Admin, flash
├── routes/                art, shop, auth, cart, checkout, coupons, account, seller,
│                          messages, admin, api
├── public/
│   ├── css/alzy.css       design system (single file, no framework)
│   ├── js/alzy.js         no-dependency client: toasts, cart, steppers, checkout totals
│   ├── js/watch.js        YouTube IFrame API engine + fallback
│   ├── js/*.js            page-specific modules (all externalised — no inline scripts)
│   └── images/            hero + lifestyle photography
├── tests/api.test.js      20 self-contained tests
└── data/alzy.db           SQLite (generated)
```

**Money is stored in cents** everywhere and formatted as `E` + 2dp at the edge.

### Design
Apple-like clarity (large type, generous space, restrained palette, one job per section) combined
with eBay-like practical marketplace furniture (dense product grids, filters, MOQ, bulk tiers,
ratings, seller badges). Mobile-first responsive down to 390 px.

Imagery is **generated locally as SVG** (`/art/product/:vessel/:hue/:icon`) — 43 hand-built vessel
renderers × palette hues × icons, hash-keyed so each product gets a stable, distinct illustration.
No external image CDN, no network dependency, instant loads.

---

## Testing

```bash
npm test
```

20/20 passing, covering: auth + session enforcement, cart (add/update/remove, MOQ enforcement),
delivery fee quoting, coupon validation and minimum-spend rules, video-coupon gating (cannot claim
before the video ends; progress persists), order placement, stock decrement, revenue ledger writes,
seller dashboard (listings, subscription, featured), admin revenue aggregation, messaging,
grocery budget builder, SVG art endpoints, XSS escaping in search, and SQL-injection safety.

```bash
npx playwright install chromium   # once (browser binary)
npm start                         # in one terminal
npm run test:e2e                  # in another
```

29/29 passing. Drives a real Chromium session through the money path: home render → login → add to
cart → checkout hydration → coupon apply → delivery re-quote → place order → invoice reconciliation
→ seller storefront → coupons page → Brand Studio → admin revenue lines → zero uncaught errors.

> The E2E run places real orders and spends one-time coupons. Run `npm run reset` afterwards to
> restore pristine demo data.

---

## Security notes

- Passwords hashed with **scrypt** + per-user salt.
- All SQL uses prepared statements with bound parameters.
- All user-supplied output passes through `esc()`; search/XSS and SQLi attempts are covered by tests.
- HttpOnly, SameSite=Lax session cookies; cart cookie is signed and never pre-encoded.
- Stock is re-checked server-side at order placement, not trusted from the client.
- Coupon eligibility (ownership, minimum spend, expiry, one-time use) is validated server-side.

---

## Scope

This is a complete, self-contained demonstration marketplace. Payments are **simulated** by design;
there is no payment-processor integration and no real money movement. Everything else — accounts,
listings, cart, coupons, orders, commissions, messaging, dashboards — is fully functional and
persisted in SQLite.

---

© 2026 ALZY Marketplace (Pty) Ltd · Mbabane, Eswatini
