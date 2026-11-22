import type { LevelData, MotionPath, Obstacle, Rect, Segment, Spring, Station, Vec2, Platform } from './types';
import { circleIntersectsRect, dist } from './geometry';

export const CHIMNEY_W = 44;
export const CHIMNEY_H = 64;

/** Position eines bewegten Hindernisses zur Zeit t (Sekunden), deterministisch. */
export function moverPosition(path: MotionPath, t: number): Vec2 {
  const u = t / path.period + (path.phase ?? 0);
  switch (path.type) {
    case 'pendulum': {
      const a = path.amplitude * Math.sin(2 * Math.PI * u);
      return { x: path.pivot.x + path.length * Math.sin(a), y: path.pivot.y + path.length * Math.cos(a) };
    }
    case 'circle': {
      const a = 2 * Math.PI * u;
      return { x: path.center.x + path.radius * Math.cos(a), y: path.center.y + path.radius * Math.sin(a) };
    }
    case 'line': {
      const f = u - Math.floor(u);
      const tri = f < 0.5 ? f * 2 : 2 - f * 2; // 0 → 1 → 0
      return { x: path.from.x + (path.to.x - path.from.x) * tri, y: path.from.y + (path.to.y - path.from.y) * tri };
    }
  }
}

/** Abschussgeschwindigkeit einer Feder (angle 0 = nach oben, + = im Uhrzeigersinn). */
export function springImpulse(s: Spring): Vec2 {
  const a = (s.angle * Math.PI) / 180;
  return { x: Math.sin(a) * s.power, y: -Math.cos(a) * s.power };
}

/** Auslöse-Zone einer Feder: 40×16 über der Basis-Mitte. */
export function springZone(s: Spring): Rect {
  return { x: s.pos.x - 20, y: s.pos.y - 16, w: 40, h: 16 };
}

/** Kollisionsbox eines harmlosen Hindernisses. */
export function obstacleRect(o: Obstacle, kind: 'icicle' | 'candy'): Rect {
  if (kind === 'icicle') return { x: o.x - 6, y: o.y - o.h, w: 12, h: o.h };
  return { x: o.x - 9, y: o.y - o.h - 24, w: 18, h: o.h + 24 };
}

/** Aufstiegs-Zone um eine Station. */
export function stationZone(s: Station): Rect {
  return { x: s.pos.x - 40, y: s.pos.y - 70, w: 90, h: 120 };
}

/** Fahrtrichtung beim LOS: wie an der Station eingestellt, sonst zum Ziel (Landezone bzw. Schornstein). */
export function stationDir(l: LevelData, area: number): 1 | -1 {
  const s = l.stations[area];
  if (s.dir === 1 || s.dir === -1) return s.dir;
  const z = l.dismounts[area];
  const tx = z ? z.x + z.w / 2 : l.chimney.x;
  return tx >= s.pos.x ? 1 : -1;
}

/** Lieferzone um den Schornstein (Basis-Mitte). */
export function chimneyZone(c: Vec2): Rect {
  return { x: c.x - CHIMNEY_W / 2, y: c.y - CHIMNEY_H - 10, w: CHIMNEY_W, h: CHIMNEY_H + 50 };
}

/** Statische Welt: Festkörper für den Fuß-Modus, deren Kanten für den Schlitten. */
export function buildStatics(level: LevelData): { solids: Platform[]; sledSegments: Segment[] } {
  const solids: Platform[] = [
    ...level.platforms,
    ...level.icicles.map((o) => obstacleRect(o, 'icicle')),
    ...level.candies.map((o) => obstacleRect(o, 'candy')),
  ];
  const sledSegments: Segment[] = [];
  for (const r of solids) {
    sledSegments.push(
      { ax: r.x, ay: r.y, bx: r.x + r.w, by: r.y },
      { ax: r.x, ay: r.y + r.h, bx: r.x + r.w, by: r.y + r.h },
      { ax: r.x, ay: r.y, bx: r.x, by: r.y + r.h },
      { ax: r.x + r.w, ay: r.y, bx: r.x + r.w, by: r.y + r.h },
    );
  }
  return { solids, sledSegments };
}

/** Berührt ein Kreis (Spieler/Schlitten) eine tödliche Gefahr? moverT = Zeit der Beweger. */
export function hitsHazard(c: Vec2, radius: number, level: LevelData, moverT: number): boolean {
  if (level.hazards.some((h) => circleIntersectsRect(c, radius, h.rect))) return true;
  return level.movers.some((m) => dist(c, moverPosition(m.path, moverT)) < radius + m.radius);
}
