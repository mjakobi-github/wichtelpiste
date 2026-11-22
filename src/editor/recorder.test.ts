import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { Simulation } from '../sim/simulation';
import { Loop } from '../engine/loop';
import { checkSolution } from '../levels/solutionCheck';
import type { Solution } from '../levels/solveRunner';
import { Recorder, mergeSolution, reorderSolution } from './recorder';
import type { LevelData } from '../sim/types';

const sols = import.meta.glob<Solution>('../levels/solutions/*.json', { eager: true, import: 'default' });
const IDLE = { move: 0 as const, jumpHeld: false, jumpPressed: false };

function ride(level = LEVELS[0], sol: Solution = sols[`../levels/solutions/${LEVELS[0].id}.json`]): Recorder {
  const sim = new Simulation(level);
  const rec = new Recorder(level);
  sim.boardForTest(0);
  for (const s of sol.areas[0].strokes) {
    sim.command({ type: 'strokeBegin', p: { x: s.pts[0][0], y: s.pts[0][1] }, boost: s.boost });
    for (const [x, y] of s.pts.slice(1)) sim.command({ type: 'strokeMove', p: { x, y } });
    sim.command({ type: 'strokeEnd' });
  }
  sim.command({ type: 'launch' });
  for (let t = 0; t < 20; t += Loop.STEP) {
    const ev = sim.step(Loop.STEP, IDLE);
    rec.onEvents(sim, ev);
    if (ev.some((e) => e.type === 'arrive' || e.type === 'crash' || e.type === 'win')) break;
  }
  return rec;
}

describe('Recorder', () => {
  it('nimmt die geschaffte Fahrt als Lösung auf', () => {
    const rec = ride();
    expect(rec.solvedAreas[0]).toBe(true);
    expect(checkSolution(LEVELS[0], rec.solution).ok).toBe(true);
  });

  it('Crash → nichts aufgezeichnet', () => {
    const empty: Solution = { areas: [{ strokes: [{ boost: false, pts: [[600, 300], [610, 300]] }] }] };
    const rec = ride(LEVELS[0], empty);
    expect(rec.solvedAreas[0]).toBe(false);
    expect(rec.solution.areas[0].strokes).toEqual([]);
  });
});

describe('mergeSolution / reorderSolution', () => {
  const s = (n: number) => ({ strokes: [{ boost: false, pts: [[n, n], [n + 1, n]] as [number, number][] }] });
  it('ersetzt nur gelöste Abschnitte', () => {
    const old: Solution = { areas: [s(1), s(2)] };
    const rec = { solution: { areas: [s(9), { strokes: [] }] }, solvedAreas: [true, false] };
    expect(mergeSolution(old, rec)).toEqual({ areas: [s(9), s(2)] });
    expect(mergeSolution(null, rec)).toEqual({ areas: [s(9), { strokes: [] }] });
  });
  it('Abschnitt löschen/tauschen', () => {
    const sol: Solution = { areas: [s(1), s(2), s(3)] };
    expect(reorderSolution(sol, { type: 'remove', index: 0 })).toEqual({ areas: [s(2), s(3)] });
    expect(reorderSolution(sol, { type: 'swap', a: 0, b: 2 })).toEqual({ areas: [s(3), s(2), s(1)] });
    expect(reorderSolution(null, { type: 'remove', index: 0 })).toBeNull();
  });
});

/** Level 1 gespiegelt: Die Fahrt geht nach links. */
function mirrored(): { level: LevelData; sol: Solution } {
  const l = LEVELS[0];
  const W = l.worldW;
  const r = <T extends { x: number; w: number }>(o: T): T => ({ ...o, x: W - o.x - o.w });
  const level: LevelData = {
    ...l,
    spawn: { x: W - l.spawn.x - 30, y: l.spawn.y },
    platforms: l.platforms.map(r),
    stations: l.stations.map((s) => ({ pos: { x: W - s.pos.x, y: s.pos.y } })),
    dismounts: l.dismounts.map(r),
    gifts: l.gifts.map((g) => ({ x: W - g.x, y: g.y })),
    checkpoints: l.checkpoints.map((c) => ({ x: W - c.x, y: c.y })),
    chimney: { x: W - l.chimney.x, y: l.chimney.y },
    hints: [],
  };
  const orig = sols[`../levels/solutions/${l.id}.json`];
  const sol: Solution = { areas: orig.areas.map((a) => ({ strokes: a.strokes.map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [W - x, y] as [number, number]) })) })) };
  return { level, sol };
}

describe('Fahrtrichtung der Station', () => {
  it('Fahrt nach links: Schlitten fährt zum Ziel, egal wohin die Elfe schaut; die Aufnahme besteht die Nachprüfung', () => {
    const { level, sol } = mirrored();
    const sim = new Simulation(level);
    const rec = new Recorder(level);
    sim.player.facing = 1; // rückwärts auf die Station gelaufen
    sim.boardForTest(0);
    for (const s of sol.areas[0].strokes) {
      sim.command({ type: 'strokeBegin', p: { x: s.pts[0][0], y: s.pts[0][1] }, boost: s.boost });
      for (const [x, y] of s.pts.slice(1)) sim.command({ type: 'strokeMove', p: { x, y } });
      sim.command({ type: 'strokeEnd' });
    }
    sim.command({ type: 'launch' });
    let arrived = false;
    for (let t = 0; t < 20 && !arrived; t += Loop.STEP) {
      const ev = sim.step(Loop.STEP, IDLE);
      rec.onEvents(sim, ev);
      arrived = ev.some((e) => e.type === 'arrive');
    }
    expect(arrived).toBe(true);
    expect(checkSolution(level, rec.solution).ok).toBe(true);
  });

  it('eingestellte Richtung gilt, auch vom Ziel weg', () => {
    const { level, sol } = mirrored();
    expect(checkSolution(level, sol).ok).toBe(true);
    const away: LevelData = { ...level, stations: level.stations.map((s) => ({ ...s, dir: 1 as const })) };
    expect(checkSolution(away, sol).ok).toBe(false);
    const sim = new Simulation(away);
    sim.boardForTest(0);
    sim.command({ type: 'launch' });
    sim.step(Loop.STEP, IDLE);
    expect(sim.sled.vel.x).toBeGreaterThan(0);
  });
});
