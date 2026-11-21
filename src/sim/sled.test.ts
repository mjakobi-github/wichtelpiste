import { describe, expect, it } from 'vitest';
import { Sled, SLED_TUNING } from './sled';
import type { Segment, Vec2 } from './types';

const DT = 1 / 60;
const R = SLED_TUNING.pointRadius;

/** Linie durch die Punkte, zerlegt in Teilstücke der Länge stepPx (wie gezeichnete Striche). */
function line(pts: Vec2[], stepPx = Infinity, boost = false): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepPx));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      out.push({
        ax: a.x + (b.x - a.x) * t0, ay: a.y + (b.y - a.y) * t0,
        bx: a.x + (b.x - a.x) * t1, by: a.y + (b.y - a.y) * t1,
        ...(boost ? { boost: true } : {}),
      });
    }
  }
  return out;
}

function run(sled: Sled, segs: Segment[], seconds: number, each?: () => void) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    sled.update(DT, segs);
    each?.();
  }
}

describe('Sled', () => {
  it('kein Kleben: flache Linie aus 3-px-Stücken, 600 px/s → nach 1 s noch ≥ 570', () => {
    const segs = line([{ x: 0, y: 0 }, { x: 3000, y: 0 }], 3);
    const s = new Sled();
    s.reset({ x: 100, y: -R }, { x: 600, y: 0 });
    run(s, segs, 1);
    expect(s.speed).toBeGreaterThanOrEqual(570);
  });

  it('viele Teilstücke bremsen nicht stärker als ein Segment (30°-Gefälle, < 2 %)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 3000 * Math.cos(Math.PI / 6), y: 3000 * Math.sin(Math.PI / 6) };
    const start = { x: 50, y: 50 * Math.tan(Math.PI / 6) - R / Math.cos(Math.PI / 6) };
    const s1 = new Sled();
    s1.reset(start, { x: 0, y: 0 });
    run(s1, line([a, b], 3), 1);
    const s2 = new Sled();
    s2.reset(start, { x: 0, y: 0 });
    run(s2, line([a, b]), 1);
    expect(s2.speed).toBeGreaterThan(500);
    expect(Math.abs(s1.speed - s2.speed) / s2.speed).toBeLessThan(0.02);
  });

  it('hebt über einer Kuppe ab (20° hoch, dann 40° runter, 900 px/s)', () => {
    const up = 20 * Math.PI / 180;
    const down = 40 * Math.PI / 180;
    const crest = { x: 400 * Math.cos(up), y: -400 * Math.sin(up) };
    const segs = line([{ x: 0, y: 0 }, crest, { x: crest.x + 1500 * Math.cos(down), y: crest.y + 1500 * Math.sin(down) }], 3);
    const s = new Sled();
    const startX = 250;
    s.reset({ x: startX * Math.cos(up), y: -startX * Math.sin(up) - R }, { x: 900 * Math.cos(up), y: -900 * Math.sin(up) });
    let maxAir = 0;
    run(s, segs, 1.5, () => { maxAir = Math.max(maxAir, s.airTime); });
    expect(maxAir).toBeGreaterThanOrEqual(0.1);
  });

  it('kein Durchtunneln bei Höchsttempo', () => {
    const segs = line([{ x: -500, y: 0 }, { x: 500, y: 0 }]);
    const s = new Sled();
    s.reset({ x: 0, y: -60 }, { x: 0, y: 3200 });
    run(s, segs, 0.5);
    expect(s.pos.y).toBeLessThan(0);
  });

  it('von unten gegen eine Linie: bleibt unterhalb', () => {
    const segs = line([{ x: -500, y: 0 }, { x: 500, y: 0 }]);
    const s = new Sled();
    s.reset({ x: 0, y: 80 }, { x: 0, y: -1500 });
    run(s, segs, 0.3);
    expect(s.pos.y).toBeGreaterThan(0);
  });

  it('Speedtinte schiebt in Zeichenrichtung', () => {
    const right = line([{ x: -500, y: 0 }, { x: 500, y: 0 }], Infinity, true);
    const s = new Sled();
    s.reset({ x: 0, y: -R }, { x: 0, y: 0 });
    run(s, right, 0.5);
    expect(s.vel.x).toBeGreaterThan(0);

    const left = line([{ x: 500, y: 0 }, { x: -500, y: 0 }], Infinity, true);
    const s2 = new Sled();
    s2.reset({ x: 0, y: -R }, { x: 0, y: 0 });
    run(s2, left, 0.5);
    expect(s2.vel.x).toBeLessThan(0);
  });

  it('Speedtinte überschreitet nie 3200 px/s', () => {
    const segs = line([{ x: 0, y: 0 }, { x: 40000, y: 0 }], 3, true);
    const s = new Sled();
    s.reset({ x: 10, y: -R }, { x: 2000, y: 0 });
    let max = 0;
    run(s, segs, 3, () => { max = Math.max(max, s.speed); });
    expect(max).toBeLessThanOrEqual(3200 + 1e-6);
    expect(max).toBeGreaterThan(2500);
  });

  it('Sprungfeder mit Höchsttempo: kein Durchtunneln einer Linie darüber', () => {
    const segs = line([{ x: -1000, y: -150 }, { x: 1000, y: -350 }]);
    const s = new Sled();
    s.reset({ x: 0, y: 0 }, { x: 0, y: 0 });
    s.launch(800, -3200);
    run(s, segs, 0.5);
    // Linie bei x liegt auf y = -150 - (x + 1000) * 0.1 → Schlitten muss darunter (größeres y) sein
    const lineY = -150 - (s.pos.x + 1000) * 0.1;
    expect(s.pos.y).toBeGreaterThan(lineY);
  });

  it('prevPos, grounded und angle', () => {
    const segs = line([{ x: -500, y: 0 }, { x: 500, y: 0 }]);
    const s = new Sled();
    s.reset({ x: 0, y: -R }, { x: 100, y: 0 });
    const before = { ...s.pos };
    s.update(DT, segs);
    expect(s.prevPos).toEqual(before);
    expect(s.grounded).toBe(true);
    expect(Math.abs(s.angle)).toBeLessThan(0.01);
  });
});
