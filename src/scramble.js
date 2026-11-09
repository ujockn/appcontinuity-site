// Glitch/scramble text. Keeps accessible text intact: the visible copy is an
// aria-hidden twin, the real text lives in an .sr-only span.
const GLYPHS = '!<>-_\\/[]{}=+*^?#01ΔΣ░▒';

export function prepare(el) {
  if (el.dataset.scrReady) return;
  el.dataset.scrReady = '1';
  const html = el.innerHTML;
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.innerHTML = html;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  vis.className = 'scr-vis';
  vis.innerHTML = html;
  el.innerHTML = '';
  el.append(sr, vis);
  // collect text nodes of visible twin
  const nodes = [];
  const walk = document.createTreeWalker(vis, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) nodes.push({ node: walk.currentNode, text: walk.currentNode.nodeValue });
  el._scr = { nodes, raf: 0 };
}

export function scramble(el, { duration = 700, stagger = 0.6 } = {}) {
  prepare(el);
  const st = el._scr;
  cancelAnimationFrame(st.raf);
  const total = st.nodes.reduce((n, x) => n + x.text.length, 0);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    let idx = 0;
    for (const n of st.nodes) {
      let out = '';
      for (let i = 0; i < n.text.length; i++, idx++) {
        const ch = n.text[i];
        const at = (1 - stagger) + stagger * (idx / Math.max(1, total));
        if (ch === ' ' || ch === '\n' || t >= at) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      n.node.nodeValue = out;
    }
    if (t < 1) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}
