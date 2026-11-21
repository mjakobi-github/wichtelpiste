import { describe, expect, it } from 'vitest';
import { addElement, getElement } from './doc';
import { dragHandle, elementBounds, handlesFor, hitTest } from './handles';
import { newLevel } from './template';
import type { Mover, Platform, Spring } from '../sim/types';

describe('handlesFor', () => {
  it('Rechteck hat 8 Griffe', () => {
    expect(handlesFor(newLevel(), { kind: 'platform', index: 0 }).map((h) => h.id).sort())
      .toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
  });
  it('Pendel, Linie, Feder, Eiszapfen', () => {
    const b = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'bell');
    expect(handlesFor(b.level, b.ref).map((h) => h.id)).toEqual(['pivot', 'bob', 'swing']);
    const c = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'crow');
    expect(handlesFor(c.level, c.ref).map((h) => h.id)).toEqual(['from', 'to']);
    const s = addElement(newLevel(), 'spring', { x: 500, y: 300 });
    expect(handlesFor(s.level, s.ref).map((h) => h.id)).toEqual(['angle']);
    const i = addElement(newLevel(), 'icicle', { x: 500, y: 300 });
    expect(handlesFor(i.level, i.ref).map((h) => h.id)).toEqual(['height']);
  });
});

describe('dragHandle', () => {
  const l = newLevel();
  const ref = { kind: 'platform' as const, index: 0 };
  const p0 = l.platforms[0];

  it('se vergrößert', () => {
    const p = dragHandle(l, ref, 'se', { x: p0.x + p0.w + 50, y: p0.y + p0.h + 30 }, { snap: false }).platforms[0];
    expect(p.w).toBe(p0.w + 50);
    expect(p.h).toBe(p0.h + 30);
    expect(p.x).toBe(p0.x);
  });

  it('nw über die Gegenecke hinaus → Mindestgröße, nie negativ', () => {
    const p = dragHandle(l, ref, 'nw', { x: p0.x + p0.w + 100, y: p0.y + p0.h + 100 }, { snap: false }).platforms[0] as Platform;
    expect(p.w).toBe(10);
    expect(p.h).toBe(10);
    expect(p.x + p.w).toBe(p0.x + p0.w);
  });

  it('Raster rastet die Kante ein', () => {
    const p = dragHandle(l, ref, 'e', { x: p0.x + p0.w + 13, y: 0 }, { snap: true }).platforms[0];
    expect((p.x + p.w) % 10).toBe(0);
  });

  it('Feder-Winkel nach rechts = 90, mit Raster auf 5° gerundet', () => {
    const s = addElement(newLevel(), 'spring', { x: 500, y: 300 });
    const sp = (x: number, y: number, snap: boolean) => (getElement(dragHandle(s.level, s.ref, 'angle', { x, y }, { snap }), s.ref) as Spring).angle;
    expect(sp(600, 300, false)).toBeCloseTo(90);
    expect(sp(500, 200, false)).toBeCloseTo(0);
    expect(sp(600, 290, true) % 5).toBe(0);
  });

  it('Pendel: bob setzt Länge, swing den Ausschlag', () => {
    const b = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'bell');
    const m0 = getElement(b.level, b.ref) as Mover;
    if (m0.path.type !== 'pendulum') throw new Error();
    const piv = m0.path.pivot;
    const m1 = getElement(dragHandle(b.level, b.ref, 'bob', { x: piv.x, y: piv.y + 200 }, { snap: false }), b.ref) as Mover;
    expect(m1.path.type === 'pendulum' && m1.path.length).toBe(200);
    const m2 = getElement(dragHandle(b.level, b.ref, 'swing', { x: piv.x + 100, y: piv.y + 100 }, { snap: false }), b.ref) as Mover;
    expect(m2.path.type === 'pendulum' && m2.path.amplitude).toBeCloseTo(Math.PI / 4);
  });

  it('Linie: to setzt Ende', () => {
    const c = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'crow');
    const m = getElement(dragHandle(c.level, c.ref, 'to', { x: 900, y: 100 }, { snap: false }), c.ref) as Mover;
    expect(m.path.type === 'line' && m.path.to).toEqual({ x: 900, y: 100 });
  });

  it('move verschiebt um die Differenz zum Ausgangspunkt nicht – das macht moveElement', () => {
    expect(dragHandle(l, ref, 'move', { x: 0, y: 0 }, { snap: false })).toBe(l);
  });
});

describe('hitTest', () => {
  it('Geschenk auf Plattform → Geschenk', () => {
    const l = newLevel();
    expect(hitTest(l, l.gifts[0], 1, null)?.ref).toEqual({ kind: 'gift', index: 0 });
  });

  it('Griff des gewählten Elements vor darunterliegendem Element', () => {
    const l = newLevel();
    const ref = { kind: 'platform' as const, index: 0 };
    const se = handlesFor(l, ref).find((h) => h.id === 'se')!.pos;
    expect(hitTest(l, se, 1, ref)).toEqual({ ref, handle: 'se' });
  });

  it('Trefferradius skaliert mit dem Zoom', () => {
    const l = newLevel();
    const ref = { kind: 'platform' as const, index: 0 };
    const se = handlesFor(l, ref).find((h) => h.id === 'se')!.pos;
    const off = { x: se.x + 40, y: se.y + 0 };
    expect(hitTest(l, off, 1, ref)?.handle).not.toBe('se');
    expect(hitTest(l, off, 0.5, ref)?.handle).toBe('se');
  });

  it('leere Fläche → null', () => {
    expect(hitTest(newLevel(), { x: 1000, y: 100 }, 1, null)).toBeNull();
  });

  it('elementBounds für alle Arten endlich', () => {
    let l = newLevel();
    for (const [k, v] of [['mover', 'bell'], ['mover', 'crow'], ['spring'], ['icicle'], ['candy'], ['hazard'], ['hint'], ['checkpoint'], ['noDraw']] as const) {
      const r = addElement(l, k, { x: 500, y: 300 }, v);
      l = r.level;
      const b = elementBounds(l, r.ref);
      expect(Number.isFinite(b.x + b.y + b.w + b.h)).toBe(true);
      expect(b.w).toBeGreaterThan(0);
    }
  });
});
