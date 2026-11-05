// Fixed-step game loop. update(step) runs at 60 Hz scaled by timeScale (1x/2x/3x, slow-mo);
// render(frameDt, alpha) runs once per animation frame.

export class Loop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.step = 1 / 60;
    this.acc = 0;
    this.last = 0;
    this.timeScale = 1;
    this.paused = false;
    this.running = false;
    this.frame = this.frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; }
  frame(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    if (!this.paused) {
      this.acc += dt * this.timeScale;
      let n = 0;
      while (this.acc >= this.step && n < 10) {
        this.update(this.step);
        this.acc -= this.step;
        n++;
      }
      if (n >= 10) this.acc = 0;
    }
    this.render(dt, this.acc / this.step);
    requestAnimationFrame(this.frame);
  }
}
