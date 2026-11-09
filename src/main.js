import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sound } from './audio.js';
import { scramble, prepare } from './scramble.js';

gsap.registerPlugin(ScrollTrigger);

// Optional: set to a form backend URL (Formspree, Basin, a serverless function…)
// to actually deliver fit-check requests. Empty = show the thank-you state only.
const FORM_ENDPOINT = 'https://formsubmit.co/ajax/ujockn-86qf0n+fitcheck@mail.grokbot.com';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const sound = new Sound();
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

if (!reduced) root.classList.add('js-motion');

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ---------- loader ----------
const loader = $('#loader'), pctEl = $('#loader-pct'), barEl = $('#loader-bar');
let shown = 0, target = 0;
const loaderStart = performance.now();
function loaderTick() {
  shown += (target - shown) * (reduced ? 1 : 0.12);
  if (target - shown < 0.4 && target >= 100) shown = 100;
  pctEl.textContent = String(Math.round(shown)).padStart(2, '0');
  barEl.style.width = `${shown}%`;
  if (shown < 100) requestAnimationFrame(loaderTick);
}
requestAnimationFrame(loaderTick);
const setLoad = (p) => { target = Math.max(target, Math.round(p * 100)); };

async function boot() {
  let world = null;
  const canvas = $('#world');
  setLoad(0.05);
  if (hasWebGL()) {
    try {
      const { createWorld } = await import('./scene.js');
      setLoad(0.25);
      world = await createWorld(canvas, { mobile, onProgress: (p) => setLoad(0.25 + p * 0.65) });
    } catch (e) { console.warn('WebGL scene failed, using static fallback', e); world = null; }
  }
  if (!world) root.classList.add('no-webgl');
  await document.fonts?.ready;
  setLoad(1);
  const minTime = reduced ? 0 : 1100;
  await new Promise((r) => setTimeout(r, Math.max(0, minTime - (performance.now() - loaderStart)) + (reduced ? 0 : 450)));
  loader.classList.add('is-done');
  setTimeout(() => loader.remove(), 1200);
  start(world);
}

function start(world) {
  const sections = $$('[data-sec]');
  const labels = $$('.plabel');

  // ---------- reveals + scramble ----------
  $$('[data-scramble], [data-scramble-hover]').forEach(prepare);
  if (!reduced) {
    const heroEls = $$('.hero .reveal');
    gsap.to(heroEls, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.09, delay: 0.15 });
    scramble($('.hero h1'), { duration: 1100 });
    sections.slice(1).forEach((sec) => {
      const els = $$('.reveal', sec);
      gsap.to(els, {
        opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08,
        scrollTrigger: { trigger: sec, start: 'top 72%', once: true },
      });
      const h = $('[data-scramble]', sec);
      if (h) ScrollTrigger.create({ trigger: sec, start: 'top 65%', onEnter: () => { scramble(h); sound.glitch(); }, onEnterBack: () => scramble(h, { duration: 500 }) });
    });
    $$('[data-scramble-hover]').forEach((el) => {
      el.addEventListener('pointerenter', () => { scramble(el, { duration: 380, stagger: 0.8 }); sound.hover(); });
      el.addEventListener('focus', () => scramble(el, { duration: 380, stagger: 0.8 }));
    });
  }

  // ---------- sound toggle ----------
  const sbtn = $('#sound');
  sbtn.addEventListener('click', async () => {
    const on = await sound.setEnabled(!sound.enabled);
    sbtn.setAttribute('aria-pressed', String(on));
    sbtn.setAttribute('aria-label', on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on');
    $('.sound__txt', sbtn).textContent = on ? 'Sound on' : 'Sound off';
    if (on) sound.chime(2, 0.7);
  });

  // ---------- footer loop ----------
  $('#loop').addEventListener('click', () => { sound.chime(4, 0.6); });

  // ---------- form ----------
  const form = $('#fit-form'), err = $('#form-err');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name, email = form.email, app = form.app;
    [name, email, app].forEach((f) => f.removeAttribute('aria-invalid'));
    let msg = '';
    if (!name.value.trim()) { msg = 'Please add your name.'; name.setAttribute('aria-invalid', 'true'); name.focus(); }
    else if (!email.validity.valid || !email.value) { msg = 'Please add a valid email address.'; email.setAttribute('aria-invalid', 'true'); email.focus(); }
    else if (app.value && !app.validity.valid) { msg = 'That app link doesn’t look like a URL.'; app.setAttribute('aria-invalid', 'true'); app.focus(); }
    err.textContent = msg;
    if (msg) { sound.glitch(); return; }
    if (FORM_ENDPOINT) {
      try {
        const r = await fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(r.status);
      } catch { err.textContent = 'Something went wrong sending that. Please try again.'; return; }
    }
    $('#thanks-email').textContent = email.value;
    form.hidden = true;
    const th = $('#thanks'); th.hidden = false; th.focus();
    if (!reduced) gsap.fromTo(th, { opacity: 0, filter: 'blur(10px)', y: 16 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.8, ease: 'power3.out' });
    sound.pulse();
  });

  // ---------- platform panels ----------
  const PLATFORMS = [
    {
      name: 'Web', eyebrow: 'Platform · Web',
      title: 'Web: Stripe and Supabase, one entitlement.',
      lede: 'Your web app already signs people in with Supabase and sells subscriptions through Stripe. We connect those Stripe subscriptions to RevenueCat and map each Supabase user to a RevenueCat customer, so a web purchase unlocks the same entitlement your iPhone and Android apps check.',
      items: [
        'Stripe web subscriptions connected to RevenueCat',
        'Supabase users mapped to RevenueCat customers',
        'Web access decided by the same entitlement as iPhone and Android',
        'Acceptance scenarios for web purchase, cancellation and refund',
      ],
      note: '<strong>Stays yours.</strong> Your Stripe, Supabase and RevenueCat accounts, and changes in your repository.',
    },
    {
      name: 'iPhone', eyebrow: 'Platform · iPhone',
      title: 'iPhone: App Store subscriptions through RevenueCat.',
      lede: 'In-app subscriptions on iPhone, wired through RevenueCat inside your existing Capacitor app. Someone who subscribed on the web gets the same access in the app, and an App Store subscription unlocks the same entitlement everywhere else.',
      items: [
        'App Store subscriptions via RevenueCat in your Capacitor app',
        'Restore purchases and account switching handled',
        'Sandbox acceptance tests for purchase, renewal, cancellation, refund and restore',
      ],
      note: '<strong>Stays yours.</strong> Your App Store Connect and RevenueCat accounts, and your existing codebase.',
    },
    {
      name: 'Android', eyebrow: 'Platform · Android',
      title: 'Android: Google Play subscriptions, same entitlement.',
      lede: 'Google Play subscriptions wired through RevenueCat in the same Capacitor codebase, feeding the same entitlement as web and iPhone. Paid access on Android matches what the person sees everywhere else.',
      items: [
        'Google Play subscriptions via RevenueCat in your Capacitor app',
        'The same entitlement as web and iPhone',
        'Acceptance tests for purchase, renewal, cancellation, refund, restore and account switching',
      ],
      note: '<strong>Stays yours.</strong> Your Google Play Console and RevenueCat accounts, and your existing codebase.',
    },
  ];
  const panel = $('#panel');
  let current = null, opener = null;
  function fillPanel(i, swap) {
    const d = PLATFORMS[i];
    current = i;
    $('#panel-eyebrow').textContent = d.eyebrow;
    $('#panel-h').textContent = d.title;
    $('#panel-lede').textContent = d.lede;
    $('#panel-list').replaceChildren(...d.items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    $('#panel-note').innerHTML = d.note;
    const n = (i + 1) % 3;
    $('#panel-next').textContent = `Next: ${PLATFORMS[n].name} →`;
    $('#panel-next').dataset.to = n;
    $$('[data-tab]', panel).forEach((b) => b.setAttribute('aria-current', String(+b.dataset.tab === i)));
    if (swap && !reduced) { panel.classList.remove('is-swap'); void panel.offsetWidth; panel.classList.add('is-swap'); }
    world?.focus(i);
  }
  function openPanel(i, from) {
    if (panel.open) { fillPanel(i, true); sound.chime(i * 2 + 1, 0.6); return; }
    opener = from || document.activeElement;
    fillPanel(i, false);
    root.classList.add('panel-open');
    panel.showModal();
    $('#panel-close').focus();
    sound.chime(i * 2 + 1, 0.8);
  }
  function closePanel() { if (panel.open) panel.close(); }
  panel.addEventListener('close', () => {
    root.classList.remove('panel-open');
    panel.classList.remove('is-swap');
    world?.focus(null);
    sound.chime(0, 0.4);
    if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
    opener = null;
  });
  $('#panel-close').addEventListener('click', closePanel);
  // click outside the panel content (on the backdrop) closes it
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
  // keep Tab inside the dialog
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button, a[href], [tabindex]:not([tabindex="-1"])', panel).filter((el) => el.offsetParent !== null);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('#panel-next').addEventListener('click', (e) => openPanel(+e.currentTarget.dataset.to));
  $$('[data-tab]', panel).forEach((b) => b.addEventListener('click', () => openPanel(+b.dataset.tab)));
  $('#panel-cta').addEventListener('click', (e) => {
    e.preventDefault();
    opener = null;
    closePanel();
    const c = $('#contact');
    c.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), reduced ? 0 : 900);
  });
  $$('[data-open]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openPanel(+b.dataset.open, b); }));

  if (!world) { labels.forEach((l) => l.remove()); return; }

  // ---------- scroll → world state ----------
  let anchors = [];
  function measure() {
    const vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
    anchors = sections.map((s, i) => {
      if (i === 0) return 0;
      if (i === sections.length - 1) return max;
      return Math.min(max, Math.max(0, s.offsetTop - (vh - s.offsetHeight) / 2));
    });
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
  }
  function progress() {
    const y = window.scrollY;
    if (y <= anchors[0]) return 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
    }
    return anchors.length - 1;
  }
  measure();
  world.setProgress(progress());
  let lastY = window.scrollY, speed = 0;
  window.addEventListener('scroll', () => { world.setProgress(progress()); }, { passive: true });
  window.addEventListener('resize', () => { world.resize(); measure(); world.setProgress(progress()); if (reduced) { world.settle(); world.render(0); } });
  ScrollTrigger.addEventListener('refresh', measure);

  // ---------- pointer → world: hover, click, drag ----------
  const UI = 'a, button, input, textarea, label, select, dialog, .card, .fit__col, .form, .thanks, .steps li, .top';
  let hovered = null;
  const norm = (x, y) => [(x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1];
  const overUI = (t) => t && t.closest && t.closest(UI);
  const DRAG_PX = 6;
  let press = null; // { x, y, moved, kind: 'mouse' | 'touch' }
  let suppressClick = false;

  function pressStart(x, y, kind) {
    if (reduced) return false;
    const [nx, ny] = norm(x, y);
    if (!world.beginDrag(nx, ny)) return false;
    press = { x, y, moved: false, kind };
    return true;
  }
  function pressMove(x, y) {
    if (!press) return;
    if (!press.moved && Math.hypot(x - press.x, y - press.y) > DRAG_PX) { press.moved = true; document.body.classList.add('is-dragging'); }
    if (press.moved) { const [nx, ny] = norm(x, y); sound.tension(world.dragTo(nx, ny)); }
  }
  function pressEnd(x, y) {
    if (!press) return;
    const moved = press.moved; press = null;
    document.body.classList.remove('is-dragging');
    const stretch = world.endDrag();
    if (moved) { sound.release(stretch); suppressClick = true; setTimeout(() => (suppressClick = false), 0); }
    else { sound.tensionOff(); const [nx, ny] = norm(x, y); if (world.click(nx, ny) === 'core') sound.pulse(); suppressClick = true; setTimeout(() => (suppressClick = false), 0); }
  }

  // mouse / pen
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || overUI(e.target) || panel.open) return;
    if (pressStart(e.clientX, e.clientY, 'mouse')) e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (press) { pressMove(e.clientX, e.clientY); return; }
    if (reduced) return;
    const ui = overUI(e.target);
    const [nx, ny] = norm(e.clientX, e.clientY);
    const h = world.hover(nx, ui ? -9 : ny);
    const now = ui ? null : h;
    if (now !== hovered && now !== null) sound.hover();
    hovered = now;
    document.body.classList.toggle('is-hover', now !== null);
  }, { passive: true });
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') pressEnd(e.clientX, e.clientY); });
  window.addEventListener('pointercancel', (e) => { if (e.pointerType !== 'touch' && press) pressEnd(e.clientX, e.clientY); });

  // touch: only claim the gesture (and block scrolling) when it starts on the core
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || overUI(e.target) || panel.open) return;
    const t = e.touches[0];
    if (pressStart(t.clientX, t.clientY, 'touch')) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!press) return;
    e.preventDefault();
    const t = e.touches[0]; pressMove(t.clientX, t.clientY);
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    if (!press) return;
    const t = e.changedTouches[0]; pressEnd(t.clientX, t.clientY);
  });
  window.addEventListener('touchcancel', () => { if (press) pressEnd(press.x, press.y); });

  // click on a platform shape opens its panel
  window.addEventListener('click', (e) => {
    if (suppressClick || overUI(e.target) || panel.open) return;
    const [nx, ny] = norm(e.clientX, e.clientY);
    const h = world.pick(nx, ny);
    if (typeof h === 'number') { if (!reduced) world.click(nx, ny); openPanel(h, null); }
  });
  if (new URLSearchParams(location.search).has('debug')) window.__appc = world; // test hook only
  world.onArrive = () => { if (!document.hidden) sound.chime(0, 0.18); };

  // ---------- loop ----------
  // hide a platform label whenever it would sit on top of the text column
  const cols = sections.map((s) => $('.col', s));
  const textRects = () => cols.map((c) => c.getBoundingClientRect()).filter((r) => r.bottom > 0 && r.top < window.innerHeight);
  function placeLabels() {
    const L = world.labels(), rects = textRects();
    L.forEach((l, i) => {
      const el = labels[i];
      el.style.transform = `translate3d(${l.x}px, ${l.y}px, 0) translate(-50%, -100%)`;
      const covered = rects.some((r) => l.x > r.left - 90 && l.x < r.right + 90 && l.y > r.top - 20 && l.y < r.bottom + 30);
      el.classList.toggle('is-on', l.on && !covered);
      el.classList.toggle('is-drift', l.drift);
    });
  }
  if (reduced) { world.settle(); world.render(0); placeLabels(); return; }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const y = window.scrollY; speed = speed * 0.85 + Math.abs(y - lastY) * 0.15; lastY = y;
    sound.scroll(speed, world.desync);
    world.render(dt);
    placeLabels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
