const FORM_ENDPOINT = 'https://formsubmit.co/ajax/18f3ff007dd38e25e05f7440c3319c72';

const printBtn = document.getElementById('print-checklist');
if (printBtn) printBtn.addEventListener('click', () => window.print());

const form = document.getElementById('checklist-form');
const err = document.getElementById('checklist-form-err');
const thanks = document.getElementById('checklist-thanks');
if (!form || !err || !thanks) {
  // Page still works without the optional signup form.
} else {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements.namedItem('name');
    const email = form.elements.namedItem('email');
    const consent = form.elements.namedItem('consent');
    const honey = form.elements.namedItem('_honey');
    [name, email].forEach((f) => f && f.removeAttribute('aria-invalid'));
    err.textContent = '';

    if (honey && honey.value) return;

    let msg = '';
    if (!name || !name.value.trim()) {
      msg = 'Please add your name.';
      if (name) { name.setAttribute('aria-invalid', 'true'); name.focus(); }
    } else if (!email || !email.validity.valid || !email.value) {
      msg = 'Please add a valid email address.';
      if (email) { email.setAttribute('aria-invalid', 'true'); email.focus(); }
    } else if (!consent || !consent.checked) {
      msg = 'Tick the box if you want the PDF emailed and short follow-ups. You can also download the PDF above with no email.';
      if (consent) consent.focus();
    }
    err.textContent = msg;
    if (msg) return;

    const replyTo = document.getElementById('checklist-replyto');
    if (replyTo) replyTo.value = email.value.trim();

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
      err.textContent = 'The form did not send. You can still download the PDF above, or email contact@appcontinuity.com.';
      if (btn) btn.disabled = false;
      return;
    }

    const thanksEmail = document.getElementById('checklist-thanks-email');
    if (thanksEmail) thanksEmail.textContent = email.value.trim();
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  });
}
