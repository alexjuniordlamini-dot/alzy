/* ALZY client — vanilla JS, no dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- toasts ---------------- */
  const stack = $('#toastStack');
  function toast(message, { href, linkText, error } = {}) {
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast' + (error ? ' err' : '');
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (href) {
      const a = document.createElement('a');
      a.href = href; a.textContent = linkText || 'View';
      el.appendChild(a);
    }
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 300); }, 3600);
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(url, { method = 'GET', body } = {}) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      if (res.status === 401) {
        toast('Please sign in to continue.', { href: '/login?next=' + encodeURIComponent(location.pathname), linkText: 'Sign in' });
        throw new Error(data.error || 'Sign in required');
      }
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  }

  /* ---------------- nav ---------------- */
  const nav = $('#siteNav');
  const searchToggle = $('#searchToggle');
  const navSearch = $('#navSearch');
  if (searchToggle && navSearch) {
    searchToggle.addEventListener('click', () => {
      const open = navSearch.hidden;
      navSearch.hidden = !open;
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) navSearch.querySelector('input').focus();
    });
  }
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  /* account dropdown */
  const menuToggle = $('[data-menu-toggle]');
  if (menuToggle) {
    const wrap = menuToggle.closest('.account-menu');
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(wrap.classList.contains('open')));
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') wrap.classList.remove('open'); });
  }

  /* flash dismiss */
  $$('.flash-close').forEach(b => b.addEventListener('click', () => b.closest('.flash').remove()));

  /* ---------------- add to cart ---------------- */
  let cartBadge = $('.cart-count');
  function updateCartBadge(n) {
    if (!cartBadge) {
      const btn = $('.cart-btn');
      if (btn && n > 0) {
        cartBadge = document.createElement('span');
        cartBadge.className = 'cart-count';
        btn.appendChild(cartBadge);
      }
    }
    if (cartBadge) cartBadge.textContent = String(n);
  }

  async function addToCart(id, qty = 1) {
    try {
      const data = await api('/api/cart', { method: 'POST', body: { product_id: Number(id), qty: Number(qty) } });
      updateCartBadge(data.count);
      toast(data.message || 'Added to cart', { href: '/cart', linkText: 'View cart' });
      return data;
    } catch (e) {
      if (e.message && !/sign in/i.test(e.message)) toast(e.message, { error: true });
    }
  }

  document.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault();
      add.disabled = true;
      const qtyInput = $('[data-qty-input]');
      const qty = add.hasAttribute('data-use-qty') && qtyInput ? Number(qtyInput.value) || 1 : 1;
      await addToCart(add.getAttribute('data-add'), qty);
      add.disabled = false;
      return;
    }
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault();
      const id = Number(fav.getAttribute('data-fav'));
      try {
        const data = await api('/api/favorites', { method: 'POST', body: { product_id: id } });
        fav.classList.toggle('is-fav', data.favorited);
        fav.setAttribute('aria-pressed', String(data.favorited));
        toast(data.favorited ? 'Saved to your favourites' : 'Removed from favourites', { href: data.favorited ? '/account/favorites' : null, linkText: 'View saved' });
      } catch { /* handled by api() */ }
    }
  });

  /* ---------------- quantity steppers ---------------- */
  $$('[data-stepper]').forEach(st => {
    const input = $('input', st);
    const step = Number(input.getAttribute('data-step') || 1);
    const min = Number(input.getAttribute('data-min') || 1);
    $('[data-dec]', st)?.addEventListener('click', () => {
      const v = Math.max(min, (Number(input.value) || min) - step);
      input.value = v; input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    $('[data-inc]', st)?.addEventListener('click', () => {
      input.value = (Number(input.value) || min) + step;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  /* ---------------- cart page ---------------- */
  const cartRoot = $('[data-cart-root]');
  if (cartRoot) {
    async function refreshCart() {
      const data = await api('/api/cart');
      renderCart(data);
    }
    function money(c) { return 'E' + (c / 100).toLocaleString('en-SZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function renderCart(data) {
      updateCartBadge(data.count);
      const list = $('[data-cart-lines]');
      if (!list) return;
      if (!data.items.length) {
        list.innerHTML = `<div class="empty"><div class="empty-art"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg></div><h3>Your cart is empty</h3><p>Browse today's deals — from a single jar to a whole pallet.</p><a class="btn btn-dark" href="/shop">Start shopping</a></div>`;
        const summary = $('[data-cart-summary]');
        if (summary) summary.innerHTML = '';
        return;
      }
      list.innerHTML = data.items.map(it => `
        <div class="cart-line" data-line="${it.product_id}">
          <img src="/art/product/${encodeURIComponent(it.vessel)}/${encodeURIComponent(it.hue)}/${encodeURIComponent(it.icon)}?label=${encodeURIComponent(it.category_name || 'ALZY')}" alt="${escapeHtml(it.name)}">
          <div>
            <a href="/product/${encodeURIComponent(it.slug)}" style="font-weight:600;font-size:14.5px">${escapeHtml(it.name)}</a>
            <div class="small muted" style="margin-top:2px">${escapeHtml(it.seller_name)} · ${money(it.price)} / ${escapeHtml(it.unit)}</div>
            <div class="tag-row" style="margin-top:8px">
              <div class="qty-stepper">
                <button type="button" data-cart-dec="${it.product_id}" aria-label="Decrease">−</button>
                <input type="number" value="${it.qty}" min="${it.moq}" step="${it.step}" data-cart-qty="${it.product_id}" aria-label="Quantity">
                <button type="button" data-cart-inc="${it.product_id}" aria-label="Increase">+</button>
              </div>
              <button class="btn btn-ghost btn-sm" data-cart-remove="${it.product_id}">Remove</button>
            </div>
            ${it.moq > 1 ? `<div class="tiny muted" style="margin-top:6px">Minimum ${it.moq} ${escapeHtml(it.unit)}s for this seller</div>` : ''}
          </div>
          <div style="text-align:right">
            <b class="mono">${money(it.line_total)}</b>
            <div class="tiny muted">${it.qty} × ${money(it.price)}</div>
          </div>
        </div>`).join('');

      const summary = $('[data-cart-summary]');
      if (summary) {
        summary.innerHTML = `
          <h3 style="font-size:16px;margin-bottom:14px">Order summary</h3>
          <div class="sum-row"><span>Subtotal (${data.count} items)</span><span class="mono">${money(data.subtotal)}</span></div>
          <div class="sum-row"><span>VAT</span><span class="tiny muted">Included</span></div>
          <div class="sum-row discount"><span>Coupons</span><span class="tiny muted">Applied at checkout</span></div>
          <div class="sum-row total"><span>Subtotal</span><span class="mono">${money(data.subtotal)}</span></div>
          <a class="btn btn-dark btn-block" href="/checkout" style="margin-top:16px">Checkout · ${money(data.subtotal)}</a>
          <p class="tiny muted" style="margin-top:12px;text-align:center">Delivery is calculated at checkout · E45 coordination from Mbabane</p>`;
      }
    }
    cartRoot.addEventListener('click', async (e) => {
      const dec = e.target.closest('[data-cart-dec]');
      const inc = e.target.closest('[data-cart-inc]');
      const rem = e.target.closest('[data-cart-remove]');
      try {
        if (dec || inc) {
          const id = Number((dec || inc).getAttribute(dec ? 'data-cart-dec' : 'data-cart-inc'));
          const input = $(`[data-cart-qty="${id}"]`);
          const step = Number(input.getAttribute('step') || 1);
          const min = Number(input.getAttribute('min') || 1);
          const qty = Math.max(min, Number(input.value || min) + (inc ? step : -step));
          input.value = qty;
          await api('/api/cart/update', { method: 'PATCH', body: { product_id: id, qty } });
          await refreshCart();
        }
        if (rem) {
          const id = Number(rem.getAttribute('data-cart-remove'));
          await api('/api/cart', { method: 'DELETE', body: { product_id: id } });
          await refreshCart();
        }
      } catch (err) { toast(err.message, { error: true }); }
    });
    cartRoot.addEventListener('change', async (e) => {
      const input = e.target.closest('[data-cart-qty]');
      if (!input) return;
      const id = Number(input.getAttribute('data-cart-qty'));
      try {
        await api('/api/cart/update', { method: 'PATCH', body: { product_id: id, qty: Number(input.value) } });
        await refreshCart();
      } catch (err) { toast(err.message, { error: true }); await refreshCart(); }
    });
  }

  /* ---------------- checkout: delivery fee + coupon ---------------- */
  const checkout = $('[data-checkout]');
  if (checkout) {
    const regionSel = $('#deliveryRegion');
    // scope to the summary card so we never touch the wrapper element
    const summary = $('.summary-card');
    const feeEl = summary && summary.querySelector('[data-fee]');
    const totalEl = summary && summary.querySelector('[data-total]');
    const subEl = summary && summary.querySelector('[data-subtotal]');
    const discountEl = summary && summary.querySelector('[data-discount]');
    const couponInput = $('#couponCode');
    const applyBtn = $('#applyCoupon');
    const appliedBox = $('[data-applied-coupon]');
    let state = { subtotal: Number(checkout.dataset.cartSubtotal || 0), discount: 0, fee: Number(checkout.dataset.cartFee || 0), couponCode: null };

    const money = (c) => 'E' + (c / 100).toLocaleString('en-SZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function renderTotals() {
      if (subEl) subEl.textContent = money(state.subtotal);
      if (discountEl) discountEl.textContent = '−' + money(state.discount);
      if (feeEl) feeEl.textContent = state.fee === 0 ? 'Free' : money(state.fee);
      if (totalEl) totalEl.textContent = money(Math.max(0, state.subtotal - state.discount + state.fee));
    }

    async function updateFee() {
      const region = regionSel ? regionSel.value : '';
      try {
        const data = await api('/api/delivery-fee', { method: 'POST', body: { region, subtotal: state.subtotal } });
        state.fee = data.fee;
        renderTotals();
      } catch { /* ignore */ }
    }
    if (regionSel) regionSel.addEventListener('change', updateFee);

    async function applyCoupon(code) {
      if (!code) return;
      try {
        const data = await api('/api/coupons/validate', { method: 'POST', body: { code, subtotal: state.subtotal } });
        state.discount = data.discount;
        state.couponCode = data.code;
        appliedBox.innerHTML = `<span>${escapeHtml(data.code)} applied — ${escapeHtml(data.title)}</span><button type="button" data-remove-coupon="${escapeHtml(data.code)}" aria-label="Remove coupon">×</button>`;
        appliedBox.hidden = false;
        couponInput.value = '';
        renderTotals();
        toast(`Coupon applied — you save ${money(data.discount)}`);
      } catch (err) {
        toast(err.message, { error: true });
        appliedBox.hidden = true;
        state.discount = 0;
        state.couponCode = null;
        renderTotals();
      }
    }
    applyBtn?.addEventListener('click', () => applyCoupon(couponInput.value.trim().toUpperCase()));
    couponInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(couponInput.value.trim().toUpperCase()); } });
    checkout.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-use-coupon]');
      if (chip && Number(chip.dataset.min || 0) > state.subtotal) {
        toast(`Add ${money(Number(chip.dataset.min) - state.subtotal)} more to use ${chip.dataset.useCoupon}`, { error: true });
        return;
      }
      const rm = e.target.closest('[data-remove-coupon]');
      if (rm) {
        state.discount = 0;
        state.couponCode = null;
        appliedBox.hidden = true;
        renderTotals();
        toast('Coupon removed');
      }
    });

    /* payment method selection */
    $$('.pay-option').forEach(opt => {
      opt.addEventListener('click', () => {
        $$('.pay-option').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        opt.querySelector('input').checked = true;
      });
    });

    /* coupon prefill from ?coupon= */
    const applied = new URLSearchParams(location.search).get('coupon');
    if (applied) applyCoupon(applied.toUpperCase());

    /* submit */
    const form = $('#checkoutForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#placeOrderBtn');
      const method = $('input[name="payment_method"]:checked')?.value;
      if (!method) return toast('Choose a payment method', { error: true });
      btn.disabled = true; btn.textContent = 'Processing…';
      try {
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        payload.subtotal = state.subtotal;
        payload.discount = state.discount;
        payload.fee = state.fee;
        if (state.couponCode) payload.coupon_code = state.couponCode;
        payload.delivery_region = payload.delivery_region || (regionSel ? regionSel.value : '');
        const data = await api('/api/orders', { method: 'POST', body: payload });
        if (data.redirect) location.href = data.redirect;
      } catch (err) {
        toast(err.message, { error: true });
        btn.disabled = false; btn.textContent = 'Place order securely';
      }
    });

    renderTotals();
  }

  /* ---------------- product page ---------------- */
  const pdp = $('[data-product-page]');
  if (pdp) {
    const tabs = $$('[data-pdp-tab]');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('is-active'));
      t.classList.add('is-active');
      $$('[data-pdp-panel]').forEach(p => { p.hidden = p.getAttribute('data-pdp-panel') !== t.getAttribute('data-pdp-tab'); });
    }));
  }

  /* ---------------- copy buttons ---------------- */
  document.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (!copy) return;
    try {
      await navigator.clipboard.writeText(copy.getAttribute('data-copy'));
      toast('Copied to clipboard');
    } catch {
      toast('Copy failed — select the code manually', { error: true });
    }
  });

  /* ---------------- shop filters auto-submit ---------------- */
  $$('[data-autosubmit]').forEach(el => {
    el.addEventListener('change', () => el.closest('form')?.submit());
  });

  window.ALZY = { toast, api, updateCartBadge };
})();
