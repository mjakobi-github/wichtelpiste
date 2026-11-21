/**
 * Fester Zeitschritt (fixed timestep) mit Akkumulator.
 * Physik bleibt deterministisch, egal wie schnell der Bildschirm ist
 * (Desktop 144 Hz vs. Handy 60/90/120 Hz).
 */
export class Loop {
  private static readonly STEP = 1 / 60;   // Physik-Tick (Sekunden)
  private static readonly MAX_DT = 0.1;    // Tab-Hintergrund etc. abwaermen

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

  private frame = (now: number): void => {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > Loop.MAX_DT) dt = Loop.MAX_DT;

    this.accumulator += dt;
    while (this.accumulator >= Loop.STEP) {
      this.update(Loop.STEP);
      this.accumulator -= Loop.STEP;
    }
    // alpha = Restanteil fuer spaetere Zwischen-Interpolation (derzeit 0)
    this.render(this.accumulator / Loop.STEP);

    this.rafId = requestAnimationFrame(this.frame);
  };
}
