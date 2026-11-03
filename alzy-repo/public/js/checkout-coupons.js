/* ALZY — click an earned coupon chip to apply it at checkout. */
(() => {
  'use strict';
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-use-coupon]');
    if (!chip) return;
    const input = document.getElementById('couponCode');
    const apply = document.getElementById('applyCoupon');
    if (!input || !apply) return;
    input.value = chip.getAttribute('data-use-coupon');
    apply.click();
  });
})();
