// Tiny event emitter. `bus` is the app-wide channel (UI, achievements, audio, toasts).
// The battle sim does NOT use this; it queues plain event objects in battle.events.

export class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, []);
    this.map.get(type).push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const a = this.map.get(type);
    if (!a) return;
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  emit(type, data) {
    const a = this.map.get(type);
    if (a) for (const fn of a.slice()) fn(data);
    const any = this.map.get('*');
    if (any) for (const fn of any.slice()) fn(type, data);
  }
}

export const bus = new Emitter();
