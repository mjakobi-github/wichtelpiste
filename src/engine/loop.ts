/**
 * Fester Zeitschritt (1/60 s) mit Akkumulator. Höchstens 6 Physik-Ticks pro
 * Frame, damit nach einer Pause (Handy gesperrt, Tab gewechselt) nichts springt.
 * render(alpha) bekommt den Restanteil für die Interpolation.
 */
export class Loop {
  static readonly STEP = 1 / 60;
  static readonly MAX_TICKS = 6;

  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Ein Frame mit vergangener Zeit dtSeconds (auch für Tests). */
  advance(dtSeconds: number): void {
    this.accumulator = Math.min(this.accumulator + dtSeconds, Loop.STEP * Loop.MAX_TICKS);
    let ticks = 0;
    while (this.accumulator >= Loop.STEP && ticks < Loop.MAX_TICKS) {
      this.update(Loop.STEP);
      this.accumulator -= Loop.STEP;
      ticks++;
    }
    this.render(Math.min(0.999, this.accumulator / Loop.STEP));
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.advance(dt);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
