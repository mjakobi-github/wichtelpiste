/** Qualitätsstufen: Auflösung, Bloom, Partikelmenge (Faktor). */
export type QualityTier = 'high' | 'medium' | 'low';

export const QUALITY: Record<QualityTier, { resolution: number; bloom: boolean; particles: number }> = {
  high: { resolution: 2, bloom: true, particles: 1 },
  medium: { resolution: 1.5, bloom: true, particles: 0.6 },
  low: { resolution: 1, bloom: false, particles: 0.3 },
};

const ORDER: QualityTier[] = ['high', 'medium', 'low'];
const WINDOW_MS = 3000;
const MIN_FPS = 50;
/** Längere Frames (Tab im Hintergrund, Laden) zählen nicht. */
const MAX_FRAME_MS = 250;

/**
 * Misst die Bildrate in 3-s-Fenstern. Liegt ein Fenster im Mittel unter 50 fps,
 * geht es eine Stufe runter – innerhalb einer Sitzung nie wieder hoch.
 */
export class FpsMonitor {
  private tier: QualityTier;
  private elapsed = 0;
  private frames = 0;

  constructor(private readonly onChange: (t: QualityTier) => void, start: QualityTier = 'high') {
    this.tier = start;
  }

  get current(): QualityTier { return this.tier; }

  sample(frameMs: number): void {
    if (frameMs <= 0 || frameMs > MAX_FRAME_MS || this.tier === 'low') return;
    this.elapsed += frameMs;
    this.frames++;
    if (this.elapsed < WINDOW_MS) return;
    const fps = (this.frames * 1000) / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    if (fps < MIN_FPS) {
      this.tier = ORDER[ORDER.indexOf(this.tier) + 1];
      this.onChange(this.tier);
    }
  }
}
