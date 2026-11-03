/* ALZY — one-click demo accounts on the sign-in page. */
(() => {
  'use strict';
  document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [email, password] = btn.getAttribute('data-demo').split('|');
      const form = document.querySelector('form[action="/login"]');
      if (!form) return;
      document.getElementById('email').value = email;
      document.getElementById('password').value = password;
      form.submit();
    });
  });
})();
