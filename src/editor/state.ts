import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { History } from './history';
import { removeElement, renumberStation, type ElementRef } from './doc';
import { mergeSolution, reorderSolution, type Recording } from './recorder';

interface Snapshot { level: LevelData; solution: Solution | null }

/**
 * Level + Lösung mit gemeinsamem Verlauf: Station löschen/umnummerieren ändert beides,
 * Rückgängig stellt beides zusammen wieder her.
 */
export class EditorState {
  private readonly history: History<Snapshot>;

  constructor(level: LevelData, solution: Solution | null) {
    this.history = new History<Snapshot>({ level, solution });
  }

  get level(): LevelData { return this.history.current.level; }
  get solution(): Solution | null { return this.history.current.solution; }
  get canUndo(): boolean { return this.history.canUndo; }
  get canRedo(): boolean { return this.history.canRedo; }

  /** Neuer Level-Stand (Lösung bleibt). */
  commit(level: LevelData): void {
    this.history.push({ level, solution: this.solution });
  }

  remove(ref: ElementRef): void {
    const solution = ref.kind === 'station' ? reorderSolution(this.solution, { type: 'remove', index: ref.index }) : this.solution;
    this.history.push({ level: removeElement(this.level, ref), solution });
  }

  renumber(from: number, to: number): void {
    this.history.push({ level: renumberStation(this.level, from, to), solution: reorderSolution(this.solution, { type: 'swap', a: from, b: to }) });
  }

  /** Gelöste Abschnitte einer Probefahrt übernehmen; gibt die Zahl der übernommenen Abschnitte zurück. */
  mergeRecording(rec: Recording): number {
    const n = rec.solvedAreas.filter(Boolean).length;
    if (n === 0 || JSON.stringify(rec.level) !== JSON.stringify(this.level)) return 0;
    this.history.push({ level: this.level, solution: mergeSolution(this.solution, rec) });
    return n;
  }

  undo(): boolean { return this.history.undo() !== null; }
  redo(): boolean { return this.history.redo() !== null; }
}
