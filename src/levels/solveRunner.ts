import type { LevelData, Vec2 } from '../sim/types';
import type { SimEvent } from '../sim/events';
import { Simulation } from '../sim/simulation';
import { Loop } from '../engine/loop';

/** Lösungsdatei: je Abschnitt die Striche (Punkte als [x, y]). */
export interface Solution { areas: { strokes: { boost: boolean; pts: [number, number][] }[] }[] }

export interface AreaRun {
  /** Erstes Ereignis aus arrive/crash/win oder null (Zeit abgelaufen) */
  outcome: SimEvent | null;
  /** Beim Zeichnen: Tinte leer oder Verbotszone getroffen */
  drawProblems: SimEvent[];
  remaining: { ink: number | 'unlimited'; boost: number | 'unlimited' };
  gifts: number[];
  path: Vec2[];
  time: number;
}

/** Gleicher fester Takt wie im Spiel – das Ergebnis der Fahrt hängt vom Schritt ab. */
export const SOLVE_DT = Loop.STEP;
const DT = SOLVE_DT;
const IDLE = { move: 0 as const, jumpHeld: false, jumpPressed: false };

/** Steigt an Station `area` ein, zeichnet die Lösung, fährt los und simuliert bis zum Ergebnis. */
export function runArea(level: LevelData, sol: Solution, area: number, maxT = 20): AreaRun {
  const sim = new Simulation(level);
  sim.boardForTest(area);
  const drawProblems: SimEvent[] = [];
  const collect = (ev: SimEvent[]): void => { for (const e of ev) if (e.type === 'inkEmpty' || e.type === 'blocked') drawProblems.push(e); };
  for (const s of sol.areas[area]?.strokes ?? []) {
    const [x0, y0] = s.pts[0];
    sim.command({ type: 'strokeBegin', p: { x: x0, y: y0 }, boost: s.boost });
    for (const [x, y] of s.pts.slice(1)) sim.command({ type: 'strokeMove', p: { x, y } });
    sim.command({ type: 'strokeEnd' });
    collect(sim.step(DT, IDLE));
  }
  const remaining = { ink: sim.ink.remaining(area, false), boost: sim.ink.remaining(area, true) };
  sim.command({ type: 'launch' });
  const gifts: number[] = [];
  const path: Vec2[] = [];
  let outcome: SimEvent | null = null;
  let t = 0;
  for (; t < maxT && !outcome; t += DT) {
    for (const e of sim.step(DT, IDLE)) {
      if (e.type === 'gift') gifts.push(e.index);
      if (e.type === 'arrive' || e.type === 'crash' || e.type === 'win') { outcome = e; break; }
    }
    if (Math.round(t / DT) % 30 === 0) path.push({ x: Math.round(sim.sled.pos.x), y: Math.round(sim.sled.pos.y) });
  }
  return { outcome, drawProblems, remaining, gifts, path, time: t };
}
