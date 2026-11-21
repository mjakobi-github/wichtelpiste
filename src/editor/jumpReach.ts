import type { LevelData, Platform, Vec2 } from '../sim/types';
import { Player, PLAYER_TUNING } from '../sim/player';
import { Loop } from '../engine/loop';
import { getElement, type ElementRef } from './doc';

const W = PLAYER_TUNING.size.w;
const H = PLAYER_TUNING.size.h;
/** So tief unter die Absprunghöhe wird der Bogen verfolgt. */
const DROP = 600;
const cache = new Map<string, Vec2[]>();

/**
 * Flugbahn der Füße (Mitte) bei vollem Anlauf und gehaltenem Sprung, relativ zur Kante (0, 0),
 * simuliert mit der echten Spielphysik. dir = Richtung des Sprungs.
 */
export function jumpArc(opts: { ice: boolean; dir: 1 | -1 }): Vec2[] {
  const key = `${opts.ice}`;
  let right = cache.get(key);
  if (!right) {
    right = simulate(opts.ice);
    cache.set(key, right);
  }
  return opts.dir === 1 ? right.map((p) => ({ ...p })) : right.map((p) => ({ x: -p.x, y: p.y }));
}

function simulate(ice: boolean): Vec2[] {
  const ground: Platform[] = [{ x: -4000, y: 0, w: 4000, h: 200, ice }];
  const p = new Player({ x: -3800, y: -H });
  const dt = Loop.STEP;
  const run = { move: 1 as const, jumpHeld: false, jumpPressed: false };
  // Anlauf, bis die Vorderkante die Kante erreicht
  for (let i = 0; i < 2000 && p.pos.x + W < 0; i++) p.update(dt, run, ground);
  const pts: Vec2[] = [];
  const feet = (): Vec2 => ({ x: p.pos.x + W / 2, y: p.pos.y + H });
  pts.push(feet());
  p.update(dt, { move: 1, jumpHeld: true, jumpPressed: true }, ground);
  for (let i = 0; i < 600; i++) {
    pts.push(feet());
    if (feet().y > DROP) break;
    p.update(dt, { move: 1, jumpHeld: true, jumpPressed: false }, ground);
  }
  return pts;
}

/** Sprunghöhe und Weite auf gleicher Höhe (ab Kante). */
export function jumpStats(ice: boolean): { height: number; distanceSameLevel: number } {
  const a = jumpArc({ ice, dir: 1 });
  const height = -Math.min(...a.map((p) => p.y));
  let distance = 0;
  for (let i = 1; i < a.length; i++) {
    if (a[i - 1].y < 0 && a[i].y >= 0) {
      const t = -a[i - 1].y / (a[i].y - a[i - 1].y);
      distance = a[i - 1].x + (a[i].x - a[i - 1].x) * t;
      break;
    }
  }
  return { height, distanceSameLevel: distance };
}

const place = (origin: Vec2, arc: Vec2[]): Vec2[] => arc.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y }));

/** Sprungbögen für ein gewähltes Element in Weltkoordinaten (Plattform, Startpunkt, Landezone). */
export function reachFrom(l: LevelData, ref: ElementRef): { origin: Vec2; arc: Vec2[] }[] {
  const both = (left: Vec2, right: Vec2, ice: boolean) => [
    { origin: left, arc: place(left, jumpArc({ ice, dir: -1 })) },
    { origin: right, arc: place(right, jumpArc({ ice, dir: 1 })) },
  ];
  if (ref.kind === 'platform') {
    const p = getElement(l, ref) as Platform;
    return both({ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y }, p.ice === true);
  }
  if (ref.kind === 'spawn') {
    const s = l.spawn;
    const f = { x: s.x + W / 2, y: s.y + H };
    return both(f, f, false);
  }
  if (ref.kind === 'dismount') {
    const d = l.dismounts[ref.index];
    return both({ x: d.x, y: d.y + d.h }, { x: d.x + d.w, y: d.y + d.h }, false);
  }
  return [];
}
