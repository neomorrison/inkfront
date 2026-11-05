import { clamp } from '../core/util.js';

export const VIEW_H = 560; // world units visible top to bottom
export const GROUND_FRAC = 0.72; // ground line height on screen (0 top, 1 bottom)
export const DEPTH = 14; // world px of vertical offset per unit of z

// Side-scrolling camera. Screen coords are CSS pixels.
export class Camera {
  constructor() {
    this.x = 0;
    this.zoom = 1;
    this.w = 1;
    this.h = 1;
    this.viewW = 1;
    this.groundY = 0;
    this.worldW = 3000;
    this.targetX = null;
    this.shake = 0;
    this.shakeT = 0;
    this.ox = 0;
    this.oy = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.zoom = h / VIEW_H;
    this.groundY = Math.round(h * GROUND_FRAC);
    this.viewW = w / this.zoom;
    this.x = this.clampX(this.x);
  }

  setWorld(width) {
    this.worldW = width;
    this.x = this.clampX(this.x);
  }

  clampX(x) {
    const lo = -70, hi = this.worldW + 70 - this.viewW;
    return hi < lo ? (lo + hi) / 2 : clamp(x, lo, hi);
  }

  // Smoothly move so world x `cx` sits at screen fraction `frac`.
  lookAt(cx, frac = 0.5) {
    this.targetX = cx - this.viewW * frac;
  }

  centerOn(cx) {
    this.targetX = null;
    this.x = this.clampX(cx - this.viewW / 2);
  }

  pan(dxWorld) {
    this.targetX = null;
    this.x = this.clampX(this.x + dxWorld);
  }

  // Shake is "trauma": it adds up, decays fast, and is capped so the battle stays readable.
  addShake(a) {
    this.shake = Math.min(16, this.shake + a);
  }

  update(dt, shakeOn = true) {
    if (this.targetX != null) {
      const tx = this.clampX(this.targetX);
      // Critically damped feel: exponential approach, frame-rate independent.
      this.x += (tx - this.x) * (1 - Math.exp(-dt * 6));
      if (Math.abs(tx - this.x) < 0.25) this.x = tx;
    }
    this.x = this.clampX(this.x);
    if (this.shake > 0.05 && shakeOn) {
      this.shakeT += dt;
      // Squared falloff keeps small shakes subtle; smooth sines (not white noise) avoid a blurry jitter.
      const k = Math.min(1, this.shake / 16);
      const amp = Math.min(9, k * k * 14 + this.shake * 0.25);
      const T = this.shakeT;
      this.ox = amp * (Math.sin(T * 61) * 0.6 + Math.sin(T * 37 + 1.3) * 0.4);
      this.oy = amp * 0.6 * (Math.sin(T * 53 + 2.1) * 0.6 + Math.sin(T * 29) * 0.4);
      this.shake *= Math.pow(0.012, dt);
    } else {
      this.shake = 0;
      this.shakeT = 0;
      this.ox = 0;
      this.oy = 0;
    }
  }

  sx(x) { return (x - this.x) * this.zoom + this.ox; }
  sy(y) { return this.groundY + y * this.zoom + this.oy; }
  worldX(screenX) { return screenX / this.zoom + this.x; }
  visible(x, margin = 120) { return x > this.x - margin && x < this.x + this.viewW + margin; }
}
