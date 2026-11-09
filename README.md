# appcontinuity.com

Marketing site for AppContinuity. Vite + vanilla JS + Three.js + GSAP ScrollTrigger.

Deploys to [appcontinuity.com](https://appcontinuity.com) via GitHub Pages.

- `npm install`
- `npm run dev`: local dev server
- `npm run build`: production build to `dist/` (static files, no server needed)
- `npm run preview`: serve `dist/` on http://localhost:4173

## Structure
- `index.html`: all copy as real HTML (SEO, screen readers); meta + Open Graph
- `src/scene.js`: procedural WebGL world (core entitlement, three platform forms, links, tokens)
- `src/audio.js`: Web Audio synth sounds (off by default)
- `src/scramble.js`: glitch text effect (accessible twin text)
- `src/main.js`: loader, scroll → scene state, reveals, sound toggle, form
- `tools/`: screenshot / icon / OG image scripts (Playwright + system Chrome)

## Before going live
- Form: set `FORM_ENDPOINT` in `src/main.js` to a form backend; empty = thank-you state only (nothing is sent).
