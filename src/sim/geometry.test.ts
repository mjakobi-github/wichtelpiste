import { describe, expect, it } from 'vitest';
import {
  circleIntersectsRect,
  closestPointOnSegment,
  overlap,
  segmentIntersectsRect,
} from './geometry';

describe('closestPointOnSegment', () => {
  const seg = { ax: 0, ay: 0, bx: 10, by: 0 };
  it('klemmt auf den Startpunkt', () => {
    expect(closestPointOnSegment(seg, { x: -5, y: 3 })).toEqual({ x: 0, y: 0 });
  });
  it('projiziert auf das Innere', () => {
    expect(closestPointOnSegment(seg, { x: 4, y: 7 })).toEqual({ x: 4, y: 0 });
  });
  it('Segment der Länge 0 liefert den Startpunkt', () => {
    expect(closestPointOnSegment({ ax: 3, ay: 4, bx: 3, by: 4 }, { x: 9, y: 9 })).toEqual({ x: 3, y: 4 });
  });
});

describe('segmentIntersectsRect', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  it('Strecke quer durch das Rechteck', () => {
    expect(segmentIntersectsRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r)).toBe(true);
  });
  it('Strecke daneben', () => {
    expect(segmentIntersectsRect({ x: -5, y: -5 }, { x: 20, y: -1 }, r)).toBe(false);
  });
  it('ein Endpunkt innen', () => {
    expect(segmentIntersectsRect({ x: 5, y: 5 }, { x: 50, y: 50 }, r)).toBe(true);
  });
});

describe('circleIntersectsRect', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  it('Kreis berührt die Seite', () => {
    expect(circleIntersectsRect({ x: 15, y: 5 }, 6, r)).toBe(true);
  });
  it('Kreis zu klein', () => {
    expect(circleIntersectsRect({ x: 15, y: 5 }, 4, r)).toBe(false);
  });
});

describe('overlap', () => {
  it('berührende Kanten überlappen nicht', () => {
    expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
  it('echte Überlappung', () => {
    expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
});
