// Seeded RNG (mulberry32). The battle sim uses ONLY this, never Math.random, so a seed
// replays the same battle (daily challenge, headless balance sims, bug repros).

export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // obj: { key: weight } -> key
  weighted(obj) {
    let total = 0;
    for (const k in obj) total += Math.max(0, obj[k]);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const k in obj) {
      r -= Math.max(0, obj[k]);
      if (r <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
