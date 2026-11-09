import * as THREE from 'three';

// Ashima/stegu 3D simplex noise (MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const BG = 0x05070d;
const ACCENT = new THREE.Color('#7cf2d0');
const ACCENT2 = new THREE.Color('#9d8cff');
const DRIFT = [new THREE.Color('#ffb35c'), new THREE.Color('#ff6a5c'), new THREE.Color('#d06bff')];

// Scroll keyframes: one per <section data-sec>. orbit ends at 2π so the
// last view lines up with the first one: the page loops back to its start.
const KEYS = [
  { cam: [0, 1.0, 14.5], look: [0, 0, 0], desync: 0, orbit: 0, tilt: 0, shift: 0 },
  { cam: [-1.2, 3.0, 11.8], look: [0, -0.2, 0], desync: 1, orbit: -0.6, tilt: 0.08, shift: 0.02 },
  { cam: [0.6, 1.2, 14.5], look: [0, 0.1, 0], desync: 0, orbit: 1.5, tilt: -0.04, shift: 0.05 },
  { cam: [2.4, 4.6, 12.2], look: [0, -0.4, 0], desync: 0, orbit: 2.4, tilt: 0, shift: 0.02 },
  { cam: [0, -0.2, 13.5], look: [0, 0.3, 0], desync: 0, orbit: 4.3, tilt: 0.05, shift: 0.04 },
  { cam: [0, 1.0, 14.5], look: [0, 0, 0], desync: 0, orbit: Math.PI * 2, tilt: 0, shift: 0.02 },
];

const tick = () => new Promise((r) => setTimeout(r, 0));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function fresnelMat(color, { opacity = 1, power = 2.2, base = 0.08, additive = false, displace = 0, double = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uPower: { value: power },
      uBase: { value: base }, uOpacity: { value: opacity }, uAmp: { value: displace }, uBoost: { value: 0 },
    },
    vertexShader: `${NOISE}
      uniform float uTime; uniform float uAmp;
      varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        vec3 p = position; float d = 0.0;
        if (uAmp > 0.0) { d = snoise(p * 1.3 + vec3(uTime * 0.25)); p += normal * d * uAmp; }
        vD = d;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPower; uniform float uBase; uniform float uOpacity; uniform float uBoost;
      varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        vec3 c = uColor * (uBase + f * 1.3 + uBoost) + vec3(1.0) * pow(f, 6.0) * 0.5 + uColor * vD * 0.18;
        gl_FragColor = vec4(c, clamp((uBase + f) * uOpacity + uBoost * 0.35, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: double ? THREE.DoubleSide : THREE.FrontSide,
  });
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export async function createWorld(canvas, { mobile = false, onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setClearColor(BG, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.045);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const world = new THREE.Group(); scene.add(world);
  const orbit = new THREE.Group(); world.add(orbit);
  const glowTex = glowTexture();
  const anim = []; // materials needing uTime
  onProgress(0.1); await tick();

  // ---------- core: the entitlement ----------
  const core = new THREE.Group(); orbit.add(core);
  const coreMat = fresnelMat(ACCENT, { displace: 0.12, power: 1.7, base: 0.14, opacity: 0.95 });
  anim.push(coreMat);
  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, mobile ? 4 : 6), coreMat);
  core.add(coreMesh);
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 3), new THREE.MeshBasicMaterial({ color: '#f4fffc', fog: false }));
  core.add(heart);
  const heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  heartGlow.scale.setScalar(1.5); core.add(heartGlow);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ACCENT, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreGlow.scale.setScalar(5.2); core.add(coreGlow);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * 0.22, 0.006, 6, 160),
      new THREE.MeshBasicMaterial({ color: i === 1 ? ACCENT2 : ACCENT, transparent: true, opacity: 0.45 - i * 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.7, 0);
    rings.push(m); core.add(m);
  }
  {
    const n = 120, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pos.set([Math.cos(a) * 2.05, 0, Math.sin(a) * 2.05], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dots = new THREE.Points(g, new THREE.PointsMaterial({ color: ACCENT, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false }));
    dots.rotation.x = 0.35; rings.push(dots); core.add(dots);
  }
  const coreHit = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  coreHit.userData.hit = 'core'; core.add(coreHit);
  onProgress(0.3); await tick();

  // ---------- platforms: web, iPhone, Android (abstract) ----------
  const R = 3.5;
  const ANG = [-1.18, 1.18, Math.PI];
  const YS = [0.45, -0.15, 0.85];
  const platforms = [];
  const edgeMat = (c, o = 0.9) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

  function slab(w, h, r, depth) {
    const geo = new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }
  function blocks(cols, rows, bw, bh, gx, gy, mat) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(bw, bh, 0.03), mat, cols * rows);
    inst.userData.grid = { cols, rows, bw, bh, gx, gy };
    return inst;
  }

  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const base = new THREE.Vector3(Math.sin(ANG[i]) * R, YS[i], Math.cos(ANG[i]) * R);
    g.position.copy(base);
    const inner = new THREE.Group(); g.add(inner);
    const mats = [];
    let hitSize, blockMesh = null, labelY;

    if (i === 0) { // web: wide floating panel with content blocks
      const m = fresnelMat(ACCENT, { power: 1.4, base: 0.05, opacity: 0.55 }); mats.push(m);
      const geo = slab(2.3, 1.45, 0.12, 0.05);
      inner.add(new THREE.Mesh(geo, m));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat(ACCENT, 0.7)); inner.add(e); mats.push(e.material);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.008), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 }));
      bar.position.set(0, 0.5, 0.06); inner.add(bar); mats.push(bar.material);
      const bm = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 }); mats.push(bm);
      blockMesh = blocks(5, 3, 0.32, 0.2, 0.39, 0.27, bm); blockMesh.position.set(0, -0.12, 0.06); inner.add(blockMesh);
      hitSize = [2.5, 1.6, 0.6]; labelY = 1.05;
    } else if (i === 1) { // iPhone: tall glass slab
      const m = fresnelMat(ACCENT, { power: 1.3, base: 0.06, opacity: 0.6 }); mats.push(m);
      const geo = slab(0.95, 1.95, 0.2, 0.1);
      inner.add(new THREE.Mesh(geo, m));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat(ACCENT, 0.7)); inner.add(e); mats.push(e.material);
      const bm = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 }); mats.push(bm);
      blockMesh = blocks(2, 4, 0.3, 0.3, 0.38, 0.38, bm); blockMesh.position.set(0, -0.05, 0.09); inner.add(blockMesh);
      hitSize = [1.2, 2.2, 0.6]; labelY = 1.3;
    } else { // Android: capsule lattice with orbiting bands
      const cap = new THREE.CapsuleGeometry(0.52, 1.0, mobile ? 5 : 8, mobile ? 14 : 22);
      const pm = new THREE.PointsMaterial({ color: ACCENT, size: 0.04, transparent: true, opacity: 0.9, map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false });
      mats.push(pm); inner.add(new THREE.Points(cap, pm));
      const m = fresnelMat(ACCENT, { power: 2, base: 0.03, opacity: 0.5, additive: true }); mats.push(m);
      inner.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 6, 18), m));
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.007, 6, 120), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        t.position.y = (k - 1) * 0.5; t.rotation.x = Math.PI / 2; t.userData.band = k; inner.add(t); mats.push(t.material);
      }
      hitSize = [1.4, 2.2, 1.4]; labelY = 1.35;
    }
    // receiver ring
    const recv = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 100), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    recv.rotation.x = Math.PI / 2; recv.position.y = -1.3; g.add(recv); mats.push(recv.material);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ACCENT, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(3.4); g.add(glow); mats.push(glow.material);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...hitSize), coreHit.material); hit.userData.hit = i; g.add(hit);
    orbit.add(g);
    platforms.push({ g, inner, base, mats, blockMesh, recv, glow, hit, labelY, pulse: 0, spin: 0, spinT: 0, hover: 0, glitch: 0, color: ACCENT.clone() });
  }
  const dummy = new THREE.Object3D();
  onProgress(0.5); await tick();

  // ---------- links + tokens ----------
  const dragOffset = new THREE.Vector3(); // core displacement (orbit-local), shared by all tethers
  const links = platforms.map((p, i) => {
    const end = p.base.clone().add(new THREE.Vector3(0, -1.3, 0));
    const mid = end.clone().multiplyScalar(0.5); mid.y += 1.6;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, end);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: ACCENT.clone() }, uOpacity: { value: 1 }, uPhase: { value: i * 0.37 }, uOffset: { value: dragOffset }, uStretch: { value: 0 } },
      vertexShader: `uniform vec3 uOffset; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position + uOffset * pow(1.0 - uv.x, 1.6); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uPhase; uniform float uStretch; varying vec2 vUv;
        void main(){ float d = fract(vUv.x * 6.0 - uTime * 0.7 + uPhase); float g = smoothstep(0.0, 0.08, d) * smoothstep(0.45, 0.08, d);
          float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          gl_FragColor = vec4(uColor, (0.16 + g * 0.75 + uStretch * 0.35) * uOpacity * edge); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.013, 5), mat);
    tube.frustumCulled = false; // vertices move in the shader while dragging
    orbit.add(tube);
    const token = new THREE.Group();
    token.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
    const tg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ACCENT, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    tg.scale.setScalar(0.8); token.add(tg);
    orbit.add(token);
    return { curve, mat, tube, token, tg, last: 0 };
  });
  onProgress(0.65); await tick();

  // ---------- dust + floor ----------
  {
    const n = mobile ? 600 : 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 6 + Math.random() * 22, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#a9b8ff', size: 0.09, map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(dust);
  }
  const floor = new THREE.Group(); floor.position.y = -2.6; orbit.add(floor);
  for (let k = 0; k < 7; k++) {
    const r = 1.6 + k * 1.25, n = 160, pts = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: k % 2 ? ACCENT2 : ACCENT, transparent: true, opacity: 0.22 - k * 0.025, depthWrite: false }));
    floor.add(l);
  }
  {
    const n = 72, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pos.set([Math.cos(a) * 5.35, 0, Math.sin(a) * 5.35], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    floor.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ACCENT, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false })));
  }

  // ---------- shockwaves ----------
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.RingGeometry(0.992, 1, 160), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    w.visible = false; w.userData.t = 1; scene.add(w); waves.push(w);
  }
  function wave(at, color = ACCENT, size = 7) {
    const w = waves.find((x) => x.userData.t >= 1) || waves[0];
    w.position.copy(at); w.userData.t = 0; w.userData.size = size; w.material.color.copy(color); w.visible = true;
  }
  onProgress(0.8); await tick();

  // ---------- state ----------
  const S = { cam: new THREE.Vector3(...KEYS[0].cam), look: new THREE.Vector3(), desync: 0, orbit: 0, tilt: 0, shift: 0 };
  const T = { ...S, cam: S.cam.clone(), look: S.look.clone() };
  const pointer = new THREE.Vector2(0, 0), pointerS = new THREE.Vector2(0, 0);
  const layout = { x: 0, y: 0, dist: 1 };
  let coreBoost = 0, coreHover = 0, hovered = null;

  // ---------- drag + spring ----------
  const drag = { active: false, vel: new THREE.Vector3(), target: new THREE.Vector3(), grab: new THREE.Vector3(), plane: new THREE.Plane(), stretch: 0 };
  const DRAG_MAX = 2.6;

  // ---------- particle burst ----------
  const BURST_N = mobile ? 48 : 96;
  const bPos = new Float32Array(BURST_N * 3), bVel = new Float32Array(BURST_N * 3);
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bMat = new THREE.PointsMaterial({ color: ACCENT, size: 0.16, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const burstPts = new THREE.Points(bGeo, bMat); burstPts.frustumCulled = false; burstPts.visible = false; scene.add(burstPts);
  let burstT = 1;
  function burst(at, power = 1) {
    for (let i = 0; i < BURST_N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar((1.5 + Math.random() * 3.5) * power);
      bPos.set([at.x, at.y, at.z], i * 3); bVel.set([v.x, v.y, v.z], i * 3);
    }
    bGeo.attributes.position.needsUpdate = true; burstT = 0; burstPts.visible = true;
  }

  // ---------- platform focus (camera fly-in) ----------
  let focusIdx = null, lastFocus = 0, focusAmt = 0, drift = 0;
  const focusCam = new THREE.Vector3(), focusLook = new THREE.Vector3(), camBase = new THREE.Vector3(), lookBase = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const hitTargets = [coreHit, ...platforms.map((p) => p.hit)];
  const tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
  let onArrive = () => {};

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const a = camera.aspect;
    // layout.x / layout.y: fraction of the viewport the scene centre is pushed
    // (right on wide screens to clear the text column, up on tall screens)
    if (a >= 1.15) { layout.x = Math.min(0.2, 0.09 + (a - 1.15) * 0.22); layout.y = 0; layout.dist = 1; camera.fov = 40; }
    else { layout.x = 0; layout.y = 0.24; layout.dist = a < 0.7 ? 1.3 : 1.15; camera.fov = 60; }
    applyView();
  }
  resize();

  function setProgress(f) {
    f = Math.max(0, Math.min(KEYS.length - 1, f));
    const i = Math.min(KEYS.length - 2, Math.floor(f));
    const t = smooth(f - i), a = KEYS[i], b = KEYS[i + 1];
    T.cam.set(lerp(a.cam[0], b.cam[0], t), lerp(a.cam[1], b.cam[1], t), lerp(a.cam[2], b.cam[2], t));
    T.look.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    T.desync = lerp(a.desync, b.desync, t);
    T.orbit = lerp(a.orbit, b.orbit, t);
    T.tilt = lerp(a.tilt, b.tilt, t);
    T.shift = lerp(a.shift, b.shift, t);
  }
  function applyView() {
    const w = window.innerWidth, h = window.innerHeight;
    const ox = layout.x > 0 ? layout.x + S.shift : 0;
    camera.setViewOffset(w, h, -w * ox, h * layout.y, w, h);
  }

  function pulsePlatform(i, strength = 1) { platforms[i].pulse = Math.max(platforms[i].pulse, strength); }

  function pick(nx, ny) {
    ray.setFromCamera({ x: nx, y: ny }, camera);
    const hit = ray.intersectObjects(hitTargets, false)[0];
    return hit ? hit.object.userData.hit : null;
  }
  function hover(nx, ny) {
    pointer.set(nx, ny);
    hovered = pick(nx, ny);
    return hovered;
  }
  function click(nx, ny) {
    const h = pick(nx, ny);
    if (h === 'core') {
      coreBoost = 1;
      core.getWorldPosition(tmpV); wave(tmpV.clone(), ACCENT, 8);
      platforms.forEach((p, i) => setTimeout(() => pulsePlatform(i, 1), 250 + i * 120));
    } else if (typeof h === 'number') {
      const p = platforms[h]; p.spinT += Math.PI * 2; pulsePlatform(h, 1);
      p.g.getWorldPosition(tmpV); wave(tmpV.clone(), ACCENT2, 4);
    }
    return h;
  }

  function rayAt(nx, ny) { ray.setFromCamera({ x: nx, y: ny }, camera); return ray.ray; }
  function beginDrag(nx, ny) {
    if (pick(nx, ny) !== 'core') return false;
    const n = camera.getWorldDirection(new THREE.Vector3()).negate();
    const corePos = core.getWorldPosition(new THREE.Vector3());
    drag.plane.setFromNormalAndCoplanarPoint(n, corePos);
    const hit = rayAt(nx, ny).intersectPlane(drag.plane, new THREE.Vector3());
    drag.grab.copy(hit ? hit.sub(corePos) : new THREE.Vector3());
    drag.target.copy(dragOffset); drag.vel.set(0, 0, 0); drag.active = true;
    return true;
  }
  function dragTo(nx, ny) {
    if (!drag.active) return 0;
    const hit = rayAt(nx, ny).intersectPlane(drag.plane, new THREE.Vector3());
    if (!hit) return drag.stretch;
    hit.sub(drag.grab);
    orbit.updateMatrixWorld();
    const local = orbit.worldToLocal(hit);
    const len = local.length();
    if (len > 1e-4) local.multiplyScalar((DRAG_MAX * Math.tanh(len / DRAG_MAX)) / len); // rubber-band limit
    drag.target.copy(local);
    return drag.stretch;
  }
  function endDrag() {
    if (!drag.active) return 0;
    drag.active = false;
    const s = drag.stretch;
    const at = core.getWorldPosition(new THREE.Vector3());
    burst(at, 0.6 + s * 0.8);
    coreBoost = Math.max(coreBoost, 0.4 + s * 0.6);
    return s;
  }
  function focus(i) {
    if (i !== null && i !== undefined) { focusIdx = i; lastFocus = i; pulsePlatform(i, 1); }
    else focusIdx = null;
  }

  let time = 0, frames = 0, acc = 0;
  function update(dt) {
    time += dt;
    const k = 1 - Math.pow(0.0025, dt); // frame-rate independent smoothing
    S.cam.lerp(T.cam, k); S.look.lerp(T.look, k);
    S.desync = lerp(S.desync, T.desync, k); S.orbit = lerp(S.orbit, T.orbit, k); S.tilt = lerp(S.tilt, T.tilt, k); S.shift = lerp(S.shift, T.shift, k);
    applyView();
    pointerS.lerp(pointer, 1 - Math.pow(0.02, dt));

    // focus blend (0 = scroll camera, 1 = close-up on a platform)
    focusAmt = lerp(focusAmt, focusIdx !== null ? 1 : 0, 1 - Math.pow(0.04, dt));
    const F = smooth(Math.min(1, focusAmt));
    const D = S.desync * (1 - F); // a focused platform is always in sync
    drift += dt * 0.03 * (1 - F);
    orbit.rotation.y = S.orbit + drift;
    orbit.rotation.x = S.tilt * (1 - F);
    const par = drag.active ? 0.25 : 1 - F;
    camBase.copy(S.cam).multiplyScalar(layout.dist);
    camBase.x += pointerS.x * 0.6 * par; camBase.y += pointerS.y * 0.35 * par;
    lookBase.copy(S.look);
    if (F > 0.001) {
      const fp = platforms[lastFocus];
      orbit.updateMatrixWorld();
      const P = fp.g.getWorldPosition(new THREE.Vector3());
      const out = new THREE.Vector3(P.x, 0, P.z).normalize();
      const side = new THREE.Vector3(-out.z, 0, out.x);
      const narrow = camera.aspect < 1;
      const dist = (narrow ? 7.4 : 5.2) + (lastFocus === 0 ? (narrow ? 1.8 : 0.9) : 0);
      // view from an angle so the core sits beside the platform rather than behind it
      const th = narrow ? -0.55 : -0.8;
      const dir = out.clone().multiplyScalar(Math.cos(th)).addScaledVector(side, Math.sin(th));
      focusCam.copy(P).addScaledVector(dir, dist);
      focusCam.y += 0.9;
      focusLook.copy(P).lerp(new THREE.Vector3(0, P.y, 0), 0.38);
      camBase.lerp(focusCam, F); lookBase.lerp(focusLook, F);
    }
    camera.position.copy(camBase);
    camera.lookAt(lookBase);

    // drag: follow the pointer while held, damped spring back when released
    if (drag.active) {
      const prev = dragOffset.clone();
      dragOffset.lerp(drag.target, 1 - Math.pow(0.0005, dt));
      drag.vel.copy(dragOffset).sub(prev).divideScalar(Math.max(dt, 1e-3));
    } else {
      const K = 140, C = 7; // underdamped: a few elastic wobbles
      drag.vel.addScaledVector(dragOffset, -K * dt).multiplyScalar(Math.max(0, 1 - C * dt));
      dragOffset.addScaledVector(drag.vel, dt);
      if (dragOffset.lengthSq() < 1e-6 && drag.vel.lengthSq() < 1e-5) { dragOffset.set(0, 0, 0); drag.vel.set(0, 0, 0); }
    }
    drag.stretch = Math.min(1, dragOffset.length() / DRAG_MAX);
    core.position.copy(dragOffset);
    const breathe = 0.5 + 0.5 * Math.sin(time * 1.6);

    // core
    coreBoost *= Math.pow(0.12, dt);
    coreHover = lerp(coreHover, hovered === 'core' ? 1 : 0, 1 - Math.pow(0.001, dt));
    coreMat.uniforms.uAmp.value = 0.1 + D * 0.2 + coreBoost * 0.22 + drag.stretch * 0.18;
    coreMat.uniforms.uBoost.value = coreBoost * 0.9 + coreHover * 0.25;
    tmpC.copy(ACCENT).lerp(DRIFT[0], D * 0.3); coreMat.uniforms.uColor.value.copy(tmpC);
    const flicker = D > 0.3 ? (Math.random() < 0.08 * D ? 0.4 : 1) : 1;
    coreGlow.material.opacity = (0.55 + Math.sin(time * 1.6) * (0.06 + F * 0.14) + coreBoost * 0.4 + drag.stretch * 0.25) * flicker;
    coreGlow.material.color.copy(tmpC);
    const cs = 1 + coreBoost * 0.18 + coreHover * 0.06 + Math.sin(time * 1.6) * (0.015 + F * 0.03) - drag.stretch * 0.08;
    core.scale.setScalar(cs);
    coreMesh.rotation.y += dt * 0.15; heart.rotation.x += dt * 0.4;
    rings.forEach((r, i) => { r.rotation.z += dt * (0.12 + i * 0.05) * (i % 2 ? -1 : 1) * (1 + D * 2); });
    for (const m of anim) m.uniforms.uTime.value = time;

    // sync clock: in sync all tokens share one phase and land together
    const syncT = (time * 0.3) % 1;
    const speeds = [0.19, 0.41, 0.27];
    links.forEach((L, i) => {
      L.mat.uniforms.uTime.value = time * (1 + D * (i - 1) * 0.6);
      const flick = D > 0.2 && Math.random() < 0.12 * D ? 0.15 : 1;
      L.mat.uniforms.uOpacity.value = lerp(1, 0.35, D) * flick;
      L.mat.uniforms.uColor.value.copy(ACCENT).lerp(DRIFT[i], D);
      const driftT = ((time * speeds[i] + i * 0.31) % 1) * 0.72;
      const tt = lerp(syncT, driftT, D);
      L.curve.getPoint(Math.min(0.999, tt), L.token.position);
      L.token.position.addScaledVector(dragOffset, Math.pow(1 - Math.min(0.999, tt), 1.6));
      L.mat.uniforms.uStretch.value = drag.stretch;
      if (D > 0.3) L.token.position.x += (Math.random() - 0.5) * 0.06 * D;
      L.tg.material.color.copy(ACCENT).lerp(DRIFT[i], D);
      const fade = D > 0.5 ? smooth(Math.min(1, (0.72 - driftT) * 4)) : 1;
      L.token.scale.setScalar(lerp(1, fade, D));
      // arrival
      if (D < 0.4 && L.last > 0.9 && syncT < 0.1) { pulsePlatform(i, 0.7); if (i === 0) onArrive(); }
      L.last = syncT;
    });

    // platforms
    platforms.forEach((p, i) => {
      p.pulse *= Math.pow(0.08, dt);
      p.hover = lerp(p.hover, hovered === i ? 1 : 0, 1 - Math.pow(0.001, dt));
      p.spin = lerp(p.spin, p.spinT, 1 - Math.pow(0.02, dt));
      // drift: platforms pull away from the shared core and fall out of phase
      const spread = 1 + D * 0.28;
      p.g.position.set(p.base.x * spread, p.base.y + Math.sin(time * (0.9 + i * 0.35) + i) * (0.08 + D * 0.3), p.base.z * spread);
      if (D > 0.45 && p.glitch <= 0 && Math.random() < 0.012 * D) p.glitch = 0.09 + Math.random() * 0.1;
      p.glitch -= dt;
      if (p.glitch > 0) p.g.position.x += (Math.random() - 0.5) * 0.4;
      p.g.position.addScaledVector(dragOffset, 0.07); // pulled slightly toward a dragged core
      // face the camera around Y (compensating the parent orbit rotation)
      p.g.rotation.set(0, Math.atan2(camera.position.x - worldX(p), camera.position.z - worldZ(p)) - orbit.rotation.y, 0);
      p.inner.rotation.y = Math.sin(time * 0.5 + i * 2) * 0.35 + p.spin + D * Math.sin(time * 2.3 + i) * 0.6;
      p.inner.rotation.z = D * Math.sin(time * 1.7 + i * 3) * 0.18;
      p.inner.rotation.x = 0;
      if (drag.stretch > 0.001) {
        // lean toward the core, expressed in the platform's own (camera-facing) frame
        const ry = p.g.rotation.y, vx = dragOffset.x - p.g.position.x, vy = dragOffset.y - p.g.position.y, vz = dragOffset.z - p.g.position.z;
        const lx = Math.cos(ry) * vx - Math.sin(ry) * vz, ll = Math.hypot(lx, vy, vz) || 1;
        const lean = 0.5 * drag.stretch;
        p.inner.rotation.z += (-lx / ll) * lean;
        p.inner.rotation.x += (-vy / ll) * lean * 0.6;
      }
      const sync = focusIdx === i ? F * (0.35 + 0.65 * breathe) : 0; // breathes with the core
      const s = 1 + p.pulse * 0.08 + p.hover * 0.06 + sync * 0.05;
      p.inner.scale.setScalar(s);
      p.color.copy(ACCENT).lerp(DRIFT[i], D);
      for (const m of p.mats) {
        if (m.uniforms) { m.uniforms.uColor.value.copy(p.color); m.uniforms.uBoost.value = p.pulse * 0.6 + p.hover * 0.2 + sync * 0.7; }
        else m.color.copy(p.color);
      }
      p.recv.material.opacity = 0.2 + p.pulse * 0.8 + sync * 0.6;
      p.recv.scale.setScalar(1 + p.pulse * 0.5);
      p.glow.material.opacity = 0.14 + p.pulse * 0.35 + p.hover * 0.12 + sync * 0.4;
      if (p.blockMesh) {
        const { cols, rows, gx, gy } = p.blockMesh.userData.grid; let n = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const ph = time * 1.4 - (c + r) * 0.35;
          const fill = lerp(1, 0.35 + 0.65 * (Math.sin(ph * 2.7 + n) > 0.2 ? 1 : 0), D);
          dummy.position.set((c - (cols - 1) / 2) * gx, ((rows - 1) / 2 - r) * gy, Math.max(0, Math.sin(ph)) * 0.04 + p.pulse * 0.06);
          dummy.scale.set(fill, fill, 1); dummy.updateMatrix(); p.blockMesh.setMatrixAt(n++, dummy.matrix);
        }
        p.blockMesh.instanceMatrix.needsUpdate = true;
      } else {
        p.inner.children.forEach((c) => { if (c.userData.band !== undefined) { c.position.y = (c.userData.band - 1) * 0.5 + Math.sin(time * 1.2 + c.userData.band) * 0.08; c.rotation.z = time * (0.3 + c.userData.band * 0.2); } });
      }
    });

    // waves
    for (const w of waves) {
      if (w.userData.t >= 1) { w.visible = false; continue; }
      w.userData.t = Math.min(1, w.userData.t + dt / 1.4);
      const e = 1 - Math.pow(1 - w.userData.t, 3);
      w.scale.setScalar(0.4 + e * w.userData.size);
      w.material.opacity = (1 - w.userData.t) * 0.7;
      w.quaternion.copy(camera.quaternion);
    }
    if (burstT < 1) {
      burstT = Math.min(1, burstT + dt / 1.1);
      const damp = Math.pow(0.08, dt);
      for (let i = 0; i < BURST_N * 3; i++) { bPos[i] += bVel[i] * dt; bVel[i] *= damp; }
      bGeo.attributes.position.needsUpdate = true;
      bMat.opacity = (1 - burstT) * 0.95; bMat.size = 0.16 * (1 - burstT * 0.6);
      if (burstT >= 1) burstPts.visible = false;
    }
    dust.rotation.y = time * 0.008; dust.rotation.x = Math.sin(time * 0.05) * 0.05;
    floor.rotation.y = -time * 0.02;
  }
  function worldX(p) { return Math.cos(orbit.rotation.y) * p.g.position.x + Math.sin(orbit.rotation.y) * p.g.position.z; }
  function worldZ(p) { return -Math.sin(orbit.rotation.y) * p.g.position.x + Math.cos(orbit.rotation.y) * p.g.position.z; }

  function render(dt = 1 / 60) {
    update(Math.min(dt, 0.05));
    renderer.render(scene, camera);
    // adaptive resolution: drop pixel ratio if frames are slow
    acc += dt; frames++;
    if (frames >= 90) {
      const avg = acc / frames; frames = 0; acc = 0;
      if (avg > 0.024 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
    }
  }

  function labels() {
    const w = window.innerWidth, h = window.innerHeight;
    return platforms.map((p) => {
      p.g.getWorldPosition(tmpV); tmpV.y += p.labelY * p.inner.scale.y;
      const zc = tmpV.clone().project(camera);
      return { x: (zc.x * 0.5 + 0.5) * w, y: (-zc.y * 0.5 + 0.5) * h, on: focusAmt < 0.05 && zc.z < 1 && Math.abs(zc.x) < 1.05 && Math.abs(zc.y) < 1.05, drift: S.desync > 0.5 };
    });
  }

  // jump state to targets (used for first frame / reduced motion)
  function settle() { S.cam.copy(T.cam); S.look.copy(T.look); S.desync = T.desync; S.orbit = T.orbit; S.tilt = T.tilt; S.shift = T.shift; }

  renderer.compile(scene, camera);
  onProgress(0.95); await tick();
  setProgress(0); settle(); render(1 / 60);
  onProgress(1);

  return {
    render, resize, setProgress, settle, hover, click, labels, pick, beginDrag, dragTo, endDrag, focus,
    get dragging() { return drag.active; },
    coreScreen() { const v = core.getWorldPosition(new THREE.Vector3()).project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; },
    platformScreen(i) { const v = platforms[i].g.getWorldPosition(new THREE.Vector3()).project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; },
    get stretch() { return drag.stretch; },
    get desync() { return S.desync; },
    set onArrive(fn) { onArrive = fn; },
    dispose() { renderer.dispose(); },
  };
}
