import type { LevelData } from '../sim/types';
import type { SimEvent } from '../sim/events';
import type { Simulation } from '../sim/simulation';
import type { Solution } from '../levels/solveRunner';

export interface Recording { level: LevelData; solution: Solution; solvedAreas: boolean[] }

/** Merkt sich beim Probespielen je Abschnitt die Striche der zuletzt geschafften Fahrt. */
export class Recorder {
  private readonly sol: Solution;
  private readonly solved: boolean[];
  private rideArea = -1;

  constructor(readonly level: LevelData) {
    this.sol = { areas: level.areas.map(() => ({ strokes: [] })) };
    this.solved = level.areas.map(() => false);
  }

  onEvents(sim: Simulation, ev: readonly SimEvent[]): void {
    for (const e of ev) {
      if (e.type === 'launch') this.rideArea = sim.activeArea;
      if ((e.type === 'arrive' || e.type === 'win') && this.rideArea >= 0) {
        const area = this.rideArea;
        this.sol.areas[area] = {
          strokes: sim.ink.strokes.filter((s) => s.area === area)
            .map((s) => ({ boost: s.boost, pts: s.pts.map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]) })),
        };
        this.solved[area] = true;
        this.rideArea = -1;
      }
      if (e.type === 'crash') this.rideArea = -1;
    }
  }

  get solution(): Solution { return this.sol; }
  get solvedAreas(): boolean[] { return this.solved; }
  recording(): Recording { return { level: this.level, solution: this.sol, solvedAreas: this.solved }; }
}

/** Gelöste Abschnitte aus der Probefahrt übernehmen, die übrigen behalten. */
export function mergeSolution(old: Solution | null, rec: Pick<Recording, 'solution' | 'solvedAreas'>): Solution {
  return {
    areas: rec.solution.areas.map((a, i) => (rec.solvedAreas[i] ? a : old?.areas[i] ?? { strokes: [] })),
  };
}

export type AreaOp = { type: 'remove'; index: number } | { type: 'swap'; a: number; b: number };

/** Hält die Lösung passend, wenn Stationen gelöscht oder umnummeriert werden. */
export function reorderSolution(sol: Solution | null, op: AreaOp): Solution | null {
  if (!sol) return null;
  const areas = [...sol.areas];
  if (op.type === 'remove') areas.splice(op.index, 1);
  else if (op.a < areas.length && op.b < areas.length) [areas[op.a], areas[op.b]] = [areas[op.b], areas[op.a]];
  return { areas };
}
