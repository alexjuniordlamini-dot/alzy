#!/usr/bin/env node
/**
 * ALZY end-to-end browser test.
 *
 *   npm start            # in one terminal
 *   npm run test:e2e     # in another
 *
 * Drives a real Chromium session through the money path:
 *   home → login → shop → add to cart → checkout → apply an earned coupon
 *   → place order → invoice → seller storefront → coupons page → admin
 *
 * Requires `playwright` (dev dependency) and a running server.
 * Override the target with BASE_URL=http://127.0.0.1:3000
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(here, '..', '..', 'node_modules', 'playwright')));
}

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

async function ready(page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
  });
  await page.waitForTimeout(300);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('form[action="/login"] button[type=submit]');
  await page.waitForTimeout(1600);
  return /\/(account|admin|seller)/.test(page.url());
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  try {
    /* ---------- 1. home ---------- */
    console.log('\nHome');
    const home = await page.goto(BASE, { waitUntil: 'networkidle' });
    check('home returns 200', home.status() === 200);
    const h1 = await page.locator('h1').first().innerText();
    check('hero headline renders', /harvest/i.test(h1), h1);
    const heroColor = await page.locator('h1').first().evaluate((e) => getComputedStyle(e).color);
    check('hero headline is white on the dark hero', heroColor === 'rgb(255, 255, 255)', heroColor);
    const placeholderColor = await page.locator('.search-shell input').evaluate((e) => getComputedStyle(e).color);
    check('hero search text is dark on white', placeholderColor === 'rgb(11, 31, 22)', placeholderColor);
    check('lifestyle photo tiles load', await page.locator('img.tile-bg').first().evaluate((i) => i.naturalWidth > 0));
    const cartCount = await page.locator('.cart-count').first().innerText().catch(() => '');
    check('nav renders', (await page.locator('.nav-links a').count()) >= 6, `${await page.locator('.nav-links a').count()} links`);

    /* ---------- 2. login ---------- */
    console.log('\nLogin');
    check('demo login reaches /account', await login(page, 'thandi@example.com', 'Alzy123!'));

    /* ---------- 3. shop + cart ---------- */
    console.log('\nShop & cart');
    await page.goto(`${BASE}/shop?category=fresh-vegetables`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const before = await page.locator('.cart-count').first().innerText().catch(() => '0');
    await page.locator('[data-add]').first().click();
    await page.waitForTimeout(900);
    const after = await page.locator('.cart-count').first().innerText().catch(() => '0');
    check('add to cart increments the badge', Number(after) > Number(before || 0), `${before} → ${after}`);

    /* ---------- 4. checkout (the bug that used to blank the page) ---------- */
    console.log('\nCheckout');
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    check('checkout form survives hydration', (await page.locator('#checkoutForm').count()) === 1);
    check('payment methods render', (await page.locator('.pay-option').count()) === 5);
    const subtotalTxt = await page.locator('[data-subtotal]').first().innerText();
    check('order summary shows a subtotal', /E[\d,.]+/.test(subtotalTxt), subtotalTxt);

    const chips = page.locator('[data-use-coupon]');
    const chipCount = await chips.count();
    check('earned coupons appear as chips', chipCount > 0, `${chipCount} chips`);

    // add enough stock to clear a minimum-spend coupon
    if (chipCount && (await page.locator('[data-use-coupon]:not(.is-locked)').count()) === 0) {
      await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-add]').nth(i).click();
        await page.waitForTimeout(350);
      }
      await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
    }

    // Prefer an earned (video) coupon chip; fall back to a public promo code. Earned coupons are
    // single-use, so a re-run of this suite legitimately has none left to spend.
    const openChip = page.locator('[data-use-coupon]:not(.is-locked)').first();
    if (await openChip.count()) {
      await openChip.click();
    } else {
      await page.fill('#couponCode', 'BRAAI20');
      await page.click('#applyCoupon');
    }
    await page.waitForTimeout(900);
    const disc = await page.locator('[data-discount]').first().innerText();
    check('coupon applies a discount', /E\d/.test(disc) && !/E0\.00/.test(disc), disc);

    await page.fill('#deliveryAddress', 'Plot 42, Mbabane');
    await page.fill('#deliveryPhone', '+268 7612 3456');
    await page.selectOption('#deliveryRegion', 'Manzini');
    await page.waitForTimeout(800);
    const feeTxt = await page.locator('[data-fee]').first().innerText();
    const subtotalCents = Number((await page.locator('[data-checkout]').getAttribute('data-cart-subtotal')) || 0);
    const expectBase = 4500 + (42 - 10) * 250 + (subtotalCents > 500000 ? Math.round(subtotalCents * 0.01) : 0);
    const expectFee = 'E' + (expectBase / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    check('delivery fee re-quotes on region change', feeTxt.trim() === expectFee, `${feeTxt} (expected ${expectFee})`);

    const displayTotal = await page.locator('[data-total]').first().innerText();

    /* ---------- 5. place order ---------- */
    console.log('\nOrder');
    await page.click('#placeOrderBtn');
    await page.waitForTimeout(2600);
    check('order confirmation reached', /\/orders\/ALZ-/.test(page.url()), page.url());
    const invoice = await page.evaluate(() => document.body.innerText);
    const invoiceTotal = (invoice.match(/Total\s+(E[\d,.]+)/) || [])[1];
    check('invoice total matches the checkout total', invoiceTotal === displayTotal, `${displayTotal} vs ${invoiceTotal}`);
    check('invoice lists the coupon discount', /Coupons\s+\w+/.test(invoice));
    check('order code shown', /ALZ-[A-F0-9]{6}-\d{4}/.test(invoice));

    /* ---------- 6. seller storefront ---------- */
    console.log('\nSeller storefront');
    const store = await page.goto(`${BASE}/seller/ngwempisi`, { waitUntil: 'networkidle' });
    check('storefront returns 200', store.status() === 200);
    check('storefront lists products', (await page.locator('.product-card').count()) > 0);

    /* ---------- 7. coupons page ---------- */
    console.log('\nCoupons');
    await page.goto(`${BASE}/coupons`, { waitUntil: 'networkidle' });
    check('coupon page renders video cards', (await page.locator('.coupon-grid > *, .coupon-media').count()) >= 3);
    check('coupon page offers unlock actions', (await page.locator('[data-watch], .coupon-play').count()) > 0);

    /* ---------- 8. brand studio headline (used to be white-on-white) ---------- */
    console.log('\nBrand Studio');
    await page.goto(`${BASE}/brand-studio`, { waitUntil: 'networkidle' });
    const bsColor = await page.locator('h1').first().evaluate((e) => getComputedStyle(e).color);
    check('brand studio headline is visible', bsColor === 'rgb(11, 31, 22)', bsColor);

    /* ---------- 9. admin ---------- */
    console.log('\nAdmin');
    await ctx.clearCookies();
    check('admin can sign in', await login(page, 'admin@alzy.co.sz', 'Admin123!'));
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    const adminTxt = await page.evaluate(() => document.body.innerText);
    for (const line of ['Transaction commission', 'Supplier subscriptions', 'Featured listings', 'Logistics coordination']) {
      check(`admin shows "${line}" revenue`, adminTxt.includes(line));
    }

    /* ---------- 10. console clean ---------- */
    console.log('\nConsole');
    const real = pageErrors.filter((e) => !/youtube|ytimg|google|favicon/i.test(e));
    check('no uncaught page errors', real.length === 0, real.slice(0, 2).join(' | '));
  } catch (err) {
    failures++;
    console.log(`\n✗ fatal: ${err.message}`);
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass} passed, ${failures} failed\n`);
  process.exit(failures ? 1 : 0);
})();
