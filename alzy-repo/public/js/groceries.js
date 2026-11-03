/* ALZY — add the whole generated grocery basket to the cart. */
(() => {
  'use strict';
  const data = document.getElementById('basketData');
  const btn = document.getElementById('addAllBtn');
  if (!data || !btn) return;
  btn.addEventListener('click', async () => {
    let items = [];
    try { items = JSON.parse(data.textContent || '[]'); } catch { items = []; }
    btn.disabled = true;
    btn.textContent = 'Adding basket…';
    for (const it of items) {
      await window.ALZY.api('/api/cart', { method: 'POST', body: { product_id: it.id, qty: it.qty } }).catch(() => {});
    }
    window.ALZY.toast('Basket added to cart');
    location.href = '/cart';
  });
})();
