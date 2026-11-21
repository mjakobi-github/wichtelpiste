import { describe, expect, it } from 'vitest';
import { FpsMonitor, QUALITY, type QualityTier } from './quality';

function feed(m: FpsMonitor, fps: number, seconds: number): void {
  const ms = 1000 / fps;
  for (let t = 0; t < seconds * 1000; t += ms) m.sample(ms);
}

describe('QUALITY', () => {
  it('hat die drei Stufen laut Plan', () => {
    expect(QUALITY.high).toEqual({ resolution: 2, bloom: true, particles: 1 });
    expect(QUALITY.medium).toEqual({ resolution: 1.5, bloom: true, particles: 0.6 });
    expect(QUALITY.low).toEqual({ resolution: 1, bloom: false, particles: 0.3 });
  });
});

describe('FpsMonitor', () => {
  it('stuft bei dauerhaft < 50 fps je 3 s eine Stufe ab und nie wieder hoch', () => {
    const seen: QualityTier[] = [];
    const m = new FpsMonitor((t) => seen.push(t));
    feed(m, 40, 3.05);
    expect(seen).toEqual(['medium']);
    feed(m, 40, 3.05);
    expect(seen).toEqual(['medium', 'low']);
    feed(m, 60, 6);
    feed(m, 40, 6);
    expect(seen).toEqual(['medium', 'low']);
  });

  it('bleibt bei flüssigen 60 fps auf der Startstufe', () => {
    const seen: QualityTier[] = [];
    const m = new FpsMonitor((t) => seen.push(t), 'high');
    feed(m, 60, 10);
    expect(seen).toEqual([]);
  });

  it('ignoriert einzelne Ausreißer (z. B. Tab im Hintergrund)', () => {
    const seen: QualityTier[] = [];
    const m = new FpsMonitor((t) => seen.push(t));
    m.sample(2000);
    feed(m, 60, 3.05);
    expect(seen).toEqual([]);
  });
});
