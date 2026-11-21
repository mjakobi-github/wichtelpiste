import { describe, expect, it } from 'vitest';
import { Ink } from './ink';
import { segmentIntersectsRect } from './geometry';
import type { Area, Rect, Vec2 } from './types';

const AREAS: Area[] = [{ ink: 1500, boost: 300 }, { ink: 800, boost: 'unlimited' }];

function strokeLen(pts: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}
function areaLen(ink: Ink, area: number, boost: boolean): number {
  return ink.strokes.filter((s) => s.area === area && s.boost === boost).reduce((n, s) => n + strokeLen(s.pts), 0);
}
/** Zeichnet eine Linie von a nach b in 5-px-Schritten (mit leichter Welle, damit nichts wegvereinfacht wird). */
function draw(ink: Ink, area: number, boost: boolean, a: Vec2, b: Vec2, wave = 0) {
  expect(ink.begin(area, boost, a)).toBe(true);
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
  const results: string[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    results.push(ink.extend({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(i) * wave }));
  }
  ink.end();
  return results;
}

describe('Ink', () => {
  it('Budget-Invariante: Strichlänge + Rest = Budget nach Zeichnen, Radieren, Undo, Clear', () => {
    const ink = new Ink(AREAS, []);
    const check = () => expect(areaLen(ink, 0, false) + (ink.remaining(0, false) as number)).toBeCloseTo(1500, 2);
    draw(ink, 0, false, { x: 0, y: 0 }, { x: 300, y: 100 }, 4); check();
    draw(ink, 0, false, { x: 0, y: 200 }, { x: 400, y: 200 }, 3); check();
    ink.eraseAt(0, { x: 150, y: 50 }); check();
    ink.undo(0); check();
    draw(ink, 0, false, { x: 0, y: 300 }, { x: 200, y: 400 }, 2); check();
    ink.clear(0); check();
    expect(ink.remaining(0, false)).toBeCloseTo(1500, 2);
  });

  it('wird nie negativ: Budget 100, Strich 300 → genau 100 lang, danach empty', () => {
    const ink = new Ink([{ ink: 100, boost: 0 }], []);
    const res = draw(ink, 0, false, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(ink.remaining(0, false)).toBe(0);
    expect(areaLen(ink, 0, false)).toBeCloseTo(100, 2);
    expect(res).toContain('empty');
    expect(ink.begin(0, false, { x: 0, y: 50 })).toBe(false);
  });

  it('Speedtinte nutzt nur den eigenen Pool', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 0, true, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(ink.remaining(0, true)).toBeCloseTo(200, 2);
    expect(ink.remaining(0, false)).toBe(1500);
  });

  it('Abschnitte sind getrennt: Radieren/Undo/Clear in Abschnitt 1 lassen Abschnitt 0 in Ruhe', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 0, false, { x: 0, y: 0 }, { x: 100, y: 0 });
    draw(ink, 1, false, { x: 0, y: 50 }, { x: 100, y: 50 });
    const before = JSON.stringify(ink.strokes.filter((s) => s.area === 0));
    ink.eraseAt(1, { x: 50, y: 0 });
    ink.undo(1);
    ink.clear(1);
    expect(JSON.stringify(ink.strokes.filter((s) => s.area === 0))).toBe(before);
    expect(ink.remaining(0, false)).toBeCloseTo(1400, 2);
  });

  const ZONE: Rect = { x: 100, y: -50, w: 50, h: 100 };

  it('Zeichenverbot: begin in der Zone schlägt fehl', () => {
    const ink = new Ink(AREAS, [ZONE]);
    expect(ink.begin(0, false, { x: 120, y: 0 })).toBe(false);
    expect(ink.strokes.length).toBe(0);
  });

  it('Zeichenverbot: Strich in die Zone hinein wird blockiert, kein Segment schneidet sie', () => {
    const ink = new Ink(AREAS, [ZONE]);
    const res = draw(ink, 0, false, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(res).toContain('blocked');
    for (const s of ink.segments()) {
      expect(segmentIntersectsRect({ x: s.ax, y: s.ay }, { x: s.bx, y: s.by }, ZONE)).toBe(false);
    }
    expect(areaLen(ink, 0, false) + (ink.remaining(0, false) as number)).toBeCloseTo(1500, 2);
  });

  it('Glätten: kollineare Punkte → 2 Punkte, Länge und Budget unverändert', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 0, false, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(ink.strokes[0].pts.length).toBe(2);
    expect(strokeLen(ink.strokes[0].pts)).toBeCloseTo(300, 2);
    expect(ink.remaining(0, false)).toBeCloseTo(1200, 2);
  });

  it('Radieren in der Mitte teilt den Strich und erstattet die entfernte Länge', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 0, false, { x: 0, y: 0 }, { x: 300, y: 0 });
    expect(ink.eraseAt(0, { x: 150, y: 0 })).toBe(true);
    expect(ink.strokes.length).toBe(2);
    // Radius 18 → 36 px entfernt
    expect(ink.remaining(0, false)).toBeCloseTo(1236, 1);
  });

  it('unbegrenzt bleibt unbegrenzt, usedTotal zählt trotzdem', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 1, true, { x: 0, y: 0 }, { x: 100, y: 0 });
    draw(ink, 0, false, { x: 0, y: 50 }, { x: 50, y: 50 });
    expect(ink.remaining(1, true)).toBe('unlimited');
    expect(ink.usedTotal()).toBeCloseTo(150, 2);
  });

  it('segments() liefert Boost-Flag und Zeichenrichtung', () => {
    const ink = new Ink(AREAS, []);
    draw(ink, 0, true, { x: 100, y: 0 }, { x: 0, y: 0 });
    const s = ink.segments()[0];
    expect(s.boost).toBe(true);
    expect(s.ax).toBeGreaterThan(s.bx);
  });

  it('Punkt unter Mindestabstand wird ignoriert; Strich mit < 2 Punkten verschwindet', () => {
    const ink = new Ink(AREAS, []);
    ink.begin(0, false, { x: 0, y: 0 });
    ink.extend({ x: 2, y: 0 });
    ink.end();
    expect(ink.strokes.length).toBe(0);
    expect(ink.remaining(0, false)).toBe(1500);
  });
});
