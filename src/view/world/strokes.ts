import { Container, Graphics } from 'pixi.js';
import type { Stroke } from '../../sim/ink';

const CHEVRON_GAP = 26;
const CHEVRON_SPEED = 70;

/**
 * Gezeichnete Linien als leuchtende Piste (weißer Kern + blaues Glühen);
 * Speedtinte rot/gold mit wandernden Chevrons in Zeichenrichtung.
 */
export class StrokeView {
  readonly container = new Container();
  private readonly glow = new Graphics();
  private readonly core = new Graphics();
  private readonly chevrons = new Graphics();
  private sig = '';
  private boostPaths: { pts: { x: number; y: number }[]; cum: number[] }[] = [];

  constructor() {
    this.glow.blendMode = 'add';
    this.chevrons.blendMode = 'add';
    this.container.addChild(this.glow, this.core, this.chevrons);
  }

  update(strokes: readonly Stroke[], t: number): void {
    const sig = signature(strokes);
    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild(strokes);
    }
    this.drawChevrons(t);
  }

  private rebuild(strokes: readonly Stroke[]): void {
    const glow = this.glow.clear();
    const core = this.core.clear();
    this.boostPaths = [];
    for (const s of strokes) {
      if (s.pts.length < 2) continue;
      const line = (g: Graphics) => {
        g.moveTo(s.pts[0].x, s.pts[0].y);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x, s.pts[i].y);
      };
      const style = { cap: 'round', join: 'round' } as const;
      if (s.boost) {
        line(glow); glow.stroke({ ...style, width: 20, color: 0xff4a2a, alpha: 0.22 });
        line(glow); glow.stroke({ ...style, width: 9, color: 0xffa23d, alpha: 0.55 });
        line(core); core.stroke({ ...style, width: 3.4, color: 0xfff0c8 });
        const cum = [0];
        for (let i = 1; i < s.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y));
        this.boostPaths.push({ pts: s.pts, cum });
      } else {
        line(glow); glow.stroke({ ...style, width: 20, color: 0x3aa8ff, alpha: 0.2 });
        line(glow); glow.stroke({ ...style, width: 8, color: 0x8ce1ff, alpha: 0.55 });
        line(core); core.stroke({ ...style, width: 3.2, color: 0xf4fcff });
      }
    }
  }

  private drawChevrons(t: number): void {
    const g = this.chevrons.clear();
    if (!this.boostPaths.length) return;
    const shift = (t * CHEVRON_SPEED) % CHEVRON_GAP;
    for (const p of this.boostPaths) {
      const total = p.cum[p.cum.length - 1];
      let i = 1;
      for (let d = shift; d < total; d += CHEVRON_GAP) {
        while (i < p.cum.length - 1 && p.cum[i] < d) i++;
        const a = p.pts[i - 1];
        const b = p.pts[i];
        const seg = p.cum[i] - p.cum[i - 1] || 1;
        const u = (d - p.cum[i - 1]) / seg;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y + (b.y - a.y) * u;
        const dx = (b.x - a.x) / seg;
        const dy = (b.y - a.y) / seg;
        // Pfeilspitze in Zeichenrichtung
        const fade = Math.min(1, d / 20, (total - d) / 20);
        g.moveTo(x - dx * 4 - dy * 5, y - dy * 4 + dx * 5)
          .lineTo(x + dx * 3, y + dy * 3)
          .lineTo(x - dx * 4 + dy * 5, y - dy * 4 - dx * 5)
          .stroke({ width: 2.4, color: 0xffe27a, alpha: 0.9 * fade, cap: 'round', join: 'round' });
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

function signature(strokes: readonly Stroke[]): string {
  let n = 0;
  let last = '';
  let ids = 0;
  for (const s of strokes) {
    n += s.pts.length;
    ids += s.id;
    const p = s.pts[s.pts.length - 1];
    if (p) last = `${p.x},${p.y}`;
  }
  return `${strokes.length}:${ids}:${n}:${last}`;
}
