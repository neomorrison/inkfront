// Keyboard state. `take(code)` consumes a press once, so fixed-step updates that run twice
// in one frame never double-fire a hotkey. Pointer input is handled by the battle session.

export const Input = {
  down: new Set(),
  presses: new Set(),
  enabled: true,
  init() {
    addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.presses.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.presses.clear(); });
  },
  isDown(...codes) {
    if (!this.enabled) return false;
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  },
  take(...codes) {
    if (!this.enabled) return false;
    for (const c of codes) {
      if (this.presses.has(c)) { this.presses.delete(c); return true; }
    }
    return false;
  },
  clearPresses() { this.presses.clear(); },
};
