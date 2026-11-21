import { describe, expect, it } from 'vitest';
import { buildStatics, hitsHazard, moverPosition, springImpulse, springZone } from './elements';
import { validateLevel } from '../levels/schema';
import { minimalLevel } from '../levels/testFixtures';
import type { MotionPath } from './types';

describe('moverPosition', () => {
  const pend: MotionPath = { type: 'pendulum', pivot: { x: 0, y: 0 }, length: 100, amplitude: 0.5, period: 2 };
  it('Pendel: t=0 senkrecht unter dem Drehpunkt', () => {
    const p = moverPosition(pend, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(100);
  });
  it('Pendel: t=0,5 maximal ausgelenkt', () => {
    const p = moverPosition(pend, 0.5);
    expect(p.x).toBeCloseTo(100 * Math.sin(0.5));
    expect(p.y).toBeCloseTo(100 * Math.cos(0.5));
  });
  it('Pendel: periodisch', () => {
    expect(moverPosition(pend, 2).x).toBeCloseTo(moverPosition(pend, 0).x);
  });
  it('Kreis: Viertelperiode = Viertelumdrehung', () => {
    const c: MotionPath = { type: 'circle', center: { x: 0, y: 0 }, radius: 50, period: 4 };
    const a = moverPosition(c, 0);
    const b = moverPosition(c, 1);
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(50);
    expect(a.x * b.x + a.y * b.y).toBeCloseTo(0);
  });
  it('Linie: hin und zurück', () => {
    const l: MotionPath = { type: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, period: 2 };
    expect(moverPosition(l, 1).x).toBeCloseTo(100);
    expect(moverPosition(l, 2).x).toBeCloseTo(0);
    expect(moverPosition(l, 0.5).x).toBeCloseTo(50);
  });
  it('phase verschiebt um Anteile der Periode', () => {
    const l: MotionPath = { type: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, period: 2, phase: 0.5 };
    expect(moverPosition(l, 0).x).toBeCloseTo(100);
  });
});

describe('Federn', () => {
  it('angle 0 = nach oben, 90 = nach rechts', () => {
    const up = springImpulse({ pos: { x: 0, y: 0 }, angle: 0, power: 1400 });
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(-1400);
    const right = springImpulse({ pos: { x: 0, y: 0 }, angle: 90, power: 1400 });
    expect(right.x).toBeCloseTo(1400);
    expect(right.y).toBeCloseTo(0);
  });
  it('Zone 40×16 über der Basis', () => {
    expect(springZone({ pos: { x: 100, y: 200 }, angle: 0, power: 1 })).toEqual({ x: 80, y: 184, w: 40, h: 16 });
  });
});

describe('hitsHazard', () => {
  const level = validateLevel({
    ...minimalLevel(),
    hazards: [{ kind: 'tinsel', rect: { x: 100, y: 100, w: 50, h: 10 } }],
    movers: [{ kind: 'bell', radius: 20, path: { type: 'circle', center: { x: 500, y: 100 }, radius: 0.001, period: 1 } }],
  }, 't.json');
  it('statische Gefahr', () => {
    expect(hitsHazard({ x: 120, y: 95 }, 8, level, 0)).toBe(true);
  });
  it('bewegte Gefahr', () => {
    expect(hitsHazard({ x: 525, y: 100 }, 8, level, 0)).toBe(true);
  });
  it('außer Reichweite', () => {
    expect(hitsHazard({ x: 300, y: 300 }, 8, level, 0)).toBe(false);
    expect(hitsHazard({ x: 530, y: 100 }, 8, level, 0)).toBe(false);
  });
});

describe('buildStatics', () => {
  it('4 Kanten je Plattform und Hindernis, Hindernisse als Festkörper', () => {
    const level = validateLevel({ ...minimalLevel(), icicles: [{ x: 50, y: 500, h: 40 }], candies: [{ x: 80, y: 500, h: 60 }] }, 't.json');
    const st = buildStatics(level);
    expect(st.solids.length).toBe(3);
    expect(st.sledSegments.length).toBe(12);
  });
});
