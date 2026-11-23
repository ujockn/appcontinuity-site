const FORM_ENDPOINT = 'https://formsubmit.co/ajax/18f3ff007dd38e25e05f7440c3319c72';

const form = document.getElementById('unsubscribe-form');
const err = document.getElementById('unsub-err');
const thanks = document.getElementById('unsub-thanks');
const email = document.getElementById('unsub-email');

function showThanks() {
  form.hidden = true;
  thanks.hidden = false;
  thanks.focus();
}

if (form && err && thanks && email) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('done') === '1') showThanks();
  const pre = params.get('email');
  if (pre) email.value = pre.trim();
  // Keep the address out of the visible URL and browser history.
  if (pre || params.get('done')) history.replaceState(null, '', window.location.pathname);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    email.removeAttribute('aria-invalid');
    err.textContent = '';
    const honey = form.elements.namedItem('_honey');
    if (honey && honey.value) return;
    if (!email.value || !email.validity.valid) {
      err.textContent = 'Please enter the email address that gets these notes.';
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const r = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json().catch(() => ({}));
      if (String(j.success) !== 'true') throw new Error(j.message || 'send failed');
    } catch {
      err.textContent = 'That did not go through. Reply “stop” to any of our emails, or email contact@appcontinuity.com, and we will remove you.';
      if (btn) btn.disabled = false;
      return;
    }
    showThanks();
  });
}
