// All sound is synthesized with the Web Audio API. Off by default.
export class Sound {
  constructor() { this.enabled = false; this.ctx = null; this.lastHover = 0; }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // simple feedback-delay "space"
    this.fx = ctx.createGain(); this.fx.gain.value = 0.35;
    const d = ctx.createDelay(1); d.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.fx.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);

    // ambient drone: detuned chord through a slowly breathing low-pass
    const pad = ctx.createGain(); pad.gain.value = 0.05;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(f.frequency); lfo.start();
    [[110, 'sine', 0], [164.81, 'triangle', 4], [220.5, 'sine', -5], [329.6, 'sine', 7]].forEach(([hz, type, det]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = det;
      o.connect(f); o.start();
    });
    f.connect(pad).connect(this.master);
    this.padFilter = f;

    // wind/whoosh: looped noise through a band-pass, gain follows scroll speed
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 700; this.windF.Q.value = 0.9;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    n.connect(this.windF).connect(this.windG).connect(this.master); n.start();
    return true;
  }

  async setEnabled(on) {
    if (on && !this.ctx && !this._init()) return false;
    this.enabled = on;
    if (!this.ctx) return on;
    if (on && this.ctx.state === 'suspended') await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.25);
    return on;
  }

  _env(node, peak, a, r) {
    const t = this.ctx.currentTime, g = node.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + a); g.exponentialRampToValueAtTime(0.0001, t + a + r);
  }

  hover() {
    if (!this.enabled) return;
    const now = performance.now(); if (now - this.lastHover < 70) return; this.lastHover = now;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(2100, t + 0.05);
    const g = ctx.createGain(); this._env(g, 0.035, 0.004, 0.07);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.1);
  }

  // FM bell; degree selects a note from a pentatonic set
  chime(degree = 0, strength = 1) {
    if (!this.enabled) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const fc = scale[((degree % scale.length) + scale.length) % scale.length];
    const ctx = this.ctx, t = ctx.currentTime;
    const car = ctx.createOscillator(); car.frequency.value = fc;
    const mod = ctx.createOscillator(); mod.frequency.value = fc * 3.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(fc * 2 * strength, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain(); this._env(g, 0.12 * strength, 0.005, 1.6);
    car.connect(g); g.connect(this.master); g.connect(this.fx);
    car.start(t); mod.start(t); car.stop(t + 1.8); mod.stop(t + 1.8);
  }

  // low thump + shimmer for the core
  pulse() {
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.5);
    const g = ctx.createGain(); this._env(g, 0.35, 0.006, 0.6);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.7);
    [0, 2, 4].forEach((d, i) => setTimeout(() => this.chime(d + 1, 0.55), i * 70));
  }

  // continuous tension tone while the core is stretched
  tension(amount) {
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.tOsc) {
      this.tOsc = ctx.createOscillator(); this.tOsc.type = 'triangle';
      this.tGain = ctx.createGain(); this.tGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      this.tOsc.connect(f).connect(this.tGain).connect(this.master); this.tOsc.start();
    }
    this.tOsc.frequency.setTargetAtTime(150 + amount * 260, t, 0.05);
    this.tGain.gain.setTargetAtTime(0.012 + amount * 0.05, t, 0.05);
  }
  tensionOff() { if (this.tGain) this.tGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04); }

  // elastic release: a wobbling pitch sweep plus a bright chord
  release(stretch = 0.5) {
    this.tensionOff();
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const base = 260 + stretch * 200;
    o.frequency.setValueAtTime(base * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.6);
    const vib = ctx.createOscillator(); vib.frequency.value = 11;
    const vg = ctx.createGain(); vg.gain.setValueAtTime(base * 0.12, t); vg.gain.exponentialRampToValueAtTime(0.5, t + 0.8);
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain(); this._env(g, 0.12 + stretch * 0.1, 0.01, 0.8);
    o.connect(g); g.connect(this.master); g.connect(this.fx);
    o.start(t); vib.start(t); o.stop(t + 1); vib.stop(t + 1);
    [1, 3, 5].forEach((d, i) => setTimeout(() => this.chime(d, 0.35 + stretch * 0.3), 60 + i * 55));
  }

  glitch() {
    if (!this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 90 + Math.random() * 60;
    const g = ctx.createGain(); this._env(g, 0.02, 0.002, 0.08);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.1);
  }

  scroll(speed, drift) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(Math.min(0.12, speed * 0.004), t, 0.12);
    this.windF.frequency.setTargetAtTime(500 + Math.min(1600, speed * 30), t, 0.2);
    // drifting state darkens the pad
    this.padFilter.Q.setTargetAtTime(0.8 + drift * 6, t, 0.4);
  }
}
