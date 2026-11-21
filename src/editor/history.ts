import type { LevelData } from '../sim/types';

/** Rückgängig/Wiederholen über unveränderliche Level-Stände. */
export class History {
  private states: LevelData[];
  private idx = 0;

  constructor(initial: LevelData, private readonly limit = 100) {
    this.states = [initial];
  }

  get current(): LevelData { return this.states[this.idx]; }
  get canUndo(): boolean { return this.idx > 0; }
  get canRedo(): boolean { return this.idx < this.states.length - 1; }

  push(l: LevelData): void {
    if (JSON.stringify(l) === JSON.stringify(this.current)) return;
    this.states = this.states.slice(0, this.idx + 1);
    this.states.push(l);
    if (this.states.length > this.limit + 1) this.states.shift();
    this.idx = this.states.length - 1;
  }

  undo(): LevelData | null {
    if (!this.canUndo) return null;
    return this.states[--this.idx];
  }

  redo(): LevelData | null {
    if (!this.canRedo) return null;
    return this.states[++this.idx];
  }
}
